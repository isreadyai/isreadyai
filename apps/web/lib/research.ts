import type { ICheck } from '@isreadyai/scanner'
import type { ICorpusCheckCounts } from '@/lib/scan-corpus'

// MARK: - Research page helpers

/** Minimum sites tested for a check before it is listed as a gap. */
export const RESEARCH_MIN_CHECK_SITES = 50

/** One scored check ranked by how many sites fail or warn on it. */
export interface IResearchGap {
  id: string
  title: string
  sites: number
  fail: number
  warn: number
  share: number
}

/** Scored checks with enough samples, most affected first (share 0..1, ties by id). */
export function topGaps(
  checks: readonly ICorpusCheckCounts[],
  registry: readonly ICheck[],
  limit = 10,
): IResearchGap[] {
  const scored = new Map(registry.filter((check) => check.weight > 0).map((c) => [c.id, c.title]))
  return checks
    .flatMap((counts) => {
      const title = scored.get(counts.id)
      if (title === undefined || counts.sites < RESEARCH_MIN_CHECK_SITES) {
        return []
      }
      return [
        {
          id: counts.id,
          title,
          sites: counts.sites,
          fail: counts.fail,
          warn: counts.warn,
          share: (counts.fail + counts.warn) / counts.sites,
        },
      ]
    })
    .toSorted((a, b) => b.share - a.share || a.id.localeCompare(b.id))
    .slice(0, limit)
}
