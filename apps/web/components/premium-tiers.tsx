import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { PlanIcon } from '@/components/ui/plan-icon'
import { resolveEntitlements } from '@/lib/entitlements'
import { EPlan } from '@/lib/plans'
import type { TPaidPlan, TPlan } from '@/lib/plans'
import type { IPlanPrice } from '@/lib/plan-prices'

export interface ITierPrices {
  pro: IPlanPrice | null
  team: IPlanPrice | null
}

// MARK: - Premium tiers comparison

// The Free tier splits into two surfaces — the in-browser web app and the CLI —
// because some capabilities (CLI/CI, report output) are free on the CLI while
// account-bound features (history, badge, monitoring) are not free on either.
interface ITierRow {
  key: string
  soon?: boolean
  freeWeb: boolean
  freeCli: boolean
  pro: boolean
  team: boolean
}

type TGroupIcon = 'scan' | 'resolve' | 'account'

interface ITierGroup {
  key: string
  icon: TGroupIcon
  rows: ITierRow[]
}

const GROUPS: ITierGroup[] = [
  {
    key: 'groupScan',
    icon: 'scan',
    rows: [
      { key: 'fAudit', freeWeb: true, freeCli: true, pro: true, team: true },
      { key: 'fDeepScan', freeWeb: true, freeCli: true, pro: true, team: true },
      { key: 'fSmartCheck', freeWeb: true, freeCli: true, pro: true, team: true },
      { key: 'fReport', freeWeb: true, freeCli: true, pro: true, team: true },
    ],
  },
  {
    key: 'groupResolution',
    icon: 'resolve',
    rows: [
      // Resolution plan: free on the CLI (--llm), premium on the web (Solution section).
      { key: 'fResolution', freeWeb: false, freeCli: true, pro: true, team: true },
      { key: 'fCliAction', freeWeb: false, freeCli: true, pro: true, team: true },
      { key: 'fAsk', freeWeb: false, freeCli: false, pro: true, team: true },
      { key: 'fSmartDeep', freeWeb: false, freeCli: false, pro: true, team: true },
      { key: 'fFixPlans', freeWeb: false, freeCli: false, soon: true, pro: true, team: true },
    ],
  },
  {
    key: 'groupAccount',
    icon: 'account',
    rows: [
      { key: 'fBadge', freeWeb: false, freeCli: false, pro: true, team: true },
      { key: 'fHistory', freeWeb: false, freeCli: false, pro: true, team: true },
      { key: 'fMonitoring', freeWeb: false, freeCli: false, pro: true, team: true },
    ],
  },
]

const QUOTA: Record<TPlan, string> = {
  [EPlan.FREE]: '—',
  [EPlan.PRO]: '200',
  [EPlan.TEAM]: '1000',
}
// Ask-your-site chat allowance, sourced from the same entitlements the route enforces.
const CHAT_QUOTA: Record<TPlan, string> = {
  [EPlan.FREE]: String(resolveEntitlements(EPlan.FREE).chatMessagesPerMonth),
  [EPlan.PRO]: String(resolveEntitlements(EPlan.PRO).chatMessagesPerMonth),
  [EPlan.TEAM]: String(resolveEntitlements(EPlan.TEAM).chatMessagesPerMonth),
}
const PAID_TIERS = [EPlan.PRO, EPlan.TEAM] as const satisfies readonly TPaidPlan[]

// Mirrors deepScanLimit() — the env-driven cap on the free in-browser deep scan.
function deepScanLimit(): number {
  const fromEnv = Number(process.env.NEXT_PUBLIC_DEEP_SCAN_LIMIT)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : 10
}

function colClass(tier: TPlan): string {
  return tier === EPlan.PRO ? 'bg-site-secondary/10 border-site-secondary/40 border-x' : ''
}

