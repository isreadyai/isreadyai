import { emailShell, sendEmail } from '@/lib/email'

// MARK: - Workspace invite email

/**
 * Best-effort invite delivery. The raw token only ever travels inside this link;
 * callers still return the URL so the inviter can share it manually when no
 * email provider is configured.
 */

export async function sendInviteEmail(email: string, inviteUrl: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "You've been invited to a workspace on isready.ai",
    html: inviteHtml(inviteUrl),
  })
}

// MARK: - internal

function inviteHtml(inviteUrl: string): string {
  return emailShell(`<h1 style="font-size:20px;margin:16px 0 8px">You've been invited to a workspace</h1>
      <p style="font-size:14px;line-height:1.6;color:#9a9a92">Join your team on isready.ai to share scans, monitored sites and badges.</p>
      <p style="margin:24px 0">
        <a href="${inviteUrl}" style="display:inline-block;background:#b8f53d;color:#161613;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px">Accept invitation</a>
      </p>
      <p style="font-size:12px;color:#6b6b64">This single-use link expires in 7 days. If you weren't expecting this, you can ignore it.</p>`)
}
