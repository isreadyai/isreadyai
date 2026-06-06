import { describe, expect, test } from 'bun:test'
import { sanitizeInferenceBody } from './route.ts'

const MODEL = 'anthropic/claude-sonnet-4.6'
const CAP = 4096

describe('sanitizeInferenceBody', () => {
  test('strips n and forces it to 1', () => {
    const out = sanitizeInferenceBody({ n: 100, messages: [] }, MODEL, CAP)

    expect(out.n).toBe(1)
  })

  test('drops non-whitelisted fields', () => {
    const out = sanitizeInferenceBody(
      { messages: [], frequency_penalty: 2, logit_bias: {}, user: 'x' },
      MODEL,
      CAP,
    )

    expect(out).not.toHaveProperty('frequency_penalty')
    expect(out).not.toHaveProperty('logit_bias')
    expect(out).not.toHaveProperty('user')
  })

  test('pins the model and caps max_tokens', () => {
    const out = sanitizeInferenceBody({ model: 'gpt-4o', max_tokens: 999999 }, MODEL, CAP)

    expect(out.model).toBe(MODEL)
    expect(out.max_tokens).toBe(CAP)
  })

  test('forwards whitelisted fields and defaults max_tokens', () => {
    const messages = [{ role: 'user', content: 'hi' }]
    const out = sanitizeInferenceBody(
      { messages, temperature: 0.2, stream: true, tools: [], tool_choice: 'auto' },
      MODEL,
      CAP,
    )

    expect(out.messages).toBe(messages)
    expect(out.temperature).toBe(0.2)
    expect(out.stream).toBe(true)
    expect(out.tools).toEqual([])
    expect(out.tool_choice).toBe('auto')
    expect(out.max_tokens).toBe(CAP)
  })
})
