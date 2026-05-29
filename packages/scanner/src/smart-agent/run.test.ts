import { describe, expect, test } from 'bun:test'
import { runSmartAgentAudit } from './index.ts'
import type { ICommandResult, ISmartAgentCommandExecutor } from './index.ts'

class FixtureExecutor implements ISmartAgentCommandExecutor {
  readonly name = 'fixture'
  readonly commands: string[] = []

  run(args: string[]): Promise<ICommandResult> {
    this.commands.push(args.join(' '))
    const command = args.join(' ')
    if (command === 'get title --json') {
      return result({ success: true, data: { title: 'Fixture documentation' } })
    }
    if (command === 'get url --json') {
      return result({ success: true, data: { url: 'https://example.com/docs' } })
    }
    if (command === 'snapshot --json') {
      return result({
        success: true,
        data: {
          snapshot:
            '- main\n- heading "Fixture" [level=1]\n- paragraph "Readable documentation content"',
        },
      })
    }
    if (command === 'snapshot -i -c --json') {
      return result({
        success: true,
        data: {
          snapshot: '- link "Home" [ref=e1]',
          refs: { e1: { role: 'link', name: 'Home' } },
        },
      })
    }
    if (command === '--version') {
      return Promise.resolve({ exitCode: 0, stdout: 'agent-browser 0.27.3', stderr: '' })
    }
    return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })
  }
}

describe('runSmartAgentAudit', () => {
  test('collects deterministic snapshots in order and closes the browser', async () => {
    const executor = new FixtureExecutor()
    const report = await runSmartAgentAudit('https://example.com', executor)
    expect(report.finalUrl).toBe('https://example.com/docs')
    expect(report.meta.agentBrowserVersion).toBe('0.27.3')
    expect(report.agentView.interactiveElements).toEqual([{ role: 'link', name: 'Home' }])
    expect(executor.commands).toEqual([
      'open https://example.com --json',
      'get title --json',
      'get url --json',
      'snapshot --json',
      'snapshot -i -c --json',
      '--version',
      'close',
    ])
  })

  test('attempts cleanup when opening the page fails', async () => {
    const commands: string[] = []
    const executor: ISmartAgentCommandExecutor = {
      name: 'failing fixture',
      run(args: string[]): Promise<ICommandResult> {
        commands.push(args.join(' '))
        return Promise.resolve({
          exitCode: args[0] === 'open' ? 1 : 0,
          stdout: '',
          stderr: args[0] === 'open' ? 'navigation failed' : '',
        })
      },
    }
    await expect(runSmartAgentAudit('https://example.com', executor)).rejects.toThrow(
      'navigation failed',
    )
    expect(commands).toEqual(['open https://example.com --json', 'close'])
  })
})

function result(value: unknown): Promise<ICommandResult> {
  return Promise.resolve({ exitCode: 0, stdout: JSON.stringify(value), stderr: '' })
}
