import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

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
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
