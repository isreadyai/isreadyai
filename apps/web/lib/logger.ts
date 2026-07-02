// MARK: - Logger

import adze, { setup } from 'adze'

// Verbose locally; errors-only in production (Vercel captures these).
setup({ activeLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug' })

/** Shared app logger — emoji + timestamp, sealed into a reusable factory. */
export const logger = adze.withEmoji.timestamp.seal()
