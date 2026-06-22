import type { Json } from '@isreadyai/supabase'
import type { IScanReport, ISiteReport, TGrade } from '@isreadyai/scanner'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { gradeOf, isGrade, isSiteReport } from '@isreadyai/scanner'
import { requireSuccess } from '@/lib/db'
import { combinedScoreFromRow, scanSummaryColumns } from '@/lib/score'
import { isPaidPlan, planOrFree } from '@/lib/plans'
import { hostOf, normalizeHost } from '@/lib/url'
import { ownerPlanForWorkspace } from '@/lib/workspace'

// MARK: - CI reports (the audit action's authenticated upload + repo badge)

/**
 * Repo identity is IMMUTABLE: keyed on GitHub's numeric repository_id, never
 * owner/repo. Each repo gets one stable opaque slug, minted once and reused
 * forever, so a README badge survives a rename or transfer. owner/repo is kept
 * for display only and refreshed on every upload.
 */

type TServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/**
 * A different account tried to upload against a repository_id already registered
 * to someone else. repository_id is PUBLIC, so this would otherwise let any
 * premium key seize a victim's badge + report page. The route maps it to 403.
 */
export class CiRepoTakeoverError extends Error {
  constructor(repositoryId: string) {
    super(`ci repo ${repositoryId} is registered to another account`)
    this.name = 'CiRepoTakeoverError'
  }
}

/** Rejects an upload whose account does not own the existing repo registration. */
export function assertRepoOwnership(
  repositoryId: string,
  existingUserId: string | null,
  ownerUserId: string,
): void {
  if (existingUserId !== ownerUserId) {
    throw new CiRepoTakeoverError(repositoryId)
  }
}

export interface ICiUploadInput {
  repositoryId: string
  ownerRepo: string
  branch: string
  commit: string
  /** Scanned URL (production domain, localhost or preview). */
  url: string
  /** The action sends a --deep ISiteReport; a single IScanReport is also accepted. */
  report: IScanReport | ISiteReport
  /** The verified premium API key performing the upload. */
  apiKeyId: string
  ownerUserId: string
}

export interface ICiUploadResult {
  slug: string
  branch: string
  commit: string
  score: number | null
  grade: TGrade | null
  linkedWebsite: boolean
}

export interface ICiBadgeScore {
  score: number | null
  grade: TGrade | null
}

function randomSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `gh_${hex}`
}

function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0] ?? ''
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.localhost')) {
    return false
  }
  // Bare IPs and private ranges are never a "verified production domain".
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return false
  }
  return h.includes('.')
}

/**
 * Persists a CI scan: stores the scan (source='action'), upserts the repo's
 * stable slug, and records the CI report keyed by (repo, branch, commit). The
 * scan is linked to a tracked website ONLY when the scanned host is that
 * website's verified production domain, owned by the uploading key's account,
 * on a premium plan. localhost / preview / external hosts stay repo-scoped.
 */
export async function persistCiReport(input: ICiUploadInput): Promise<ICiUploadResult | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const client = await createServiceClient()

  const primary: IScanReport = isSiteReport(input.report) ? input.report.primary : input.report
  const siteReport: ISiteReport | null = isSiteReport(input.report) ? input.report : null
  const host = hostOf(primary.finalUrl)

  const websiteLink = isPublicHost(host)
    ? await matchVerifiedWebsite(client, host, input.ownerUserId)
    : null

  // Resolve the repo first: upsertRepo rejects an ownership takeover, so a
  // hijack attempt fails before any scan/report row is written.
  const slug = await upsertRepo(client, input)
  if (slug === null) {
    return null
  }
  const { data: repo } = await client.from('ci_repos').select('id').eq('slug', slug).maybeSingle()
  if (repo === null) {
    return null
  }

  // Store the single-page report in `report` and the crawl in `site_report`,
  // matching how the web persists scans — so scoring and the report view work.
  const reportJson = primary as unknown as Json
  const siteReportJson = siteReport as unknown as Json | null
  const score = combinedScoreFromRow({
    report: reportJson,
    site_report: siteReportJson,
    smart_report: null,
    smart_site_report: null,
  })
  const grade = score === null ? null : gradeOf(score)

  const scanId = crypto.randomUUID()
  const { error: scanError } = await client.from('scans').insert({
    id: scanId,
    url: primary.finalUrl,
    status: 'done',
    source: 'action',
    report: reportJson,
    site_report: siteReportJson,
    smart_status: 'disabled',
    // Materialize the summary inline (the data is right here, no re-read needed).
    ...scanSummaryColumns({
      report: reportJson,
      site_report: siteReportJson,
      smart_report: null,
      smart_site_report: null,
    }),
    // Repo-scoped unless matched to the owner's verified production domain.
    user_id: websiteLink?.userId ?? null,
    website_id: websiteLink?.websiteId ?? null,
    workspace_id: websiteLink?.workspaceId ?? null,
    created_at: new Date().toISOString(),
  })
  if (scanError !== null) {
    throw new Error(`ci scan insert failed: ${scanError.message}`)
  }

  requireSuccess(
    await client.from('ci_reports').insert({
      repo_id: repo.id,
      scan_id: scanId,
      branch: input.branch,
      commit_sha: input.commit,
      score,
      grade,
    }),
    'ci_reports insert',
  )

  return {
    slug,
    branch: input.branch,
    commit: input.commit,
    score,
    grade,
    linkedWebsite: websiteLink !== null,
  }
}

