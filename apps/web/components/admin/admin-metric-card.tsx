import type { ReactNode } from 'react'

import { Card } from '@heroui/react/card'

interface IAdminMetricCardProps {
  label: string
  value: ReactNode
  detail: string
}

/** Metric card with label, value, and detail text. */
export function AdminMetricCard({ label, value, detail }: IAdminMetricCardProps) {
  return (
    <Card className="border-site-border bg-site-surface/60 border">
      <Card.Header className="pb-2">
        <Card.Description className="text-site-muted text-xs tracking-wide uppercase">
          {label}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <p className="font-mono text-3xl font-semibold">{value}</p>
        <p className="text-site-faint mt-2 text-xs">{detail}</p>
      </Card.Content>
    </Card>
  )
}
