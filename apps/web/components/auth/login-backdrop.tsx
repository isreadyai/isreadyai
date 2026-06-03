'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

import { loadGsap } from '@/lib/load-gsap'
import { prefersReducedMotion } from '@/lib/motion'

// MARK: - Animated login backdrop
//
// A faint field of on-theme glyphs (AI robots, git, file-alert, trust shields),
// each a comet: the icon leads, a tail of ever-smaller dashes trails toward the
// bottom-left. Icon + tail share one SVG coordinate space (no fragile nested
// transforms). CSS gives a deterministic static scatter so the field is always
// visible (no-JS / reduced-motion); GSAP then owns the absolute position and
// wraps it over the viewport so glyphs drift bottom-left → top-right forever
// without ever leaving the screen for good. Decorative only.

const GLYPHS: ReactNode[] = [
  <>
    <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
    <path d="M12 8V5" />
    <circle cx="12" cy="3.8" r="1.2" />
    <circle cx="9" cy="13" r="1" />
    <circle cx="15" cy="13" r="1" />
    <path d="M9.5 16.2c1.5 1.2 3.5 1.2 5 0" />
  </>,
  <>
    <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
    <path d="M12 8V5" />
    <circle cx="12" cy="3.8" r="1.2" />
    <path d="M8 12l2 2M10 12l-2 2" />
    <path d="M14 12l2 2M16 12l-2 2" />
    <path d="M9.5 16.5h5" />
  </>,
  <>
    <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
    <path d="M12 8V5" />
    <circle cx="12" cy="3.8" r="1.2" />
    <circle cx="9" cy="13" r="1" />
    <circle cx="15" cy="13" r="1" />
    <path d="M9.5 16.5h5" />
  </>,
  <>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="8" r="2.2" />
    <path d="M6 8.2v7.6" />
    <path d="M18 10.2c0 4-3 6-7 6" />
  </>,
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M3 12h6" />
    <path d="M15 12h6" />
  </>,
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11.5v3.5" />
    <path d="M12 17.6v.01" />
  </>,
  <>
    <path d="M12 3l7 2.6v5.2c0 4.6-3.1 7.4-7 8.7-3.9-1.3-7-4.1-7-8.7V5.6z" />
    <path d="M9 12l2 2 4-4" />
  </>,
  <>
    <path d="M12 3l7 2.6v5.2c0 4.6-3.1 7.4-7 8.7-3.9-1.3-7-4.1-7-8.7V5.6z" />
    <path d="M10.3 10a1.8 1.8 0 1 1 2.4 1.7c-.5.3-.7.6-.7 1.3" />
    <path d="M12 15.5v.01" />
  </>,
  <>
    <path d="M12 3l7 2.6v5.2c0 4.6-3.1 7.4-7 8.7-3.9-1.3-7-4.1-7-8.7V5.6z" />
    <path d="M9.5 9.5l5 5" />
    <path d="M14.5 9.5l-5 5" />
  </>,
]

const GLYPH_COUNT = 56
const TAIL_DASHES = '26 6 18 8 12 9 8 10 6 11 4 12 3'

/**
 * Deterministic pseudo-random in [0,1) from index + salt. Integer math only:
 * a float/Math.sin hash diverges in the low digits between the server's and
 * the browser's engine, which trips React's hydration check. Callers round the
 * result to a fixed precision so the SSR and client style strings are identical.
 */
function seeded(index: number, salt: number): number {
  let x = Math.imul(index + 1, salt ^ 0x9e3779b9)
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Animated backdrop with drifting glyph field. */
export function LoginBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let ctx: { revert(): void } | undefined
    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      ctx = gsap.context(() => {
        const glyphs = gsap.utils.toArray<HTMLElement>('[data-glyph]')
        const width = window.innerWidth
        const height = window.innerHeight
        const wrapX = gsap.utils.unitize(gsap.utils.wrap(-80, width + 80))
        const wrapY = gsap.utils.unitize(gsap.utils.wrap(-80, height + 80))
        for (const glyph of glyphs) {
          gsap.set(glyph, {
            left: 0,
            top: 0,
            x: gsap.utils.random(-80, width + 80),
            y: gsap.utils.random(-80, height + 80),
          })
          gsap.to(glyph, {
            x: `+=${width + height}`,
            y: `-=${width + height}`,
            duration: gsap.utils.random(46, 108),
            ease: 'none',
            repeat: -1,
            modifiers: { x: wrapX, y: wrapY },
          })
        }
      }, root)
    })
    return () => {
      alive = false
      ctx?.revert()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <linearGradient
            id="comet-tail"
            gradientUnits="userSpaceOnUse"
            x1="98"
            y1="102"
            x2="20"
            y2="180"
          >
            <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {Array.from({ length: GLYPH_COUNT }, (_, index) => {
        const span = (5 + seeded(index, 307) * 3.6).toFixed(3)
        return (
          <span
            key={index}
            data-glyph
            className="text-site-muted absolute"
            style={{
              left: `${(seeded(index, 101) * 100).toFixed(3)}%`,
              top: `${(seeded(index, 211) * 100).toFixed(3)}%`,
              opacity: (0.07 + seeded(index, 409) * 0.11).toFixed(4),
            }}
          >
            <svg
              viewBox="0 0 200 200"
              fill="none"
              stroke="currentColor"
              className="block"
              style={{ width: `${span}rem`, height: `${span}rem` }}
            >
              <line
                x1="98"
                y1="102"
                x2="20"
                y2="180"
                stroke="url(#comet-tail)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={TAIL_DASHES}
              />
              <g
                transform="translate(138 62) rotate(45) scale(2.4) translate(-12 -12)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {GLYPHS[index % GLYPHS.length]}
              </g>
            </svg>
          </span>
        )
      })}
    </div>
  )
}
