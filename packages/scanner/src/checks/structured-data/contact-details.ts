/**
 * Contact details check — verifies that a way to reach the organization is machine-readable.
 *
 * Assistants answer "how do I contact X" from a page's JSON-LD (`contactPoint`, `email`,
 * `telephone`, `address`), `mailto:` / `tel:` links or an `<address>` element. A bare link
 * to a contact page only tells them where to look next.
 *
 * @module checks/structured-data/contact-details
 * @export
 */

import { ECategory, ECheckScope, ELevel, EStatus } from '../../types.ts'
import { countTag, extractAnchors, extractJsonLd } from '../../util/html.ts'
import type { Json } from '../../util/json.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'structured.contact-details',
  category: ECategory.STRUCTURED_DATA,
  weight: 1,
  title: 'Contact details are machine-readable',
  scope: ECheckScope.SITE,
}

const CONTACT_KEYS = ['contactPoint', 'email', 'telephone', 'address'] as const
const CONTACT_PATH_RE = /\/contact(?:[-/._]|$)/i
const CONTACT_TEXT_RE = /^contact(\s+us)?$/i

const FIX =
  'Add a visible email, phone number or postal address (a mailto: or tel: link, or an <address> element) and mirror it in Organization JSON-LD as contactPoint, email or telephone, so assistants can answer how to reach you.'

// MARK: - Check

/**
 * Looks for machine-readable contact details in JSON-LD, mailto/tel links and `<address>`.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - PASS when details are exposed; WARN when only a contact-page link or nothing exists. Never FAIL.
 * @export
 */
export const contactDetailsCheck = defineCheck(def, (ctx) => {
  const html = ctx.raw.body
  const anchors = extractAnchors(html)

  const jsonLdKeys = collectContactKeys(extractJsonLd(html))
  const mailto = anchors.some((a) => /^mailto:/i.test(a.href))
  const tel = anchors.some((a) => /^tel:/i.test(a.href))
  const addressElement = countTag(html, 'address') > 0
  const contactLink = anchors.some(
    (a) => CONTACT_PATH_RE.test(pathOf(a.href)) || CONTACT_TEXT_RE.test(a.text),
  )
  const evidence = { jsonLdKeys, mailto, tel, addressElement, contactLink }

  const exposed = [
    ...jsonLdKeys.map((key) => `JSON-LD ${key}`),
    ...(mailto ? ['mailto link'] : []),
    ...(tel ? ['tel link'] : []),
    ...(addressElement ? ['<address> element'] : []),
  ]

  if (exposed.length > 0) {
    return makeResult(def, EStatus.PASS, `contact details are exposed (${exposed.join(', ')})`, {
      score: 1,
      evidence,
    })
  }

  if (contactLink) {
    return makeResult(
      def,
      EStatus.WARN,
      'only a link to a contact page; no email, phone or address is machine-readable on this page',
      { score: 0.5, fix: FIX, impact: ELevel.LOW, effort: ELevel.LOW, evidence },
    )
  }

  return makeResult(def, EStatus.WARN, 'no contact details or contact page link found', {
    score: 0,
    fix: FIX,
    impact: ELevel.MEDIUM,
    effort: ELevel.LOW,
    evidence,
  })
})

// MARK: - internal

function collectContactKeys(blocks: Json[]): string[] {
  const found = new Set<string>()
  const visit = (node: Json | undefined): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if ((CONTACT_KEYS as readonly string[]).includes(key)) {
          found.add(key)
        }
        visit(value)
      }
    }
  }
  blocks.forEach(visit)
  return [...found]
}

function pathOf(href: string): string {
  try {
    return new URL(href, 'https://placeholder.invalid/').pathname
  } catch {
    return href
  }
}
