---
version: alpha
name: isready.ai — AI readiness scanner
description: >-
  Visual identity of the isready.ai marketing site and report surfaces
  (apps/web). A dark-only, terminal-flavored Next.js App Router product built on
  Tailwind 4 @theme tokens, the Geist font family, HeroUI v3 primitives, and
  lazy-loaded GSAP motion. The look is developer-tool: monospace accents,
  window/terminal cards, a single acid-green accent, and score-graded data.

colors:
  # Neutral surfaces — dark-only, OKLCH ramp from background up to raised
  site-background: 'oklch(0.145 0.004 100)'
  site-surface: 'oklch(0.185 0.005 100)'
  site-raised: 'oklch(0.225 0.006 100)'
  site-border: 'oklch(0.3 0.006 100)'

  # Text ramp — text → muted → faint
  site-text: 'oklch(0.93 0.004 100)'
  site-muted: 'oklch(0.62 0.008 100)'
  site-faint: 'oklch(0.45 0.008 100)'

  # Accent — acid green, the single brand color
  site-accent: 'oklch(0.85 0.21 130)'
  site-accent-dim: 'oklch(0.55 0.14 130)'
  site-accent-foreground: 'oklch(0.15 0.02 130)'

  # Secondary — teal, reserved for the secondary button and a few labels
  site-secondary: '#0076a2'
  site-secondary-dim: '#005a7d'
  site-secondary-foreground: '#ffffff'

  # Score grades — data-driven, never decorative
  score-excellent: 'oklch(0.8 0.19 145)'
  score-good: 'oklch(0.8 0.13 220)'
  score-moderate: 'oklch(0.82 0.16 85)'
  score-poor: 'oklch(0.66 0.21 25)'

typography:
  # next/font families, exposed as Tailwind --font-* variables
  font-sans: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif'
  font-mono: 'var(--font-geist-mono), ui-monospace, monospace'

rounded:
  sm: '0.125rem' # rounded-sm — tight inline chrome
  md: '0.375rem' # rounded-md — segmented-control tabs
  lg: '0.5rem' # rounded-lg — copy chips, evidence <pre>
  xl: '0.75rem' # rounded-xl — buttons, inputs, finding rows (DEFAULT for controls)
  2xl: '1rem' # rounded-2xl — window/terminal cards
  full: '9999px' # progress bars, traffic-light dots, pills

components:
  button-primary:
    backgroundColor: '{colors.site-accent}'
    textColor: '{colors.site-accent-foreground}'
    rounded: '{rounded.xl}'
    minHeight: '3rem'
  button-secondary:
    backgroundColor: '{colors.site-secondary}'
    textColor: '{colors.site-secondary-foreground}'
    rounded: '{rounded.xl}'
    minHeight: '3rem'
  button-outline:
    backgroundColor: transparent
    border: '{colors.site-border}'
    textColor: '{colors.site-text}'
    rounded: '{rounded.xl}'
    minHeight: '3rem'
  text-input:
    backgroundColor: '{colors.site-surface}'
    border: '{colors.site-border}'
    placeholderColor: '{colors.site-faint}'
    rounded: '{rounded.xl}'
    minHeight: '3rem'
  window-card:
    backgroundColor: '{colors.site-background}'
    border: '{colors.site-border}'
    rounded: '{rounded.2xl}'
    shadow: 'shadow-2xl'
  finding-row:
    backgroundColor: '{colors.site-surface} @ 50%'
    border: '{colors.site-border}'
    rounded: '{rounded.xl}'
---

# isready.ai — Design System

This document is the source of truth for product design in `apps/web`. Repository-wide engineering rules belong in [CONVENTIONS.md](CONVENTIONS.md).

## Overview

isready.ai scans a website and reports how ready it is for AI crawlers and
generative engines (GPTBot, ClaudeBot, `llms.txt`, GEO/LLM-SEO). The surfaces in
this repo are the **marketing site** and the **scan report** (`apps/web`), plus
a gated admin preview. The audience is technical: developers, SEO engineers, and
founders who run a CLI and read a graded score.

