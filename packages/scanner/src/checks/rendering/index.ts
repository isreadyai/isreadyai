import type { ICheck } from '../../types.ts'
import { emptyShell } from './empty-shell.ts'
import { mainContent } from './main-content.ts'
import { noscriptFallback } from './noscript-fallback.ts'
import { markdownNegotiation } from './markdown-negotiation.ts'
import { imageAlt } from './image-alt.ts'

// MARK: - Rendering family

/**
 * Detects content invisible to non-JS AI crawlers (empty app shells, scripts
 * with no server-rendered text) and how well the served HTML separates
 * content from chrome.
 */

export const renderingChecks: ICheck[] = [
  emptyShell,
  mainContent,
  noscriptFallback,
  markdownNegotiation,
  imageAlt,
]
