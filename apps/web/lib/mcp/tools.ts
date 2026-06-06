import type { ICheckResult, IScanReport } from '@isreadyai/scanner'
import type { IApiKey } from '@/lib/api-key-types'
import { allChecks, buildFixPlan, EStatus, scan, validateScanInput } from '@isreadyai/scanner'
import { z } from 'zod'
import { apiKeyOwnerId } from '@/lib/api-keys'
import { EScanStatus } from '@/lib/scan-record'
import { getScanStore } from '@/lib/scan-store'

// MARK: - MCP tools
//
// Thin adapters over the existing scanner engine and scan store. They never
// reimplement scanning, scoring or fix-planning — they reshape the same results
// the web app already returns into the compact JSON an agent wants. Every fetch
// of a user-supplied URL goes through validateScanInput (public-host string
// gate) plus the NativeProvider's built-in DNS / private-IP guard, so the SSRF
// posture matches the rest of the app.

/** A handler runs after auth; the key lets it scope owned scans to the caller. */
export interface IToolContext {
  key: IApiKey
}

export interface IToolResult {
  /** Structured payload returned to the client (also JSON-encoded into text). */
  data: unknown
  /** True when the tool ran but the outcome is an error the model should see. */
  isError?: boolean
}

export interface IMcpTool {
  name: string
  description: string
  /** JSON Schema advertised in tools/list. */
  inputSchema: Record<string, unknown>
  /** Validates raw arguments; the parsed value is passed to run. */
  parse(args: unknown): { ok: true; value: unknown } | { ok: false; message: string }
  run(value: unknown, ctx: IToolContext): Promise<IToolResult>
}

// MARK: - Shared shapes

const UrlSchema = z.object({ url: z.string().min(3).max(2048) })
const ScanIdSchema = z.object({
  scanId: z.string().regex(/^[0-9a-f-]{36}$/i, 'expected a scan UUID'),
})

const ID_DOC = 'The scan id returned by scan_url (a UUID).'

function toFinding(check: ICheckResult): Record<string, unknown> {
  const finding: Record<string, unknown> = {
    id: check.id,
    category: check.category,
    status: check.status,
    title: check.title,
    detail: check.detail,
  }
  if (check.fix !== undefined) {
    finding.fix = check.fix
  }
  if (check.impact !== undefined) {
    finding.impact = check.impact
  }
  if (check.effort !== undefined) {
    finding.effort = check.effort
  }
  if (check.docsUrl !== undefined) {
    finding.docsUrl = check.docsUrl
  }
  return finding
}

function summarizeFindings(report: IScanReport): Array<Record<string, unknown>> {
  // Only non-PASS checks are findings worth acting on; PASS rows are noise here.
  return report.checks.filter((check) => check.status !== EStatus.PASS).map(toFinding)
}

function categorySummary(report: IScanReport): Array<Record<string, unknown>> {
  return report.categories.map((cat) => ({
    category: cat.category,
    label: cat.label,
    score: cat.score,
    weight: cat.weight,
  }))
}

/**
 * Resolves an owned scan for the calling key. Anonymous (public-by-id) scans
 * are readable by anyone, mirroring GET /api/scan/[id]; an owned scan is only
 * readable by the key whose account owns it. Workspace-only scans are not yet
 * exposed over MCP and read as not-found (fail closed). Returns null when the
 * caller may not see the scan or it does not exist.
 */
async function loadOwnedScan(scanId: string, key: IApiKey) {
  const store = await getScanStore()
  const owner = await store.getOwner(scanId)
  if (owner === null) {
    return null
  }
  const isAnonymous = owner.userId === null && owner.workspaceId === null
  if (!isAnonymous) {
    const callerId = await apiKeyOwnerId(key)
    if (callerId === null || owner.userId !== callerId) {
      return null
    }
  }
  return store.get(scanId)
}

// MARK: - scan_url

