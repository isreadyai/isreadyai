import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ContactForm } from '@/components/contact/contact-form'

type TReason = 'feedback' | 'bug' | 'fraud' | 'other'
const REASONS = new Set<TReason>(['feedback', 'bug', 'fraud', 'other'])

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contact')
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; host?: string }>
}) {
  const t = await getTranslations('contact')
  const params = await searchParams
  const reason: TReason = REASONS.has(params.reason as TReason)
    ? (params.reason as TReason)
    : 'feedback'
  const host = typeof params.host === 'string' ? params.host : ''

  return (
    <>
      <SiteHeader />
      <main className="site-container max-w-2xl pt-26 pb-12">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-site-muted mt-3 leading-relaxed">{t('intro')}</p>
        <ContactForm initialReason={reason} initialHost={host} />
      </main>
      <SiteFooter bottomInset />
    </>
  )
}
