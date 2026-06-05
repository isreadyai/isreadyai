import { describe, expect, test } from 'bun:test'
import { assertRepoOwnership, CiRepoTakeoverError } from './ci-reports'

describe('assertRepoOwnership', () => {
  test('allows the same owner to re-upload', () => {
    expect(() => assertRepoOwnership('1234', 'user-a', 'user-a')).not.toThrow()
  })

  test('rejects a different account seizing the repo registration', () => {
    expect(() => assertRepoOwnership('1234', 'user-a', 'user-b')).toThrow(CiRepoTakeoverError)
  })

  test('rejects an upload against a repo whose owner is unknown', () => {
    expect(() => assertRepoOwnership('1234', null, 'user-b')).toThrow(CiRepoTakeoverError)
  })
})
