import { getTranslations } from 'next-intl/server'
import { AdminSectionPlaceholder } from '@/components/admin/admin-section-placeholder'

/** Admin settings page (placeholder). */
export default async function AdminSettingsPage() {
  const t = await getTranslations('admin')
  return (
    <AdminSectionPlaceholder
      eyebrow={t('settings')}
      title={t('settingsTitle')}
      description={t('settingsDescription')}
      emptyState={t('settingsEmpty')}
    />
  )
}
