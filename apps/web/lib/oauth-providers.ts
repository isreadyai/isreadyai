// MARK: - Available social sign-in providers

export type TOAuthProvider = 'google' | 'github' | 'x'
const PROVIDERS: TOAuthProvider[] = ['google', 'github', 'x']

/**
 * Which social providers the auth server actually has enabled, read from its
 * public settings. A provider needs real credentials AND a Supabase restart to
 * be usable, so the UI offers a Connect button only when it would genuinely
 * work — otherwise clicking it just errors. Any failure to read the settings
 * falls back to "all available" so a transient check never hides a provider
 * that is configured in production.
 */
export async function availableOAuthProviders(): Promise<TOAuthProvider[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url === undefined || url.length === 0) {
    return PROVIDERS
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: key !== undefined && key.length > 0 ? { apikey: key } : undefined,
      cache: 'no-store',
    })
    if (!response.ok) {
      return PROVIDERS
    }
    const body = (await response.json()) as { external?: Record<string, boolean> }
    const external = body.external ?? {}
    return PROVIDERS.filter((provider) => external[provider] === true)
  } catch {
    return PROVIDERS
  }
}
