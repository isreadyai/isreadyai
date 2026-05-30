import type { IScanReport } from './types.ts'
import type { TAiCrawlerVerdict } from './crawlers.ts'
import { reportToMarkdown } from './markdown.ts'
import { hostOf } from './util/url.ts'

// MARK: - Fix-plan generation (v1: deterministic patches)

/**
 * Powers POST /api/fix. v1 emits whole-file patches for findings with a
 * mechanical fix (robots.txt allow-groups, llms.txt scaffold) and always
 * appends the markdown plan for everything else.
 */

export interface IFixFile {
  /** Repo-relative path, e.g. "public/robots.txt". */
  path: string
  content: string
}

export interface IFixContext {
  robots?: IFixFile
  llms?: IFixFile
}

export interface IFixPatch extends IFixFile {
  reason: string
  checkId: string
}

export interface IFixPlan {
  patches: IFixPatch[]
  markdown: string
}

type TCrawlerEvidence = Pick<TAiCrawlerVerdict, 'token' | 'purpose' | 'blocked'>

// MARK: - Methods

export function buildFixPlan(report: IScanReport, context: IFixContext): IFixPlan {
  const patches: IFixPatch[] = []

  const robotsPatch = robotsAllowPatch(report, context.robots)
  if (robotsPatch !== null) {
    patches.push(robotsPatch)
  }

  const llmsPatch = llmsTxtPatch(report, context.llms)
  if (llmsPatch !== null) {
    patches.push(llmsPatch)
  }

  return { patches, markdown: reportToMarkdown(report, 'llm') }
}

// MARK: - robots.txt

/**
 * Appends Allow groups for blocked AI *answer* crawlers (search/user purpose).
 * Training-only blocks are a policy choice — never auto-reverted. Patches only
 * when the repo has a robots file; if it's served from host/CDN config, a repo
 * file fixes nothing and the finding stays in the markdown plan.
 */
function robotsAllowPatch(report: IScanReport, robots: IFixFile | undefined): IFixPatch | null {
  if (robots === undefined) {
    return null
  }
  const check = report.checks.find((c) => c.id === 'crawler.robots.ai-bots')
  if (check === undefined || check.status !== 'fail') {
    return null
  }
  const crawlers = (check.evidence?.crawlers ?? []) as TCrawlerEvidence[]
  const blocked = crawlers.filter(
    (c) => c.blocked && (c.purpose === 'search' || c.purpose === 'user'),
  )
  if (blocked.length === 0) {
    return null
  }

  const groups = blocked.map((c) => `User-agent: ${c.token}\nAllow: /`).join('\n\n')
  const content = `${robots.content.trimEnd()}\n\n# AI answer crawlers — explicit allow (added by isready.ai)\n# Specific user-agent groups take precedence over * groups (RFC 9309).\n${groups}\n`

  return {
    path: robots.path,
    content,
    reason: `Unblocks ${blocked.map((c) => c.token).join(', ')} — these power live AI answers, not training.`,
    checkId: check.id,
  }
}

// MARK: - llms.txt

function llmsTxtPatch(report: IScanReport, llms: IFixFile | undefined): IFixPatch | null {
  const check = report.checks.find((c) => c.id === 'llms-txt.present')
  const present = check?.evidence?.present === true
  if (check === undefined || present || llms !== undefined) {
    return null
  }
  const host = hostOf(report.finalUrl)
  const content = `# ${host}

> Optional index for LLM-based tools. Major AI crawlers do not consume this
> file today; it helps IDE agents and dev tools discover your key pages.

## Pages

- [Home](https://${host}/): start here
`

  return {
    path: 'public/llms.txt',
    content,
    reason: 'Adds an optional llms.txt scaffold (informational signal — never affects your score).',
    checkId: check.id,
  }
}
