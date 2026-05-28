import type { Json } from '../../util/json.ts'
import { ECategory, ELevel, EStatus } from '../../types.ts'
import type { TJsonObject } from '../../types.ts'
import { extractJsonLd } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Freshness signals

/**
 * Generative engines disproportionately cite recently-updated pages; visible
 * machine-readable dates (JSON-LD dateModified/datePublished, Last-Modified)
 * are the signal. Heuristic: WARN-only, never hard-FAIL.
 */

const STALE_MONTHS = 18

const def: ICheckDef = {
  id: 'geo.freshness',
  category: ECategory.GEO_CONTENT,
  weight: 1,
  title: 'Machine-readable freshness signals',
}

/**
 * Check for dateModified/datePublished in JSON-LD and Last-Modified header (WARN if stale >18 months).
 *
 * @export
 */
export const freshness = defineCheck(def, (ctx) => {
  const dates: string[] = []
  const visit = (node: Json | undefined): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as TJsonObject)) {
        if ((key === 'dateModified' || key === 'datePublished') && typeof value === 'string') {
          dates.push(value)
        } else if (typeof value === 'object') {
          visit(value)
        }
      }
    }
  }
  extractJsonLd(ctx.raw.body).forEach(visit)

  const lastModified = ctx.raw.headers['last-modified']
  if (lastModified !== undefined) {
    dates.push(lastModified)
  }

  const parsed = dates.map((d) => new Date(d).getTime()).filter((t) => !Number.isNaN(t))
  if (parsed.length === 0) {
    return makeResult(
      def,
      EStatus.WARN,
      'no machine-readable dates (JSON-LD datePublished/dateModified or Last-Modified header)',
      {
        score: 0.5,
        fix: 'Add datePublished and dateModified to your JSON-LD (or send a Last-Modified header) so engines can judge freshness.',
        impact: ELevel.LOW,
        effort: ELevel.LOW,
        evidence: { sources: 0 },
      },
    )
  }

  const newest = Math.max(...parsed)
  const ageMonths = (Date.now() - newest) / (1000 * 60 * 60 * 24 * 30)
  const evidence = { newest: new Date(newest).toISOString().slice(0, 10), sources: parsed.length }

  if (ageMonths <= STALE_MONTHS) {
    return makeResult(def, EStatus.PASS, `freshness signals present (newest: ${evidence.newest})`, {
      evidence,
    })
  }
  return makeResult(
    def,
    EStatus.WARN,
    `newest declared date is ${evidence.newest} — stale content is cited less by generative engines`,
    {
      score: 0.5,
      fix: 'Refresh the content and update dateModified — recently-updated pages earn measurably more AI citations.',
      impact: ELevel.LOW,
      effort: ELevel.MEDIUM,
      evidence,
    },
  )
})
