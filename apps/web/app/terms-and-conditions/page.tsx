import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalPage } from '@/components/legal-page'
import { termsContent } from './content'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal')
  return { title: t('termsTitle'), robots: { index: false, follow: true } }
}

export default function TermsPage() {
  return <LegalPage {...termsContent} />
}
