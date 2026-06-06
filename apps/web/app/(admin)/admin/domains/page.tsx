import { getTranslations } from 'next-intl/server'
import { AdminSectionPlaceholder } from '@/components/admin/admin-section-placeholder'

/** Domains management page (placeholder). */
export default async function AdminDomainsPage() {
  const t = await getTranslations('admin')
  return (
    <AdminSectionPlaceholder
      eyebrow={t('domains')}
      title={t('domainsTitle')}
      description={t('domainsDescription')}
      emptyState={t('domainsEmpty')}
    />
  )
}
