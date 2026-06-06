'use client'

import type { gsap as TGsap } from 'gsap'
import type { ScrollTrigger as TScrollTrigger } from 'gsap/ScrollTrigger'

// MARK: - Lazy GSAP

/**
 * Keeps gsap (~35KB) off the critical path. Every animation here runs
 * post-hydration anyway, so on-demand loading changes nothing visually.
 */

interface IGsapBundle {
  gsap: typeof TGsap
  ScrollTrigger: typeof TScrollTrigger
}

let cached: Promise<IGsapBundle> | null = null

export function loadGsap(): Promise<IGsapBundle> {
  cached ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
    ([gsapModule, stModule]) => {
      gsapModule.gsap.registerPlugin(stModule.ScrollTrigger)
      return { gsap: gsapModule.gsap, ScrollTrigger: stModule.ScrollTrigger }
    },
  )
  return cached
}
