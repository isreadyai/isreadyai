import type {
  IAuditSummary,
  ICategoryScore,
  ICheck,
  ICheckResult,
  IFetchProvider,
  IRawResponse,
  IScanOptions,
  IScanReport,
  TUrl,
} from './types.ts'
import { ECheckScope, EStatus } from './types.ts'
import { scan } from './engine.ts'
import { NativeProvider } from './providers/native.ts'
import { clusterByStructure } from './smart-agent/structural-cluster.ts'
import { templateKey } from './smart-agent/template-sample.ts'
import { gradeOf, SCORE_VERSION } from './score.ts'
import { hostOf, normalizeUrl, resolveUrl } from './util/url.ts'
import { parseRobots } from './util/robots.ts'

/**
 * Deep scan (site crawl)
 *
 * Discovers pages two ways (sitemap <loc> entries, same-host homepage links)
 * and runs page-scope checks on each. Site-scope checks (robots, TLS, sitemap)
 * ran once on the primary scan and aren't repeated. Subpages are raw-only (no
 * render): matches what AI crawlers see and keeps a deep scan cheap.
 */

// MARK: - Interfaces

/**
 * Options for a deep scan, extending the base scan options with additional parameters for controlling the depth and scope of the scan.
 *
 * @interface IDeepScanOptions
 * @typedef {IDeepScanOptions}
 * @extends {IScanOptions}
 * @export
 */
export interface IDeepScanOptions extends IScanOptions {
  /** Max additional pages beyond the primary URL. */
  limit?: number

  /** Skip the first N discovered pages (for huge sites). */
  skip?: number

  /** Max concurrent requests during crawling. */
  concurrency?: number

  /** Reuse an existing primary report instead of re-scanning. */
  primary?: IScanReport
}

/**
 * One structural cluster: pages that share a common DOM layout template.
 *
 * @export
 * @interface ISiteCluster
 * @typedef {ISiteCluster}
 */
export interface ISiteCluster {
  /** Stable numeric id assigned in order of first encounter. */
  id: number
  /** The most "complete" page in the cluster (highest fetchOk + passes + overall). */
  representativeUrl: string
  /** finalUrls of the SCANNED members (sample for uniform groups; all for divergent groups). */
  pageUrls: string[]
  /** TOTAL URLs in the URL-template group — may exceed scannedCount when the group is uniform
   *  and sampling was applied. */
  pageCount: number
  /** Pages actually fetched and scored — equals pageCount when the group was fully expanded. */
  scannedCount: number
  /** Rounded mean `overall` score of all scanned pages in the cluster. */
  avgScore: number
}

/**
 * A complete scan report for a site, including all discovered pages and their assessments.
 *
 * @export
 * @interface ISiteReport
 * @typedef {ISiteReport}
 * @extends {IAuditSummary<ICategoryScore>}
 */
export interface ISiteReport extends IAuditSummary<ICategoryScore> {
  /** Per-category aggregate across all pages (same weighting as `overall`).
   *  `checks` is empty here — drill into primary/pages for the verdicts. */
  primary: IScanReport

  /** Additional pages, page-scope checks only. */
  pages: IScanReport[]

  /** Candidate URLs discovered (before the limit cut). */
  discovered: number

  /** Secondary pages that errored during the crawl — counted, NOT scored (the
   *  aggregate reflects only successfully-fetched pages). Optional: absent on
   *  reports persisted before failure accounting shipped; read as `?? 0`. */
  failed?: number

  /** DOM-structural clusters across all scanned pages (primary included).
   *  Sorted by pageCount desc so the dominant template comes first. */
  clusters: ISiteCluster[]
}

/**
 * One failing/warning check aggregated across every page it affects.
 *
 * @export
 * @interface ISiteFindingGroup
 * @typedef {ISiteFindingGroup}
 */
export interface ISiteFindingGroup {
  /** Representative verdict — the worst instance (fail beats warn). */
  result: ICheckResult

  /** finalUrls of the affected pages. */
  pages: TUrl[]
}

export interface IDiscoverOptions {
  /** Cap on candidates collected per source (sitemap / links). */
  maxUrls?: number
}

