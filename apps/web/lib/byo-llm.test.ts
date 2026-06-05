import { describe, expect, test } from 'bun:test'
import { isByoProvider, resolveByoModel } from './byo-llm.ts'

describe('isByoProvider', () => {
  test('accepts the four supported providers', () => {
    expect(isByoProvider('xai')).toBe(true)
    expect(isByoProvider('openai')).toBe(true)
    expect(isByoProvider('google')).toBe(true)
    expect(isByoProvider('anthropic')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isByoProvider('mistral')).toBe(false)
    expect(isByoProvider('')).toBe(false)
    expect(isByoProvider(null)).toBe(false)
    expect(isByoProvider(42)).toBe(false)
  })
})

describe('resolveByoModel', () => {
  test('rejects an unsupported provider before touching the key', async () => {
    const result = await resolveByoModel('mistral', 'sk-whatever')
    expect(result).toEqual({ ok: false, reason: 'invalid_provider' })
  })

  test('rejects an empty key for a valid provider', async () => {
    expect(await resolveByoModel('openai', '')).toEqual({ ok: false, reason: 'missing_key' })
    expect(await resolveByoModel('openai', '   ')).toEqual({ ok: false, reason: 'missing_key' })
  })

  test('builds a model for each installed provider with a non-empty key', async () => {
    for (const provider of ['anthropic', 'openai', 'google', 'xai'] as const) {
      const result = await resolveByoModel(provider, 'test-key')
      expect(result.ok).toBe(true)
    }
  })
})
