import type { ICrawlerAccessRow, TCrawlerPurpose } from '@isreadyai/scanner'
import { EProbeOutcome, ERobotsRule } from '@isreadyai/scanner'
import { GRADE_TEXT } from './grade'

// MARK: - Crawler access table cells

export interface ICellView {
  glyph: '✓' | '✗' | '—'
  tone: string
  labelKey: string
  status?: number
}

const NOT_TESTED_TONE = 'text-site-faint'

const PURPOSE_KEYS: Record<TCrawlerPurpose, string> = {
  training: 'crawlers.purposeTraining',
  search: 'crawlers.purposeSearch',
  user: 'crawlers.purposeUser',
}

/** Translation key (inside the `report` namespace) for a crawler purpose. */
export function purposeLabelKey(purpose: TCrawlerPurpose): string {
  return PURPOSE_KEYS[purpose]
}

/** Maps one access row to the glyph, tone and label of its robots.txt and server cells. */
export function crawlerRowView(row: ICrawlerAccessRow): { robots: ICellView; server: ICellView } {
  return { robots: robotsCell(row), server: serverCell(row) }
}

// MARK: - internal

function robotsCell(row: ICrawlerAccessRow): ICellView {
  if (row.robots === ERobotsRule.BLOCKED) {
    return { glyph: '✗', tone: GRADE_TEXT.poor, labelKey: 'crawlers.robotsBlocked' }
  }
  return {
    glyph: '✓',
    tone: GRADE_TEXT.excellent,
    labelKey:
      row.robots === ERobotsRule.NO_ROBOTS ? 'crawlers.robotsNone' : 'crawlers.robotsAllowed',
  }
}

function serverCell(row: ICrawlerAccessRow): ICellView {
  const { probe } = row
  if (probe === null) {
    return { glyph: '—', tone: NOT_TESTED_TONE, labelKey: 'crawlers.serverUntested' }
  }
  if (probe.outcome === EProbeOutcome.SERVED) {
    return {
      glyph: '✓',
      tone: GRADE_TEXT.excellent,
      labelKey: 'crawlers.serverServed',
      status: probe.status,
    }
  }
  if (probe.outcome === EProbeOutcome.REFUSED) {
    return {
      glyph: '✗',
      tone: GRADE_TEXT.poor,
      labelKey: 'crawlers.serverRefused',
      status: probe.status,
    }
  }
  if (probe.outcome === EProbeOutcome.CHALLENGED) {
    return { glyph: '✗', tone: GRADE_TEXT.poor, labelKey: 'crawlers.serverChallenged' }
  }
  return { glyph: '✗', tone: GRADE_TEXT.poor, labelKey: 'crawlers.serverNoResponse' }
}
