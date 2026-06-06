// MARK: - Motion helpers

/** SSR-safe reduced-motion check — import this, never re-implement inline. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Scroll back to the top — smooth, or instant under reduced motion. */
export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
}
