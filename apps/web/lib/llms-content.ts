import { CATEGORY_LABELS, CATEGORY_WEIGHTS, ECategory, type TCategory } from '@isreadyai/scanner'
import { GITHUB_URL, SITE_URL } from '@/lib/site'

// MARK: - /llms.txt and /llms-full.txt
//
// llmstxt.org: H1, blockquote, optional non-heading detail, then H2 file lists.
// H2 bodies are markdown links. "## Optional" is the section an agent may skip.

const SUMMARY = `> Free, open-source audit that checks whether a website or SaaS is readable,
> crawlable and optimized for LLMs and AI search engines (ChatGPT, Claude,
> Perplexity, Gemini). Enter a URL, get a scored 0-100 report with concrete
> fixes, or run \`npx isreadyai <url>\` in a terminal.`

const CHECKS = `- Crawler access: robots.txt rules for every major AI crawler (GPTBot,
  OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended),
  Cloudflare/anti-bot challenges, redirects, TTFB, noindex.
- Rendering: raw vs JS-rendered content comparison — most AI crawlers do not
  execute JavaScript.
- Structured data: JSON-LD, meta basics, Open Graph, author/E-E-A-T signals.
- Trust: HTTPS, TLS, HSTS, mixed content.
- Content (GEO): depth, heading structure, statistics and citations, per
  "GEO: Generative Engine Optimization" (Aggarwal et al., KDD 2024).
- llms.txt and Content Signals are reported and never scored.`

const PRODUCT = `## Product

- [Web scanner](${SITE_URL}): Enter a URL, get a scored 0-100 report with concrete fixes, or run \`npx isreadyai <url>\`.
- [Pricing](${SITE_URL}/pricing): Start free. Upgrade when you want monitoring, the Ask-your-site chat and automated fixes across your sites.
- [Research](${SITE_URL}/research): Live statistics from each site's latest scan, with methods and limits.
- [AI readiness checker](${SITE_URL}/ai-readiness-checker): What the free checker tests, how the score works and what the report contains.
- [About](${SITE_URL}/about): Who makes isready.ai, what it checks, how to run it, licensing and contact.
- [Contact](${SITE_URL}/contact): Feedback, a bug report, or a fraudulent domain claim.`

const MACHINE = `## Machine readable

- [llms-full.txt](${SITE_URL}/llms-full.txt): Longer plain-text briefing of the same pages.
- [robots.txt](${SITE_URL}/robots.txt): Crawler rules, including each AI user-agent the scanner tracks.
- [Sitemap](${SITE_URL}/sitemap.xml): Public pages.`

const OPTIONAL = `## Optional

- [Privacy](${SITE_URL}/privacy): Privacy Policy.
- [Terms](${SITE_URL}/terms-and-conditions): Terms and conditions.
- [Acknowledgements](${SITE_URL}/acknowledgements): Third-party notices.
- [Source code](${GITHUB_URL}): Scanner engine & CLI are open source (MIT); the hosted dashboard is source-available under PolyForm Shield, © Smart Squad S.r.l.`

/** Index file for /llms.txt, in llmstxt.org section order. */
export function llmsTxt(): string {
  return `# isready.ai

${SUMMARY}

${CHECKS}

${PRODUCT}

${MACHINE}

${OPTIONAL}
`
}

const SCORED: readonly TCategory[] = [
  ECategory.CRAWLER_ACCESS,
  ECategory.RENDERING,
  ECategory.STRUCTURED_DATA,
  ECategory.TRUST,
  ECategory.GEO_CONTENT,
]

/** Longer briefing for /llms-full.txt. Weights come from the scanner. */
export function llmsFullTxt(): string {
  const weights = SCORED.map(
    (category) =>
      `- ${CATEGORY_LABELS[category]}: ${Math.round(CATEGORY_WEIGHTS[category] * 100)}%`,
  ).join('\n')

  return `# isready.ai

${SUMMARY}

The 0-100 score is the weighted total of five dimensions:

${weights}

${CHECKS}

${PRODUCT}

${MACHINE}

${OPTIONAL}
`
}
