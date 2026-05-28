/**
 * Markdown content negotiation check — rewards servers that serve Markdown for agents via Accept headers.
 *
 * Emerging agent standard (Cloudflare, Vercel, Mintlify, Stripe): serving `Accept: text/markdown` cuts
 * ~80% of tokens vs HTML. Rewarded when present, never penalized when absent — adoption is still single-digit percent.
 *
 * @module checks/rendering/markdown-negotiation
 * @export
 */

import { ECategory, EStatus, ECheckScope } from '../../types.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'rendering.markdown-negotiation',
  category: ECategory.RENDERING,
  weight: 1,
  title: 'Markdown content negotiation',
  scope: ECheckScope.SITE,
}

// MARK: - Check

/**
 * Checks whether the server responds to Markdown negotiation requests.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context with fetch capabilities.
 * @returns {Promise<import('../builder.ts').ICheckResult>} - A PASS if Markdown is served; INFO otherwise (no penalty).
 * @async
 * @export
 */
export const markdownNegotiation = defineCheck(def, async (ctx) => {
  const response = await ctx.fetchWith(ctx.url, {
    accept: 'text/markdown, text/html;q=0.8, */*;q=0.5',
  })
  const contentType = response.headers['content-type'] ?? ''
  const vary = response.headers['vary'] ?? ''
  const looksMarkdown =
    contentType.includes('text/markdown') ||
    (contentType.includes('text/plain') && !response.body.trimStart().startsWith('<'))

  if (response.ok && looksMarkdown) {
    return makeResult(
      def,
      EStatus.PASS,
      'serves Markdown via Accept negotiation (~80% fewer tokens for agents)',
      {
        evidence: {
          contentType,
          varyAccept: vary.toLowerCase().includes('accept'),
          tokensHeader: response.headers['x-markdown-tokens'],
        },
        docsUrl: 'https://blog.cloudflare.com/markdown-for-agents/',
      },
    )
  }
  return makeResult(
    def,
    EStatus.INFO,
    'no Markdown negotiation — emerging standard (Cloudflare, Vercel, Mintlify serve it); no score impact',
    {
      evidence: { contentType },
      docsUrl: 'https://blog.cloudflare.com/markdown-for-agents/',
    },
  )
})