// MARK: - Constants

const DEFAULT_LIMIT = 10
const DEFAULT_CONCURRENCY = 4
const SAMPLE_PER_TEMPLATE = 5
const DEFAULT_MAX_URLS = 500
const URLS_PER_CHILD_SITEMAP = 500
const MAX_CHILD_SITEMAPS = 10
const MAX_SITEMAP_PARSE = 10_000 // Parse cap per sitemap file — counting is cheap, fetching is not.
const MAX_HREFS = 5_000 // Parse cap per page — a page with more links than this is pathological.

// Assets and machine files — never content pages.
const SKIP_EXTENSION_RE =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|json|xml|pdf|zip|gz|tar|mp4|webm|mp3|wav|woff2?|ttf|eot|otf|txt)([?#]|$)/i

// MARK: - Adaptive scan helpers

/**
 * Picks up to `k` evenly-spread elements from `arr` (first, interior, last).
 *
 * @template T - The type of elements in the input array.
 * @param {T[]} arr - The input array from which to select elements.
 * @param {number} k - The maximum number of elements to select from the input array.
 * @returns {T[]} - An array containing up to `k` evenly-spread elements from the input array, preserving the order of the original array.
 */
function spreadSample<T>(arr: T[], k: number): T[] {
  if (k <= 0 || arr.length === 0) return []
  if (arr.length <= k) return [...arr]
  if (k === 1) return [arr[0] as T]
  // Indices are bounded to [0, arr.length-1] by construction; the `as T` cast is safe.
  return Array.from({ length: k }, (_, i) => arr[Math.round((i * (arr.length - 1)) / (k - 1))] as T)
}

/**
 * Scans a batch of URLs concurrently using a bounded worker pool.
 * `counter` is a shared mutable ref so the running page number is global
 * across all batches (samples + expansions); `total` is the full discovered
 * candidate count used in the progress message.
 *
 * @param {TUrl[]} urls - The array of URLs to scan in this batch.
 * @param {ICheck[]} checks - The array of checks to run on each URL in the batch.
 * @param {IFetchProvider[]} providers - The array of fetch providers to use for fetching the URLs.
 * @param {number} concurrency - The maximum number of concurrent scans to run in parallel.
 * @param {{ n: number }} counter - A mutable object with a single property `n` that tracks the number of pages scanned so far across all batches.
 * @param {number} total - The total number of pages to be scanned across all batches, used for progress reporting.
 * @param {(msg: string) => void} log - A logging function that receives progress messages during the scanning process.
 *
 * @async
 * @returns {Promise<{ reports: IScanReport[]; failed: number }>} - A promise resolving to the successful scan reports plus the count of pages that errored (an errored page is an explicit outcome, not silently dropped).
 */
async function scanBatch(
  urls: TUrl[],
  checks: ICheck[],
  providers: IFetchProvider[],
  concurrency: number,
  counter: { n: number },
  total: number,
  log: (msg: string) => void,
): Promise<{ reports: IScanReport[]; failed: number }> {
  if (urls.length === 0) {
    return { reports: [], failed: 0 }
  }

  const results: IScanReport[] = []
  let failed = 0
  const queue = [...urls]

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      log(`Scanning page ${++counter.n}/${total}: ${url}`)
      try {
        results.push(await scan(url, { checks, providers }))
      } catch (error) {
        // An errored page is an explicit outcome — count + log it (it surfaces in
        // the site report's `failed`, never folded into the aggregate score).
        failed += 1
        const reason = error instanceof Error ? error.message : String(error)
        log(`Page failed (${failed}): ${url} — ${reason}`)
      }
    }
  })
  await Promise.all(workers)

  return { reports: results, failed }
}

