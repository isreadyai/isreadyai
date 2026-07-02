import { NextResponse } from 'next/server'
import { recordUsage } from '@/lib/ai-usage'
import { verifyApiKey } from '@/lib/api-keys'
import type { IApiKey } from '@/lib/api-key-types'
import { findTool, toolDescriptors } from '@/lib/mcp/tools'
import { isPaidPlan } from '@/lib/plans'
import { consumeRateLimit } from '@/lib/rate-limit'

// MARK: - POST /api/mcp — Streamable-HTTP MCP server
//
// A minimal, hand-rolled Model Context Protocol endpoint (JSON-RPC 2.0 over a
// single POST). No SDK is pulled in: the surface is just initialize, ping,
// tools/list and tools/call, which is enough for Cursor / Claude Desktop / Code
// to discover and call the tools. Every request must carry a Bearer isready.ai
// API key for a paid plan — there is no anonymous access. Each executed tool
// call is metered into the ai_usage ledger under the 'mcp' surface.

export const maxDuration = 300

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'isready.ai', version: '1.0.0' } as const
// Bound infrastructure load: MCP usage is metered but not entitlement-capped.
const MAX_BATCH = 50
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 120

// MARK: - JSON-RPC plumbing

const JSON_RPC = '2.0'

type TId = string | number | null

const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const

interface IRpcRequest {
  jsonrpc: string
  id?: TId
  method: string
  params?: unknown
}

function ok(id: TId, result: unknown): Record<string, unknown> {
  return { jsonrpc: JSON_RPC, id, result }
}

function fail(id: TId, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: JSON_RPC, id, error: { code, message } }
}

/** True when a JSON-RPC batch exceeds the per-request tool-call cap. */
export function batchTooLarge(body: unknown): boolean {
  return Array.isArray(body) && body.length > MAX_BATCH
}

/** Rate-limit units a request bills: one per batch item, one for a single call. */
export function rateLimitUnits(body: unknown): number {
  return Array.isArray(body) ? body.length : 1
}

function isRpcRequest(value: unknown): value is IRpcRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { method?: unknown }).method === 'string'
  )
}

/** A notification has no id; per JSON-RPC it gets no response object. */
function isNotification(req: IRpcRequest): boolean {
  return req.id === undefined
}

// MARK: - Auth

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (header === null) {
    return null
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim()
  return token !== undefined && token.length > 0 ? token : null
}

function unauthorized(message: string): NextResponse {
  return NextResponse.json(
    { jsonrpc: JSON_RPC, id: null, error: { code: ERR.INVALID_REQUEST, message } },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="isready.ai MCP"' } },
  )
}

// MARK: - Metering

/**
 * Record one metered MCP tool call. Auth fails closed (handled before we get
 * here); metering fails open — a ledger hiccup must not deny a call the caller
 * authenticated for. The ledger counter is the deliverable, not a gate.
 */
async function meter(key: IApiKey): Promise<void> {
  try {
    await recordUsage({ surface: 'mcp', apiKeyId: key.id, messages: 1, tokens: 0 })
  } catch {
    // Intentionally swallowed: see above.
  }
}

// MARK: - Rate limiting

/**
 * Charges `units` against the per-key window, one unit per JSON-RPC item, and
 * short-circuits on the first rejection so a batch can't slip through on a
 * single-unit charge. `units` is bounded by MAX_BATCH (see `batchTooLarge`).
 */
async function chargeRateLimit(keyId: string, units: number): Promise<boolean> {
  for (let i = 0; i < units; i++) {
    if (!(await consumeRateLimit(`mcp:${keyId}`, RATE_WINDOW_MS, RATE_LIMIT))) {
      return false
    }
  }
  return true
}

// MARK: - Method dispatch

