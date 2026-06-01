#!/bin/bash
# Generates TypeScript types for the `public` schema into
# packages/supabase/src/database.types.ts (the @isreadyai/supabase package).
#
# Usage:
#   ./scripts/generate-types.sh local   # against the local stack (config.toml ports)
#   ./scripts/generate-types.sh remote  # against $SUPABASE_PROJECT_ID (from .env or env)
set -euo pipefail

MODE="${1:-local}"

# CWD-independent paths: `bun run` may be launched from the repo root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$SUPABASE_PKG_DIR/../.." && pwd)"
DB_TYPES_FILE="$SUPABASE_PKG_DIR/src/database.types.ts"
ENV_FILE="$ROOT_DIR/.env"

cd "$SUPABASE_PKG_DIR"

load_env_var() {
  local name="$1"
  if [ -n "${!name:-}" ] || [ ! -f "$ENV_FILE" ]; then
    return
  fi
  local line value
  line="$(grep -E "^[[:space:]]*${name}=" "$ENV_FILE" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    return
  fi
  value="${line#*=}"
  value="${value%$'\r'}"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  export "$name=$value"
}

SUPABASE_BIN="$SUPABASE_PKG_DIR/node_modules/.bin/supabase"
if [ ! -x "$SUPABASE_BIN" ]; then
  SUPABASE_BIN="$(command -v supabase || echo 'bunx supabase')"
fi

case "$MODE" in
  local)
    "$SUPABASE_BIN" gen types typescript --local --schema public > "$DB_TYPES_FILE"
    ;;
  remote)
    load_env_var SUPABASE_PROJECT_ID
    if [ -z "${SUPABASE_PROJECT_ID:-}" ]; then
      echo "Missing SUPABASE_PROJECT_ID (set it in $ENV_FILE or export it)." >&2
      exit 1
    fi
    "$SUPABASE_BIN" gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public > "$DB_TYPES_FILE"
    ;;
  *)
    echo "Usage: $0 {local|remote}" >&2
    exit 1
    ;;
esac

"$SUPABASE_PKG_DIR/node_modules/.bin/oxfmt" "$DB_TYPES_FILE"

echo "✓ Types generated: $DB_TYPES_FILE ($(wc -l < "$DB_TYPES_FILE") lines)"
