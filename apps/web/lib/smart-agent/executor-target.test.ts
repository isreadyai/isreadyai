import { describe, expect, test } from 'bun:test'
import { sandboxCredentials, usesVercelSandbox } from './executor-target.ts'

describe('usesVercelSandbox', () => {
  test('local provider with empty snapshot id stays local', () => {
    // The local .env sets AGENT_BROWSER_SNAPSHOT_ID= (empty). An empty string is
    // "set" but means "no snapshot" — it must NOT route to the Vercel Sandbox.
    expect(
      usesVercelSandbox({ AGENT_BROWSER_PROVIDER: 'local', AGENT_BROWSER_SNAPSHOT_ID: '' }),
    ).toBe(false)
  })

  test('no relevant env vars stays local', () => {
    expect(usesVercelSandbox({})).toBe(false)
  })

  test('explicit sandbox provider routes to sandbox', () => {
    expect(usesVercelSandbox({ AGENT_BROWSER_PROVIDER: 'sandbox' })).toBe(true)
  })

  test('non-empty snapshot id routes to sandbox', () => {
    expect(usesVercelSandbox({ AGENT_BROWSER_SNAPSHOT_ID: 'snap_123' })).toBe(true)
  })

  test('VERCEL=1 routes to sandbox', () => {
    expect(usesVercelSandbox({ VERCEL: '1' })).toBe(true)
  })
})

describe('sandboxCredentials', () => {
  test('empty token strings are treated as missing', () => {
    expect(
      sandboxCredentials({ VERCEL_TOKEN: '', VERCEL_TEAM_ID: '', VERCEL_PROJECT_ID: '' }),
    ).toEqual({})
  })

  test('all three present yields credentials', () => {
    expect(
      sandboxCredentials({ VERCEL_TOKEN: 't', VERCEL_TEAM_ID: 'team', VERCEL_PROJECT_ID: 'proj' }),
    ).toEqual({ token: 't', teamId: 'team', projectId: 'proj' })
  })

  test('partial credentials yield empty', () => {
    expect(sandboxCredentials({ VERCEL_TOKEN: 't' })).toEqual({})
  })
})
