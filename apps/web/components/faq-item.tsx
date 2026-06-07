'use client'

import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface IFaqItemProps {
  children: ReactNode
  id?: string
  question: string
}

/** FAQ item with hash-scroll support and details disclosure. */
export function FaqItem({ children, id, question }: IFaqItemProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useLayoutEffect(() => {
    if (id === undefined) {
      return
    }

    let scrollFrame: number | undefined
    let scrollTimer: number | undefined
    const openTarget = (): void => {
      if (window.location.hash === `#${id}` && detailsRef.current !== null) {
        detailsRef.current.open = true
        const scrollToTarget = (): void => {
          if (window.location.hash === `#${id}`) {
            detailsRef.current?.scrollIntoView({ block: 'start' })
          }
        }
        scrollFrame = requestAnimationFrame(scrollToTarget)
        scrollTimer = window.setTimeout(scrollToTarget, 250)
      }
    }

    openTarget()
    window.addEventListener('hashchange', openTarget)
    return () => {
      if (scrollFrame !== undefined) {
        cancelAnimationFrame(scrollFrame)
      }
      if (scrollTimer !== undefined) {
        window.clearTimeout(scrollTimer)
      }
      window.removeEventListener('hashchange', openTarget)
    }
  }, [id])

  return (
    <details
      ref={detailsRef}
      id={id}
      className="border-site-border bg-site-surface/50 group scroll-mt-24 overflow-hidden rounded-xl border transition-colors target:border-site-accent-dim"
    >
      <summary className="block cursor-pointer list-none px-5 py-4 font-medium select-none [&::-webkit-details-marker]:hidden">
        <span className="text-site-accent mr-2 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {question}
      </summary>
      <div className="text-site-muted space-y-3 px-5 pb-5 text-sm leading-relaxed">{children}</div>
    </details>
  )
}
