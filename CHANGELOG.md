# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

#### GitHub Action (`action.yml`)

- The audit action now **deep-crawls** the site (sitemap + internal-link crawl) instead of scanning a single page, and writes the full per-page report to the job summary.
- Added a `command` input that boots a branch environment in the background (run with `bash -c`), waits for `url` to respond, then scans that local URL — so a branch can be gated before it ships. Documented as trusted-input-only (never wire it from `pull_request_target` or fork-controlled data).
- Added an `api-key` input (plus `report` toggle and `api-url` override): when set, the run uploads an authenticated CI report to isready.ai and prints a **branch-stable repo badge** snippet. Pro/Team only.
- Added `badge` and `report-url` outputs alongside the existing `score` and `grade`.
- The action sends an anonymous, PII-free usage ping (host + score); opt out with `TELEMETRY=false`.

#### Web app (`apps/web`)

- **Canonical host normalization** (`normalizeHost`): hosts are stored and compared lowercased with a single leading `www.` stripped — `www.x.com` and `x.com` are one site, while subdomains stay distinct (`massimo.deluisa.bio` ≠ `deluisa.bio`). Applied to add-website and CI badge matching.
- **Monitoring cron de-duplicates by host**: a domain tracked by several workspaces is crawled (deep + Smart Agent) once per tick and the result fanned out to each website's scan row, instead of re-scanning the host per workspace.
- Website-detail scan history filters on the indexed `scans.host` column instead of parsing every scan URL in JS.
- Premium-upsell CTA placement is content-aware (top-right beside the title when the card is title-only, otherwise bottom-right); documented in `DESIGN.md`.

### Added

#### GitHub Action — fix PR (`fix-action/action.yml`)

- New action that scans a URL, runs an isready.ai AI agent **inside the runner** under a short-lived, metered, inference-scoped token (the real gateway key never leaves isready.ai; your source is never stored), applies AI-readiness fixes, and opens a pull request. Stages only the agent's reported changed files — never `git add -A`. Requires a Pro or Team API key.

#### Web app (`apps/web`)

