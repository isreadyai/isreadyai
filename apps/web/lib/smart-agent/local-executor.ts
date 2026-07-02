import { spawn } from 'node:child_process'
import type { ICommandResult, ISmartAgentCommandExecutor } from '@isreadyai/scanner'

// Least privilege: agent-browser renders untrusted pages, so the child must NOT
// inherit the server's secrets (Supabase, Stripe, gateway keys). Pass only what a
// headless browser needs. AGENT_BROWSER_PROVIDER is dropped so the binary stays local.
const ALLOWED_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'NODE_ENV',
  'DISPLAY',
  'XAUTHORITY',
  'XDG_RUNTIME_DIR',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
])
const ALLOWED_ENV_PREFIXES = ['AGENT_BROWSER_', 'PUPPETEER_', 'CHROME']

/** True when an env var may pass to the agent-browser child (i.e. not an app secret). */
export function isAllowedChildEnvKey(key: string): boolean {
  // AGENT_BROWSER_PROVIDER would override our local mode, so drop it despite the prefix.
  if (key === 'AGENT_BROWSER_PROVIDER') {
    return false
  }
  return ALLOWED_ENV_KEYS.has(key) || ALLOWED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))
}

const COMMAND_TIMEOUT_MS = 90_000
// A hard ceiling against a runaway child, NOT a content trim: agent-browser
// already bounds page content via --content-boundaries/--max-output. It must sit
// well above a real accessibility snapshot (heavy sites run 80–200 KB) — slicing
// one mid-stream would corrupt the JSON envelope the parser needs and fail the
// whole pass. 16 MB is far beyond any real snapshot yet still caps pathology.
const MAX_OUTPUT = 16_000_000

export class LocalAgentBrowserExecutor implements ISmartAgentCommandExecutor {
  readonly name = 'agent-browser local'
  private readonly executable = process.env.AGENT_BROWSER_EXECUTABLE ?? 'agent-browser'
  private readonly session = `isready-${crypto.randomUUID()}`

  run(args: string[]): Promise<ICommandResult> {
    const childEnv: NodeJS.ProcessEnv = { ...process.env }
    for (const key of Object.keys(childEnv)) {
      if (!isAllowedChildEnvKey(key)) {
        delete childEnv[key]
      }
    }
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.executable,
        ['--session', this.session, '--content-boundaries', '--max-output', '50000', ...args],
        {
          env: childEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      let stdout = ''
      let stderr = ''
      let settled = false
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        finish(() => reject(new Error(`agent-browser timed out after ${COMMAND_TIMEOUT_MS} ms`)))
      }, COMMAND_TIMEOUT_MS)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout = appendBounded(stdout, chunk.toString())
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = appendBounded(stderr, chunk.toString())
      })
      child.on('error', (error) => {
        finish(() => reject(error))
      })
      child.on('close', (exitCode) => {
        finish(() => resolve({ exitCode: exitCode ?? 1, stdout, stderr }))
      })

      function finish(action: () => void): void {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        action()
      }
    })
  }
}

function appendBounded(current: string, addition: string): string {
  if (current.length >= MAX_OUTPUT) {
    return current
  }
  return `${current}${addition}`.slice(0, MAX_OUTPUT)
}
