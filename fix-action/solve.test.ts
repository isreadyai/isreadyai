import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  compactFindings,
  emergencyTranscript,
  type IMessage,
  listFilesResult,
  main,
  MAX_FILE_BYTES,
  MAX_FINDINGS_BYTES,
  MAX_REQUEST_BYTES,
  pruneMessagesToBudget,
  requestBytes,
} from './solve.ts'

// MARK: - Shared shape for asserting on the compact findings payload

interface ICompactFinding {
  status: string
  impact?: string
  title?: string
  detail?: string
  fix?: string
}
interface ICompactPayload {
  site: string
  score?: number
  grade?: string
  findings: ICompactFinding[]
  truncated?: number
}

// MARK: - Bug 413 fixtures — a synthetic, artificially inflated transcript

/** One assistant tool-call + its (oversized) tool result, wired with a matching tool_call_id. */
function toolExchange(
  id: string,
  name: string,
  path: string,
  contentSize: number,
): { assistant: IMessage; tool: IMessage } {
  return {
    assistant: {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id, type: 'function', function: { name, arguments: JSON.stringify({ path }) } },
      ],
    },
    tool: { role: 'tool', tool_call_id: id, content: 'x'.repeat(contentSize) },
  }
}

/** A transcript inflated well past 300KB: system + user + N large read_file/tool round trips. */
function inflatedTranscript(rounds: number, sizePerRound: number): IMessage[] {
  const messages: IMessage[] = [
    { role: 'system', content: 'You are the isready.ai fix agent.' },
    { role: 'user', content: 'Scan findings (JSON, truncated):\n{}' },
  ]
  for (let i = 0; i < rounds; i++) {
    const { assistant, tool } = toolExchange(
      `call-${i}`,
      'read_file',
      `big-file-${i}.txt`,
      sizePerRound,
    )
    messages.push(assistant, tool)
  }
  return messages
}

// MARK: - Caps (bug 413 — verifies the actual constant values, not just behavior)

describe('size caps', () => {
  test('MAX_FILE_BYTES was tightened from the historical 64_000 to 24_000', () => {
    expect(MAX_FILE_BYTES).toBe(24_000)
  })

  test('MAX_FINDINGS_BYTES is well under the historical 24_000 cap', () => {
    expect(MAX_FINDINGS_BYTES).toBeLessThan(24_000)
  })

  test('MAX_REQUEST_BYTES leaves headroom under the server 100_000-byte cap', () => {
    expect(MAX_REQUEST_BYTES).toBeLessThan(100_000)
    expect(MAX_REQUEST_BYTES).toBeGreaterThan(50_000)
  })
})

// MARK: - list_files JSON cap

describe('listFilesResult', () => {
  test('caps the serialized listing and never throws on an empty/missing dir', () => {
    const out = listFilesResult('')
    expect(out.length).toBeGreaterThan(0)
    expect(() => JSON.parse(out)).not.toThrow()
  })
})

// MARK: - list_files hides generated artifacts (deny-list, listing side)

describe('listFilesResult — generated artifacts filtered', () => {
  // A throwaway subdir inside the workspace root (listFiles resolves against
  // process.cwd()), so we can list a directory whose contents we fully control.
  const dir = mkdtempSync(join(process.cwd(), 'isready-genlist-'))
  const name = basename(dir)
  writeFileSync(join(dir, 'index.html'), '<html></html>')
  writeFileSync(join(dir, 'bun.lock'), 'lockfile')
  writeFileSync(join(dir, 'app.min.js'), 'x')
  writeFileSync(join(dir, 'bundle.js.map'), '{}')

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('lists ordinary files but hides lockfiles, minified bundles and source maps', () => {
    const out = JSON.parse(listFilesResult(name)) as { files: string[] }
    expect(out.files.some((f) => f.endsWith('index.html'))).toBe(true)
    expect(out.files.some((f) => f.endsWith('bun.lock'))).toBe(false)
    expect(out.files.some((f) => f.endsWith('app.min.js'))).toBe(false)
    expect(out.files.some((f) => f.endsWith('bundle.js.map'))).toBe(false)
  })
})

// MARK: - compactFindings — the model findings payload (consumes scanner output)

