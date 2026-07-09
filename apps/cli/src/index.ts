#!/usr/bin/env bun
import type { ISiteReport, TGrade } from '@isreadyai/scanner'
import type { ISmartAgentReport, ISmartAgentSiteReport } from '@isreadyai/scanner'
import * as clack from '@clack/prompts'
import {
  scan,
  scanSite,
  allChecks,
  gradeOf,
  hostOf,
  readinessHeadlineScore,
  reportToMarkdown,
  validateScanInput,
} from '@isreadyai/scanner'
import { runSmartAgentAudit, aggregateSmartReports } from '@isreadyai/scanner'
import packageJson from '../package.json' with { type: 'json' }
import {
  renderReport,
  renderSiteReport,
  renderSmartAgentReport,
  renderSmartAgentSiteReport,
  renderSmartAgentUnavailable,
  scoreColor,
  withGutter,
} from './render.ts'
import { CliAgentBrowserExecutor } from './smart-agent.ts'
import * as c from './ansi.ts'

/**
 * `isreadyai <url>` scans a site and prints a scored report to stdout. Progress
 * and the spinner go to stderr so stdout stays pipeable (`… --json | jq`). Exit
 * codes: 0 when score >= 50, 1 when below or the scan failed, 2 on misuse.
 */

// MARK: - Constants

const VERSION = packageJson.version
const PASS_THRESHOLD = 50

// MARK: - Types

/**
 * Parsed command-line flags and positional arguments.
 *
 * @interface IFlags
 * @typedef {IFlags}
 */
interface IFlags {
  json: boolean
  md: boolean
  llm: boolean
  quiet: boolean
  deep: boolean
  smart: boolean
  limit: number | undefined
  skip: number | undefined
  help: boolean
  version: boolean
  url: string | undefined
}

// MARK: - Main

await main()

