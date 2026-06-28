import { describe, expect, test } from 'bun:test'
import { fixPrEmailHtml } from '@/lib/email-fix'

describe('fixPrEmailHtml', () => {
  const data = {
    repo: 'massimodeluisa/de-luisa-bio',
    prUrl: 'https://github.com/massimodeluisa/de-luisa-bio/pull/7',
    patches: 3,
  }

  test('renders the heading, repo and patch count', () => {
    const html = fixPrEmailHtml(data)

    expect(html).toContain('AI-readiness fixes ready to review')
    expect(html).toContain('massimodeluisa/de-luisa-bio')
    expect(html).toContain('3')
  })

  test('points the CTA at the pull-request url', () => {
    const html = fixPrEmailHtml(data)

    expect(html).toContain('href="https://github.com/massimodeluisa/de-luisa-bio/pull/7"')
  })

  test('wraps the content in the shared email shell', () => {
    const html = fixPrEmailHtml(data)

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('isready.ai')
  })
})
