/**
 * Test fixtures for structured-data check assertions.
 *
 * Provides pre-built HTML snippets with varying levels of schema, OG, and meta completeness
 * for unit-testing check behavior across edge cases and rich/bare pages.
 *
 * @module checks/structured-data/fixtures
 * @export
 */

// MARK: - Fixtures

/**
 * A rich page: Organization + Article in an @graph, full OG, good meta.
 *
 * @type {string}
 */
export const RICH_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>How AI Crawlers Read Your Site — A Practical Guide</title>
  <meta name="description" content="A practical, hands-on guide to making your website readable by AI crawlers and LLM search engines, with concrete schema and meta examples." />
  <link rel="canonical" href="https://example.com/guide" />
  <meta property="og:title" content="How AI Crawlers Read Your Site" />
  <meta property="og:description" content="Make your site readable by AI crawlers." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/guide" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="alternate" hreflang="es" href="https://example.com/es/guide" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Example Inc",
        "logo": "https://example.com/logo.png",
        "sameAs": ["https://twitter.com/example", "https://github.com/example"]
      },
      {
        "@type": ["Article", "TechArticle"],
        "headline": "How AI Crawlers Read Your Site",
        "author": { "@type": "Person", "name": "Ada Lovelace" },
        "datePublished": "2026-01-15"
      }
    ]
  }
  </script>
</head>
<body><main><h1>How AI Crawlers Read Your Site</h1><p>Content here.</p></main></body>
</html>`

/** A bare page: no schema, no OG, no description, no canonical, no lang. */
export const BARE_HTML = `<!doctype html>
<html>
<head><title>Home</title></head>
<body><div id="app"></div></body>
</html>`

/** Article JSON-LD with a malformed sibling block (must be skipped silently). */
export const MALFORMED_LD_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Edge Case Page With A Reasonable Title</title>
  <script type="application/ld+json">{ this is not valid json }</script>
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "WebSite", "name": "Example" }
  </script>
</head>
<body><p>ok</p></body>
</html>`

/** Canonical pointing at a different host than the final URL. */
export const CROSS_HOST_CANONICAL_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>A Perfectly Fine Length Title Goes Here</title>
  <meta name="description" content="This description is comfortably within the fifty to one hundred sixty character window expected." />
  <link rel="canonical" href="https://other-site.com/page" />
</head>
<body><p>ok</p></body>
</html>`

/** Title far over the 70-char limit; description fine; canonical fine. */
export const LONG_TITLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>This Is An Extremely Long Title That Keeps Going Well Past Seventy Characters For Sure Indeed</title>
  <meta name="description" content="This description is comfortably within the fifty to one hundred sixty character window expected." />
  <link rel="canonical" href="https://example.com/page" />
</head>
<body><p>ok</p></body>
</html>`
