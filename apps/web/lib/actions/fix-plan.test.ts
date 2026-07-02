import { afterAll, describe, expect, mock, test } from 'bun:test'
import type { IScanReport } from '@isreadyai/scanner'

// MARK: - generateReportFixPlan ownership + gating tests
//
// The workspace context, service client and AI gateway are mocked at the factory
// boundary so the plan- and ownership-gating branches run without a live DB or
// funded inference. The host-ownership match is the security-relevant branch: a
// by-value report for a host the workspace never scanned must be rejected.

let ctx: { ownerPlan: string; memberIds: string[] } | null = null
let scanRows: Array<{ report: unknown }> = []
let configured = true
let generated: string | null = 'PLAN'

function fakeService() {
  const builder: Record<string, unknown> = {}
  const chain = (): Record<string, unknown> => builder
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[m] = chain
  }
  // The query builder is itself awaitable; resolve to the configured scan rows.
  // oxlint-disable-next-line unicorn/no-thenable
  builder.then = (resolve: (v: { data: unknown; error: null }) => unknown): unknown =>
    resolve({ data: scanRows, error: null })
  return { from: (): Record<string, unknown> => builder }
}

// mock.module is process-global; capture the real namespaces first and reinstall
// them in afterAll so these mocks never leak into other test files.
const realWorkspaceCtx = await import('@/lib/workspace-context')
const realSupabase = await import('@isreadyai/supabase')
const realFixPlanAi = await import('@/lib/fix-plan-ai')

mock.module('@/lib/workspace-context', () => ({
  ...realWorkspaceCtx,
  resolveWorkspaceContext: () => Promise.resolve(ctx),
}))
mock.module('@isreadyai/supabase', () => ({
  ...realSupabase,
  createServiceClient: () => Promise.resolve(fakeService()),
}))
mock.module('@/lib/fix-plan-ai', () => ({
  ...realFixPlanAi,
  fixPlanConfigured: () => configured,
  generateAiFixPlan: () => Promise.resolve(generated),
}))

const { generateReportFixPlan } = await import('./fix-plan')

afterAll(() => {
  mock.module('@/lib/workspace-context', () => realWorkspaceCtx)
  mock.module('@isreadyai/supabase', () => realSupabase)
  mock.module('@/lib/fix-plan-ai', () => realFixPlanAi)
})

/** Minimal report that passes isScanReport, targeting `url`. */
function reportFor(url: string): IScanReport {
  return {
    url,
    finalUrl: url,
    scoreVersion: '1',
    overall: 80,
    grade: 'good',
    categories: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    checks: [],
    meta: { durationMs: 100, fetchOk: true },
  } as unknown as IScanReport
}

describe('generateReportFixPlan', () => {
  test('rejects a non-report payload', async () => {
    ctx = { ownerPlan: 'pro', memberIds: ['u1'] }
    expect(await generateReportFixPlan({ not: 'a report' })).toEqual({ ok: false, error: 'failed' })
  })

  test('rejects a caller without a paid workspace', async () => {
    ctx = null
    expect(await generateReportFixPlan(reportFor('https://example.com/'))).toEqual({
      ok: false,
      error: 'premium_required',
    })
    ctx = { ownerPlan: 'free', memberIds: ['u1'] }
    expect(await generateReportFixPlan(reportFor('https://example.com/'))).toEqual({
      ok: false,
      error: 'premium_required',
    })
  })

  test('rejects a report for a host the workspace never scanned', async () => {
    // Security boundary: a by-value report is authorized only when the caller's
    // workspace actually scanned the host.
    ctx = { ownerPlan: 'pro', memberIds: ['u1'] }
    scanRows = [{ report: reportFor('https://other.com/') }]
    expect(await generateReportFixPlan(reportFor('https://victim.com/'))).toEqual({
      ok: false,
      error: 'not_owned',
    })
  })

  test('fails closed when the workspace has no members', async () => {
    ctx = { ownerPlan: 'pro', memberIds: [] }
    scanRows = [{ report: reportFor('https://example.com/') }]
    expect(await generateReportFixPlan(reportFor('https://example.com/'))).toEqual({
      ok: false,
      error: 'not_owned',
    })
  })

  test('matches ownership by normalized host (ignoring www), then gates on config', async () => {
    ctx = { ownerPlan: 'pro', memberIds: ['u1'] }
    scanRows = [{ report: reportFor('https://www.example.com/page') }]
    configured = false // stop before inference to isolate the ownership pass
    expect(await generateReportFixPlan(reportFor('https://example.com/'))).toEqual({
      ok: false,
      error: 'unconfigured',
    })
  })

  test('generates the plan when owned, paid and configured', async () => {
    ctx = { ownerPlan: 'pro', memberIds: ['u1'] }
    scanRows = [{ report: reportFor('https://example.com/') }]
    configured = true
    generated = 'PLAN BODY'
    expect(await generateReportFixPlan(reportFor('https://example.com/'))).toEqual({
      ok: true,
      plan: 'PLAN BODY',
    })
  })
})
