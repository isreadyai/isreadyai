import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { allChecks } from '@isreadyai/scanner'
import { Button } from '@/components/ui/button'
import { GradeBands } from '@/components/grade-bands'
import { JsonLdScript } from '@/components/json-ld-script'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { dayjs } from '@/lib/dayjs'
import { textForScore } from '@/lib/grade'
import { organizationNode } from '@/lib/json-ld'
import { topGaps } from '@/lib/research'
import { CORPUS_MIN_SITES, loadCorpusStats } from '@/lib/scan-corpus'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('research')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/research' },
  }
}

const DATE_FORMAT = 'MMM D, YYYY'

/** Live corpus statistics from each site's latest on-demand scan, with methods and limits. */
export default async function ResearchPage() {
  const t = await getTranslations('research')
  const stats = await loadCorpusStats()
  const gaps = stats === null ? [] : topGaps(stats.checks, allChecks)

  return (
    <>
      {stats !== null ? (
        <JsonLdScript
          data={{
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: t('datasetName'),
            description: t('datasetDescription', { sites: stats.sites }),
            url: `${SITE_URL}/research`,
            creator: { '@id': organizationNode()['@id'] },
            temporalCoverage: `${stats.from}/${stats.to}`,
            isAccessibleForFree: true,
            variableMeasured: [t('variable1'), t('variable2'), t('variable3'), t('variable4')],
          }}
        />
      ) : null}
      <SiteHeader />
      <main className="site-container max-w-4xl pt-28 pb-12">
        <header>
          <p className="text-site-accent font-mono text-xs tracking-wide uppercase">
            {t('kicker')}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {stats !== null ? t('title', { sites: stats.sites }) : t('titleEmpty')}
          </h1>
          {stats !== null ? (
            <p className="text-site-muted mt-3 max-w-2xl leading-relaxed">
              {t('lead', {
                from: dayjs(stats.from).format(DATE_FORMAT),
                to: dayjs(stats.to).format(DATE_FORMAT),
              })}
            </p>
          ) : (
            <p className="text-site-muted mt-3 max-w-2xl leading-relaxed">{t('empty')}</p>
          )}
        </header>

        {stats !== null ? (
          <>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border-site-border bg-site-surface/50 rounded-xl border p-5">
                <p
                  className={`${textForScore(stats.medianScore)} font-mono text-4xl font-semibold`}
                >
                  {stats.medianScore}
                </p>
                <p className="text-site-muted mt-2 text-sm">{t('medianLabel')}</p>
              </div>
              <div className="border-site-border bg-site-surface/50 rounded-xl border p-5">
                <p className="text-site-text font-mono text-4xl font-semibold">
                  {Math.round((100 * (stats.sites - stats.grades.excellent)) / stats.sites)}%
                </p>
                <p className="text-site-muted mt-2 text-sm">{t('notExcellentLabel')}</p>
              </div>
              {stats.uaRefused.sites >= CORPUS_MIN_SITES ? (
                <div className="border-site-border bg-site-surface/50 rounded-xl border p-5">
                  <p className="text-site-text font-mono text-4xl font-semibold">
                    {Math.round((100 * stats.uaRefused.refused) / stats.uaRefused.sites)}%
                  </p>
                  <p className="text-site-muted mt-2 text-sm">{t('uaRefusedLabel')}</p>
                </div>
              ) : null}
            </div>

            <section className="mt-14">
              <GradeBands grades={stats.grades} sites={stats.sites} />
            </section>

            <section className="mt-14">
              <h2 className="text-site-text text-lg font-semibold">{t('gapsTitle')}</h2>
              <p className="text-site-muted mt-2 max-w-2xl text-sm">{t('gapsIntro')}</p>
              <div className="border-site-border mt-6 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <caption className="sr-only">{t('gapsCaption')}</caption>
                  <thead className="bg-site-surface/50 text-site-muted text-xs">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('colCheck')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('colSites')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('colFailed')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('colWarned')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((gap) => {
                      const percent = Math.round(100 * gap.share)
                      return (
                        <tr key={gap.id} className="border-site-border/60 border-t align-top">
                          <th scope="row" className="px-4 py-3 font-normal">
                            <span className="text-site-text block">{gap.title}</span>
                            <span className="text-site-faint block font-mono text-xs">
                              {gap.id}
                            </span>
                          </th>
                          <td className="w-56 px-4 py-3">
                            <span
                              aria-hidden="true"
                              className="bg-site-raised block h-2 w-full rounded-full"
                            >
                              <span
                                className="bg-site-muted block h-2 rounded-full"
                                style={{ width: `${percent}%` }}
                              />
                            </span>
                            <span className="text-site-text mt-2 block font-mono">{percent}%</span>
                            <span className="text-site-muted block text-xs">
                              {t('ofSites', { count: gap.fail + gap.warn, sites: gap.sites })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{gap.fail}</td>
                          <td className="px-4 py-3 text-right font-mono">{gap.warn}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <section className="mt-14">
          <h2 className="text-site-text text-lg font-semibold">{t('methodsTitle')}</h2>
          <ul className="text-site-muted mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i}>{t(`methods${i}`)}</li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-site-text text-lg font-semibold">{t('limitsTitle')}</h2>
          <ul className="text-site-muted mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {[1, 2, 3].map((i) => (
              <li key={i}>{t(`limits${i}`)}</li>
            ))}
          </ul>
        </section>

        <div className="mt-14">
          <Button href="/">{t('cta')}</Button>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
