import type { ICheckResult, IScanReport } from './types.ts'
import type { ISiteReport } from './crawl.ts'
import { hostOf } from './util/url.ts'
import { templateKey } from './smart-agent/template-sample.ts'

/**
 * Markdown report rendering: converts audit results to human-readable or
 * AI-actionable Markdown for sharing, archiving, or automated remediation.
 */

// MARK: - Report → Markdown

/**
 * Rendering audience/format for audit reports.
 *
 * - 'human' — readable summary for sharing and archiving
 * - 'llm' — structured instructions for AI coding agents (Claude Code, Cursor, Copilot)
 *
 * @export
 * @typedef {TMarkdownMode}
 */
export type TMarkdownMode = 'human' | 'llm'

/**
 * Renders a scan or site report as Markdown.
 *
 * For single-page reports, renders the audit results. For deep-crawl reports,
 * adds a structural templates table showing total/scanned page counts per URL-template cluster.
 *
 * @param {IScanReport | ISiteReport} report - The audit report to render.
 * @param {TMarkdownMode} [mode='human'] - Rendering audience (human or llm).
 * @returns {string} - The rendered Markdown.
 * @export
 */
export function reportToMarkdown(
  report: IScanReport | ISiteReport,
  mode: TMarkdownMode = 'human',
): string {
  // Discriminate ISiteReport by the presence of its `primary` field.
  if ('primary' in report) {
    const site = report
    const base = mode === 'llm' ? llmMarkdown(site.primary) : humanMarkdown(site.primary)
    return spliceClusters(base, siteClustersBlock(site, mode))
  }
  return mode === 'llm' ? llmMarkdown(report) : humanMarkdown(report)
}

/** Builds the structural-templates block for a deep-crawl report. */
function siteClustersBlock(site: ISiteReport, mode: TMarkdownMode): string {
  // Reports persisted before structural clustering shipped carry no `clusters`;
  // treat them as cluster-less rather than throwing on `.reduce`/`.map`.
  const clusters = site.clusters ?? []
  const totalFound = clusters.reduce((sum, c) => sum + c.pageCount, 0)
  const totalScanned = clusters.reduce((sum, c) => sum + c.scannedCount, 0)
  const heading = mode === 'llm' ? '## Site scope (deep crawl)' : '## Structural templates'
  const lines: string[] = [
    heading,
    '',
    `${clusters.length} template${clusters.length !== 1 ? 's' : ''} · ${totalFound} pages found · ${totalScanned} scanned`,
    '',
    '| Template | Avg score | Found | Scanned |',
    '|---|---:|---:|---:|',
    ...clusters.map((cluster) => {
      const pattern = templateKey(cluster.representativeUrl).replace(/:[a-z]+/g, '*')
      return `| \`${pattern}\` | ${cluster.avgScore} | ${cluster.pageCount} | ${cluster.scannedCount} |`
    }),
    '',
  ]
  return lines.join('\n')
}

/**
 * Inserts `block` just before the final `---` footer divider in `base`.
 * Falls back to appending when no divider is found (e.g. llm mode).
 */
function spliceClusters(base: string, block: string): string {
  const sep = '\n---\n'
  const idx = base.lastIndexOf(sep)
  if (idx === -1) return `${base}\n${block}`
  return `${base.slice(0, idx)}\n\n${block}${base.slice(idx)}`
}

// MARK: - Human mode

function humanMarkdown(report: IScanReport): string {
  const lines: string[] = []
  const failing = report.checks.filter((c) => c.status === 'fail')
  const warning = report.checks.filter((c) => c.status === 'warn')
  const passed = report.checks.filter((c) => c.status === 'pass')

  lines.push(`# AI readiness report — ${hostOf(report.finalUrl)}`)
  lines.push('')
  lines.push(
    `> **${report.overall}/100 · ${report.grade.toUpperCase()}** — scanned ${report.finishedAt.slice(0, 10)} · score v${report.scoreVersion} · [isready.ai](https://isready.ai)`,
  )
  lines.push('')
  lines.push(`Scanned URL: ${report.finalUrl}`)
  lines.push('')
  lines.push('## Scores')
  lines.push('')
  lines.push('| Category | Score | Weight |')
  lines.push('|---|---:|---:|')
  for (const category of report.categories) {
    lines.push(`| ${category.label} | ${category.score} | ${Math.round(category.weight * 100)}% |`)
  }
  lines.push('')

  if (failing.length > 0) {
    lines.push('## ✗ Failed checks')
    lines.push('')
    for (const check of failing) {
      lines.push(...findingBlock(check))
    }
  }
  if (warning.length > 0) {
    lines.push('## ▲ Warnings')
    lines.push('')
    for (const check of warning) {
      lines.push(...findingBlock(check))
    }
  }

  lines.push('## ✓ Passed')
  lines.push('')
  lines.push(passed.map((c) => `\`${c.id}\``).join(' · '))
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(
    'Re-scan any time: `npx isreadyai ' + hostOf(report.finalUrl) + '` or https://isready.ai',
  )
  lines.push('')
  return lines.join('\n')
}

