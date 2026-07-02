import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Report-only first: surfaces violations without breaking GTM / Stripe / Turnstile
// / Supabase before the policy is tuned against real traffic and switched to
// enforcing. Clickjacking is already enforced via X-Frame-Options below.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo root (a stray lockfile in $HOME otherwise confuses detection).
  turbopack: { root: path.join(import.meta.dirname, '../..') },
  // Let the dev server accept /_next requests proxied through a public tunnel
  // (e.g. `cloudflared --url` for testing OG images / OAuth on a real URL).
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.app'],
  async redirects() {
    return [
      { source: '/terms', destination: '/terms-and-conditions', permanent: true },
      // Invite pages moved out of the gated /dashboard group; keep old email links working.
      { source: '/dashboard/invite/:token', destination: '/invite/:token', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Dogfood: our own trust checks require HSTS.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
