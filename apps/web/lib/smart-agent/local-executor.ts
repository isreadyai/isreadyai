import { spawn } from 'node:child_process'
import type { ICommandResult, ISmartAgentCommandExecutor } from '@isreadyai/scanner'

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
    // agent-browser reads AGENT_BROWSER_PROVIDER too and only accepts cloud
    // providers (browserbase, kernel, …). Our 'local' value selects this local
    // executor, so strip it from the child env or the binary rejects it.
    const childEnv = { ...process.env }
    delete childEnv.AGENT_BROWSER_PROVIDER
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
