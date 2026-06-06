import type { ISmartAgentCommandExecutor, ISmartAgentReport } from '@isreadyai/scanner'
import { runSmartAgentAudit, validateScanInput } from '@isreadyai/scanner'
import { usesVercelSandbox } from './executor-target'
import { LocalAgentBrowserExecutor } from './local-executor'
import { assertPublicUrl } from './ssrf-guard'

/**
 * A ready-to-use executor plus its teardown. stop() is a no-op for the local
 * executor (it spawns a child per command — nothing persistent to tear down) and
 * stops the VM for the sandbox executor.
 */
export interface ISmartAgentExecutorHandle {
  executor: ISmartAgentCommandExecutor
  stop: () => Promise<void>
}

/**
 * Creates an executor by the same Local-vs-Sandbox rule as runWebSmartAgentAudit.
 * The CALLER owns the lifecycle — reuse the executor across many URLs, then call
 * stop() once — which is how the deep pass avoids one VM create per page.
 */
export async function createSmartAgentExecutor(): Promise<ISmartAgentExecutorHandle> {
  if (!usesVercelSandbox()) {
    return { executor: new LocalAgentBrowserExecutor(), stop: () => Promise.resolve() }
  }
  const { SandboxAgentBrowserExecutor } = await import('./sandbox-executor.ts')
  const executor = await SandboxAgentBrowserExecutor.create()
  return { executor, stop: () => executor.stop() }
}

/**
 * Runs one audit on a caller-owned executor — does NOT create or stop it, so the
 * executor can be reused across URLs (sequentially; the session is shared state).
 */
export async function runSmartAgentAuditWith(
  url: string,
  executor: ISmartAgentCommandExecutor,
): Promise<ISmartAgentReport> {
  const validated = validateScanInput(url)
  if (!validated.ok) {
    throw new Error(`Smart Agent navigation rejected: ${validated.problem}`)
  }
  // Resolve + reject private/reserved hosts before pointing a real browser at the
  // URL (validateScanInput only catches literal localhost/IP forms, not a hostname
  // that RESOLVES to an internal address). Covers single-page and deep passes.
  await assertPublicUrl(validated.url)
  return runSmartAgentAudit(validated.url, executor)
}

/** Single-page audit: create → run → stop. Unchanged contract for one-URL callers. */
export async function runWebSmartAgentAudit(url: string): Promise<ISmartAgentReport> {
  const handle = await createSmartAgentExecutor()
  try {
    return await runSmartAgentAuditWith(url, handle.executor)
  } finally {
    await handle.stop()
  }
}