The product personality is **developer-tool, dark, and precise**. The interface
borrows the vocabulary of a terminal: monospace numerals and labels, macOS-style
"window" cards with traffic-light dots, a `$`-prefixed command line, and a single
acid-green accent against near-black neutrals. Color carries meaning — green is
the brand, and the four score grades (poor / moderate / good / excellent) are the
only other saturated hues you will see. Everything else is a neutral gray.

The system is **dark-only**. There is no light theme and no theme switcher: the
root `<html>` is hard-coded to `dark` with `color-scheme: dark`, and tokens are
authored as a single OKLCH ramp. Treat dark as the canonical and only mode.

The implementation is **Next.js App Router + Tailwind 4 + HeroUI v3**. Design
tokens live in a Tailwind `@theme` block in `apps/web/app/globals.css`; there is
no separate config file or token package. Interactive primitives wrap HeroUI v3;
motion is lazy-loaded GSAP. All user-facing text flows through `next-intl`.

## Color and theming

The palette is a single dark OKLCH ramp anchored by one accent (acid green) and a
data-only score scale. All tokens are defined in the `@theme` block of
`apps/web/app/globals.css` and consumed as Tailwind classes (`bg-site-surface`,
`text-site-muted`, `text-score-poor`) or as CSS variables in SVG
(`var(--color-site-accent)`).

### Neutral surfaces and text

Surfaces step up in lightness from the page background to raised chrome; text
steps down from primary to faint.

| Token                     | Class prefix      | Value (OKLCH)     | Role                                 |
| ------------------------- | ----------------- | ----------------- | ------------------------------------ |
| `--color-site-background` | `site-background` | `0.145 0.004 100` | Page and window-card body            |
| `--color-site-surface`    | `site-surface`    | `0.185 0.005 100` | Cards, inputs, window title bars     |
| `--color-site-raised`     | `site-raised`     | `0.225 0.006 100` | Progress-bar track, score-ring track |
| `--color-site-border`     | `site-border`     | `0.3 0.006 100`   | All borders, dot grid                |
| `--color-site-text`       | `site-text`       | `0.93 0.004 100`  | Primary text                         |
| `--color-site-muted`      | `site-muted`      | `0.62 0.008 100`  | Secondary text, labels               |
| `--color-site-faint`      | `site-faint`      | `0.45 0.008 100`  | Metadata, placeholders, check IDs    |

### Accent and secondary

| Token                               | Class prefix                | Value                  | Role                                                            |
| ----------------------------------- | --------------------------- | ---------------------- | --------------------------------------------------------------- |
| `--color-site-accent`               | `site-accent`               | `oklch(0.85 0.21 130)` | Brand. Primary button, `$` prompt, links, focus ring, selection |
| `--color-site-accent-dim`           | `site-accent-dim`           | `oklch(0.55 0.14 130)` | Hover borders on outline controls                               |
| `--color-site-accent-foreground`    | `site-accent-foreground`    | `oklch(0.15 0.02 130)` | Text on accent fills                                            |
| `--color-site-secondary`            | `site-secondary`            | `#0076a2`              | Teal. Secondary button, a few demo labels                       |
| `--color-site-secondary-dim`        | `site-secondary-dim`        | `#005a7d`              | Reserved secondary hover                                        |
| `--color-site-secondary-foreground` | `site-secondary-foreground` | `#ffffff`              | Text on secondary fills                                         |

The accent is the only brand color. Use it for the single most important action,
the terminal prompt, inline links, and the global focus ring. The teal secondary
is rare — it exists for the secondary-action button variant and a handful of demo
numerals; do not reach for it as a general second accent.

### Score grades

The four score colors are **data, not decoration**. They map one-to-one to the
scanner's `TGrade` union and must only ever be driven by a real score. The
mapping lives in `apps/web/lib/grade.ts`; never inline a grade color in a
component.

| Token                     | Class prefix      | Value (OKLCH)  | Grade            |
| ------------------------- | ----------------- | -------------- | ---------------- |
| `--color-score-poor`      | `score-poor`      | `0.66 0.21 25` | Red — failing    |
| `--color-score-moderate`  | `score-moderate`  | `0.82 0.16 85` | Amber — warning  |
| `--color-score-good`      | `score-good`      | `0.8 0.13 220` | Blue — passing   |
| `--color-score-excellent` | `score-excellent` | `0.8 0.19 145` | Green — top tier |

