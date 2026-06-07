import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// MARK: - action.yml structure (composite; actionlint can't lint these)
//
// String-level guards on the two composite actions. They lock in the new
// preflight + upload wiring and the single-source invariant (both actions run
// the SAME apps/cli/src/ci-upload.ts — no duplicated upload logic).

const fixYaml = readFileSync(join(import.meta.dir, 'action.yml'), 'utf8')
const auditYaml = readFileSync(join(import.meta.dir, '..', 'action.yml'), 'utf8')

describe('fix-action/action.yml', () => {
  test('preflights pull-request capability with a side-effect-free probe (Gate 2)', () => {
    expect(fixYaml).toContain('name: Preflight — pull-request & upload capability')
    // Gate 2 — the "Allow GitHub Actions to create and approve pull requests" setting
    // is the only authoritative, side-effect-free PR gate (fails only on explicit false).
    expect(fixYaml).toContain('can_approve_pull_request_reviews')
  })

  test('does NOT gate on repos.permissions.push (documented GITHUB_TOKEN false positive, 2026-07-06)', () => {
    // repos/{repo}.permissions.push is a legacy repository-ROLE boolean that reads
    // `false` for the GITHUB_TOKEN even when contents: write IS granted — a real run on
    // massimodeluisa/de-luisa-bio (2026-07-06) proved it hard-failed a correct job. The
    // preflight must not probe or fail on it; push access is proven by attempting the
    // push at the PR step (attempt-and-interpret), which surfaces the real 403.
    const preflight = fixYaml.slice(
      fixYaml.indexOf('name: Preflight — pull-request & upload capability'),
      fixYaml.indexOf('name: Scan'),
    )
    // No push probe/assignment → there is nothing to hard-fail on (the endpoint is
    // still named in a comment explaining WHY it is not gated on — that's fine).
    expect(preflight).not.toContain('PUSH=')
    // The demotion and its real-run evidence are documented in-code.
    expect(preflight).toContain('DEMOTED')
    expect(preflight).toContain('2026-07-06')
    // Gate 2 remains the only authoritative, side-effect-free PR gate.
    expect(preflight).toContain('can_approve_pull_request_reviews')
  })

  test('preflight flags a missing id-token (upload capability), skipped only for the PR part on dry-run', () => {
    expect(fixYaml).toContain('ACTIONS_ID_TOKEN_REQUEST_URL')
    // The dry-run guard sits INSIDE the run (only the PR probe is skipped), so the
    // upload/id-token check still runs on dry-run — rather than a step-level `if:`
    // that would skip the whole preflight, upload check included.
    expect(fixYaml).toContain('if [ "${DRY_RUN:-false}" = "true" ]')
  })

  test('uploads the scan via the shared ci-upload.ts, best-effort, before the solve', () => {
    expect(fixYaml).toContain('name: Upload CI report')
    expect(fixYaml).toContain('bun apps/cli/src/ci-upload.ts || true')
    expect(fixYaml).toContain('GH_REPOSITORY_ID:')
    const uploadAt = fixYaml.indexOf('name: Upload CI report')
    const scanAt = fixYaml.indexOf('name: Scan')
    const solveAt = fixYaml.indexOf('name: Solve')
    expect(scanAt).toBeGreaterThan(-1)
    expect(uploadAt).toBeGreaterThan(scanAt)
    expect(uploadAt).toBeLessThan(solveAt)
  })

  test('preflight runs before the metered solve token is minted', () => {
    const preflightAt = fixYaml.indexOf('name: Preflight')
    const solveAt = fixYaml.indexOf('name: Solve')
    expect(preflightAt).toBeGreaterThan(-1)
    expect(preflightAt).toBeLessThan(solveAt)
  })
})

describe('action.yml (audit)', () => {
  test('preflights the upload before the scan when a key is set', () => {
    expect(auditYaml).toContain('name: Preflight — CI report upload')
    expect(auditYaml).toContain("if: inputs.api-key != '' && inputs.report != 'false'")
    expect(auditYaml).toContain('ACTIONS_ID_TOKEN_REQUEST_URL')
    expect(auditYaml).toContain('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    const preflightAt = auditYaml.indexOf('name: Preflight — CI report upload')
    const scanAt = auditYaml.indexOf('name: Scan')
    expect(preflightAt).toBeGreaterThan(-1)
    expect(preflightAt).toBeLessThan(scanAt)
  })
})

describe('single-source upload', () => {
  test('both actions run the same ci-upload.ts (no duplicated logic)', () => {
    expect(fixYaml).toContain('apps/cli/src/ci-upload.ts')
    expect(auditYaml).toContain('apps/cli/src/ci-upload.ts')
  })
})
