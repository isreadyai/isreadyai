'use client'

import { useEffect, useRef, useState } from 'react'

// MARK: - useScrollSpy

/**
 * Mirrors the active section into the URL hash via replaceState (no history
 * spam, no scroll jumps). Pass section ids in DOM order.
 */

const ACTIVATION_RATIO = 0.35

export function useScrollSpy(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeRef = useRef<string | null>(null)
  const ticking = useRef(false)
  const preserveDeepLink = useRef(false)

  useEffect(() => {
    const isDeepLink = (): boolean => {
      const hashId = decodeURIComponent(window.location.hash.slice(1))
      return hashId !== '' && !ids.includes(hashId) && document.getElementById(hashId) !== null
    }

    const compute = (): void => {
      const line = window.innerHeight * ACTIVATION_RATIO
      let current: string | null = null
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el !== null && el.getBoundingClientRect().top <= line) {
          current = id
        }
      }
      if (current === activeRef.current) {
        return
      }
      activeRef.current = current
      // Next patches replaceState into a Router action: run it in the rAF
      // callback, never inside a setState updater (= render phase).
      if (!preserveDeepLink.current) {
        history.replaceState(null, '', current === null ? window.location.pathname : `#${current}`)
      }
      setActiveId(current)
    }

    const onScroll = (): void => {
      if (ticking.current) {
        return
      }
      ticking.current = true
      requestAnimationFrame(() => {
        compute()
        ticking.current = false
      })
    }

    const releaseDeepLink = (): void => {
      preserveDeepLink.current = false
    }
    const syncDeepLink = (): void => {
      preserveDeepLink.current = isDeepLink()
    }

    syncDeepLink()
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    window.addEventListener('hashchange', syncDeepLink)
    window.addEventListener('wheel', releaseDeepLink, { passive: true })
    window.addEventListener('touchstart', releaseDeepLink, { passive: true })
    window.addEventListener('pointerdown', releaseDeepLink, { passive: true })
    window.addEventListener('keydown', releaseDeepLink)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('hashchange', syncDeepLink)
      window.removeEventListener('wheel', releaseDeepLink)
      window.removeEventListener('touchstart', releaseDeepLink)
      window.removeEventListener('pointerdown', releaseDeepLink)
      window.removeEventListener('keydown', releaseDeepLink)
    }
  }, [ids])

  return activeId
}
