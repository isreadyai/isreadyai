import type { IScanReport } from '@isreadyai/scanner'
import { createServiceClient, isSupabaseConfigured } from '@isreadyai/supabase'
import { emailShell, reportAttachments, sendEmail } from '@/lib/email'
import { hostOf } from '@/lib/url'
import { SITE_URL } from '@/lib/site'

// MARK: - Report delivery by email

/**
 * Email-gated report: sends the PDF + Markdown and keeps the address as a lead.
 * Without RESEND_API_KEY the endpoint reports unconfigured and the UI falls
 * back to direct downloads.
 */

export { emailConfigured } from '@/lib/email'

export async function saveLead(email: string, scanId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return
  }
  const client = await createServiceClient()
  await client.from('leads').insert({ email, scan_id: scanId })
}

export async function sendReportEmail(
  email: string,
  report: IScanReport,
  reportId: string,
): Promise<boolean> {
  const host = hostOf(report.finalUrl)
  const reportUrl = `${SITE_URL}/report/${reportId}`
  return sendEmail({
    to: email,
    subject: `${host} — ${report.overall}/100 AI readiness`,
    html: emailHtml(report, host, reportUrl),
    attachments: await reportAttachments(report, 'human'),
  })
}

// MARK: - internal

function emailHtml(report: IScanReport, host: string, reportUrl: string): string {
  const failed = report.checks.filter((c) => c.status === 'fail').length
  const warned = report.checks.filter((c) => c.status === 'warn').length
  return emailShell(`<h1 style="font-size:20px;margin:16px 0 4px">${host} scored ${report.overall}/100 (${report.grade})</h1>
      <p style="font-size:14px;color:#9a9a92;margin:0 0 24px">${failed} failed &middot; ${warned} warnings &middot; score v${report.scoreVersion}</p>
      <p style="font-size:14px;line-height:1.6">Your full AI-readiness report is attached as <strong>PDF</strong> and <strong>Markdown</strong>. The live version stays at
        <a href="${reportUrl}" style="color:#b8f53d">${reportUrl}</a>.</p>
      <p style="font-size:12px;color:#6b6b64;margin-top:32px">Sent once, because you asked for this report on isready.ai &middot; re-scan any time: npx isreadyai ${host}</p>`)
}
