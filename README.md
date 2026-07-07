<a id="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://isready.ai">
    <img src="apps/web/app/icon.svg" alt="isready.ai logo" width="120">
  </a>

<h3 align="center">isready.ai</h3>

  <p align="center">
    Is your website <strong>ready for AI</strong>? A free audit — powered by an open-source (MIT) engine and CLI — that checks whether a site or SaaS is readable, crawlable and optimized for ChatGPT, Claude, Perplexity, Gemini and every AI search engine.
    <br />
    <br />
    <a href="https://isready.ai">Website</a>
    &middot;
    <a href="#usage">CLI</a>
    &middot;
    <a href="https://github.com/isreadyai/isreadyai/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/isreadyai/isreadyai/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#why">Why</a></li>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#repository-layout">Repository Layout</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#the-score">The Score</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#acknowledgements">Acknowledgements</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

**isready.ai** answers one question with evidence instead of folklore: _can AI systems actually read your website?_

Enter a URL (or run `npx isreadyai <url>`) and get a 0–100 score across five dimensions, where every finding ships with concrete evidence, a fix, and its impact/effort — grounded in how AI crawlers really behave:

- Most AI crawlers — GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot — **do not execute JavaScript**. A client-side-rendered app is an empty page to them. We analyze the raw HTML exactly as they parse it.
- Every provider runs **separate crawlers** for training, search indexing and live user fetches, each independently controllable in `robots.txt`. We evaluate all of them, per purpose.
- **Cloudflare anti-bot challenges** silently remove sites from AI answers. We detect challenge signatures (`cf-mitigated`, Turnstile, vendor 403 patterns) from the outside.
- Content signals follow **peer-reviewed GEO research** (Aggarwal et al., KDD 2024): statistics, quotations and citations measurably raise visibility in generative answers.
- `llms.txt` is reported **honestly as informational** — no major AI provider consumes it today, so it never moves your score.

