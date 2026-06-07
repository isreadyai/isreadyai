#!/usr/bin/env bun
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { isPaidPlan, planOrFree } from '../apps/web/lib/plans.ts'

/**
 * Premium-gating diagnostic
 *
 * Reproduces the exact owner-plan resolution that resolveWorkspaceContext drives
 * the premium gate from. For each email it prints the user's own plan, then every
 * ACTIVE workspace membership and — per workspace — the active owner, the owner's
 * plan, and isPaidPlan(owner's plan). That is precisely what `premium` resolves to
 * for a member there, so it tells a genuinely Free owner (gate correct) apart from
 * a paid owner that still resolves false (a real bug). Read-only; run from repo
 * root so bun auto-loads .env. Pass one or more emails as arguments.
 */

if (!isSupabaseConfigured()) {
  console.error('Supabase env missing. Run from the repo root so bun loads .env:')
  console.error('  bun scripts/diag-premium.ts <email> [more-emails...]')
  process.exit(1)
}

const emails = process.argv.slice(2)
if (emails.length === 0) {
  console.error('Usage: bun scripts/diag-premium.ts <email> [more-emails...]')
  process.exit(1)
}
const service = await createServiceClient()

for (const email of emails) {
  console.log(`\n=== ${email} ===`)
  const { data: profile } = await service
    .from('profiles')
    .select('id, email, plan')
    .eq('email', email)
    .maybeSingle()
  if (profile === null) {
    console.log('  no profiles row for this email')
    continue
  }
  console.log(`  user id:       ${profile.id}`)
  console.log(`  profiles.plan: ${profile.plan ?? '(null)'}`)

  const { data: memberships } = await service
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', profile.id)
    .eq('status', 'active')
  const rows = memberships ?? []
  if (rows.length === 0) {
    console.log('  active memberships: none')
    continue
  }
  console.log(`  active memberships: ${rows.length}`)

  for (const m of rows) {
    const { data: ws } = await service
      .from('workspaces')
      .select('id, name, slug')
      .eq('id', m.workspace_id)
      .maybeSingle()
    // Mirror resolveWorkspaceContext: the active row whose role is 'owner', first wins.
    const { data: owners } = await service
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', m.workspace_id)
      .eq('role', 'owner')
      .eq('status', 'active')
    const owner = (owners ?? [])[0] ?? null
    const { data: ownerProfile } = owner
      ? await service.from('profiles').select('email, plan').eq('id', owner.user_id).maybeSingle()
      : { data: null }
    const ownerPlan = planOrFree(ownerProfile?.plan)
    const premium = isPaidPlan(ownerPlan)

    console.log(`\n  • workspace: ${ws?.name ?? '—'}  [slug: ${ws?.slug ?? '?'}]`)
    console.log(`      id:           ${m.workspace_id}`)
    console.log(`      my role:      ${m.role}`)
    console.log(`      owner id:     ${owner?.user_id ?? '(NO active owner row!)'}`)
    console.log(`      owner email:  ${ownerProfile?.email ?? '(unknown)'}`)
    console.log(`      owner plan:   ${ownerProfile?.plan ?? '(null)'}  ->  resolved ${ownerPlan}`)
    console.log(`      => premium (isPaidPlan): ${premium}`)
  }
}

process.exit(0)
