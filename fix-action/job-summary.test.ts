import { describe, expect, test } from 'bun:test'
import { buildJobSummary } from './solve.ts'

// MARK: - Job summary (run observability, including the silent 0-change case)

const report = {
  url: 'https://deluisa.bio',
  overall: 85,
  grade: 'good',
  primary: {
    checks: [
      {
        id: 'trust.hsts',
        status: 'warn',
        title: 'Strict-Transport-Security header is present',
        detail: 'No Strict-Transport-Security header.',
      },
      {
        id: 'llms-txt.present',
        status: 'info',
        title: 'llms.txt presence (informational)',
        detail: 'llms.txt present — consumed by some dev tools.',
      },
      { id: 'trust.https', status: 'pass', title: 'HTTPS is enforced', detail: 'ok' },
    ],
  },
}

describe('buildJobSummary', () => {
  test('on 0 changes, reports the score and explains via the non-pass checks', () => {
    const md = buildJobSummary({ report, changedFiles: [], summary: '' })

    expect(md).toContain('deluisa.bio')
    expect(md).toContain('85')
    expect(md).toContain('good')
    expect(md.toLowerCase()).toContain('already ai-ready')
    expect(md).toContain('Strict-Transport-Security header is present')
    expect(md).toContain('No Strict-Transport-Security header.')
    expect(md).toContain('llms.txt presence (informational)')
    expect(md).not.toContain('HTTPS is enforced')
  })

  test('on N changes, reports the count, the model summary and the changed files', () => {
    const md = buildJobSummary({
      report,
      changedFiles: ['public/llms.txt', 'public/robots.txt'],
      summary: 'Added an llms.txt scaffold and AI allow-groups to robots.txt.',
    })

    expect(md).toContain('**2**')
    expect(md).toContain('Added an llms.txt scaffold and AI allow-groups to robots.txt.')
    expect(md).toContain('public/llms.txt')
    expect(md).toContain('public/robots.txt')
    expect(md.toLowerCase()).not.toContain('already ai-ready')
  })

  test('never throws on a minimal/unknown report shape', () => {
    expect(typeof buildJobSummary({ report: {}, changedFiles: [], summary: 'x' })).toBe('string')
    expect(typeof buildJobSummary({ report: null, changedFiles: [], summary: '' })).toBe('string')
  })
})
