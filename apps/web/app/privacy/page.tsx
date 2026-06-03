import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalPage } from '@/components/legal-page'
import { privacyContent } from './content'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal')
  return { title: t('privacyTitle'), robots: { index: false, follow: true } }
}

export default function PrivacyPage() {
  return <LegalPage {...privacyContent} />
}
