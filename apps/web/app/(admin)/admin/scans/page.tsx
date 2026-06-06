import { getTranslations } from 'next-intl/server'
import { AdminSectionPlaceholder } from '@/components/admin/admin-section-placeholder'

/** Scans management page (placeholder). */
export default async function AdminScansPage() {
  const t = await getTranslations('admin')
  return (
    <AdminSectionPlaceholder
      eyebrow={t('scans')}
      title={t('scansTitle')}
      description={t('scansDescription')}
      emptyState={t('scansEmpty')}
    />
  )
}