/** Mints (or reuses) the immutable slug for a repository_id; refreshes display fields. */
async function upsertRepo(client: TServiceClient, input: ICiUploadInput): Promise<string | null> {
  const { data: existing } = await client
    .from('ci_repos')
    .select('slug, user_id')
    .eq('repository_id', input.repositoryId)
    .maybeSingle()
  if (existing !== null) {
    // Reject takeover, then refresh display fields only — never reassign
    // api_key_id/user_id to another account.
    assertRepoOwnership(input.repositoryId, existing.user_id, input.ownerUserId)
    requireSuccess(
      await client
        .from('ci_repos')
        .update({
          owner_repo: input.ownerRepo,
          updated_at: new Date().toISOString(),
        })
        .eq('repository_id', input.repositoryId),
      'ci_repos update',
    )
    return existing.slug
  }

  const slug = randomSlug()
  const { error } = await client.from('ci_repos').insert({
    slug,
    repository_id: input.repositoryId,
    owner_repo: input.ownerRepo,
    api_key_id: input.apiKeyId,
    user_id: input.ownerUserId,
  })
  if (error !== null) {
    // Lost a race on the unique repository_id — read the winner's slug.
    const { data: raced } = await client
      .from('ci_repos')
      .select('slug')
      .eq('repository_id', input.repositoryId)
      .maybeSingle()
    return raced?.slug ?? null
  }
  return slug
}

interface IWebsiteLink {
  websiteId: string
  workspaceId: string
  userId: string
}

/**
 * A scanned host links to a website ONLY when it is that website's verified,
 * badge-activated production domain in a workspace the uploading key's account
 * belongs to, on a premium plan. Entitlement and ownership follow the WORKSPACE
 * (owner's plan + member set), not the domain's original creator.
 */
async function matchVerifiedWebsite(
  client: TServiceClient,
  host: string,
  ownerUserId: string,
): Promise<IWebsiteLink | null> {
  const normalized = normalizeHost(host)
  const { data: website } = await client
    .from('websites')
    .select('id, workspace_id, badge_enabled')
    .eq('host', normalized)
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  // badge_enabled is the domain's activation flag (orthogonal to monitoring).
  if (website === null || website.workspace_id === null || website.badge_enabled !== true) {
    return null
  }
  // The uploading account must be an active member of the website's workspace.
  const { data: membership } = await client
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', website.workspace_id)
    .eq('user_id', ownerUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (membership === null) {
    return null
  }
  if (!isPaidPlan(await ownerPlanForWorkspace(client, website.workspace_id))) {
    return null
  }
  return { websiteId: website.id, workspaceId: website.workspace_id, userId: ownerUserId }
}

/**
 * Latest CI score for a branch's HEAD, gated by the premium plan of the API key
 * that registered the repo (no domain verification needed). Returns null when
 * the slug is unknown or the registering key's owner is no longer premium — the
 * caller then renders the locked badge.
 */
export async function ciBranchBadgeScore(
  slug: string,
  branch: string,
): Promise<ICiBadgeScore | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const client = await createServiceClient()
  const repo = await premiumRepoBySlug(client, slug)
  if (repo === null) {
    return null
  }
  const { data: latest } = await client
    .from('ci_reports')
    .select('score, grade')
    .eq('repo_id', repo.id)
    .eq('branch', branch)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latest === null) {
    return { score: null, grade: null }
  }
  return { score: latest.score, grade: isGrade(latest.grade) ? latest.grade : null }
}

/** Resolves the scan id for a slug+commit so the report page can render it. */
export async function ciScanIdForCommit(slug: string, commit: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null
  }
  const client = await createServiceClient()
  const { data: repo } = await client.from('ci_repos').select('id').eq('slug', slug).maybeSingle()
  if (repo === null) {
    return null
  }
  const { data: report } = await client
    .from('ci_reports')
    .select('scan_id')
    .eq('repo_id', repo.id)
    .eq('commit_sha', commit)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return report?.scan_id ?? null
}

// MARK: - internal

async function premiumRepoBySlug(
  client: TServiceClient,
  slug: string,
): Promise<{ id: string } | null> {
  const { data: repo } = await client
    .from('ci_repos')
    .select('id, api_key_id')
    .eq('slug', slug)
    .maybeSingle()
  if (repo === null || repo.api_key_id === null) {
    return null
  }
  const { data: key } = await client
    .from('api_keys')
    .select('user_id, workspace_id, revoked_at')
    .eq('id', repo.api_key_id)
    .maybeSingle()
  if (key === null || key.revoked_at !== null || key.user_id === null) {
    return null
  }
  // Entitlement follows the key's workspace owner; legacy keys (no workspace)
  // fall back to the registering account's own plan.
  let plan
  if (key.workspace_id !== null) {
    plan = await ownerPlanForWorkspace(client, key.workspace_id)
  } else {
    const { data: profile } = await client
      .from('profiles')
      .select('plan')
      .eq('id', key.user_id)
      .maybeSingle()
    plan = planOrFree(profile?.plan)
  }
  if (!isPaidPlan(plan)) {
    return null
  }
  return { id: repo.id }
}
