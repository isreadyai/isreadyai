// MARK: - Cloudflare Turnstile server-side verification

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Turnstile token against `TURNSTILE_SECRET_KEY`, returning true only
 * on a confirmed success. When no secret is configured (local/dev, or before the
 * secret is wired into the app env) verification is skipped so the form stays
 * usable — the route's rate-limit still bounds abuse. Production sets the secret.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? ''
  if (secret === '') {
    return true
  }
  if (token === '') {
    return false
  }
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip !== undefined && ip !== '' && ip !== 'local') {
      body.set('remoteip', ip)
    }
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!response.ok) {
      return false
    }
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
