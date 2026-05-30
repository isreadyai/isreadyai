/**
 * Renders scan reports to formatted text output for display or piping.
 *
 * Pure IScanReport/ISiteReport → multi-line string. No side effects or env reads
 * (color is decided in ansi.ts). Target width ~72 cols so it screenshots cleanly.
 */

import type {
  IScanReport,
  ISiteReport,
  ICheckResult,
  ICategoryScore,
  TGrade,
  TStatus,
} from '@isreadyai/scanner'
import { EStatus, EGrade, aggregateSiteFindings, templateKey } from '@isreadyai/scanner'
import type { ISmartAgentReport, ISmartAgentSiteReport } from '@isreadyai/scanner'
import * as c from './ansi.ts'

// MARK: - Constants

const WIDTH = 72
const BAR_WIDTH = 40
const MINI_BAR_WIDTH = 10

// MARK: - Rendering

/**
 * Renders a single-page scan report as formatted text.
 *
 * @param {IScanReport} report - The scan report to render.
 * @returns {string} - Multi-line formatted report suitable for display or piping.
 * @export
 */
export function renderReport(report: IScanReport): string {
  const lines: string[] = []
  lines.push('')
  lines.push(
    ...header(
      'Agent Readability',
      'AI readiness report',
      displayUrl(report.finalUrl || report.url),
      report.finishedAt,
    ),
  )
  lines.push('')
  lines.push(...scoreBlock(report.overall, report.grade))
  lines.push('')
  lines.push(...categoryTable(report.categories))
  lines.push('')
  lines.push(...findings(report.checks))
  lines.push('')
  lines.push(...footer(report))
  lines.push('')
  return lines.join('\n')
}

/**
 * Renders a deep-scan (site-wide) report as formatted text.
 *
 * Includes aggregate score, aggregate categories, structural template clusters
 * (counts + avg score), findings grouped by check, and page table.
 *
 * @param {ISiteReport} site - The deep-scan site report to render.
 * @returns {string} - Multi-line formatted report suitable for display or piping.
 * @export
 */
export function renderSiteReport(site: ISiteReport): string {
  const total = site.pages.length + 1
  const lines: string[] = []
  lines.push('')
  lines.push(
    ...header(
      'Agent Readability',
      'AI readiness report',
      wildcardUrl(displayUrl(site.primary.finalUrl || site.url)),
      site.finishedAt,
    ),
  )
  lines.push('')
  lines.push(...scoreBlock(site.overall, site.grade))
  lines.push('')
  lines.push(...categoryTable(site.categories))
  lines.push('')
  lines.push(...clustersTable(site))
  lines.push('')
  lines.push(...siteFindings(site, total))
  lines.push('')
  lines.push(...pagesTable(site, total))
  lines.push('')
  lines.push(...siteFooter(site, total))
  lines.push('')
  return lines.join('\n')
}

/**
 * Renders a Smart Agent single-page audit report as formatted text.
 *
 * @param {ISmartAgentReport} report - The Smart Agent report to render.
 * @returns {string} - Multi-line formatted report suitable for display or piping.
 * @export
 */
export function renderSmartAgentReport(report: ISmartAgentReport): string {
  const paint = scoreColor(report.overall)
  const smartFindings = report.signals.filter((signal) => signal.status !== 'pass')
  const lines = [
    '',
    ...header(
      'Smart Agent Readability',
      'browser-capable agent',
      displayUrl(report.finalUrl || report.url),
      report.finishedAt,
    ),
    `  ${paint(c.bold(String(report.overall)))}${c.dim('/100')}   ${paint(c.bold(report.grade.toUpperCase()))}`,
    `  ${scoreBar(report.overall, paint)}`,
    '',
    ...report.categories.map((category) => {
      const categoryPaint = scoreColor(category.score)
      return `  ${miniBar(category.score, categoryPaint)}  ${categoryPaint(String(category.score).padStart(3))}  ${c.gray(category.label)}`
    }),
    '',
    c.dim('SMART AGENT FINDINGS'),
    '',
  ]

  if (smartFindings.length === 0) {
    lines.push(`  ${c.green('✓')} ${c.dim('No browser-agent readability issues detected.')}`)
  } else {
    for (const item of smartFindings) {
      const marker = item.status === 'fail' ? c.red('✗') : c.yellow('▲')
      lines.push(`  ${marker} ${c.bold(item.title)} ${c.dim('—')} ${item.detail}`)
      if (item.fix !== undefined) {
        lines.push(`     ${c.dim(`→ ${item.fix}`)}`)
      }
    }
  }

  lines.push('')
  lines.push(
    c.dim(
      `  Smart Agent View: ${report.agentView.interactiveElements.length} interactive elements · ${report.meta.provider}`,
    ),
  )
  lines.push(c.dim('  powered by agent-browser — an open-source Vercel Labs project'))
  lines.push('')
  return lines.join('\n')
}

