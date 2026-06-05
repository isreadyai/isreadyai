// MARK: - BYO provider contract (client-safe)
//
// The single owner of the bring-your-own-LLM provider list + guard, shared by
// the client settings UI (byo-key-settings) and the server model resolver
// (byo-llm). Deliberately free of any provider SDK or server runtime so a Client
// Component can import it without pulling server-only code into the bundle.

export const BYO_PROVIDERS = ['anthropic', 'openai', 'google', 'xai'] as const
export type TByoProvider = (typeof BYO_PROVIDERS)[number]

export function isByoProvider(value: unknown): value is TByoProvider {
  return typeof value === 'string' && (BYO_PROVIDERS as readonly string[]).includes(value)
}
