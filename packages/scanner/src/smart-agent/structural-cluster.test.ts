import { describe, expect, test } from 'bun:test'
import {
  clusterByStructure,
  minhashSimilarity,
  structuralFingerprint,
} from './structural-cluster.ts'

// MARK: - HTML fixtures

// Blog article layout: header > nav > main > article > h1/p
const BLOG_HTML = `
<html><head><title>My Blog</title></head><body>
<header><nav><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav></header>
<main><article><h1>Post Title</h1><p>First paragraph of the post.</p><p>Second paragraph.</p></article></main>
<footer><p>Copyright 2024</p></footer>
</body></html>
`.trim()

// Same blog layout, completely different text and links
const BLOG_HTML_B = `
<html><head><title>Another Post</title></head><body>
<header><nav><ul><li><a href="/">Index</a></li><li><a href="/contact">Contact</a></li></ul></nav></header>
<main><article><h1>A Different Heading</h1><p>Entirely different body text.</p><p>Yet more text.</p></article></main>
<footer><p>All rights reserved</p></footer>
</body></html>
`.trim()

// Pricing / feature-table layout: structurally distinct from blog
const PRICING_HTML = `
<html><head><title>Pricing</title></head><body>
<header><nav><ul><li><a href="/">Home</a></li></ul></nav></header>
<main>
  <section class="hero"><h2>Choose your plan</h2></section>
  <section class="plans">
    <table>
      <thead><tr><th>Free</th><th>Pro</th><th>Team</th></tr></thead>
      <tbody>
        <tr><td>$0</td><td>$9</td><td>$29</td></tr>
        <tr><td>5 pages</td><td>100 pages</td><td>Unlimited</td></tr>
      </tbody>
    </table>
  </section>
</main>
<footer><p>Terms of service</p></footer>
</body></html>
`.trim()

// Second pricing-layout page (different text, same DOM skeleton)
const PRICING_HTML_B = `
<html><head><title>Plans</title></head><body>
<header><nav><ul><li><a href="/">Home</a></li></ul></nav></header>
<main>
  <section class="hero"><h2>Pick a tier</h2></section>
  <section class="plans">
    <table>
      <thead><tr><th>Starter</th><th>Growth</th><th>Enterprise</th></tr></thead>
      <tbody>
        <tr><td>$0</td><td>$19</td><td>Contact us</td></tr>
        <tr><td>1 user</td><td>5 users</td><td>Unlimited</td></tr>
      </tbody>
    </table>
  </section>
</main>
<footer><p>Privacy policy</p></footer>
</body></html>
`.trim()

// MARK: - minhashSimilarity

describe('minhashSimilarity', () => {
  test('identical signatures → 1.0', () => {
    const sig = Array.from({ length: 64 }, (_, i) => i * 37 + 1)
    expect(minhashSimilarity(sig, [...sig])).toBe(1)
  })

  test('disjoint signatures → 0', () => {
    const a = Array.from({ length: 64 }, (_, i) => i)
    const b = Array.from({ length: 64 }, (_, i) => i + 1000)
    expect(minhashSimilarity(a, b)).toBe(0)
  })

  test('empty arrays → 0', () => {
    expect(minhashSimilarity([], [])).toBe(0)
  })

  test('partial overlap → proportional fraction', () => {
    const a = [1, 2, 3, 4]
    const b = [1, 2, 5, 6]
    expect(minhashSimilarity(a, b)).toBe(0.5) // 2 of 4 positions match
  })
})

// MARK: - structuralFingerprint