/**
 * Renders a Smart Agent deep-scan (multi-page) report as formatted text.
 *
 * @param {ISmartAgentSiteReport} site - The Smart Agent site report to render.
 * @returns {string} - Multi-line formatted report suitable for display or piping.
 * @export
 */
export function renderSmartAgentSiteReport(site: ISmartAgentSiteReport): string {
  const total = site.pages.length + 1
  const paint = scoreColor(site.overall)
  const lines = [
    '',
    ...header(
      'Smart Agent Readability',
      'browser-capable agent',
      wildcardUrl(displayUrl(site.primary.finalUrl || site.url)),
      site.finishedAt,
    ),
    `  ${paint(c.bold(String(site.overall)))}${c.dim('/100')}   ${paint(c.bold(site.grade.toUpperCase()))}`,
    `  ${scoreBar(site.overall, paint)}`,
    '',
    ...site.categories.map((category) => {
      const categoryPaint = scoreColor(category.score)
      return `  ${miniBar(category.score, categoryPaint)}  ${categoryPaint(String(category.score).padStart(3))}  ${c.gray(category.label)}`
    }),
    '',
    c.dim(`SMART AGENT — ${total} pages`),
    '',
    ...[site.primary, ...site.pages].map((page) => {
      const pagePaint = scoreColor(page.overall)
      return `  ${pagePaint(String(page.overall).padStart(3))}  ${c.gray(displayUrl(page.finalUrl))}`
    }),
    '',
    c.dim('  powered by agent-browser — an open-source Vercel Labs project'),
    '',
  ]
  return lines.join('\n')
}

/**
 * Renders an error message when Smart Agent audit is unavailable.
 *
 * @param {string} reason - The reason why Smart Agent is unavailable.
 * @returns {string} - Formatted error message.
 * @export
 */
export function renderSmartAgentUnavailable(reason: string): string {
  return [
    '',
    `${c.accent('◆')} ${c.bold('Smart Agent Readability')}`,
    rule(),
    `  ${c.yellow('unavailable')} ${c.dim('—')} ${reason}`,
    `  ${c.dim('Install: npm install -g agent-browser && agent-browser install')}`,
    '',
  ].join('\n')
}

// MARK: - Header

function header(title: string, descriptor: string, url: string, finishedAt: string): string[] {
  const heading = `${c.accent('◆')} ${c.bold(title)} ${c.dim(`— ${descriptor}`)}`
  return [heading, `${c.white(url)}  ${c.dim('·')}  ${c.dim(formatDate(finishedAt))}`, rule()]
}

// MARK: - Score block

function scoreBlock(overall: number, grade: TGrade): string[] {
  const paint = gradeColor(grade)
  const big = c.bold(paint(String(overall)))
  const outOf = c.dim('/100')
  const word = paint(c.bold(grade.toUpperCase()))
  const bar = scoreBar(overall, paint)
  return [`  ${big}${outOf}   ${word}`, `  ${bar}`]
}

function scoreBar(score: number, paint: (s: string) => string): string {
  const filled = Math.round((clamp(score) / 100) * BAR_WIDTH)
  const full = paint('█'.repeat(filled))
  const empty = c.dim('░'.repeat(BAR_WIDTH - filled))
  return `${full}${empty}`
}

// MARK: - Category table

function categoryTable(categories: ICategoryScore[]): string[] {
  const labelWidth = Math.max(...categories.map((cat) => cat.label.length))
  return categories.map((cat) => {
    const paint = scoreColor(cat.score)
    const bar = miniBar(cat.score, paint)
    const label = cat.label.padEnd(labelWidth)
    return `  ${bar}  ${paint(String(cat.score).padStart(3))}  ${c.gray(label)}`
  })
}

