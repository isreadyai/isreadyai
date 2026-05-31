'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'

// MARK: - TorchText

/**
 * Sweeps the gradient hotspot across the text L→R; static centered highlight
 * without JS or under reduced motion.
 */

export function TorchText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let cleanup: (() => void) | undefined

    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      const tween = gsap.fromTo(
        el,
        { backgroundPosition: '120% 0' },
        {
          backgroundPosition: '-20% 0',
          duration: 3.2,
          ease: 'sine.inOut',
          repeat: -1,
          repeatDelay: 1.4,
          delay: 0.6,
        },
      )
      cleanup = () => {
        tween.kill()
      }
    })

    return () => {
      alive = false
      cleanup?.()
    }
  }, [])

  return (
    <span ref={ref} className="text-gradient-accent">
      {children}
    </span>
  )
}
