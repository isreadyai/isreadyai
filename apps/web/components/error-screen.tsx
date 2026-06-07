import type { CSSProperties, ReactNode } from 'react'

// MARK: - Error screen (404 / 500)
//
// One friendly full-viewport screen behind a faint falling "code rain". Pure
// CSS animation (one keyframe in globals.css), so it renders in both server
// components (not-found) and client error boundaries.

const GLYPHS = '◆{}<>/01;=$*[]…#'
// Deterministic layout (SSR-safe); the fall is randomised only via CSS timing.
const RAIN = Array.from({ length: 48 }, (_, i) => ({
  char: GLYPHS[(i * 7) % GLYPHS.length] ?? '◆',
  left: (i * 37) % 100,
  size: 0.7 + ((i * 13) % 6) * 0.14,
  delay: -(((i * 29) % 80) / 6),
  duration: 7 + ((i * 17) % 8),
  opacity: 0.05 + ((i * 23) % 5) * 0.03,
}))

/** Error screen with code-rain backdrop for 404 / 500 pages. */
export function ErrorScreen({
  code,
  title,
  accent,
  subtitle,
  action,
}: {
  code: string
  title: string
  accent: string
  subtitle: string
  action: ReactNode
}) {
  return (
    <main className="bg-site-background relative flex min-h-dvh items-center overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_16%,#000_84%,transparent)]"
        aria-hidden="true"
      >
        {RAIN.map((g, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional, static
            // eslint-disable-next-line react/no-array-index-key -- positional/static rain glyphs, no stable id
            key={i}
            className={`code-rain-glyph absolute top-0 font-mono leading-none ${
              i % 4 === 0 ? 'text-site-accent' : 'text-site-muted'
            }`}
            style={
              {
                left: `${g.left}%`,
                fontSize: `${g.size}rem`,
                opacity: g.opacity,
                animation: `code-rain-fall ${g.duration}s linear ${g.delay}s infinite`,
              } as CSSProperties
            }
          >
            {g.char}
          </span>
        ))}
      </div>

      <div className="site-container relative z-10">
        <p className="text-site-text font-mono text-[clamp(5rem,22vw,15rem)] leading-none font-semibold tracking-[-0.04em]">
          {code}
        </p>
        <h1 className="mt-2 text-[clamp(1.8rem,5vw,3.5rem)] leading-[1.05] font-bold tracking-tight">
          {title} <span className="text-site-accent">{accent}</span>
        </h1>
        <p className="text-site-muted mt-6 max-w-xl text-lg">{subtitle}</p>
        <div className="mt-10 flex flex-wrap gap-3">{action}</div>
      </div>
    </main>
  )
}
