import { describe, expect, test } from 'bun:test'
import { ECategory } from '@isreadyai/scanner'
import {
  CHECK_CATEGORY_DOCUMENTATION,
  CHECK_CATEGORY_ORDER,
  SCORE_SOURCE_URL,
  checkCategoryFaqHref,
} from './check-category-docs'

describe('check category documentation', () => {
  test('documents every scored category with a unique FAQ anchor', () => {
    expect(CHECK_CATEGORY_ORDER).toEqual(Object.values(ECategory))

    const faqIds = CHECK_CATEGORY_ORDER.map(
      (category) => CHECK_CATEGORY_DOCUMENTATION[category].faqId,
    )
    expect(new Set(faqIds).size).toBe(faqIds.length)
    expect(faqIds.every((id) => id.startsWith('faq-'))).toBe(true)
  })

  test('links report categories to their FAQ and source family', () => {
    for (const category of CHECK_CATEGORY_ORDER) {
      const documentation = CHECK_CATEGORY_DOCUMENTATION[category]
      expect(checkCategoryFaqHref(category)).toBe(`/#${documentation.faqId}`)
      expect(documentation.sourceUrl).toContain('/packages/scanner/src/checks/')
    }
    expect(SCORE_SOURCE_URL).toEndWith('/packages/scanner/src/score.ts')
  })
})
