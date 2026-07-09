'use client'

import { useEffect, useRef, useState } from 'react'

// MARK: - Product Hunt badge

// Fades out as the reader scrolls away from the hero, clearing the bottom-right
// corner before the scroll-to-top button appears (SHOW_AFTER_PX = 600).
const FADE_DISTANCE_PX = 320

export function ProductHuntBadge(
  props: React.ComponentPropsWithoutRef<'a'> & { className?: string }
) {
  // MARK: - Variables
  const { className: propsClassName, ...rest } = props
  const [opacity, setOpacity] = useState(1)
  const ticking = useRef(false)
  const className = [propsClassName, 'hidden drop-shadow-lg transition-opacity hover:opacity-90 sm:block']
    .filter(Boolean)
    .join(' ')

  // MARK: - Lifecycle
  useEffect(() => {
    const onScroll = (): void => {
      if (ticking.current) {
        return
      }
      ticking.current = true
      requestAnimationFrame(() => {
        setOpacity(Math.max(0, 1 - window.scrollY / FADE_DISTANCE_PX))
        ticking.current = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <a
      href="https://www.producthunt.com/products/isready-ai?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-isready-ai"
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={opacity === 0}
      tabIndex={opacity === 0 ? -1 : 0}
      style={{ opacity, pointerEvents: opacity === 0 ? 'none' : 'auto' }}
      className={className}
      {...rest}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external Product Hunt widget (theme/timestamp params, not a static asset) */}
      <img
        alt="IsReady.AI - Can AI actually read your website? Score it in ~5 seconds | Product Hunt"
        width={250}
        height={54}
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1192122&theme=dark&t=1783605465808"
      />
    </a>
  )
}
