import type { ReactNode } from 'react'

import { Breadcrumbs } from '@heroui/react/breadcrumbs'
import { useTranslations } from 'next-intl'

interface IAdminPageHeaderProps {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}

/** Page header with breadcrumbs, title, description, and optional action. */
export function AdminPageHeader({ eyebrow, title, description, action }: IAdminPageHeaderProps) {
  const t = useTranslations('admin')
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Breadcrumbs className="mb-3">
          <Breadcrumbs.Item href="/admin">{t('breadcrumb')}</Breadcrumbs.Item>
          <Breadcrumbs.Item>{eyebrow}</Breadcrumbs.Item>
        </Breadcrumbs>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-site-muted mt-2 max-w-2xl text-sm leading-relaxed">{description}</p>
      </div>
      {action}
    </div>
  )
}
