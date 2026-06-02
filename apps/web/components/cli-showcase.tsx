'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { gradeOf } from '@isreadyai/scanner'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'
import { GRADE_TEXT, textForScore } from '@/lib/grade'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { CopyButton } from '@/components/ui/copy-button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { IShowcase, IShowcaseFinding, IShowcaseResponse } from '@/lib/showcase'

// MARK: - Types & data

export const ERunners = {
  NPM: 'npm',
  BUN: 'bun',
  PNPM: 'pnpm',
  YARN: 'yarn',
} as const
type TRunner = (typeof ERunners)[keyof typeof ERunners]

const RUNNER_PREFIX: Record<TRunner, string> = {
  npm: 'npx',
  bun: 'bunx',
  pnpm: 'pnpm dlx',
  yarn: 'yarn dlx',
}

export function commandFor(runner: TRunner, host: string): string {
  return `${RUNNER_PREFIX[runner]} isreadyai ${host}`
}

// SSR fallback; replaced by live /api/showcase results once they arrive.
const FALLBACK_SHOWCASES: IShowcase[] = [
  {
    host: 'yourdomain.com',
    score: 92,
    grade: 'EXCELLENT',
    rows: [
      { label: 'Crawler access', score: 100 },
      { label: 'Rendering', score: 96 },
      { label: 'Structured data', score: 84 },
      { label: 'Trust & security', score: 100 },
    ],
    findings: [
      {
        icon: '▲',
        text: 'structured.author-eeat — no entity-identity signals (E-E-A-T)',
        fix: 'add an Organization with logo and sameAs links',
      },
    ],
  },
]

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const ROTATE_PAUSE_S = 6

const ICON_TEXT: Record<IShowcaseFinding['icon'], string> = {
  '✗': 'text-score-poor',
  '▲': 'text-score-moderate',
  '✓': 'text-score-excellent',
}

function miniBar(score: number): string {
  const filled = Math.round(score / 10)
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled)
}

function bigBar(score: number): { filled: string; rest: string } {
  const filled = Math.round((score / 100) * 40)
  return { filled: '█'.repeat(filled), rest: '░'.repeat(40 - filled) }
}

// MARK: - CliShowcase

