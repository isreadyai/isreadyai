import { describe, expect, test } from 'bun:test'
import { AI_CRAWLERS } from '@isreadyai/scanner'
import robots from './robots'

describe('robots', () => {
  test('names every scanner AI crawler and still blocks /api/', () => {
    const rules = robots().rules
    const list = Array.isArray(rules) ? rules : [rules]
    const agents = list.map((rule) => rule.userAgent)
    expect(agents).toContain('*')
    for (const crawler of AI_CRAWLERS) {
      expect(agents).toContain(crawler.token)
    }
    for (const rule of list) {
      expect(rule.disallow).toEqual(['/api/'])
    }
  })
})
