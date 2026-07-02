import { afterEach, expect, test } from 'bun:test'

import { isAuthorizedCron } from '@/lib/cron-auth'

const SECRET = 'top-secret-cron-value'

function requestWith(authorization: string | null): Request {
  const headers = new Headers()
  if (authorization !== null) {
    headers.set('authorization', authorization)
  }
  return new Request('https://example.com/api/cron/x', { headers })
}

afterEach(() => {
  delete process.env.CRON_SECRET
})

test('authorized when the Bearer token matches CRON_SECRET', () => {
  process.env.CRON_SECRET = SECRET
  expect(isAuthorizedCron(requestWith(`Bearer ${SECRET}`))).toBe(true)
})

test('rejected when the token is wrong', () => {
  process.env.CRON_SECRET = SECRET
  expect(isAuthorizedCron(requestWith('Bearer nope'))).toBe(false)
})

test('rejected when a same-length token differs (constant-time path)', () => {
  process.env.CRON_SECRET = SECRET
  expect(isAuthorizedCron(requestWith(`Bearer ${'x'.repeat(SECRET.length)}`))).toBe(false)
})

test('rejected when the Authorization header is missing', () => {
  process.env.CRON_SECRET = SECRET
  expect(isAuthorizedCron(requestWith(null))).toBe(false)
})

test('rejected when CRON_SECRET is unset', () => {
  delete process.env.CRON_SECRET
  expect(isAuthorizedCron(requestWith(`Bearer ${SECRET}`))).toBe(false)
})

test('rejected when CRON_SECRET is empty', () => {
  process.env.CRON_SECRET = ''
  expect(isAuthorizedCron(requestWith('Bearer '))).toBe(false)
})
