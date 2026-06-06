import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { consumeRateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'

// MARK: - POST /api/telemetry

/**
 * Anonymous, keyless usage ping from the CLI when no API key is configured and
 * TELEMETRY is not disabled. Deliberately minimal and PII-free: the bare host,
 * the score and which passes ran. No URL/path/query, no IP stored, no account.
 * Authenticated CI uploads use /api/ci-report instead — never this endpoint.
 */

export const maxDuration = 10

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

const BodySchema = z.object({
  source: z.enum(['cli', 'action', 'web', 'cron']),
  // Bare host only — reject anything with a scheme, path or whitespace.
  host: z
    .string()
    .max(253)
    .regex(/^[a-z0-9.-]+$/i)
    .optional(),
  score: z.number().int().min(0).max(100).optional(),
  deep: z.boolean().optional(),
  smart: z.boolean().optional(),
})

export async function POST(request: Request): Promise<NextResponse> {
  const ipHash = await hashValue(clientIp(request))
  if (!(await consumeRateLimit(ipHash, RATE_WINDOW_MS, RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // No persistence backend (local dev) — accept and drop.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  const client = await createServiceClient()
  await client.from('telemetry_events').insert({
    source: parsed.data.source,
    host: parsed.data.host ?? null,
    score: parsed.data.score ?? null,
    deep: parsed.data.deep ?? false,
    smart: parsed.data.smart ?? false,
  })

  return NextResponse.json({ ok: true })
}

// MARK: - internal

async function hashValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
