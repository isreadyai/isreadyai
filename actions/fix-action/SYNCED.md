# Generated — do not edit by hand

This repository is **generated** from the
[`isreadyai/isreadyai`](https://github.com/isreadyai/isreadyai) monorepo and
synced automatically on each release. Any edit made directly here will be
**overwritten** by the next sync.

| File in this repo | Source of truth in the monorepo |
| ----------------- | ------------------------------- |
| `action.yml` | `actions/fix-action/action.yml` — versioned template; runs the committed `dist/` bundles with `node`. All security bash (token mint, `add-mask`, `core.hooksPath=/dev/null`, `--pathspec-from-file --pathspec-file-nul --literal-pathspecs`) preserved verbatim. |
| `dist/scan.js` | `apps/cli/src/index.ts` — scanner + `@clack/prompts` inlined (`Bun.build`, `target: node`, zero runtime deps) |
| `dist/ci-upload.js` | `apps/cli/src/ci-upload.ts` — OIDC-authenticated CI report + repo badge upload |
| `dist/solve.js` | `fix-action/solve.ts` — the in-runner AI fix agent (sandboxed file access, secret redaction) |
| `dist/plan.js` | `fix-action/plan.ts` — the tailored AI fix-plan fetch |
| `dist/package.json` | generated — `{"type":"module"}` so `node` treats the ESM bundles as modules on every Node ≥ 14 |
| `README.md` | `actions/fix-action/README.md` |
| `LICENSE` | `apps/cli/LICENSE` (MIT) |
| `SECURITY.md` | points to the monorepo security policy |

**Contributing:** open issues and pull requests in the
[monorepo](https://github.com/isreadyai/isreadyai), not here. The bundles are
committed build outputs (like `actions/checkout` and
`peter-evans/create-pull-request`), never hand-edited.
