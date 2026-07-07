<a id="readme-top"></a>

<div align="center">
  <a href="https://isready.ai">
    <img src="https://isready.ai/icon.svg" alt="isready.ai logo" width="96">
  </a>

  <h1 align="center">isready.ai — AI readiness fix PR</h1>

  <p align="center">
    Scans your site, then runs an isready.ai AI agent <strong>inside the runner</strong>
    that reads your repo, applies AI-readiness fixes, and <strong>opens a pull
    request</strong>.
    <br />
    The agent runs locally with a short-lived metered token — your source is never
    stored by isready.ai. Requires a <strong>Pro or Team</strong> API key.
  </p>

  <p align="center">
    <a href="https://github.com/marketplace/actions/isreadyai-ai-readiness-fix-pr"><img src="https://img.shields.io/badge/Marketplace-fix--action-2ea44f?logo=githubactions&logoColor=white" alt="GitHub Marketplace"></a>
    <a href="https://github.com/isreadyai/fix-action/actions"><img src="https://img.shields.io/github/actions/workflow/status/isreadyai/fix-action/ci.yml?label=ci" alt="CI"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
    <a href="https://isready.ai"><img src="https://img.shields.io/badge/isready.ai-website-000000?logo=data:image/svg+xml;base64," alt="isready.ai"></a>
  </p>
</div>

---

## Contents

