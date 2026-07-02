import { emailShell, sendEmail } from '@/lib/email'

// MARK: - Fix-PR "ready to review" email

/**
 * Best-effort notification that the fix Action opened a PR; no-op without an
 * email provider. The recipient is resolved server-side (the API-key owner).
 */
export async function sendFixPrEmail(
  to: string,
  data: { repo: string; prUrl: string; patches: number },
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `AI-readiness fixes ready to review — ${data.repo}`,
    html: fixPrEmailHtml(data),
  })
}

/** Inner markup wrapped in the shared email shell. Exported for testing. */
export function fixPrEmailHtml(data: { repo: string; prUrl: string; patches: number }): string {
  const count = data.patches === 1 ? '1 fix' : `${data.patches} fixes`
  return emailShell(`<h1 style="font-size:20px;margin:16px 0 8px">AI-readiness fixes ready to review</h1>
      <p style="font-size:14px;line-height:1.6;color:#9a9a92">The isready.ai fix agent applied ${count} to <strong style="color:#ececea">${data.repo}</strong> and opened a pull request for your review.</p>
      <p style="margin:24px 0">
        <a href="${data.prUrl}" style="display:inline-block;background:#b8f53d;color:#161613;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px">View the pull request</a>
      </p>
      <p style="font-size:12px;color:#6b6b64">The agent ran inside your CI runner; only the file snippets it opened were sent for inference, and were not stored by isready.ai.</p>`)
}