/**
 * Adaptive crawl: groups URLs by URL-template, scans ≤ SAMPLE_PER_TEMPLATE pages per
 * group (spread first/interior/last), then clusters only the sample — never more.
 *
 * - Uniform group (1 cluster in the sample): one cluster row; `pageCount` = full group
 *   size, `scannedCount` = sample size.
 * - Divergent group (>1 clusters in the sample): one cluster row per sub-cluster found,
 *   with `pageCount` proportionally estimated from the sample ratio. No expansion.
 * - The primary is treated as a pre-scanned member of its template group (it is NOT
 *   pushed into the returned `pages` array — caller keeps it in `primary`).
 *
 * @param {TUrl[]} urls - Candidate page URLs to scan (discovered from sitemap + links).
 * @param {IScanReport} primary - The primary scan report for the main URL, which is treated as a pre-scanned member of its template group.
 * @param {ICheck[]} pageChecks - The array of page-scope checks to run on each URL in the batch.
 * @param {IFetchProvider[]} providers - The array of fetch providers to use for fetching the URLs.
 * @param {number} concurrency - The maximum number of concurrent scans to run in parallel.
 * @param {(msg: string) => void} log - A logging function that receives progress messages during the scanning process.
 *
 * @async
 * @returns {Promise<{ pages: IScanReport[]; clusters: ISiteCluster[] }>} - A promise that resolves to an object containing two properties: `pages`, an array of IScanReport objects representing the scan results for the sampled pages, and `clusters`, an array of ISiteCluster objects representing the structural clusters found in the scanned pages.
 */
async function scanAdaptive(
  urls: TUrl[],
  primary: IScanReport,
  pageChecks: ICheck[],
  providers: IFetchProvider[],
  concurrency: number,
  log: (msg: string) => void,
): Promise<{ pages: IScanReport[]; clusters: ISiteCluster[]; failed: number }> {
  // Include the primary so its fingerprint participates in clustering.
  const allCandidates = [primary.finalUrl, ...urls]
  const templateGroups = new Map<string, TUrl[]>()

  for (const url of allCandidates) {
    const key = templateKey(url)
    const group = templateGroups.get(key)
    if (group === undefined) {
      templateGroups.set(key, [url])
    } else {
      group.push(url)
    }
  }

  const pages: IScanReport[] = []
  const clusters: ISiteCluster[] = []
  let failed = 0
  let nextId = 0
  // Shared mutable counter so all scanBatch calls (samples + expansions) emit
  // a single global "Scanning page X/total" sequence.
  const counter = { n: 0 }
  const total = urls.length

  for (const [, groupUrls] of templateGroups) {
    const groupSize = groupUrls.length

    // Pre-scanned members (only the primary can be pre-scanned).
    const preScanned = groupUrls.includes(primary.finalUrl) ? [primary] : []
    const unscanned = groupUrls.filter((u) => u !== primary.finalUrl)

    // Sample from the unscanned portion; primary already eats 1 slot of the budget.
    const sampleQuota = Math.max(0, SAMPLE_PER_TEMPLATE - preScanned.length)
    const toSample = spreadSample(unscanned, sampleQuota)

    const sampleBatch = await scanBatch(
      toSample,
      pageChecks,
      providers,
      concurrency,
      counter,
      total,
      log,
    )
    pages.push(...sampleBatch.reports)
    failed += sampleBatch.failed

    const groupScanned = [...preScanned, ...sampleBatch.reports]
    // Every page in this group failed to fetch (and it isn't the primary's group),
    // so there's nothing to cluster or extrapolate — skip before the empty reduce.
    if (groupScanned.length === 0) {
      continue
    }

    // Detect structural divergence within the sample.
    const sampleClusterMap = clusterByStructure(
      groupScanned.map((p) => ({ id: p.finalUrl, fingerprint: p.fingerprint ?? [] })),
    )

    if (sampleClusterMap.size <= 1) {
      // Uniform template: the sample is sufficient — extrapolate pageCount to the full group.
      const rep = groupScanned.reduce((best, p) =>
        completeness(p) > completeness(best) ? p : best,
      )
      const avgScore = Math.round(
        groupScanned.reduce((sum, p) => sum + p.overall, 0) / groupScanned.length,
      )
      clusters.push({
        id: nextId++,
        representativeUrl: rep.finalUrl,
        pageUrls: groupScanned.map((p) => p.finalUrl),
        pageCount: groupSize,
        scannedCount: groupScanned.length,
        avgScore,
      })
    } else {
      // Divergent template: the sample reveals multiple structural layouts.
      // Do NOT scan more pages — allocate the group's total proportionally across
      // the sub-clusters found in the sample so pageCount stays accurate.
      const totalSampled = groupScanned.length
      const subClusters = [...sampleClusterMap.values()].map((memberIds) => {
        const members = groupScanned.filter((p) => memberIds.includes(p.finalUrl))
        return { members, rawPageCount: Math.round((groupSize * members.length) / totalSampled) }
      })

      // Fix rounding drift so pageCounts always sum to groupSize.
      const pageCountSum = subClusters.reduce((sum, s) => sum + s.rawPageCount, 0)
      const diff = groupSize - pageCountSum
      if (diff !== 0) {
        // Give the remainder to the sub-cluster with the most sample members.
        const largest = subClusters.reduce((best, s) =>
          s.members.length > best.members.length ? s : best,
        )
        largest.rawPageCount += diff
      }

      for (const { members, rawPageCount } of subClusters) {
        const rep = members.reduce((best, p) => (completeness(p) > completeness(best) ? p : best))
        const avgScore = Math.round(members.reduce((sum, p) => sum + p.overall, 0) / members.length)
        clusters.push({
          id: nextId++,
          representativeUrl: rep.finalUrl,
          pageUrls: members.map((p) => p.finalUrl),
          pageCount: rawPageCount,
          scannedCount: members.length,
          avgScore,
        })
      }
    }
  }

  clusters.sort((a, b) => b.pageCount - a.pageCount)
  return { pages, clusters, failed }
}

