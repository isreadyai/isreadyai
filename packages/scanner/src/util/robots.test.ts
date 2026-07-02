import { describe, expect, it } from 'bun:test'
import { groupFor, hasExplicitGroup, isAllowed, isFullyBlocked, parseRobots } from './robots.ts'

describe('parseRobots', () => {
  it('groups consecutive user-agents with their shared rules', () => {
    const r = parseRobots('User-agent: a\nUser-agent: b\nDisallow: /x\n')
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0].agents).toEqual(['a', 'b'])
    expect(r.groups[0].rules).toEqual([{ type: 'disallow', path: '/x' }])
  })

  it('collects sitemaps and warns on a rule before any user-agent', () => {
    const r = parseRobots('Disallow: /early\nSitemap: https://e.com/s.xml\n')
    expect(r.sitemaps).toEqual(['https://e.com/s.xml'])
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})

describe('groupFor', () => {
  it('prefers the longest matching agent token, falling back to *', () => {
    const r = parseRobots('User-agent: *\nDisallow: /\nUser-agent: googlebot\nDisallow:\n')
    expect(groupFor(r, 'Googlebot/2.1')?.agents).toEqual(['googlebot'])
    expect(groupFor(r, 'randombot')?.agents).toEqual(['*'])
  })
})

describe('isAllowed path matching', () => {
  it('treats a rule as a prefix by default', () => {
    const r = parseRobots('User-agent: *\nDisallow: /admin\n')
    expect(isAllowed(r, 'bot', '/admin/users')).toBe(false)
    expect(isAllowed(r, 'bot', '/public')).toBe(true)
  })

  it('expands * to any run of characters', () => {
    const r = parseRobots('User-agent: *\nDisallow: /*.pdf\n')
    expect(isAllowed(r, 'bot', '/files/report.pdf')).toBe(false)
    expect(isAllowed(r, 'bot', '/files/report.txt')).toBe(true)
  })

  it('honors the trailing $ end-anchor', () => {
    const r = parseRobots('User-agent: *\nDisallow: /*.php$\n')
    expect(isAllowed(r, 'bot', '/index.php')).toBe(false)
    expect(isAllowed(r, 'bot', '/index.php?id=1')).toBe(true)
  })

  it('lets a more specific Allow override a Disallow', () => {
    const r = parseRobots('User-agent: *\nDisallow: /app/\nAllow: /app/public/\n')
    expect(isAllowed(r, 'bot', '/app/private')).toBe(false)
    expect(isAllowed(r, 'bot', '/app/public/x')).toBe(true)
  })

  it('matches a pattern with multiple wildcards in order', () => {
    const r = parseRobots('User-agent: *\nDisallow: /a/*/b/*/c\n')
    expect(isAllowed(r, 'bot', '/a/1/b/2/c/d')).toBe(false)
    expect(isAllowed(r, 'bot', '/a/1/x/2/c')).toBe(true)
  })
})

describe('isFullyBlocked / hasExplicitGroup', () => {
  it('detects a site-wide block only for the governed agent', () => {
    const r = parseRobots('User-agent: gptbot\nDisallow: /\n')
    expect(isFullyBlocked(r, 'gptbot')).toBe(true)
    expect(isFullyBlocked(r, 'otherbot')).toBe(false)
  })

  it('reports explicitly named agents (case-insensitive)', () => {
    const r = parseRobots('User-agent: GPTBot\nDisallow: /\n')
    expect(hasExplicitGroup(r, 'gptbot')).toBe(true)
    expect(hasExplicitGroup(r, 'bingbot')).toBe(false)
  })
})

describe('pathMatches ReDoS resistance', () => {
  it('returns quickly for many wildcards against a long path', () => {
    // `needle` never appears in the path, so the old regex (^/.*.*…needle) would
    // backtrack catastrophically; the linear matcher rejects it immediately.
    const r = parseRobots(`User-agent: *\nDisallow: /${'*'.repeat(60)}needle\n`)
    const path = `/${'a'.repeat(50000)}`
    const start = performance.now()
    const allowed = isAllowed(r, 'bot', path)
    const elapsed = performance.now() - start
    expect(allowed).toBe(true) // rule can't match → path stays allowed
    expect(elapsed).toBeLessThan(1000)
  })
})
