import { describe, expect, test } from 'bun:test'
import { CI_WORKFLOW_SNIPPETS, ECiWorkflowAction, ciWorkflowYaml } from '@/lib/ci-workflow-snippets'

// MARK: - CI workflow snippets
//
// The snippets are the single source shown on the marketing card and the
// dashboard CI empty state. Both actions upload an authenticated report, which
// needs `id-token: write`; the fix action additionally opens a PR. These tests
// lock in the permissions block so a snippet can never drift from what the
// action.yml actually requires.

describe('ciWorkflowYaml', () => {
  test('clipboard text is exactly the joined token text (no drift)', () => {
    for (const snippet of Object.values(CI_WORKFLOW_SNIPPETS)) {
      const derived = snippet.lines.map((line) => line.map((t) => t.text).join('')).join('\n')
      expect(ciWorkflowYaml(snippet)).toBe(derived)
    }
  })
})

describe('audit snippet', () => {
  const yaml = ciWorkflowYaml(CI_WORKFLOW_SNIPPETS[ECiWorkflowAction.AUDIT])

  test('grants id-token: write for the authenticated upload', () => {
    expect(yaml).toContain('permissions:')
    expect(yaml).toContain('id-token: write')
  })

  test('uses the audit action with a url and an optional api-key', () => {
    expect(yaml).toContain('isreadyai/audit-action@v1')
    expect(yaml).toContain('url:')
    expect(yaml).toContain('api-key:')
  })
})

describe('fix snippet', () => {
  const yaml = ciWorkflowYaml(CI_WORKFLOW_SNIPPETS[ECiWorkflowAction.FIX])

  test('grants all three permissions the fix action needs (PR + upload)', () => {
    expect(yaml).toContain('contents: write')
    expect(yaml).toContain('pull-requests: write')
    // id-token: write is what lets the fix action also upload the CI report.
    expect(yaml).toContain('id-token: write')
  })

  test('checks out the repo before running the fix action with an api-key', () => {
    expect(yaml).toContain('actions/checkout')
    expect(yaml).toContain('isreadyai/fix-action@v1')
    expect(yaml).toContain('api-key:')
  })
})
