import type { LanguageModel } from 'ai'
import { BYO_PROVIDERS, isByoProvider, type TByoProvider } from '@/lib/byo-providers'

// Bring-your-own LLM key support for "Ask your site". A BYO request carries the
// user's own provider key and is streamed STRAIGHT to that provider via the
// matching @ai-sdk/* package — never through our funded AI Gateway — so the
// inference is billed to the user's account and costs isready.ai nothing.
//
// The key is supplied per-request (session-only on the client). It is NEVER
// persisted server-side, NEVER logged, and NEVER echoed back.

// Re-export the client-safe BYO contract so existing consumers (and the test)
// keep importing the provider list/guard from here.
export { BYO_PROVIDERS, isByoProvider }
export type { TByoProvider }

// Public provider model ids (not AI Gateway ids). The user pays, so these are
// current general models rather than the flagship hosted solve pins
// (anthropic/claude-opus-4.8). Checked 2026-10-07 against provider docs:
// grok-4.7 (docs.x.ai), gpt-5.4-mini (platform.openai.com), gemini-3.5-flash
// (ai.google.dev), claude-sonnet-5-5 (platform.claude.com).
const DEFAULT_MODEL: Record<TByoProvider, string> = {
  xai: 'grok-4.7',
  openai: 'gpt-5.4-mini',
  google: 'gemini-3.5-flash',
  anthropic: 'claude-sonnet-5-5',
}

export type TByoResolution =
  | { ok: true; model: LanguageModel }
  | { ok: false; reason: 'invalid_provider' | 'missing_key' | 'provider_unavailable' }

/**
 * Build a LanguageModel that talks directly to the user's provider with the
 * user's key. Returns `provider_unavailable` if a provider package fails to load
 * at runtime, so the route reports a clear error instead of crashing. The key is
 * used only to construct the client and is never stored or logged here.
 */
export async function resolveByoModel(provider: string, apiKey: string): Promise<TByoResolution> {
  if (!isByoProvider(provider)) {
    return { ok: false, reason: 'invalid_provider' }
  }
  const key = apiKey.trim()
  if (key.length === 0) {
    return { ok: false, reason: 'missing_key' }
  }
  try {
    const model = await createModel(provider, key)
    return { ok: true, model }
  } catch {
    // The only expected failure here is the provider package not being installed
    // (dynamic import rejects). Surface it as a dep-gated condition. We swallow
    // the error object deliberately so a key embedded in any message can't leak.
    return { ok: false, reason: 'provider_unavailable' }
  }
}

// Each provider package exposes a `create<Provider>({ apiKey })` factory whose
// returned callable maps a model id to a LanguageModel that hits the provider's
// own endpoint directly. Imports are dynamic so a provider loads only when a BYO
// request for it actually arrives.
async function createModel(provider: TByoProvider, apiKey: string): Promise<LanguageModel> {
  const modelId = DEFAULT_MODEL[provider]
  switch (provider) {
    case 'xai': {
      const mod = (await importProvider('@ai-sdk/xai')) as {
        createXai: (opts: { apiKey: string }) => (id: string) => LanguageModel
      }
      return mod.createXai({ apiKey })(modelId)
    }
    case 'openai': {
      const mod = (await importProvider('@ai-sdk/openai')) as {
        createOpenAI: (opts: { apiKey: string }) => (id: string) => LanguageModel
      }
      return mod.createOpenAI({ apiKey })(modelId)
    }
    case 'google': {
      const mod = (await importProvider('@ai-sdk/google')) as {
        createGoogleGenerativeAI: (opts: { apiKey: string }) => (id: string) => LanguageModel
      }
      return mod.createGoogleGenerativeAI({ apiKey })(modelId)
    }
    case 'anthropic': {
      const mod = (await importProvider('@ai-sdk/anthropic')) as {
        createAnthropic: (opts: { apiKey: string }) => (id: string) => LanguageModel
      }
      return mod.createAnthropic({ apiKey })(modelId)
    }
  }
}

function importProvider(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ specifier)
}
