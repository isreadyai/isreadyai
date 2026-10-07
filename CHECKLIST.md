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
