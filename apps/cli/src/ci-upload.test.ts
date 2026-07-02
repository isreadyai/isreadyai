import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// MARK: - ci-upload exit semantics (shared by the audit + fix actions)
//
// The upload is best-effort for TRANSIENT problems (no OIDC, network, 5xx) but
// must fail LOUDLY on a deterministic user misconfiguration (invalid key), so a
// broken config can't silently drop every CI report. These tests spawn the real
// script against a local mock API + OIDC endpoint and assert the exit code.

const CI_UPLOAD = join(import.meta.dir, 'ci-upload.ts')

let workdir: string
let reportPath: string
let outputPath: string
let ciReportStatus = 200
let ciReportBody: unknown = null
let server: ReturnType<typeof Bun.serve>
let origin = ''

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'isready-ci-upload-'))
  reportPath = join(workdir, 'report.json')
  outputPath = join(workdir, 'output.txt')
  writeFileSync(reportPath, JSON.stringify({ primary: { finalUrl: 'https://example.com' } }))
  writeFileSync(outputPath, '')

  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      // GitHub OIDC token endpoint — ci-upload appends `&audience=`.
      if (url.pathname === '/oidc') {
        return Response.json({ value: 'fake-oidc-jwt' })
      }
      if (url.pathname === '/api/ci-report') {
        const body =
          ciReportBody ??
          (ciReportStatus === 200
            ? {
                slug: 'gh_abc',
                branch: 'main',
                commit: 'deadbee',
                score: 90,
                grade: 'good',
                linkedWebsite: false,
                badgeUrl: `${origin}/badge`,
                reportUrl: `${origin}/report`,
                badgeMarkdown: `[![AI readiness](${origin}/badge)](${origin}/report)`,
              }
            : { error: 'mock_error' })
        return Response.json(body, { status: ciReportStatus })
      }
      return new Response('not found', { status: 404 })
    },
  })
  origin = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop(true)
  rmSync(workdir, { recursive: true, force: true })
})

interface IRunResult {
  code: number
  stdout: string
}

/** Runs ci-upload.ts with a clean env plus `overrides`, returns exit code + stdout. */
async function run(overrides: Record<string, string>, withOidc: boolean): Promise<IRunResult> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) {
      env[k] = v
    }
  }
  // Start from a known-clean slate so the host runner's own CI env can't leak in.
  delete env.ACTIONS_ID_TOKEN_REQUEST_URL
  delete env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  delete env.GITHUB_STEP_SUMMARY
  env.ISREADYAI_API_KEY = 'test-key'
  env.ISREADYAI_API_URL = origin
  env.REPORT_PATH = reportPath
  env.GH_REPOSITORY_ID = '123456'
  env.GH_REPOSITORY = 'owner/repo'
  env.GH_REF_NAME = 'main'
  env.GH_SHA = 'deadbee'
  env.GITHUB_OUTPUT = outputPath
  if (withOidc) {
    env.ACTIONS_ID_TOKEN_REQUEST_URL = `${origin}/oidc?rand=1`
    env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'req-token'
  }
  Object.assign(env, overrides)

  const proc = Bun.spawn(['bun', CI_UPLOAD], { env, stdout: 'pipe', stderr: 'pipe' })
  const stdout = await new Response(proc.stdout).text()
  const code = await proc.exited
  return { code, stdout }
}

describe('ci-upload exit semantics', () => {
  test('missing OIDC token → non-fatal warning, exit 0', async () => {
    const { code, stdout } = await run({}, false)
    expect(code).toBe(0)
    expect(stdout).toContain('::warning::')
    expect(stdout).toContain('no GitHub OIDC token')
  })

  test('invalid API key (401) → actionable error, exit 1', async () => {
    ciReportStatus = 401
    ciReportBody = { error: 'invalid_api_key' }
    const { code, stdout } = await run({}, true)
    expect(code).toBe(1)
    expect(stdout).toContain('::error::')
    expect(stdout).toContain('invalid or revoked')
  })

  test('repo ownership not verified (403) → actionable error, exit 1', async () => {
    ciReportStatus = 403
    ciReportBody = { error: 'repo_ownership_not_verified' }
    const { code, stdout } = await run({}, true)
    expect(code).toBe(1)
    expect(stdout).toContain('::error::')
    expect(stdout).toContain('id-token: write')
  })

  test('premium required (403) → non-fatal warning, exit 0', async () => {
    ciReportStatus = 403
    ciReportBody = { error: 'premium_required' }
    const { code, stdout } = await run({}, true)
    expect(code).toBe(0)
    expect(stdout).toContain('::warning::')
    expect(stdout).toContain('Pro or Team plan')
  })

  test('server error (500) → non-fatal warning, exit 0', async () => {
    ciReportStatus = 500
    ciReportBody = { error: 'boom' }
    const { code, stdout } = await run({}, true)
    expect(code).toBe(0)
    expect(stdout).toContain('::warning::')
    expect(stdout).toContain('transient')
  })

  test('happy path (200) → uploads, exit 0', async () => {
    ciReportStatus = 200
    ciReportBody = null
    const { code, stdout } = await run({}, true)
    expect(code).toBe(0)
    expect(stdout).toContain('isready CI report uploaded')
  })
})