export function PremiumTiers({
  className = '',
  prices,
}: {
  className?: string
  prices?: ITierPrices | null
}) {
  const t = useTranslations('tiers')
  const markLabels = { on: t('included'), off: t('notIncluded') }

  return (
    <section data-anim="panel" aria-labelledby="tiers-title" className={className}>
      <p className="text-site-secondary font-mono text-xs tracking-wide uppercase">{t('kicker')}</p>
      <h2 id="tiers-title" className="mt-2 text-lg font-semibold">
        {t('title')}
      </h2>
      <p className="text-site-muted mt-1 max-w-2xl text-sm">{t('subtitle')}</p>

      <div className="border-site-border mt-5 overflow-x-auto rounded-2xl border">
        <div className="grid min-w-[44rem] grid-cols-[1.5fr_repeat(2,minmax(0,0.72fr))_repeat(2,minmax(0,1.1fr))]">
          <div className="border-site-border text-site-faint flex items-end border-b px-4 py-4 text-xs font-medium tracking-wide uppercase">
            {t('feature')}
          </div>
          <div className="border-site-border col-span-2 border-b px-2 py-4 text-center">
            <BadgeSlot />
            <span className="flex items-center justify-center gap-1.5 text-base font-bold">
              <PlanIcon plan={EPlan.FREE} className="size-4" />
              {t('free')}
            </span>
            <PriceLine tier={EPlan.FREE} prices={prices} freeLabel={t('priceFree')} />
            <div className="divide-site-border/60 text-site-faint mt-2.5 grid grid-cols-2 divide-x text-[11px] font-semibold tracking-wide uppercase">
              <span>{t('web')}</span>
              <span>{t('cli')}</span>
            </div>
          </div>
          {PAID_TIERS.map((tier) => (
            <div
              key={tier}
              className={`border-site-border border-b px-3 py-4 text-center ${colClass(tier)} ${tier === EPlan.PRO ? 'text-site-secondary' : ''}`}
            >
              <BadgeSlot>
                {tier === EPlan.PRO ? (
                  <span className="bg-site-secondary text-site-secondary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    {t('popular')}
                  </span>
                ) : null}
              </BadgeSlot>
              <span className="flex items-center justify-center gap-1.5 text-base font-bold">
                <PlanIcon plan={tier} className="size-4" />
                {t(tier)}
              </span>
              <PriceLine tier={tier} prices={prices} freeLabel={t('priceFree')} />
            </div>
          ))}

          {GROUPS.map((group) => (
            <div key={group.key} className="contents">
              <GroupHeader icon={group.icon} label={t(group.key)} />
              {group.rows.map((row) => (
                <TierRow
                  key={row.key}
                  row={row}
                  label={
                    row.key === 'fDeepScan' ? t(row.key, { limit: deepScanLimit() }) : t(row.key)
                  }
                  soonLabel={t('soon')}
                  markLabels={markLabels}
                />
              ))}
            </div>
          ))}

          <div className="border-site-border text-site-muted border-t px-4 py-3 text-sm">
            {t('fQuota')}
          </div>
          <div className="border-site-border col-span-2 border-t px-2 py-3 text-center font-mono text-sm">
            {QUOTA[EPlan.FREE]}
          </div>
          {PAID_TIERS.map((tier) => (
            <div
              key={tier}
              className={`border-site-border border-t px-4 py-3 text-center font-mono text-sm ${colClass(tier)}`}
            >
              {QUOTA[tier]}
            </div>
          ))}

          <div className="border-site-border text-site-muted border-t px-4 py-3 text-sm">
            {t('fChatQuota')}
          </div>
          <div className="border-site-border col-span-2 border-t px-2 py-3 text-center font-mono text-sm">
            {CHAT_QUOTA[EPlan.FREE]}
          </div>
          {PAID_TIERS.map((tier) => (
            <div
              key={tier}
              className={`border-site-border border-t px-4 py-3 text-center font-mono text-sm ${colClass(tier)}`}
            >
              {CHAT_QUOTA[tier]}
            </div>
          ))}

          <div className="border-site-border border-t px-4 py-4" />
          <div className="border-site-border col-span-2 border-t px-2 py-4 text-center">
            <Button appearance="outline" variant="neutral" href="/" className="w-full text-xs">
              {t('ctaFree')}
            </Button>
          </div>
          {PAID_TIERS.map((tier) => (
            <div
              key={tier}
              className={`border-site-border border-t px-4 py-4 text-center ${colClass(tier)}`}
            >
              <Button
                variant="secondary"
                appearance={tier === EPlan.PRO ? 'solid' : 'outline'}
                href={`/checkout?plan=${tier}`}
                className="w-full text-xs"
              >
                {t('ctaPaid', { plan: t(tier) })}
              </Button>
            </div>
          ))}

          <div className="text-site-faint col-span-5 px-4 py-3 text-center text-xs">
            {t('reassurance')}
          </div>
        </div>
      </div>
    </section>
  )
}