Resolve grade colors through the `apps/web/lib/grade.ts` helpers:
`GRADE_COLORS` (CSS-variable map for inline SVG `style`/`stroke`), `GRADE_TEXT`
(Tailwind `text-score-*` class map), and the score-driven `colorForScore` /
`textForScore`. Thresholds live in `@isreadyai/scanner` (`gradeOf`) so the web app
and the CLI cannot disagree on what a number means. The traffic-light dots on
window cards reuse `bg-score-poor/80`, `bg-score-moderate/80`, and
`bg-score-excellent/80` as a deliberate macOS red/amber/green nod.

## Typography

Two fonts, both loaded through `next/font` (`geist/font/sans`, `geist/font/mono`)
in `apps/web/app/layout.tsx` and exposed as the `--font-sans` and `--font-mono`
Tailwind tokens. No webfont is fetched at runtime; the `GeistSans.variable` and
`GeistMono.variable` classes are applied to `<html>`.

| Family     | Token         | Class                 | Use                                                                |
| ---------- | ------------- | --------------------- | ------------------------------------------------------------------ |
| Geist Sans | `--font-sans` | default / `font-sans` | All prose, headings, body copy, buttons                            |
| Geist Mono | `--font-mono` | `font-mono`           | Numerals, scores, command lines, check IDs, labels, code, evidence |

Monospace is a core part of the identity, not just for code. Reach for
`font-mono` whenever you render a **number, a score, a command, a path, a check
ID, or a small uppercase label** — for example the score-ring numerals
(`ScoreRing`), the `StatCounter` value, the category-bar score, the terminal
command in `cli-showcase.tsx`, and the `isreadyai — terminal` window label.

There is no fixed type ramp; size with Tailwind's scale. Observed conventions:

- **Hero / section headings** use large sans sizes with `font-semibold` or
  `font-bold`. Gradient and per-character treatments come from the motion
  components (`TorchText`, `FlipBoardText`), not from a separate heading style.
- **Body copy** uses `text-sm` in dense report contexts and the default body
  size in marketing sections, in `text-site-text` with `text-site-muted` for
  secondary lines.
- **Small uppercase labels** use `text-xs uppercase tracking-wide` (or
  `tracking-widest`) in `text-site-muted` or `text-site-faint` — see the
  `StatCounter` label and `ScoreRing` grade label.

Antialiasing is set globally (`-webkit-font-smoothing: antialiased` on `body`,
plus `antialiased` on `<body>`).

## Spacing and layout

Layout is marketing-first and section-based: a centered content column with
generous vertical rhythm, in contrast to a dense backoffice. There is one
canonical container.

- **`.site-container`** (defined in `globals.css`) is the page-width wrapper:
  `max-width: 72rem`, auto inline margins, and fluid inline padding
  `clamp(1.25rem, 4vw, 3rem)`. Use it for every full-width section; do not
  hand-roll page widths.
- **Spacing** uses Tailwind's default scale (`gap-*`, `space-y-*`, `px-*`,
  `py-*`). Prefer scale steps over arbitrary `px` values. Arbitrary values are
  acceptable only for intentional, non-tokenizable geometry (for example the
  fixed showcase heights `h-[21rem]` / `sm:h-[23rem]` in `cli-showcase.tsx`).
- **Mobile-first**: start from the small-screen layout and add `sm:` / `md:`
  breakpoints upward.
- **Grids** carry structural intent. The category bar uses a fixed three-track
  grid `grid-cols-[8rem_1fr_2.5rem]` (label · bar · score); the smart-agent
  window splits into `sm:grid-cols-2` with a 1px `bg-site-border` gutter
  (`gap-px`) to draw hairline panel dividers.

The decorative **`.bg-grid-faint`** utility paints a masked radial dot grid using
`--color-site-border`; it is `pointer-events: none` background texture only.

## Elevation, borders, and radii

Depth comes from **borders, tonal surface steps, and one strong shadow on window
cards**. There is no soft-shadow elevation system for ordinary cards.

### Borders

