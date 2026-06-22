import type { ReactNode } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { GITHUB_URL } from '@/lib/site'
import { GitHubIcon } from '@/components/ui/github-icon'
import { FooterCommand } from './footer-command'
import { CookiePreferencesLink } from '@/components/consent/cookie-consent'

// MARK: - Site footer

const renderOpenSourceCompany = (chunks: ReactNode) => (
  <a
    href="https://smartsquad.io"
    target="_blank"
    rel="noopener noreferrer"
    className="hover:text-site-text underline underline-offset-2 transition-colors"
  >
    {chunks}
  </a>
)

export async function SiteFooter({ bottomInset = false }: { bottomInset?: boolean }) {
  const t = await getTranslations('footer')
  return (
    <footer className="border-site-border/60 mt-24 border-t">
      <div
        className={`site-container text-site-muted flex flex-col items-center gap-3 py-10 text-sm sm:flex-row sm:justify-between ${bottomInset ? 'pb-24' : ''}`}
      >
        <p className="text-center sm:text-left">
          <span className="text-site-accent" aria-hidden="true">
            ◆{' '}
          </span>
          isready.ai
          <span className="text-site-faint">
            {' — '}
            {t.rich('openSource', { company: renderOpenSourceCompany })}
          </span>
        </p>
        <div className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:w-auto">
          <Link href="/privacy" className="hover:text-site-text transition-colors">
            {t('privacy')}
          </Link>
          <Link href="/terms-and-conditions" className="hover:text-site-text transition-colors">
            {t('terms')}
          </Link>
          <Link href="/sitemap.xml" className="hover:text-site-text transition-colors">
            {t('sitemap')}
          </Link>
          <CookiePreferencesLink className="hover:text-site-text cursor-pointer transition-colors" />
          <Link href="/acknowledgements" className="hover:text-site-text transition-colors">
            {t('thanks')}
          </Link>
          <FooterCommand />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('githubAria')}
            className="hover:text-site-text inline-flex items-center gap-1.5 transition-colors"
          >
            <span>{t('starOn')}</span>
            <GitHubIcon className="size-[17px] shrink-0" />
          </a>
        </div>
      </div>
    </footer>
  )
}