// MARK: - Functions

/**
 * Scans a site adaptively: primary URL + sample-per-template of discovered pages.
 *
 * Groups discovered URLs by URL-template (normalised path pattern) and scans at
 * most SAMPLE_PER_TEMPLATE pages per group. If the sample reveals >1 structural
 * cluster the group is expanded fully and re-clustered — avoiding both the
 * wasteful "scan everything" approach and the blind "skip similar URLs" trap.
 *
 * @param {string} inputUrl - The primary URL to scan.
 * @param {IDeepScanOptions} options - Deep-scan options.
 * @returns {Promise<ISiteReport>} - A promise that resolves to an ISiteReport containing the scan results for the site, including the primary scan report, sampled page reports, and structural clusters.
 * @async
 * @export
 */
export async function scanSite(inputUrl: string, options: IDeepScanOptions): Promise<ISiteReport> {
  const startedAt = new Date()
  const log = options.onProgress ?? (() => undefined)
  const providers: IFetchProvider[] = options.providers ?? [new NativeProvider()]
  const native = providers[0] ?? new NativeProvider()
  const limit = options.limit ?? DEFAULT_LIMIT
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY

  const primary =
    options.primary ??
    (await scan(inputUrl, {
      checks: options.checks,
      providers,
      onProgress: log,
    }))

  const skip = options.skip ?? 0
  let urls: TUrl[] = []
  let discovered = 0
  if (primary.meta.fetchOk !== false && limit > 0) {
    log('Discovering pages (sitemap + links)')
    const discovery = await discoverPages((u) => native.rawFetch(u), primary.finalUrl, {
      maxUrls: limit + skip,
    })
    discovered = discovery.discovered
    urls = discovery.urls.slice(skip, skip + limit)
  }

  const pageChecks = options.checks.filter((c) => c.scope !== ECheckScope.SITE)

  const { pages, clusters, failed } = await scanAdaptive(
    urls,
    primary,
    pageChecks,
    providers,
    concurrency,
    log,
  )

  // Restore discovery order; workers finish out of order.
  pages.sort((a, b) => urls.indexOf(a.url) - urls.indexOf(b.url))

  const overall = Math.round(
    (primary.overall * 2 + pages.reduce((sum, p) => sum + p.overall, 0)) / (2 + pages.length),
  )

  return {
    url: primary.finalUrl,
    scoreVersion: SCORE_VERSION,
    overall,
    grade: gradeOf(overall),
    categories: aggregateCategories(primary, pages),
    primary,
    pages,
    discovered,
    failed,
    clusters,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  }
}

