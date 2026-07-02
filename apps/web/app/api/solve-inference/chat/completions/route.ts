import { solveSecret, verifySolveToken } from '@/lib/solve-token'

// MARK: - POST /api/solve-inference

/**
 * OpenAI-compatible inference proxy for the premium fix action. The runner
 * authenticates with the ephemeral solve token (NOT the gateway key); this
 * endpoint validates it, pins the model, caps output, enforces a per-token call
 * budget, then forwards the request to the AI Gateway with isready.ai's real
 * key. It STORES NOTHING — repo source transits only transiently for inference.
 *
 * Privacy/security note (flagged for review): the runner's prompts pass through
 * this proxy. The real gateway key never reaches the runner. If the gateway ever
 * supports per-call ephemeral sub-keys, this proxy can be replaced by direct
 * runner→gateway calls.
 */

export const maxDuration = 300

const MAX_OUTPUT_TOKENS = 16_384
const MAX_INPUT_BYTES = 100_000
const GATEWAY_BASE_URL = process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1'

// Only these request fields are forwarded. Everything else (notably `n`, which
// multiplies billed completions) is dropped so a runner cannot amplify cost.
const ALLOWED_FIELDS = [
  'messages',
  'temperature',
  'top_p',
  'stop',
  'stream',
  'response_format',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
] as const

/** Selects only the whitelisted request fields this proxy forwards upstream. */
function pickAllowed(body: Record<string, unknown>): Record<string, unknown> {
  const forwarded: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      forwarded[field] = body[field]
    }
  }
  return forwarded
}

/**
 * Forwards only whitelisted fields, pins the model, caps output, and forces
 * `n` to 1. The runner cannot widen scope via the model, a huge completion, or
 * multiplied completions.
 */
export function sanitizeInferenceBody(
  body: Record<string, unknown>,
  model: string,
  maxOutputCap: number,
): Record<string, unknown> {
  const forwarded = pickAllowed(body)
  const requestedMax = typeof body.max_tokens === 'number' ? body.max_tokens : maxOutputCap
  forwarded.model = model
  forwarded.max_tokens = Math.min(requestedMax, maxOutputCap)
  forwarded.n = 1
  return forwarded
}

// Per-token (jti) call budget. In-memory + best-effort: a cold start resets it,
// but the 15-minute token TTL bounds total exposure regardless.
const callCounts = new Map<string, number>()

function jsonError(code: string, status: number, extra?: Record<string, unknown>): Response {
  return Response.json({ error: code, ...extra }, { status })
}

/** Byte length of the serialized forwarded input (messages + tools + other whitelisted fields). */
export function forwardedInputBytes(body: Record<string, unknown>): number {
  return JSON.stringify(pickAllowed(body)).length
}

/** True when the serialized forwarded input (messages + tools + other whitelisted fields) exceeds the cap. */
export function inputTooLarge(body: Record<string, unknown>): boolean {
  return forwardedInputBytes(body) > MAX_INPUT_BYTES
}

export async function POST(request: Request): Promise<Response> {
  const secret = solveSecret()
  const gatewayKey = process.env.AI_GATEWAY_API_KEY
  if (secret === null || gatewayKey === undefined || gatewayKey.length === 0) {
    return jsonError('not_configured', 503)
  }

  const auth = request.headers.get('authorization') ?? ''
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const claims = raw.length > 0 ? await verifySolveToken(raw, secret) : null
  if (claims === null) {
    return jsonError('invalid_token', 401)
  }

  const used = callCounts.get(claims.jti) ?? 0
  if (used >= claims.calls) {
    return jsonError('call_budget_exceeded', 429)
  }
  callCounts.set(claims.jti, used + 1)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError('invalid_body', 400)
  }
  const gotBytes = forwardedInputBytes(body)
  if (gotBytes > MAX_INPUT_BYTES) {
    return jsonError('request_too_large', 413, { max_bytes: MAX_INPUT_BYTES, got_bytes: gotBytes })
  }

  const forwarded = sanitizeInferenceBody(body, claims.model, MAX_OUTPUT_TOKENS)

  const upstream = await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${gatewayKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isready.ai',
      'x-title': 'isready.ai solve',
    },
    body: JSON.stringify(forwarded),
  }).catch(() => null)

  if (upstream === null) {
    return jsonError('gateway_unreachable', 502)
  }

  // Pass the upstream response straight through (streaming or JSON). Nothing is
  // read into storage here.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  })
}
