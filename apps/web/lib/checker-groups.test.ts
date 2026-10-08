import { describe, expect, test } from 'bun:test'
import { allChecks } from '@isreadyai/scanner'
import { CHECK_CATEGORY_ORDER } from '@/lib/check-category-docs'
import { checkGroups } from './checker-groups'

describe('checkGroups', () => {
  const { scored, informational } = checkGroups(allChecks)

  test('lists every scored check exactly once, in its own category', () => {
    const listed = scored.flatMap((group) => group.checks.map((check) => check.id))
    const expected = allChecks.filter((check) => check.weight > 0).map((check) => check.id)
    expect(listed.toSorted()).toEqual(expected.toSorted())
    expect(new Set(listed).size).toBe(listed.length)
    for (const group of scored) {
      expect(group.checks.every((check) => check.category === group.category)).toBe(true)
    }
  })

  test('puts weight-0 checks only in the informational list', () => {
    const zeroWeight = allChecks.filter((check) => check.weight === 0).map((check) => check.id)
    expect(informational.map((check) => check.id)).toEqual(zeroWeight)
    expect(informational.length).toBeGreaterThan(0)
    const scoredIds = scored.flatMap((group) => group.checks.map((check) => check.id))
    expect(scoredIds.some((id) => zeroWeight.includes(id))).toBe(false)
  })

  test('orders groups by the category order', () => {
    const order = scored.map((group) => CHECK_CATEGORY_ORDER.indexOf(group.category))
    expect(order).toEqual(order.toSorted((a, b) => a - b))
  })

  test('omits categories without scored checks', () => {
    const only = allChecks.filter((check) => check.category === CHECK_CATEGORY_ORDER[0])
    const result = checkGroups(only.map((check) => ({ ...check, weight: 0 })))
    expect(result.scored).toEqual([])
    expect(result.informational).toHaveLength(only.length)
  })
})
