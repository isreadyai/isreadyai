/**
 * Local CLI executor for Smart Agent (agent-browser) commands.
 *
 * Spawns the agent-browser binary as a child process and streams its output,
 * with timeouts and output size bounding to prevent runaway processes.
 */

import { spawn } from 'node:child_process'
import type { ICommandResult, ISmartAgentCommandExecutor } from '@isreadyai/scanner'

// MARK: - Constants

const COMMAND_TIMEOUT_MS = 90_000
// Hard ceiling against a runaway child, NOT a content trim: agent-browser
// already bounds page content via --content-boundaries/--max-output. Must sit
// well above a real accessibility snapshot (heavy sites run 80–200 KB) — slicing
// one mid-stream would corrupt the JSON envelope the parser needs. 16 MB is
// far beyond any real snapshot yet still caps pathology.
const MAX_OUTPUT = 16_000_000

// MARK: - Types

/**
 * Minimal local interface to avoid the ChildProcess type conflict that arises
 * when Bun's bundled @types/node and the project's @types/node are both loaded.
 *
 * @interface ISpawnHandle
 * @typedef {ISpawnHandle}
 */
interface ISpawnHandle {
  stdout: NodeJS.ReadableStream
  stderr: NodeJS.ReadableStream
  kill(signal: string): boolean
  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'close', listener: (code: number | null) => void): this
}

// MARK: - Class

/**
 * Local CLI executor that spawns the agent-browser binary to run Smart Agent commands.
 *
 * Implements ISmartAgentCommandExecutor for local agent-browser execution.
 * Handles process spawning, output streaming with size bounds, and timeout management.
 *
 * @class CliAgentBrowserExecutor
 * @typedef {CliAgentBrowserExecutor}
 * @implements {ISmartAgentCommandExecutor}
 * @export
 */
export class CliAgentBrowserExecutor implements ISmartAgentCommandExecutor {
  readonly name = 'agent-browser local'
  private readonly executable = process.env.AGENT_BROWSER_EXECUTABLE ?? 'agent-browser'
  private readonly session = `isready-${crypto.randomUUID()}`

  /**
   * Executes an agent-browser command with the given arguments.
   *
   * Spawns a child process, streams its output with size bounds and timeout enforcement,
   * and returns the exit code and captured stdout/stderr.
   *
   * @async
   * @param {string[]} args - Command arguments to pass to agent-browser.
   * @returns {Promise<ICommandResult>} - Promise resolving to the command result with exit code and output.
   */
  run(args: string[]): Promise<ICommandResult> {
    // agent-browser reads AGENT_BROWSER_PROVIDER and only accepts cloud providers
    // (browserbase, kernel, …). Our 'local' value selects this executor — strip
    // it from the child env so the binary doesn't reject it.
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
      ) as unknown as ISpawnHandle

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
      child.on('error', (error: Error) => {
        finish(() => reject(error))
      })
      child.on('close', (exitCode: number | null) => {
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

// MARK: - internal

/**
 * Appends a string to another, capping the total at MAX_OUTPUT bytes.
 *
 * Used to prevent runaway output accumulation from long-running child processes.
 *
 * @param {string} current - The current accumulated output.
 * @param {string} addition - The string to append.
 * @returns {string} - The combined string, capped at MAX_OUTPUT length.
 */
function appendBounded(current: string, addition: string): string {
  if (current.length >= MAX_OUTPUT) {
    return current
  }
  return `${current}${addition}`.slice(0, MAX_OUTPUT)
}