/**
 * Main entry point for the CLI scanner.
 *
 * @async
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2))

  if (flags.help) {
    process.stdout.write(helpText())
    process.exit(0)
  }
  if (flags.version) {
    process.stdout.write(`${VERSION}\n`)
    process.exit(0)
  }
  if (flags.url === undefined) {
    process.stderr.write(`${c.red('error')} missing <url>\n\n`)
    process.stderr.write(helpText())
    process.exit(2)
  }

  // Fancy clack UI only for the interactive human report; machine-readable
  // modes and piped output stay plain.
  const fancy =
    !flags.json && !flags.md && !flags.llm && !flags.quiet && process.stdout.isTTY === true

  const spinner = fancy ? createClackSpinner(flags.url) : createSpinner()
  try {
    let report
    let site: ISiteReport | null = null
    let smartReport: ISmartAgentReport | null = null
    let smartSite: ISmartAgentSiteReport | null = null
    let smartError: string | null = null
    if (flags.deep) {
      site = await scanSite(flags.url, {
        checks: allChecks,
        // Local run: no page cap unless the user sets one.
        limit: flags.limit ?? Number.POSITIVE_INFINITY,
        skip: flags.skip,
        onProgress: (message) => spinner.tick(message),
      })
      report = site.primary
    } else {
      report = await scan(flags.url, {
        checks: allChecks,
        onProgress: (message) => spinner.tick(message),
      })
    }

    if (report.meta.fetchOk === false) {
      const reason = report.meta.error ?? 'site unreachable'
      spinner.fail(`could not scan ${flags.url} — ${reason}`)
      process.exit(1)
    }

    const searchOverall = site !== null ? site.overall : report.overall
    const searchGrade = site !== null ? site.grade : report.grade
    const baseLabel = `Agent Readability ${searchOverall}/100 — ${searchGrade.toUpperCase()}`

    const renderHuman = !flags.json && !flags.md && !flags.llm && !flags.quiet
    // In the clack frame the report carries the │ gutter; plain output stays bare.
    const decorate = fancy ? withGutter : (text: string): string => text
    const emit = (text: string): void => {
      if (text !== '') {
        process.stdout.write(`${decorate(text)}\n`)
      }
    }

    const runSmartAudit = async (): Promise<void> => {
      const executor = new CliAgentBrowserExecutor()
      // Deep path: one audit per structural cluster representative — matches the web.
      // Single-page path: audit just the primary page as before.
      const targetUrls: string[] =
        site !== null
          ? site.clusters.map((cluster) => cluster.representativeUrl)
          : [report.finalUrl]
      try {
        const reports: ISmartAgentReport[] = []
        for (const [index, url] of targetUrls.entries()) {
          const validated = validateScanInput(url)
          if (!validated.ok) {
            throw new Error(`Smart Agent navigation rejected: ${validated.problem}`)
          }
          spinner.tick(
            targetUrls.length > 1
              ? `Smart Agent ${index + 1}/${targetUrls.length}: ${url}`
              : 'Rendering Smart Agent View with agent-browser',
          )
          reports.push(await runSmartAgentAudit(validated.url, executor))
        }
        smartReport = reports[0] ?? null
        if (reports.length > 1 && reports[0] !== undefined) {
          smartSite = aggregateSmartReports(reports[0], reports.slice(1))
        }
      } catch (error) {
        smartError = error instanceof Error ? error.message : String(error)
      }
    }

    const smartLabel = (): string => {
      const smart = smartSite ?? smartReport
      return smart !== null
        ? `Smart Agent Readability ${smart.overall}/100 — ${smart.grade.toUpperCase()}`
        : 'Smart Agent Readability unavailable'
    }

    const smartTrack = (): ISmartAgentReport | ISmartAgentSiteReport | null =>
      smartSite ?? smartReport

    const headlineOverall = (): number =>
      readinessHeadlineScore({
        base: report.overall,
        deep: site?.overall ?? null,
        smart: smartTrack()?.overall ?? null,
      })

    const headlineGrade = (): TGrade => gradeOf(headlineOverall())

    const readinessSummary = (): string => {
      const score = headlineOverall()
      const grade = headlineGrade()
      const paint = scoreColor(score)
      return `${c.accent('◆')} ${c.bold('AI Readiness')} ${paint(c.bold(`${score}/100`))} ${c.dim('—')} ${paint(grade.toUpperCase())}`
    }

    const readinessJson = (): {
      overall: number
      grade: TGrade
      aiSearch: number
      smartAgent: number | null
    } => ({
      overall: headlineOverall(),
      grade: headlineGrade(),
      aiSearch: searchOverall,
      smartAgent: smartTrack()?.overall ?? null,
    })

    const smartSection = (): string =>
      smartSite !== null
        ? renderSmartAgentSiteReport(smartSite)
        : smartReport !== null
          ? renderSmartAgentReport(smartReport)
          : smartError !== null
            ? renderSmartAgentUnavailable(shortError(smartError))
            : ''

    if (renderHuman) {
      // Each ◇ milestone heads its own ◆ section: stop, print it, then reopen for Smart.
      const baseText = site !== null ? renderSiteReport(site) : renderReport(report)
      spinner.stop(baseLabel)
      emit(baseText)
      if (flags.smart) {
        spinner.open('Rendering Smart Agent View with agent-browser')
        await runSmartAudit()
        spinner.stop(smartLabel())
        emit(smartSection())
        if (smartTrack() !== null) {
          emit(readinessSummary())
        }
      }
      if (fancy) {
        clack.outro(c.dim('full report & monitoring → https://isready.ai'))
      }
    } else {
      if (flags.smart) {
        spinner.phase(baseLabel)
        await runSmartAudit()
        spinner.stop(smartLabel())
      } else {
        spinner.stop(baseLabel)
      }
      if (flags.json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              ...(site ?? report),
              readiness: readinessJson(),
              ...(flags.smart
                ? { smartAgent: smartSite ?? smartReport, smartAgentError: smartError }
                : {}),
            },
            null,
            2,
          )}\n`,
        )
      } else if (flags.llm) {
        // Deep run: pass the full site report so the clusters section is included.
        process.stdout.write(
          `${reportToMarkdown(site ?? report, 'llm')}${smartMarkdown(smartReport, smartError)}\n`,
        )
      } else if (flags.md) {
        process.stdout.write(
          `${reportToMarkdown(site ?? report, 'human')}${smartMarkdown(smartReport, smartError)}\n`,
        )
      } else if (flags.quiet) {
        process.stdout.write(
          `${quietLine(headlineOverall(), headlineGrade())}${smartQuiet(smartTrack(), smartError)}\n`,
        )
      }
    }

    await sendTelemetry({
      host: hostOf(report.finalUrl),
      score: headlineOverall(),
      deep: flags.deep,
      smart: smartSite !== null || smartReport !== null,
    })

    process.exit(headlineOverall() >= PASS_THRESHOLD ? 0 : 1)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    spinner.fail(`scan failed — ${message}`)
    process.exit(1)
  }
}

// MARK: - Argument parsing

/**
 * Parses command-line arguments into an IFlags object.
 *
 * @param {string[]} argv - The raw command-line arguments (process.argv.slice(2)).
 * @returns {IFlags} - Parsed flags and positional arguments.
 */
