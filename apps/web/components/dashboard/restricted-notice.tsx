import { getTranslations } from 'next-intl/server'

// MARK: - Owner/admin-only section placeholder (members lack the role)

/** Owner/admin-only section placeholder; members see nothing. */
export async function RestrictedNotice() {
  const t = await getTranslations('admin')
  return (
    <div className="border-site-border bg-site-surface/60 rounded-2xl border p-10 text-center">
      <p className="text-site-text text-sm font-semibold">{t('restrictedTitle')}</p>
      <p className="text-site-muted mx-auto mt-2 max-w-md text-sm">{t('restrictedBody')}</p>
    </div>
  )
}
