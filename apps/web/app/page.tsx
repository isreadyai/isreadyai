import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { AI_CRAWLERS, allChecks } from '@isreadyai/scanner'
import { getPlanPrices } from '@/lib/plan-prices'
import { ScanForm } from '@/components/scan-form'
import { CliShowcase, HeroCommand } from '@/components/cli-showcase'
import { FaqItem } from '@/components/faq-item'
import { GithubShowcase } from '@/components/github-showcase'
import { SmartAgentShowcase } from '@/components/smart-agent-showcase'
import { PremiumTiers } from '@/components/premium-tiers'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { HeroCopy } from '@/components/hero-copy'
import { Reveal } from '@/components/motion/reveal'
import { RevealOnScroll } from '@/components/motion/reveal-on-scroll'
import { StatCounter } from '@/components/motion/stat-counter'
import { VercelMark } from '@/components/ui/vercel-mark'
import {
  CHECK_CATEGORY_DOCUMENTATION,
  CHECK_CATEGORY_ORDER,
  SCORE_SOURCE_URL,
  SMART_CATEGORY_DOCUMENTATION,
  SMART_CATEGORY_ORDER,
  SMART_SCORE_SOURCE_URL,
} from '@/lib/check-category-docs'
import { getScanStore } from '@/lib/scan-store.ts'
import { parseMkt } from '@/lib/mkt'
import { GITHUB_URL, SITE_NAME, SITE_URL } from '@/lib/site'

// MARK: - Landing page (dogfood: SSG, semantic HTML, full JSON-LD)