describe('compactFindings', () => {
  const report = {
    url: 'https://deluisa.bio',
    overall: 85,
    grade: 'good',
    primary: {
      checks: [
        {
          id: 'trust.hsts',
          status: 'warn',
          title: 'Strict-Transport-Security header is present',
          detail: 'No Strict-Transport-Security header.',
          fix: 'Add a Strict-Transport-Security header (e.g. max-age=31536000).',
          impact: 'low',
          evidence: { present: false },
        },
        { id: 'trust.https', status: 'pass', title: 'HTTPS is enforced', detail: 'ok' },
        {
          id: 'llms-txt.present',
          status: 'info',
          title: 'llms.txt presence (informational)',
          detail: 'llms.txt present — consumed by some dev tools.',
        },
      ],
    },
  }

  test('projects only the scanner fields, drops pass checks, invents nothing', () => {
    const out = JSON.parse(compactFindings(report)) as ICompactPayload
    expect(out.site).toBe('deluisa.bio')
    expect(out.score).toBe(85)
    expect(out.grade).toBe('good')
    // warn + info are non-pass; the pass check is excluded.
    expect(out.findings).toHaveLength(2)
    expect(out.findings[0]).toEqual({
      status: 'warn',
      impact: 'low',
      title: 'Strict-Transport-Security header is present',
      detail: 'No Strict-Transport-Security header.',
      fix: 'Add a Strict-Transport-Security header (e.g. max-age=31536000).',
    })
    // Fields are copied verbatim from the report — no evidence/score/weight leak,
    // and no re-derived semantics.
    expect(compactFindings(report)).not.toContain('evidence')
    expect(compactFindings(report)).not.toContain('HTTPS is enforced')
  })

  test('stays valid JSON within MAX_FINDINGS_BYTES, dropping whole findings when needed', () => {
    const many = {
      primary: {
        checks: Array.from({ length: 200 }, (_, i) => ({
          status: 'warn',
          title: `check ${i}`,
          detail: 'd'.repeat(300),
          fix: 'f'.repeat(300),
        })),
      },
    }
    const out = compactFindings(many)
    expect(out.length).toBeLessThanOrEqual(MAX_FINDINGS_BYTES)
    const parsed = JSON.parse(out) as ICompactPayload
    expect(parsed.truncated).toBeGreaterThan(0)
    expect(parsed.findings.length).toBeGreaterThan(0)
  })

  test('never throws on a minimal/unknown report', () => {
    expect(() => JSON.parse(compactFindings({}))).not.toThrow()
    expect(() => JSON.parse(compactFindings(null))).not.toThrow()
  })

  test('falls back to a flat top-level checks array (non-deep report)', () => {
    const flat = {
      url: 'https://x.test',
      checks: [{ status: 'fail', detail: 'boom', fix: 'do it' }],
    }
    const out = JSON.parse(compactFindings(flat)) as ICompactPayload
    expect(out.findings).toHaveLength(1)
    expect(out.findings[0]?.detail).toBe('boom')
    expect(out.findings[0]?.fix).toBe('do it')
  })
})

// MARK: - pruneMessagesToBudget — the core 413 fix

describe('pruneMessagesToBudget', () => {
  test('prunes a >300KB transcript so every subsequent request stays under MAX_REQUEST_BYTES', () => {
    const messages = inflatedTranscript(20, 20_000) // 20 * 20_000 = 400_000 chars of tool content alone
    const before = requestBytes(messages)
    expect(before).toBeGreaterThan(300_000)

    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)
    const after = requestBytes(messages)

    console.log(
      `isready solve test: pruned ${before} bytes -> ${after} bytes (budget ${MAX_REQUEST_BYTES})`,
    )
    expect(after).toBeLessThanOrEqual(MAX_REQUEST_BYTES)
  })

  test('never prunes the system message', () => {
    const messages = inflatedTranscript(20, 20_000)
    const systemContent = messages[0]?.content

    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)

    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toBe(systemContent)
  })

  test('never prunes the most recent assistant/tool exchange', () => {
    const messages = inflatedTranscript(20, 20_000)
    const lastTool = messages[messages.length - 1]
    const lastToolOriginalLength = lastTool?.content?.length

    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)

    const lastToolAfter = messages[messages.length - 1]
    expect(lastToolAfter?.role).toBe('tool')
    expect(lastToolAfter?.content?.length).toBe(lastToolOriginalLength)
    expect(lastToolAfter?.content?.startsWith('[pruned:')).toBe(false)
  })

  test('prunes oldest tool results first — a deterministic prefix, no gaps', () => {
    const messages = inflatedTranscript(20, 20_000)
    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)

    const prunedFlags = messages
      .filter((message) => message.role === 'tool')
      .map((message) => message.content?.startsWith('[pruned:') ?? false)

    const firstUnprunedIndex = prunedFlags.indexOf(false)
    if (firstUnprunedIndex !== -1) {
      expect(prunedFlags.slice(firstUnprunedIndex).every((pruned) => !pruned)).toBe(true)
    }
  })

  test('placeholder names the tool and path', () => {
    const messages = inflatedTranscript(20, 20_000)
    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)

    const prunedTool = messages.find(
      (message) => message.role === 'tool' && message.content?.startsWith('[pruned:'),
    )
    expect(prunedTool?.content).toMatch(/^\[pruned: read_file big-file-\d+\.txt, \d+ chars\]$/)
  })

  test('is deterministic — pruning an already-pruned transcript again is a no-op', () => {
    const messages = inflatedTranscript(20, 20_000)
    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)
    const snapshot = JSON.stringify(messages)

    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)

    expect(JSON.stringify(messages)).toBe(snapshot)
  })

  test('is a no-op when already under budget', () => {
    const messages = inflatedTranscript(1, 100)
    const before = JSON.stringify(messages)

    pruneMessagesToBudget(messages, MAX_REQUEST_BYTES)

    expect(JSON.stringify(messages)).toBe(before)
  })
})