A 1px `border-site-border` is the default separator for cards, inputs, finding
rows, and chips. Internal dividers and title bars commonly soften the border to
`border-site-border/60`. Hover states on neutral controls promote the border to
`hover:border-site-accent-dim`.

### Radii

Tailwind's radius scale, used with consistent roles:

| Class          | Role                                                          |
| -------------- | ------------------------------------------------------------- |
| `rounded-sm`   | Tight inline chrome (rare)                                    |
| `rounded-md`   | Segmented-control tabs                                        |
| `rounded-lg`   | Copy chips, evidence `<pre>` blocks, small panels             |
| `rounded-xl`   | Buttons, text inputs, finding rows — the default for controls |
| `rounded-2xl`  | Window/terminal showcase cards                                |
| `rounded-full` | Progress-bar tracks and fills, traffic-light dots, pills      |

### The window/terminal card pattern

The signature surface is a macOS-style window. It is hand-composed (not a shared
component yet) and appears in `apps/web/components/cli-showcase.tsx`,
`smart-agent-showcase.tsx`, `github-showcase.tsx`, and the report views. The
recipe:

```tsx
<div className="border-site-border bg-site-background overflow-hidden rounded-2xl border shadow-2xl">
  <div className="border-site-border/60 bg-site-surface/60 flex items-center gap-2 border-b px-4 py-3">
    <span className="flex gap-1.5" aria-hidden="true">
      <span className="bg-score-poor/80 h-3 w-3 rounded-full" />
      <span className="bg-score-moderate/80 h-3 w-3 rounded-full" />
      <span className="bg-score-excellent/80 h-3 w-3 rounded-full" />
    </span>
    <span className="text-site-faint ml-2 font-mono text-xs">isreadyai — terminal</span>
  </div>
  {/* body on bg-site-background */}
</div>
```

Key invariants: `rounded-2xl` + `shadow-2xl` on the outer frame, `overflow-hidden`
to clip the body, a `bg-site-surface/60` title bar with a softened bottom border,
three `h-3 w-3 rounded-full` traffic-light dots in red/amber/green (decorative,
`aria-hidden`), and a `font-mono text-xs text-site-faint` window label. The
`shadow-2xl` here is the only place a strong drop shadow is appropriate.

## Components

UI code follows three levels: `components/ui` for domain-agnostic primitives,
`components/<feature>` for domain-aware components, and `app/*` for route
composition. Extract a shared component only when two call sites genuinely
share semantics, interaction, and visual states.

### UI primitives — `apps/web/components/ui`

#### Button — `button.tsx`

A native-element button (not react-aria) that renders a real Next `<Link>` when
given `href`, preserving native navigation, middle-click, and prefetch.

- **Variants** via `EButtonVariant` / `TButtonVariant`:
  `primary` (accent fill, hover to `site-text`), `secondary` (teal fill),
  `outline` (transparent, bordered — the **default**).
- **Props (`IButtonProps`)**: `children`, `variant?`, `href?`, `onPress?`,
  `type?` (`'button' | 'submit'`), `isDisabled?`, `className?`, `ariaLabel?`.
- **Base**: `inline-flex min-h-12 ... gap-2 rounded-xl px-5 text-sm font-medium`,
  with `disabled:cursor-not-allowed disabled:opacity-60`.

#### TextInput — `text-input.tsx`

Wraps HeroUI v3 `Input` (`@heroui/react/input`) with product tokens.

- **Props (`ITextInputProps`)**: HeroUI `InputProps` minus `className`, plus
  `surface?` (`'solid'` → `bg-site-surface`, `'subtle'` → `bg-site-surface/70`)
  and `isMonospace?` (mono + `text-base`, otherwise `text-sm`).
- **Base**: `border-site-border placeholder:text-site-faint min-h-12 w-full rounded-xl border px-4`.

#### SegmentedControl — `segmented-control.tsx`

A generic tab-style toggle (`role="tablist"` of `role="tab"` buttons), used for
the package-runner switch in `cli-showcase.tsx`.

- **Props (`ISegmentedControlProps<T extends string>`)**: `value`,
  `options` (`readonly { value, label }[]`), `onChange`, `ariaLabel`,
  `className?`.
