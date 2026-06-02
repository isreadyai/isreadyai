import type { TCategory, TSmartAgentCategory } from '@isreadyai/scanner'
import { ECategory, ESmartAgentCategory } from '@isreadyai/scanner'
import { GITHUB_URL } from '@/lib/site'

export interface ICheckCategoryDocumentation {
  faqId: string
  messageKey: 'crawler' | 'rendering' | 'structured' | 'trust' | 'geo'
  sourceUrl: string
}

export const CHECK_CATEGORY_DOCUMENTATION: Record<TCategory, ICheckCategoryDocumentation> = {
  [ECategory.CRAWLER_ACCESS]: {
    faqId: 'faq-crawler-access',
    messageKey: 'crawler',
    sourceUrl: `${GITHUB_URL}/tree/main/packages/scanner/src/checks/crawler`,
  },
  [ECategory.RENDERING]: {
    faqId: 'faq-rendering',
    messageKey: 'rendering',
    sourceUrl: `${GITHUB_URL}/tree/main/packages/scanner/src/checks/rendering`,
  },
  [ECategory.STRUCTURED_DATA]: {
    faqId: 'faq-structured-data',
    messageKey: 'structured',
    sourceUrl: `${GITHUB_URL}/tree/main/packages/scanner/src/checks/structured-data`,
  },
  [ECategory.TRUST]: {
    faqId: 'faq-trust-security',
    messageKey: 'trust',
    sourceUrl: `${GITHUB_URL}/tree/main/packages/scanner/src/checks/trust`,
  },
  [ECategory.GEO_CONTENT]: {
    faqId: 'faq-content-geo',
    messageKey: 'geo',
    sourceUrl: `${GITHUB_URL}/tree/main/packages/scanner/src/checks/geo`,
  },
}

export const CHECK_CATEGORY_ORDER = Object.values(ECategory)
export const SCORE_SOURCE_URL = `${GITHUB_URL}/blob/main/packages/scanner/src/score.ts`

export function checkCategoryFaqHref(category: TCategory): string {
  // Miss-safe: a persisted/CI report from another scanner version can carry a
  // category outside the current enum — fall back to the FAQ root rather than
  // throwing mid-render (which would take down the whole report).
  const doc = CHECK_CATEGORY_DOCUMENTATION[category]
  return doc === undefined ? '/#faq' : `/#${doc.faqId}`
}

// MARK: - Smart agent readability categories

export interface ISmartCategoryDocumentation {
  faqId: string
  messageKey:
    | 'smartVisible'
    | 'smartStructure'
    | 'smartContent'
    | 'smartControls'
    | 'smartNavigability'
    | 'smartBarriers'
}

const SMART_SOURCE_URL = `${GITHUB_URL}/blob/main/packages/scanner/src/smart-agent/analyze.ts`

export const SMART_CATEGORY_DOCUMENTATION: Record<
  TSmartAgentCategory,
  ISmartCategoryDocumentation
> = {
  [ESmartAgentCategory.VISIBLE_CONTENT]: {
    faqId: 'faq-smart-visible-content',
    messageKey: 'smartVisible',
  },
  [ESmartAgentCategory.UNDERSTANDABLE_STRUCTURE]: {
    faqId: 'faq-smart-understandable-structure',
    messageKey: 'smartStructure',
  },
  [ESmartAgentCategory.CONTENT_QUALITY]: {
    faqId: 'faq-smart-content-quality',
    messageKey: 'smartContent',
  },
  [ESmartAgentCategory.ACCESSIBLE_CONTROLS]: {
    faqId: 'faq-smart-accessible-controls',
    messageKey: 'smartControls',
  },
  [ESmartAgentCategory.NAVIGABILITY]: {
    faqId: 'faq-smart-navigability',
    messageKey: 'smartNavigability',
  },
  [ESmartAgentCategory.BARRIERS]: {
    faqId: 'faq-smart-barriers',
    messageKey: 'smartBarriers',
  },
}

export const SMART_CATEGORY_ORDER = Object.values(ESmartAgentCategory)
export const SMART_SCORE_SOURCE_URL = SMART_SOURCE_URL

export function smartCategoryFaqHref(category: TSmartAgentCategory): string {
  // Miss-safe (see checkCategoryFaqHref): tolerate an unknown cross-version category.
  const doc = SMART_CATEGORY_DOCUMENTATION[category]
  return doc === undefined ? '/#faq' : `/#${doc.faqId}`
}
