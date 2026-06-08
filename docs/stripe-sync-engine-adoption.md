# Adopting the Supabase Stripe Sync Engine

This is the migration plan for moving billing reconciliation onto the **Stripe
Sync Engine** (`@supabase/stripe-sync-engine`, co-maintained by Stripe and
Supabase) while keeping `profiles.plan` as the fast, RLS-enforced entitlement
cache. It is a **hybrid**: the Sync Engine becomes the system-of-record mirror;
the app keeps `checkout.ts` (subscription create/reprice) and a thin DB mapping
from the mirrored Stripe data to `profiles.plan` / `api_keys.plan`.

> The Sync Engine's managed install is **Supabase-hosted** (Edge Functions +
> Queues). It is **not** run on Vercel. Steps 1–2 are dashboard/ops actions you
> perform; steps 3–4 are code/SQL we land once the engine is live.

## Why

- The Sync Engine ingests Stripe webhooks into a Postgres `stripe` schema and
  runs a **scheduled backfill**, so a dropped or once-failed event self-heals on
  the next sync. This is the structural fix for **SEV-2** (a transient failure
  can no longer strand `profiles.plan`).
- It does **not** enforce business rules ("one active subscription per
  customer") — it mirrors whatever exists in Stripe. So the SEV-1, SEV-3 and
  SEV-4 hardening below is still required regardless of the engine.

## Status of the four hardening items

| Item                                       | Handled by                                                    | Where                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEV-1** duplicate-subscription race      | App code (shipped)                                            | Idempotency keys on customer/session create + webhook `reconcileDuplicateSubscriptions` — `apps/web/lib/checkout.ts`, `apps/web/app/api/stripe/webhook/route.ts` |
| **SEV-2** once-failed event dropped        | Sync Engine (after install) **or** app code (shipped interim) | Engine backfill; interim fix gates dedup on `processed_at` — `webhook/route.ts`                                                                                  |
| **SEV-3** one customer per row             | DB migration (apply this)                                     | `packages/supabase/migrations/20260618120000_stripe_customer_unique.sql`                                                                                         |
| **SEV-4** Stripe one-subscription redirect | Dashboard toggle (Step 2)                                     | Stripe Dashboard                                                                                                                                                 |

## Step 1 — Install the Sync Engine (Supabase dashboard)

1. Supabase project → **Integrations → Stripe Sync Engine → Install**.
2. Provide a **restricted Stripe key** (read access to customers, subscriptions,
   invoices, prices, products, payment methods is enough).
3. Let the **initial backfill** run (minutes to hours, depending on account
   size). It populates the `stripe` schema.
4. In the **Stripe Dashboard → Developers → Webhooks**, repoint (or add) the
   endpoint to the **Supabase-hosted `/webhooks` URL** the integration shows.
   Keep our `/api/stripe/webhook` live in parallel until cutover (Step 4).

## Step 2 — Enable Stripe's native one-subscription redirect (SEV-4)

Stripe Dashboard → **Settings → Checkout and Payment Links → Subscriptions** →
enable **"Limit customers to one subscription"** (requires the customer-portal
login link to be enabled). This redirects an already-subscribed customer away
from a new hosted Checkout. Note it only covers **hosted Checkout** — it does
**not** block API-created duplicates, so the SEV-1 server guard above stays
mandatory. Treat it as cheap defense-in-depth.

## Step 3 — Map `stripe.subscriptions` → `profiles.plan` (after backfill)

Keep `profiles.plan` as the entitlement cache (indexed, read on every request,
enforced by RLS) — never read Stripe live on the hot path. Populate it from the
mirror with a trigger that ports `planFromPrice` / `planFromStatus` /
`higherPlan` (`apps/web/lib/stripe-plan.ts`) into SQL.

Because a trigger cannot read env vars, the Pro/Team **price ids** must live in
the database. Add a tiny map and a trigger (apply only **after** the `stripe`
schema exists):

```sql
-- Price → plan map (mirror of STRIPE_PRO_PRICE_ID / STRIPE_TEAM_PRICE_ID).
create table if not exists public.billing_price_plan (
  price_id text primary key,
  plan text not null check (plan in ('pro', 'team'))
);
-- insert into public.billing_price_plan values
--   ('price_xxx_pro', 'pro'), ('price_xxx_team', 'team');

create or replace function public.sync_plan_from_stripe()
returns trigger language plpgsql security definer as $$
declare
  v_plan text;
begin
  -- Highest-ranked plan across the customer's usable subscriptions.
  select coalesce(max(case m.plan when 'team' then 2 when 'pro' then 1 else 0 end), 0)
  into v_plan
  from stripe.subscriptions s
  join public.billing_price_plan m
    on m.price_id = s.attrs->'items'->'data'->0->'price'->>'id'
  where s.customer = new.customer
    and s.status in ('active', 'trialing', 'past_due');

  update public.profiles p
     set plan = case when v_plan = '2' then 'team' when v_plan = '1' then 'pro' else 'free' end
   where p.stripe_customer_id = new.customer;
  return new;
end; $$;

create trigger sync_plan_after_stripe_subscription
  after insert or update on stripe.subscriptions
  for each row execute function public.sync_plan_from_stripe();
```

> Adjust the `attrs` JSON path to the Sync Engine's actual column layout (it
> stores Stripe objects as JSONB + generated columns; check the installed
> `stripe.subscriptions` shape). The mapping must be idempotent so re-runs during
> backfill don't thrash `profiles.plan`.

## Step 4 — Cutover and cleanup

1. Run the engine + custom `/api/stripe/webhook` in parallel for a short window;
   confirm `profiles.plan` tracks Stripe correctly via the trigger.
2. Remove the Stripe webhook endpoint that points at `/api/stripe/webhook`.
3. Retire the now-redundant custom code:
   - `apps/web/app/api/stripe/webhook/route.ts` — `handleEvent` / `syncSubscription`
     / `highestActivePlan` / `resolveCard` (engine ingests; mapping is the trigger).
   - the `stripe_webhook_events` table + its migration (the engine has its own
     idempotency) — drop **only after** cutover.
   - the reconciliation parts of `stripe-plan.ts` (logic now lives in the trigger).
4. **Keep**: `checkout.ts` (create/reprice + SEV-1 guard), `subscription.ts` (UI
   state machine), `billing-seats.ts`, `entitlements.ts`.

## References

- https://supabase.com/blog/stripe-sync-engine-integration
- https://github.com/stripe/sync-engine
- https://docs.stripe.com/payments/checkout/limit-subscriptions
- https://docs.stripe.com/api/idempotent_requests
