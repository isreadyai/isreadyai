'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'

// MARK: - RevealOnScroll

/**
 * `staggerChildren` animates direct children with a stagger (card grids);
 * otherwise the wrapper animates as one block.
 */

export function RevealOnScroll({
  children,
  staggerChildren = false,
  className,
}: {
  children: ReactNode
  staggerChildren?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

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
      const targets = staggerChildren ? Array.from(el.children) : el
      const inViewport = el.getBoundingClientRect().top < window.innerHeight
      const tween = gsap.fromTo(
        targets,
        { opacity: 0, y: 24, filter: 'blur(6px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.65,
          ease: 'power2.out',
          stagger: staggerChildren ? 0.09 : 0,
          clearProps: 'filter',
          ...(inViewport
            ? { delay: 0.15 }
            : { scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
        },
      )
      cleanup = () => {
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    })

    return () => {
      alive = false
      cleanup?.()
    }
  }, [staggerChildren])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
