import { describe, expect, test } from 'bun:test'
import { isAllowedChildEnvKey } from '@/lib/smart-agent/local-executor'

// MARK: - agent-browser child environment

describe('isAllowedChildEnvKey', () => {
  test('keeps browser-relevant vars', () => {
    expect(isAllowedChildEnvKey('PATH')).toBe(true)
    expect(isAllowedChildEnvKey('HOME')).toBe(true)
    expect(isAllowedChildEnvKey('AGENT_BROWSER_EXECUTABLE')).toBe(true)
  })

  test('strips app secrets and the provider override', () => {
    expect(isAllowedChildEnvKey('AGENT_BROWSER_PROVIDER')).toBe(false)
    expect(isAllowedChildEnvKey('SUPABASE_SECRET_KEY')).toBe(false)
    expect(isAllowedChildEnvKey('STRIPE_SECRET_KEY')).toBe(false)
    expect(isAllowedChildEnvKey('PROXY_TOKEN_SECRET')).toBe(false)
  })
})
