#!/usr/bin/env bash
# Add/refresh the Typefully REST API key in harness/.env.local — no editor needed.
#
# Usage (run with the `!` prefix in your session):
#   ! ./harness/scripts/set-typefully-key.sh          # pull key from 1Password (item field "API")
#   ! ./harness/scripts/set-typefully-key.sh <KEY>    # or pass the key directly
#
# It VALIDATES the key against Typefully v2 (GET /v2/me) and only writes if it's
# accepted, so a wrong/MCP token can't silently land in your env. The key value is
# never printed.
set -euo pipefail

ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local"
OP_ITEM="gdqv3zzwkq52gjqxjawwt4nl4m"   # "Typefully MCP API" — REST key lives in the "API" field

KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo "Reading Typefully REST key from 1Password (item $OP_ITEM, field 'API')…"
  KEY="$(op item get "$OP_ITEM" --fields API --reveal 2>/dev/null || true)"
fi

if [ -z "$KEY" ]; then
  echo "✗ No key found. Put the REST key in the op item's 'API' field, or pass it as an argument."
  exit 1
fi
case "$KEY" in
  http*|*typefully.com*)
    echo "✗ That looks like the MCP URL/token, not a REST key. Generate one at Typefully → Settings → API."
    exit 1 ;;
esac

echo "Validating against Typefully v2 (GET /v2/me)…"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $KEY" https://api.typefully.com/v2/me)"
if [ "$CODE" != "200" ]; then
  echo "✗ Typefully rejected the key (HTTP $CODE) — nothing written. (Is it a v2 REST key from Settings → API?)"
  exit 1
fi

touch "$ENV_FILE"
if grep -q '^TYPEFULLY_API_KEY=' "$ENV_FILE"; then
  tmp="$(mktemp)"; grep -v '^TYPEFULLY_API_KEY=' "$ENV_FILE" > "$tmp"; mv "$tmp" "$ENV_FILE"
fi
printf 'TYPEFULLY_API_KEY=%s\n' "$KEY" >> "$ENV_FILE"
chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "✓ Validated and written to $ENV_FILE (length ${#KEY}; value not printed)."
echo "→ Restart the harness dev server so Next loads it:  pnpm --dir harness dev"
