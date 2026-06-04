'use client'

import type { ReactNode } from 'react'
import type { IWorkspaceOption } from '@/lib/workspace'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { AccountMenu } from '@/components/auth/account-menu'
import { CompleteProfileNotice } from '@/components/auth/complete-profile-notice'
import { WorkspaceSwitcher } from '@/components/dashboard/workspace-switcher'

interface INavItem {
  href: string
  label: string
  exact: boolean
  /** owner/admin-only sections (billing, api keys) are hidden for members. */
  requiresManager?: boolean
}

const NAV_ITEMS: readonly INavItem[] = [
  { href: '/dashboard', label: 'overview', exact: true },
  { href: '/dashboard/scans', label: 'scans', exact: false },
  { href: '/dashboard/websites', label: 'domains', exact: false },
  { href: '/dashboard/alerts', label: 'alerts', exact: false },
  { href: '/dashboard/api-keys', label: 'apiKeys', exact: false, requiresManager: true },
  { href: '/dashboard/usage', label: 'usage', exact: false },
  { href: '/dashboard/team', label: 'team', exact: false },
  { href: '/dashboard/billing', label: 'billing', exact: false, requiresManager: true },
  // Personal account settings live in the account chip (bottom of the sidebar),
  // not the team-scoped main nav.
]

const MOBILE_NAV_ID = 'dashboard-mobile-nav'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

const Wordmark = () => (
  <Link href="/dashboard" className="flex items-baseline gap-1 font-semibold tracking-tight">
    <span className="text-site-accent" aria-hidden="true">
      ◆
    </span>
    <span>isready</span>
    <span className="text-site-muted">.ai</span>
  </Link>
)

function NavLink({
  href,
  exact,
  label,
  icon,
  pathname,
  onNavigate,
}: {
  href: string
  exact: boolean
  label: string
  icon: ReactNode
  pathname: string
  onNavigate?: () => void
}) {
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-site-raised text-site-text'
          : 'text-site-muted hover:bg-site-raised/70 hover:text-site-text'
      }`}
    >
      <span className="shrink-0 opacity-80" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  )
}

/** Dashboard layout with sidebar nav (desktop), mobile drawer, workspace switcher, and account menu. */
export function DashboardShell({
  children,
  banner,
  workspaces,
  activeWorkspaceId,
  canManageWorkspace,
}: {
  children: ReactNode
  banner?: ReactNode
  workspaces: IWorkspaceOption[]
  activeWorkspaceId: string | null
  canManageWorkspace: boolean
}) {
  const pathname = usePathname()
  const t = useTranslations('admin')
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = NAV_ITEMS.filter((item) => !item.requiresManager || canManageWorkspace)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Escape-to-close, focus trap, body scroll lock, and return-focus-to-toggle.
  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const panel = panelRef.current
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        return
      }
      if (event.key !== 'Tab' || panel === null) {
        return
      }
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) {
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const activeEl = document.activeElement
      if (event.shiftKey && activeEl === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      // eslint-disable-next-line react-hooks/exhaustive-deps -- ref access in cleanup is intentional: restores focus to toggle button on menu close
      toggleRef.current?.focus()
    }
  }, [menuOpen])

  return (
    <div className="bg-site-background text-site-text min-h-dvh">
      <CompleteProfileNotice />
      <aside className="border-site-border bg-site-surface fixed inset-y-0 left-0 hidden w-64 border-r lg:flex lg:flex-col">
        <div className="border-site-border flex h-16 items-center border-b px-5">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label={t('navigation')}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              label={t(item.label)}
              icon={<NavIcon name={item.label} />}
              pathname={pathname}
            />
          ))}
        </nav>
        <div className="border-site-border space-y-2 border-t p-3">
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
          <AccountMenu variant="chip" />
        </div>
      </aside>

      <header className="border-site-border bg-site-background/90 sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl lg:hidden">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-controls={MOBILE_NAV_ID}
          aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
          className="border-site-border text-site-text hover:border-site-accent-dim flex size-9 items-center justify-center rounded-lg border transition-colors"
        >
          <MenuIcon open={menuOpen} />
        </button>
        <Wordmark />
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('closeMenu')}
            onClick={() => setMenuOpen(false)}
            className="bg-site-background/70 absolute inset-0 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            id={MOBILE_NAV_ID}
            // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <dialog> requires open attr + UA reset styles; JS-controlled panel with focus trap in effect
            role="dialog"
            aria-modal="true"
            aria-label={t('navigation')}
            className="border-site-border bg-site-surface absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r shadow-2xl"
          >
            <div className="border-site-border flex h-16 items-center border-b px-5">
              <Wordmark />
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t('navigation')}>
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  exact={item.exact}
                  label={t(item.label)}
                  icon={<NavIcon name={item.label} />}
                  pathname={pathname}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </nav>
            <div className="border-site-border space-y-2 border-t p-3">
              <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
              <AccountMenu variant="chip" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh flex-col lg:h-dvh lg:pl-64">
        {banner}
        {children}
      </div>
    </div>
  )
}

function NavIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'size-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'overview':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'scans':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      )
    case 'domains':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
        </svg>
      )
    case 'alerts':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
        </svg>
      )
    case 'apiKeys':
      return (
        <svg {...common}>
          <circle cx="7.5" cy="15.5" r="3.5" />
          <path d="M10 13L20 3M17 6l2 2M14 9l2 2" />
        </svg>
      )
    case 'usage':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      )
    case 'team':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.5a5.5 5.5 0 0 1 3 5.5" />
        </svg>
      )
    case 'billing':
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 9.5h19" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" fill="var(--color-site-surface)" />
          <circle cx="15" cy="12" r="2" fill="var(--color-site-surface)" />
          <circle cx="9" cy="18" r="2" fill="var(--color-site-surface)" />
        </svg>
      )
    default:
      return null
  }
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
