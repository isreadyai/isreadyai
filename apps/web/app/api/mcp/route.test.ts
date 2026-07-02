import { describe, expect, test } from 'bun:test'
import { batchTooLarge, rateLimitUnits } from './route.ts'

// MARK: - MCP batch cap

describe('batchTooLarge', () => {
  test('allows a batch within the cap', () => {
    expect(batchTooLarge(Array.from({ length: 50 }, () => ({})))).toBe(false)
  })

  test('rejects a batch over the cap', () => {
    expect(batchTooLarge(Array.from({ length: 51 }, () => ({})))).toBe(true)
  })

  test('a single request object is not a batch', () => {
    expect(batchTooLarge({ jsonrpc: '2.0', method: 'ping' })).toBe(false)
  })
})

// MARK: - Rate-limit accounting

describe('rateLimitUnits', () => {
  test('charges one unit per batch item', () => {
    expect(rateLimitUnits(Array.from({ length: 50 }, () => ({})))).toBe(50)
  })

  test('charges one unit for a single request object', () => {
    expect(rateLimitUnits({ jsonrpc: '2.0', method: 'ping' })).toBe(1)
  })

  test('charges nothing for an empty batch', () => {
    expect(rateLimitUnits([])).toBe(0)
  })
})
