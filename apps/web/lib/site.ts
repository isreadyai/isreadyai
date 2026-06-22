// MARK: - Site constants

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isready.ai'
export const GITHUB_URL = 'https://github.com/isreadyai/isreadyai'
export const SITE_NAME = 'isready.ai'

// Google Tag Manager container — only loaded when set (production), so local dev
// and previews stay analytics-free.
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? ''
