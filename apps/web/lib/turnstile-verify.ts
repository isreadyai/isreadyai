// MARK: - Cloudflare Turnstile server-side verification

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

/**
 * Verifies a Turnstile token against `TURNSTILE_SECRET_KEY`. With no secret it
 * fails open in dev (the form stays usable) but fails closed in production, so a
 * missing secret can't silently disable the captcha.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? ''
  if (secret === '') {
    return !isProduction()
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
