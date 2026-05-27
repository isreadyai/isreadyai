// MARK: - Logger

import adze, { setup } from 'adze'
import { useEnvVar } from './use-env-var.ts'

// Verbose in dev (DEV / NODE_ENV set), errors-only otherwise.
setup({
  activeLevel: useEnvVar('DEV') || useEnvVar('NODE_ENV') ? 'debug' : 'error',
})

/** Shared scanner logger — emoji + timestamp, sealed into a reusable factory. */
export const logger = adze.withEmoji.timestamp.seal()
