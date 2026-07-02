import { describe, expect, test } from 'bun:test'
import { parseFixNotify } from './route'

describe('parseFixNotify', () => {
  const valid = { repo: 'owner/repo', prUrl: 'https://github.com/owner/repo/pull/3', patches: 2 }

  test('accepts a well-formed github pull-request payload', () => {
    expect(parseFixNotify(valid).ok).toBe(true)
  })

  test('rejects a prUrl that is not an https github.com url', () => {
    expect(parseFixNotify({ ...valid, prUrl: 'https://evil.com/owner/repo/pull/3' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, prUrl: 'http://github.com/owner/repo/pull/3' }).ok).toBe(
      false,
    )
    expect(parseFixNotify({ ...valid, prUrl: 'https://github.com.evil.com/x' }).ok).toBe(false)
  })

  test('rejects missing or malformed fields', () => {
    expect(parseFixNotify({ ...valid, repo: '' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, prUrl: 'not-a-url' }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, patches: -1 }).ok).toBe(false)
    expect(parseFixNotify({ ...valid, patches: 1.5 }).ok).toBe(false)
    expect(parseFixNotify(null).ok).toBe(false)
  })
})
