import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isSecretPath, isWriteDenied, redactSecrets, runTool, safePathIn } from './solve.ts'

// MARK: - Fixtures

const root = mkdtempSync(join(tmpdir(), 'isready-root-'))
const outside = mkdtempSync(join(tmpdir(), 'isready-outside-'))
symlinkSync(outside, join(root, 'escape')) // committed symlink that points out of the checkout

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

// MARK: - Write/read denylist (C3 — RCE via git hooks / CI / node_modules)

describe('isWriteDenied', () => {
  test('blocks git store, CI workflows, hook dirs and dependencies', () => {
    for (const denied of [
      '.git/hooks/pre-commit',
      '.git/config',
      '.github/workflows/ci.yml',
      '.husky/pre-commit',
      '.husky/_/husky.sh',
      'node_modules/evil/index.js',
      'nested/.git/hooks/pre-push',
    ]) {
      expect(isWriteDenied(denied)).toBe(true)
    }
  })

  test('allows ordinary AI-readiness targets', () => {
    for (const allowed of [
      'robots.txt',
      'public/llms.txt',
      'app/sitemap.ts',
      '.github/dependabot.yml',
    ]) {
      expect(isWriteDenied(allowed)).toBe(false)
    }
  })
})

describe('runTool write_file', () => {
  test('refuses a denylisted write and does not create the file', () => {
    const result = JSON.parse(
      runTool('write_file', { path: 'node_modules/.bin/evil', content: 'x' }),
    )
    expect(result.error).toBe('forbidden')
    expect(existsSync(join(process.cwd(), 'node_modules/.bin/evil'))).toBe(false)
  })
})

// MARK: - Path containment (H5 — symlink escape)

describe('safePathIn', () => {
  test('rejects lexical escapes', () => {
    expect(() => safePathIn(root, '/etc/passwd')).toThrow()
    expect(() => safePathIn(root, '../outside.txt')).toThrow()
    expect(() => safePathIn(root, 'a\0b')).toThrow()
    expect(() => safePathIn(root, '')).toThrow()
  })

  test('rejects writes through a symlink that escapes the workspace', () => {
    // `escape` resolves to `outside`; a write under it would land outside the checkout.
    expect(() => safePathIn(root, 'escape/payload.txt')).toThrow()
  })

  test('allows a normal workspace-relative path', () => {
    expect(safePathIn(root, 'public/robots.txt')).toBe(join(root, 'public/robots.txt'))
  })
})

// MARK: - Secret read denylist + redaction (P0 — prompt-injected exfiltration)

describe('isSecretPath', () => {
  test('blocks credential-bearing files', () => {
    for (const secret of [
      '.env',
      '.env.local',
      '.env.production',
      'config/.env.staging',
      '.npmrc',
      '.netrc',
      '.git-credentials',
      'deploy/id_rsa',
      'certs/server.pem',
      'app.key',
      'infra/state.tfstate',
      'infra/vars.tfvars',
    ]) {
      expect(isSecretPath(secret)).toBe(true)
    }
  })

  test('allows ordinary files and example env templates', () => {
    for (const allowed of [
      '.env.example',
      '.env.sample',
      '.env.template',
      'robots.txt',
      'public/llms.txt',
      'src/app.ts',
      'README.md',
    ]) {
      expect(isSecretPath(allowed)).toBe(false)
    }
  })
})

describe('redactSecrets', () => {
  test('masks PEM key/cert blocks', () => {
    const out = redactSecrets('-----BEGIN PRIVATE KEY-----\nabcSECRET\n-----END PRIVATE KEY-----')
    expect(out).toContain('[REDACTED KEY BLOCK]')
    expect(out).not.toContain('abcSECRET')
  })

  test('masks secret-named assignments and provider token prefixes', () => {
    expect(redactSecrets('API_KEY=sk-abcdef123456')).toContain('[REDACTED]')
    expect(redactSecrets('export OPENAI_API_KEY="verysecretvalue123"')).toContain('[REDACTED]')
    expect(redactSecrets('authToken: ghp_0123456789abcdefghijklmnop')).toContain('[REDACTED]')
  })

  test('leaves ordinary content intact', () => {
    const text = 'const greeting = "hello world"'
    expect(redactSecrets(text)).toBe(text)
  })
})