function findingBlock(check: ICheckResult): string[] {
  const lines: string[] = []
  lines.push(`### ${check.title} (\`${check.id}\`)`)
  lines.push('')
  lines.push(check.detail)
  lines.push('')
  if (check.fix !== undefined) {
    lines.push(`**Fix:** ${check.fix}`)
    lines.push('')
  }
  const meta: string[] = []
  if (check.impact !== undefined) {
    meta.push(`impact: ${check.impact}`)
  }
  if (check.effort !== undefined) {
    meta.push(`effort: ${check.effort}`)
  }
  if (check.docsUrl !== undefined) {
    meta.push(`docs: ${check.docsUrl}`)
  }
  if (meta.length > 0) {
    lines.push(`_${meta.join(' · ')}_`)
    lines.push('')
  }
  return lines
}

// MARK: - LLM mode

function llmMarkdown(report: IScanReport): string {
  const lines: string[] = []
  const failing = report.checks.filter((c) => c.status === 'fail')
  const warning = report.checks.filter((c) => c.status === 'warn')
  const host = hostOf(report.finalUrl)

  lines.push(`# AI-readiness fix plan for ${host}`)
  lines.push('')
  lines.push('## Context for the AI agent')
  lines.push('')
  lines.push(
    `You are an autonomous coding agent working on the codebase that serves ${report.finalUrl}. ` +
      `An AI-readiness audit (isready.ai, score v${report.scoreVersion}, ${report.finishedAt.slice(0, 10)}) ` +
      `scored this site **${report.overall}/100 (${report.grade})**. Your task is to fix the findings below ` +
      'so the site becomes fully readable by AI crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) ' +
      'and AI search engines.',
  )
  lines.push('')
  lines.push('Ground rules:')
  lines.push('')
  lines.push(
    '1. Most AI crawlers do NOT execute JavaScript — every fix must land in the **server-rendered HTML**, not client-side.',
  )
  lines.push(
    '2. Work through findings in order (failures first, then warnings); they are sorted by impact.',
  )
  lines.push(
    '3. The `evidence` blocks contain the exact observed values — use them to locate the problem.',
  )
  lines.push(
    '4. After your changes, verify with `npx isreadyai ' +
      host +
      '` (or curl the page without JS and inspect the HTML).',
  )
  lines.push(
    '5. Do not fabricate content: where a fix needs copy (descriptions, author names), derive it from the existing site content.',
  )
  lines.push('')

  const ordered = [...failing, ...warning]
  if (ordered.length === 0) {
    lines.push('## Findings')
    lines.push('')
    lines.push('No failures or warnings — this site is already AI-ready. No action required.')
    lines.push('')
    return lines.join('\n')
  }

  lines.push(`## Findings to fix (${failing.length} failed, ${warning.length} warnings)`)
  lines.push('')
  ordered.forEach((check, index) => {
    lines.push(`### ${index + 1}. [${check.status.toUpperCase()}] ${check.title}`)
    lines.push('')
    lines.push(`- **Check id:** \`${check.id}\` (category: ${check.category})`)
    lines.push(`- **Observed:** ${check.detail}`)
    if (check.fix !== undefined) {
      lines.push(`- **Required change:** ${check.fix}`)
    }
    if (check.impact !== undefined || check.effort !== undefined) {
      lines.push(`- **Priority:** impact ${check.impact ?? 'n/a'}, effort ${check.effort ?? 'n/a'}`)
    }
    if (check.docsUrl !== undefined) {
      lines.push(`- **Reference:** ${check.docsUrl}`)
    }
    if (check.evidence !== undefined) {
      lines.push('- **Evidence:**')
      lines.push('')
      lines.push('```json')
      lines.push(JSON.stringify(check.evidence, null, 2))
      lines.push('```')
    }
    lines.push('')
  })

  lines.push('## Acceptance criteria')
  lines.push('')
  lines.push(`- All ${failing.length} failed checks pass on re-scan.`)
  lines.push('- No previously passing check regresses.')
  lines.push(
    '- The fixes are visible in the raw HTML response (verify with `curl`, not a browser).',
  )
  lines.push('')
  return lines.join('\n')
}