- **My Websites scan inheritance**: adding a site claims your own past scans of that exact host (including anonymous, pre-signup ones); verifying ownership claims all still-unclaimed scans of the host (anonymous and others'), never touching scans already owned by another workspace.
- GA4 server-side conversions via the Measurement Protocol — `purchase` (from the Stripe webhook, with the `_ga` client/session carried through Stripe metadata) and `sign_up` (from the auth callback); both consent-aware.
- Cookie-consent banner (Consent Mode v2), footer Privacy / Terms / Sitemap links, and an expanded `sitemap.xml`.
- **Contact / feedback page** (`/contact`, footer-linked) plus a **fraudulent-domain-claim report** (deep-linked from the website verify banner with the host pre-filled): submissions create a ClickUp task, protected by Turnstile + per-IP/global rate-limiting.

#### Supabase package (`@isreadyai/supabase`)

- `scans.host` — a normalized, indexed generated column (`scans_host_idx`) used as the canonical key for host matching, scan inheritance and the website-detail history.

### Fixed

#### Scanner engine (`@isreadyai/scanner`)

- `crawler.anti-bot` no longer false-positives on ordinary page content or the legitimate Turnstile widget — it flags only a real Cloudflare challenge (challenge-only markers or the interstitial `<title>`).

#### Web app (`apps/web`)

- `profiles` billing columns (`plan`, Stripe fields) are writable only by the service role: a `BEFORE UPDATE` trigger blocks any end-user session from changing them, even if a permissive policy is ever added.
- GA env (`GA_MEASUREMENT_ID`, `GA_MP_API_SECRET`) is passed through Turbo so the server-side GA4 events fire in production.

## [0.1.0] - 2026-06-15

### Added

#### Scanner engine (`@isreadyai/scanner`)

- Core scan engine with weighted scoring across five categories: Crawler Access (25%), Structured Data (30%), GEO Content (15%), Rendering (20%), and Trust & Security (10%).
- Overall score (0–100) with four grades: excellent, good, moderate, poor. Score methodology versioned (`SCORE_VERSION`) for reproducible comparisons.
- **Crawler Access checks**: `robots.txt` presence, AI-bot allow/block rules (GPTBot, ClaudeBot, PerplexityBot, and 18 other named crawlers), anti-bot/WAF challenge detection, sitemap presence, redirect chain analysis, TTFB, HTTP status, `noindex`/`X-Robots-Tag`, `www` consistency, user-agent blocking, and snippet directives.
- **Rendering checks**: empty app-shell detection, main-content extraction, `<noscript>` fallback, Markdown content negotiation, and image `alt` text coverage.
- **Structured Data checks**: JSON-LD presence and validity, meta basics (title, description, canonical), Open Graph, author E-E-A-T signals, and `lang`/`hreflang`.
- **Trust & Security checks**: HTTPS, HSTS header, and mixed-content detection.
- **GEO Content checks** (Generative Engine Optimization): content depth, heading structure, statistics and citation signals, content noise ratio, freshness, and extractability.
- **Informational checks**: `llms.txt` detection (zero-weight; no major AI provider consumes it yet) and Content Signals summary.
- Single-page `scan()` and multi-page `scanSite()` entry points; site crawl follows sitemap indexes, direct sitemap links, and discovered hrefs with configurable page limits.
- `reportToMarkdown()` serialiser for LLM-paste-ready output.
- Smart Agent Readability audit (`runSmartAgentAudit`, `aggregateSmartReports`): drives a real browser via a pluggable `IAgentBrowserExecutor` to measure what browser-capable AI agents see beyond raw HTTP.
- Deterministic fix-plan generator (`generateFixPlan`) that emits whole-file patches for mechanical fixes (robots.txt allow-groups, `llms.txt` scaffold) and a structured Markdown plan for everything else. AI-generated fix plans are a planned future feature; v1 is entirely deterministic.
- Zod-validated `validateScanInput` boundary for all external URL input.
- Shared TypeScript types and test utilities exported from the package root.

#### CLI (`isreadyai`)

- `isreadyai <url>` command: scans a URL and prints a coloured, scored report to stdout with a `@clack/prompts` spinner on stderr so stdout stays pipeable.
- Output mode flags: `--json` (raw `IScanReport`), `--md` (human-readable Markdown), `--llm` (fix plan for pasting into Claude Code or Cursor), `--quiet`/`-q` (score line only).
- `--deep` flag: crawls the full site via sitemap and link discovery, runs page-level checks on each page; `--limit <n>` and `--skip <n>` control crawl bounds.
- `--smart-ai` flag: adds Smart Agent Readability using the local agent-browser executor without affecting the standard score or CI exit code.
- Exit codes: 0 when score >= 50, 1 when below threshold or scan failed, 2 on misuse.
- `--version` and `--help` flags.

#### Web app (`apps/web`)

- Public landing page with live scanner: paste any URL, get a scored report in the browser with no account required.
- Shareable report pages at `/report/[id]` with full check results, category breakdown, animated score ring, and per-finding evidence and fix hints.
- Deep Scan in the browser: crawl up to the environment-configured page limit with the engine running client-side and fetches relayed through a dumb proxy; free for all users.
- Smart Agent Readability block in reports: browser-agent view animated like the main report, with a separate versioned 0–100 score.
- "Ask your site" AI chat: conversational Q&A over a scan using streaming tool calls; rate-limited per API key (premium, Pro/Team).
- Fix-PR plan in reports: deterministic patch suggestions for mechanical issues (premium, Pro/Team); AI-generated fix plans are a coming-soon feature.
- Authenticated accounts: sign-up, login, and session management via Supabase Auth.
- User dashboard with scan history, domain management, and API key management.
- Stripe billing integration: Free, Pro, and Team plan tiers with quota enforcement; metered `/api/fix` endpoint keyed to plan.
- Embeddable README badge at `/badge/[domain](.svg)`: live score badge served via edge with CDN caching; signed-token-gated to Pro/Team API keys.
- Report by email (Resend): PDF and Markdown attachments, email-gated downloads.
- Check categories linked to anchored technical FAQs with audit methods and score-methodology source references.

#### GitHub Action (`action.yml`)

- Composite workflow action that installs the scanner, runs `isreadyai --json` against a target URL, writes a scored Markdown report to the job summary, and fails the step when the score drops below a configurable threshold (default 70). Outputs `score` and `grade`. The Action is included in this repository but not yet published to the GitHub Marketplace.

#### Supabase package (`@isreadyai/supabase`)

- Shared generated database types and typed Supabase client helpers used by the web app.

#### Monorepo infrastructure

- Turborepo pipeline with Bun as runtime and package manager.
- CI: lint (`oxlint`), format check (`oxfmt`), type-check, tests, and build.

[Unreleased]: https://github.com/isreadyai/isreadyai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/isreadyai/isreadyai/releases/tag/v0.1.0