function miniBar(score: number, paint: (s: string) => string): string {
  const filled = Math.round((clamp(score) / 100) * MINI_BAR_WIDTH)
  const full = paint('▰'.repeat(filled))
  const empty = c.dim('▱'.repeat(MINI_BAR_WIDTH - filled))
  return `${full}${empty}`
}

// MARK: - Findings

function findings(checks: ICheckResult[]): string[] {
  const fails = checks.filter((r) => r.status === EStatus.FAIL || r.status === EStatus.ERROR)
  const warns = checks.filter((r) => r.status === EStatus.WARN)
  const infos = checks.filter((r) => r.status === EStatus.INFO)

  const lines: string[] = [c.dim('FINDINGS'), '']

  if (fails.length === 0 && warns.length === 0) {
    lines.push(`  ${c.green('✓')} ${c.dim('No blocking issues — looking sharp.')}`)
  }

  for (const r of fails) {
    lines.push(...finding(r, c.red('✗')))
  }
  for (const r of warns) {
    lines.push(...finding(r, c.yellow('▲')))
  }

  if (infos.length > 0) {
    lines.push('')
    const noun = infos.length === 1 ? 'note' : 'notes'
    lines.push(c.dim(`  ${infos.length} informational ${noun} — run with --json for details`))
  }

  return lines
}

function finding(r: ICheckResult, marker: string): string[] {
  const out = [`  ${marker} ${c.bold(r.id)} ${c.dim('—')} ${r.detail}`]
  if (r.fix !== undefined && r.fix !== '') {
    out.push(`     ${c.dim(`→ ${r.fix}`)}`)
  }
  return out
}

// MARK: - Footer

function footer(report: IScanReport): string[] {
  const passed = count(report.checks, EStatus.PASS)
  const warnings = count(report.checks, EStatus.WARN)
  const failed = count(report.checks, EStatus.FAIL) + count(report.checks, EStatus.ERROR)

  const summary = [
    `${c.green('passed')} ${c.bold(String(passed))}`,
    `${c.yellow('warnings')} ${c.bold(String(warnings))}`,
    `${c.red('failed')} ${c.bold(String(failed))}`,
    c.dim(`scanned in ${report.meta.durationMs} ms`),
  ].join(c.dim('  ·  '))

  return [rule(), `  ${summary}`, c.dim('  https://isready.ai — full report & monitoring')]
}

// MARK: - Deep-scan pieces

/**
 * Converts a templateKey pattern (/:n, /:slug, etc.) to a display pattern
 * by replacing all placeholder segments with `*` — matches what the web shows.
 */
function clusterPattern(representativeUrl: string): string {
  return templateKey(representativeUrl).replace(/:[a-z]+/g, '*')
}

function clustersTable(site: ISiteReport): string[] {
  const totalFound = site.clusters.reduce((sum, cluster) => sum + cluster.pageCount, 0)
  const totalScanned = site.clusters.reduce((sum, cluster) => sum + cluster.scannedCount, 0)
  const title = c.dim(
    `TEMPLATES — ${site.clusters.length} template${site.clusters.length !== 1 ? 's' : ''} · ${totalFound} found · ${totalScanned} scanned`,
  )
  const lines: string[] = [title, '']

  for (const cluster of site.clusters) {
    const paint = scoreColor(cluster.avgScore)
    const pattern = clusterPattern(cluster.representativeUrl)
    const counts = c.dim(
      cluster.scannedCount < cluster.pageCount
        ? `${cluster.pageCount} found · ${cluster.scannedCount} scanned`
        : `${cluster.pageCount} page${cluster.pageCount !== 1 ? 's' : ''}`,
    )
    lines.push(
      `  ${miniBar(cluster.avgScore, paint)}  ${paint(String(cluster.avgScore).padStart(3))}  ${c.gray(pattern)}  ${counts}`,
    )
  }

  return lines
}

function siteFindings(site: ISiteReport, total: number): string[] {
  const groups = aggregateSiteFindings(site)
  const lines: string[] = [c.dim(`FINDINGS — across ${total} pages`), '']

  if (groups.length === 0) {
    lines.push(`  ${c.green('✓')} ${c.dim('No blocking issues on any page — looking sharp.')}`)
    return lines
  }

  for (const group of groups) {
    const failed = group.result.status === EStatus.FAIL
    const marker = failed ? c.red('✗') : c.yellow('▲')
    lines.push(
      `  ${marker} ${c.bold(group.result.id)} ${c.dim(`[${group.pages.length}/${total} pages]`)} ${c.dim('—')} ${group.result.detail}`,
    )
    if (group.result.fix !== undefined && group.result.fix !== '') {
      lines.push(`     ${c.dim(`→ ${group.result.fix}`)}`)
    }
  }

  const infos = site.primary.checks.filter((r) => r.status === EStatus.INFO).length
  if (infos > 0) {
    lines.push('')
    lines.push(c.dim(`  ${infos} informational notes — run with --json for details`))
  }
  return lines
}

