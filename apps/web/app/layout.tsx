import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import Script from 'next/script'
import { GoogleTagManager } from '@next/third-parties/google'
import { ScrollToTopButton } from '@/components/scroll-to-top-button'
import { Toaster } from '@/components/ui/toast'
import { CookieConsent } from '@/components/consent/cookie-consent'
import { EnsureSession } from '@/components/auth/ensure-session'
import { SITE_URL, GTM_ID } from '@/lib/site'
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
      {GTM_ID ? (
        <>
          {/* Consent Mode v2 defaults — must run before GTM loads. */}
          <Script id="consent-default" strategy="beforeInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500})`}
          </Script>
          <GoogleTagManager gtmId={GTM_ID} />
        </>
      ) : null}
      <body className="bg-site-background text-site-text min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages}>
          <EnsureSession />
          {children}
          <ScrollToTopButton />
          <Toaster />
          {GTM_ID ? <CookieConsent /> : null}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
