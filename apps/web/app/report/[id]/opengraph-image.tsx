import { ImageResponse } from 'next/og'
import { combinedScore, deepTrackScore, smartTrackScore } from '@/lib/score'
import { getScanStore } from '@/lib/scan-store'
import { hostOf } from '@/lib/url'

// MARK: - Report OG image (dynamic, the real result card)
//
// Reproduces the on-page result card — score disc + category bars — from the
// scan's actual data, so a shared report link previews its own score. Falls back
// to the brand card when the scan is missing or hasn't a standard report yet.

export const runtime = 'nodejs'
export const alt = 'isready.ai — AI readiness report'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#161613'
const SURFACE = '#1f1f1b'
const BORDER = '#33332e'
const TEXT = '#ececea'
const MUTED = '#8a8a82'
const BRAND = '#b8f53d'
const TRACK = '#2a2a26'

// gradeOf thresholds (90 / 75 / 50), as concrete hex so Satori needs no CSS vars.
function scoreColor(score: number): string {
  if (score >= 90) return '#46d35f'
  if (score >= 75) return '#4bb6e6'
  if (score >= 50) return '#e6b13e'
  return '#de4f37'
}

function gradeLabel(score: number): string {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 75) return 'GOOD'
  if (score >= 50) return 'MODERATE'
  return 'POOR'
}

export default async function ReportOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = await getScanStore()
  const record = await store.get(id).catch(() => null)
  const report = record?.report ?? null

  if (report === null) {
    return brandCard()
  }

  const deep = deepTrackScore(record?.siteReport)
  const smart = smartTrackScore(record?.smartReport, record?.siteSmartReport)
  const overall = combinedScore({ base: report.overall, deep, smart })
  const categories = (record?.siteReport?.categories ?? report.categories).slice(0, 5)
  const host = hostOf(report.finalUrl)

  const bars: Array<{ label: string; score: number; divider?: boolean }> = categories.map((c) => ({
    label: c.label,
    score: c.score,
  }))
  if (deep !== null) bars.push({ label: 'Deep Scan', score: deep, divider: true })
  if (smart !== null) {
    bars.push({ label: 'Smart agent readability', score: smart, divider: deep === null })
  }

  const accent = scoreColor(overall)
  const ringR = 92
  const ringC = 2 * Math.PI * ringR
  const filled = ringC * (overall / 100)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        color: TEXT,
        fontFamily: 'sans-serif',
        padding: 64,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30 }}>
          <div
            style={{
              width: 26,
              height: 26,
              background: BRAND,
              transform: 'rotate(45deg)',
              borderRadius: 5,
            }}
          />
          <span style={{ fontWeight: 700 }}>isready</span>
          <span style={{ color: MUTED }}>.ai</span>
        </div>
        <span style={{ fontSize: 24, color: MUTED }}>AI readiness report</span>
      </div>

      <div
        style={{
          marginTop: 36,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 28,
          padding: 56,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', display: 'flex', width: 220, height: 220 }}>
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r={ringR} stroke={TRACK} strokeWidth="18" fill="none" />
              <circle
                cx="110"
                cy="110"
                r={ringR}
                stroke={accent}
                strokeWidth="18"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${ringC}`}
                transform="rotate(-90 110 110)"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 220,
                height: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{overall}</span>
              <span style={{ fontSize: 24, color: MUTED, marginTop: 4 }}>/ 100</span>
            </div>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: accent, letterSpacing: 1 }}>
            {gradeLabel(overall)}
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: TEXT }}>{host}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {bars.map((bar) => (
              <div
                key={bar.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  paddingTop: bar.divider === true ? 14 : 0,
                  borderTop: bar.divider === true ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <span style={{ width: 230, fontSize: 21, color: MUTED }}>{bar.label}</span>
                <div
                  style={{
                    flex: 1,
                    height: 12,
                    background: TRACK,
                    borderRadius: 999,
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      width: `${bar.score}%`,
                      height: 12,
                      background: scoreColor(bar.score),
                      borderRadius: 999,
                    }}
                  />
                </div>
                <span style={{ width: 48, fontSize: 21, textAlign: 'right', color: TEXT }}>
                  {bar.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    size,
  )
}

// Brand fallback: a gradient card for reports without a standard report yet.
function brandCard(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(120% 120% at 18% 0%, #2a3d12 0%, ${BG} 55%)`,
        color: TEXT,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 44 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: BRAND,
            transform: 'rotate(45deg)',
            borderRadius: 6,
          }}
        />
        <span style={{ fontWeight: 700 }}>isready</span>
        <span style={{ color: MUTED }}>.ai</span>
      </div>
      <span style={{ marginTop: 28, fontSize: 40, fontWeight: 700 }}>AI readiness report</span>
    </div>,
    size,
  )
}
