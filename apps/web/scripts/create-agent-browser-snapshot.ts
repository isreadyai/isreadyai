import { createAgentBrowserSandboxSnapshot } from '../lib/smart-agent/sandbox-executor.ts'

const snapshotId = await createAgentBrowserSandboxSnapshot()
process.stdout.write(`AGENT_BROWSER_SNAPSHOT_ID=${snapshotId}\n`)
