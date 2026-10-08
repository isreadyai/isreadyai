import { getTranslations } from 'next-intl/server'
import { CATEGORY_LABELS, CATEGORY_WEIGHTS, ECategory, type TCategory } from '@isreadyai/scanner'

// MARK: - Scored-dimension weights
//
// Real <table> of the five weights the scanner uses. The cards above this
// stay as they are. Honest signals (llms.txt) are not a scored row.

const ROWS: readonly TCategory[] = [
  ECategory.CRAWLER_ACCESS,
  ECategory.RENDERING,
  ECategory.STRUCTURED_DATA,
  ECategory.TRUST,
  ECategory.GEO_CONTENT,
]

/** Share labels for the five scored dimensions, in score order. */
export function scoreWeightShares(): { label: string; share: string }[] {
  return ROWS.map((category) => ({
    label: CATEGORY_LABELS[category],
    share: `${Math.round(CATEGORY_WEIGHTS[category] * 100)}%`,
  }))
}

/** Homepage table of how the 0-100 score is split. */
export async function ScoreWeightTable() {
  const t = await getTranslations('checks')
  const rows = scoreWeightShares()
  return (
    <div className="border-site-border overflow-hidden rounded-xl border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="text-site-muted px-4 py-3 text-left">{t('weightTableCaption')}</caption>
        <thead>
          <tr className="border-site-border bg-site-surface/50 border-t">
            <th scope="col" className="px-4 py-3 font-medium">
              {t('weightDimension')}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t('weightShare')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-site-border/60 border-t">
              <th scope="row" className="px-4 py-3 font-medium">
                {row.label}
              </th>
              <td className="text-site-muted px-4 py-3 text-right font-mono">{row.share}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
