'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { IScanReport } from '@isreadyai/scanner'
import { reportToMarkdown } from '@isreadyai/scanner'
import { hostOf } from '@/lib/url'
import { Button, EButtonAppearance, EButtonVariant } from '@/components/ui/button'
import { ASK_PLAN_EVENT } from './ask-your-site'

// MARK: - Solution block (premium fix plan)
//
// The fix plan ("the solution, ready for AI coding agents"): every finding with
// a concrete fix, as Markdown to paste into an agent. Premium-only — Free sees a
// locked upsell. Generated client-side from the report, like ReportDownloads.

function askForPlan(): void {
  window.dispatchEvent(new CustomEvent(ASK_PLAN_EVENT))
}

export function SolutionSection({ report, premium }: { report: IScanReport; premium: boolean }) {
  const t = useTranslations('report')
  const host = hostOf(report.finalUrl)
  const [open, setOpen] = useState(false)

  function download(): void {
    const md = reportToMarkdown(report, 'llm')
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `isready-${host}-solution.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section data-anim="panel" aria-label={t('solutionTitle')} className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t('solutionTitle')}</h2>
          <p className="text-site-muted mt-1 text-sm">
            {premium ? t('solutionHint') : t('solutionLockedHint')}
          </p>
        </div>
        {/* No content for Free → upgrade CTA top-right beside the title. */}
        {!premium ? (
          <Button variant="secondary" href="/pricing" className="shrink-0">
            {t('solutionUpsellCta')}
          </Button>
        ) : null}
      </div>
      {/* Premium has the action row + preview (content) → keep them below. */}
      {premium ? (
        <>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant={EButtonVariant.SECONDARY} onPress={askForPlan}>
              {t('solutionAiCta')}
            </Button>
            <Button variant={EButtonVariant.PRIMARY} onPress={download}>
              {t('solutionDownload')}
            </Button>
            <Button
              variant={EButtonVariant.NEUTRAL}
              appearance={EButtonAppearance.OUTLINE}
              onPress={() => setOpen((v) => !v)}
            >
              {open ? t('collapseAll') : t('solutionPreview')}
            </Button>
          </div>
          {open ? (
            <pre className="border-site-border text-site-muted mt-4 max-h-96 overflow-auto rounded-xl border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {reportToMarkdown(report, 'llm')}
            </pre>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
