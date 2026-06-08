# Social OAuth setup (Connect Google / Connect GitHub)

The app code is already wired:

- **Login** uses `supabase.auth.signInWithOAuth(...)`.
- **Account → Security** uses `supabase.auth.linkIdentity(...)` / `unlinkIdentity(...)`.
- Both pass `redirectTo: ${origin}/auth/callback`, handled by
  `apps/web/app/auth/callback/route.ts` (it exchanges the `?code` for a session).

The buttons fail only because the **providers have no credentials yet**. This guide
is the turnkey checklist to switch them on. No code changes are needed.

---

## Two different callback URLs (do not confuse them)

| URL                                                                                                               | Who redirects to it                                      | Where you register it                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://<project-ref>.supabase.co/auth/v1/callback` (hosted) / `http://127.0.0.1:59321/auth/v1/callback` (local) | The OAuth **provider** (GitHub/Google) → Supabase GoTrue | In the **provider's** OAuth app settings ("Authorization callback URL" / "Authorized redirect URIs")                                                    |
| `https://isready.ai/auth/callback` (prod) / `http://localhost:3300/auth/callback` (local)                         | **Supabase** → back to the app                           | In Supabase auth config (`additional_redirect_urls`, already set in `packages/supabase/config.toml`; and in the hosted dashboard's redirect allow-list) |

The provider only ever talks to Supabase. Supabase then bounces the browser to the
app's `/auth/callback`. Register each URL in the right place or the round-trip breaks.

> The local Supabase API runs on **port 59321** (not the default 54321) — this repo
> remaps the 5932x range. Use `127.0.0.1:59321` for the local provider callback.

---

## 1. Create the GitHub OAuth App

1. Go to **github.com/settings/developers → OAuth Apps → New OAuth App**
   (org-owned apps live under the org's `Settings → Developer settings`).
2. Fill in:
   - **Homepage URL**: `https://isready.ai` (local: `http://localhost:3300`)
   - **Authorization callback URL**:
     - hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
     - local: `http://127.0.0.1:59321/auth/v1/callback`
   - A GitHub OAuth App allows only one callback URL, so create **two apps**
     (one for hosted, one for local) or just register the one you currently need.
3. Click **Register application**, then **Generate a new client secret**.
4. Copy the **Client ID** and **Client secret**.

## 2. Create the Google OAuth 2.0 Client

1. **console.cloud.google.com → APIs & Services → OAuth consent screen** — configure
   it (External, app name, support email, scopes `email`/`profile`/`openid`).
   Add your domains under **Authorized domains** (`isready.ai`).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - **Application type**: Web application
   - **Authorized JavaScript origins**:
     `https://isready.ai` (and `http://localhost:3300` for local)
   - **Authorized redirect URIs** (Google allows multiple — add both):
     - `https://<project-ref>.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:59321/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.

## 3. Sign in with X (use the OAuth 2.0 provider, not the legacy one)

> Supabase has **two** X providers: the new **X (OAuth 2.0)** — provider key
> `x` — and the legacy **Twitter (OAuth 1.0a)** — key `twitter` — which Supabase
> has **deprecated**. We wire the new one (`[auth.external.x]`, `provider: 'x'`).

1. **developer.x.com → Projects & Apps** → create a Project + App (the free tier
   includes "Sign in with X").
2. In the app → **User authentication settings → Set up**:
   - **App permissions**: Read
   - **Type of App**: Web App
   - **Callback URI / Redirect URL**:
     - local: `http://127.0.0.1:59321/auth/v1/callback`
     - hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
   - **Website URL**: `https://isready.ai`
3. Save, then under **Keys and tokens** copy the **OAuth 2.0 Client ID** and
   **Client Secret** (NOT the OAuth 1.0a API Key/Secret).
4. Use them as `SUPABASE_AUTH_X_CLIENT_ID` / `SUPABASE_AUTH_X_SECRET`.

---

## 4. Where to paste the credentials

### Local development

Put the values in `.env.local` (gitignored) — keys already scaffolded empty:

```
SUPABASE_AUTH_GITHUB_CLIENT_ID=...
SUPABASE_AUTH_GITHUB_SECRET=...
SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_GOOGLE_SECRET=...
SUPABASE_AUTH_X_CLIENT_ID=...
SUPABASE_AUTH_X_SECRET=...
```

`packages/supabase/config.toml` reads them via `env(...)`. Then restart the stack:

```
bun run db:stop && bun run db:start
```

(Local Supabase only re-reads env/config on start. A restart is required after
pasting; a running stack will not pick up the new secrets.)

### Hosted (production)

Do **not** rely on the env file in production. In the Supabase dashboard:

**Authentication → Providers → GitHub / Google / X (OAuth 2.0)** → toggle
**Enabled**, paste the **Client ID** and **Client Secret**, save. Then under
**Authentication → URL Configuration**, set the **Site URL** to `https://isready.ai`
and add `https://isready.ai/auth/callback` (and any preview origins) to the
**Redirect URLs** allow-list.

---

## 5. Go-live checklist

- [ ] GitHub OAuth App created; callback = `.../auth/v1/callback` (Supabase host).
- [ ] Google OAuth client created; both Supabase callbacks added to redirect URIs.
- [ ] X (OAuth 2.0) app created; OAuth 2.0 Client ID/Secret in env; callback registered.
- [ ] Local: four `SUPABASE_AUTH_*` vars filled in `.env.local`,
      then `bun run db:stop && bun run db:start`.
- [ ] Hosted: providers enabled + secrets pasted in the Supabase dashboard.
- [ ] Hosted: `https://isready.ai/auth/callback` whitelisted in Supabase Redirect URLs.
- [ ] Smoke test: **Login → Continue with Google/GitHub**, and
      **Dashboard → Account → Security → Connect**. Both should round-trip to
      `/auth/callback` and land on `/dashboard`.

---

## Notes

- `enabled = true` with **empty** secrets is safe: `supabase start` boots normally
  (verified — config validation passes and the provider is simply inert until
  credentials exist). So the providers ship enabled and only need credentials.
- `additional_redirect_urls` in `config.toml` already includes
  `http://localhost:3300/auth/callback` and `https://isready.ai/auth/callback`.
- Never commit real secrets. `.env`, `.env.local`, `.env.prod` are gitignored;
  only `.env.example` (placeholders) is committed.
