# Security Policy

We take the security of isready.ai seriously. Thank you for helping keep the
project and its users safe.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Report privately through one of:

- **GitHub Security Advisories** — use the repository's
  [**Report a vulnerability**](https://github.com/isreadyai/isreadyai/security/advisories/new)
  button (Security → Advisories). This is the preferred channel.
- **Email** — `dev@smartsquad.io`, the maintainer
  [Smart Squad S.r.l.](https://smartsquad.io). Use the subject line
  `isready.ai security`.

Please include enough detail to reproduce: affected component/endpoint, a
proof of concept, the impact you observed, and any relevant logs or requests.

We aim to acknowledge a report within **3 business days** and to provide a
remediation timeline after triage. Please give us a reasonable window to ship a
fix before any public disclosure, and avoid accessing or modifying other users'
data while testing.

## Scope

In scope:

- The scanner engine (`packages/scanner`) and CLI (`apps/cli`).
- The web app and its API routes (`apps/web`), including authentication,
  billing/entitlement gating, the public badge and CI-report surfaces, and the
  ephemeral solve-token flow.
- The Supabase schema, RLS policies, and migrations (`packages/supabase`).
- The GitHub Actions (`action.yml`, `fix-action/action.yml`).

Out of scope:

- Vulnerabilities in third-party services we depend on (Supabase, Stripe,
  Vercel, Resend, Cloudflare) — report those to the respective vendor.
- Findings that require physical access, social engineering, or already-compromised
  credentials.
- Volumetric denial-of-service and automated scanner noise without a concrete impact.

## Our security process

Security-sensitive changes are reviewed against a living internal checklist,
run on every pull request that touches authentication, RLS, billing/entitlements, public endpoints,
or the badge/CI surfaces. It covers premium-feature gating (plan checks, not just
authentication), Supabase/RLS standing rules, and input-validation boundaries.
