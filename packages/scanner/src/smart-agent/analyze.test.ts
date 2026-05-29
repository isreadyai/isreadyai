import { describe, expect, test } from 'bun:test'
import {
  aggregateSmartReports,
  analyzeSmartAgentObservation,
  ESmartAgentCategory,
} from './index.ts'
import type { ISmartAgentObservation } from './index.ts'

function observation(overrides: Partial<ISmartAgentObservation> = {}): ISmartAgentObservation {
  const content = Array.from(
    { length: 24 },
    (_, index) => `- paragraph "Useful explanation ${index} with enough concrete detail"`,
  ).join('\n')
  return {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example product documentation',
    snapshot: [
      '- banner',
      '  - navigation "Primary"',
      '  - link "Home"',
      '- main',
      '  - heading "Example product" [level=1]',
      '  - heading "How it works" [level=2]',
      content,
      '- contentinfo',
    ].join('\n'),
    interactiveSnapshot: '- link "Home" [ref=e1]\n- button "Start free" [ref=e2]',
    refs: {
      e1: { role: 'link', name: 'Home' },
      e2: { role: 'button', name: 'Start free' },
    },
    ...overrides,
  }
}

describe('analyzeSmartAgentObservation', () => {
  test('produces a separate weighted Smart Agent score', () => {
    const report = analyzeSmartAgentObservation(observation(), 'test')
    expect(report.overall).toBeGreaterThanOrEqual(75)
    expect(report.categories).toHaveLength(6)
    expect(report.categories.reduce((sum, category) => sum + category.weight, 0)).toBe(100)
    expect(report.agentView.interactiveElements).toHaveLength(2)
  })

  test('fails visible content and barriers for an empty challenge page', () => {
    const report = analyzeSmartAgentObservation(
      observation({
        title: 'Just a moment',
        snapshot: '- main\n  - paragraph "Checking your browser security challenge"',
        refs: {},
      }),
      'test',
    )
    expect(report.overall).toBeLessThan(50)
    expect(
      report.categories.find(
        (category) => category.category === ESmartAgentCategory.VISIBLE_CONTENT,
      )?.score,
    ).toBeLessThan(50)
    expect(report.signals.find((signal) => signal.id === 'smart-barriers')?.status).toBe('fail')
  })

  test('flags images that lack a text alternative', () => {
    const report = analyzeSmartAgentObservation(
      observation({
        refs: {
          e1: { role: 'image', name: 'Product dashboard screenshot' },
          e2: { role: 'image', name: '' },
          e3: { role: 'image', name: '' },
        },
      }),
      'test',
    )
    const images = report.signals.find((signal) => signal.id === 'smart-images')
    expect(images?.evidence).toEqual({ images: 3, namedImages: 1 })
    expect(images?.status).toBe('fail')
    expect(images?.fix).toBeDefined()
  })

  test('does not penalize a page with no images', () => {
    const report = analyzeSmartAgentObservation(observation(), 'test')
    const images = report.signals.find((signal) => signal.id === 'smart-images')
    expect(images?.evidence).toEqual({ images: 0, namedImages: 0 })
    expect(images?.status).toBe('pass')
  })

  test('aggregates per-page smart reports with the primary weighted double', () => {
    const primary = analyzeSmartAgentObservation(observation(), 'test')
    const weak = analyzeSmartAgentObservation(
      observation({ snapshot: '- main\n  - paragraph "thin"', refs: {} }),
      'test',
    )
    const site = aggregateSmartReports(primary, [weak])
    expect(site.overall).toBe(Math.round((primary.overall * 2 + weak.overall) / 3))
    expect(site.pages).toHaveLength(1)
    expect(site.primary).toBe(primary)
    expect(site.categories).toHaveLength(6)
    expect(site.categories.every((category) => category.signals.length === 0)).toBe(true)
  })

  test('excludes pages that never rendered (about:blank) from the aggregate', () => {
    const primary = analyzeSmartAgentObservation(observation(), 'test')
    const rendered = analyzeSmartAgentObservation(observation(), 'test')
    const blank = analyzeSmartAgentObservation(observation({ finalUrl: 'about:blank' }), 'test')

    const site = aggregateSmartReports(primary, [rendered, blank])
    expect(site.pages).toHaveLength(1)
    expect(site.pages[0]?.finalUrl).toBe('https://example.com/')
    expect(site.overall).toBe(Math.round((primary.overall * 2 + rendered.overall) / 3))
  })

  test('warns when interactive controls have no accessible name', () => {
    const report = analyzeSmartAgentObservation(
      observation({
        refs: {
          e1: { role: 'link', name: '' },
          e2: { role: 'button', name: 'Start free' },
        },
      }),
      'test',
    )
    expect(report.signals.find((signal) => signal.id === 'smart-controls')?.status).toBe('warn')
  })
})
