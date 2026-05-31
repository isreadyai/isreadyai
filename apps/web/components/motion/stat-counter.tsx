'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'

// MARK: - StatCounter

/**
 * Number counts up when scrolled into view; prefix/suffix stay static.
 * Reduced motion renders the final value (also the SSR output). Large values
 * abbreviate (1.5K / 2M / 1.2B); small ones render in full.
 */

function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function StatCounter({
  value,
  prefix = '',
  suffix = '',
  label,
}: {
  value: number
  prefix?: string
  suffix?: string
  label: string
}) {
  const numberRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = numberRef.current
    if (el === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let cleanup: (() => void) | undefined

    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      const counter = { value: 0 }
      const inViewport = el.getBoundingClientRect().top < window.innerHeight
      const tween = gsap.to(counter, {
        value,
        duration: 1.4,
        ease: 'power2.out',
        ...(inViewport
          ? { delay: 0.2 }
          : { scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
        onUpdate: () => {
          el.textContent = formatCompact(Math.round(counter.value))
        },
      })
      cleanup = () => {
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    })

    return () => {
      alive = false
      cleanup?.()
    }
  }, [value])

  return (
    <div>
      <div className="text-site-accent font-mono text-3xl font-bold">
        {prefix}
        <span ref={numberRef}>{formatCompact(value)}</span>
        {suffix}
      </div>
      <div className="text-site-muted mt-1 text-xs tracking-wide uppercase">{label}</div>
    </div>
  )
}
