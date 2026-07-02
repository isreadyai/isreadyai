import { getTranslations } from 'next-intl/server'
import { allChecks } from '@isreadyai/scanner'
import { Reveal } from '@/components/motion/reveal'
import { FlipBoardText } from '@/components/motion/flip-board-text'
import { TorchText } from '@/components/motion/torch-text'

const HEADLINE_CLASS =
  'mx-auto max-w-5xl text-[2.5rem] leading-[1.08] font-bold tracking-tight text-balance sm:text-6xl'
const SUBTITLE_CLASS =
  'text-site-text/90 mx-auto mt-6 max-w-2xl text-base font-medium text-pretty sm:text-xl'

/**
 * Hero headline + subtitle, server-rendered so the `?mkt` variant lands in the
 * first HTML (no flash, no LCP re-raster). The canonical "/" gets `mkt === 0`,
 * the default copy, so SEO is unaffected.
 */
export async function HeroCopy({ mkt }: { mkt: number }) {
  const t = await getTranslations()

  if (mkt === 0) {
    return (
      <>
        <Reveal delay={0.08}>
          <h1 className={HEADLINE_CLASS}>
            <span className="block">{t('hero.future')}</span>
            <span className="mt-2 block">
              <span className="sm:whitespace-nowrap">
                {t('hero.questionPrefix')}{' '}
                <FlipBoardText
                  terms={[
                    t('hero.subjectWebsite'),
                    t('hero.subjectWebApp'),
                    t('hero.subjectDocsSite'),
                    t('hero.subjectLandingPage'),
                    t('hero.subjectPortfolio'),
                  ]}
                />
              </span>{' '}
              <TorchText>{t('hero.titleAccent')}</TorchText>
              {t('hero.title2')}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className={SUBTITLE_CLASS}>{t('hero.subtitle')}</p>
        </Reveal>
      </>
    )
  }

  const lead = t(`heroVariants.${mkt}.lead`)
  const accent = t(`heroVariants.${mkt}.accent`)
  const subtitle = t(`heroVariants.${mkt}.subtitle`, { count: allChecks.length })

  return (
    <>
      <Reveal delay={0.08}>
        <h1 className={HEADLINE_CLASS}>
          {lead} <TorchText>{accent}</TorchText>
        </h1>
      </Reveal>
      <Reveal delay={0.16}>
        <p className={SUBTITLE_CLASS}>{subtitle}</p>
      </Reveal>
    </>
  )
}
