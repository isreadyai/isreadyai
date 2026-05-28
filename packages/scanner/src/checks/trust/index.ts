import type { ICheck } from '../../types.ts'
import { httpsCheck } from './https.ts'
import { hstsCheck } from './hsts.ts'
import { mixedContentCheck } from './mixed-content.ts'

// MARK: - Trust family

/**
 * HTTPS/TLS posture signals AI crawlers and search engines weigh when deciding
 * whether a page is safe to fetch, cite, and trust.
 */

export const trustChecks: ICheck[] = [httpsCheck, hstsCheck, mixedContentCheck]
