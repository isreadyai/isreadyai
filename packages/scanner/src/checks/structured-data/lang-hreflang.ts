/**
 * Language declaration check — ensures <html lang> attribute communicates content language to crawlers.
 *
 * A <html lang> attribute tells crawlers and LLMs the content language with zero ambiguity.
 * hreflang alternates are reported as informational context only.
 *
 * @module checks/structured-data/lang-hreflang
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { extractHtmlLangAttr, hasHreflang } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'structured.lang',
  category: ECategory.STRUCTURED_DATA,
  weight: 1,
  title: 'Language declaration',
}

// MARK: - Check

/**
 * Evaluates language declaration via <html lang> attribute and hreflang presence.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if <html lang> is present; WARN otherwise.
 * @export
 */
export const langHreflangCheck = defineCheck(def, (ctx) => {
  const lang = extractHtmlLangAttr(ctx.raw.body)
  const hreflang = hasHreflang(ctx.raw.body)
  const evidence = { lang, hreflang }

  if (lang !== null && lang.length > 0) {
    const detail = hreflang
      ? `content language declared (lang="${lang}"); hreflang alternates present`
      : `content language declared (lang="${lang}")`
    return makeResult(def, EStatus.PASS, detail, { evidence })
  }

  const detail = hreflang
    ? '<html lang> attribute is missing; hreflang alternates present'
    : '<html lang> attribute is missing'
  return makeResult(def, EStatus.WARN, detail, {
    score: 0.25,
    fix: 'add a <html lang="…"> attribute so crawlers and LLMs know the content language.',
    impact: ELevel.LOW,
    effort: ELevel.LOW,
    evidence,
  })
})
