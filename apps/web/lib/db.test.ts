import { describe, expect, test } from 'bun:test'
import { requireData, requireSuccess } from './db'

// MARK: - Checked Supabase write adapters

describe('requireSuccess', () => {
  test('returns for a clean result', () => {
    expect(() => requireSuccess({ error: null }, 'ctx')).not.toThrow()
  })

  test('throws with context on a provider error', () => {
    expect(() => requireSuccess({ error: { message: 'boom' } }, 'profile sync')).toThrow(
      /profile sync: boom/,
    )
  })
})

describe('requireData', () => {
  test('returns the row when present', () => {
    expect(requireData({ data: { id: 1 }, error: null }, 'ctx')).toEqual({ id: 1 })
  })

  test('throws on a provider error', () => {
    expect(() => requireData({ data: null, error: { message: 'boom' } }, 'ctx')).toThrow(/boom/)
  })

  test('throws when no row was returned', () => {
    expect(() => requireData({ data: null, error: null }, 'ctx')).toThrow(/no row/)
  })
})
