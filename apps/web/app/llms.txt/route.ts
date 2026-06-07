import { GITHUB_URL, SITE_URL } from '@/lib/site'

// MARK: - /llms.txt

const CONTENT = `# isready.ai

> Free, open-source audit that checks whether a website or SaaS is readable,
> crawlable and optimized for LLMs and AI search engines (ChatGPT, Claude,
> Perplexity, Gemini). Enter a URL, get a scored 0-100 report with concrete
> fixes, or run \`npx isreadyai <url>\` in a terminal.

## What it checks

- Crawler access: robots.txt rules for every major AI crawler (GPTBot,
  OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended),
  Cloudflare/anti-bot challenges, redirects, TTFB, noindex.
- Rendering: raw vs JS-rendered content comparison — most AI crawlers do not
  execute JavaScript.
- Structured data: JSON-LD, meta basics, Open Graph, author/E-E-A-T signals.
- Trust: HTTPS, TLS, HSTS, mixed content.
- Content (GEO): depth, heading structure, statistics and citations, per
  "GEO: Generative Engine Optimization" (Aggarwal et al., KDD 2024).

## Links

- [Web scanner](${SITE_URL})
- [Source code](${GITHUB_URL}) — scanner engine & CLI are open source (MIT); the hosted dashboard is source-available under PolyForm Shield, © Smart Squad S.r.l.
`

export function GET(): Response {
  return new Response(CONTENT, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