function parseArgs(argv: string[]): IFlags {
  const flags: IFlags = {
    json: false,
    md: false,
    llm: false,
    quiet: false,
    deep: false,
    smart: false,
    limit: undefined,
    skip: undefined,
    help: false,
    version: false,
    url: undefined,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    switch (arg) {
      case '--json':
        flags.json = true
        break
      case '--md':
        flags.md = true
        break
      case '--llm':
        flags.llm = true
        break
      case '--quiet':
      case '-q':
        flags.quiet = true
        break
      case '--deep':
        flags.deep = true
        break
      case '--smart-ai':
        flags.smart = true
        break
      case '--limit': {
        const value = Number(argv[i + 1])
        if (Number.isFinite(value) && value >= 0) {
          flags.limit = Math.floor(value)
          i++
        }
        break
      }
      case '--skip': {
        const value = Number(argv[i + 1])
        if (Number.isFinite(value) && value >= 0) {
          flags.skip = Math.floor(value)
          i++
        }
        break
      }
      case '--help':
      case '-h':
        flags.help = true
        break
      case '--version':
      case '-v':
        flags.version = true
        break
      default:
        if (arg.startsWith('--limit=')) {
          const value = Number(arg.slice('--limit='.length))
          if (Number.isFinite(value) && value >= 0) {
            flags.limit = Math.floor(value)
          }
        } else if (arg.startsWith('--skip=')) {
          const value = Number(arg.slice('--skip='.length))
          if (Number.isFinite(value) && value >= 0) {
            flags.skip = Math.floor(value)
          }
        } else if (!arg.startsWith('-') && flags.url === undefined) {
          flags.url = arg
        }
        break
    }
  }
  return flags
}

// MARK: - Telemetry

/**
 * Anonymous, PII-free usage ping (default on; opt out with TELEMETRY=false).
 * Skipped when an API key is configured — keyed runs upload via the CI report
 * path instead. Fire-and-forget with a short timeout so it never delays the CLI.
 *
 * @async
 * @param {{host: string, score: number, deep: boolean, smart: boolean}} payload - Usage telemetry payload.
 * @returns {Promise<void>}
 */
