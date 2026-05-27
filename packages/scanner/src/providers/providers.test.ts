import { describe, expect, it } from 'bun:test'
import { createProviders, NativeProvider } from './index.ts'

// MARK: - createProviders

describe('createProviders', () => {
  it('returns the native HTTP provider', () => {
    const providers = createProviders()
    expect(providers.map((p) => p.name)).toEqual(['native'])
    expect(providers[0]).toBeInstanceOf(NativeProvider)
  })
})
