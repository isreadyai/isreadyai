import type { ICommandResult, ISmartAgentCommandExecutor } from '@isreadyai/scanner'
import { Sandbox } from '@vercel/sandbox'
import { sandboxCredentials } from './executor-target'

const AGENT_BROWSER_VERSION = '0.27.3'
const SNAPSHOT_ID = process.env.AGENT_BROWSER_SNAPSHOT_ID
const CHROMIUM_SYSTEM_DEPS = [
  'nss',
  'nspr',
  'libxkbcommon',
  'atk',
  'at-spi2-atk',
  'at-spi2-core',
  'libXcomposite',
  'libXdamage',
  'libXrandr',
  'libXfixes',
  'libXcursor',
  'libXi',
  'libXtst',
  'libXScrnSaver',
  'libXext',
  'mesa-libgbm',
  'libdrm',
  'mesa-libGL',
  'mesa-libEGL',
  'cups-libs',
  'alsa-lib',
  'pango',
  'cairo',
  'gtk3',
  'dbus-libs',
]

type TSandbox = Awaited<ReturnType<typeof Sandbox.create>>

export class SandboxAgentBrowserExecutor implements ISmartAgentCommandExecutor {
  readonly name = 'agent-browser on Vercel Sandbox'

  private constructor(private readonly sandbox: TSandbox) {}

  static async create(): Promise<SandboxAgentBrowserExecutor> {
    const credentials = sandboxCredentials()
    const sandbox =
      SNAPSHOT_ID !== undefined && SNAPSHOT_ID.length > 0
        ? await Sandbox.create({
            ...credentials,
            source: { type: 'snapshot', snapshotId: SNAPSHOT_ID },
            timeout: 120_000,
          })
        : await Sandbox.create({
            ...credentials,
            runtime: 'node24',
            timeout: 120_000,
          })

    if (SNAPSHOT_ID === undefined || SNAPSHOT_ID.length === 0) {
      try {
        await bootstrap(sandbox)
      } catch (error) {
        await sandbox.stop().catch(() => undefined)
        throw error
      }
    }
    return new SandboxAgentBrowserExecutor(sandbox)
  }

  async run(args: string[]): Promise<ICommandResult> {
    const result = await this.sandbox.runCommand('agent-browser', [
      '--content-boundaries',
      '--max-output',
      '50000',
      ...args,
    ])
    return {
      exitCode: result.exitCode,
      stdout: await result.stdout(),
      stderr: await result.stderr(),
    }
  }

  async stop(): Promise<void> {
    await this.sandbox.stop()
  }
}

export async function createAgentBrowserSandboxSnapshot(): Promise<string> {
  const sandbox = await Sandbox.create({
    ...sandboxCredentials(),
    runtime: 'node24',
    timeout: 300_000,
  })
  try {
    await bootstrap(sandbox)
    const snapshot = await sandbox.snapshot()
    return snapshot.snapshotId
  } finally {
    await sandbox.stop().catch(() => undefined)
  }
}

async function bootstrap(sandbox: TSandbox): Promise<void> {
  await requireSuccess(
    sandbox,
    'sh',
    [
      '-c',
      `sudo dnf clean all 2>&1 && sudo dnf install -y --skip-broken ${CHROMIUM_SYSTEM_DEPS.join(' ')} 2>&1 && sudo ldconfig 2>&1`,
    ],
    'Chromium system dependencies',
  )
  await requireSuccess(
    sandbox,
    'npm',
    ['install', '-g', `agent-browser@${AGENT_BROWSER_VERSION}`],
    'agent-browser install',
  )
  await requireSuccess(sandbox, 'npx', ['agent-browser', 'install'], 'Chromium install')
}

async function requireSuccess(
  sandbox: TSandbox,
  command: string,
  args: string[],
  label: string,
): Promise<void> {
  const result = await sandbox.runCommand(command, args)
  if (result.exitCode === 0) {
    return
  }
  const stderr = await result.stderr()
  const stdout = await result.stdout()
  throw new Error(`${label} failed: ${stderr || stdout}`)
}