function BadgeSlot({ children }: { children?: ReactNode }) {
  return <div className="mb-1.5 flex min-h-[1.125rem] items-center justify-center">{children}</div>
}

function GroupHeader({ icon, label }: { icon: TGroupIcon; label: string }) {
  return (
    <>
      <div className="border-site-border bg-site-raised/40 text-site-faint flex items-center gap-2 border-t px-4 py-2 text-[11px] font-semibold tracking-wide uppercase">
        <GroupIcon name={icon} />
        {label}
      </div>
      <div className="border-site-border bg-site-raised/40 col-span-2 border-t" />
      <div className={`border-site-border border-t ${colClass(EPlan.PRO)}`} />
      <div className="border-site-border bg-site-raised/40 border-t" />
    </>
  )
}

function TierRow({
  row,
  label,
  soonLabel,
  markLabels,
}: {
  row: ITierRow
  label: string
  soonLabel: string
  markLabels: { on: string; off: string }
}) {
  return (
    <>
      <div className="border-site-border/60 flex items-center gap-2 border-t px-4 py-3 text-sm">
        <span>{label}</span>
        {row.soon ? (
          <span className="border-site-border text-site-faint rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
            {soonLabel}
          </span>
        ) : null}
      </div>
      <div className="border-site-border/60 flex items-center justify-center border-t px-2 py-3">
        <Mark on={row.freeWeb} premium={false} labels={markLabels} />
      </div>
      <div className="border-site-border/60 flex items-center justify-center border-t px-2 py-3">
        <Mark on={row.freeCli} premium={false} labels={markLabels} />
      </div>
      {PAID_TIERS.map((tier) => (
        <div
          key={tier}
          className={`border-site-border/60 flex items-center justify-center border-t px-4 py-3 ${
            tier === EPlan.PRO ? 'bg-site-secondary/10 border-x-site-secondary/40 border-x' : ''
          }`}
        >
          <Mark on={row[tier]} premium labels={markLabels} />
        </div>
      ))}
    </>
  )
}

function Mark({
  on,
  premium,
  labels,
}: {
  on: boolean
  premium: boolean
  labels: { on: string; off: string }
}) {
  if (!on) {
    return (
      <span
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- icon badge with children (text/SVG); <img> is self-closing and cannot contain them
        role="img"
        aria-label={labels.off}
        className="bg-site-raised/60 text-site-faint inline-flex size-5 items-center justify-center rounded-full text-xs"
      >
        <span aria-hidden="true">–</span>
      </span>
    )
  }
  return (
    <span
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- icon badge with children (text/SVG); <img> is self-closing and cannot contain them
      role="img"
      aria-label={labels.on}
      className={`inline-flex size-5 items-center justify-center rounded-full ${
        premium
          ? 'bg-site-secondary/15 text-site-secondary'
          : 'bg-score-excellent/15 text-score-excellent'
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
      </svg>
    </span>
  )
}

function GroupIcon({ name }: { name: TGroupIcon }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'text-site-secondary size-3.5',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'scan':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )
    case 'resolve':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z" />
        </svg>
      )
    case 'account':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      )
    default:
      return null
  }
}

function PriceLine({
  tier,
  prices,
  freeLabel,
}: {
  tier: TPlan
  prices?: ITierPrices | null
  freeLabel: string
}) {
  if (tier === EPlan.FREE) {
    return <p className="text-site-faint mt-1.5 text-xs font-normal">{freeLabel}</p>
  }
  const price = tier === EPlan.PRO ? prices?.pro : prices?.team
  if (price === null || price === undefined) {
    return null
  }
  return <p className="mt-1.5 font-mono text-sm font-medium">{formatPrice(price)}</p>
}

function formatPrice(price: IPlanPrice): string {
  const amount = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(price.amount / 100)
  return `${amount}/${price.interval === 'month' ? 'mo' : price.interval}`
}
