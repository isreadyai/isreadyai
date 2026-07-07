<a id="readme-top"></a>

<div align="center">
  <a href="https://isready.ai">
    <img src="https://isready.ai/icon.svg" alt="isready.ai logo" width="96">
  </a>

  <h1 align="center">isready.ai — AI readiness audit</h1>

  <p align="center">
    Gate your deploys on whether AI crawlers can actually read your site.
    <br />
    Deep-crawls the URL, writes the full report to the job summary, and
    <strong>fails the step</strong> when the score drops below your threshold.
  </p>

  <p align="center">
    <a href="https://github.com/marketplace/actions/isreadyai-ai-readiness-audit"><img src="https://img.shields.io/badge/Marketplace-audit--action-2ea44f?logo=githubactions&logoColor=white" alt="GitHub Marketplace"></a>
    <a href="https://github.com/isreadyai/audit-action/actions"><img src="https://img.shields.io/github/actions/workflow/status/isreadyai/audit-action/ci.yml?label=ci" alt="CI"></a>
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
- [Security](#security)
- [Privacy & telemetry](#privacy--telemetry)
- [Versioning & pinning](#versioning--pinning)
- [How it works](#how-it-works)
- [License](#license)

---

## What it does

Most AI crawlers — **GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot** — do **not**
execute JavaScript, run separate crawlers per purpose, and are silently blocked by
anti-bot challenges. This action audits a URL exactly the way those crawlers parse
it, scores it **0–100** across five dimensions, writes the full report to the
**GitHub job summary**, and **fails the step** when the score is below your
`threshold` — so an AI-readiness regression blocks the merge or deploy like any
other check.

With a Pro/Team **API key** it also uploads an authenticated CI report to isready.ai
and prints a branch-stable **repo badge** snippet. The standard audit is **free**,
including for open-source projects.

## Usage

```yaml
- name: AI readiness audit
  uses: isreadyai/audit-action@v1
  with:
    url: ${{ env.DEPLOY_URL }}
    threshold: 80
```

That's the whole minimal setup: it deep-crawls `url`, writes the report to the job
summary, and fails the step if the score is under `80`.

## Workflow permissions

- **Free audit (no `api-key`):** only needs read access.

  ```yaml
  permissions:
    contents: read
  ```

- **Keyed run (`api-key` set):** the authenticated upload proves the workflow runs
  inside the repository it registers (so no one else can claim your repo's badge),
  which requires an **OIDC token**. Grant `id-token: write`; without it the audit
  still runs but the upload is skipped.

  ```yaml
  permissions:
    id-token: write # isready.ai verifies repo ownership via the OIDC token
    contents: read
  ```

## Inputs

| Input       | Required | Default              | Description                                                                                                                                                                       |
| ----------- | :------: | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`       |   yes    | —                    | URL to audit (validated against a strict `^https?://` allowlist). When `command` is set, this is the **local** URL the booted server listens on (e.g. `http://localhost:3000`). |
| `threshold` |    no    | `70`                 | Minimum acceptable score (0–100); the step **fails** below it.                                                                                                                  |
| `command`   |    no    | `''`                 | Optional command run with `bash -c` to boot the branch environment before scanning. The action starts it in the background, waits for `url` to respond, then scans that local URL. |
| `api-key`   |    no    | `''`                 | isready.ai API key (store as a repo secret). When set, the report is uploaded and a branch-stable repo badge snippet is printed. **Pro/Team plans only.**                       |
| `api-url`   |    no    | `https://isready.ai` | isready.ai API origin (override for self-hosted deployments).                                                                                                                   |
| `report`    |    no    | `true`               | Set to `false` to keep a keyed run **local-only** (no upload, no badge).                                                                                                        |

## Outputs

| Output       | Description                                                                              |
| ------------ | --------------------------------------------------------------------------------------- |
| `score`      | Overall AI-readiness score (0–100).                                                     |
| `grade`      | Grade: `excellent` \| `good` \| `moderate` \| `poor`.                                   |
| `badge`      | Markdown badge snippet for this branch (empty when no report was uploaded).             |
| `report-url` | Shareable report URL on isready.ai (empty when no report was uploaded).                 |

## Examples

### Audit a public production or preview deployment

```yaml
jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: AI readiness audit
        uses: isreadyai/audit-action@v1
        with:
          url: https://www.example.com
          threshold: 80
```

### Audit a branch before it ships (boot the preview env)

Set `command` to boot the branch environment; the action starts it in the
background, waits for `url` to respond, then scans that local URL.

```yaml
- name: AI readiness audit (branch preview)
  uses: isreadyai/audit-action@v1
  with:
    command: npm run preview # boots the env in the background
    url: http://localhost:3000 # the local URL it listens on
    threshold: 80
```

### Upload an authenticated CI report + repo badge (Pro/Team)

```yaml
jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # OIDC repo-ownership proof — required for the upload
      contents: read
    steps:
      - name: AI readiness audit
        id: isready
        uses: isreadyai/audit-action@v1
        with:
          url: ${{ env.DEPLOY_URL }}
          threshold: 80
          api-key: ${{ secrets.ISREADYAI_API_KEY }} # uploads the report + repo badge

      - name: Show the score
        run: echo "Scored ${{ steps.isready.outputs.score }} (${{ steps.isready.outputs.grade }})"
```

### Use the outputs downstream

```yaml
      - name: Comment the badge on the PR
        if: steps.isready.outputs.badge != ''
        run: echo "${{ steps.isready.outputs.badge }}"
```

## Security

> [!IMPORTANT]
> `url` and `command` are interpolated into shell commands. **Never** wire them
> from `pull_request_target`, issue/PR titles, comments, forks, or any other
> attacker-controlled event data.

- **`url`** is enforced against a strict `http(s)://` allowlist, so shell
  metacharacters (`` $ ` " \ ; | & ``, spaces, …) can never reach the underlying
  `curl` / scanner commands — but only ever pass a value you control.
- **`command`** is executed **verbatim** with `bash -c`. Only set it to a literal
  command authored in your trusted workflow file. Wiring it from PR-head or
  fork-controlled data is remote code execution on your runner.

## Privacy & telemetry

The action sends an anonymous, PII-free usage ping (host + score only). Opt out by
setting `TELEMETRY=false` in the step/job env. The standard scan is free for
everyone, including open-source projects; the authenticated CI report + repo badge
require a Pro or Team plan. The keyed upload uses **OIDC** to prove repo ownership
and never exposes your API key in the badge URL.

## Versioning & pinning

- **Convenient:** pin the moving major tag to get fixes automatically.

  ```yaml
  uses: isreadyai/audit-action@v1
  ```

- **Hardened (recommended for supply-chain safety):** pin the full-length commit
  SHA, with the readable tag in a trailing comment.

  ```yaml
  uses: isreadyai/audit-action@<full-commit-sha> # v1.4.2
  ```

Releases follow semantic versioning; the `v1` tag always points at the latest
`v1.x.y`.

## How it works

The audit is powered by the open-source (MIT) isready.ai engine and CLI. This
repository ships a pre-bundled, node-target build of that engine — it is generated
from the [`isreadyai/isreadyai`](https://github.com/isreadyai/isreadyai) monorepo,
so please **open issues and PRs there**, not against the generated files here.

Learn more at **[isready.ai](https://isready.ai)** and read about the scoring
methodology in the [monorepo README](https://github.com/isreadyai/isreadyai#the-score).

## License

[MIT](./LICENSE) — © Smart Squad S.r.l. ([smartsquad.io](https://smartsquad.io)).

<p align="right">(<a href="#readme-top">back to top</a>)</p>
