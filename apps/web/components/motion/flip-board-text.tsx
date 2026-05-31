'use client'

import { useEffect, useRef } from 'react'
import { loadGsap } from '@/lib/load-gsap'

/** Flipping card that cycles through terms */
export function FlipBoardText({ terms }: { terms: readonly [string, ...string[]] }) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const panelRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const root = rootRef.current
    const panels = panelRefs.current.filter((panel): panel is HTMLSpanElement => panel !== null)
    const firstPanel = panels[0]
    if (root === null || firstPanel === undefined || panels.length < 2) {
      return
    }
    // The overlapping flip frames are too dense for very narrow handsets.
    // Keep the first term static there; the full animation starts at 360px.
    if (window.innerWidth < 360) {
      return
    }

    let alive = true
    let revert: (() => void) | undefined

    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }

      const media = gsap.matchMedia(root)
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set(panels, { autoAlpha: 0, rotationX: -90, yPercent: 8 })
        gsap.set(firstPanel, { autoAlpha: 1, rotationX: 0, yPercent: 0 })

        const timeline = gsap.timeline({ repeat: -1 })

        panels.forEach((panel, index) => {
          const nextPanel = panels[index + 1] ?? firstPanel

          timeline
            .to({}, { duration: 1.8 })
            .to(panel, {
              autoAlpha: 0,
              rotationX: 90,
              yPercent: -8,
              duration: 0.32,
              ease: 'power2.in',
              transformOrigin: '50% 100%',
            })
            .fromTo(
              nextPanel,
              {
                autoAlpha: 0,
                rotationX: -90,
                yPercent: 8,
                transformOrigin: '50% 0%',
              },
              {
                autoAlpha: 1,
                rotationX: 0,
                yPercent: 0,
                duration: 0.42,
                ease: 'power3.out',
                immediateRender: false,
              },
              '<0.14',
            )
        })

        return () => {
          timeline.kill()
        }
      })

      revert = () => {
        media.revert()
      }
    })

    return () => {
      alive = false
      revert?.()
    }
  }, [terms.length])

  return (
    <span
      ref={rootRef}
      aria-label={terms[0]}
      className="border-site-border bg-site-surface text-site-accent relative mx-[0.08em] inline-grid overflow-hidden rounded-[0.18em] border align-[0.08em] font-mono text-[0.78em] leading-none font-bold tracking-[-0.04em] shadow-[0_0.12em_0.4em_rgb(0_0_0_/_0.22)] [perspective:700px]"
    >
      {terms.map((term) => (
        <span
          key={`size-${term}`}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap px-[0.28em] py-[0.14em]"
        >
          {term}
        </span>
      ))}
      {terms.map((term, index) => (
        <span
          key={term}
          ref={(panel) => {
            panelRefs.current[index] = panel
          }}
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center whitespace-nowrap [backface-visibility:hidden] ${
            index === 0 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {term}
        </span>
      ))}
      <span
        aria-hidden="true"
        className="border-site-background/70 pointer-events-none absolute inset-x-0 top-1/2 z-10 border-t"
      />
    </span>
  )
}
