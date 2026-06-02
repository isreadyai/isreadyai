import type { ICheckResult, IScanReport, TGrade } from '@isreadyai/scanner'
import { gradeOf } from '@isreadyai/scanner'
import { hostOf } from '@/lib/url'

// MARK: - Client-side PDF report

/**
 * Data-driven jsPDF layout (no DOM screenshots — crisp text, tiny file).
 * jsPDF is imported lazily so it stays out of the main bundle.
 */

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const CONTENT_W = PAGE_W - MARGIN * 2

const INK = '#16160f'
const MUTED = '#6b6b64'
const FAINT = '#9a9a92'
const ACCENT = '#5a8f00'
const RED = '#c43d2f'
const AMBER = '#b98300'
const LINE = '#dddDD6'

// Print-friendly hex equivalents of the site's score tokens (PDFs can't read CSS vars).
const GRADE_COLORS: Record<TGrade, string> = {
  excellent: '#3e8e2f',
  good: '#1f7a9e',
  moderate: AMBER,
  poor: RED,
}

/** Raw bytes for server-side delivery (email attachment). */
export async function reportPdfArrayBuffer(report: IScanReport): Promise<ArrayBuffer> {
  const doc = await buildReportPdf(report)
  return doc.output('arraybuffer')
}

/** Triggers a browser download of the PDF — the owner-facing direct export. */
export async function downloadReportPdf(report: IScanReport): Promise<void> {
  const doc = await buildReportPdf(report)
  doc.save(`isready-${hostOf(report.finalUrl)}-report.pdf`)
}

