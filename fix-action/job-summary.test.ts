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
        // The scanner's static title asserts the PASSING condition; the detail is
        // the real (failing) outcome — juxtaposing them used to read as a
        // self-contradiction ("…is present — No …header.").
        title: 'Strict-Transport-Security header is present',
        detail: 'No Strict-Transport-Security header.',
        fix: 'Add a Strict-Transport-Security header (e.g. max-age=31536000; includeSubDomains).',
        impact: 'low',
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
  test('on 0 changes with findings, lists reconciled bullets (detail + fix), never the contradictory title', () => {
    const md = buildJobSummary({ report, changedFiles: [], summary: '' })

    expect(md).toContain('deluisa.bio')
    expect(md).toContain('85')
    expect(md).toContain('good')

    // Honest framing: findings remain, so we do NOT claim the site is already ready.
    expect(md.toLowerCase()).not.toContain('already ai-ready')
    expect(md).toContain('### Remaining findings (not auto-fixed)')

    // Leads with the real outcome (detail) and the scanner's own fix hint …
    expect(md).toContain('No Strict-Transport-Security header.')
    expect(md).toContain('_Suggested fix:_')
    expect(md).toContain(
      'Add a Strict-Transport-Security header (e.g. max-age=31536000; includeSubDomains).',
    )
    // … and never juxtaposes the contradictory "is present" title.
    expect(md).not.toContain('Strict-Transport-Security header is present')

    // Info finding: outcome detail is shown; its (consistent) title is not needed.
    expect(md).toContain('llms.txt present — consumed by some dev tools.')
    expect(md).not.toContain('llms.txt presence (informational)')

    // Pass checks are never listed.
    expect(md).not.toContain('HTTPS is enforced')
  })

  test('on 0 changes with no non-pass checks, reports the site as already AI-ready', () => {
    const clean = {
      url: 'https://deluisa.bio',
      overall: 100,
      grade: 'excellent',
      primary: { checks: [{ id: 'trust.https', status: 'pass', title: 'HTTPS', detail: 'ok' }] },
    }
    const md = buildJobSummary({ report: clean, changedFiles: [], summary: '' })

    expect(md.toLowerCase()).toContain('already ai-ready')
    expect(md).not.toContain('### Remaining findings')
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
