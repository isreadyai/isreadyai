/**
 * DOM-structure fingerprinting and MinHash clustering.
 *
 * Two pages with the same layout — regardless of URL or text — cluster
 * together. URL-shaped siblings (e.g. /toast vs /crost) that differ
 * structurally do NOT cluster, making this the structural counterpart to
 * the URL-template sampler in template-sample.ts.
 *
 * Pipeline: raw HTML → tag-path set → MinHash signature → cluster comparison
 */

// MARK: - Constants

const K = 64 // MinHash signature length
const MAX_DEPTH = 5 // layout backbone depth — keeps shallow structural paths, cuts content noise
const FNV_OFFSET = 2166136261 // FNV-1a 32-bit offset basis
const FNV_PRIME = 16777619 // FNV-1a 32-bit prime

// Void elements per HTML spec — never push onto the path stack.
const VOID_ELEMENTS = new Set([
  'br',
  'img',
  'input',
  'hr',
  'meta',
  'link',
  'source',
  'area',
  'base',
  'col',
  'embed',
  'param',
  'track',
  'wbr',
])

// MARK: - Internal utilities

/**
 * FNV-1a 32-bit hash seeded by `seed` — fast, dependency-free, client-safe.
 * Seed is mixed into the initial state so each of the K hash functions
 * produces an independent permutation of path space.
 */
function fnv1aSeeded(seed: number, str: string): number {
  let h = (FNV_OFFSET ^ seed) >>> 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), FNV_PRIME) >>> 0
  }
  return h
}

/**
 * Extracts the set of distinct root-to-element tag-paths from raw HTML
 * without a DOM library. Works in both Node/Bun and the browser.
 *
 * Approach:
 *  1. Strip <script>, <style>, and HTML comments (noise / no structure).
 *  2. Tokenize tags with a regex — opening, closing, self-closing, void.
 *  3. Maintain a stack of open tag names; each opening tag's path is
 *     the current stack joined by '>'.
 *  4. Cap at MAX_DEPTH segments to limit deep-tree noise.
 *  5. Never throw — a bad parse yields fewer paths, not an error.
 */
function extractTagPaths(html: string): Set<string> {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Group 1: '/' for closing tags
  // Group 2: tag name
  // Group 3: remainder inside the tag (detects self-closing '/')
  const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g

  const stack: string[] = []
  const paths = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = TAG_RE.exec(stripped)) !== null) {
    const [, closing = '', rawTag = '', rest = ''] = match
    const isClosing = closing === '/'
    const tag = rawTag.toLowerCase()
    const isSelfClosing = rest.trimEnd().endsWith('/')

    if (isClosing) {
      // Pop stack back to (and including) the matching open tag.
      // Handles implicitly-open tags (malformed HTML) gracefully.
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === tag) {
          stack.splice(i)
          break
        }
      }
    } else if (isSelfClosing || VOID_ELEMENTS.has(tag)) {
      // Leaf element: record its path but do NOT push (no children).
      if (stack.length < MAX_DEPTH) {
        paths.add([...stack, tag].join('>'))
      }
    } else {
      // Structural opening tag: push, then record the new path.
      if (stack.length < MAX_DEPTH) {
        stack.push(tag)
        paths.add(stack.join('>'))
      }
      // Beyond MAX_DEPTH: silently skip — keeps signatures stable.
    }
  }

  return paths
}

// MARK: - Public API

/**
 * Computes a MinHash signature (K=64) over the DOM tag-path skeleton.
 *
 * Two pages with structurally identical layouts produce near-identical signatures;
 * structurally different pages do not. Stable across text, attributes, and URLs.
 *
 * @param {string} html - Raw HTML to fingerprint.
 * @returns {number[]} - MinHash signature (64-element array).
 * @export
 */
export function structuralFingerprint(html: string): number[] {
  const paths = extractTagPaths(html)
  const sig: number[] = []

  for (let i = 0; i < K; i++) {
    let min = 0xffffffff
    for (const path of paths) {
      const h = fnv1aSeeded(i, path)
      if (h < min) min = h
    }
    sig.push(min)
  }

  return sig
}

/**
 * Estimates the Jaccard similarity of two tag-path sets via their MinHash signatures.
 *
 * @param {number[]} a - First MinHash signature.
 * @param {number[]} b - Second MinHash signature.
 * @returns {number} - Similarity score in [0, 1]: 1.0 = structurally identical, ~0 = disjoint.
 * @export
 */
export function minhashSimilarity(a: number[], b: number[]): number {
  const k = Math.min(a.length, b.length)
  if (k === 0) return 0
  let matches = 0
  for (let i = 0; i < k; i++) {
    if (a[i] === b[i]) matches++
  }
  return matches / k
}

/**
 * Groups pages into structural clusters using incremental nearest-neighbor assignment.
 *
 * Each cluster is represented by its first member's fingerprint. For each incoming page,
 * we compute similarity to every cluster rep; if the best score meets the threshold
 * the page joins that cluster, otherwise it opens a new one.
 *
 * Complexity: O(n × C) where C = number of distinct structural templates (typically < 20).
 *
 * @param {Array<{id: string; fingerprint: number[]}>} pages - Pages to cluster, each with id and pre-computed fingerprint.
 * @param {number} [threshold=0.75] - Minimum similarity to join an existing cluster.
 * @returns {Map<number, string[]>} - Map from cluster id → member page ids.
 * @export
 */
export function clusterByStructure(
  pages: { id: string; fingerprint: number[] }[],
  threshold = 0.75,
): Map<number, string[]> {
  interface Cluster {
    id: number
    rep: number[]
    members: string[]
  }

  const clusters: Cluster[] = []
  let nextId = 0

  for (const page of pages) {
    let bestSim = -1
    let bestCluster: Cluster | undefined

    for (const cluster of clusters) {
      const sim = minhashSimilarity(page.fingerprint, cluster.rep)
      if (sim >= threshold && sim > bestSim) {
        bestSim = sim
        bestCluster = cluster
      }
    }

    if (bestCluster !== undefined) {
      bestCluster.members.push(page.id)
    } else {
      clusters.push({ id: nextId++, rep: page.fingerprint, members: [page.id] })
    }
  }

  const result = new Map<number, string[]>()
  for (const cluster of clusters) {
    result.set(cluster.id, cluster.members)
  }
  return result
}
