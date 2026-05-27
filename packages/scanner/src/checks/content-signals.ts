import { ECategory, EStatus, ECheckScope } from '../types.ts'
import { originOf } from '../util/url.ts'
import { defineCheck, makeResult, type ICheckDef } from './builder.ts'

// MARK: - Content Signals (robots.txt)

/**
 * Cloudflare-led declarative policy (`Content-Signal: ai-train=no, …`) inside
 * robots.txt — deployed on 3.8M+ domains via managed robots.txt. Advisory only
 * (honoring is voluntary) — reported, never scored.
 */

const def: ICheckDef = {
  id: 'content-signals.present',
  category: ECategory.CRAWLER_ACCESS,
  weight: 0,
  title: 'Content Signals policy',
  scope: ECheckScope.SITE,
}

/**
 * Check for Cloudflare Content-Signal declarations in robots.txt (informational, unscored).
 *
 * @async
 * @export
 */
export const contentSignalsCheck = defineCheck(def, async (ctx) => {
  const robots = await ctx.fetchCached(`${originOf(ctx.url)}/robots.txt`)
  if (!robots.ok) {
    return makeResult(def, EStatus.INFO, 'no robots.txt — no Content Signals to read', {
      evidence: { robotsStatus: robots.status },
    })
  }

  const lines = robots.body
    .split(/\r?\n/)
    .filter((line) => /^\s*content-signal\s*:/i.test(line))
    .map((line) => line.trim())

  const detail =
    lines.length > 0
      ? `declares Content Signals (${lines.join(' · ')}) — advisory AI-usage policy (no score impact)`
      : 'no Content Signals in robots.txt — emerging advisory standard (~4% adoption); no score impact'

  return makeResult(def, EStatus.INFO, detail, {
    evidence: { signals: lines },
    docsUrl: 'https://blog.cloudflare.com/content-signals-policy/',
  })
})
