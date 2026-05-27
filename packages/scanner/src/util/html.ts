/**
 * Dependency-free HTML extraction utilities.
 *
 * Regex-based and zero-dep so the engine stays portable across Node / Bun /
 * Deno / serverless. Swappable for a real parser (linkedom) behind these
 * signatures.
 */

import type { Json } from './json.ts'
import type { TJsonObject } from '../types.ts'

// MARK: - Dependency-free HTML extraction

/**
 * Parsed HTML meta tag with name, property, and content attributes.
 *
 * @export
 * @interface IMetaTag
 * @typedef {IMetaTag}
 */
export interface IMetaTag {
  name?: string
  property?: string
  content?: string
}

const TAG_RE = (tag: string) => new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')

/**
 * Strip scripts, styles, tags and collapse whitespace into readable text.
 *
 * @param {string} html - The HTML string to convert.
 * @returns {string} Plain text without markup or scripts.
 * @export
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Count whitespace-separated words in text.
 *
 * @param {string} text - The text to count words in.
 * @returns {number} The number of words in the text.
 * @export
 */
export function wordCount(text: string): number {
  if (text.length === 0) {
    return 0
  }
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Extract the page title from HTML.
 *
 * @param {string} html - The HTML string to parse.
 * @returns {string | null} The text content of the <title> tag, or null if not found.
 * @export
 */
export function extractTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match?.[1]?.trim() ?? null
}

/**
 * Extract the lang attribute from the <html> tag.
 *
 * @param {string} html - The HTML string to parse.
 * @returns {string | null} The language code, or null if not found.
 * @export
 */
export function extractHtmlLangAttr(html: string): string | null {
  const match = /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html)
  return match?.[1]?.trim() ?? null
}

/**
 * Extract all <meta> tags with their name, property, and content attributes.
 *
 * @param {string} html - The HTML string to parse.
 * @returns {IMetaTag[]} Array of parsed meta tags.
 * @export
 */
export function extractMetaTags(html: string): IMetaTag[] {
  const tags: IMetaTag[] = []
  const re = /<meta\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? ''
    tags.push({
      name: attr(attrs, 'name'),
      property: attr(attrs, 'property'),
      content: attr(attrs, 'content'),
    })
  }
  return tags
}

/**
 * Get meta tag content by name or property (case-insensitive).
 *
 * @param {IMetaTag[]} tags - Array of meta tags to search.
 * @param {string} key - The name or property to look for.
 * @returns {string | undefined} The content value, or undefined if not found.
 * @export
 */
export function metaContent(tags: IMetaTag[], key: string): string | undefined {
  const lowered = key.toLowerCase()
  const hit = tags.find(
    (t) => t.name?.toLowerCase() === lowered || t.property?.toLowerCase() === lowered,
  )
  return hit?.content
}

/**
 * Extract and parse JSON-LD blocks from HTML (invalid blocks are skipped).
 *
 * @param {string} html - The HTML string to parse.
 * @returns {Json[]} Array of parsed JSON-LD objects.
 * @export
 */
export function extractJsonLd(html: string): Json[] {
  const out: Json[] = []
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] ?? '').trim()
    if (raw.length === 0) {
      continue
    }
    try {
      out.push(JSON.parse(raw))
    } catch {
      // skip malformed blocks
    }
  }
  return out
}

/**
 * Flatten @graph arrays and collect every schema.org @type present.
 *
 * @param {Json[]} blocks - Array of JSON-LD blocks to search.
 * @returns {string[]} Array of unique @type values found.
 * @export
 */
export function jsonLdTypes(blocks: Json[]): string[] {
  const types = new Set<string>()
  const visit = (node: Json | undefined): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as TJsonObject
      const t = obj['@type']
      if (typeof t === 'string') {
        types.add(t)
      } else if (Array.isArray(t)) {
        t.forEach((x) => typeof x === 'string' && types.add(x))
      }
      if (Array.isArray(obj['@graph'])) {
        obj['@graph'].forEach(visit)
      }
    }
  }
  blocks.forEach(visit)
  return [...types]
}

/**
 * Count occurrences of a tag in HTML.
 *
 * @param {string} html - The HTML string to search.
 * @param {string} tag - The tag name to count (case-insensitive).
 * @returns {number} The number of tag occurrences.
 * @export
 */
export function countTag(html: string, tag: string): number {
  const matches = html.match(new RegExp(`<${tag}\\b`, 'gi'))
  return matches ? matches.length : 0
}

/**
 * Extract text contents of all occurrences of a tag (with markup stripped).
 *
 * @param {string} html - The HTML string to parse.
 * @param {string} tag - The tag name to extract.
 * @returns {string[]} Array of text contents from each tag.
 * @export
 */
export function tagTextContents(html: string, tag: string): string[] {
  const out: string[] = []
  const re = TAG_RE(tag)
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    out.push(htmlToText(m[1] ?? ''))
  }
  return out
}

/**
 * Extract the canonical link href from HTML.
 *
 * @param {string} html - The HTML string to parse.
 * @returns {string | null} The canonical URL, or null if not found.
 * @export
 */
export function extractCanonical(html: string): string | null {
  const re = /<link\b([^>]*\brel=["']canonical["'][^>]*)>/i
  const m = re.exec(html)
  if (!m) {
    return null
  }
  return attr(m[1] ?? '', 'href') ?? null
}

/**
 * Check if HTML contains any hreflang link tags.
 *
 * @param {string} html - The HTML string to search.
 * @returns {boolean} True if any hreflang link tag is found.
 * @export
 */
export function hasHreflang(html: string): boolean {
  return /<link\b[^>]*\bhreflang=["'][^"']+["'][^>]*>/i.test(html)
}

// MARK: - internal

function attr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i')
  const m = re.exec(attrs)
  return m?.[1]
}