describe('structuralFingerprint', () => {
  test('same skeleton with different text/links → similarity ≥ 0.95', () => {
    const fpA = structuralFingerprint(BLOG_HTML)
    const fpB = structuralFingerprint(BLOG_HTML_B)
    expect(minhashSimilarity(fpA, fpB)).toBeGreaterThanOrEqual(0.95)
  })

  test('same pricing skeleton with different text → similarity ≥ 0.95', () => {
    const fpA = structuralFingerprint(PRICING_HTML)
    const fpB = structuralFingerprint(PRICING_HTML_B)
    expect(minhashSimilarity(fpA, fpB)).toBeGreaterThanOrEqual(0.95)
  })

  test('blog layout vs pricing layout → similarity well below cluster threshold', () => {
    const fpBlog = structuralFingerprint(BLOG_HTML)
    const fpPricing = structuralFingerprint(PRICING_HTML)
    // With MAX_DEPTH=5, Jaccard ≈ 0.625 (shared header/footer paths vs distinct main content).
    // MinHash estimate is deterministic with FNV-1a; well below the 0.75 default threshold.
    expect(minhashSimilarity(fpBlog, fpPricing)).toBeLessThan(0.75)
  })

  test('returns a signature of length 64', () => {
    expect(structuralFingerprint(BLOG_HTML)).toHaveLength(64)
  })

  test('handles empty string without throwing', () => {
    expect(() => structuralFingerprint('')).not.toThrow()
    expect(structuralFingerprint('')).toHaveLength(64)
  })

  test('handles malformed HTML without throwing', () => {
    expect(() => structuralFingerprint('<div><p>no closing tags')).not.toThrow()
  })

  test('<script> and <style> content is excluded from the skeleton', () => {
    const clean = '<html><body><main><article><h1>Hi</h1></article></main></body></html>'
    const withNoise = `<html><body>
      <script>document.querySelector('main').style.display = 'none'</script>
      <style>main > article > h1 { color: red; }</style>
      <main><article><h1>Hi</h1></article></main>
    </body></html>`
    // Script/style blocks must not contribute tag-paths
    expect(
      minhashSimilarity(structuralFingerprint(clean), structuralFingerprint(withNoise)),
    ).toBeGreaterThanOrEqual(0.95)
  })
})

// MARK: - same-template content variation

describe('same-template pages with minor DOM variation → single cluster', () => {
  test('one blog post with author-bio div still clusters with a plain post', () => {
    // postA: minimal article layout
    const postA = `<html><body><main><article><h1>Post A</h1><p>Content A</p></article></main></body></html>`
    // postB: same layout plus an extra nested <div class="bio"> — minor DOM variation
    const postB = `<html><body><main><article><h1>Post B</h1><p>Content B</p><div class="bio"><p>Author</p></div></article></main></body></html>`
    // With MAX_DEPTH=5, the div>p path (depth 6) is cut — postA and postB share 6/7 paths
    // Jaccard ≈ 0.857 >> 0.75 threshold → one cluster
    const clusters = clusterByStructure([
      { id: 'a', fingerprint: structuralFingerprint(postA) },
      { id: 'b', fingerprint: structuralFingerprint(postB) },
    ])
    expect(clusters.size).toBe(1)
  })

  test('three pages — same layout, different text, one extra element → one cluster', () => {
    const base = `<html><body><header><nav><ul><li><a>x</a></li></ul></nav></header><main><article><h1>T</h1><p>P</p></article></main></body></html>`
    const variant = `<html><body><header><nav><ul><li><a>y</a></li></ul></nav></header><main><article><h1>V</h1><p>Q</p><aside><p>Side</p></aside></article></main></body></html>`
    // aside and article>p share depth ≤5 paths; aside>p is depth 6 → cut by MAX_DEPTH=5
    const clusters = clusterByStructure([
      { id: 'a', fingerprint: structuralFingerprint(base) },
      { id: 'b', fingerprint: structuralFingerprint(base) }, // identical copy
      { id: 'c', fingerprint: structuralFingerprint(variant) },
    ])
    expect(clusters.size).toBe(1)
  })
})

// MARK: - clusterByStructure — the /toast vs /crost intent