The optional **Smart Agent Readability** audit adds a separate 0–100 score for
browser-capable agents. It uses
[agent-browser](https://agent-browser.dev), an open-source Vercel Labs project,
to render the page and inspect the accessibility tree, named controls and
navigation. The standard crawler score remains unchanged.

### Why

AI assistants are becoming a primary discovery channel, and the rules differ from classic SEO in ways that are invisible until you measure them. One header can hide you from ChatGPT while Google still ranks you. This project makes those failures visible, explainable and fixable — and the scanner is fully open source.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

[![Turborepo][Turborepo]][Turborepo-url] [![Bun][Bun]][Bun-url] [![TypeScript][TypeScript]][TypeScript-url] [![Next.js][Next.js]][Next-url] [![React][React]][React-url] [![HeroUI][HeroUI]][HeroUI-url] [![Tailwind CSS][Tailwind]][Tailwind-url] [![Supabase][Supabase]][Supabase-url] [![Vercel][Vercel]][Vercel-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Repository Layout

| Workspace  | Path                | Purpose                                                                                                        | Stack                              |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `scanner`  | `packages/scanner`  | Agent Readability engine: scoring, native HTTP fetch, and Smart Agent Readability from agent-browser snapshots | TypeScript                         |
| `cli`      | `apps/cli`          | `npx isreadyai <url>` — terminal audit, with optional `--smart-ai` browser mode                                | Bun + TypeScript                   |
| `web`      | `apps/web`          | Public scanner, Smart Agent View, shareable reports and Ask your site                                          | Next.js 16 + HeroUI 3 + Tailwind 4 |
| `supabase` | `packages/supabase` | Typed client, generated database types, local stack config and migrations                                      | TypeScript + Supabase CLI          |

The standard web scan is **zero-config**: with no environment variables it
stores scans in memory and works locally. Add agent-browser for local Smart
Agent audits, Supabase keys for persistence, a Resend key for emailed reports,
and AI Gateway credentials for Ask your site.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

- **Bun** ≥ 1.3
  ```sh
  curl -fsSL https://bun.com/install | bash
  ```
- **Node.js** ≥ 20.9 (for Next.js tooling)
- **Docker** — only for `bun run dev`, which boots a local Supabase stack via
  the Supabase CLI. The CLI itself is just for the scan engine and needs no Docker.
- Optional: **Node.js** ≥ 24 and
  [agent-browser](https://agent-browser.dev/installation) for local `--smart-ai`
  audits:
  ```sh
  npm install -g agent-browser
  agent-browser install
  ```

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/isreadyai/isreadyai.git
   ```
2. Install workspace dependencies
   ```sh
   bun install
   ```
3. (Optional) Copy `.env.example` to `.env` and fill what you need — everything runs without it
4. Start the web app
   ```sh
   bun run dev
   ```

### Self-hosting / Quickstart

`bun run dev` boots a **local Supabase stack** (Postgres, Auth, Studio) through
the Supabase CLI, so **Docker must be running** for the full app. The scanner,
CLI, and Action need no Docker at all.

The app is built to **degrade gracefully** — copy `.env.example` to `.env` and
fill only the integrations you want:

| Without…                | The app…                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| Supabase keys           | runs fully in memory — scans live ~1h, no accounts (zero-config)         |
| Stripe keys             | hides billing; everyone is on the Free plan                              |
| `AI_GATEWAY_API_KEY`    | disables "Ask your site" chat and AI-assisted fixes                      |
| agent-browser / Sandbox | omits the Smart Agent Readability audit; the standard score is unchanged |
| `RESEND_API_KEY`        | falls back to in-browser report downloads (no email delivery)            |

`NEXT_PUBLIC_SITE_URL` and the Supabase config default to `http://localhost:3300`
for local dev. See [`.env.example`](./.env.example) for every variable.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->

## Usage

Scan any site from the terminal:

```sh
npx isreadyai vercel.com              # from npm
bun run isreadyai vercel.com          # from a checkout of this repo
```

```
◆ Agent Readability — AI readiness report
https://vercel.com  ·  2026-06-10

  92/100   EXCELLENT
  ████████████████████████████████████░░░░

  ▰▰▰▰▰▰▰▰▰▰  100  Crawler access
  ▰▰▰▰▰▰▰▰▰▱   96  Rendering
  ▰▰▰▰▰▰▰▰▱▱   84  Structured data
  ▰▰▰▰▰▰▰▰▰▰  100  Trust & security
  ▰▰▰▰▰▰▰▰▱▱   81  Content (GEO)
```

Useful flags: `--json` (machine-readable report), `--quiet` (score only),
`--md` (human Markdown), `--llm` (AI-agent fix plan), `--deep` (crawl the whole
site), and `--smart-ai` (add the separate Smart Agent Readability score and
Smart Agent View using local agent-browser). Exit code
`1` continues to depend only on the standard score, so enabling `--smart-ai` does
not change existing CI gates.

```sh
npx isreadyai example.com --smart-ai       # from npm
bun run isreadyai example.com --smart-ai   # from a checkout of this repo
```

### Smart Agent on Vercel

The web app uses a local `agent-browser` binary in development and Vercel
Sandbox in production. Create a prebuilt Sandbox snapshot once to avoid
installing Chromium for every scan:

```sh
bun --cwd apps/web run smart-agent:snapshot
```

Set the returned `AGENT_BROWSER_SNAPSHOT_ID` in Vercel. Vercel deployments use
OIDC automatically; local snapshot creation also needs `VERCEL_TOKEN`,
`VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.

**Ask your site** uses Vercel AI Gateway and requires `AI_GATEWAY_API_KEY`.
Requests require a signed-in paid account (Pro or Team — team members inherit
access through the workspace owner's plan) or your own BYO LLM key. The
deterministic Smart Agent audit itself never needs an LLM API key.

Other commands from the repo root:

```sh
bun run dev          # start the web app
bun run build        # build all workspaces
bun run test         # run all tests
bun run lint         # oxlint
bun run format       # oxfmt
bun run type-check   # tsc across workspaces
```

### README badge

A live status badge, like coverage badges: it always reflects your domain's
**current** score, independent of any single report. Badges are available with
Pro and Team plans.

Claim and verify your domain in the dashboard (Websites → add a domain →
DNS-TXT verify), then enable the badge for it. The dashboard shows a
ready-to-paste snippet pointing at the public badge image:

```md
[![AI ready](https://isready.ai/badge/yourdomain.com)](https://isready.ai)
```

The image reads the latest persisted score for your verified domain — kept fresh
by the scheduled re-scan — and the public URL never exposes your API key.

### GitHub Action

Gate your deploys on AI readiness — the action **deep-crawls** the site, writes the full report to the job summary, and fails the step when the score drops below your threshold. `DEPLOY_URL` isn't set by GitHub Actions — define it yourself (e.g. `env: DEPLOY_URL: https://yoursite.com` at the job level), or pass a literal URL instead:

```yaml
- name: Readiness audit
  uses: isreadyai/audit-action@v1
  with:
    url: ${{ env.DEPLOY_URL }} # define DEPLOY_URL yourself, e.g. env: DEPLOY_URL: https://yoursite.com
    threshold: 80
```

To audit a branch before it ships, set `command` to boot the branch environment; the action starts it in the background, waits for `url` to respond, then scans that local URL:

```yaml
- name: Readiness audit (branch preview)
  uses: isreadyai/audit-action@v1
  with:
    command: npm run preview # boots the env in the background
    url: http://localhost:3000 # the local URL it listens on
    threshold: 80
    api-key: ${{ secrets.ISREADYAI_API_KEY }} # Pro/Team: uploads the report + repo badge
```

> **Keyed runs require OIDC.** The authenticated upload proves the workflow runs inside the repository it registers — so no one else can claim your repo's badge. Grant the job `id-token: write`; a keyed run without it now **fails fast** with an actionable error (rather than silently dropping the report), or set `report: false` to keep the run local-only:
>
> ```yaml
> jobs:
>   audit:
>     permissions:
>       id-token: write # isready.ai verifies repo ownership via the OIDC token
>       contents: read
>     steps:
>       - uses: isreadyai/audit-action@v1
>         with:
>           url: ${{ env.DEPLOY_URL }} # define DEPLOY_URL yourself, e.g. env: DEPLOY_URL: https://yoursite.com
>           api-key: ${{ secrets.ISREADYAI_API_KEY }}
> ```

| Input       | Required | Default              | Purpose                                                                                                                                                                                                                                    |
| ----------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `url`       | yes      | —                    | URL to audit (strict `http(s)://` allowlist). With `command` set, the local URL the env serves.                                                                                                                                            |
| `threshold` | no       | `70`                 | Minimum acceptable score; the step fails below it.                                                                                                                                                                                         |
| `command`   | no       | `''`                 | Command run with `bash -c` to boot the branch env before scanning. **Only use literal, trusted values** — never wire it from PR/fork-controlled data.                                                                                      |
| `api-key`   | no       | `''`                 | isready.ai API key (repo secret). When set, uploads an authenticated CI report and prints a branch-stable repo badge. Pro/Team only; the job must grant `id-token: write` (OIDC repo-ownership proof) — a keyed run without it fails fast. |
| `api-url`   | no       | `https://isready.ai` | API origin; override for self-hosted deployments.                                                                                                                                                                                          |
| `report`    | no       | `true`               | Set `false` to keep a keyed run local-only (no upload, no badge).                                                                                                                                                                          |

Outputs `score` and `grade` for downstream steps, plus `badge` (a branch-stable repo-badge Markdown snippet) and `report-url` (the shareable report) when a report is uploaded. The action sends an anonymous, PII-free usage ping (host + score only); opt out with `TELEMETRY=false`. The standard scan is free for everyone, including open-source projects; the authenticated CI report + repo badge require a Pro or Team plan.

The companion **fix action** goes further: after scanning it runs an in-runner AI agent that applies the fixes and opens a pull request — and uploads the same CI report + repo badge, so the dashboard fills in even if you only use fix. It needs `contents: write` and `pull-requests: write` to open the PR, plus `id-token: write` for the report upload:

```yaml
jobs:
  fix:
    permissions:
      contents: write
      pull-requests: write
      id-token: write # uploads the CI report + repo badge
    steps:
      - uses: actions/checkout@v7
      - uses: isreadyai/fix-action@v1
        with:
          url: ${{ env.DEPLOY_URL }} # define DEPLOY_URL yourself, e.g. env: DEPLOY_URL: https://yoursite.com
          api-key: ${{ secrets.ISREADYAI_API_KEY }} # Pro/Team
```

Before minting its metered token, the fix action **preflights** that the run can actually open a pull request — the token's push access and the repo's _Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"_ setting — so a misconfigured job fails fast with a fix, instead of after the AI work.

Use the engine as a library:

```ts
import { scan, allChecks, createProviders } from '@isreadyai/scanner'

const report = await scan('example.com', {
  checks: allChecks,
  providers: createProviders(process.env),
})
console.log(report.overall, report.grade)
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- SCORE -->

## The Score

Weighted 0–100 across five dimensions (`scoreVersion` is embedded in every report so methodology can evolve without silently re-grading old scans):

| Dimension       | Weight | What it covers                                                       |
| --------------- | -----: | -------------------------------------------------------------------- |
| Structured data |    30% | JSON-LD types, meta basics, Open Graph, author / E-E-A-T, `lang`     |
| Crawler access  |    25% | robots.txt per AI bot, anti-bot challenges, redirects, TTFB, noindex |
| Rendering       |    20% | empty app shells, semantic landmarks, scripts vs text, noscript      |
| Content (GEO)   |    15% | depth, headings, statistics & citations, content-to-noise            |
| Trust           |    10% | HTTPS, TLS, HSTS, mixed content                                      |

Informational signals (`llms.txt`, robots.txt Content Signals) are reported on every scan but never scored — no major AI provider consumes them today.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [x] Scanner engine — 32 checks, 5 categories, versioned scoring
- [x] CLI — `npx isreadyai <url>` with `--json`, `--md` and `--llm` (AI-agent fix plan)
- [x] Web scanner with shareable reports (zero-config local mode)
- [x] Downloadable reports: human Markdown, AI-agent fix plan, raw JSON
- [x] GitHub Action — score gate + job-summary report (free, also for OSS)
- [x] Premium README badge — signed shields-style `AI ready | 92` SVG for Pro and Team
- [x] Deep scan — sitemap + internal-link crawl, site-wide score, per-page findings (CLI `--deep`, free in-browser on the web)
- [x] Report by email — PDF + Markdown delivered via Resend
- [x] Fix action — opens a PR: an in-runner AI agent applies the fixes (source is read and edited in the runner; only the snippets the agent opens are sent for inference, never stored by isready.ai), plus a tailored AI fix plan in the PR body and job summary
- [x] Supabase persistence — public reports persisted, plus accounts and auth
- [x] Accounts & team workspaces — magic-link/OAuth login, dashboard, API keys, Pro/Team billing, in-app team invites, domain claim
- [x] Account security — change email, connected social accounts, a global alerts switch, and permanent account deletion (scans are kept, only dissociated — they're generic and account-agnostic)
- [x] Saved reports and score history over time
- [x] Premium: scheduled re-scans with score-drop alerts and a weekly email report
- [x] Ask your site — premium grounded chat over your report (Vercel AI Gateway)
- [x] Premium: AI-generated fix plans (Vercel AI Gateway) — tailored to your stack, in the report, on the website detail, and written into the fix Action's PR + job summary
- [ ] GitHub-connected source scanning for login-gated SaaS
- [ ] Embeddable "AI-Ready ✓" badge linking to a public report
- [ ] Optional JS-render analysis (self-hosted, premium) for CSR-heavy sites
- [ ] Passkeys (WebAuthn) — passwordless, phishing-resistant login. Supabase Auth now ships passkeys natively (Beta); wire `signInWithPasskey()` plus passkey enrollment/management in account settings, behind the experimental WebAuthn opt-in and relying-party config (RP ID, origins)
- [ ] Two-factor authentication — TOTP authenticator app (Supabase-native MFA)

See [open issues](https://github.com/isreadyai/isreadyai/issues) for the full list.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions make the open-source community an amazing place to learn and create. Any contribution is **greatly appreciated** — especially new checks (each one is a small, tested module in `packages/scanner/src/checks/`).

1. Fork the project
2. Create your feature branch (`git checkout -b feat/amazing-check`)
3. Add the check **with tests** (`bun test`)
4. Commit (`git commit -m 'feat(scanner): add amazing check'`)
5. Push and open a pull request

Before opening a PR, run the full check suite from the repo root:

```sh
bun run lint         # oxlint
bun run format       # oxfmt
bun run test         # all workspace tests
bun run type-check   # tsc across workspaces
bun run build        # build all workspaces
```

Adding a scanner check, in short:

1. Create the module in `packages/scanner/src/checks/<category>/` with `defineCheck()`.
2. Register it in that category's `index.ts`.
3. Add a `<name>.test.ts` covering pass, fail and edge cases.
4. Bump `PUBLISHED_CHECK_COUNT` in `checks/registry.test.ts` and the matching marketing copy.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full setup and recipe walkthrough.
Engineering and UI conventions are documented in [`CONVENTIONS.md`](./CONVENTIONS.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGEMENTS -->

## Acknowledgements

isready.ai stands on the shoulders of a lot of brilliant open-source work and
generous free tiers. A heartfelt **thank you** to everyone who builds and
maintains these — we couldn't have shipped this without you. 💚

**Framework & runtime**

- [Next.js](https://nextjs.org/) — the React framework powering the web app
- [React](https://react.dev/) — UI library
- [TypeScript](https://www.typescriptlang.org/) — typed JavaScript end to end
- [Bun](https://bun.com/) — runtime, package manager and test runner
- [Turborepo](https://turborepo.com/) — monorepo task orchestration

**UI & design**

- [HeroUI](https://heroui.com/) — React component library
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Geist](https://vercel.com/font) — Vercel's typeface (sans & mono)
- [GSAP](https://gsap.com/) — animation
- [Sonner](https://sonner.emilkowal.ski/) — toast notifications
- [Streamdown](https://streamdown.ai/) — streaming-markdown renderer for AI replies

**AI**

- [Vercel AI SDK](https://ai-sdk.dev/) (`ai`, `@ai-sdk/react`) — chat, streaming & tools
- [AI Elements](https://elements.ai-sdk.dev/) — composable AI chat UI primitives
- [Vercel AI Gateway](https://vercel.com/ai-gateway) — model routing for the Smart Agent
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) — isolated agent-browser runtime

**Data, payments & infrastructure**

- [Supabase](https://supabase.com/) — Postgres, auth and storage
- [Stripe](https://stripe.com/) — subscriptions and billing (+ [stripe-sync-engine](https://github.com/supabase/stripe-sync-engine))
- [Vercel](https://vercel.com/) — hosting and deploys
- [Resend](https://resend.com/) — transactional email for reports
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) — friendly CAPTCHA

**Libraries & utilities**

- [Zod](https://zod.dev/) — schema validation
- [next-intl](https://next-intl.dev/) — internationalization
- [next-themes](https://github.com/pacocoursey/next-themes) — theme handling
- [jsPDF](https://github.com/parallax/jsPDF) — PDF report export
- [@clack/prompts](https://www.clack.cc/) — the CLI's interactive prompts

**Tooling**

- [oxlint & oxfmt](https://oxc.rs/) — fast Rust-based linting and formatting
- [dotenv-cli](https://github.com/entropitor/dotenv-cli) · [exits](https://github.com/rafamel/exits) — dev orchestration
- [Stripe CLI](https://docs.stripe.com/stripe-cli) — local webhook forwarding

And a nod to the **README template** by [othneildrew](https://github.com/othneildrew/Best-README-Template).

A live, linked version of these thanks lives at
[isready.ai/acknowledgements](https://isready.ai/acknowledgements).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

© 2026 Smart Squad S.r.l. ([smartsquad.io](https://smartsquad.io)). This
repository is dual-licensed by area:

- **Open engine — MIT.** `packages/scanner` and `apps/cli` are open source
  under the MIT License.
- **Dashboard — PolyForm Shield 1.0.0.** `apps/web` and `packages/supabase`
  are source-available but not open source: you may not use them to build a
  product that competes with isready.ai.

Each directory ships its own `LICENSE` with the authoritative terms. See the
root [`LICENSE`](./LICENSE) for the map and [`NOTICE`](./NOTICE) for ownership.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Smart Squad Srl — [smartsquad.io](https://smartsquad.io)

Project: [https://isready.ai](https://isready.ai) · [https://github.com/isreadyai/isreadyai](https://github.com/isreadyai/isreadyai)

Contact: [https://isready.ai/contact](https://isready.ai/contact)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[Turborepo]: https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white
[Turborepo-url]: https://turborepo.com/
[Bun]: https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white
[Bun-url]: https://bun.com/
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Next.js]: https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[HeroUI]: https://img.shields.io/badge/HeroUI%203-7C3AED?style=for-the-badge
[HeroUI-url]: https://heroui.com/
[Tailwind]: https://img.shields.io/badge/Tailwind_CSS_4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Supabase]: https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white
[Supabase-url]: https://supabase.com/
[Vercel]: https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
[Vercel-url]: https://vercel.com/