// MARK: - Aggregation

/**
 * Per-category site score: mean across pages that ran checks in the category
 * (site-scope categories live on the primary only), primary double-weighted.
 *
 * @param {IScanReport} primary - The primary scan report containing site-scope checks and categories.
 * @param {IScanReport[]} pages - An array of scan reports for the discovered pages, containing page-scope checks and categories.
 * @returns {ICategoryScore[]} - An array of ICategoryScore objects representing the aggregated category scores for the site, with primary double-weighted and checks emptied.
 */
function aggregateCategories(primary: IScanReport, pages: IScanReport[]): ICategoryScore[] {
  return primary.categories.map((base) => {
    let weighted = base.score * 2
    let total = 2
    for (const page of pages) {
      const match = page.categories.find((c) => c.category === base.category)
      if (match !== undefined && match.checks.length > 0) {
        weighted += match.score
        total += 1
      }
    }
    return { ...base, score: Math.round(weighted / total), checks: [] }
  })
}

/**
 * Fail/warn verdicts grouped by check across every scanned page — failures
 * first, then by how many pages each one hurts.
 *
 * @param {ISiteReport} site - The site report containing the primary and page scan reports.
 * @returns {ISiteFindingGroup[]} - An array of ISiteFindingGroup objects representing the aggregated findings for the site, grouped by check across all scanned pages, with failures prioritized and sorted by the number of affected pages.
 * @export
 */
export function aggregateSiteFindings(site: ISiteReport): ISiteFindingGroup[] {
  const groups = new Map<string, ISiteFindingGroup>()

  for (const report of [site.primary, ...site.pages]) {
    for (const check of report.checks) {
      if (check.status !== EStatus.FAIL && check.status !== EStatus.WARN) {
        continue
      }
      const existing = groups.get(check.id)
      if (existing === undefined) {
        groups.set(check.id, { result: check, pages: [report.finalUrl] })
      } else {
        existing.pages.push(report.finalUrl)
        if (check.status === EStatus.FAIL && existing.result.status !== EStatus.FAIL) {
          existing.result = check
        }
      }
    }
  }

  return [...groups.values()].toSorted((a, b) => {
    const failDiff =
      Number(b.result.status === EStatus.FAIL) - Number(a.result.status === EStatus.FAIL)
    return failDiff !== 0 ? failDiff : b.pages.length - a.pages.length
  })
}

// MARK: - Structural clustering

/**
 * Same heuristic as template-sample.ts: prefer pages that fetched OK, with more
 * passing checks and a higher score — picks the fullest exemplar of a layout.
 *
 * @param {IScanReport} page - The scan report for a page, containing metadata about the fetch status, checks performed, and overall score.
 * @returns {number} - A numeric value representing the completeness of the page, calculated based on whether the page fetched successfully, the number of passing checks, and the overall score. Higher values indicate a more complete page.
 */
function completeness(page: IScanReport): number {
  const fetched = page.meta.fetchOk ? 1 : 0
  const passes = page.checks.filter((c) => c.status === 'pass').length

  return fetched * 10_000 + passes * 100 + page.overall
}

/**
 * Groups `primary` and `pages` into structural clusters and returns the enriched
 * cluster array for `ISiteReport.clusters`.
 *
 * Extracted as a standalone export so it can be unit-tested without a network call.
 *
 * @param {IScanReport} primary - The primary scan report for the main URL, which is treated as a pre-scanned member of its template group.
 * @param {IScanReport[]} pages - An array of scan reports for the discovered pages, containing page-scope checks and categories.
 *
 * @returns {ISiteCluster[]} - An array of ISiteCluster objects representing the structural clusters found in the scanned pages, including the primary scan report and the additional page reports.
 * @export
 */
