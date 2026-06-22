'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Streamdown } from 'streamdown'
import type { IScanReport } from '@isreadyai/scanner'
import { reportToMarkdown } from '@isreadyai/scanner'
import { generateReportFixPlan } from '@/lib/actions/fix-plan'
import { hostOf } from '@/lib/url'
import { Button, EButtonVariant } from '@/components/ui/button'
import { notify } from '@/components/ui/toast'

// MARK: - Site solution card (download + AI fix plan)
//
// Sits next to the Badge on the website detail. Premium-only: the fix plan is
// the solution, ready for AI coding agents; Free sees the upgrade CTA.

/** Solution card with report download and AI fix plan generation. */
export function SiteSolutionCard({ report, premium }: { report: IScanReport; premium: boolean }) {
  const t = useTranslations('report')
  const [aiPlan, setAiPlan] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onGenerate(): void {
    startTransition(async () => {
      const result = await generateReportFixPlan(report)
      if (result.ok) {
        setAiPlan(result.plan)
      } else {
        notify.error(t('solutionAiError'))
      }
    })
  }

  function download(): void {
    const md = reportToMarkdown(report, 'llm')
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `isready-${hostOf(report.finalUrl)}-solution.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="border-site-border bg-site-surface/50 flex h-full flex-col gap-4 rounded-2xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{t('solutionTitle')}</h2>
          <p className="text-site-muted mt-1 text-xs">
            {premium ? t('solutionHint') : t('solutionLockedHint')}
          </p>
        </div>
        {/* No card content for Free → upgrade CTA sits top-right beside the title. */}
        {!premium ? (
          <Button variant={EButtonVariant.SECONDARY} href="/pricing" className="shrink-0">
            {t('solutionUpsellCta')}
          </Button>
        ) : null}
      </div>
      {aiPlan !== null ? (
        <div className="border-site-border bg-site-background/60 text-site-muted max-h-72 overflow-auto rounded-xl border p-4 text-xs leading-relaxed">
          <Streamdown>{aiPlan}</Streamdown>
        </div>
      ) : null}
      {/* Premium has controls (content) → actions go bottom-right. */}
      {premium ? (
        <div className="mt-auto flex flex-wrap justify-end gap-2">
          <Button variant={EButtonVariant.PRIMARY} onPress={onGenerate} isDisabled={pending}>
            {pending ? t('solutionAiGenerating') : t('solutionAiCta')}
          </Button>
          <Button variant={EButtonVariant.SECONDARY} onPress={download}>
            {t('solutionDownload')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
