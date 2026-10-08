import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AI_CRAWLERS, PROBED_CRAWLERS, allChecks } from '@isreadyai/scanner'
import { JsonLdScript } from '@/components/json-ld-script'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { organizationNode } from '@/lib/json-ld'
import { GITHUB_URL, SITE_URL } from '@/lib/site'

const COMPANY_URL = 'https://smartsquad.io'
const NPM_URL = 'https://www.npmjs.com/package/isreadyai'
const SECURITY_EMAIL = 'dev@smartsquad.io'
const LINK_CLASS = 'text-site-accent hover:underline'

const renderHomeLink = (chunks: ReactNode) => (
  <Link href="/" className={LINK_CLASS}>
    {chunks}
  </Link>
)

const renderContactLink = (chunks: ReactNode) => (
  <Link href="/contact" className={LINK_CLASS}>
    {chunks}
  </Link>
)

const renderMailLink = (chunks: ReactNode) => (
  <a href={`mailto:${SECURITY_EMAIL}`} className={LINK_CLASS}>
    {chunks}
  </a>
)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about')
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: '/about' },
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-site-border/60 grid gap-1 border-t py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
      <dt className="text-site-text text-sm font-medium">{label}</dt>
      <dd className="text-site-muted text-sm leading-relaxed">{children}</dd>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="text-site-text font-mono">{children}</code>
}

/** First-party facts about isready.ai: company, licensing, product counts, how to run it and contact. */
export default async function AboutPage() {
  const t = await getTranslations('about')

  const external = (href: string, chunks: ReactNode) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {chunks}
      <span className="sr-only"> {t('newTab')}</span>
    </a>
  )

  return (
    <>
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'AboutPage',
              url: `${SITE_URL}/about`,
              name: t('title'),
              mainEntity: { '@id': organizationNode()['@id'] },
            },
            {
              ...organizationNode(),
              legalName: 'Smart Squad S.r.l.',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Via Villalta 38',
                postalCode: '33100',
                addressLocality: 'Udine',
                addressRegion: 'UD',
                addressCountry: 'IT',
              },
            },
          ],
        }}
      />
      <SiteHeader />
      <main className="site-container max-w-3xl pt-28 pb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="text-site-muted mt-3 max-w-2xl leading-relaxed">{t('lead')}</p>

        <section className="mt-12">
          <h2 className="text-site-text text-lg font-semibold">{t('basicsTitle')}</h2>
          <dl className="mt-4">
            <Row label={t('whatLabel')}>{t('whatValue')}</Row>
            <Row label={t('madeByLabel')}>
              {external(COMPANY_URL, 'Smart Squad S.r.l.')}
              <span className="block">{t('madeByAddress')}</span>
            </Row>
            <Row label={t('sinceLabel')}>{t('sinceValue')}</Row>
            <Row label={t('licenseLabel')}>
              {t.rich('licenseValue', {
                license: (chunks) => external(`${GITHUB_URL}/blob/main/LICENSE`, chunks),
              })}
            </Row>
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-site-text text-lg font-semibold">{t('checksTitle')}</h2>
          <dl className="mt-4">
            <Row label={t('checksLabel')}>{t('checksValue', { count: allChecks.length })}</Row>
            <Row label={t('crawlersLabel')}>
              {t('crawlersValue', { count: AI_CRAWLERS.length })}
            </Row>
            <Row label={t('probesLabel')}>
              {t('probesValue', { count: PROBED_CRAWLERS.length })}
            </Row>
            <Row label={t('smartLabel')}>{t('smartValue')}</Row>
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-site-text text-lg font-semibold">{t('runTitle')}</h2>
          <dl className="mt-4">
            <Row label={t('webLabel')}>
              {t.rich('webValue', {
                home: renderHomeLink,
              })}
            </Row>
            <Row label={t('cliLabel')}>
              <Code>npx isreadyai &lt;url&gt;</Code> {external(NPM_URL, t('cliNpm'))}
            </Row>
            <Row label={t('actionsLabel')}>
              <Code>isreadyai/audit-action@v1</Code>, <Code>isreadyai/fix-action@v1</Code>
            </Row>
            <Row label={t('mcpLabel')}>
              <Code>{`${SITE_URL}/api/mcp`}</Code> {t('mcpValue')}
            </Row>
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-site-text text-lg font-semibold">{t('contactTitle')}</h2>
          <dl className="mt-4">
            <Row label={t('contactPageLabel')}>
              {t.rich('contactPageValue', {
                contact: renderContactLink,
              })}
            </Row>
            <Row label={t('securityLabel')}>
              {t.rich('securityValue', {
                advisory: (chunks) => external(`${GITHUB_URL}/security/advisories/new`, chunks),
                mail: renderMailLink,
              })}
            </Row>
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-site-text text-lg font-semibold">{t('moreTitle')}</h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/research" className={LINK_CLASS}>
                {t('moreResearch')}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className={LINK_CLASS}>
                {t('morePricing')}
              </Link>
            </li>
            <li>
              <a href={`${SITE_URL}/llms.txt`} className={LINK_CLASS}>
                {t('moreLlms')}
              </a>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
