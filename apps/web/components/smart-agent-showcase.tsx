'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { prefersReducedMotion } from '@/lib/motion'
import { loadGsap } from '@/lib/load-gsap'
import { ROTATE_PAUSE_S, typeInto } from '@/components/cli-showcase'

// MARK: - Data

const SCORE = 86

// The rendered accessibility tree a browser-capable agent reads — the same
// shape agent-browser exposes as the Smart Agent View.
const TREE_LINES = [
  '- main',
  '  - heading "Product" [level=1]',
  '  - paragraph "Clear value proposition"',
  '  - link "View pricing" [ref=e7]',
  '  - button "Start free" [ref=e8]',
]

// MARK: - SmartAgentShowcase

/**
 * Promo window for the premium "Ask your site" experience. Reuses the CLI
 * window's chrome and gsap typewriter so the demo emulates the real chat: the
 * agent reads the rendered tree, the LLM runs its grounding tool calls, then
 * answers. Loops on a pause like the CLI showcase.
 */
export function SmartAgentShowcase() {
  const t = useTranslations('smart')
  const rootRef = useRef<HTMLDivElement>(null)

  // One-time gsap setup. The full strings live in constants/i18n, so play()
  // never has to recover text from a DOM it just cleared (unlike the CLI, which
  // re-reads because its text rotates per scan).
  useEffect(() => {
    const root = rootRef.current
    if (root === null || prefersReducedMotion()) {
      return
    }
    let alive = true
    let trigger: { kill(): void } | undefined
    let timeline: { kill(): void } | undefined
    let raf = 0

    const question = t('demoQuestion')
    const answer = t('demoAnswer')

    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (!alive) {
        return
      }
      const query = <T extends HTMLElement>(selector: string): T | null =>
        root.querySelector<T>(selector)

      const play = (): void => {
        if (!alive) {
          return
        }
        const treeLines = Array.from(root.querySelectorAll<HTMLElement>('[data-tree-line]'))
        const questionEl = query('[data-q]')
        const answerEl = query('[data-answer]')
        const answerWrap = query('[data-answer-wrap]')
        const count = query('[data-count]')
        const tools = [
          { run: query('[data-tool="view-run"]'), done: query('[data-tool="view-done"]') },
          { run: query('[data-tool="find-run"]'), done: query('[data-tool="find-done"]') },
        ]

        timeline?.kill()

        // Reset to the empty/pre-call state.
        treeLines.forEach((el) => {
          el.textContent = ''
        })
        if (questionEl !== null) {
          questionEl.textContent = ''
        }
        if (answerEl !== null) {
          answerEl.textContent = ''
        }
        gsap.set(answerWrap, { autoAlpha: 0 })
        tools.forEach((tool) => {
          tool.run?.classList.add('hidden')
          tool.done?.classList.add('hidden')
        })
        if (count !== null) {
          count.textContent = '0'
        }

        const tl = gsap.timeline()
        timeline = tl

        // 1. The agent reads the page — type the tree line by line.
        treeLines.forEach((el, index) => {
          tl.add(typeInto(gsap, el, TREE_LINES[index] ?? '', 120), index === 0 ? 0.3 : '<+0.18')
        })

        // 2. The user question is typed.
        if (questionEl !== null) {
          tl.add(typeInto(gsap, questionEl, question, 45), '+=0.4')
        }

        // 3. The LLM runs its grounding tool calls: pulse while running, ✓ when done.
        tools.forEach((tool) => {
          tl.call(
            () => {
              tool.run?.classList.remove('hidden')
            },
            undefined,
            '+=0.35',
          )
          tl.to({}, { duration: 0.9 })
          tl.call(() => {
            tool.run?.classList.add('hidden')
            tool.done?.classList.remove('hidden')
          })
        })

        // 4. The answer streams into the bubble; the score counts up alongside.
        tl.to(answerWrap, { autoAlpha: 1, duration: 0.25 }, '+=0.2')
        if (answerEl !== null) {
          tl.add(typeInto(gsap, answerEl, answer, 55))
        }
        if (count !== null) {
          const proxy = { value: 0 }
          tl.to(
            proxy,
            {
              value: SCORE,
              duration: 1,
              ease: 'power2.out',
              onUpdate: () => {
                count.textContent = String(Math.round(proxy.value))
              },
            },
            '<',
          )
        }

        // 5. Pause, then loop. Defer the next run a frame so we never kill the
        // timeline from inside its own callback.
        tl.call(
          () => {
            raf = requestAnimationFrame(play)
          },
          undefined,
          `+=${ROTATE_PAUSE_S}`,
        )
      }

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
      cancelAnimationFrame(raf)
      timeline?.kill()
      trigger?.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time setup by design
  }, [])

  return (
    <div
      ref={rootRef}
      className="border-site-border bg-site-background overflow-hidden rounded-2xl border shadow-2xl"
    >
      <div className="border-site-border/60 bg-site-surface/60 flex items-center gap-2 border-b px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="bg-score-poor/80 h-3 w-3 rounded-full" />
          <span className="bg-score-moderate/80 h-3 w-3 rounded-full" />
          <span className="bg-score-excellent/80 h-3 w-3 rounded-full" />
        </span>
        <span className="text-site-faint ml-2 font-mono text-xs">{t('windowLabel')}</span>
        <span className="text-site-secondary ml-auto font-mono text-xs">
          <span data-count={SCORE}>{SCORE}</span> / 100
        </span>
      </div>

      <div className="bg-site-border grid gap-px sm:h-[27.5rem] sm:grid-cols-2" aria-hidden="true">
        <div className="bg-site-background overflow-hidden p-4">
          <p className="text-site-faint font-mono text-[10px] tracking-wide uppercase">
            {t('viewTitle')}
          </p>
          <pre className="text-site-muted mt-3 overflow-hidden font-mono text-xs leading-6">
            {TREE_LINES.map((line) => (
              <span data-tree-line key={line} className="block">
                {line}
              </span>
            ))}
          </pre>
        </div>

        <div className="bg-site-background flex flex-col overflow-hidden p-4">
          <p className="text-site-faint font-mono text-[10px] tracking-wide uppercase">
            {t('askTitle')} · ⌘I
          </p>
          <p data-q className="text-site-muted mt-5 text-xs leading-relaxed">
            {t('demoQuestion')}
          </p>
          <div className="mt-3 space-y-1 font-mono text-[11px]">
            <p>
              <span data-tool="view-run" className="text-site-muted hidden animate-pulse">
                {t('demoToolView')}
              </span>
              <span data-tool="view-done" className="text-site-faint">
                <span className="text-score-excellent">✓</span> {t('demoToolViewDone')}
              </span>
            </p>
            <p>
              <span data-tool="find-run" className="text-site-muted hidden animate-pulse">
                {t('demoToolFindings')}
              </span>
              <span data-tool="find-done" className="text-site-faint">
                <span className="text-score-excellent">✓</span> {t('demoToolFindingsDone')}
              </span>
            </p>
          </div>
          <div
            data-answer-wrap
            className="border-site-secondary/30 bg-site-secondary/10 mt-3 rounded-lg border p-3 text-xs leading-relaxed"
          >
            <span data-answer>{t('demoAnswer')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
