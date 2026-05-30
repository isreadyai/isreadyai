import { describe, expect, test } from 'bun:test'
import { isScanReport, isSiteReport, isSmartAgentReport, isSmartAgentSiteReport } from './guards.ts'

const auditSummary = {
  url: 'https://example.com/',
  scoreVersion: 'test',
  overall: 80,
  grade: 'good',
  categories: [],
  startedAt: '2026-06-15T10:00:00.000Z',
  finishedAt: '2026-06-15T10:00:01.000Z',
}

const scanReport = {
  ...auditSummary,
  finalUrl: auditSummary.url,
  checks: [],
  meta: {
    renderProvider: null,
    durationMs: 1000,
    fetchOk: true,
  },
}

const smartReport = {
  ...auditSummary,
  finalUrl: auditSummary.url,
  signals: [],
  agentView: {
    title: 'Example',
    snapshot: '- main',
    interactiveSnapshot: '- link "Home"',
    interactiveElements: [],
  },
  meta: {
    provider: 'test',
    durationMs: 1000,
    agentBrowserVersion: null,
  },
}

describe('report guards', () => {
  test('accepts canonical scanner reports', () => {
    expect(isScanReport(scanReport)).toBe(true)
    expect(
      isSiteReport({
        ...auditSummary,
        discovered: 1,
        primary: scanReport,
        pages: [],
      }),
    ).toBe(true)
  })

  test('accepts canonical Smart Agent reports', () => {
    expect(isSmartAgentReport(smartReport)).toBe(true)
    expect(
      isSmartAgentSiteReport({
        ...auditSummary,
        primary: smartReport,
        pages: [],
        meta: smartReport.meta,
      }),
    ).toBe(true)
  })

  test('rejects incomplete payloads', () => {
    expect(isScanReport({ ...scanReport, checks: undefined })).toBe(false)
    expect(isSiteReport({ ...auditSummary, discovered: 1, pages: [] })).toBe(false)
    expect(isSmartAgentReport({ ...smartReport, agentView: null })).toBe(false)
    expect(isSmartAgentSiteReport({ ...auditSummary, primary: smartReport })).toBe(false)
  })
})
