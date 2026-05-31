import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { ScrollToTopButton } from '@/components/scroll-to-top-button'
import { Toaster } from '@/components/ui/toast'
import { EnsureSession } from '@/components/auth/ensure-session'
import { SITE_URL } from '@/lib/site'
import './globals.css'

// MARK: - Metadata

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site')
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${t('name')} — ${t('tagline')}`,
      template: `%s — ${t('name')}`,
    },
    description: t('description'),
    keywords: [
      'AI readiness',
      'LLM SEO',
      'GEO',
      'generative engine optimization',
      'GPTBot',
      'ClaudeBot',
      'AI crawler',
      'llms.txt',
      'AI visibility',
    ],
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: t('name'),
      title: `${t('name')} — ${t('tagline')}`,
      description: t('description'),
      url: SITE_URL,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('name')} — ${t('tagline')}`,
      description: t('description'),
    },
    robots: { index: true, follow: true },
  }
}

export const viewport: Viewport = {
  themeColor: '#161613',
  width: 'device-width',
  initialScale: 1,
}

// MARK: - Root layout

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages()
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      data-theme="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="bg-site-background text-site-text min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages}>
          <EnsureSession />
          {children}
          <ScrollToTopButton />
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
