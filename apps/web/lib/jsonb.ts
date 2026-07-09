import type { Json } from '@isreadyai/supabase'

// PostgreSQL jsonb rejects the \u0000 escape even though it is valid JSON.
const NULL_BYTE = String.fromCharCode(0)

export function toJsonb(value: object | null): Json {
  return jsonbValue(value) ?? null
}

function jsonbValue(value: unknown): Json | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return value.replaceAll(NULL_BYTE, '')
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => jsonbValue(item) ?? null)
  }
  if (typeof value === 'object') {
    const sanitized: { [key: string]: Json } = {}
    for (const [key, child] of Object.entries(value)) {
      const json = jsonbValue(child)
      if (json !== undefined) {
        sanitized[key] = json
      }
    }
    return sanitized
  }
  return null
}