describe('clusterByStructure — /toast vs /crost intent', () => {
  test('pages with different DOM structures → different clusters regardless of URL similarity', () => {
    const toast = { id: '/toast', fingerprint: structuralFingerprint(BLOG_HTML) }
    const crost = { id: '/crost', fingerprint: structuralFingerprint(PRICING_HTML) }
    const clusters = clusterByStructure([toast, crost])
    expect(clusters.size).toBe(2)
    for (const members of clusters.values()) {
      expect(members).toHaveLength(1)
    }
  })

  test('pages with the SAME DOM structure → single cluster', () => {
    const pageA = { id: '/blog/post-1', fingerprint: structuralFingerprint(BLOG_HTML) }
    const pageB = { id: '/blog/post-2', fingerprint: structuralFingerprint(BLOG_HTML_B) }
    const clusters = clusterByStructure([pageA, pageB])
    expect(clusters.size).toBe(1)
    const [members] = [...clusters.values()]
    expect(members).toContain('/blog/post-1')
    expect(members).toContain('/blog/post-2')
  })
})

// MARK: - clusterByStructure — realistic mix

describe('clusterByStructure — realistic mix', () => {
  test('3 article-shaped + 2 pricing-shaped → exactly 2 clusters with correct members', () => {
    const pages = [
      { id: 'article-1', fingerprint: structuralFingerprint(BLOG_HTML) },
      { id: 'article-2', fingerprint: structuralFingerprint(BLOG_HTML_B) },
      { id: 'pricing-1', fingerprint: structuralFingerprint(PRICING_HTML) },
      { id: 'article-3', fingerprint: structuralFingerprint(BLOG_HTML) },
      { id: 'pricing-2', fingerprint: structuralFingerprint(PRICING_HTML_B) },
    ]
    const clusters = clusterByStructure(pages)
    expect(clusters.size).toBe(2)

    const allMembers = [...clusters.values()].flat()
    expect(allMembers).toHaveLength(5)

    let articleCluster: string[] | undefined
    let pricingCluster: string[] | undefined
    for (const members of clusters.values()) {
      if (members.includes('article-1')) articleCluster = members
      if (members.includes('pricing-1')) pricingCluster = members
    }

    expect(articleCluster).toBeDefined()
    expect(pricingCluster).toBeDefined()
    expect(articleCluster).toContain('article-2')
    expect(articleCluster).toContain('article-3')
    expect(pricingCluster).toContain('pricing-2')
    expect(articleCluster).not.toContain('pricing-1')
    expect(pricingCluster).not.toContain('article-1')
  })

  test('threshold 1.0 — structurally identical pages cluster; structurally identical HTML = identical fingerprint', () => {
    const fpExact = structuralFingerprint(BLOG_HTML)
    const pages = [
      { id: 'a', fingerprint: fpExact },
      { id: 'b', fingerprint: [...fpExact] }, // copy — identical values
      { id: 'c', fingerprint: structuralFingerprint(BLOG_HTML_B) }, // same structure → same fingerprint
    ]
    // BLOG_HTML and BLOG_HTML_B share the exact same tag structure
    // → identical path sets → identical MinHash → similarity = 1.0
    const clusters = clusterByStructure(pages, 1.0)
    expect(clusters.size).toBe(1)
    expect([...clusters.values()][0]).toHaveLength(3)
  })

  test('empty pages list → empty map', () => {
    expect(clusterByStructure([])).toEqual(new Map())
  })

  test('single page → one cluster containing that page', () => {
    const fp = structuralFingerprint(BLOG_HTML)
    const clusters = clusterByStructure([{ id: 'only', fingerprint: fp }])
    expect(clusters.size).toBe(1)
    expect([...clusters.values()][0]).toEqual(['only'])
  })

  test('cluster ids are non-negative integers incremented per new cluster', () => {
    const pages = [
      { id: 'a', fingerprint: structuralFingerprint(BLOG_HTML) },
      { id: 'b', fingerprint: structuralFingerprint(PRICING_HTML) },
    ]
    const clusters = clusterByStructure(pages)
    const ids = [...clusters.keys()].toSorted((x, y) => x - y)
    expect(ids).toEqual([0, 1])
  })
})
