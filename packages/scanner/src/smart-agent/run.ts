/**
 * Smart Agent audit execution: invokes agent-browser and analyzes observations.
 */

import type { Json } from '../util/json.ts'
import type {
  ICommandResult,
  ISmartAgentCommandExecutor,
  ISmartAgentObservation,
  ISmartAgentRef,
  ISmartAgentReport,
} from './types.ts'
import type { TJsonObject, TUrl } from '../types.ts'
import { analyzeSmartAgentObservation } from './analyze.ts'

// MARK: - Types

interface IJsonEnvelope {
  success?: boolean
  data?: TJsonObject
}

// MARK: - Public API

/**
 * Runs a Smart Agent audit: opens a URL in agent-browser, captures observations, and analyzes signals.
 *
 * @param {TUrl} url - URL to audit.
 * @param {ISmartAgentCommandExecutor} executor - Agent command executor (e.g. agent-browser).
 * @returns {Promise<ISmartAgentReport>} - Complete Smart Agent assessment.
 * @async
 * @export
 */
export async function runSmartAgentAudit(
  url: TUrl,
  executor: ISmartAgentCommandExecutor,
): Promise<ISmartAgentReport> {
  const startedAt = new Date()
  let opened = false
  try {
    opened = true
    await execute(executor, ['open', url, '--json'])

    const titleResult = await execute(executor, ['get', 'title', '--json'])
    const urlResult = await execute(executor, ['get', 'url', '--json'])
    const snapshotResult = await execute(executor, ['snapshot', '--json'])
    const interactiveResult = await execute(executor, ['snapshot', '-i', '-c', '--json'])
    const versionResult = await executor.run(['--version'])

    const snapshotEnvelope = parseEnvelope(snapshotResult.stdout, 'snapshot')
    const interactiveEnvelope = parseEnvelope(interactiveResult.stdout, 'interactive snapshot')
    const observation: ISmartAgentObservation = {
      requestedUrl: url,
      finalUrl: readString(parseEnvelope(urlResult.stdout, 'url').data, 'url') ?? url,
      title: readString(parseEnvelope(titleResult.stdout, 'title').data, 'title') ?? '',
      snapshot: readString(snapshotEnvelope.data, 'snapshot') ?? '',
      interactiveSnapshot: readString(interactiveEnvelope.data, 'snapshot') ?? '',
      refs: readRefs(interactiveEnvelope.data?.refs),
    }

    if (observation.snapshot.trim().length === 0) {
      throw new Error('agent-browser returned an empty accessibility snapshot')
    }

    return analyzeSmartAgentObservation(
      observation,
      executor.name,
      startedAt,
      parseVersion(versionResult),
    )
  } finally {
    if (opened) {
      await executor.run(['close']).catch(() => undefined)
    }
  }
}

// MARK: - Internal helpers

async function execute(
  executor: ISmartAgentCommandExecutor,
  args: string[],
): Promise<ICommandResult> {
  const result = await executor.run(args)
  if (result.exitCode !== 0) {
    const reason = result.stderr.trim() || result.stdout.trim() || 'unknown agent-browser error'
    throw new Error(`agent-browser ${args[0] ?? 'command'} failed: ${reason.slice(0, 500)}`)
  }
  return result
}

function parseEnvelope(value: string, label: string): IJsonEnvelope {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('not an object')
    }
    const envelope = parsed as IJsonEnvelope
    if (envelope.success === false) {
      throw new Error('command reported failure')
    }
    return envelope
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`invalid ${label} JSON from agent-browser: ${reason}`, { cause: error })
  }
}

function readString(data: TJsonObject | undefined, key: string): string | null {
  const value = data?.[key]
  return typeof value === 'string' ? value : null
}

function readRefs(value: Json | undefined): Record<string, ISmartAgentRef> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const refs: Record<string, ISmartAgentRef> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      continue
    }
    const role = 'role' in raw && typeof raw.role === 'string' ? raw.role : ''
    const name = 'name' in raw && typeof raw.name === 'string' ? raw.name : ''
    refs[key] = { role, name }
  }
  return refs
}

function parseVersion(result: ICommandResult): string | null {
  if (result.exitCode !== 0) {
    return null
  }
  const match = `${result.stdout}\n${result.stderr}`.match(/\d+\.\d+\.\d+/)
  return match?.[0] ?? null
}
