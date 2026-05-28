/**
 * Detects WAF/server rules that block AI user-agents by comparing responses to normal vs. GPTBot requests.
 * Even when robots.txt allows crawlers, server rules can still discriminate AI crawlers at the HTTP level.
 */

import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Server-level AI user-agent blocking

const GPTBOT_UA =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot'

const BLOCKED_STATUSES = new Set([401, 403, 406, 429, 503])

const def: ICheckDef = {
  id: 'crawler.ua-blocking',
  category: ECategory.CRAWLER_ACCESS,
  weight: 3,
  title: 'Server responds equally to AI user-agents',
  scope: ECheckScope.SITE,
}

/**
 * Check that server-level rules do not discriminate against AI user-agents.
 *
 * @param ctx - The check context containing raw response and fetch methods.
 * @returns A promise resolving to a check result indicating pass, warning, or failure status.
 * @async
 * @export
 */
export const uaBlocking = defineCheck(def, async (ctx) => {
  if (!ctx.raw.ok) {
    return makeResult(def, EStatus.INFO, 'primary fetch failed — UA comparison skipped', {
      evidence: { normalStatus: ctx.raw.status },
    })
  }

  const asBot = await ctx.fetchWith(ctx.url, { 'user-agent': GPTBOT_UA })
  const evidence = { normalStatus: ctx.raw.status, gptbotUaStatus: asBot.status }

  if (asBot.ok) {
    return makeResult(def, EStatus.PASS, 'AI user-agents receive the same response as browsers', {
      evidence,
    })
  }
  if (BLOCKED_STATUSES.has(asBot.status) || asBot.status === 0) {
    return makeResult(
      def,
      EStatus.WARN,
      `requests presenting a GPTBot user-agent get HTTP ${asBot.status || 'no response'} while normal requests get ${ctx.raw.status} — a WAF/server rule is discriminating AI crawlers`,
      {
        score: 0.25,
        fix: 'Review WAF/bot-management rules: if you want AI visibility, allowlist verified AI crawlers (by published IP ranges) instead of blocking by user-agent. Note: if your rule only blocks UNVERIFIED AI user-agents, real crawlers from provider IPs may still pass.',
        impact: ELevel.HIGH,
        effort: ELevel.MEDIUM,
        evidence,
        docsUrl: 'https://developers.cloudflare.com/ai-crawl-control/',
      },
    )
  }
  return makeResult(
    def,
    EStatus.WARN,
    `AI user-agent receives HTTP ${asBot.status} (normal: ${ctx.raw.status}) — responses differ`,
    {
      score: 0.5,
      fix: 'Serve the same content to AI crawlers as to browsers.',
      impact: ELevel.MEDIUM,
      effort: ELevel.MEDIUM,
      evidence,
    },
  )
})
