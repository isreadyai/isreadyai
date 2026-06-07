'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { SiteNav } from './site-nav'
import { useScrollProgress } from '@/lib/use-scroll-progress'

// MARK: - Site header

/**
 * Detaches into a floating glass pill on scroll: --header-progress (0→1 over
 * the first 80px) drives margin/width/radius/border/background/blur entirely in
 * CSS via calc()/color-mix().
 */

/** Slot pages can portal a second row into (e.g. the compact report bar) so it
 *  shares the pill's surface and can't detach from the menu. */
export const HEADER_BAR_SLOT_ID = 'header-bar-slot'

export function SiteHeader() {
  const progress = useScrollProgress()

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 [padding-right:var(--ays-inset,0px)] [transition:var(--ays-transition,none)]">
      <div
        style={{ '--header-progress': progress } as CSSProperties}
        className="pointer-events-auto mx-auto mt-[calc(var(--header-progress,0)*var(--spacing)*4)] w-[calc(100%_-_var(--header-progress,0)*var(--spacing)*8)] max-w-6xl overflow-hidden rounded-[calc(var(--header-progress,0)*var(--spacing)*4)] border border-[color-mix(in_oklab,var(--color-site-border)_calc(var(--header-progress,0)*100%),transparent)] bg-[color-mix(in_oklab,var(--color-site-background)_calc(var(--header-progress,0)*88%),transparent)] backdrop-blur-[calc(var(--header-progress,0)*16px)]"
      >
        <div className="flex items-center justify-between px-4 py-1.5 sm:px-6 sm:py-2.5">
          <Link href="/" className="flex items-baseline gap-1 font-semibold tracking-tight">
            <span className="text-site-accent" aria-hidden="true">
              ◆
            </span>
            <span>isready</span>
            <span className="text-site-muted">.ai</span>
          </Link>
          <SiteNav />
        </div>
        <div id={HEADER_BAR_SLOT_ID} />
      </div>
    </header>
  )
}
