import { getTranslations } from 'next-intl/server'
import { AdminSectionPlaceholder } from '@/components/admin/admin-section-placeholder'

/** API keys management page (placeholder). */
export default async function AdminApiKeysPage() {
  const t = await getTranslations('admin')
  return (
    <AdminSectionPlaceholder
      eyebrow={t('apiKeys')}
      title={t('apiKeysTitle')}
      description={t('apiKeysDescription')}
      emptyState={t('apiKeysEmpty')}
    />
  )
}
