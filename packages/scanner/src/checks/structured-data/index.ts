import type { ICheck } from '../../types.ts'
import { jsonLdCheck } from './json-ld.ts'
import { metaBasicsCheck } from './meta-basics.ts'
import { openGraphCheck } from './open-graph.ts'
import { authorEeatCheck } from './author-eeat.ts'
import { langHreflangCheck } from './lang-hreflang.ts'

// MARK: - Structured-data check family

export const structuredDataChecks: ICheck[] = [
  jsonLdCheck,
  metaBasicsCheck,
  openGraphCheck,
  authorEeatCheck,
  langHreflangCheck,
]
