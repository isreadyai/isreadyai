#!/usr/bin/env bash
# Pushes every non-empty var from a .env file to a linked Vercel project.
# Usage: ./scripts/push-vercel-env.sh [path-to-env] [environment]
#   env file defaults to .env, environment to "production".
# Prereqs: `vercel login` + `vercel link` already done in this directory.
set -euo pipefail

ENV_FILE="${1:-.env}"
TARGET="${2:-production}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not found — npm i -g vercel" >&2
  exit 1
fi
if [ ! -d .vercel ]; then
  echo "Project not linked — run: vercel link" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE — copy .env.example and fill it first" >&2
  exit 1
fi

pushed=0 skipped=0
while IFS= read -r line || [ -n "$line" ]; do
  # Strip comments and blanks.
  case "$line" in ''|\#*) continue;; esac
  key="${line%%=*}"
  value="${line#*=}"
  # Trim surrounding quotes/space.
  value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')"
  if [ -z "$value" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  # Reject malformed keys before touching the remote.
  case "$key" in
    [A-Za-z_]*) : ;;
    *) echo "  ! skipping invalid key: $key" >&2; skipped=$((skipped + 1)); continue ;;
  esac
  # Vercel has no atomic update, so this is remove-then-add. If the add fails
  # AFTER the remove, the var is briefly MISSING in $TARGET — fail loudly with the
  # key so it can be restored, instead of a silent set -e abort.
  vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true
  if ! printf '%s' "$value" | vercel env add "$key" "$TARGET" >/dev/null 2>&1; then
    echo "  ✗ FAILED to set $key in $TARGET — it may now be MISSING; re-run or set it in the Vercel dashboard." >&2
    exit 1
  fi
  echo "  + $key  →  $TARGET"
  pushed=$((pushed + 1))
done < "$ENV_FILE"

echo "Done: $pushed pushed, $skipped skipped (empty)."