- **States**: selected → `bg-site-accent text-site-accent-foreground border-site-accent`;
  idle → `text-site-muted border-transparent` with accent-dim hover.
  `rounded-md font-mono text-xs`.

#### CopyButton — `copy-button.tsx`

A copy-to-clipboard chip. Controlled: the parent owns clipboard state.

- **Props**: `copied` (boolean), `onCopy`, `copyLabel`, `copiedLabel`.
- **States**: copied → accent border/text; idle → `border-site-border text-site-muted`
  with accent-dim hover. `rounded-lg font-mono text-xs`.

#### Icon marks — `vercel-mark.tsx`, `github-icon.tsx`

Inline `currentColor` SVGs, `aria-hidden="true"`, with a single `className` prop
for sizing/color. `VercelMark` is the Vercel triangle; `GitHubIcon` is the Octocat
glyph. They inherit color from their text context.

### Report components — `apps/web/components/report`

| Component                                                                      | Purpose                               | Notes                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScoreRing`                                                                    | Pure-SVG circular score gauge (0–100) | No client JS. Track `var(--color-site-raised)`, progress stroke from `GRADE_COLORS[grade]`, mono numerals, `role="img"` with score label                      |
| `CategoryBar`                                                                  | Per-category horizontal score bar     | Three-track grid; `bg-site-raised` track, fill colored by `colorForScore`, `role="progressbar"` with aria value attrs; label links to the matching FAQ        |
| `FindingItem`                                                                  | Expandable check result               | Native `<details>/<summary>`; `✗`/`▲` glyph in `score-poor`/`score-moderate`; reveals fix, impact, effort, docs link, affected pages, and an evidence `<pre>` |
| `ReportView`                                                                   | Report layout shell                   | Composes ring, bars, and findings                                                                                                                             |
| `ScanForm`, `EmailReportForm`                                                  | Input forms                           | Use `TextInput` + `Button`; errors render in `text-score-poor`                                                                                                |
| `DeepScanSection`, `SmartAgentSection`, `SmartAgentDeepSection`, `AskYourSite` | Feature sections                      | Window-card and report-section patterns                                                                                                                       |
| `ReportStickyBar`                                                              | Sticky report action bar              | —                                                                                                                                                             |

### Dashboard and admin layout

The authenticated dashboard is a fixed-height app shell. These rules are
**mandatory** for every dashboard route and section; new pages must follow them.
The implementation lives in `apps/web/components/dashboard`.

- **Shell** (`DashboardShell`): on desktop the content column is `lg:h-dvh` (a
  definite height) so any `fill` table inside resolves its flex height and
  scrolls internally; mobile keeps `min-h-dvh`. The sidebar header and each
  page header are both `h-16` so their bottom borders form one continuous line.
- **Page scaffold** (`DashboardPage`): the sticky `h-16` header carries, left to
  right: a **squared outline back button** (`size-9 rounded-lg border`, before
  the breadcrumb, only on pages with a parent), the **breadcrumb**, and the page
  description as an **inline gray subtitle** (`— description`, never on its own
  line). The body is `flex-1 lg:overflow-y-auto` and holds the page content.
- **Detail pages**: open with a header row that mirrors the scan report —
  **identity (title + URL/meta) on the left, actions on the right**
  (`flex sm:flex-row sm:items-center justify-between`). Re-use this shape across
  scan and website details so they're visually interchangeable.
- **Section / page actions go bottom-right** of their card
  (`flex justify-end`), not bottom-left. This is the single placement for a
  card's primary CTA (e.g. _Manage subscription_) everywhere in the dashboard.
- **Everything actionable is a `Button`** — never a bare text link — including
  row actions like an invoice _View_. Destructive = `danger` (solid); primary
  action = `primary`; a Pro-gated control = `secondary` + `outline` (reads as an
  upgrade affordance).
- **Button order is invariant.** Every action row orders buttons left→right by
  type: **primary → neutral/secondary → destructive (`danger`) last**. The
  destructive button is always the rightmost. This order is identical on every
  page (scan report, website detail, billing, …) — it MUST NEVER differ by page.
- **Tables** use `DataTable` with `fill`: it takes the remaining vertical space,
  scrolls its body internally under a **sticky thead**, and exposes scans-style
  columns. List rows are clickable into their detail (stretched-link or
  `onRowClick`); nested detail scans live under their parent
  (`/dashboard/websites/[id]/scans/[scanId]`).
- **Alert severity** (`notify`): plan-gating, quota, validation, and transient
  states are `warning`; only genuine failures are `error`. `success` for
  completed writes, `info` for neutral notices.
- **Cards / panels** use `rounded-2xl`; the HeroUI `.card` radius is pinned to
  match so cards and their loading skeletons never disagree.

### Marketing showcases — `apps/web/components`

`cli-showcase.tsx`, `smart-agent-showcase.tsx`, and `github-showcase.tsx` all use
the window/terminal card. The CLI showcase animates a typed command and scrolling
output (mapping `✗`/`▲`/`✓` to `text-score-poor`/`moderate`/`excellent`); the
smart-agent showcase renders a two-pane window (file tree + ask panel) with a
`/ 100` score. `SiteNav`, `SiteFooter`, `GitHubShowcase`, `FaqItem`, and
`ScrollToTopButton` round out chrome and navigation.

## Motion and animation

Motion is **lazy-loaded GSAP**, gated on `prefers-reduced-motion`, and never on
the critical render path.

- **Lazy GSAP** — `apps/web/lib/load-gsap.ts` dynamically imports `gsap` and
  `gsap/ScrollTrigger` (~35KB) once, caches the promise, and registers the
  plugin. Always animate through `loadGsap()`; never static-import GSAP.
- **Reduced motion** — `apps/web/lib/motion.ts` exports the SSR-safe
  `prefersReducedMotion()` (returns `true` during SSR) and `scrollToTop()`
  (instant under reduced motion). Import these; never re-implement the
  `matchMedia` check inline. CSS-driven animations are additionally neutralized
  by a global `@media (prefers-reduced-motion: reduce)` block in `globals.css`
  that disables `scroll-behavior` and collapses all animation/transition
  durations to `0.01ms`.

### Patterns

| Component        | File                          | Pattern                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RevealOnScroll` | `motion/reveal-on-scroll.tsx` | ScrollTrigger fade-up-and-deblur (`opacity 0→1, y 24→0, blur 6px→0`, `power2.out`, `start: 'top 88%', once: true`). `staggerChildren` staggers direct children by 0.09s. Skips entirely under reduced motion; if already in viewport, runs on a short delay instead of a trigger |
| `Reveal`         | `motion/reveal.tsx`           | **Pure CSS** `hero-rise` keyframe (no JS) so hero LCP candidates are not re-rasterized post-hydration; accepts a `delay`. Reduced motion disables it via stylesheet                                                                                                              |
| `TorchText`      | `motion/torch-text.tsx`       | Sweeps the `.text-gradient-accent` gradient hotspot L→R on a loop; static centered highlight without JS                                                                                                                                                                          |
| `FlipBoardText`  | `motion/flip-board-text.tsx`  | Split-flap board cycling through terms with 3D `rotationX` flips, using `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`; exposes the first term via `aria-label` and hides panels from AT                                                                           |
| `StatCounter`    | `motion/stat-counter.tsx`     | Counts a number up on scroll-in; reduced motion / SSR renders the final value                                                                                                                                                                                                    |

