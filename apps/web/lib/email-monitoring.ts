import type { IScanReport } from '@isreadyai/scanner'
import { emailShell, reportAttachments, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/site'

// MARK: - Monitoring emails (score-drop alert + weekly report)
//
// Both carry the report as a PDF plus the LLM-mode Markdown ("solutions for an
// agent to apply"). Senders are best-effort: sendEmail no-ops without Resend.

export interface IScoreDropAlert {
  /** The configured alert threshold, or null when the alert fired on a relative drop alone. */
  threshold: number | null
  /** The previous monitored scan's score, or null when there's no prior scan. */
  previousOverall: number | null
}

export async function sendScoreDropEmail(
  to: string,
  report: IScanReport,
  reportId: string,
  host: string,
  alert: IScoreDropAlert,
): Promise<boolean> {
  const reportUrl = `${SITE_URL}/report/${reportId}`
  return sendEmail({
    to,
    subject: `⚠ ${host} dropped to ${report.overall}/100`,
    html: alertHtml(report, host, reportUrl, alert),
    attachments: await reportAttachments(report, 'llm'),
  })
}

export async function sendWeeklyReportEmail(
  to: string,
  report: IScanReport,
  reportId: string,
  host: string,
): Promise<boolean> {
  const reportUrl = `${SITE_URL}/report/${reportId}`
  return sendEmail({
    to,
    subject: `${host} — weekly AI-readiness report (${report.overall}/100)`,
    html: weeklyHtml(report, host, reportUrl),
    attachments: await reportAttachments(report, 'llm'),
  })
}

// MARK: - internal

function shell(host: string, reportUrl: string, heading: string, lead: string): string {
  return emailShell(`<h1 style="font-size:20px;margin:16px 0 8px">${heading}</h1>
      <p style="font-size:14px;line-height:1.6;color:#9a9a92">${lead}</p>
      <p style="font-size:14px;line-height:1.6">The full report is attached as a <strong>PDF</strong>, plus <strong>${host}-report.md</strong> &mdash; ready to hand to an AI coding agent to apply the fixes. Live version:
        <a href="${reportUrl}" style="color:#b8f53d">${reportUrl}</a>.</p>
      <p style="font-size:12px;color:#6b6b64;margin-top:32px">Manage alerts in your isready.ai notification settings.</p>`)
}

function alertHtml(
  report: IScanReport,
  host: string,
  reportUrl: string,
  alert: IScoreDropAlert,
): string {
  const overall = report.overall
  const { threshold, previousOverall } = alert
  const delta = previousOverall === null ? 0 : previousOverall - overall
  const belowThreshold = threshold !== null && overall < threshold

  let lead: string
  if (belowThreshold && delta > 0) {
    lead = `Its AI-readiness score dropped ${delta} points (from ${previousOverall} to ${overall}), now below your alert threshold of ${threshold}.`
  } else if (belowThreshold) {
    lead = `Its AI-readiness score fell below your alert threshold of ${threshold}.`
  } else {
    lead = `Its AI-readiness score dropped ${delta} points, from ${previousOverall} to ${overall}, since the last check.`
  }

  return shell(
    host,
    reportUrl,
    `${host} dropped to ${overall}/100 (${report.grade})`,
    `${lead} Here's what changed and how to fix it.`,
  )
}

function weeklyHtml(report: IScanReport, host: string, reportUrl: string): string {
  const failed = report.checks.filter((c) => c.status === 'fail').length
  const warned = report.checks.filter((c) => c.status === 'warn').length
  return shell(
    host,
    reportUrl,
    `${host} this week: ${report.overall}/100 (${report.grade})`,
    `${failed} failed &middot; ${warned} warnings on your latest monitored scan.`,
  )
}
