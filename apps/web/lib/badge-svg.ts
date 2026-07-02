import type { TGrade } from '@isreadyai/scanner'

// MARK: - GitHub badge SVG

/**
 * shields.io-flat style: [ ◆ AI ready | 92 ]. Hand-rolled to keep the endpoint
 * dependency-free. Colors follow the score grades.
 */

const GRADE_HEX: Record<TGrade, string> = {
  excellent: '#44cc11',
  good: '#33aacc',
  moderate: '#dfb317',
  poor: '#e05d44',
}

const LABEL = 'AI ready'
const CHAR_W = 6.6
const PAD = 7
const DIAMOND_W = 13

export function badgeSvg(score: number | null, grade: TGrade | null): string {
  const value = score === null ? 'n/a' : String(score)
  const color = grade === null ? '#9f9f9f' : GRADE_HEX[grade]
  const title = score === null ? 'AI readiness: unknown' : `AI readiness score: ${score}/100`
  return renderBadge(value, color, title)
}

export function lockedBadgeSvg(): string {
  return renderBadge('locked', '#9f9f9f', 'AI readiness badge: not available')
}

export function badgeDataUrl(score: number | null, grade: TGrade | null): string {
  return `data:image/svg+xml,${encodeURIComponent(badgeSvg(score, grade))}`
}

function renderBadge(value: string, color: string, title: string): string {
  const labelW = Math.round(LABEL.length * CHAR_W + PAD * 2 + DIAMOND_W)
  const valueW = Math.round(value.length * CHAR_W + PAD * 2)
  const width = labelW + valueW

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">
  <title>${title}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#1f1f1c"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g transform="translate(${PAD}, 6)">
    <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="#b8f53d"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${PAD + DIAMOND_W + (labelW - PAD * 2 - DIAMOND_W) / 2}" y="15" fill="#010101" fill-opacity=".3">${LABEL}</text>
    <text x="${PAD + DIAMOND_W + (labelW - PAD * 2 - DIAMOND_W) / 2}" y="14">${LABEL}</text>
    <text x="${labelW + valueW / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelW + valueW / 2}" y="14">${value}</text>
  </g>
</svg>`
}
