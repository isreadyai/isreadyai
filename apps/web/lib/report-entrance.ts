'use client'

import type { gsap as TGsap } from 'gsap'

// MARK: - Shared report entrance animation

/**
 * The exact entrance choreography for a report card: panel fade-up, score-ring
 * draw, count-up, category slide, finding fade. Shared so the Smart Agent block
 * animates identically to the main report. `attr` namespaces the panel/cat/
 * finding hooks so two scopes never animate each other's elements; the ring and
 * number are found via the scope, so each card animates only its own score.
 */
export function runReportEntrance(
  scope: HTMLElement,
  gsap: typeof TGsap,
  attr = 'data-anim',
): { revert(): void } {
  return gsap.context(() => {
    gsap.from(`[${attr}="panel"]`, {
      opacity: 0,
      y: 24,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.12,
    })
    const ring = scope.querySelector('circle[data-ring]')
    if (ring !== null) {
      const dash = ring.getAttribute('stroke-dasharray') ?? ''
      const total = dash
        .split(' ')
        .map(Number)
        .reduce((a, b) => a + b, 0)
      gsap.from(ring, {
        attr: { 'stroke-dasharray': `0 ${total}` },
        duration: 1.1,
        ease: 'power2.out',
      })
    }
    const number = scope.querySelector('text[data-score-number]')
    if (number !== null) {
      const target = Number(number.getAttribute('data-score-number'))
      const counter = { value: 0 }
      gsap.to(counter, {
        value: target,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => {
          number.textContent = String(Math.round(counter.value))
        },
      })
    }
    gsap.from(`[${attr}="cat"]`, {
      opacity: 0,
      x: -14,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.06,
      delay: 0.2,
    })
    gsap.from(`[${attr}="finding"]`, {
      opacity: 0,
      y: 16,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.05,
      delay: 0.25,
    })
  }, scope)
}
