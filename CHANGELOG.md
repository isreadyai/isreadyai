# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Web app (`apps/web`)

- **DataFast revenue attribution for Stripe Checkout**: checkout sessions now pass DataFast visitor/session cookie metadata when available, and the analytics bootstrap uses cookie-backed IDs after consent so revenue can be attributed in DataFast.

## [1.0.6] - 2026-07-10

### Added

#### Web app (`apps/web`)

- **DataFast analytics bootstrap**: added the `datafast` NPM SDK as a guarded, consent-aware singleton that starts only on the production host, after idle time, and keeps initialization failures isolated from the site render path.

## [1.0.5] - 2026-07-09

### Added

#### Web app (`apps/web`)

- **Product Hunt launch badge on the landing page**: pinned bottom-right, fades out over the first ~320px of scroll so it clears the corner before the scroll-to-top button appears; hidden below `sm`.

## [1.0.4] - 2026-07-09

### Fixed

#### CLI (`apps/cli`)

- **CLI and web scores now use the same readiness headline**: the shared scanner scorer is used for the combined AI Search + Smart Agent score, `--quiet` / telemetry / exit status follow that headline when Smart Agent runs, and `--json` now includes a `readiness` summary without changing the raw report shape. The CLI version is read from `apps/cli/package.json` instead of a stale hardcoded constant.

#### Scanner engine (`@isreadyai/scanner`)

- **Readiness headline scoring is shared**: AI Search now resolves to the canonical single-page or deep site score in one package-level helper, and Smart Agent is averaged in only as a separate completed track.

#### Web app (`apps/web`)

- **Deep scan score no longer drifts from the CLI**: report pages, badges, and dashboard summary columns use the scanner's canonical `site.overall` for the AI Search deep track instead of recomputing a browser-only page average.

## [1.0.3] - 2026-07-09

### Fixed

#### Web app (`apps/web`)

- **Scan reports with binary evidence now persist cleanly**: report JSON is sanitized before every `jsonb` write (`/api/scan`, CI uploads, and monitoring cron), removing null bytes that Postgres rejects. This fixes web scans such as `www.producthunt.com`, whose gzipped sitemap preview made the CLI succeed but the UI fail at report persistence time.
- **Dashboard/report dates no longer cause hydration mismatches**: date rendering now uses `dayjs` with the viewer's browser timezone after mount while keeping a server/client-stable fallback for hydration. The visible format stays the previous numeric style (`DD/MM/YYYY` and `DD/MM/YYYY, HH:mm:ss`) instead of locale-dependent server/browser output.

## [1.0.2] - 2026-07-07

### Changed

- Added a workflow to sync the dedicated audit/fix action repositories from the monorepo, along with their CI, release, and packaging assets.
- Refreshed workspace package versions and Turbo configuration for the CLI, web, scanner, and Supabase packages.

## [0.2.1] - 2026-07-05

### Changed

#### Web app (`apps/web`)

- **Locked public badge wording is neutral**: the badge shown for any ineligible domain (invalid host, unverified, not upgraded, not activated) used to read "premium", implying that ineligibility always meant a plan gate. It now reads "locked", which is accurate regardless of the cause.

### Fixed

#### Web app (`apps/web`)

- **Public badge no longer sticks on "premium" after a site goes live** (`/badge/[domain]`): the locked badge was cached with a 24h `stale-while-revalidate`, so a domain that had just been verified, upgraded and badge-activated kept serving the stale locked "premium" badge for up to a day even though the origin already returned the real score. The locked (and not-yet-scored) badge now carries a short TTL and revalidation window, so the flip to the live score happens within ~a minute.
- **Badge lookup canonicalizes the host** (`verifiedDomainBadgeScore`): `websites.host` is stored lowercased with a leading `www.` stripped, but the badge lookup compared the raw request host — so `/badge/www.deluisa.bio` (or a mixed-case host) missed the row and wrongly fell through to the locked badge. The lookup now normalizes the host the same way it is stored.

### Documentation

- README `## Contributing` now includes the pre-PR check suite (`lint`, `format`, `test`, `type-check`, `build`) and a short summary of the scanner-check recipe, pointing to `CONTRIBUTING.md` for the full detail.

## [0.2.0] - 2026-07-02

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
- Diagnostic logging now runs through a shared app `logger` (emoji + timestamped; verbose in dev, errors-only in production) instead of scattered `console.error`; the unused scanner logger scaffolding was removed.