function pagesTable(site: ISiteReport, total: number): string[] {
  const summary = `${total} pages scanned${site.discovered > site.pages.length ? c.dim(`  ·  ${site.discovered} discovered`) : ''}`
  const lines: string[] = [c.dim('PAGES — ') + summary, '']
  for (const page of [site.primary, ...site.pages]) {
    const paint = scoreColor(page.overall)
    const failed = page.checks.filter((r) => r.status === EStatus.FAIL).length
    const issues = failed > 0 ? c.red(`✗ ${failed}`) : c.green('✓')
    lines.push(
      `  ${miniBar(page.overall, paint)}  ${paint(String(page.overall).padStart(3))}  ${issues.padEnd(6)} ${c.gray(displayPath(page.finalUrl))}`,
    )
  }
  return lines
}

function siteFooter(site: ISiteReport, total: number): string[] {
  const checks = [site.primary, ...site.pages].flatMap((page) => page.checks)
  const passed = count(checks, EStatus.PASS)
  const warnings = count(checks, EStatus.WARN)
  const failed = count(checks, EStatus.FAIL) + count(checks, EStatus.ERROR)
  const durationMs = Math.max(
    0,
    new Date(site.finishedAt).getTime() - new Date(site.startedAt).getTime(),
  )

  const summary = [
    `${c.green('passed')} ${c.bold(String(passed))}`,
    `${c.yellow('warnings')} ${c.bold(String(warnings))}`,
    `${c.red('failed')} ${c.bold(String(failed))}`,
    c.dim(`${total} pages in ${durationMs} ms`),
  ].join(c.dim('  ·  '))

  return [rule(), `  ${summary}`, c.dim('  https://isready.ai — full report & monitoring')]
}

/** `…/path` → `…/path/*` — signals the report covers the whole site. */
function wildcardUrl(url: string): string {
  return url.endsWith('/') ? `${url}*` : `${url}/*`
}

function displayPath(url: string): string {
  try {
    const parsed = new URL(url)
    const path = `${parsed.pathname}${parsed.search}`
    return path === '/' ? parsed.host : path
  } catch {
    return url
  }
}

// MARK: - Gutter

/**
 * Prefixes every line with a clack-style `│` gutter so the report sits
 * INSIDE the framed session (┌ intro … └ outro) instead of breaking it —
 * the Vercel-CLI look. Only used in interactive (fancy) mode.
 *
 * @param {string} text - The multi-line text to add gutters to.
 * @returns {string} - Text with gutters prefixed to each line.
 * @export
 */
export function withGutter(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length === 0 ? c.gray('│') : `${c.gray('│')}  ${line}`))
    .join('\n')
}

// MARK: - Helpers

function rule(): string {
  return c.dim('─'.repeat(WIDTH))
}

const GRADE_PAINT: Record<TGrade, (s: string) => string> = {
  [EGrade.EXCELLENT]: c.green,
  [EGrade.GOOD]: c.cyan,
  [EGrade.MODERATE]: c.yellow,
  [EGrade.POOR]: c.red,
}

function gradeColor(grade: TGrade): (s: string) => string {
  return GRADE_PAINT[grade]
}

/**
 * Returns a color function appropriate for a numeric score (0–100).
 *
 * @param {number} score - The score to select color for.
 * @returns {(s: string) => string} - ANSI color function (red/yellow/cyan/green based on score).
 * @export
 */
export function scoreColor(score: number): (s: string) => string {
  if (score >= 90) {
    return c.green
  }
  if (score >= 75) {
    return c.cyan
  }
  if (score >= 50) {
    return c.yellow
  }
  return c.red
}

function count(checks: ICheckResult[], status: TStatus): number {
  return checks.filter((r) => r.status === status).length
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

function displayUrl(url: string): string {
  return url.replace(/\/$/, '')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  return d.toISOString().slice(0, 10)
}
