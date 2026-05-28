import type { ICheck } from '../../types.ts'
import { contentDepthCheck } from './content-depth.ts'
import { headingsStructureCheck } from './headings-structure.ts'
import { statisticsCitationsCheck } from './statistics-citations.ts'
import { contentNoiseCheck } from './content-noise.ts'
import { freshness } from './freshness.ts'
import { extractabilityCheck } from './extractability.ts'

// MARK: - GEO content family

/**
 * Generative Engine Optimization heuristics (Aggarwal et al., KDD 2024): depth,
 * structure, evidence (stats/quotes/citations), and content-to-noise.
 */

export const geoChecks: ICheck[] = [
  contentDepthCheck,
  headingsStructureCheck,
  statisticsCitationsCheck,
  contentNoiseCheck,
  freshness,
  extractabilityCheck,
]