async function buildReportPdf(report: IScanReport): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const host = hostOf(report.finalUrl)

  // MARK: Header
  doc.setFillColor(INK)
  doc.rect(0, 0, PAGE_W, 34, 'F')
  // Base-14 PDF fonts have no '◆' — draw the diamond as a vector instead.
  drawDiamond(doc, MARGIN + 2.2, 13.2, 2.6, '#b8f53d')
  doc.setTextColor('#b8f53d')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('isready.ai', MARGIN + 7, 15)
  doc.setTextColor('#ffffff')
  doc.setFontSize(11)
  doc.text('AI readiness report', MARGIN, 23)
  doc.setTextColor('#b9b9b0')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `${report.finalUrl}  ·  ${report.finishedAt.slice(0, 10)}  ·  score v${report.scoreVersion}`,
    MARGIN,
    29,
  )
  y = 46

  // MARK: Score block
  const gradeColor = GRADE_COLORS[report.grade]
  doc.setDrawColor(gradeColor)
  doc.setLineWidth(1.6)
  doc.circle(MARGIN + 14, y + 12, 13, 'S')
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(String(report.overall), MARGIN + 14, y + 14, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  doc.text('/100', MARGIN + 14, y + 19, { align: 'center' })
  doc.setTextColor(gradeColor)
  doc.setFontSize(12)
  doc.text(report.grade.toUpperCase(), MARGIN + 34, y + 8)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const failed = report.checks.filter((c) => c.status === 'fail')
  const warned = report.checks.filter((c) => c.status === 'warn')
  const passed = report.checks.filter((c) => c.status === 'pass').length
  doc.text(
    `${passed} passed · ${warned.length} warnings · ${failed.length} failed`,
    MARGIN + 34,
    y + 14,
  )
  doc.text(host, MARGIN + 34, y + 20)

  // MARK: Category bars
  let barY = y + 32
  doc.setFontSize(9)
  for (const category of report.categories) {
    doc.setTextColor(MUTED)
    doc.text(category.label, MARGIN, barY + 3)
    const barX = MARGIN + 46
    const barW = CONTENT_W - 46 - 14
    doc.setFillColor('#ececea')
    doc.roundedRect(barX, barY, barW, 3.4, 1.7, 1.7, 'F')
    const w = Math.max(3.4, (category.score / 100) * barW)
    doc.setFillColor(scoreColor(category.score))
    doc.roundedRect(barX, barY, w, 3.4, 1.7, 1.7, 'F')
    doc.setTextColor(INK)
    doc.text(String(category.score), PAGE_W - MARGIN, barY + 3, {
      align: 'right',
    })
    barY += 8
  }
  y = barY + 6

  // MARK: Findings
  y = sectionTitle(doc, 'Findings', y)
  if (failed.length === 0 && warned.length === 0) {
    doc.setTextColor(ACCENT)
    doc.setFontSize(10)
    doc.text('Everything passed. This site is ready for AI.', MARGIN, y)
    y += 8
  }
  for (const check of [...failed, ...warned]) {
    y = findingBlock(doc, check, y)
  }

  // MARK: Passed
  y = sectionTitle(doc, 'Passed checks', y)
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  const passedIds = report.checks
    .filter((c) => c.status === 'pass')
    .map((c) => c.id)
    .join('   ')
  for (const line of doc.splitTextToSize(passedIds, CONTENT_W) as string[]) {
    y = ensureRoom(doc, y, 5)
    doc.text(line, MARGIN, y)
    y += 4
  }

  // MARK: Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(FAINT)
    doc.text(
      `isready.ai — free AI-readiness audit · re-scan: npx isreadyai ${host}`,
      MARGIN,
      PAGE_H - 10,
    )
    doc.text(`${i}/${pages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' })
  }

  return doc
}

// MARK: - internal

function drawDiamond(
  doc: import('jspdf').jsPDF,
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  doc.setFillColor(color)
  doc.triangle(cx, cy - r, cx + r, cy, cx, cy + r, 'F')
  doc.triangle(cx, cy - r, cx - r, cy, cx, cy + r, 'F')
}

function sectionTitle(doc: import('jspdf').jsPDF, title: string, y: number): number {
  const next = ensureRoom(doc, y, 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(INK)
  doc.text(title, MARGIN, next + 4)
  doc.setDrawColor(LINE)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, next + 6.5, PAGE_W - MARGIN, next + 6.5)
  return next + 12
}

function findingBlock(doc: import('jspdf').jsPDF, check: ICheckResult, y: number): number {
  const failed = check.status === 'fail'
  // splitTextToSize measures with the CURRENT font — set it first or lines overflow.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const detail = doc.splitTextToSize(check.detail, CONTENT_W - 6) as string[]
  const fix =
    check.fix !== undefined
      ? (doc.splitTextToSize(`Fix: ${check.fix}`, CONTENT_W - 6) as string[])
      : []
  const blockH = 6 + detail.length * 4 + fix.length * 4 + 6

  let next = ensureRoom(doc, y, blockH)
  // Status marker as vector (unicode ✗/▲ are missing from base-14 fonts).
  doc.setFillColor(failed ? RED : AMBER)
  doc.circle(MARGIN + 1.2, next - 1.2, 1.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(failed ? RED : AMBER)
  doc.text(check.title, MARGIN + 5, next)
  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(FAINT)
  doc.text(check.id, PAGE_W - MARGIN, next, { align: 'right' })
  next += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  for (const line of detail) {
    doc.text(line, MARGIN + 6, next)
    next += 4
  }
  if (fix.length > 0) {
    doc.setTextColor(ACCENT)
    for (const line of fix) {
      doc.text(line, MARGIN + 6, next)
      next += 4
    }
  }
  const meta: string[] = []
  if (check.impact !== undefined) {
    meta.push(`impact ${check.impact}`)
  }
  if (check.effort !== undefined) {
    meta.push(`effort ${check.effort}`)
  }
  if (meta.length > 0) {
    doc.setFontSize(7.5)
    doc.setTextColor(FAINT)
    doc.text(meta.join(' · '), MARGIN + 6, next)
    next += 4
  }
  return next + 4
}

function ensureRoom(doc: import('jspdf').jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 18) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function scoreColor(score: number): string {
  return GRADE_COLORS[gradeOf(score)]
}
