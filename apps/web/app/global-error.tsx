'use client'

import messages from '@/i18n/messages/en.json'
import { ErrorScreen } from '@/components/error-screen'
import './globals.css'

// MARK: - Global error boundary (own <html> — replaces the root layout)
//
// Renders outside the NextIntlClientProvider, so copy comes straight from the
// default messages bundle instead of useTranslations.

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const e = messages.error
  return (
    <html lang="en" className="dark" data-theme="dark">
      <body className="bg-site-background text-site-text antialiased">
        <ErrorScreen
          code={e.eyebrow}
          title={e.title}
          accent={e.accent}
          subtitle={e.subtitle}
          action={
            <button
              type="button"
              onClick={reset}
              className="bg-site-accent text-site-accent-foreground hover:bg-site-text inline-flex min-h-12 cursor-pointer items-center rounded-xl px-5 text-sm font-semibold transition-colors"
            >
              {e.retry}
            </button>
          }
        />
      </body>
    </html>
  )
}
