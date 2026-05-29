/**
 * URL-template sampling: identify representative pages per URL-path template.
 *
 * The Smart Agent audit renders only a representative subset. We cluster by
 * URL-path template (collapsing dynamic segments) and keep one rep per template,
 * so the aggregate reflects every page type, not just the first N crawled.
 */

import type { IScanReport } from '../types.ts'

// MARK: - Template extraction

/**
 * Extracts a template key from a URL by replacing dynamic segments with placeholders.
 *
 * Numeric IDs, UUIDs, dates, hex hashes, and over-long slugs become :n, :uuid,
 * :date, :hash, :slug respectively. Short word segments (about, blog, products)
 * are real routes and are kept.
 *
 * @param {string} rawUrl - Raw URL to extract template from.
 * @returns {string} - Normalized template key (e.g. /blog/:slug).
 * @export
 */
export function templateKey(rawUrl: string): string {
  let pathname: string
  try {
    pathname = new URL(rawUrl).pathname
  } catch {
    pathname = rawUrl
  }
  const segments = pathname.split('/').filter((segment) => segment.length > 0)
  return `/${segments.map(normalizeSegment).join('/')}`
}

// MARK: - Sampling

/**
 * Normalizes a path segment by replacing dynamic patterns with placeholders.
 */
function normalizeSegment(segment: string): string {
  const value = segment.toLowerCase()
  if (/^\d+$/.test(value)) {
    return ':n'
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    return ':uuid'
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return ':date'
  }
  if (/^[0-9a-f]{16,}$/.test(value)) {
    return ':hash'
  }
  // A slug carrying an id (product-15-pro) or an over-long title segment is
  // dynamic; short word segments are real routes, so keep those verbatim.
  if ((/\d/.test(value) && value.includes('-')) || value.length > 24) {
    return ':slug'
  }
  return value
}

/**
 * Scores page completeness: prefers pages that fetched OK, with more passing checks and higher overall score.
 */
function completeness(page: IScanReport): number {
  const fetched = page.meta.fetchOk ? 1 : 0
  const passes = page.checks.filter((check) => check.status === 'pass').length
  return fetched * 10_000 + passes * 100 + page.overall
}

/**
 * Selects one representative URL per URL-template, with the primary always first.
 *
 * When max is provided, the result is capped to the most-common templates (dominant types).
 * When max is omitted, every template gets a representative.
 *
 * @param {string} primaryUrl - Primary URL (always first in result).
 * @param {IScanReport[]} pages - Scanned pages to sample from.
 * @param {number} [max] - Optional cap on the number of representatives to return.
 * @returns {string[]} - Representative URLs, one per template, primary first.
 * @export
 */
export function sampleRepresentativeUrls(
  primaryUrl: string,
  pages: IScanReport[],
  max?: number,
): string[] {
  const primaryKey = templateKey(primaryUrl)
  const groups = new Map<string, IScanReport[]>()
  for (const page of pages) {
    const key = templateKey(page.finalUrl)
    if (key === primaryKey) {
      continue
    }
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, [page])
    } else {
      group.push(page)
    }
  }

  // With a cap, sort by group size so dominant template types win.
  // Without a cap, order doesn't matter — keep natural insertion order.
  const allGroups = [...groups.values()]
  const ranked = max !== undefined ? allGroups.toSorted((a, b) => b.length - a.length) : allGroups

  const urls = [primaryUrl]
  for (const group of ranked) {
    if (max !== undefined && urls.length >= max) {
      break
    }
    const best = group.reduce((winner, page) =>
      completeness(page) > completeness(winner) ? page : winner,
    )
    if (!urls.includes(best.finalUrl)) {
      urls.push(best.finalUrl)
    }
  }
  return max !== undefined ? urls.slice(0, max) : urls
}
