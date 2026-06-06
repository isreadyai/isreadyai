import { Card } from '@heroui/react/card'

import { AdminPageHeader } from './admin-page-header'

interface IAdminSectionPlaceholderProps {
  eyebrow: string
  title: string
  description: string
  emptyState: string
}

/** Section placeholder with header and empty state card. */
export function AdminSectionPlaceholder({
  eyebrow,
  title,
  description,
  emptyState,
}: IAdminSectionPlaceholderProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AdminPageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card className="border-site-border bg-site-surface/60 border">
        <Card.Content className="py-16">
          <div className="border-site-border text-site-muted rounded-xl border border-dashed px-5 py-12 text-center text-sm">
            {emptyState}
          </div>
        </Card.Content>
      </Card>
    </div>
  )
}