export function CliShowcase() {
  const t = useTranslations('cli')

  // MARK: - Variables
  const [runner, setRunner] = useState<TRunner>(ERunners.NPM)
  const { copied, copy } = useCopyToClipboard()
  const [showcaseIndex, setShowcaseIndex] = useState(0)
  const [showcases, setShowcases] = useState<IShowcase[]>(FALLBACK_SHOWCASES)
  const rootRef = useRef<HTMLDivElement>(null)
  const spinTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const playRef = useRef<(() => void) | null>(null)
  const pendingPlay = useRef(false)

  const showcase = showcases[showcaseIndex % showcases.length] ?? FALLBACK_SHOWCASES[0]!
  const gradeTone = GRADE_TEXT[gradeOf(showcase.score)]
  const bar = bigBar(showcase.score)

  // MARK: - Live data
  useEffect(() => {
    let alive = true
    fetch('/api/showcase')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: IShowcaseResponse | null) => {
        if (alive && data !== null && data.entries.length > 0) {
          setShowcases(data.entries)
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // MARK: - Lifecycle

  /**
   * One-time gsap setup. Rebuilding the context per rotation/data change raced
   * React commits and killed mid-flight timelines. play() reads the current DOM
   * (React has committed the new text by then); rotation sets state, then a
   * separate effect fires the next run via pendingPlay.
   */
  useEffect(() => {
    const root = rootRef.current
    if (root === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let trigger: { kill(): void } | undefined
    let timeline: { kill(): void } | undefined

    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (!alive) {
        return
      }
      const query = <T extends HTMLElement>(selector: string): T | null =>
        root.querySelector<T>(selector)

      const play = (): void => {
        const cmd = query('[data-cmd]')
        const caret = query('[data-caret]')
        const spinner = query('[data-spinner]')
        const spinnerIcon = query('[data-spinner-icon]')
        const spinnerDone = query('[data-spinner-done]')
        const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-line]'))
        const typed = Array.from(root.querySelectorAll<HTMLElement>('[data-type]'))
        const count = query('[data-count]')
        if (cmd === null) {
          return
        }
        const cmdFull = cmd.textContent ?? ''
        const typedFull = typed.map((el) => el.textContent ?? '')

        timeline?.kill()
        clearInterval(spinTimer.current)
        cmd.textContent = ''
        caret?.classList.remove('hidden')
        spinnerIcon?.classList.remove('hidden')
        spinnerDone?.classList.add('hidden')
        spinner?.classList.add('hidden')
        gsap.set(lines, { opacity: 0 })
        typed.forEach((el) => {
          el.textContent = ''
        })

        const tl = gsap.timeline()
        timeline = tl
        tl.add(typeInto(gsap, cmd, cmdFull, 28), 0.2)
        tl.call(() => {
          caret?.classList.add('hidden')
          spinner?.classList.remove('hidden')
          let frame = 0
          spinTimer.current = setInterval(() => {
            frame += 1
            if (spinnerIcon !== null) {
              spinnerIcon.textContent = SPINNER_FRAMES[frame % SPINNER_FRAMES.length] ?? '⠋'
            }
          }, 80)
        })
        tl.to({}, { duration: 1.3 })
        tl.call(() => {
          clearInterval(spinTimer.current)
          spinnerIcon?.classList.add('hidden')
          spinnerDone?.classList.remove('hidden')
        })
        tl.to(lines, { opacity: 1, duration: 0.2, stagger: 0.12, ease: 'none' }, '+=0.2')
        typed.forEach((el, index) => {
          tl.add(typeInto(gsap, el, typedFull[index] ?? '', 70), index === 0 ? '<+0.25' : '<+0.08')
        })
        if (count !== null) {
          const target = Number(count.getAttribute('data-count'))
          const proxy = { value: 0 }
          tl.to(
            proxy,
            {
              value: target,
              duration: 1,
              ease: 'power2.out',
              onUpdate: () => {
                count.textContent = String(Math.round(proxy.value))
              },
            },
            '<',
          )
        }
        tl.call(
          () => {
            pendingPlay.current = true
            setShowcaseIndex((index) => index + 1)
          },
          undefined,
          `+=${ROTATE_PAUSE_S}`,
        )
      }

      playRef.current = play
      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top 75%',
        once: true,
        onEnter: play,
      })
      trigger = st
    })

    return () => {
      alive = false
      playRef.current = null
      clearInterval(spinTimer.current)
      timeline?.kill()
      trigger?.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time setup by design
  }, [])

  // Replay once React has committed the next showcase's text.
  useEffect(() => {
    if (pendingPlay.current) {
      pendingPlay.current = false
      playRef.current?.()
    }
  }, [showcaseIndex])

  return (
    <div
      ref={rootRef}
      className="border-site-border bg-site-background overflow-hidden rounded-2xl border shadow-2xl"
    >
      <div className="border-site-border/60 bg-site-surface/60 flex min-w-0 items-center gap-2 border-b px-3 py-3 sm:px-4">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="bg-score-poor/80 h-3 w-3 rounded-full" />
          <span className="bg-score-moderate/80 h-3 w-3 rounded-full" />
          <span className="bg-score-excellent/80 h-3 w-3 rounded-full" />
        </span>
        <span className="text-site-faint ml-2 hidden font-mono text-xs sm:inline">
          isreadyai — terminal
        </span>
        <SegmentedControl
          value={runner}
          options={Object.values(ERunners).map((value) => ({ value, label: value }))}
          onChange={setRunner}
          ariaLabel={t('runnerTabs')}
          className="ml-auto min-w-0"
        />
      </div>

      <div className="border-site-border/60 flex min-w-0 items-center gap-3 border-b px-4 py-4 sm:px-5">
        <code className="flex-1 truncate font-mono text-sm sm:text-base">
          <span className="text-site-accent select-none">$ </span>
          <span data-cmd className="text-site-text">
            {commandFor(runner, showcase.host)}
          </span>
          <span data-caret className="text-site-accent hidden select-none">
            ▍
          </span>
        </code>
        <CopyButton
          copied={copied !== null}
          onCopy={() => void copy(commandFor(runner, 'yourdomain.com'))}
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
        />
      </div>

      <div
        className="h-[21rem] space-y-1 overflow-hidden px-4 py-5 font-mono text-xs leading-relaxed sm:h-[23rem] sm:px-5 sm:text-sm"
        aria-hidden="true"
      >
        <p data-spinner className="hidden">
          <span data-spinner-icon className="text-site-accent">
            ⠋
          </span>
          <span data-spinner-done className="text-score-excellent hidden">
            ✓
          </span>{' '}
          <span className="text-site-muted">Scanning {showcase.host}…</span>
        </p>
        <p data-line>
          <span className="text-site-accent">◆</span> <span className="font-bold">isready</span>
          <span className="text-site-muted">.ai</span>
          <span className="text-site-faint"> — AI readiness report</span>
        </p>
        <p data-line className="text-site-faint">
          https://{showcase.host}
        </p>
        <p data-line className="pt-2">
          <span data-count={showcase.score} className={`${gradeTone} text-lg font-bold sm:text-xl`}>
            {showcase.score}
          </span>
          <span className="text-site-faint">/100 </span>
          <span className={`${gradeTone} font-bold tracking-widest`}> {showcase.grade}</span>
        </p>
        <p data-line className={gradeTone}>
          <span data-type>{bar.filled}</span>
          <span data-type className="text-site-raised">
            {bar.rest}
          </span>
        </p>
        <div className="space-y-0.5 pt-2">
          {showcase.rows.map((row) => (
            <p data-line key={row.label}>
              <span data-type className={textForScore(row.score)}>
                {miniBar(row.score)}
              </span>
              <span className={`${textForScore(row.score)} whitespace-pre`}>
                {' '}
                {String(row.score).padStart(3)}
              </span>
              <span className="text-site-muted"> {row.label}</span>
            </p>
          ))}
        </div>
        {showcase.findings.map((finding) => (
          <span key={finding.text}>
            <p data-line className="text-site-faint pt-2">
              <span className={ICON_TEXT[finding.icon]}>{finding.icon}</span>{' '}
              <span className="sm:inline">{finding.text}</span>
            </p>
            {finding.fix !== undefined ? (
              <p data-line className="text-site-faint">
                {' '}
                <span className="text-site-accent">→</span> {finding.fix}
              </p>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  )
}

// MARK: - Hero command pill

export function HeroCommand() {
  const t = useTranslations('cli')

  // MARK: - Variables
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="text-site-faint mt-6 flex flex-col items-center gap-2 text-xs sm:flex-row">
      <span>{t('heroOr')}</span>
      <button
        type="button"
        onClick={() => void copy(commandFor(ERunners.NPM, 'yourdomain.com'))}
        aria-label={`${commandFor(ERunners.NPM, 'yourdomain.com')} — ${t('heroCopy')}`}
        className="border-site-border bg-site-surface/70 hover:border-site-accent-dim group flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 font-mono transition-colors"
      >
        <span className="text-site-accent select-none">$</span>
        <span className="text-site-text">{commandFor(ERunners.NPM, 'yourdomain.com')}</span>
        <span
          className={
            copied !== null ? 'text-site-accent' : 'text-site-faint group-hover:text-site-text'
          }
        >
          {copied !== null ? '✓' : '⧉'}
        </span>
      </button>
    </div>
  )
}

// MARK: - internal

type TGsap = Awaited<ReturnType<typeof loadGsap>>['gsap']

export function typeInto(gsap: TGsap, el: HTMLElement, text: string, cps: number, reverse = false) {
  const proxy = { progress: 0 }
  return gsap.to(proxy, {
    progress: 1,
    duration: Math.max(text.length / cps, 0.2),
    ease: 'none',
    onUpdate: () => {
      const shown = Math.round(proxy.progress * text.length)
      el.textContent = reverse ? text.slice(0, text.length - shown) : text.slice(0, shown)
    },
  })
}
