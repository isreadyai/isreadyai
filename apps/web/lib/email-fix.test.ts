import { describe, expect, test } from 'bun:test'
import { fixPrEmailHtml, fixPrEmailSubject } from '@/lib/email-fix'

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

  // MARK: - HTML injection hardening

  test('escapes HTML markup injected via repo', () => {
    const html = fixPrEmailHtml({
      ...data,
      repo: '<img src=x onerror=alert(1)>evil/repo',
    })

    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;evil/repo')
  })

  test('escapes quotes/markup injected via prUrl before it lands in the href attribute', () => {
    const html = fixPrEmailHtml({
      ...data,
      prUrl: 'https://github.com/owner/repo/pull/1"><script>alert(1)</script>',
    })

    expect(html).not.toContain('"><script>alert(1)</script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

describe('fixPrEmailSubject', () => {
  test('includes the plain repo name', () => {
    expect(fixPrEmailSubject({ repo: 'owner/repo' })).toBe(
      'AI-readiness fixes ready to review — owner/repo',
    )
  })

  test('escapes HTML markup injected via repo (defense in depth for the subject line)', () => {
    const subject = fixPrEmailSubject({ repo: '<b>owner</b>/repo' })

    expect(subject).not.toContain('<b>owner</b>')
    expect(subject).toContain('&lt;b&gt;owner&lt;/b&gt;/repo')
  })
})