- [What it does](#what-it-does)
- [Usage](#usage)
- [Workflow permissions](#workflow-permissions)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Examples](#examples)
- [How the agent stays safe](#how-the-agent-stays-safe)
- [Privacy](#privacy)
- [Versioning & pinning](#versioning--pinning)
- [How it works](#how-it-works)
- [License](#license)

---

## What it does

1. **Scans** the URL exactly the way AI crawlers parse it.
2. **Runs an isready.ai AI agent inside your runner**, in your repo checkout. It
   reads the source locally and applies **minimal, low-risk** AI-readiness fixes —
   robots.txt allow-groups for AI bots, an `llms.txt` scaffold, sitemap hints,
   metadata / structured-data improvements, alt text, heading structure.
3. **Opens a pull request** with the changes, plus a tailored **AI fix plan** in the
   PR body and the job summary. When nothing needs fixing it says so (the site is
   already AI-ready) and opens no PR.

The agent authenticates with a **short-lived, inference-scoped token** minted per
run; the real gateway key stays on isready.ai, and only the file snippets the agent
opens transit the inference proxy — they are **not stored** by isready.ai. Requires
a **Pro or Team** API key.

## Usage

```yaml
jobs:
  ai-readiness-fix:
    runs-on: ubuntu-latest
    permissions:
      contents: write # push the fix branch
      pull-requests: write # open the PR
      id-token: write # upload the CI report + repo badge
    steps:
      - uses: actions/checkout@v7

      - name: AI readiness fix PR
        uses: isreadyai/fix-action@v1
        with:
          url: ${{ env.DEPLOY_URL }}
          api-key: ${{ secrets.ISREADYAI_API_KEY }} # Pro/Team
```

Check out the repo first (`actions/checkout`) — the agent edits your working tree
and the action commits from it.

## Workflow permissions

The action pushes a branch and opens a PR with the built-in `GITHUB_TOKEN`, so the
job **must** grant:

```yaml
permissions:
  contents: write # commit + push the fix branch
  pull-requests: write # open the pull request
  id-token: write # upload the CI report + repo badge
```

With an `api-key` set, the fix action also uploads the scan to your isready.ai CI
Reports dashboard and unlocks a branch-stable repo badge — the same OIDC
repo-ownership proof the audit action uses. Grant `id-token: write` to enable it;
without it the fix pull request still opens and only the report upload is skipped
(a warning, never a failure).

> [!NOTE]
> A pull request opened with the default `GITHUB_TOKEN` **does not trigger other
> workflows** (e.g. your CI won't run on it automatically). If you need the fix PR
> to trigger downstream workflows, run this action with a Personal Access Token or a
> GitHub App token instead of the default token, and enable "Allow GitHub Actions to
> create and approve pull requests" in your repository/organization settings.

## Inputs

| Input     | Required | Default                        | Description                                                                          |
| --------- | :------: | ------------------------------ | ------------------------------------------------------------------------------------ |
| `url`     |   yes    | —                              | URL to audit (e.g. the production or preview deployment).                             |
| `api-key` |   yes    | —                              | isready.ai API key, **Pro or Team** (store it as a repo secret).                      |
| `api-url` |    no    | `https://isready.ai`           | isready.ai API origin (override for self-hosted deployments).                         |
| `branch`  |    no    | `feature/ai-readiness-fixes`   | Branch name for the fix PR.                                                           |
| `dry-run` |    no    | `false`                        | Apply edits and print the summary **without** opening a PR.                           |

## Outputs

| Output    | Description                                             |
| --------- | ------------------------------------------------------ |
| `patches` | Number of files the agent changed.                     |
| `pr-url`  | URL of the opened pull request (empty when none).      |

## Examples

### On a schedule, open a fix PR when the site drifts

```yaml
name: Weekly AI readiness fixes
on:
  schedule:
    - cron: '0 6 * * 1' # Mondays 06:00 UTC
  workflow_dispatch: {}

jobs:
  fix:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write # upload the CI report + repo badge
    steps:
      - uses: actions/checkout@v7
      - name: AI readiness fix PR
        uses: isreadyai/fix-action@v1
        with:
          url: https://www.example.com
          api-key: ${{ secrets.ISREADYAI_API_KEY }}
```

### Dry run — see the plan without opening a PR

```yaml
      - name: AI readiness fix (dry run)
        id: fix
        uses: isreadyai/fix-action@v1
        with:
          url: ${{ env.DEPLOY_URL }}
          api-key: ${{ secrets.ISREADYAI_API_KEY }}
          dry-run: 'true'

      - name: Report
        run: echo "The agent would change ${{ steps.fix.outputs.patches }} file(s)"
```

### Custom branch name and using the PR URL

```yaml
      - name: AI readiness fix PR
        id: fix
        uses: isreadyai/fix-action@v1
        with:
          url: ${{ env.DEPLOY_URL }}
          api-key: ${{ secrets.ISREADYAI_API_KEY }}
          branch: chore/ai-readiness

      - name: Announce the PR
        if: steps.fix.outputs.pr-url != ''
        run: echo "Opened ${{ steps.fix.outputs.pr-url }}"
```

## How the agent stays safe

The agent treats **all repository contents as untrusted data** (prompt-injection),
and the action commits + pushes with the token in env — so it is hardened
accordingly:

- **Sandboxed file access.** Path traversal, symlink escapes, and git-pathspec-magic
  filenames are rejected; the agent can only read/write inside the workspace.
- **Secrets are never read or exfiltrated.** `.env*` (except examples), key/cert
  files, and credential files are blocked on read; obvious secrets in otherwise
  readable files are redacted before anything is sent for inference.
- **RCE surfaces are blocked on write.** `.git`, `node_modules`, `.github/workflows`,
  and any git-hook directory (`.git/hooks`, `.husky`, `.../hooks`) can never be
  written.
- **Only the agent's declared changes are committed.** The PR step stages **exactly**
  the files the agent reported changing (via a NUL-delimited manifest and
  `git add --pathspec-from-file --pathspec-file-nul --literal-pathspecs`) — never
  `git add -A` — and disables repo-supplied git hooks (`core.hooksPath=/dev/null`,
  `--no-verify`) on every git command so no hook runs with the token available.

## Privacy

The AI runs **inside your runner**. Only the model messages — the system prompt, the
scan findings, and the file snippets the agent chooses to open — transit the
inference proxy, authenticated with an **ephemeral, inference-scoped** token minted
per run. Your source is **not stored** by isready.ai. When a PR is opened, isready.ai
is notified (best-effort) so it can email the account owner; that call never fails
the run.

## Versioning & pinning

- **Convenient:** `uses: isreadyai/fix-action@v1` (moving major tag — gets fixes
  automatically).
- **Hardened (recommended):** pin the full commit SHA with the tag in a comment:

  ```yaml
  uses: isreadyai/fix-action@<full-commit-sha> # v1.4.2
  ```

Releases follow semantic versioning; `v1` always points at the latest `v1.x.y`.

## How it works

Powered by the open-source (MIT) isready.ai engine and the in-runner fix agent. This
repository ships a pre-bundled, node-target build generated from the
[`isreadyai/isreadyai`](https://github.com/isreadyai/isreadyai) monorepo — please
**open issues and PRs there**, not against the generated files here.

Learn more at **[isready.ai](https://isready.ai)**. The audit-only companion action
is [`isreadyai/audit-action`](https://github.com/isreadyai/audit-action).

## License

[MIT](./LICENSE) — © Smart Squad S.r.l. ([smartsquad.io](https://smartsquad.io)).

<p align="right">(<a href="#readme-top">back to top</a>)</p>
