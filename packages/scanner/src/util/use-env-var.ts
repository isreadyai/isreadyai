/* eslint-disable @typescript-eslint/no-explicit-any */
type EnvRecord = Record<string, string | undefined>

// eslint-disable-next-line no-underscore-dangle -- intentional injected client-env global sentinel name
declare const __ISREADYAI_CLIENT_ENV__: EnvRecord | undefined

/**
 * Universal function to get environment variables Works in both Deno and Node.js/Browser
 * environments
 */
export function useEnvVar(key: string): string | undefined {
  // Deno environment - check for Deno global first
  if (typeof globalThis !== 'undefined' && (globalThis as any).Deno?.env) {
    const value = (globalThis as any).Deno.env.get(key)
    if (value !== undefined) {
      return value
    }
  }

  // Browser/Vite environment - injected by the admin Vite build.
  if (typeof __ISREADYAI_CLIENT_ENV__ !== 'undefined' && __ISREADYAI_CLIENT_ENV__) {
    // Try direct key first
    let value = __ISREADYAI_CLIENT_ENV__[key]
    if (value !== undefined) {
      return value
    }

    // Try with VITE_ prefix for Vite environments
    value = __ISREADYAI_CLIENT_ENV__[`VITE_${key}`]
    if (value !== undefined) {
      return value
    }

    // Try with NEXT_ prefix for Next.js environments
    value = __ISREADYAI_CLIENT_ENV__[`NEXT_${key}`]
    if (value !== undefined) {
      return value
    }
  }

  // Node.js environment
  if (typeof process !== 'undefined' && typeof process.env === 'object') {
    const value = process.env[key]

    if (value !== undefined) {
      return value
    }
  }

  return undefined
}