### Added

#### GitHub Action — fix PR (`fix-action/action.yml`)

- New action that scans a URL, runs an isready.ai AI agent **inside the runner** under a short-lived, metered, inference-scoped token (the real gateway key never leaves isready.ai; your source is never stored), applies AI-readiness fixes, and opens a pull request. Stages only the agent's reported changed files — never `git add -A`. Requires a Pro or Team API key.
- Writes a job summary explaining every outcome, including the silent 0-change case (lists the non-pass checks, so a green run with no PR reads as "already AI-ready").
- Emails the API-key owner when it opens a PR (`/api/fix-notify`, Resend; recipient resolved server-side, link pinned to `github.com`).

#### Web app (`apps/web`)

- **Campaign hero copy variants** (`?mkt=1`…`8`): paid/marketing landing URLs select an alternative hero headline + subtitle, rendered on the server so there is no copy flash; the canonical `/` always serves the default copy, so SEO and AI crawlers are unaffected.
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

### Security

#### Web app (`apps/web`)

- **Anonymous email-takeover closed (critical)**: email confirmations are now enforced (`enable_confirmations = true`), so the anonymous→permanent upgrade must verify the new email from its real inbox — the checkout signup shows a "confirm your email" step and proceeds to payment only after the link is followed. An anonymous session can no longer claim a victim's confirmed email and accept that email's workspace invitations; anonymous principals are also rejected from all four invite paths and from API-key creation. **The hosted Supabase project must mirror `enable_confirmations` in its dashboard.**
- **Open redirect closed**: the auth callback and login form route post-login through a shared `safeNext` guard, so a crafted `?next` / `?redirect` (external, protocol-relative `//evil.tld`, or backslash `/\evil.tld`) falls back to `/dashboard` instead of redirecting off-site.
- **Proxy relay hardened** (`/api/proxy`): the same-site check now matches the host exactly, so a look-alike `http://localhost.evil.tld` no longer passes; a deploy that keeps the placeholder `PROXY_TOKEN_SECRET` fails closed in production.
- **Turnstile fails closed in production**: a missing `TURNSTILE_SECRET_KEY` skips verification only in local/dev — in production the contact form rejects rather than silently accepting (network/5xx already fail closed). Added the variable to the root `.env.example`.
- **Trusted client IP for rate-limit keys**: the shared `clientIp` prefers the platform-set `x-real-ip` and the rightmost forwarded hop, so a spoofed `x-forwarded-for` can no longer evade per-IP limits or frame another IP; de-duplicated with the scan route's helper.
- **Security response headers**: added `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` to every response (a CSP with `frame-ancestors` follows).
- **CI repo-badge uploads now require GitHub OIDC**: `/api/ci-report` verifies an Actions OIDC token (issuer, audience, RS256, expiry via JWKS) and matches its immutable `repository_id` claim before registering a repo, so a premium key can no longer squat another repo's badge. The audit action mints the token automatically — **callers must grant the job `permissions: id-token: write`** (documented in the README).
- **API keys honour their lifetime**: `verifyApiKey` / `findApiKeyById` now reject an elapsed `expires_at` and stamp `last_used_at` (throttled, best-effort), rather than checking only revocation.
- **AI cost guards**: the solve-inference proxy rejects oversized `messages` payloads (413), and `/api/mcp` caps JSON-RPC batch size and applies a per-key rate limit, so a paid key can't drive unbounded inference or scanner load.
- **Anonymous report tampering closed**: persisting an in-browser deep scan onto an anonymous scan now requires a per-scan write-token (a stateless HMAC the creating tab holds), so a shared report link no longer lets any visitor overwrite the report.
- **Content-Security-Policy (report-only)**: added a `Content-Security-Policy-Report-Only` header to surface violations against GTM / Stripe / Turnstile / Supabase before tuning it to enforcing; clickjacking is already enforced by `X-Frame-Options`.
- **Smart Agent browser least-privilege**: the local agent-browser child receives only browser-relevant environment variables, no longer inheriting server secrets (Supabase / Stripe / gateway keys).
- **Premium entitlements revoked on payment failure**: `planFromStatus` now drops `unpaid` / `paused` / `incomplete` subscriptions to the free plan (only `past_due` keeps a short retry grace), and the monitoring cron re-checks the owner's current plan so a downgraded workspace stops running paid deep / Smart-Agent scans.
- **Constant-time cron auth**: the three `/api/cron/*` endpoints verify `CRON_SECRET` with `timingSafeEqual` (shared `isAuthorizedCron`) instead of a timing-leaky `!==`.
- **Report mutation is editor-gated**: PATCH of an owned scan now requires a workspace manager/owner role (matching DELETE) — viewers and billing members can no longer overwrite a report.
- **Body-size limits enforced on actual bytes**: `/api/scan/[id]` and `/smart-deep` cap the streamed request body (and decompressed size) rather than trusting `Content-Length`, closing a chunked-request memory-exhaustion vector.
- **AI cost guards tightened**: the solve-inference cap now covers the full forwarded body (including `tools`, not just `messages`), and `/api/mcp` charges the rate limit per batch item.
- **API-key quota enforced**: `createApiKey` rejects over the plan's `maxApiKeys`; anonymous principals are blocked from key creation and from accepting/listing workspace invitations.
- **Seat limit re-checked at invitation acceptance**: closes the race where a Stripe downgrade between invite and accept could exceed the seat entitlement.
- **Email-report spam-relay + DoS closed**: `/api/email-report` now requires Turnstile (widget added to the form), and both it and `/api/contact` consume the shared global rate-limit bucket only after a successful captcha, so unsolved requests can't exhaust it.
- **Chat-thread scope authorization**: an unauthorized `websiteId` is downgraded to report scope instead of being persisted, and AI fix-plan generation verifies the report's host belongs to the caller's workspace.
- **Self-hosted trusted-proxy gate**: `TRUST_PROXY_HEADERS=false` makes `clientIp` ignore spoofable forwarding headers for deployments without a trusted reverse proxy.
- **No anonymous relay token**: `/api/scan` no longer returns a `proxyToken` (it was unused — each report page issues its own scoped token server-side), so the deep-scan relay token can no longer be obtained anonymously.
- **CSP drops `unsafe-eval`**: removed the unused `unsafe-eval` from the (report-only) `script-src`, shrinking the surface a future XSS could abuse.

