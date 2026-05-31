import type { CSSProperties, ReactNode } from 'react'

// MARK: - Reveal (hero entrance)

/**
 * Pure CSS animation: hero children are LCP candidates, and any JS-applied
 * change after hydration (opacity/filter/transform) re-rasterizes them and
 * pushes LCP by seconds on throttled mobile. The CSS keyframe runs at first
 * paint; reduced-motion disables it in the stylesheet.
 */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const style: CSSProperties | undefined = delay > 0 ? { animationDelay: `${delay}s` } : undefined
  return (
    <div className={`hero-rise ${className ?? ''}`} style={style}>
      {children}
    </div>
  )
}
