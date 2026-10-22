import type { ICrawlerAccessRow } from '@isreadyai/scanner'
import { useTranslations } from 'next-intl'
import { GRADE_TEXT } from '@/lib/grade'
import { crawlerRowView, purposeLabelKey } from '@/lib/crawler-access-view'

export function CrawlerAccessTable({ rows }: { rows: readonly ICrawlerAccessRow[] }) {
  const t = useTranslations('report')
  const silentCount = rows.filter((row) => row.silentBlock).length

  return (
    <section aria-labelledby="crawler-access-title" data-anim="panel" className="mt-10">
      <h2 id="crawler-access-title" className="text-lg font-semibold">
        {t('crawlers.title')}
      </h2>
      <p className="text-site-muted mt-1 text-sm">{t('crawlers.intro')}</p>
      {silentCount > 0 ? (
        <p className="mt-3 text-sm">
          <span aria-hidden="true" className={`${GRADE_TEXT.moderate} mr-1.5`}>
            ▲
          </span>
          <span className={GRADE_TEXT.moderate}>
            {t('crawlers.silentSummary', { count: silentCount })}
          </span>
        </p>
      ) : null}
      <div className="border-site-border mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">{t('crawlers.caption')}</caption>
          <thead className="bg-site-surface/50 text-site-muted text-xs">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('crawlers.colCrawler')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('crawlers.colPurpose')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('crawlers.colRobots')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('crawlers.colServer')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const view = crawlerRowView(row)
              return (
                <tr key={row.token} className="border-site-border/60 border-t">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <span className="font-mono">{row.token}</span>
                    <span className="text-site-faint block text-xs">{row.operator}</span>
                  </th>
                  <td className="px-4 py-3">{t(purposeLabelKey(row.purpose))}</td>
                  <td className="px-4 py-3">
                    <span className={view.robots.tone}>
                      <span aria-hidden="true" className="mr-1.5">
                        {view.robots.glyph}
                      </span>
                      {t(view.robots.labelKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={view.server.tone}>
                      <span aria-hidden="true" className="mr-1.5">
                        {view.server.glyph}
                      </span>
                      {t(view.server.labelKey)}
                    </span>
                    {view.server.status !== undefined ? (
                      <span className="text-site-muted ml-2 font-mono">{view.server.status}</span>
                    ) : null}
                    {row.silentBlock ? (
                      <span className={`${GRADE_TEXT.moderate} mt-1 block text-xs`}>
                        <span aria-hidden="true" className="mr-1.5">
                          ▲
                        </span>
                        {t('crawlers.silentBlock')}
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
