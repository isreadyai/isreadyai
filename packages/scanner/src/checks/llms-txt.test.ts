import { describe, expect, test } from 'bun:test'
import { makeContext } from '../testing.ts'
import { EStatus } from '../types.ts'
import { llmsTxtCheck } from './llms-txt.ts'

// MARK: - llms-txt.present

describe('llms-txt.present', () => {
  test('INFO score 1 when llms.txt is present', async () => {
    const ctx = makeContext({
      url: 'https://example.com/',
      pages: {
        'https://example.com/llms.txt': { status: 200, body: '# Docs\n- /guide.md' },
      },
    })
    const res = await llmsTxtCheck.run(ctx)
    expect(res.status).toBe(EStatus.INFO)
    expect(res.score).toBe(1)
    expect(res.evidence?.present).toBe(true)
  })

  test('INFO score 1 when llms.txt is absent', async () => {
    const ctx = makeContext({ url: 'https://example.com/' })
    const res = await llmsTxtCheck.run(ctx)
    expect(res.status).toBe(EStatus.INFO)
    expect(res.score).toBe(1)
    expect(res.evidence?.present).toBe(false)
  })

  test('treats an HTML 200 body as absent (soft 404)', async () => {
    const ctx = makeContext({
      url: 'https://example.com/',
      pages: {
        'https://example.com/llms.txt': { status: 200, body: '<!DOCTYPE html><html>404</html>' },
      },
    })
    const res = await llmsTxtCheck.run(ctx)
    expect(res.status).toBe(EStatus.INFO)
    expect(res.evidence?.present).toBe(false)
  })
})
