import type { ICheck } from '../../types.ts'
import { robotsExistsCheck } from './robots-exists.ts'
import { robotsAiBotsCheck } from './robots-ai-bots.ts'
import { antiBotCheck } from './anti-bot.ts'
import { sitemapCheck } from './sitemap.ts'
import { redirectsCheck } from './redirects.ts'
import { ttfbCheck } from './ttfb.ts'
import { httpStatusCheck } from './http-status.ts'
import { noindexCheck } from './noindex.ts'
import { wwwConsistencyCheck } from './www-consistency.ts'
import { uaBlocking } from './ua-blocking.ts'
import { snippetDirectives } from './snippet-directives.ts'

// MARK: - Crawler access check family

export const crawlerChecks: ICheck[] = [
  robotsExistsCheck,
  robotsAiBotsCheck,
  antiBotCheck,
  sitemapCheck,
  redirectsCheck,
  ttfbCheck,
  httpStatusCheck,
  noindexCheck,
  wwwConsistencyCheck,
  uaBlocking,
  snippetDirectives,
]