// MARK: - emergencyTranscript — the single retry payload after a 413

describe('emergencyTranscript', () => {
  test('keeps the system message, restates truncated findings, and prunes only the last tool result', () => {
    const system: IMessage = { role: 'system', content: 'SYSTEM PROMPT' }
    const messages: IMessage[] = [system, { role: 'user', content: 'ignored on retry' }]
    const { assistant, tool } = toolExchange('call-x', 'read_file', 'huge-lockfile.txt', 50_000)
    messages.push(assistant, tool)
    const findings = 'F'.repeat(10_000)

    const transcript = emergencyTranscript(system, messages, findings)

    expect(transcript[0]).toBe(system)
    expect(transcript[1]?.role).toBe('user')
    expect(transcript[1]?.content?.length).toBeLessThan(findings.length)
    expect(transcript[2]).toBe(assistant)
    expect(transcript[3]?.content).toContain('[pruned: read_file huge-lockfile.txt')
    expect(requestBytes(transcript)).toBeLessThan(requestBytes(messages))
  })

  test('falls back to just system + findings when there is no prior tool exchange', () => {
    const system: IMessage = { role: 'system', content: 'SYSTEM PROMPT' }
    const messages: IMessage[] = [system, { role: 'user', content: 'first turn' }]

    const transcript = emergencyTranscript(system, messages, 'findings')

    expect(transcript).toHaveLength(2)
    expect(transcript[0]).toBe(system)
  })
})

// MARK: - main() — retries exactly once on a 413, then fails actionably if it recurs

describe('main() 413 handling', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'isready-solve-test-'))
  const reportPath = join(tmpDir, 'report.json')
  writeFileSync(
    reportPath,
    JSON.stringify({ overall: 90, grade: 'good', url: 'https://example.test' }),
  )

  const savedEnv = {
    SOLVE_TOKEN: process.env.SOLVE_TOKEN,
    SOLVE_BASE_URL: process.env.SOLVE_BASE_URL,
    REPORT_PATH: process.env.REPORT_PATH,
    SOLVE_MODEL: process.env.SOLVE_MODEL,
    FIX_DIR: process.env.FIX_DIR,
    GITHUB_OUTPUT: process.env.GITHUB_OUTPUT,
    GITHUB_STEP_SUMMARY: process.env.GITHUB_STEP_SUMMARY,
  }
  const savedFetch = global.fetch
  const savedExit = process.exit

  function restoreEnv(): void {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    global.fetch = savedFetch
    process.exit = savedExit
  }

  afterAll(() => {
    restoreEnv()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('retries exactly once with an emergency-pruned transcript, then succeeds', async () => {
    process.env.SOLVE_TOKEN = 'test-token'
    process.env.SOLVE_BASE_URL = 'https://example.test/api/solve-inference'
    process.env.REPORT_PATH = reportPath
    delete process.env.SOLVE_MODEL
    delete process.env.FIX_DIR
    delete process.env.GITHUB_OUTPUT
    delete process.env.GITHUB_STEP_SUMMARY

    // Guard against fail()'s process.exit(1) killing the whole test run if this
    // scenario ever regresses to an unexpected failure path — turn it into a
    // normal (catchable) test failure instead.
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code}) called`)
    }) as typeof process.exit

    let callCount = 0
    const requestBodies: string[] = []
    global.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
      callCount++
      requestBodies.push(String(init?.body ?? ''))
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ error: 'request_too_large', max_bytes: 100_000, got_bytes: 150_000 }),
          { status: 413 },
        )
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'done', tool_calls: [] } }],
        }),
        { status: 200 },
      )
    }) as typeof fetch

    try {
      await main()
    } finally {
      restoreEnv()
    }

    expect(callCount).toBe(2)
    expect(requestBodies).toHaveLength(2)
  })

  test('fails actionably (citing the cap) when the retry also 413s', async () => {
    process.env.SOLVE_TOKEN = 'test-token'
    process.env.SOLVE_BASE_URL = 'https://example.test/api/solve-inference'
    process.env.REPORT_PATH = reportPath
    delete process.env.SOLVE_MODEL
    delete process.env.FIX_DIR
    delete process.env.GITHUB_OUTPUT
    delete process.env.GITHUB_STEP_SUMMARY

    let callCount = 0
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code}) called`)
    }) as typeof process.exit
    global.fetch = (async (_input: unknown, _init?: { body?: unknown }) => {
      callCount++
      return new Response(
        JSON.stringify({ error: 'request_too_large', max_bytes: 100_000, got_bytes: 150_000 }),
        { status: 413 },
      )
    }) as typeof fetch

    try {
      await expect(main()).rejects.toThrow('process.exit(1) called')
    } finally {
      restoreEnv()
    }

    // Exactly one retry: the original request plus the single emergency retry.
    expect(callCount).toBe(2)
  })
})
