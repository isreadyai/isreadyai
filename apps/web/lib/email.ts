import type { IScanReport } from '@isreadyai/scanner'
import { reportToMarkdown } from '@isreadyai/scanner'
import { reportPdfArrayBuffer } from '@/lib/report-pdf'
import { hostOf } from '@/lib/url'

// MARK: - Email transport (Resend REST, no SDK)
//
// One place that talks to Resend. Without RESEND_API_KEY every send is a no-op
// returning false, so callers degrade gracefully (the UI falls back to direct
// downloads, crons skip silently).

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function emailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY
  return typeof key === 'string' && key.length > 0
}

export interface IEmailAttachment {
  filename: string
  /** Base64-encoded file contents. */
  content: string
}

export async function sendEmail(input: {
  to: string | string[]
  subject: string
  html: string
  attachments?: IEmailAttachment[]
}): Promise<boolean> {
  if (!emailConfigured()) {
    return false
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY ?? ''}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'isready.ai <reports@isready.ai>',
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.attachments === undefined ? {} : { attachments: input.attachments }),
    }),
  })
  return response.ok
}

/**
 * Shared, responsive outer chrome for every transactional email: a table-based
 * (Outlook-safe) card with a mobile breakpoint and the ◆ isready.ai brand mark.
 * Inline colors are the dark brand. `prefers-color-scheme: light` restyles the
 * same classes. Use solid background colors so clients that invert text can
 * adapt its background too. Callers supply inner markup. The same structure
 * is mirrored in packages/supabase/templates/* so app and auth mail share one look.
 */
export function emailShell(content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style>
      :root { color-scheme: light dark; }
      @media only screen and (max-width: 600px) {
        .ir-card { width: 100% !important; }
        .ir-pad { padding: 28px 20px !important; }
      }
      @media (prefers-color-scheme: light) {
        .ir-bg { background-color: #f3f3ee !important; }
        .ir-card { background-color: #ffffff !important; border-color: #e2e2db !important; }
        .ir-pad, .ir-pad h1, .ir-text { color: #1c1c19 !important; }
        .ir-muted { color: #4d4d46 !important; }
        .ir-faint { color: #5c5c55 !important; }
        .ir-brand, .ir-link { color: #3d6b00 !important; }
      }
    </style>
  </head>
  <body class="ir-bg" style="margin:0;padding:0;background-color:#161613">
    <table role="presentation" class="ir-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#161613">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" class="ir-card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background-color:#1c1c19;border:1px solid #2e2e29;border-radius:16px">
            <tr>
              <td class="ir-pad" style="padding:36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ececea">
                <p class="ir-brand" style="margin:0 0 28px;font-size:15px;font-weight:600;color:#b8f53d">&#9670; isready.ai</p>
                ${content}
              </td>
            </tr>
          </table>
          <p class="ir-faint" style="margin:18px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b64">isready.ai — is your website ready for AI?</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** The PDF + Markdown of a scan report, base64-encoded for an email attachment. */
export async function reportAttachments(
  report: IScanReport,
  mdMode: 'human' | 'llm' = 'human',
): Promise<IEmailAttachment[]> {
  const host = hostOf(report.finalUrl)
  const pdf = Buffer.from(await reportPdfArrayBuffer(report)).toString('base64')
  const markdown = Buffer.from(reportToMarkdown(report, mdMode)).toString('base64')
  return [
    { filename: `isready-${host}-report.pdf`, content: pdf },
    { filename: `isready-${host}-report.md`, content: markdown },
  ]
}
