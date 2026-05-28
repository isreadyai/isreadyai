/**
 * Main content extractability check — scores semantic structure that lets crawlers isolate the article from chrome.
 *
 * Scores four signals on the served HTML (rendered when available, else raw):
 * presence of <main> or <article>, exactly one <h1>, at least one <h2>, and both <nav> and <footer>.
 *
 * @module checks/rendering/main-content
 * @export
 */

import { ECategory, ELevel, EStatus } from '../../types.ts'
import { countTag } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'rendering.main-content',
  category: ECategory.RENDERING,
  weight: 2,
  title: 'Main content extractability',
}

// MARK: - Check

/**
 * Evaluates semantic structure signals for main content extraction.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if all 4 signals present; WARN if 2+ present; FAIL if <2.
 * @export
 */
export const mainContent = defineCheck(def, (ctx) => {
  const html = ctx.raw.body

  const hasMain = countTag(html, 'main') > 0 || countTag(html, 'article') > 0
  const hasSingleH1 = countTag(html, 'h1') === 1
  const hasH2 = countTag(html, 'h2') >= 1
  const hasChrome = countTag(html, 'nav') > 0 && countTag(html, 'footer') > 0

  const missing: string[] = []
  if (!hasMain) {
    missing.push('<main> or <article>')
  }
  if (!hasSingleH1) {
    missing.push('exactly one <h1>')
  }
  if (!hasH2) {
    missing.push('at least one <h2>')
  }
  if (!hasChrome) {
    missing.push('<nav> and <footer>')
  }

  const signals = 4 - missing.length
  const score = signals / 4
  const evidence = { signals, hasMain, hasSingleH1, hasH2, hasChrome }

  if (signals === 4) {
    return makeResult(def, EStatus.PASS, 'served HTML is semantically extractable', {
      evidence,
    })
  }

  const detail = `missing semantic signals: ${missing.join(', ')}`

  if (signals >= 2) {
    return makeResult(def, EStatus.WARN, detail, {
      score,
      fix: 'add the missing semantic landmarks so crawlers can isolate the main content',
      impact: ELevel.MEDIUM,
      effort: ELevel.LOW,
      evidence,
    })
  }

  return makeResult(def, EStatus.FAIL, detail, {
    score,
    fix: 'wrap content in <main>/<article> with a single <h1> and section headings',
    impact: ELevel.MEDIUM,
    effort: ELevel.MEDIUM,
    evidence,
  })
})