Conventions for any new GSAP component: capture `ref.current`, bail if `null` or
`prefersReducedMotion()`, guard the async `loadGsap()` callback with an `alive`
flag, and return a cleanup that kills the tween and its `scrollTrigger`.

## Accessibility

- **Focus** — a global `:focus-visible` rule paints a 2px `--color-site-accent`
  outline with 2px offset; inputs/textareas additionally get an accent border and
  ring. Do not remove focus outlines. `--ring` and `--focus` map to the accent.
- **Reduced motion** — respected in both layers: JS animations bail via
  `prefersReducedMotion()`; CSS animations and smooth scroll collapse under the
  global media query.
- **Decorative vs. meaningful** — purely visual elements are `aria-hidden="true"`
  (traffic-light dots, the dot grid, flip-board panels, terminal output, chevron
  SVGs). Data graphics expose semantics: `ScoreRing` is `role="img"` with a
  `"{score}/100 — {label}"` name; `CategoryBar` is `role="progressbar"` with
  `aria-valuenow/min/max`; `SegmentedControl` is `role="tablist"` with
  `aria-selected` tabs.
- **Semantic HTML** — prefer native elements: `FindingItem` is `<details>/<summary>`
  (keyboard-operable for free); `Button` renders a real `<button>` or `<Link>`.
  Preserve native behavior, keyboard access, and accessible names.
