import { describe, expect, test } from 'bun:test'
import { AI_CRAWLERS, CATEGORY_WEIGHTS, ECategory } from '@isreadyai/scanner'
import { llmsFullTxt, llmsTxt } from './llms-content'

describe('llmsTxt', () => {
  test('follows the llmstxt.org order: H1, blockquote, then H2 link lists', () => {
    const text = llmsTxt()
    expect(text.startsWith('# isready.ai\n')).toBe(true)
    expect(text).toContain('> Free, open-source audit')
    const firstHeading = text.indexOf('\n## ')
    const firstLink = text.indexOf('\n- [')
    expect(firstLink).toBeGreaterThan(firstHeading)
    expect(text).toContain('## Product')
    expect(text).toContain('## Machine readable')
    expect(text).toContain('## Optional')
    expect(text).toContain('/llms-full.txt')
    expect(text).not.toMatch(/^### /m)
  })
})

describe('llmsFullTxt', () => {
  test('includes the live category weights', () => {
    const text = llmsFullTxt()
    expect(text).toContain(
      `Crawler access: ${Math.round(CATEGORY_WEIGHTS[ECategory.CRAWLER_ACCESS] * 100)}%`,
    )
    expect(text).toContain(
      `Content (GEO): ${Math.round(CATEGORY_WEIGHTS[ECategory.GEO_CONTENT] * 100)}%`,
    )
    expect(AI_CRAWLERS.length).toBeGreaterThan(0)
  })
})
