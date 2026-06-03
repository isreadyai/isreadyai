import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PremiumTiers } from '@/components/premium-tiers'
import { getPlanPrices } from '@/lib/plan-prices'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricing')
  return { title: `${t('title')} · isready.ai`, description: t('subtitle') }
}

/** Pricing page with premium plan tiers and adaptive currency support. */
export default async function PricingPage() {
  const t = await getTranslations('pricing')
  // Stripe Adaptive Pricing charges in local currency; this picks which
  // currency_options amount to SHOW, from the visitor's geo (Vercel header).
  const country = (await headers()).get('x-vercel-ip-country')
  const prices = await getPlanPrices(country)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pt-28 pb-24 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
          <p className="text-site-muted mx-auto mt-3 max-w-2xl text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        <PremiumTiers className="mt-12" prices={prices} />
      </main>
      <SiteFooter />
    </>
  )
}
