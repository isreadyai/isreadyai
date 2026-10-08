# Checklist

## www.isready.ai (canonical host)

Checked 2026-10-07 from this repo. `isready.ai` resolves on Cloudflare (`elmo.ns.cloudflare.com`, `katja.ns.cloudflare.com`) to the Cloudflare anycast addresses. `www.isready.ai` is NXDOMAIN. No Cloudflare API token and no Vercel token are in this checkout, so the zone record has to be added in the dashboard. The app 301 (`apps/web/lib/apex-host.ts`, `next.config.ts`, `proxy.ts`) only runs after a request reaches Next.

### Cloudflare clicks

1. Open the Cloudflare dashboard and select the `isready.ai` zone.
2. Go to DNS, then Records, then Add record.
3. Type: CNAME. Name: `www`. Target: `isready.ai`. Proxy status: Proxied. TTL: Auto. Save.
4. Go to Rules, then Redirect Rules, then Create rule.
5. Rule name: `www to apex`.
6. Custom filter expression: `(http.host eq "www.isready.ai")`.
7. Then: Dynamic redirect. Expression: `concat("https://isready.ai", http.request.uri.path)`. Status code: 301. Preserve query string: on. Deploy.

A CNAME without the redirect serves both hosts and the scanner still warns. The redirect is the part that clears `crawler.www-consistency`.

### Re-scan

The stored report does not update itself. After `dig +short CNAME www.isready.ai` returns a target and `curl -sI https://www.isready.ai/` shows `301` with `Location: https://isready.ai/`, run a new scan:

```
npx isreadyai https://isready.ai
```

Or submit `https://isready.ai` on the site. The check fetches `https://www.isready.ai/` during that scan and looks for a redirect whose final host is `isready.ai`.

## Supabase auth email templates

The light and dark auth emails live in `packages/supabase/templates/magic-link.html` and `packages/supabase/templates/email-change.html`. `packages/supabase/config.toml` applies them to the local stack only. The hosted project keeps its own copy of each template, so production keeps sending the old dark-only emails until the new HTML is pasted in.

1. Open the production project in the Supabase dashboard and go to Authentication, then Email Templates.
2. In Magic Link, keep the subject `Your isready.ai sign-in link` and replace the body with the full contents of `packages/supabase/templates/magic-link.html`.
3. In Change Email Address, keep the subject `Confirm your new isready.ai email` and replace the body with the full contents of `packages/supabase/templates/email-change.html`.
4. Save both, then request a magic link and open it once in a light-mode and once in a dark-mode mail client.
