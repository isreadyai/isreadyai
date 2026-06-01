import { unstable_cache } from 'next/cache'
import { EPlan } from '@/lib/plans'
import { getPriceId, getStripe, isStripeConfigured } from '@/lib/stripe'

// MARK: - Localised plan prices (Stripe currency_options)

export interface IPlanPrice {
  amount: number // minor units (cents)
  currency: string
  interval: string
}

// Country → display currency. Stripe Adaptive Pricing handles the actual charge;
// this only picks which currency_options amount we SHOW on the marketing page.
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'usd',
  GB: 'gbp',
}
const DEFAULT_CURRENCY = 'eur'

function currencyForCountry(country: string | null): string {
  if (country === null) {
    return DEFAULT_CURRENCY
  }
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? DEFAULT_CURRENCY
}

interface ISlimPrice {
  base: number | null
  currency: string
  interval: string
  options: Record<string, number | null>
}

// Cached, currency-independent: the raw Stripe prices change rarely, so we fetch
// them at most every 6h and resolve the visitor's currency per request.
const getRawPrices = unstable_cache(
  async (): Promise<{ pro: ISlimPrice; team: ISlimPrice } | null> => {
    const proId = getPriceId(EPlan.PRO)
    const teamId = getPriceId(EPlan.TEAM)
    if (!isStripeConfigured() || proId === null || teamId === null) {
      return null
    }
    const stripe = getStripe()
    try {
      const [pro, team] = await Promise.all([
        stripe.prices.retrieve(proId, { expand: ['currency_options'] }),
        stripe.prices.retrieve(teamId, { expand: ['currency_options'] }),
      ])
      return { pro: slim(pro), team: slim(team) }
    } catch {
      return null
    }
  },
  ['plan-raw-prices'],
  { revalidate: 6 * 60 * 60 },
)

function slim(price: import('stripe').Stripe.Price): ISlimPrice {
  const options: Record<string, number | null> = {}
  for (const [currency, option] of Object.entries(price.currency_options ?? {})) {
    options[currency] = option.unit_amount
  }
  return {
    base: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval ?? 'month',
    options,
  }
}

function resolve(price: ISlimPrice, currency: string): IPlanPrice | null {
  const localised = price.options[currency]
  const amount = localised ?? price.base
  if (amount === null) {
    return null
  }
  return {
    amount,
    currency: localised !== undefined ? currency : price.currency,
    interval: price.interval,
  }
}

export async function getPlanPrices(
  country: string | null,
): Promise<{ pro: IPlanPrice | null; team: IPlanPrice | null } | null> {
  const raw = await getRawPrices()
  if (raw === null) {
    return null
  }
  const currency = currencyForCountry(country)
  return { pro: resolve(raw.pro, currency), team: resolve(raw.team, currency) }
}