- **Links** — external links use `target="_blank" rel="noopener noreferrer"` and
  an accessible name noting "opens in a new tab"; use descriptive link text, not
  "click here".
- **Color is never the only signal** — findings pair color with a glyph
  (`✗`/`▲`/`✓`) and text.

## Content and internationalization

- **All user-facing text lives in `next-intl`.** Messages are in
  `apps/web/i18n/messages/en.json`, keyed by namespace (`site`, `nav`, `hero`,
  `stats`, `smart`, `how`, `checks`, `cli`, `gh`, `why`, `faq`, `report`,
  `notFound`, `admin`, `error`, `footer`). Never hardcode a visible string in a
  component — including admin surfaces and `aria-label`s. Read translations with
  `useTranslations('<namespace>')` (client) or `getTranslations` (server).
- **Tone** — concise, technical, developer-facing. Apply Google developer
  documentation style to docs and UI copy: sentence case, second person, present
  tense, active voice. Use descriptive link text.
- **Metadata** — `apps/web/app/layout.tsx` builds title/description/OpenGraph
  from the `site` namespace via `generateMetadata`; the viewport `themeColor` is
  `#161613`.

## Engineering conventions

Naming, formatting, imports, TypeScript, comments, React behavior, testing, and other repository-wide engineering rules are defined only in [CONVENTIONS.md](CONVENTIONS.md).

## Do's and Don'ts

- **Do** drive every score color from a real score through `lib/grade.ts`
  (`colorForScore`, `GRADE_TEXT`). **Don't** use `score-poor`/`moderate`/`good`/
  `excellent` decoratively or inline a grade hex.
- **Do** reserve `site-accent` for the primary action, the `$` prompt, links, and
  the focus ring. **Don't** introduce a second general accent — `site-secondary`
  is for the secondary button variant only.
- **Do** build elevated showcases with the window-card recipe
  (`rounded-2xl border border-site-border bg-site-background shadow-2xl overflow-hidden`).
  **Don't** add drop shadows to ordinary cards, buttons, or inputs.
- **Do** use `font-mono` for numbers, scores, commands, paths, check IDs, and
  small labels. **Don't** render scores or terminal text in the sans family.
- **Do** route every visible string and `aria-label` through `next-intl`.
  **Don't** hardcode user-facing text, even in admin or error states.
- **Do** animate through `loadGsap()` and bail on `prefersReducedMotion()`.
  **Don't** static-import GSAP or re-implement the reduced-motion check inline.
- **Do** keep hero entrance motion pure-CSS (`Reveal` / `hero-rise`) to protect
  LCP. **Don't** apply post-hydration JS transforms to LCP candidates.
- **Do** use `EButtonVariant` and the `Button` component for actions. **Don't**
  rebuild button styling ad-hoc; extract a variant if a new one is needed.
- **Do** prefer native semantic elements (`<details>`, `<button>`, `<Link>`) and
  expose data-graphic semantics with `role`/`aria-*`. **Don't** rebuild
  interactive widgets that lose keyboard access.
- **Do** mark purely decorative elements `aria-hidden="true"` and pair status
  color with a glyph and text. **Don't** rely on color alone to convey state.
- **Do** wrap full-width sections in `.site-container` and size with the Tailwind
  scale, mobile-first. **Don't** hand-roll page widths or scatter arbitrary `px`
  spacing.
- **Do** define tokens in the `@theme` block of `apps/web/app/globals.css` and
  consume them as `site-*` / `score-*` classes. **Don't** fork HeroUI internals
  or hardcode colors that a token already names.
- **Do** treat the app as dark-only. **Don't** add a light theme or theme
  switcher; the root `<html>` is fixed to `dark`.
