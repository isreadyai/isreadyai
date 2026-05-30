import type { TUrl } from './types.ts'

/**
 * Crawler detection and control: identifies AI/search crawlers from robots.txt
 * user-agent tokens and categorizes their visibility impact (training, search, user).
 */

// MARK: - AI crawler registry

/**
 * User-agent tokens for crawlers that matter for AI visibility, sourced from
 * official provider docs. `purpose` distinguishes the three independently
 * controllable kinds:
 *   - training: ingests content into model training corpora
 *   - search:   indexes content for the operator's AI answer/search surface
 *   - user:     fetches a URL live when a user asks the assistant to read it
 *
 * @typedef {ECrawlerPurpose}
 * @export
 */
export const ECrawlerPurpose = {
  TRAINING: 'training',
  SEARCH: 'search',
  USER: 'user',
} as const

/**
 * Crawler purpose union type: the visibility surface a crawler targets.
 *
 * @export
 * @typedef {TCrawlerPurpose}
 */
export type TCrawlerPurpose = (typeof ECrawlerPurpose)[keyof typeof ECrawlerPurpose]

/**
 * One AI crawler entry: metadata for detecting and describing a crawler's impact.
 *
 * @export
 * @interface IAiCrawler
 * @typedef {IAiCrawler}
 */
export interface IAiCrawler {
  /** robots.txt user-agent token (case-insensitive match). */
  token: string
  /** Organization operating the crawler. */
  operator: string
  /** The purpose/surface this crawler targets (training, search, user). */
  purpose: TCrawlerPurpose
  /** Blocking this crawler removes you from this surface. */
  surface: string
  /** Documentation URL describing the crawler. */
  docsUrl: TUrl
}

/**
 * Verdict for one AI crawler: whether it's blocked and its visibility impact.
 *
 * @export
 * @typedef {TAiCrawlerVerdict}
 */
export type TAiCrawlerVerdict = Pick<IAiCrawler, 'token' | 'operator' | 'purpose' | 'surface'> & {
  blocked: boolean
}

/**
 * Comprehensive registry of AI and search crawlers with official tokens and visibility surfaces.
 *
 * @export
 */
export const AI_CRAWLERS: readonly IAiCrawler[] = [
  // OpenAI
  {
    token: 'GPTBot',
    operator: 'OpenAI',
    purpose: 'training',
    surface: 'OpenAI model training',
    docsUrl: 'https://platform.openai.com/docs/bots',
  },
  {
    token: 'OAI-SearchBot',
    operator: 'OpenAI',
    purpose: 'search',
    surface: 'ChatGPT Search',
    docsUrl: 'https://platform.openai.com/docs/bots',
  },
  {
    token: 'ChatGPT-User',
    operator: 'OpenAI',
    purpose: 'user',
    surface: 'ChatGPT live browsing',
    docsUrl: 'https://platform.openai.com/docs/bots',
  },
  // Anthropic
  {
    token: 'ClaudeBot',
    operator: 'Anthropic',
    purpose: 'training',
    surface: 'Claude model training',
    docsUrl: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    token: 'Claude-SearchBot',
    operator: 'Anthropic',
    purpose: 'search',
    surface: 'Claude search',
    docsUrl: 'https://support.anthropic.com/en/articles/8896518',
  },
  {
    token: 'Claude-User',
    operator: 'Anthropic',
    purpose: 'user',
    surface: 'Claude live fetch',
    docsUrl: 'https://support.anthropic.com/en/articles/8896518',
  },
  // Google
  {
    token: 'Google-Extended',
    operator: 'Google',
    purpose: 'training',
    surface: 'Gemini / Vertex AI training',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
  },
  {
    token: 'Googlebot',
    operator: 'Google',
    purpose: 'search',
    surface: 'Google Search & AI Overviews',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/googlebot',
  },
  // Perplexity
  {
    token: 'PerplexityBot',
    operator: 'Perplexity',
    purpose: 'search',
    surface: 'Perplexity answers',
    docsUrl: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    token: 'Perplexity-User',
    operator: 'Perplexity',
    purpose: 'user',
    surface: 'Perplexity live fetch',
    docsUrl: 'https://docs.perplexity.ai/guides/bots',
  },
  // Apple
  {
    token: 'Applebot',
    operator: 'Apple',
    purpose: 'search',
    surface: 'Apple search / Siri',
    docsUrl: 'https://support.apple.com/en-us/119829',
  },
  {
    token: 'Applebot-Extended',
    operator: 'Apple',
    purpose: 'training',
    surface: 'Apple AI training',
    docsUrl: 'https://support.apple.com/en-us/119829',
  },
  // Amazon
  {
    token: 'Amazonbot',
    operator: 'Amazon',
    purpose: 'search',
    surface: 'Alexa / Rufus',
    docsUrl: 'https://developer.amazon.com/amazonbot',
  },
  // Meta
  {
    token: 'Meta-ExternalAgent',
    operator: 'Meta',
    purpose: 'training',
    surface: 'Meta AI training',
    docsUrl: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers',
  },
  // ByteDance
  {
    token: 'Bytespider',
    operator: 'ByteDance',
    purpose: 'training',
    surface: 'ByteDance / TikTok AI',
    docsUrl: 'https://support.bytespider.com',
  },
  // Common Crawl — feeds many models
  {
    token: 'CCBot',
    operator: 'Common Crawl',
    purpose: 'training',
    surface: 'Common Crawl corpus',
    docsUrl: 'https://commoncrawl.org/ccbot',
  },
  // Microsoft — Bingbot's index feeds both Bing and Copilot answers
  {
    token: 'Bingbot',
    operator: 'Microsoft',
    purpose: 'search',
    surface: 'Bing Search & Microsoft Copilot',
    docsUrl: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
  },
  // Mistral
  {
    token: 'MistralAI-User',
    operator: 'Mistral',
    purpose: 'user',
    surface: 'Le Chat live fetch',
    docsUrl: 'https://docs.mistral.ai/robots',
  },
  // DuckDuckGo
  {
    token: 'DuckAssistBot',
    operator: 'DuckDuckGo',
    purpose: 'search',
    surface: 'DuckAssist AI answers',
    docsUrl: 'https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot/',
  },
  // Meta — user-prompted fetcher, separate from the training agent
  {
    token: 'Meta-ExternalFetcher',
    operator: 'Meta',
    purpose: 'user',
    surface: 'Meta AI live fetch',
    docsUrl: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers',
  },
  // Cohere — no vendor docs; tracked via the community ai.robots.txt registry
  {
    token: 'cohere-training-data-crawler',
    operator: 'Cohere',
    purpose: 'training',
    surface: 'Cohere model training',
    docsUrl: 'https://github.com/ai-robots-txt/ai.robots.txt',
  },
] as const

// xAI/Grok absent: no official crawler tokens, retrieval reportedly uses spoofed browser UAs.

/**
 * High-priority crawlers whose blocking has the greatest impact on AI answer visibility.
 *
 * @export
 */
export const PRIORITY_TOKENS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'Bingbot',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
] as const
