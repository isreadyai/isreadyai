/**
 * Detects WAF/server rules that turn away AI crawlers by requesting the homepage with each crawler's user-agent.
 * Even when robots.txt allows crawlers, server rules can still discriminate AI crawlers at the HTTP level.
 */

import type { IRawResponse } from '../../types.ts'
import type { ICrawlerProbe, TProbeOutcome } from '../../crawler-access.ts'
import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'
import { EProbeOutcome } from '../../crawler-access.ts'
import { ECrawlerPurpose, PROBED_CRAWLERS } from '../../crawlers.ts'
import { challengeSignal } from '../../util/challenge.ts'
import { isFullyBlocked, parseRobots } from '../../util/robots.ts'

// MARK: - Server-level AI user-agent blocking

const def: ICheckDef = {
  id: 'crawler.ua-blocking',
  category: ECategory.CRAWLER_ACCESS,
  weight: 3,
  title: 'Server responds equally to AI user-agents',
  scope: ECheckScope.SITE,
}

const FIX =
  "Review your WAF or bot-management rules and allowlist verified AI crawlers by their published IP ranges instead of blocking by user-agent. This scan sends each crawler's documented user-agent from isready.ai's servers, so a rule that only blocks unverified AI user-agents can refuse it while the real crawler gets through; confirm in your WAF logs."

/**
 * Check that server-level rules do not turn away AI crawler user-agents.
 *
 * @param ctx - The check context containing raw response and fetch methods.
 * @returns A promise resolving to a check result indicating pass, warning, or info status.
 * @async
 * @export
 */
export const uaBlocking = defineCheck(def, async (ctx) => {
  if (!ctx.raw.ok) {
    return makeResult(def, EStatus.INFO, 'primary fetch failed — UA comparison skipped', {
      evidence: { normalStatus: ctx.raw.status },
    })
  }

  const robotsRes = await ctx.fetchCached(new URL('/robots.txt', ctx.url).toString())
  const hasRobots =
    robotsRes.error === undefined &&
    robotsRes.status >= 200 &&
    robotsRes.status < 400 &&
    robotsRes.body.trim().length > 0
  const robots = hasRobots ? parseRobots(robotsRes.body) : null

  const probes: ICrawlerProbe[] = await Promise.all(
    PROBED_CRAWLERS.map(async (crawler) => {
      const res = await ctx.fetchWith(ctx.url, { 'user-agent': crawler.probeUserAgent })
      return { token: crawler.token, status: res.status, outcome: classify(res) }
    }),
  )
  const evidence = { normalStatus: ctx.raw.status, probes: probes.map((p) => ({ ...p })) }

  const refused = PROBED_CRAWLERS.flatMap((crawler) => {
    const probe = probes.find((p) => p.token === crawler.token)
    return probe !== undefined && probe.outcome !== EProbeOutcome.SERVED ? [{ crawler, probe }] : []
  })

  if (refused.length === 0) {
    return makeResult(
      def,
      EStatus.PASS,
      `All ${probes.length} AI user-agents get the same response as a browser.`,
      { evidence },
    )
  }

  const list = refused.map(({ probe }) => `${probe.token} (${describe(probe)})`).join(', ')
  const robotsAllowed = refused
    .filter(({ crawler }) => robots === null || !isFullyBlocked(robots, crawler.token))
    .map(({ crawler }) => crawler.token)
  const silentNote =
    robotsAllowed.length > 0
      ? ` robots.txt allows ${robotsAllowed.join(', ')}, so nothing in robots.txt shows this block.`
      : ''
  const searchOrUser = refused.some(
    ({ crawler }) =>
      crawler.purpose === ECrawlerPurpose.SEARCH || crawler.purpose === ECrawlerPurpose.USER,
  )

  return makeResult(
    def,
    EStatus.WARN,
    `${refused.length} of ${probes.length} AI user-agents are turned away while a browser gets HTTP ${ctx.raw.status}: ${list}.${silentNote}`,
    {
      score: Math.max(0.25, 1 - (0.75 * refused.length) / probes.length),
      fix: FIX,
      impact: searchOrUser ? ELevel.HIGH : ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      evidence,
      docsUrl: 'https://developers.cloudflare.com/ai-crawl-control/',
    },
  )
})

// MARK: - internal

function classify(res: IRawResponse): TProbeOutcome {
  if (res.status === 0 || res.error !== undefined) return EProbeOutcome.NO_RESPONSE
  if (res.status < 200 || res.status >= 300) return EProbeOutcome.REFUSED
  return challengeSignal(res.body) !== null ? EProbeOutcome.CHALLENGED : EProbeOutcome.SERVED
}

function describe(probe: ICrawlerProbe): string {
  if (probe.outcome === EProbeOutcome.CHALLENGED) return 'challenge page'
  if (probe.outcome === EProbeOutcome.NO_RESPONSE) return 'no response'
  return String(probe.status)
}
