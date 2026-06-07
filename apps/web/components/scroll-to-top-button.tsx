'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { prefersReducedMotion, scrollToTop } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'

// MARK: - Scroll-to-top button

const SHOW_AFTER_PX = 600

export function ScrollToTopButton() {
  const t = useTranslations('nav')

  // MARK: - Variables
  const [visible, setVisible] = useState(false)
  // Raised above the "Ask your site" pill (same bottom-right corner) when it's on
  // screen, so the two floating controls never overlap.
  const [raised, setRaised] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const ticking = useRef(false)

  useEffect(() => {
    const sync = (): void => setRaised(document.getElementById('ask-your-site-fab') !== null)
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  // MARK: - Lifecycle
  useEffect(() => {
    const onScroll = (): void => {
      if (ticking.current) {
        return
      }
      ticking.current = true
      requestAnimationFrame(() => {
        setVisible(window.scrollY > SHOW_AFTER_PX)
        ticking.current = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el === null) {
      return
    }
    let alive = true
    let tween: { kill(): void } | undefined
    void loadGsap().then(({ gsap }) => {
      if (!alive) {
        return
      }
      if (prefersReducedMotion()) {
        gsap.set(el, { autoAlpha: visible ? 1 : 0, y: 0, scale: 1 })
        return
      }
      tween = gsap.to(el, {
        autoAlpha: visible ? 1 : 0,
        y: visible ? 0 : 12,
        scale: visible ? 1 : 0.9,
        duration: 0.35,
        ease: visible ? 'power3.out' : 'power3.in',
      })
    })
    return () => {
      alive = false
      tween?.kill()
    }
  }, [visible])

  return (
    <button
      ref={ref}
      type="button"
      onClick={scrollToTop}
      aria-label={t('backToTop')}
      tabIndex={visible ? 0 : -1}
      className={`border-site-border bg-site-surface/80 text-site-muted hover:border-site-accent-dim hover:text-site-accent fixed right-5 z-40 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border opacity-0 backdrop-blur-md transition-[bottom,border-color,color] duration-300 sm:right-8 ${
        raised ? 'bottom-20 sm:bottom-24' : 'bottom-5 sm:bottom-8'
      }`}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16">
        <path
          d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
