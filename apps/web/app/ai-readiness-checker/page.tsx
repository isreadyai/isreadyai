import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { CATEGORY_LABELS, PROBED_CRAWLERS, allChecks, type ICheck } from '@isreadyai/scanner'
import { GradeBands } from '@/components/grade-bands'
import { JsonLdScript } from '@/components/json-ld-script'
import { ScanForm } from '@/components/scan-form'
import { ScoreWeightTable } from '@/components/score-weight-table'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { CHECK_CATEGORY_DOCUMENTATION } from '@/lib/check-category-docs'
import { checkGroups } from '@/lib/checker-groups'
import { SITE_URL } from '@/lib/site'
import { loadCorpusStats } from '@/lib/scan-corpus'

export const revalidate = 3600

const PAGE_URL = `${SITE_URL}/ai-readiness-checker`
const LINK_CLASS = 'text-site-accent hover:underline'
const GET_ITEMS = [1, 2, 3, 4, 5, 6] as const

const ENGINES = [
  {
    key: 'chatgpt',
    sources: [{ key: 'source', url: 'https://developers.openai.com/api/docs/bots' }],
  },
  {
    key: 'claude',
    sources: [{ key: 'source', url: 'https://support.claude.com/en/articles/8896518' }],
  },
  {
    key: 'perplexity',
    sources: [{ key: 'source', url: 'https://docs.perplexity.ai/guides/bots' }],
  },
  {
    key: 'google',
    sources: [
      {
        key: 'sourceFeatures',
        url: 'https://developers.google.com/search/docs/appearance/ai-features',
      },
      {
        key: 'sourceCrawlers',
        url: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
      },
    ],
  },
] as const

const renderCode = (chunks: ReactNode) => <code className="text-site-text font-mono">{chunks}</code>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checker')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/ai-readiness-checker' },
  }
}

function CheckList({ checks }: { checks: readonly ICheck[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {checks.map((check) => (
        <li key={check.id} className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-site-text">{check.title}</span>
          <span className="text-site-faint font-mono text-xs">{check.id}</span>
        </li>
      ))}
    </ul>
  )
}

/** Landing page for the free checker: what it tests, how the score works and what the report returns. */
export default async function AiReadinessCheckerPage() {
  const t = await getTranslations('checker')
  const tFaq = await getTranslations('faq.categories')
  const stats = await loadCorpusStats()
  const { scored, informational } = checkGroups(allChecks)

  return (
    <>
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: t('title'),
          url: PAGE_URL,
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@id': `${SITE_URL}/#org` },
        }}
      />
      <SiteHeader />
      <main className="site-container max-w-4xl pt-28 pb-12">
        <header>
          <p className="text-site-accent font-mono text-xs tracking-wide uppercase">
            {t('kicker', { count: allChecks.length })}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
          <p className="text-site-muted mt-3 max-w-2xl leading-relaxed">{t('lead')}</p>
          <div className="mt-8">
            <ScanForm />
          </div>
          <p className="text-site-faint mt-4 text-sm">{t('note')}</p>
        </header>

        <section className="mt-14">
          <h2 className="text-site-text text-lg font-semibold">{t('testsTitle')}</h2>
          <div className="mt-6 space-y-8">
            {scored.map((group) => (
              <div key={group.category}>
                <h3 className="text-site-text font-semibold">{CATEGORY_LABELS[group.category]}</h3>
                <p className="text-site-muted mt-1 max-w-2xl text-sm leading-relaxed">
                  {tFaq(`${CHECK_CATEGORY_DOCUMENTATION[group.category].messageKey}.purpose`)}
                </p>
                <CheckList checks={group.checks} />
              </div>
            ))}
            <div>
              <h3 className="text-site-text font-semibold">{t('infoTitle')}</h3>
              <p className="text-site-muted mt-1 max-w-2xl text-sm leading-relaxed">
                {t('infoBody')}
              </p>
              <CheckList checks={informational} />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-site-text text-lg font-semibold">{t('scoreTitle')}</h2>
          <div className="mt-6 space-y-10">
            <ScoreWeightTable />
            <GradeBands grades={stats?.grades ?? null} sites={stats?.sites ?? null} />
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-site-text text-lg font-semibold">{t('getTitle')}</h2>
          <ul className="text-site-muted mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {GET_ITEMS.map((i) => (
              <li key={i}>{t(`get${i}`, { probed: PROBED_CRAWLERS.length })}</li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-site-text text-lg font-semibold">{t('enginesTitle')}</h2>
          <p className="text-site-muted mt-2 max-w-2xl text-sm">{t('enginesIntro')}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {ENGINES.map((engine) => (
              <article
                key={engine.key}
                className="border-site-border bg-site-surface/50 rounded-xl border p-5"
              >
                <h3 className="text-site-text font-semibold">{t(`${engine.key}.name`)}</h3>
                <p className="text-site-muted mt-2 text-sm leading-relaxed">
                  {t.rich(`${engine.key}.body`, { code: renderCode })}
                </p>
                {engine.key === 'google' ? (
                  <>
                    <blockquote className="border-site-border text-site-text mt-3 border-l-2 pl-3 text-sm">
                      {t('google.quote')}
                      <cite className="text-site-faint mt-1 block text-xs not-italic">
                        {t('google.quoteSource')}
                      </cite>
                    </blockquote>
                    <p className="text-site-muted mt-3 text-sm leading-relaxed">
                      {t.rich('google.note', { code: renderCode })}
                    </p>
                  </>
                ) : null}
                <ul className="mt-3 space-y-1 text-sm">
                  {engine.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK_CLASS}
                      >
                        {t(`${engine.key}.${source.key}`)}
                        <span className="sr-only"> {t('newTab')}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-14">
          <Button href="/">{t('cta')}</Button>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