async function dispatch(req: IRpcRequest, key: IApiKey): Promise<Record<string, unknown> | null> {
  const id = req.id ?? null

  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      })

    case 'ping':
      return ok(id, {})

    case 'notifications/initialized':
    case 'notifications/cancelled':
      // Client→server notifications: acknowledged by the empty 202, no result.
      return null

    case 'tools/list':
      return ok(id, { tools: toolDescriptors() })

    case 'tools/call':
      return callTool(req, key)

    default:
      return isNotification(req)
        ? null
        : fail(id, ERR.METHOD_NOT_FOUND, `unknown method: ${req.method}`)
  }
}

async function callTool(req: IRpcRequest, key: IApiKey): Promise<Record<string, unknown>> {
  const id = req.id ?? null
  const params = req.params
  if (typeof params !== 'object' || params === null) {
    return fail(id, ERR.INVALID_PARAMS, 'params must be an object')
  }
  const name = (params as { name?: unknown }).name
  if (typeof name !== 'string') {
    return fail(id, ERR.INVALID_PARAMS, 'params.name is required')
  }
  const tool = findTool(name)
  if (tool === undefined) {
    return fail(id, ERR.INVALID_PARAMS, `unknown tool: ${name}`)
  }
  const parsed = tool.parse((params as { arguments?: unknown }).arguments ?? {})
  if (!parsed.ok) {
    return fail(id, ERR.INVALID_PARAMS, parsed.message)
  }

  let result: { data: unknown; isError?: boolean }
  try {
    result = await tool.run(parsed.value, { key })
  } catch (err) {
    // A crash inside a tool is reported to the model as a tool error (MCP keeps
    // those in the result, not as a protocol error), and is still metered below.
    result = { isError: true, data: { error: err instanceof Error ? err.message : String(err) } }
  }

  // The call was authenticated and executed — count it regardless of outcome.
  await meter(key)

  return ok(id, {
    content: [{ type: 'text', text: JSON.stringify(result.data) }],
    structuredContent: result.data,
    isError: result.isError ?? false,
  })
}

// MARK: - Handler

export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request)
  if (token === null) {
    return unauthorized('missing Bearer API key')
  }
  const key = await verifyApiKey(token)
  if (key === null) {
    return unauthorized('invalid API key')
  }
  if (!isPaidPlan(key.plan)) {
    return NextResponse.json(
      {
        jsonrpc: JSON_RPC,
        id: null,
        error: { code: ERR.INVALID_REQUEST, message: 'MCP requires a paid plan' },
      },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(fail(null, ERR.PARSE, 'invalid JSON'), { status: 400 })
  }

  if (batchTooLarge(body)) {
    return NextResponse.json(fail(null, ERR.INVALID_REQUEST, 'batch too large'), { status: 400 })
  }

  // Charge per batch item (cap-bounded above) so a batch costs as much budget as
  // the calls it carries — not one flat unit per request.
  if (!(await chargeRateLimit(key.id, rateLimitUnits(body)))) {
    return NextResponse.json(fail(null, ERR.INVALID_REQUEST, 'rate limited'), { status: 429 })
  }

  // JSON-RPC allows a batch (array) or a single request object.
  if (Array.isArray(body)) {
    const responses: Array<Record<string, unknown>> = []
    for (const entry of body) {
      if (!isRpcRequest(entry)) {
        responses.push(fail(null, ERR.INVALID_REQUEST, 'invalid request'))
        continue
      }
      const response = await dispatch(entry, key)
      if (response !== null) {
        responses.push(response)
      }
    }
    return responses.length === 0
      ? new NextResponse(null, { status: 202 })
      : NextResponse.json(responses)
  }

  if (!isRpcRequest(body)) {
    return NextResponse.json(fail(null, ERR.INVALID_REQUEST, 'invalid request'), { status: 400 })
  }
  const response = await dispatch(body, key)
  return response === null ? new NextResponse(null, { status: 202 }) : NextResponse.json(response)
}

// MARK: - GET — discovery probe

/**
 * Some clients probe with GET before POSTing. We do not implement an SSE stream
 * (single-shot JSON responses only), so advertise that plainly.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { error: 'method_not_allowed', detail: 'MCP endpoint: POST JSON-RPC 2.0 here.' },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
