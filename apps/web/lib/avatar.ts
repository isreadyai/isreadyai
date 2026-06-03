// MARK: - Account avatar identity

const DICEBEAR_RINGS = 'https://api.dicebear.com/9.x/rings/svg'
const GRAVATAR = 'https://www.gravatar.com/avatar'

export interface IAccountIdentity {
  email: string | null
  name: string | null
  imageUrl: string
  initials: string
}

function dicebearFor(seed: string): string {
  return `${DICEBEAR_RINGS}?seed=${encodeURIComponent(seed)}`
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function initialsFor(name: string | null, email: string | null): string {
  const base = name !== null && name.trim().length > 0 ? name.trim() : (email?.split('@')[0] ?? '')
  const parts = base.split(/[\s._-]+/).filter((part) => part.length > 0)
  if (parts.length === 0) {
    return '?'
  }
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : (parts[0]?.[1] ?? '')
  return `${first}${second}`.toUpperCase()
}

/**
 * Avatar priority: an uploaded/provider image, else Gravatar — whose `d`
 * parameter redirects to a deterministic DiceBear "rings" face when the address
 * has no Gravatar, giving a stable last-resort image in a single request.
 */
export async function resolveAccountIdentity(input: {
  email: string | null
  name?: string | null
  uploadedAvatarUrl?: string | null
}): Promise<IAccountIdentity> {
  const email = input.email
  const name = input.name ?? null
  const fallback = dicebearFor(email !== null && email.length > 0 ? email : 'isready')
  let imageUrl = fallback
  const uploaded = input.uploadedAvatarUrl
  if (uploaded !== null && uploaded !== undefined && uploaded.length > 0) {
    imageUrl = uploaded
  } else if (email !== null && email.length > 0) {
    const hash = await sha256Hex(email.trim().toLowerCase())
    imageUrl = `${GRAVATAR}/${hash}?d=${encodeURIComponent(fallback)}`
  }
  return { email, name, imageUrl, initials: initialsFor(name, email) }
}