export function buildStructuralClusters(
  primary: IScanReport,
  pages: IScanReport[],
): ISiteCluster[] {
  const all = [primary, ...pages]
  const raw = clusterByStructure(
    all.map((p) => ({ id: p.finalUrl, fingerprint: p.fingerprint ?? [] })),
  )

  return [...raw.entries()]
    .map(([id, memberUrls]) => {
      const members = all.filter((p) => memberUrls.includes(p.finalUrl))
      const rep = members.reduce((best, p) => (completeness(p) > completeness(best) ? p : best))
      const avgScore = Math.round(members.reduce((sum, p) => sum + p.overall, 0) / members.length)

      return {
        id,
        representativeUrl: rep.finalUrl,
        pageUrls: memberUrls,
        pageCount: memberUrls.length,
        scannedCount: memberUrls.length, // all members scanned — no sampling in this helper
        avgScore,
      }
    })
    .toSorted((a, b) => b.pageCount - a.pageCount)
}

// MARK: - Discovery

/**
 * Candidate page URLs discovered from a site, including both sitemap entries and same-host links from the homepage. The `urls` array contains the deduplicated and shallow-first list of candidate URLs, while the `discovered` property indicates the total number of unique candidates seen during the discovery process, even if they exceed the cap specified by `maxUrls`.
 *
 * @interface IDiscoveryResult
 * @typedef {IDiscoveryResult}
 * @export
 */
export interface IDiscoveryResult {
  /** Candidate page URLs, deduped and shallow-first, capped at maxUrls per source. */
  urls: TUrl[]

  /** TOTAL unique candidates seen — counting keeps going past the cap. */
  discovered: number
}

/**
 * Candidate page URLs for a site, deduped and shallow-first: sitemap entries
 * (recursing one level into sitemap indexes) then same-host links from the
 * homepage. The primary URL itself is excluded.
 *
 * @param {(url: TUrl) => Promise<IRawResponse>} fetcher  - A function that fetches a URL and returns a promise resolving to an IRawResponse.
 * @param {TUrl} primaryUrl - The primary URL of the site to discover pages for.
 * @param {IDiscoverOptions} [options={}] - Optional discovery options, including maxUrls to cap candidates per source.
 * @returns {Promise<IDiscoveryResult>} - A promise that resolves to an IDiscoveryResult containing the discovered candidate page URLs and the total number of unique candidates seen.
 * @export
 * @async
 */
export async function discoverPages(
  fetcher: (url: TUrl) => Promise<IRawResponse>,
  primaryUrl: TUrl,
  options: IDiscoverOptions = {},
): Promise<IDiscoveryResult> {
  const maxUrls = options.maxUrls ?? DEFAULT_MAX_URLS
  const host = hostOf(primaryUrl)
  const seen = new Set<string>([normalizeForDedupe(primaryUrl)])
  const fromSitemap: TUrl[] = []
  const fromLinks: TUrl[] = []
  let discovered = 0

  const add = (target: TUrl[], candidate: string): void => {
    const url = sanitizeCandidate(candidate, primaryUrl, host)
    if (url === null) {
      return
    }
    const key = normalizeForDedupe(url)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    discovered += 1
    if (target.length < maxUrls) {
      target.push(url)
    }
  }

  // Sitemap: robots.txt directive, else /sitemap.xml; recurse one index level.
  const robotsRes = await fetcher(new URL('/robots.txt', primaryUrl).toString())
  const robotsSitemaps =
    robotsRes.error === undefined && robotsRes.status < 400
      ? parseRobots(robotsRes.body).sitemaps
      : []
  const sitemapUrl = robotsSitemaps[0] ?? new URL('/sitemap.xml', primaryUrl).toString()
  const sitemapRes = await fetcher(sitemapUrl)
  if (sitemapRes.error === undefined && sitemapRes.ok) {
    const locs = extractLocs(sitemapRes.body)
    if (/<sitemapindex/i.test(sitemapRes.body)) {
      // Fetch enough children to satisfy maxUrls, bounded; unbounded only when
      // no limit was requested (CLI without --limit).
      const childCount = Number.isFinite(maxUrls)
        ? Math.min(MAX_CHILD_SITEMAPS, Math.max(3, Math.ceil(maxUrls / URLS_PER_CHILD_SITEMAP)))
        : locs.length
      const children = await Promise.all(
        locs.slice(0, childCount).map((child) => fetcher(child).catch(() => null)),
      )
      for (const child of children) {
        if (child !== null && child.error === undefined && child.ok) {
          for (const loc of extractLocs(child.body)) {
            add(fromSitemap, loc)
          }
        }
      }
    } else {
      for (const loc of locs) {
        add(fromSitemap, loc)
      }
    }
  }

  // Same-host links from the homepage HTML.
  const homeRes = await fetcher(primaryUrl)
  if (homeRes.error === undefined && homeRes.ok) {
    for (const href of extractHrefs(homeRes.body)) {
      add(fromLinks, href)
    }
  }

  // Shallow pages best represent a site's templates; sort by path depth.
  const byDepth = (a: string, b: string): number => pathDepth(a) - pathDepth(b)

  return {
    urls: [...fromSitemap.toSorted(byDepth), ...fromLinks.toSorted(byDepth)],
    discovered,
  }
}

