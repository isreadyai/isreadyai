import { ECategory, EStatus, ECheckScope } from '../types.ts'
import { defineCheck, makeResult, type ICheckDef } from './builder.ts'
import { originOf } from '../util/url.ts'

// MARK: - llms.txt presence (informational)

/**
 * Always INFO, weight 0: server-log studies show AI crawlers fetch llms.txt in
 * ~0.1% of visits and SE Ranking found no citation correlation across 300k
 * domains. ~10% of sites publish it and IDE agents consume it, so presence is
 * reported without touching the score.
 */

const def: ICheckDef = {
  id: 'llms-txt.present',
  category: ECategory.CRAWLER_ACCESS,
  weight: 0,
  title: 'llms.txt presence (informational)',
  scope: ECheckScope.SITE,
}

const DOCS = 'https://llmstxt.org'

/**
 * Check for llms.txt presence (informational, unscored).
 *
 * @async
 * @export
 */
export const llmsTxtCheck = defineCheck(def, async (ctx) => {
  const llmsUrl = `${originOf(ctx.raw.finalUrl)}/llms.txt`
  const res = await ctx.fetchCached(llmsUrl)

  const body = res.body.trim()
  const present =
    res.error === undefined && res.status === 200 && body.length > 0 && !body.startsWith('<')

  if (present) {
    return makeResult(
      def,
      EStatus.INFO,
      'llms.txt present — optional signal consumed by some dev tools (Cursor, IDE agents), ignored by major AI crawlers.',
      {
        evidence: { url: llmsUrl, status: res.status, present: true },
        score: 1,
        docsUrl: DOCS,
      },
    )
  }

  return makeResult(
    def,
    EStatus.INFO,
    'no llms.txt — optional; not consumed by major AI providers, low priority.',
    {
      evidence: { url: llmsUrl, status: res.status, present: false },
      score: 1,
      docsUrl: DOCS,
    },
  )
})
