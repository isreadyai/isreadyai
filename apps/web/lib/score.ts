import type { ISiteReport, ISmartAgentReport, ISmartAgentSiteReport } from '@isreadyai/scanner'
import type { Tables } from '@isreadyai/supabase'

import {
  aiSearchTrackScore,
  readinessHeadlineScore,
  isScanReport,
  isSiteReport,
  isSmartAgentReport,
  isSmartAgentSiteReport,
} from '@isreadyai/scanner'

// MARK: - Readiness scores
//
// Two co-equal tracks measure DIFFERENT things:
//   • AI Search — will retrieval/citation engines (which read raw HTML, not JS)
//     crawl, parse and cite the page. Site-wide deep score when a deep scan ran,
//     otherwise the single homepage scan.
//   • AI Agent — what a browser-capable agent perceives after the page renders.
// The headline is the mean of the two (AI Agent only counts once its pass ran).
// `base` and `deep` are the SAME track at different breadth, so only one feeds
// the headline (deep wins) — never both, which used to double-count the homepage.

export interface IScoreTracks {
  base: number
  deep?: number | null
  smart?: number | null
}

/** AI Search track: the site-wide deep score when present, else the single-page base. */
export function aiSearchScore(tracks: IScoreTracks): number {
  return aiSearchTrackScore(tracks)
}

/**
 * Headline readiness: the mean of the AI Search and AI Agent tracks when the
 * agent pass ran, else AI Search alone. Equal weight is a product decision — the
 * report shows each track in its own section, so the blend is never the whole
 * story.
 */
export function combinedScore(tracks: IScoreTracks): number {
  return readinessHeadlineScore(tracks)
}

/** Deep-scan track: the canonical site-wide score emitted by scanSite. */
export function deepTrackScore(site: ISiteReport | null | undefined): number | null {
  if (site === null || site === undefined) {
    return null
  }
  return site.overall
}

/** AI Agent track: the deep (site-wide) pass when present, else single page. */
export function smartTrackScore(
  smart: ISmartAgentReport | null | undefined,
  smartSite?: ISmartAgentSiteReport | null,
): number | null {
  if (smartSite !== null && smartSite !== undefined) {
    return smartSite.overall
  }
  if (smart !== null && smart !== undefined) {
    return smart.overall
  }
  return null
}

/**
 * Combined score straight from a `scans` row's jsonb columns — for surfaces
 * that read the table directly (lists, badge, overview). Returns null when the
 * base report is missing/invalid.
 */
export function combinedScoreFromRow(
  row: Pick<Tables<'scans'>, 'report' | 'site_report' | 'smart_report' | 'smart_site_report'>,
): number | null {
  if (!isScanReport(row.report)) {
    return null
  }
  const deep = isSiteReport(row.site_report) ? deepTrackScore(row.site_report) : null
  const smartSite = isSmartAgentSiteReport(row.smart_site_report) ? row.smart_site_report : null
  const smart = isSmartAgentReport(row.smart_report) ? row.smart_report : null
  return combinedScore({ base: row.report.overall, deep, smart: smartTrackScore(smart, smartSite) })
}

/**
 * The materialized summary columns a scans row carries for cheap dashboard
 * list/overview reads (so they don't load the full report jsonb). The scoring
 * stays single-owner here — overall_score is {@link combinedScoreFromRow}, the
 * same scorer the report page uses; this just packages it for persistence.
 */
export function scanSummaryColumns(
  row: Pick<Tables<'scans'>, 'report' | 'site_report' | 'smart_report' | 'smart_site_report'>,
): { overall_score: number | null; has_deep: boolean; has_smart: boolean } {
  return {
    overall_score: combinedScoreFromRow(row),
    has_deep: isSiteReport(row.site_report),
    has_smart:
      isSmartAgentReport(row.smart_report) || isSmartAgentSiteReport(row.smart_site_report),
  }
}
