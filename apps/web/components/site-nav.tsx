'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AccountMenu } from '@/components/auth/account-menu'
import { GitHubIcon } from '@/components/ui/github-icon'
import { GITHUB_URL } from '@/lib/site'
import { useAccount } from '@/lib/use-account'
import { useScrollSpy } from '@/lib/use-scroll-spy'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'

// MARK: - Site nav (scrollspy-aware, with fullscreen mobile menu)

/**
 * The burger inherits --header-progress from the pill: its standalone ring
 * fades out as the pill's border fades in, and the bars thicken slightly.
 * Must mirror the DOM order of the sections — the spy keeps the LAST id whose
 * top passed the activation line, so a misordered list shadows earlier links.
 */
const SECTION_IDS = [
  'home',
  'smart-agent',
  'cli',
  'github-action',
  'how-it-works',
  'pricing',
  'faq',
] as const

const NAV_ITEMS: { id: (typeof SECTION_IDS)[number]; key: string; href?: string }[] = [
  { id: 'smart-agent', key: 'smartAgent' },
  { id: 'cli', key: 'cli' },
  { id: 'github-action', key: 'action' },
  { id: 'how-it-works', key: 'howItWorks' },
  { id: 'pricing', key: 'pricing' },
  { id: 'faq', key: 'faq' },
]

const BAR_CLASS =
  'block h-[calc(2px_+_var(--header-progress,0)*1px)] w-[calc(var(--spacing)*4.5)] rounded-full bg-current'

export function SiteNav() {
  const t = useTranslations('nav')

  const activeId = useScrollSpy(SECTION_IDS)
  const pathname = usePathname()
  const { identity } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback((): void => {
    setMenuOpen(false)
  }, [])

  function openMenu(): void {
    setMenuMounted(true)
    setMenuOpen(true)
  }

  useEffect(() => {
    const menu = menuRef.current
    if (!menuMounted || menu === null) {
      return
    }
    document.body.style.overflow = menuOpen ? 'hidden' : ''

    if (prefersReducedMotion()) {
      menu.style.opacity = menuOpen ? '1' : '0'
      menu.style.visibility = menuOpen ? 'visible' : 'hidden'
      if (!menuOpen) {
        setMenuMounted(false)
      }
      return
    }

    let alive = true
    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      if (menuOpen) {
        gsap.to(menu, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' })
        gsap.fromTo(
          menu.querySelectorAll('[data-mobile-link]'),
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.06, delay: 0.05 },
        )
      } else {
        gsap.to(menu, {
          autoAlpha: 0,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => setMenuMounted(false),
        })
      }
    })
    return () => {
      alive = false
    }
  }, [menuOpen, menuMounted])

  // Close on route change and Escape; always release the scroll lock.
  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [closeMenu])

  return (
    <nav aria-label={t('mainNav')} className="flex items-center gap-5 text-sm">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href ?? `/#${item.id}`}
          aria-current={activeId === item.id ? 'true' : undefined}
          className={`hidden transition-colors md:block ${
            activeId === item.id ? 'text-site-accent' : 'text-site-muted hover:text-site-text'
          }`}
        >
          {t(item.key)}
        </Link>
      ))}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('github')} (opens in a new tab)`}
        className="text-site-muted hover:text-site-text hidden rounded-sm transition-colors md:inline-flex"
      >
        <GitHubIcon className="size-[18px]" />
      </a>
      <div className="hidden md:block">
        <AccountMenu variant="nav" />
      </div>

      <button
        type="button"
        onClick={menuOpen ? closeMenu : openMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
        className="ml-auto flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-site-border)_calc((1_-_var(--header-progress,0))*100%),transparent)] text-[color-mix(in_oklab,var(--color-site-text)_calc(var(--header-progress,0)*60%),var(--color-site-muted))] transition-colors md:hidden"
      >
        <span className="flex flex-col items-center gap-[5px]" aria-hidden="true">
          <span
            className={`${BAR_CLASS} origin-center transition-transform duration-300 ease-in-out ${
              menuOpen ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`${BAR_CLASS} transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`${BAR_CLASS} origin-center transition-transform duration-300 ease-in-out ${
              menuOpen ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </span>
      </button>

      {menuMounted
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-[color-mix(in_oklab,var(--color-site-background)_95%,transparent)] opacity-0 backdrop-blur-2xl md:hidden"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.id}
                  data-mobile-link
                  href={item.href ?? `/#${item.id}`}
                  onClick={closeMenu}
                  aria-current={activeId === item.id ? 'true' : undefined}
                  className={`text-5xl font-medium tracking-tight transition-colors ${
                    activeId === item.id ? 'text-site-accent' : 'text-site-text'
                  }`}
                >
                  {t(item.key)}
                </Link>
              ))}
              <a
                data-mobile-link
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                aria-label={`${t('github')} (opens in a new tab)`}
                className="text-site-muted hover:text-site-text rounded-sm transition-colors"
              >
                <GitHubIcon className="size-10" />
              </a>
              {identity === null ? (
                <Link
                  data-mobile-link
                  href="/login"
                  onClick={closeMenu}
                  className="text-site-text text-2xl font-medium tracking-tight transition-colors"
                >
                  {t('signIn')}
                </Link>
              ) : (
                <>
                  <span
                    data-mobile-link
                    className="bg-site-border block h-px w-16"
                    aria-hidden="true"
                  />
                  <Link
                    data-mobile-link
                    href="/dashboard"
                    onClick={closeMenu}
                    className="text-site-secondary hover:text-site-text text-2xl font-medium tracking-tight transition-colors"
                  >
                    {t('dashboard')}
                  </Link>
                  <form data-mobile-link method="post" action="/auth/sign-out">
                    <button
                      type="submit"
                      className="text-site-secondary hover:text-site-text text-2xl font-medium tracking-tight transition-colors"
                    >
                      {t('signOut')}
                    </button>
                  </form>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </nav>
  )
}
