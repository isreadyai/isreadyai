# Contributing to isready.ai

Thanks for helping make the web more readable to AI. Contributions are
**greatly appreciated** — especially new scanner checks, which are small, tested,
self-contained modules.

The scanner engine (`packages/scanner`) and CLI (`apps/cli`) are MIT-licensed and
open to contributions. The dashboard (`apps/web`) and Supabase package are
source-available under PolyForm Shield (see [`LICENSE`](./LICENSE)); we still
welcome bug reports and fixes there.

Engineering and UI conventions live in [`CONVENTIONS.md`](./CONVENTIONS.md) —
please skim it before opening a PR.

## Getting set up

```sh
git clone https://github.com/isreadyai/isreadyai.git
cd isreadyai
bun install
```

Scanner and CLI work need no services. Running the full web app (`bun run dev`)
boots a local Supabase stack via the Supabase CLI, so **Docker must be running**.
See the [README](./README.md#self-hosting--quickstart) for the graceful-degradation
matrix.

## Before opening a pull request

Run the full check suite from the repo root:

```sh
bun run lint         # oxlint
bun run format       # oxfmt
bun run test         # all workspace tests
bun run type-check   # tsc across workspaces
bun run build        # build all workspaces
```

Then:

1. Fork the project.
2. Create a feature branch (`git checkout -b feat/amazing-check`).
3. Make the change **with tests**.
4. Commit with a [Conventional Commit](https://www.conventionalcommits.org/)
   message (`git commit -m 'feat(scanner): add amazing check'`).
5. Push and open a pull request.

## Recipe: add a scanner check

Each check is one focused, deterministic module. To add one:

1. **Create the module** in the right category folder under
   `packages/scanner/src/checks/<category>/` — one of `crawler`, `rendering`,
   `structured-data`, `trust`, or `geo`. Use `defineCheck()` from
   [`checks/builder.ts`](./packages/scanner/src/checks/builder.ts) and copy the
   shape of an existing check (e.g.
   [`crawler/robots-exists.ts`](./packages/scanner/src/checks/crawler/robots-exists.ts)).
   Give it a unique, namespaced `id` (e.g. `crawler.robots.exists`), a
   `category`, a `weight`, a `title`, and a `scope` (`SITE` or `PAGE`). Return
   results via `makeResult()` with concrete `evidence`, a `fix`, and `impact`/`effort`.

2. **Register it** in the category's `index.ts` (e.g.
   [`crawler/index.ts`](./packages/scanner/src/checks/crawler/index.ts)) by
   importing it and adding it to that family's array. The top-level
   [`checks/index.ts`](./packages/scanner/src/checks/index.ts) aggregates every
   family into `allChecks`, so you don't edit it directly unless you're adding a
   brand-new category.

3. **Add a test** next to the module (`<name>.test.ts`) covering the pass, fail,
   and edge cases.

4. **Bump the count** in
   [`checks/registry.test.ts`](./packages/scanner/src/checks/registry.test.ts):
   `PUBLISHED_CHECK_COUNT` is an anti-drift guard. It deliberately fails when the
   registry size changes so the public "32 checks" copy stays in sync — update
   the number **and** the marketing copy it guards (homepage / FAQ) in lockstep.

Run `bun test` until green, then open your PR.

## Reporting bugs and requesting features

Use the issue templates:
[bug](https://github.com/isreadyai/isreadyai/issues/new?labels=bug) ·
[feature request](https://github.com/isreadyai/isreadyai/issues/new?labels=enhancement).

For security issues, **do not open a public issue** — see
[`SECURITY.md`](./SECURITY.md).