async function sendTelemetry(payload: {
  host: string
  score: number
  deep: boolean
  smart: boolean
}): Promise<void> {
  if (process.env.TELEMETRY === 'false') {
    return
  }
  if ((process.env.ISREADYAI_API_KEY ?? '').length > 0) {
    return
  }
  const apiUrl = process.env.ISREADYAI_API_URL ?? 'https://isready.ai'
  try {
    await fetch(`${apiUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'cli', ...payload }),
      signal: AbortSignal.timeout(1500),
    })
  } catch {
    // Telemetry must never affect the scan result.
  }
}

// MARK: - Formatting helpers

/**
 * Formats the quiet-mode output: score + grade with appropriate coloring.
 *
 * @param {number} overall - The overall score (0–100).
 * @param {TGrade} grade - The grade letter.
 * @returns {string} - Formatted one-line score output.
 */
function quietLine(overall: number, grade: TGrade): string {
  const paint = scoreColor(overall)
  return `${paint(c.bold(String(overall)))}${c.dim('/100')} ${paint(grade)}`
}

/**
 * Formats the quiet-mode Smart Agent score suffix.
 *
 * @param {(ISmartAgentReport | null)} report - The Smart Agent report, or null if unavailable.
 * @param {(string | null)} error - Error message if Smart Agent failed, or null if successful.
 * @returns {string} - Formatted Smart Agent suffix for quiet mode (empty string if N/A).
 */
function smartQuiet(
  report: ISmartAgentReport | ISmartAgentSiteReport | null,
  error: string | null,
): string {
  if (report !== null) {
    const paint = scoreColor(report.overall)
    return ` ${c.dim('· Smart')} ${paint(c.bold(String(report.overall)))}${c.dim('/100')}`
  }
  return error !== null ? ` ${c.dim('· Smart unavailable')}` : ''
}

/**
 * Formats the Smart Agent report as Markdown.
 *
 * @param {(ISmartAgentReport | null)} report - The Smart Agent report, or null if unavailable.
 * @param {(string | null)} error - Error message if Smart Agent failed, or null if successful.
 * @returns {string} - Formatted Markdown section (empty string if N/A).
 */
function smartMarkdown(report: ISmartAgentReport | null, error: string | null): string {
  if (report === null) {
    return error === null
      ? ''
      : `\n\n## Smart Agent Readability\n\nUnavailable: ${shortError(error)}\n`
  }
  const findings = report.signals.filter((signal) => signal.status !== 'pass')
  const lines = [
    '',
    '',
    '## Smart Agent Readability',
    '',
    `**${report.overall}/100 — ${report.grade.toUpperCase()}**`,
    '',
    ...report.categories.map((category) => `- ${category.label}: ${category.score}/100`),
    '',
    '### Smart Agent findings',
    '',
    ...(findings.length === 0
      ? ['- No browser-agent readability issues detected.']
      : findings.map(
          (finding) =>
            `- **${finding.title}**: ${finding.detail}${finding.fix !== undefined ? ` Fix: ${finding.fix}` : ''}`,
        )),
    '',
    'Powered by [agent-browser](https://agent-browser.dev), an open-source Vercel Labs project.',
  ]
  return lines.join('\n')
}

/**
 * Truncates and normalizes an error message for display.
 *
 * @param {string} error - The error message to truncate.
 * @returns {string} - Normalized error message (max ~220 chars, whitespace collapsed).
 */
function shortError(error: string): string {
  return error.replace(/\s+/g, ' ').slice(0, 220)
}

// MARK: - Spinners

/**
 * Unified interface for progress spinner that works in both fancy (clack) and
 * plain (TTY fallback) modes.
 *
 * @interface ISpinner
 * @typedef {ISpinner}
 */
interface ISpinner {
  /** Update the current spinner message. */
  tick(message: string): void
  /** Finalize the current phase with a ◇ ✓ milestone, then open the next one. */
  phase(message: string): void
  /** Open a fresh phase after a stop, e.g. to resume spinning past a printed section. */
  open(message: string): void
  /** Finalize the last phase with a ◇ ✓ milestone. */
  stop(message: string): void
  /** Finalize with a ✗ failure marker. */
  fail(message: string): void
}

/**
 * Creates a fancy progress spinner using clack/prompts for interactive (TTY) mode.
 *
 * @param {string} url - The URL being scanned, displayed in the intro.
 * @returns {ISpinner} - A spinner instance.
 */
function createClackSpinner(url: string): ISpinner {
  clack.intro(`${c.accent('◆')} ${c.bold('isready')} ${c.dim(`v${VERSION}`)}`)
  clack.log.step(`Scanning ${c.bold(url)}`)
  let s = clack.spinner()
  s.start(`Scanning ${url}`)
  return {
    tick(message: string): void {
      s.message(message)
    },
    phase(message: string): void {
      s.stop(`${c.green('✓')} ${message}`)
      s = clack.spinner()
      s.start('Working…')
    },
    open(message: string): void {
      s = clack.spinner()
      s.start(message)
    },
    stop(message: string): void {
      s.stop(`${c.green('✓')} ${message}`)
    },
    fail(message: string): void {
      s.stop(`${c.red('✗')} ${message}`)
      clack.outro(c.dim('https://isready.ai'))
    },
  }
}

/**
 * Creates a plain-text progress spinner for non-interactive mode (fallback when clack unavailable).
 *
 * @returns {ISpinner} - A spinner instance.
 */
function createSpinner(): ISpinner {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const isTty = process.stderr.isTTY === true
  let i = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let current = 'Starting'

  const draw = (): void => {
    const frame = frames[i % frames.length] ?? frames[0]
    process.stderr.write(`\r${c.accent(frame ?? '·')} ${c.dim(current)}${c.eraseLine}`)
    i += 1
  }

  if (isTty) {
    timer = setInterval(draw, 80)
  }

  return {
    tick(message: string): void {
      current = message
      if (!isTty) {
        process.stderr.write(`${c.dim('·')} ${c.dim(message)}\n`)
      }
    },
    phase(message: string): void {
      if (isTty) {
        process.stderr.write(`\r${c.eraseLine}`)
      }
      process.stderr.write(`${c.green('✓')} ${message}\n`)
    },
    open(message: string): void {
      current = message
      if (isTty) {
        if (timer !== undefined) {
          clearInterval(timer)
        }
        i = 0
        timer = setInterval(draw, 80)
      } else {
        process.stderr.write(`${c.dim('·')} ${c.dim(message)}\n`)
      }
    },
    stop(message: string): void {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
      if (isTty) {
        process.stderr.write(`\r${c.eraseLine}`)
      }
      process.stderr.write(`${c.green('✓')} ${message}\n`)
    },
    fail(message: string): void {
      if (timer !== undefined) {
        clearInterval(timer)
      }
      if (isTty) {
        process.stderr.write(`\r${c.eraseLine}`)
      }
      process.stderr.write(`${c.red('✗')} ${message}\n`)
    },
  }
}

// MARK: - Help & usage

/**
 * Generates the CLI help text.
 *
 * @returns {string} - Formatted help message with usage, options, and examples.
 */
function helpText(): string {
  const b = c.bold

  return [
    `${c.accent('◆')} ${b('isready')} ${c.dim(`v${VERSION}`)}`,
    c.dim('Check if your website is ready for AI — LLM crawlability & AI-SEO audit.'),
    '',
    `${b('USAGE')}`,
    `  isreadyai <url> [options]`,
    '',
    `${b('OPTIONS')}`,
    `  --json        Print the raw report JSON plus readiness summary (no decoration)`,
    `  --md          Print the report as human-readable Markdown`,
    `  --llm         Print an AI-agent fix plan (paste into Claude Code/Cursor)`,
    `  --quiet, -q   Print only the final score line`,
    `  --deep        Crawl the site too: sitemap + links, page checks on each page`,
    `  --smart-ai    Add Smart Agent Readability using local agent-browser`,
    `  --limit <n>   Max pages for --deep (default: unlimited)`,
    `  --skip <n>    Skip the first n discovered pages (with --deep)`,
    `  --help, -h    Show this help`,
    `  --version, -v Show the version`,
    '',
    `${b('EXAMPLES')}`,
    `  ${c.dim('$')} isreadyai example.com`,
    `  ${c.dim('$')} isreadyai https://example.com --json | jq .readiness.overall`,
    `  ${c.dim('$')} isreadyai example.com --quiet`,
    `  ${c.dim('$')} isreadyai example.com --smart-ai`,
    '',
    c.dim('Exit code: 0 when score >= 50, 1 when below or scan failed, 2 on misuse.'),
    c.dim('https://isready.ai'),
    '',
  ].join('\n')
}
