'use client'

import { useEffect, useState } from 'react'

// MARK: - useScrollProgress

/**
 * 0→1 over the first SCROLL_ANIMATION_RANGE px, rAF-throttled. The header
 * detach runs in CSS off the --header-progress var; JS only updates one number.
 */

const SCROLL_ANIMATION_RANGE = 80

export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false
    const compute = (): void => {
      setProgress(Math.min(Math.max(window.scrollY / SCROLL_ANIMATION_RANGE, 0), 1))
    }
    const onScroll = (): void => {
      if (ticking) {
        return
      }
      ticking = true
      requestAnimationFrame(() => {
        compute()
        ticking = false
      })
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return progress
}