#### GitHub Action — fix PR (`fix-action`)

- **Pathspec-magic hardening**: the staging step uses `git --literal-pathspecs`, and the agent sandbox rejects writing a file whose path starts with `:`, so a prompt-injected agent can't widen the committed file set via git pathspec magic.
- **Wider secret redaction**: `redactSecrets` now also masks connection-string passwords (`scheme://user:pass@host`) and more credential keywords (CRED, SIGNING_KEY, OAUTH, DSN, …) before file content reaches the model.
- **Git hooks neutralized during commit/push**: the PR step runs `git` with `core.hooksPath=/dev/null` and `--no-verify`, so a poisoned repo's hooks can't execute with `GH_TOKEN` in the environment.

#### Scanner engine (`@isreadyai/scanner`)

- **ReDoS fixed in robots matching**: `pathMatches` uses a linear, non-backtracking glob matcher, so a crafted `robots.txt` path rule can no longer stall the scanner.

#### Supabase package (`@isreadyai/supabase`)

- **Rate-limit functions locked to the service role**: revoked `EXECUTE` on `consume_rate_limit` and `consume_metered_run` from `anon` / `authenticated` / `PUBLIC` — the app only ever calls them through the service role — closing an unauthenticated path to saturate a shared rate-limit bucket (e.g. `contact:global`) and deny every rate-limited endpoint. Added a pgTAP regression.
- **Workspace always keeps an owner**: a deferred constraint trigger (`workspace_owner_guard`) prevents removing, demoting or suspending the last active owner, closing the race where two concurrent removals could orphan a workspace. Added a pgTAP regression.
- **Tightened auth redirect allowlist**: dropped the shared `https://*.vercel.app/auth/callback` wildcard from the local `config.toml` (preview/production redirect URLs are configured in the Supabase dashboard).
- **`search_path` pinned on SECURITY DEFINER functions**: a migration sets `search_path = public` on every definer function (defense-in-depth against search-path hijacking).

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

[Unreleased]: https://github.com/isreadyai/isreadyai/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/isreadyai/isreadyai/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/isreadyai/isreadyai/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/isreadyai/isreadyai/compare/v0.2.1...v1.0.2
[0.2.1]: https://github.com/isreadyai/isreadyai/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/isreadyai/isreadyai/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/isreadyai/isreadyai/releases/tag/v0.1.0
