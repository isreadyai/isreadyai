#!/usr/bin/env bun
/**
 * Runs inside the audit action's "Upload CI report" step. Uploads the scan
 * report to isready.ai with the premium API key, then prints the branch-stable
 * repo badge snippet to the job summary and exposes it as action outputs.
 *
 * Upload failures are non-fatal: the threshold gate in the Scan step is the
 * source of truth for pass/fail. Zero dependencies — runs from a bare install.
 */

import { appendFileSync, readFileSync } from 'node:fs'

// MARK: - Types

/**
 * Response payload from the CI report API endpoint.
 *
 * @interface ICiResponse
 * @typedef {ICiResponse}
 * @export
 */
interface ICiResponse {
  /** Repository slug (owner/repo). */
  slug: string
  /** Git branch name. */
  branch: string
  /** Git commit hash. */
  commit: string
  /** Overall score, null if the website isn't linked. */
  score: number | null
  /** Grade letter, null if the website isn't linked. */
  grade: string | null
  /** Whether the repository is linked to a website. */
  linkedWebsite: boolean
  /** URL to the badge image. */
  badgeUrl: string
  /** URL to the full report on isready.ai. */
  reportUrl: string
  /** Markdown snippet for embedding the badge in a README. */
  badgeMarkdown: string
}

// MARK: - internal

/**
 * Writes a warning message to stdout in GitHub Actions format.
 *
 * @param {string} message - The warning message to display.
 */
function warn(message: string): void {
  console.log(`::warning::${message}`)
}

/**
 * Reads and validates a required environment variable.
 *
 * @param {string} name - The name of the environment variable to read.
 * @returns {(string | null)} - The environment variable value, or null if not set or empty.
 */
function requireEnv(name: string): string | null {
  const value = process.env[name]
  return value !== undefined && value.length > 0 ? value : null
}

/**
 * Mints a GitHub Actions OIDC token bound to `audience`, which proves to
 * isready.ai that this run executes inside its repository (defeating repo-badge
 * squatting). Returns null when the job lacks `permissions: id-token: write` — the
 * runner then omits the request env vars — or the mint request fails.
 *
 * @param {string} audience - The audience claim to request (the isready.ai API origin).
 * @returns {Promise<string | null>} The signed OIDC JWT, or null when unavailable.
 */
async function mintOidcToken(audience: string): Promise<string | null> {
  const requestUrl = requireEnv('ACTIONS_ID_TOKEN_REQUEST_URL')
  const requestToken = requireEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
  if (requestUrl === null || requestToken === null) {
    return null
  }
  const res = await fetch(`${requestUrl}&audience=${encodeURIComponent(audience)}`, {
    headers: { authorization: `Bearer ${requestToken}` },
  }).catch(() => null)
  if (res === null || !res.ok) {
    return null
  }
  const data = (await res.json().catch(() => null)) as { value?: string } | null
  return data?.value ?? null
}

/**
 * Sets a GitHub Actions output variable by writing to GITHUB_OUTPUT.
 *
 * @param {string} name - The name of the output variable.
 * @param {string} value - The value to set.
 */
function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT
  if (out !== undefined) {
    appendFileSync(out, `${name}=${value}\n`)
  }
}

const apiKey = requireEnv('ISREADYAI_API_KEY')
const reportPath = requireEnv('REPORT_PATH')
const repositoryId = requireEnv('GH_REPOSITORY_ID')
const ownerRepo = requireEnv('GH_REPOSITORY')
const branch = requireEnv('GH_REF_NAME') ?? 'main'
const commit = requireEnv('GH_SHA') ?? 'unknown'
const apiUrl = process.env.ISREADYAI_API_URL ?? 'https://isready.ai'

if (apiKey === null || reportPath === null || repositoryId === null || ownerRepo === null) {
  warn('isready CI upload skipped — missing api-key or GitHub context')
  process.exit(0)
}

const report: unknown = JSON.parse(readFileSync(reportPath, 'utf8'))
const url =
  (report as { finalUrl?: string; primary?: { finalUrl?: string } }).finalUrl ??
  (report as { primary?: { finalUrl?: string } }).primary?.finalUrl ??
  ''

const oidcToken = await mintOidcToken(apiUrl)
if (oidcToken === null) {
  warn(
    'isready CI upload skipped — no GitHub OIDC token. Grant the job `permissions: id-token: write` so isready.ai can verify repository ownership.',
  )
  process.exit(0)
}

const response = await fetch(`${apiUrl}/api/ci-report`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    'x-github-oidc': oidcToken,
  },
  body: JSON.stringify({ repositoryId, ownerRepo, branch, commit, url, report }),
}).catch(() => null)

if (response === null) {
  warn(`isready CI upload failed — could not reach ${apiUrl}`)
  process.exit(0)
}
if (response.status === 401) {
  warn('isready CI upload skipped — invalid API key')
  process.exit(0)
}
if (response.status === 403) {
  const code = await response
    .json()
    .then((body) => (body as { error?: string }).error)
    .catch(() => undefined)
  if (code === 'repo_ownership_not_verified') {
    warn(
      'isready CI upload skipped — repository ownership could not be verified. Ensure the job has `permissions: id-token: write`.',
    )
  } else {
    warn('isready CI upload skipped — the repo badge requires a Pro or Team plan')
  }
  process.exit(0)
}
if (!response.ok) {
  warn(`isready CI upload failed — HTTP ${response.status}`)
  process.exit(0)
}

const result = (await response.json()) as ICiResponse

setOutput('badge', result.badgeMarkdown)
setOutput('report-url', result.reportUrl)

const summary = process.env.GITHUB_STEP_SUMMARY
if (summary !== undefined) {
  const lines = [
    '',
    '## isready.ai — repo badge',
    '',
    `Branch \`${result.branch}\` · score ${result.score ?? 'n/a'}/100`,
    '',
    'Add this to your README (stable across repo renames):',
    '',
    '```markdown',
    result.badgeMarkdown,
    '```',
    '',
    `[View full report](${result.reportUrl})`,
    '',
  ]
  appendFileSync(summary, `${lines.join('\n')}\n`)
}

console.log(`isready CI report uploaded — ${result.reportUrl}`)