const scanUrl: IMcpTool = {
  name: 'scan_url',
  description:
    'Run an isready.ai AI-readiness audit on a public URL and return the overall ' +
    'score, grade, per-category scores and the actionable findings. Also returns a ' +
    'scanId you can pass to get_findings or resolution_plan.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The public http(s) URL to audit, e.g. https://example.com',
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
  parse(args) {
    const parsed = UrlSchema.safeParse(args)
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: parsed.error.issues[0]?.message ?? 'invalid arguments' }
  },
  async run(value) {
    const { url } = value as z.infer<typeof UrlSchema>
    // Public-host string gate; the NativeProvider then enforces the DNS / private-IP
    // SSRF guard during the actual fetch and on every redirect hop.
    const validated = validateScanInput(url)
    if (!validated.ok) {
      return { isError: true, data: { error: `invalid_url:${validated.problem}` } }
    }

    const report = await scan(validated.url, { checks: allChecks })
    if (!report.meta.fetchOk) {
      return {
        isError: true,
        data: {
          url: validated.url,
          finalUrl: report.finalUrl,
          fetchOk: false,
          error: report.meta.error ?? 'fetch_failed',
        },
      }
    }

    // Persist anonymously so the scanId resolves later via get_findings /
    // resolution_plan, matching the public-by-id contract of GET /api/scan/[id].
    let scanId: string | null = null
    try {
      const store = await getScanStore()
      const record = await store.create(validated.url, null, null, 'mcp')
      await store.update(record.id, { status: EScanStatus.DONE, report })
      scanId = record.id
    } catch {
      // A persistence failure must not lose the result the caller already paid for.
      scanId = null
    }

    return {
      data: {
        ...(scanId !== null ? { scanId } : {}),
        url: validated.url,
        finalUrl: report.finalUrl,
        overall: report.overall,
        grade: report.grade,
        categories: categorySummary(report),
        findings: summarizeFindings(report),
      },
    }
  },
}

// MARK: - get_findings

const getFindings: IMcpTool = {
  name: 'get_findings',
  description:
    'Return the actionable findings, overall score and grade for an existing scan ' +
    'by its scanId. Use after scan_url.',
  inputSchema: {
    type: 'object',
    properties: { scanId: { type: 'string', description: ID_DOC } },
    required: ['scanId'],
    additionalProperties: false,
  },
  parse(args) {
    const parsed = ScanIdSchema.safeParse(args)
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: parsed.error.issues[0]?.message ?? 'invalid arguments' }
  },
  async run(value, { key }) {
    const { scanId } = value as z.infer<typeof ScanIdSchema>
    const record = await loadOwnedScan(scanId, key)
    if (record === null) {
      return { isError: true, data: { error: 'not_found' } }
    }
    if (record.report === null) {
      return { isError: true, data: { scanId, status: record.status, error: 'no_report' } }
    }
    return {
      data: {
        scanId,
        url: record.url,
        status: record.status,
        overall: record.report.overall,
        grade: record.report.grade,
        categories: categorySummary(record.report),
        findings: summarizeFindings(record.report),
      },
    }
  },
}

// MARK: - resolution_plan

const resolutionPlan: IMcpTool = {
  name: 'resolution_plan',
  description:
    'Return the deterministic remediation plan for an existing scan: concrete file ' +
    'patches (e.g. robots.txt, llms.txt) plus a Markdown action plan. Use after scan_url.',
  inputSchema: {
    type: 'object',
    properties: { scanId: { type: 'string', description: ID_DOC } },
    required: ['scanId'],
    additionalProperties: false,
  },
  parse(args) {
    const parsed = ScanIdSchema.safeParse(args)
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: parsed.error.issues[0]?.message ?? 'invalid arguments' }
  },
  async run(value, { key }) {
    const { scanId } = value as z.infer<typeof ScanIdSchema>
    const record = await loadOwnedScan(scanId, key)
    if (record === null) {
      return { isError: true, data: { error: 'not_found' } }
    }
    if (record.report === null) {
      return { isError: true, data: { scanId, status: record.status, error: 'no_report' } }
    }
    // Deterministic, no LLM: the same fix plan the CLI / fix-PR path uses.
    const plan = buildFixPlan(record.report, {})
    return { data: { scanId, patches: plan.patches, markdown: plan.markdown } }
  },
}

// MARK: - Registry

export const MCP_TOOLS: readonly IMcpTool[] = [scanUrl, getFindings, resolutionPlan]

export function findTool(name: string): IMcpTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name)
}

/** The tool descriptors advertised by tools/list. */
export function toolDescriptors(): Array<Record<string, unknown>> {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }))
}
