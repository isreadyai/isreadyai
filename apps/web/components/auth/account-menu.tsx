'use client'

import { useRef, useState } from 'react'

import { Avatar } from '@heroui/react/avatar'
import { Chip } from '@heroui/react/chip'
import { Dropdown } from '@heroui/react/dropdown'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { useAccount } from '@/lib/use-account'

// MARK: - Account menu (hover-opens; avatar in nav, chip in sidebar)

type TAccountMenuVariant = 'nav' | 'chip'

const CLOSE_DELAY_MS = 160

const MENU_LINKS = [
  { href: '/dashboard', namespace: 'nav', key: 'dashboard' },
  { href: '/dashboard/scans', namespace: 'admin', key: 'scans' },
  { href: '/dashboard/api-keys', namespace: 'admin', key: 'apiKeys' },
  { href: '/dashboard/settings', namespace: 'admin', key: 'settings' },
] as const

/** Account dropdown menu; displays avatar or chip based on variant. */
export function AccountMenu({ variant }: { variant: TAccountMenuVariant }) {
  const { identity } = useAccount()
  const nav = useTranslations('nav')
  const admin = useTranslations('admin')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signOutRef = useRef<HTMLFormElement>(null)

  if (identity === null) {
    if (variant === 'chip') {
      return null
    }
    return (
      <Link
        href="/login"
        className="border-site-secondary text-site-secondary hover:bg-site-secondary hover:text-site-secondary-foreground hidden rounded-lg border px-3.5 py-1.5 text-xs font-bold tracking-wide uppercase transition-colors md:inline-flex"
      >
        {nav('signIn')}
      </Link>
    )
  }

  function hold(): void {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }

  function release(): void {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
    }
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  function labelFor(item: (typeof MENU_LINKS)[number]): string {
    return item.namespace === 'nav' ? nav(item.key) : admin(item.key)
  }

  const displayName = identity.name ?? identity.email ?? nav('account')

  const avatar = (
    <Avatar size={variant === 'nav' ? 'sm' : 'md'}>
      <Avatar.Image src={identity.imageUrl} alt="" />
      <Avatar.Fallback>{identity.initials}</Avatar.Fallback>
    </Avatar>
  )

  return (
    <div
      onPointerEnter={hold}
      onPointerLeave={release}
      className={variant === 'chip' ? 'w-full' : ''}
    >
      <Dropdown.Root isOpen={open} onOpenChange={setOpen}>
        <Dropdown.Trigger
          aria-label={nav('account')}
          className={
            variant === 'nav'
              ? 'flex cursor-pointer items-center rounded-full outline-none'
              : 'w-full cursor-pointer outline-none'
          }
        >
          {variant === 'nav' ? (
            avatar
          ) : (
            <Chip
              variant="soft"
              className="flex w-full items-center gap-2.5 py-2 pr-2.5 pl-2 text-left"
            >
              {avatar}
              <Chip.Label className="min-w-0 flex-1">
                <span className="block truncate text-sm">{displayName}</span>
                <span className="text-site-faint block truncate text-xs">{identity.email}</span>
              </Chip.Label>
              <CaretIcon />
            </Chip>
          )}
        </Dropdown.Trigger>
        <Dropdown.Popover
          placement={variant === 'nav' ? 'bottom end' : 'top start'}
          onPointerEnter={hold}
          onPointerLeave={release}
        >
          <Dropdown.Menu className="min-w-52">
            {variant === 'nav' ? (
              MENU_LINKS.map((item) => (
                <Dropdown.Item key={item.href} onAction={() => router.push(item.href)}>
                  {labelFor(item)}
                </Dropdown.Item>
              ))
            ) : (
              <Dropdown.Item onAction={() => router.push('/dashboard/settings')}>
                {admin('settings')}
              </Dropdown.Item>
            )}
            <Dropdown.Item onAction={() => signOutRef.current?.requestSubmit()}>
              {nav('signOut')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      <form ref={signOutRef} method="post" action="/auth/sign-out" className="hidden" />
    </div>
  )
}

/** Caret icon for dropdown trigger. */
function CaretIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="text-site-muted size-4 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
