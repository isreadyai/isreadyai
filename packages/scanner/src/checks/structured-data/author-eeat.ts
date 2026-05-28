/**
 * Author & E-E-A-T signals check — validates Experience/Expertise/Authoritativeness/Trust metadata.
 *
 * AI crawlers weigh E-E-A-T signals when attributing content. Articles want author + datePublished;
 * non-article pages accept entity-identity (Organization logo/sameAs). Checks both JSON-LD and meta tags.
 *
 * @module checks/structured-data/author-eeat
 * @export
 */

import type { Json } from '../../util/json.ts'
import { ECategory, ELevel, EStatus } from '../../types.ts'
import type { TJsonObject } from '../../types.ts'
import { extractJsonLd, extractMetaTags, metaContent } from '../../util/html.ts'
import { defineCheck, makeResult, type ICheckDef } from '../builder.ts'

// MARK: - Definitions

const def: ICheckDef = {
  id: 'structured.author-eeat',
  category: ECategory.STRUCTURED_DATA,
  weight: 2,
  title: 'Author & E-E-A-T signals',
}

const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle'])

// MARK: - Check

/**
 * Evaluates author and E-E-A-T signals in article and organization schema.
 *
 * @param {import('../builder.ts').ICheckContext} ctx - The check context containing raw HTML.
 * @returns {import('../builder.ts').ICheckResult} - A PASS if article has author+date or org has logo/sameAs; WARN if partial; implied INFO otherwise.
 * @export
 */
export const authorEeatCheck = defineCheck(def, (ctx) => {
  const blocks = extractJsonLd(ctx.raw.body)
  const nodes = flatten(blocks)
  const metaAuthor = hasMetaAuthor(ctx.raw.body)

  const articleNodes = nodes.filter((n) => nodeHasType(n, ARTICLE_TYPES))

  if (articleNodes.length > 0) {
    const hasAuthor = articleNodes.some(hasAuthorName) || metaAuthor
    const hasDate = articleNodes.some((n) => hasNonEmpty(n, 'datePublished'))
    const evidence = { mode: 'article', hasAuthor, hasDate, metaAuthor }

    if (hasAuthor && hasDate) {
      return makeResult(def, EStatus.PASS, 'article declares author and publish date', {
        evidence,
      })
    }

    // meta author can lift a missing JSON-LD author.
    if (hasAuthor || hasDate) {
      return makeResult(
        def,
        EStatus.WARN,
        hasAuthor ? 'article is missing datePublished' : 'article is missing an author',
        {
          score: 0.5,
          fix: 'add both author (with name) and datePublished to the article JSON-LD for E-E-A-T attribution.',
          impact: ELevel.MEDIUM,
          effort: ELevel.LOW,
          evidence,
        },
      )
    }

    return makeResult(def, EStatus.FAIL, 'article has no author or publish date', {
      fix: 'add author (with name) and datePublished to the article JSON-LD so AI crawlers can attribute the content.',
      impact: ELevel.MEDIUM,
      effort: ELevel.LOW,
      evidence,
    })
  }

  const orgWithIdentity = nodes.some(
    (n) =>
      nodeHasType(n, new Set(['Organization'])) &&
      (hasNonEmpty(n, 'logo') || hasNonEmpty(n, 'sameAs')),
  )
  const evidence = { mode: 'entity', orgWithIdentity, metaAuthor }

  if (orgWithIdentity) {
    return makeResult(def, EStatus.PASS, 'Organization declares logo / sameAs identity', {
      evidence,
    })
  }

  return makeResult(def, EStatus.WARN, 'no entity-identity signals (E-E-A-T)', {
    score: 0.5,
    fix: 'add an Organization with logo and sameAs links (or author markup) to establish E-E-A-T.',
    impact: ELevel.LOW,
    effort: ELevel.LOW,
    evidence,
  })
})

// MARK: - Helpers

/**
 * Walks blocks/@graph/arrays into a flat list of plain objects.
 *
 * @param {Json[]} blocks - The JSON-LD blocks to flatten.
 * @returns {TJsonObject[]} - A flat list of all objects found in blocks and their @graph arrays.
 */
function flatten(blocks: Json[]): TJsonObject[] {
  const out: TJsonObject[] = []
  const visit = (node: Json | undefined): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as TJsonObject
      out.push(obj)
      if (Array.isArray(obj['@graph'])) {
        obj['@graph'].forEach(visit)
      }
    }
  }
  blocks.forEach(visit)
  return out
}

/**
 * Checks if a node matches any of the given types.
 *
 * @param {TJsonObject} node - The JSON object to check.
 * @param {Set<string>} types - The set of type strings to match against.
 * @returns {boolean} - True if the node's @type matches any type in the set.
 */
function nodeHasType(node: TJsonObject, types: Set<string>): boolean {
  const t = node['@type']
  if (typeof t === 'string') {
    return types.has(t)
  }
  if (Array.isArray(t)) {
    return t.some((x) => typeof x === 'string' && types.has(x))
  }
  return false
}

/**
 * Checks if a node has a non-empty value for the given key.
 *
 * @param {TJsonObject} node - The JSON object to check.
 * @param {string} key - The property key to check.
 * @returns {boolean} - True if the key exists and is a non-empty string, or is a truthy non-null/undefined value.
 */
function hasNonEmpty(node: TJsonObject, key: string): boolean {
  const value = node[key]
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return value !== undefined && value !== null
}

/**
 * Checks if a node has a valid author name.
 *
 * @param {TJsonObject} node - The JSON object to check.
 * @returns {boolean} - True if the node's author field contains a non-empty name string.
 */
function hasAuthorName(node: TJsonObject): boolean {
  return authorHasName(node['author'])
}

/**
 * Extracts author name from various author formats (string, object, or array).
 *
 * @param {Json | undefined} author - The author value (can be string, object with name, or array).
 * @returns {boolean} - True if any author variant has a non-empty name.
 */
function authorHasName(author: Json | undefined): boolean {
  if (typeof author === 'string') {
    return author.trim().length > 0
  }
  if (Array.isArray(author)) {
    return author.some(authorHasName)
  }
  if (author && typeof author === 'object') {
    const name = (author as TJsonObject)['name']
    return typeof name === 'string' && name.trim().length > 0
  }
  return false
}

/**
 * Checks if the HTML contains a non-empty meta author tag.
 *
 * @param {string} html - The HTML string to check.
 * @returns {boolean} - True if a meta author tag with non-empty content is present.
 */
function hasMetaAuthor(html: string): boolean {
  const value = metaContent(extractMetaTags(html), 'author')
  return value !== undefined && value.trim().length > 0
}