// Statically rendered, regenerated hourly: the scan-count stat stays fresh
// without a per-request DB query, keeping TTFB low for AI fetchers.
export const revalidate = 3600

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ mkt?: string | string[] }>
}) {
  const t = await getTranslations()

  const mkt = parseMkt((await searchParams).mkt)

  const store = await getScanStore()
  const checksPerformed = (await store.countCompletedScans()) * allChecks.length

  // Localised plan prices in the reader's currency (Stripe currency_options);
  // null when Stripe isn't configured, so the table simply omits the amount.
  const prices = await getPlanPrices((await headers()).get('x-vercel-ip-country'))

  const faqEntries = [7, 1, 2, 3, 4, 5, 6, 8].map((i) => ({
    question: t(`faq.q${i}`),
    answer: t(`faq.a${i}`),
  }))

  const categoryFaqEntries = CHECK_CATEGORY_ORDER.map((category) => {
    const documentation = CHECK_CATEGORY_DOCUMENTATION[category]
    return {
      faqId: documentation.faqId,
      sourceUrl: documentation.sourceUrl,
      scoreUrl: SCORE_SOURCE_URL,
      question: t(`faq.categories.${documentation.messageKey}.question`),
      purpose: t(`faq.categories.${documentation.messageKey}.purpose`),
      method: t(`faq.categories.${documentation.messageKey}.method`),
    }
  })

  const smartCategoryFaqEntries = SMART_CATEGORY_ORDER.map((category) => {
    const documentation = SMART_CATEGORY_DOCUMENTATION[category]
    return {
      faqId: documentation.faqId,
      sourceUrl: SMART_SCORE_SOURCE_URL,
      scoreUrl: SMART_SCORE_SOURCE_URL,
      question: t(`faq.categories.${documentation.messageKey}.question`),
      purpose: t(`faq.categories.${documentation.messageKey}.purpose`),
      method: t(`faq.categories.${documentation.messageKey}.method`),
    }
  })

  const allCategoryFaqEntries = [...categoryFaqEntries, ...smartCategoryFaqEntries]

  const structuredFaqEntries = [
    ...allCategoryFaqEntries.map((entry) => ({
      question: entry.question,
      answer: `${entry.purpose} ${entry.method}`,
    })),
    ...faqEntries,
  ]

  const steps = [1, 2, 3].map((i) => ({
    title: t(`how.step${i}Title`),
    body: t(`how.step${i}Body`),
  }))

  const checkGroups = [
    { key: 'crawler', accent: true },
    { key: 'rendering', accent: true },
    { key: 'structured', accent: false },
    { key: 'trust', accent: false },
    { key: 'geo', accent: false },
    { key: 'llms', accent: false },
  ] as const

  return (
    <>
      <JsonLd faq={structuredFaqEntries} />
      <SiteHeader />
      <main>
        <section id="home" className="relative overflow-hidden">
          <div className="bg-grid-faint absolute inset-0 -z-10" aria-hidden="true" />
          <div className="site-container flex min-h-dvh flex-col items-center pt-24 pb-10 text-center">
            <div className="flex w-full flex-1 flex-col items-center justify-center">
              <Reveal>
                <p className="border-site-border bg-site-surface/70 text-site-muted mb-6 inline-block rounded-full border px-4 py-1 font-mono text-[11px] tracking-wide sm:text-xs">
                  {t('hero.kicker', { count: allChecks.length })}
                </p>
              </Reveal>
              <HeroCopy mkt={mkt} />
              <Reveal delay={0.24} className="mt-10 flex w-full justify-center">
                <ScanForm />
              </Reveal>
            </div>
            <Reveal delay={0.34} className="mt-10 shrink-0">
              <HeroCommand />
            </Reveal>
          </div>
        </section>

        <section aria-label="Key numbers" className="border-site-border/60 border-y">
          <RevealOnScroll
            staggerChildren
            className="site-container grid grid-cols-2 gap-x-4 gap-y-6 py-8 text-center sm:grid-cols-4 sm:gap-6"
          >
            <StatCounter value={checksPerformed} label={t('stats.performed')} />
            <StatCounter value={allChecks.length} label={t('stats.checks')} />
            <StatCounter value={AI_CRAWLERS.length} label={t('stats.crawlers')} />
            <StatCounter value={5} prefix="~" suffix="s" label={t('stats.seconds')} />
          </RevealOnScroll>
        </section>

        <section id="smart-agent" className="border-site-border/60 scroll-mt-20 border-b">
          <div className="site-container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
            <RevealOnScroll className="min-w-0 lg:order-2">
              <p className="text-site-secondary flex flex-wrap items-center gap-2 font-mono text-xs tracking-wide uppercase">
                {t('smart.kicker')}
                <span className="border-site-secondary/45 text-site-secondary inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none">
                  {t('smart.proBadge')}
                </span>
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('smart.title')}
              </h2>
              <p className="text-site-muted mt-3 leading-relaxed">{t('smart.subtitle')}</p>
              <ul className="text-site-muted mt-6 space-y-3 text-sm">
                <li>
                  <span className="text-site-secondary font-semibold">{t('smart.viewTitle')}:</span>{' '}
                  {t('smart.viewBody')}
                </li>
                <li>
                  <span className="text-site-secondary font-semibold">{t('smart.askTitle')}:</span>{' '}
                  {t('smart.askBody')}
                </li>
              </ul>
              <p className="text-site-faint mt-6 flex flex-wrap items-center gap-1.5 text-xs">
                <VercelMark className="text-site-text" />
                <span>{t('smart.poweredBy')}</span>
                <a
                  href="https://agent-browser.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-site-text hover:text-site-secondary underline underline-offset-2"
                >
                  agent-browser
                </a>
                <span>{t('smart.vercelProject')}</span>
              </p>
            </RevealOnScroll>
            <RevealOnScroll className="min-w-0 lg:order-1">
              <SmartAgentShowcase />
            </RevealOnScroll>
          </div>
        </section>

        <section id="cli" className="border-site-border/60 scroll-mt-20 border-b">
          <div className="site-container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[0.85fr_1.15fr]">
            <RevealOnScroll className="min-w-0 lg:order-1">
              <p className="text-site-accent font-mono text-xs tracking-wide uppercase">
                {t('cli.kicker')}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('cli.title')}
              </h2>
              <p className="text-site-muted mt-3 leading-relaxed">{t('cli.subtitle')}</p>
              <ul className="text-site-muted mt-6 space-y-2 font-mono text-sm">
                <li>
                  <span className="text-site-accent" aria-hidden="true">
                    ›{' '}
                  </span>
                  {t('cli.hint1')}
                </li>
                <li>
                  <span className="text-site-accent" aria-hidden="true">
                    ›{' '}
                  </span>
                  {t('cli.hint2')}
                </li>
                <li>
                  <span className="text-site-accent" aria-hidden="true">
                    ›{' '}
                  </span>
                  {t('cli.hint3')}
                </li>
              </ul>
            </RevealOnScroll>
            <RevealOnScroll className="min-w-0 lg:order-2">
              <CliShowcase />
            </RevealOnScroll>
          </div>
        </section>

        <section id="github-action" className="border-site-border/60 scroll-mt-20 border-b">
          <div className="site-container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]">
            <RevealOnScroll className="min-w-0 lg:order-2">
              <p className="text-site-accent font-mono text-xs tracking-wide uppercase">
                {t('gh.kicker')}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('gh.title')}
              </h2>
              <p className="text-site-muted mt-3 leading-relaxed">{t('gh.subtitle')}</p>
              <ul className="text-site-muted mt-6 space-y-2 font-mono text-sm">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i}>
                    <span className="text-site-accent" aria-hidden="true">
                      ›{' '}
                    </span>
                    {t(`gh.point${i}`)}
                  </li>
                ))}
              </ul>
            </RevealOnScroll>
            <RevealOnScroll className="min-w-0 lg:order-1">
              <GithubShowcase />
            </RevealOnScroll>
          </div>
        </section>

        <section id="how-it-works" className="border-site-border/60 scroll-mt-20 border-t">
          <div className="site-container py-16 sm:py-20">
            <RevealOnScroll>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('how.title')}</h2>
              <p className="text-site-muted mt-2 max-w-2xl">{t('how.subtitle')}</p>
            </RevealOnScroll>
            <RevealOnScroll staggerChildren className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="border-site-border bg-site-surface/50 hover:border-site-accent-dim relative rounded-xl border p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="border-site-accent-dim text-site-accent bg-site-background flex size-9 items-center justify-center rounded-full border font-mono text-sm font-semibold">
                      {index + 1}
                    </span>
                    <StepIcon index={index} />
                  </div>
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="text-site-accent-dim absolute top-1/2 left-full z-10 ml-0.5 hidden -translate-y-1/2 sm:block"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="step-flow size-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </span>
                  ) : null}
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="text-site-muted mt-2 text-sm leading-relaxed">{step.body}</p>
                </div>
              ))}
            </RevealOnScroll>

            <RevealOnScroll className="mt-14">
              <h3 className="text-site-text text-lg font-semibold">
                {t('checks.dimensionsTitle')}
              </h3>
              <p className="text-site-muted mt-2 max-w-2xl text-sm">{t('checks.subtitle')}</p>
            </RevealOnScroll>
            <RevealOnScroll
              staggerChildren
              className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
            >
              {checkGroups.map((group) => (
                <article
                  key={group.key}
                  className="border-site-border bg-site-surface/50 hover:border-site-accent-dim rounded-xl border p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5"
                >
                  <h3 className="font-semibold">{t(`checks.${group.key}Title`)}</h3>
                  <p className="text-site-muted mt-2 text-sm leading-relaxed">
                    {t(`checks.${group.key}Body`)}
                  </p>
                </article>
              ))}
            </RevealOnScroll>
          </div>
        </section>

        <section id="why" className="border-site-border/60 scroll-mt-20 border-t">
          <div className="site-container max-w-3xl py-16 sm:py-20">
            <RevealOnScroll>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('why.title')}</h2>
            </RevealOnScroll>
            <RevealOnScroll className="text-site-muted mt-6 space-y-5 leading-relaxed">
              <p>{t('why.p1')}</p>
              <p>{t('why.p2')}</p>
              <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-3">
                {[
                  { value: 41, label: t('why.stat1Label') },
                  { value: 32, label: t('why.stat2Label') },
                  { value: 115, label: t('why.stat3Label') },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="border-site-border bg-site-surface/50 rounded-xl border px-4 py-4 text-center"
                  >
                    <StatCounter value={stat.value} prefix="+" suffix="%" label={stat.label} />
                  </div>
                ))}
              </div>
              <blockquote className="border-site-accent bg-site-surface/40 text-site-text relative rounded-r-xl border-l-2 py-4 pr-5 pl-8 text-lg leading-relaxed font-medium">
                <span
                  aria-hidden="true"
                  className="text-site-accent/30 absolute top-1 left-2 font-serif text-4xl leading-none select-none"
                >
                  “
                </span>
                {t('why.quote')}
                <cite className="text-site-faint mt-3 block text-sm font-normal not-italic">
                  — {t('why.quoteSource')}
                </cite>
              </blockquote>
              <p>{t('why.p3')}</p>
              <p className="text-site-faint text-sm">
                {t('why.sourcesLabel')}:{' '}
                <a
                  href="https://arxiv.org/abs/2311.09735"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-site-accent hover:underline"
                  aria-label={`${t('why.source1')} (opens in a new tab)`}
                >
                  {t('why.source1')}
                </a>
                {' · '}
                <a
                  href="https://platform.openai.com/docs/bots"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-site-accent hover:underline"
                  aria-label={`${t('why.source2')} (opens in a new tab)`}
                >
                  {t('why.source2')}
                </a>
                {' · '}
                <a
                  href="https://support.anthropic.com/en/articles/8896518"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-site-accent hover:underline"
                  aria-label={`${t('why.source3')} (opens in a new tab)`}
                >
                  {t('why.source3')}
                </a>
                {' · '}
                <a
                  href="https://developers.cloudflare.com/ai-crawl-control/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-site-accent hover:underline"
                  aria-label={`${t('why.source4')} (opens in a new tab)`}
                >
                  {t('why.source4')}
                </a>
              </p>
            </RevealOnScroll>
          </div>
        </section>

        <section id="pricing" className="border-site-border/60 scroll-mt-20 border-t">
          <div className="site-container py-16 sm:py-20">
            <RevealOnScroll>
              <PremiumTiers prices={prices} />
            </RevealOnScroll>
          </div>
        </section>

        <section id="faq" className="border-site-border/60 scroll-mt-20 border-t">
          <div className="site-container max-w-3xl py-16 sm:py-20">
            <RevealOnScroll>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('faq.title')}</h2>
            </RevealOnScroll>
            <RevealOnScroll staggerChildren className="mt-8 space-y-3">
              <h3 className="text-site-faint text-xs font-semibold tracking-wide uppercase">
                {t('faq.generalHeading')}
              </h3>
              {faqEntries.map((entry) => (
                <FaqItem key={entry.question} question={entry.question}>
                  <p>{entry.answer}</p>
                </FaqItem>
              ))}
              <h3 className="text-site-faint pt-6 text-xs font-semibold tracking-wide uppercase">
                {t('faq.dimensionsHeading')}
              </h3>
              {allCategoryFaqEntries.map((entry) => (
                <FaqItem key={entry.faqId} id={entry.faqId} question={entry.question}>
                  <p>
                    <strong className="text-site-text">{t('faq.purposeLabel')}:</strong>{' '}
                    {entry.purpose}
                  </p>
                  <p>
                    <strong className="text-site-text">{t('faq.methodLabel')}:</strong>{' '}
                    {entry.method}
                  </p>
                  <p>
                    <strong className="text-site-text">{t('faq.sourceLabel')}:</strong>{' '}
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-site-accent hover:underline"
                    >
                      {t('faq.categorySourceLink')}
                    </a>
                    {' · '}
                    <a
                      href={entry.scoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-site-accent hover:underline"
                    >
                      {t('faq.scoreSourceLink')}
                    </a>
                  </p>
                </FaqItem>
              ))}
            </RevealOnScroll>
          </div>
        </section>

        <section className="site-container flex flex-col items-center py-16 text-center sm:py-20">
          <RevealOnScroll className="flex w-full flex-col items-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('site.tagline')}</h2>
            <div className="mt-8 flex w-full justify-center">
              <ScanForm size="sm" />
            </div>
          </RevealOnScroll>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

// MARK: - Pieces

function StepIcon({ index }: { index: number }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'text-site-accent-dim size-6',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (index === 0) {
    return (
      <svg {...common}>
        <path d="M12 3v12" />
        <path className="step-anim-bob" d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle className="step-anim-pulse" cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M12 2.5 4 6v5c0 5 3.4 8.5 8 10.5 4.6-2 8-5.5 8-10.5V6l-8-3.5Z" />
      <path className="step-anim-pulse" d="m9 12 2 2 4-4" />
    </svg>
  )
}

function JsonLd({ faq }: { faq: { question: string; answer: string }[] }) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
        sameAs: [GITHUB_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#org` },
        datePublished: '2026-06-15',
        dateModified: new Date().toISOString(),
      },
      {
        '@type': 'SoftwareApplication',
        name: 'isready.ai — AI readiness scanner',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web, CLI',
        url: SITE_URL,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': `${SITE_URL}/#org` },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: { '@type': 'Answer', text: entry.answer },
        })),
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- static, server-built JSON
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
