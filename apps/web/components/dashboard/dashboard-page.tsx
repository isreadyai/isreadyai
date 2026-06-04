'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Breadcrumbs } from '@heroui/react/breadcrumbs'
import type { ReactNode } from 'react'

// MARK: - Dashboard page scaffold
//
// Every dashboard section composes this: a sticky header carrying a workspace
// breadcrumb at the same h-16 as the sidebar header, so their bottom borders
// form one continuous line. The breadcrumb stays visible for navigation, but
// the page's primary heading lives in a visually-hidden <h1> so the document
// has exactly one semantic h1. The body is full-width with uniform top, bottom
// and horizontal padding.

interface IBreadcrumbParent {
  label: string
  href: string
}

interface IDashboardPageProps {
  title: string
  description?: string
  action?: ReactNode
  parents?: IBreadcrumbParent[]
  children: ReactNode
}

const DEFAULT_PARENTS: IBreadcrumbParent[] = []

export function DashboardPage({
  title,
  description,
  action,
  parents = DEFAULT_PARENTS,
  children,
}: IDashboardPageProps) {
  const t = useTranslations('admin')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-site-border bg-site-background/85 sticky top-16 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl sm:gap-4 sm:px-5 lg:top-0 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {parents.length > 0 ? (
            // Squared outline back button, before the breadcrumb, on every detail page.
            <Link
              href={parents[parents.length - 1]!.href}
              aria-label={t('backTo', { label: parents[parents.length - 1]!.label })}
              className="border-site-border text-site-muted hover:border-site-accent-dim hover:text-site-text flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          ) : null}
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="min-w-0 truncate text-sm sm:hidden">{title}</span>
            <Breadcrumbs className="hidden min-w-0 text-sm sm:flex">
              <Breadcrumbs.Item href="/dashboard">{t('breadcrumbRoot')}</Breadcrumbs.Item>
              {parents.map((parent) => (
                <Breadcrumbs.Item key={parent.href} href={parent.href}>
                  {parent.label}
                </Breadcrumbs.Item>
              ))}
              <Breadcrumbs.Item>{title}</Breadcrumbs.Item>
            </Breadcrumbs>
            {description !== undefined ? (
              <span className="text-site-muted hidden truncate text-xs xl:inline">
                — {description}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Link
            href="/"
            aria-label={t('backToSite')}
            className="border-site-border text-site-muted hover:border-site-accent-dim hover:text-site-text flex size-9 items-center justify-center rounded-lg border transition-colors sm:size-auto sm:px-3 sm:py-2 sm:text-sm sm:whitespace-nowrap"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4 sm:hidden"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 5h5v5M19 5l-8 8" />
              <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
            </svg>
            <span className="hidden sm:inline">{t('backToSite')}</span>
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 px-5 py-6 lg:overflow-y-auto lg:px-8 lg:py-8">
        <h1 className="sr-only">{title}</h1>
        {children}
      </div>
    </div>
  )
}
