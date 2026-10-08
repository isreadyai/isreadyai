import { describe, expect, test } from 'bun:test'
import { scoreWeightShares } from './score-weight-table'

describe('scoreWeightShares', () => {
  test('the five scored shares add up to 100', () => {
    const rows = scoreWeightShares()
    expect(rows.map((row) => row.label)).toEqual([
      'Crawler access',
      'Rendering',
      'Structured data',
      'Trust & security',
      'Content (GEO)',
    ])
    const total = rows.reduce((sum, row) => sum + Number(row.share.replace('%', '')), 0)
    expect(total).toBe(100)
  })
})
