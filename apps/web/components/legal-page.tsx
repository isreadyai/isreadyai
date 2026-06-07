import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export type LegalLink = { label: string; href: string }

// A paragraph is either plain text, or text with `{label}` tokens that are
// replaced by the matching anchor from `links`.
export type LegalParagraph = string | { text: string; links: LegalLink[] }

export type LegalSection = {
  heading: string
  paragraphs?: LegalParagraph[]
  bullets?: LegalParagraph[]
}

export type LegalContent = {
  title: string
  updated: string
  intro?: LegalParagraph[]
  sections: LegalSection[]
}

const LINK_CLASS = 'text-site-secondary hover:text-site-text underline underline-offset-2'

function renderParagraph(paragraph: LegalParagraph): ReactNode {
  if (typeof paragraph === 'string') {
    return paragraph
  }
  const byLabel = new Map(paragraph.links.map((link) => [link.label, link]))
  // Split on `{label}` tokens, keeping the captured label so we can swap in anchors.
  const parts = paragraph.text.split(/\{([^}]+)\}/g)
  return parts.map((part, i) => {
    const link = i % 2 === 1 ? byLabel.get(part) : undefined
    if (link === undefined) {
      return part
    }
    return (
      <a
        key={link.href}
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
      >
        {link.label}
      </a>
    )
  })
}

export function LegalPage({ title, updated, intro, sections }: LegalContent) {
  return (
    <>
      <SiteHeader />
      <main className="site-container max-w-3xl pt-26 pb-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-site-faint mt-3 text-sm">Last updated: {updated}</p>

        {intro?.map((paragraph, i) => (
          // eslint-disable-next-line react/no-array-index-key -- intro paragraphs have no stable id; static content, never reordered
          <p key={i} className="text-site-muted mt-4 leading-relaxed">
            {renderParagraph(paragraph)}
          </p>
        ))}

        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mt-8 text-xl font-semibold tracking-tight">{section.heading}</h2>
            {section.paragraphs?.map((paragraph, j) => (
              // eslint-disable-next-line react/no-array-index-key -- paragraphs have no stable id; static content, never reordered
              <p key={j} className="text-site-muted mt-3 leading-relaxed">
                {renderParagraph(paragraph)}
              </p>
            ))}
            {section.bullets && (
              <ul className="text-site-muted mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                {section.bullets.map((bullet, j) => (
                  // eslint-disable-next-line react/no-array-index-key -- bullets have no stable id; static content, never reordered
                  <li key={j}>{renderParagraph(bullet)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <SiteFooter bottomInset />
    </>
  )
}
