import { describe, expect, test } from 'bun:test'
import type { ICrawlerAccessRow } from '@isreadyai/scanner'
import { crawlerRowView, purposeLabelKey } from './crawler-access-view'
import { GRADE_TEXT } from './grade'

const BASE: ICrawlerAccessRow = {
  token: 'ClaudeBot',
  operator: 'Anthropic',
  purpose: 'training',
  surface: 'Claude model training',
  robots: 'allowed',
  probe: null,
  silentBlock: false,
}

describe('crawlerRowView', () => {
  test('served crawler allowed by robots.txt is green with its status', () => {
    const view = crawlerRowView({
      ...BASE,
      probe: { token: 'ClaudeBot', status: 200, outcome: 'served' },
    })
    expect(view.robots).toEqual({
      glyph: '✓',
      tone: GRADE_TEXT.excellent,
      labelKey: 'crawlers.robotsAllowed',
    })
    expect(view.server).toEqual({
      glyph: '✓',
      tone: GRADE_TEXT.excellent,
      labelKey: 'crawlers.serverServed',
      status: 200,
    })
  })

  test('refused crawler is red and keeps the status', () => {
    const view = crawlerRowView({
      ...BASE,
      probe: { token: 'ClaudeBot', status: 403, outcome: 'refused' },
    })
    expect(view.server).toEqual({
      glyph: '✗',
      tone: GRADE_TEXT.poor,
      labelKey: 'crawlers.serverRefused',
      status: 403,
    })
  })

  test('challenge page and no response are red without a status', () => {
    const challenged = crawlerRowView({
      ...BASE,
      probe: { token: 'ClaudeBot', status: 200, outcome: 'challenged' },
    })
    const silent = crawlerRowView({
      ...BASE,
      probe: { token: 'ClaudeBot', status: 0, outcome: 'no-response' },
    })
    expect(challenged.server).toEqual({
      glyph: '✗',
      tone: GRADE_TEXT.poor,
      labelKey: 'crawlers.serverChallenged',
    })
    expect(silent.server.labelKey).toBe('crawlers.serverNoResponse')
    expect(silent.server.status).toBeUndefined()
  })

  test('blocked and missing robots.txt, untested probe', () => {
    expect(crawlerRowView({ ...BASE, robots: 'blocked' }).robots).toEqual({
      glyph: '✗',
      tone: GRADE_TEXT.poor,
      labelKey: 'crawlers.robotsBlocked',
    })
    expect(crawlerRowView({ ...BASE, robots: 'no-robots' }).robots.labelKey).toBe(
      'crawlers.robotsNone',
    )
    expect(crawlerRowView(BASE).server).toEqual({
      glyph: '—',
      tone: 'text-site-faint',
      labelKey: 'crawlers.serverUntested',
    })
  })
})

describe('purposeLabelKey', () => {
  test('maps every purpose to its translation key', () => {
    expect(purposeLabelKey('training')).toBe('crawlers.purposeTraining')
    expect(purposeLabelKey('search')).toBe('crawlers.purposeSearch')
    expect(purposeLabelKey('user')).toBe('crawlers.purposeUser')
  })
})
