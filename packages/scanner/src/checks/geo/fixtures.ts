// MARK: - GEO test fixtures

/**
 * Shared HTML bodies for GEO check tests: one content-rich page (~1000 words,
 * statistics, quotations, external citations, proper headings, semantic main)
 * and one thin page.
 */

const FILLER = Array.from({ length: 30 }, (_, i) => `sentence number ${i} about topic`).join(' ')

/**
 * Content-rich test fixture (~1000 words with statistics, citations, proper headings, semantic main).
 *
 * @export
 */
export const RICH_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>Deep guide</title></head>
<body>
  <header><nav>Home About Contact</nav></header>
  <main>
    <h1>The complete guide</h1>
    <p>Adoption grew 45% in 2024 and reached 12 million users. ${FILLER}</p>
    <h2>Background</h2>
    <p>Revenue hit 3.5 billion last year, up 30 percent. ${FILLER}</p>
    <blockquote>This is a substantial direct quotation that clearly exceeds forty characters in length.</blockquote>
    <h2>Methods</h2>
    <p>See the <a href="https://external-source.org/study">independent study</a> for details. ${FILLER}</p>
    <h2>Findings</h2>
    <p>Another reference is the <a href="https://other-site.com/data">data set</a>. ${FILLER}</p>
    <h3>Subsection</h3>
    <p>${FILLER}</p>
  </main>
  <footer>Copyright 2024</footer>
</body></html>`

/**
 * Thin test fixture (minimal content, under 30 words).
 *
 * @export
 */
export const THIN_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>Thin</title></head>
<body><p>Just a few short words here on this page.</p></body></html>`