// MARK: - internal

/**
 * Extracts <loc> entries from a sitemap XML string, up to a maximum number of entries.
 *
 * @param {string} xml - The sitemap XML string to parse for <loc> entries.
 * @returns {string[]} - An array of extracted <loc> URLs from the sitemap XML, limited to MAX_SITEMAP_PARSE entries.
 */
function extractLocs(xml: string): string[] {
  const locs: string[] = []
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi
  let m: RegExpExecArray | null

  while ((m = re.exec(xml)) !== null && locs.length < MAX_SITEMAP_PARSE) {
    locs.push(m[1] ?? '')
  }

  return locs
}

/**
 * Extracts <a> href attributes from HTML string, up to a maximum number of entries.
 *
 * @param {string} html - The HTML string to parse for <a> tags.
 * @returns {string[]} - An array of extracted href URLs from the HTML, limited to MAX_HREFS entries.
 */
function extractHrefs(html: string): string[] {
  const hrefs: string[] = []
  const re = /<a\b[^>]*?\bhref\s*=\s*["']([^"'#][^"']*)["']/gi
  let m: RegExpExecArray | null

  while ((m = re.exec(html)) !== null && hrefs.length < MAX_HREFS) {
    hrefs.push(m[1] ?? '')
  }

  return hrefs
}

/**
 * Sanitizes a candidate URL by resolving it against a base URL and checking its validity.
 *
 * @param {string} candidate - The candidate URL to sanitize.
 * @param {TUrl} baseUrl - The base URL to resolve the candidate against.
 * @param {string} host - The host to check against.
 * @returns {(TUrl | null)} - The sanitized URL or null if it's invalid.
 */
function sanitizeCandidate(candidate: string, baseUrl: TUrl, host: string): TUrl | null {
  if (candidate.startsWith('mailto:') || candidate.startsWith('tel:')) {
    return null
  }
  let absolute: TUrl
  try {
    absolute = resolveUrl(baseUrl, candidate)
  } catch {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(absolute)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }
  if (parsed.host !== host) {
    return null
  }
  if (SKIP_EXTENSION_RE.test(parsed.pathname)) {
    return null
  }
  parsed.hash = ''

  return parsed.toString()
}

/**
 * Normalizes a URL for deduplication by removing the hash and trailing slashes,
 * and returning a string representation of the host, path, and search parameters.
 *
 * @param {TUrl} url - The URL to normalize for deduplication.
 * @returns {string} - The normalized string representation of the URL, suitable for deduplication.
 */
function normalizeForDedupe(url: TUrl): string {
  try {
    const parsed = new URL(normalizeUrl(url))
    parsed.hash = ''
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.host}${path}${parsed.search}`
  } catch {
    return url
  }
}

/**
 * Calculates the depth of a URL's path by counting the number of segments in the pathname.
 *
 * @param {TUrl} url - The URL for which to calculate the path depth.
 * @returns {number} - The depth of the URL's path, or 99 if the URL is invalid.
 */
function pathDepth(url: TUrl): number {
  try {
    return new URL(url).pathname.split('/').filter((s) => s.length > 0).length
  } catch {
    return 99
  }
}
