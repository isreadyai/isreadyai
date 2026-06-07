'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'
import { commandFor, ERunners, typeInto } from './cli-showcase'

// MARK: - Footer command (typewriter, rotating runners)

/**
 * Retypes the install command cycling the runners (npx → bunx → pnpm dlx →
 * yarn dlx). The longest variant reserves the width so the footer can't reflow
 * mid-type. SSR renders the npx variant.
 */

const HOST = 'yourdomain.com'
const RUNNERS = Object.values(ERunners)
const LONGEST = RUNNERS.map((r) => commandFor(r, HOST)).toSorted((a, b) => b.length - a.length)[0]!

const HOLD_S = 2.4
const TYPE_CPS = 24
const ERASE_CPS = 60

export function FooterCommand() {
  const ref = useRef<HTMLSpanElement>(null)

  // MARK: - Lifecycle
  useEffect(() => {
    const el = ref.current
    if (el === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let timeline: { kill(): void } | undefined

    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      const tl = gsap.timeline({ repeat: -1 })
      RUNNERS.forEach((runner, index) => {
        const current = commandFor(runner, HOST)
        const next = commandFor(RUNNERS[(index + 1) % RUNNERS.length]!, HOST)
        tl.to({}, { duration: HOLD_S })
        tl.add(typeInto(gsap, el, current, ERASE_CPS, true))
        tl.add(typeInto(gsap, el, next, TYPE_CPS))
      })
      timeline = tl
    })
    return () => {
      alive = false
      timeline?.kill()
    }
  }, [])

  return (
    <code
      className="bg-site-surface inline-block rounded px-2 py-1 text-left font-mono text-xs"
      style={{ minWidth: `${LONGEST.length}ch` }}
    >
      <span className="sr-only">{commandFor(ERunners.NPM, HOST)}</span>
      <span aria-hidden="true">
        <span ref={ref}>{commandFor(ERunners.NPM, HOST)}</span>
        <span className="text-site-accent animate-pulse select-none">▍</span>
      </span>
    </code>
  )
}
