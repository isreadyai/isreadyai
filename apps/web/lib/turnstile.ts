// MARK: - Cloudflare Turnstile site key

/**
 * The Turnstile site key, sourced ONLY from the environment per deployment
 * (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`). There is deliberately NO hardcoded
 * fallback: a missing key must fail visibly rather than silently fall back to
 * Cloudflare's "always passes" test key — which would disable captcha protection
 * in production. Local/dev sets the test key in `.env`; production sets the real
 * key (paired with the matching secret in the Supabase auth captcha config).
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
