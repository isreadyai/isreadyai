#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

/**
 * Dev orchestrator
 *
 * Pins the dev port, then hands off to Turbo, which runs the app and the Stripe
 * webhook forwarder as sibling persistent tasks (both visible as panes in the
 * Turbo TUI). The pin matters: Next would otherwise silently fall back to
 * 3301/3302 when 3300 is taken, leaving Stripe forwarding to the wrong port —
 * the mismatch that broke checkout before. We fail fast instead of drifting.
 */
const PORT = process.env.PORT ?? '3300'

// Fail fast rather than let Next pick another port behind Stripe's back.
await new Promise<void>((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(Number(PORT), () => probe.close(() => resolve()))
}).catch(() => {
  console.error(
    `\n[dev] Port ${PORT} is already in use.\n` +
      `      Free it, or run with PORT=<other> (the app and Stripe both follow it).\n`,
  )
  process.exit(1)
})

// `dev:webhook` is a Turbo root task (see turbo.json), so Stripe renders in the
// TUI alongside the app instead of being a hidden background process.
const turbo = spawn('turbo', ['run', 'dev', 'dev:webhook', 'dev:cron'], {
  stdio: 'inherit',
  env: { ...process.env, PORT },
})

turbo.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => turbo.kill('SIGINT'))
process.on('SIGTERM', () => turbo.kill('SIGTERM'))
