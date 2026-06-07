#!/usr/bin/env bun
import { spawn } from 'node:child_process'

/**
 * Stripe webhook forwarder (non-breaking)
 *
 * Wraps `stripe listen` so a missing CLI or an expired/invalid login can never
 * break `bun run dev`. On any failure the Turbo pane prints one friendly line
 * and idles; the app and the other panes keep running. On success it streams
 * the forwarder's output (signing secret + forwarded events) as usual.
 *
 * Auth: we feed the CLI our own STRIPE_SECRET_KEY via STRIPE_API_KEY (env, not
 * argv, so it never leaks into process listings). Dashboard secret keys don't
 * expire — unlike the temporary key minted by `stripe login` — so this removes
 * the recurring 90-day re-login entirely. `stripe login` is no longer required.
 */

const PORT = process.env.PORT ?? '3300'
// Dev serves HTTPS (--experimental-https): a non-HTTPS forward EOFs on the TLS port.
const https = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://').startsWith('https')
const target = `${https ? 'https' : 'http'}://localhost:${PORT}/api/stripe/webhook`
const apiKey = process.env.STRIPE_API_KEY ?? process.env.STRIPE_SECRET_KEY

/**
 * Holds the Turbo task open after a soft failure, without erroring, so dev never tears down.
 *
 * @param {string} message
 */
function idle(message: string): void {
  console.log(`\n[dev:webhook] ${message}\n`)
  setInterval(() => {}, 2 ** 30)
}

const child = spawn(
  'stripe',
  ['listen', '--forward-to', target, ...(https ? ['--skip-verify'] : [])],
  {
    stdio: ['ignore', 'inherit', 'pipe'],
    env: apiKey === undefined ? process.env : { ...process.env, STRIPE_API_KEY: apiKey },
  },
)

let softFailed = false
child.stderr?.on('data', (chunk: Buffer) => {
  const text = chunk.toString()
  // Swallow the noisy auth stack-trace; we translate it to a hint on exit.
  if (/api_key_expired|Authorization failed|FATAL/i.test(text)) {
    softFailed = true
    return
  }
  process.stderr.write(text)
})

child.on('error', (error: NodeJS.ErrnoException) => {
  idle(
    error.code === 'ENOENT'
      ? 'Stripe CLI not installed — webhooks disabled. Install: brew install stripe/stripe-cli/stripe'
      : `Stripe forwarder unavailable: ${error.message}`,
  )
})

child.on('exit', (code, signal) => {
  // A signal-kill (Ctrl-C) is a clean shutdown; anything else is a soft fail.
  if (signal !== null) {
    process.exit(0)
  }
  if (softFailed || (code ?? 0) !== 0) {
    idle('Stripe webhooks off — check STRIPE_SECRET_KEY in .env. Dev keeps running.')
    return
  }
  process.exit(0)
})

function shutdown(): void {
  child.kill('SIGINT')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
