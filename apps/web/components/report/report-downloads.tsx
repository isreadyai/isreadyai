'use client'

import type { IScanReport } from '@isreadyai/scanner'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { reportToMarkdown } from '@isreadyai/scanner'
import { downloadReportPdf } from '@/lib/report-pdf'
import { hostOf } from '@/lib/url'
import { Button, EButtonAppearance, EButtonVariant } from '@/components/ui/button'

// MARK: - Direct report downloads (owner view)

/**
 * The signed-in owner exports their own report without the email gate: PDF,
 * human Markdown and raw JSON, all generated client-side from the report data.
 */
export function ReportDownloads({ report }: { report: IScanReport }) {
  const t = useTranslations('report')
  const [busy, setBusy] = useState(false)
  const host = hostOf(report.finalUrl)

  async function pdf(): Promise<void> {
    setBusy(true)
    try {
      await downloadReportPdf(report)
    } finally {
      setBusy(false)
    }
  }

  function markdown(): void {
    downloadText(reportToMarkdown(report, 'human'), `isready-${host}-report.md`, 'text/markdown')
  }

  function json(): void {
    downloadText(JSON.stringify(report, null, 2), `isready-${host}-report.json`, 'application/json')
  }

  return (
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <Button variant={EButtonVariant.SECONDARY} onPress={() => void pdf()} isDisabled={busy}>
        {t('downloadPdf')}
      </Button>
      <Button
        variant={EButtonVariant.NEUTRAL}
        appearance={EButtonAppearance.OUTLINE}
        onPress={markdown}
      >
        {t('downloadMd')}
      </Button>
      <Button
        variant={EButtonVariant.NEUTRAL}
        appearance={EButtonAppearance.OUTLINE}
        onPress={json}
      >
        {t('downloadJson')}
      </Button>
    </div>
  )
}

// MARK: - internal

function downloadText(content: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
