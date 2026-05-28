/**
 * Checks that priority AI crawlers (search, answer, user-facing services) are not blocked by robots.txt.
 * Blocking these crawlers removes your site from major AI-powered answer surfaces.
 */

import type { ICheckDef } from '../builder.ts'
import type { TAiCrawlerVerdict } from '../../crawlers.ts'
import { ECategory, ELevel, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult } from '../builder.ts'
import { isFullyBlocked, parseRobots } from '../../util/robots.ts'
import { AI_CRAWLERS, ECrawlerPurpose, PRIORITY_TOKENS } from '../../crawlers.ts'

// MARK: - AI crawler allowlisting in robots.txt

const def: ICheckDef = {
  id: 'crawler.robots.ai-bots',
  category: ECategory.CRAWLER_ACCESS,
  weight: 5,
  title: 'AI crawlers are allowed in robots.txt',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://platform.openai.com/docs/bots'

/**
 * Check that priority AI crawlers are not blocked by robots.txt rules.
 *
 * @param ctx - The check context containing URL and fetch methods.
 * @returns A promise resolving to a check result indicating pass, warning, or failure status.
 * @async
 * @export
 */
export const robotsAiBotsCheck = defineCheck(def, async (ctx) => {
  const robotsUrl = new URL('/robots.txt', ctx.url).toString()
  const res = await ctx.fetchCached(robotsUrl)

  const hasRobots =
    res.error === undefined && res.status >= 200 && res.status < 400 && res.body.trim().length > 0

  // No robots.txt => nothing is blocked => every crawler may read the site.
  if (!hasRobots) {
    return makeResult(
      def,
      EStatus.PASS,
      'No robots.txt rules block AI crawlers (allow-all by default).',
      {
        evidence: { url: robotsUrl, status: res.status, robotsPresent: false },
        docsUrl: DOCS,
      },
    )
  }

  const robots = parseRobots(res.body)

  const verdicts: TAiCrawlerVerdict[] = AI_CRAWLERS.map((c) => ({
    token: c.token,
    operator: c.operator,
    purpose: c.purpose,
    surface: c.surface,
    blocked: isFullyBlocked(robots, c.token),
  }))

  // Score over the priority tokens only.
  const priority = verdicts.filter((v) => PRIORITY_TOKENS.includes(v.token))
  const allowedPriority = priority.filter((v) => !v.blocked).length
  const score = priority.length > 0 ? allowedPriority / priority.length : 1

  const blocked = verdicts.filter((v) => v.blocked)
  const blockedSearchOrUser = blocked.filter(
    (v) =>
      PRIORITY_TOKENS.includes(v.token) &&
      (v.purpose === ECrawlerPurpose.SEARCH || v.purpose === ECrawlerPurpose.USER),
  )
  const blockedTrainingOnly = blocked.filter((v) => v.purpose === ECrawlerPurpose.TRAINING)

  const evidence = {
    url: robotsUrl,
    crawlers: verdicts,
    priorityAllowed: allowedPriority,
    priorityTotal: priority.length,
  }

  // A blocked search/user priority crawler removes you from that answer surface.
  if (blockedSearchOrUser.length > 0) {
    const surfaces = blockedSearchOrUser.map((v) => `${v.token} (${v.surface})`).join(', ')
    return makeResult(
      def,
      EStatus.FAIL,
      `robots.txt fully blocks AI answer crawlers — you are removed from: ${surfaces}.`,
      {
        evidence,
        fix: `Remove the Disallow rules for these tokens (or add explicit Allow groups): ${blockedSearchOrUser
          .map((v) => v.token)
          .join(', ')}. These power live AI search/answer surfaces, not just training.`,
        impact: ELevel.HIGH,
        effort: ELevel.LOW,
        score,
        docsUrl: DOCS,
      },
    )
  }

  // Only training crawlers blocked: legitimate policy choice, but worth reporting.
  if (blockedTrainingOnly.length > 0) {
    const tokens = blockedTrainingOnly.map((v) => v.token).join(', ')
    return makeResult(
      def,
      EStatus.WARN,
      `robots.txt blocks training-only crawlers (${tokens}). This is a legitimate policy choice; the consequence is your content won't be ingested into those models' training corpora (it remains readable by live search/answer crawlers).`,
      {
        evidence,
        fix: `If excluding your content from AI training is intentional, no action needed. To allow it, remove the Disallow rules for: ${tokens}.`,
        impact: ELevel.MEDIUM,
        effort: ELevel.LOW,
        score,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(def, EStatus.PASS, 'All priority AI crawlers are allowed in robots.txt.', {
    evidence,
    score,
    docsUrl: DOCS,
  })
})
