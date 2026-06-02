import { NextResponse } from 'next/server'
import { allChecks, scan } from '@isreadyai/scanner'
import type { IScanReport, TGrade } from '@isreadyai/scanner'
import type { IShowcase, IShowcaseResponse } from '@/lib/showcase'

// MARK: - GET /api/showcase

/**
 * Live data for the homepage terminal: real scans, not frozen numbers.
 * Server-cached 6h + CDN s-maxage to keep the homepage fast.
 */

export const maxDuration = 120

const SHOWCASE_HOSTS = [
  'vercel.com',
  'anthropic.com',
  'supabase.com',
  'stripe.com',
  'x.ai',
  'meta.com',
  'smartsquad.io',
] as const

const ROW_LABELS = ['Crawler access', 'Rendering', 'Structured data', 'Trust & security'] as const

const SHOWCASE_GRADE: Record<TGrade, IShowcase['grade']> = {
  excellent: 'EXCELLENT',
  good: 'GOOD',
  moderate: 'MODERATE',
  poor: 'POOR',
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
let cache: { entries: IShowcase[]; ts: number } | null = null
let pending: Promise<IShowcase[]> | null = null

export async function GET(): Promise<NextResponse> {
  if (cache !== null && Date.now() - cache.ts < CACHE_TTL_MS) {
    return respond(cache.entries)
  }
  pending ??= scanAll()
  const entries = await pending
  pending = null
  if (entries.length > 0) {
    cache = { entries, ts: Date.now() }
  }
  return respond(entries)
}

// MARK: - internal

async function scanAll(): Promise<IShowcase[]> {
  const results = await Promise.all(
    SHOWCASE_HOSTS.map(async (host) => {
      try {
        const report = await scan(host, { checks: allChecks })
        return report.meta.fetchOk ? toEntry(host, report) : null
      } catch {
        return null
      }
    }),
  )
  return results.filter((entry): entry is IShowcase => entry !== null)
}

function toEntry(host: string, report: IScanReport): IShowcase {
  const rows = ROW_LABELS.map((label) => {
    const category = report.categories.find((c) => c.label === label)
    return { label, score: category?.score ?? 0 }
  })

  const fail = report.checks.find((c) => c.status === 'fail')
  const warn = report.checks.find((c) => c.status === 'warn')
  const top = fail ?? warn
  const findings: IShowcase['findings'] =
    top === undefined
      ? [{ icon: '✓', text: 'everything passed — this site is ready for AI' }]
      : [
          {
            icon: top.status === 'fail' ? '✗' : '▲',
            text: `${top.id} — ${truncate(top.detail, 70)}`,
            fix: top.fix === undefined ? undefined : truncate(top.fix, 70),
          },
        ]

  return {
    host,
    score: report.overall,
    grade: SHOWCASE_GRADE[report.grade],
    rows,
    findings,
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function respond(entries: IShowcase[]): NextResponse {
  const response: IShowcaseResponse = { entries }
  return NextResponse.json(response, {
    headers: {
      'cache-control': 'public, s-maxage=21600, stale-while-revalidate=86400',
    },
  })
}
