// MARK: - Smart Agent executor target
//
// Decides whether a Smart Agent audit runs in a Vercel Sandbox or against the
// local agent-browser binary. The env reads here all guard against the empty
// string: `.env` ships sentinels like `AGENT_BROWSER_SNAPSHOT_ID=` (set but
// blank), so `!== undefined` would wrongly route local dev to the cloud sandbox
// (which then 403s on an empty VERCEL_TOKEN). Truthiness is the correct gate.

type TEnv = Record<string, string | undefined>

export interface ISandboxCredentials {
  token: string
  teamId: string
  projectId: string
}

export function usesVercelSandbox(env: TEnv = process.env): boolean {
  return (
    env.AGENT_BROWSER_PROVIDER === 'sandbox' ||
    (env.AGENT_BROWSER_SNAPSHOT_ID ?? '').length > 0 ||
    env.VERCEL === '1'
  )
}

export function sandboxCredentials(
  env: TEnv = process.env,
): ISandboxCredentials | Record<string, never> {
  const token = env.VERCEL_TOKEN
  const teamId = env.VERCEL_TEAM_ID
  const projectId = env.VERCEL_PROJECT_ID
  return token && teamId && projectId ? { token, teamId, projectId } : {}
}
