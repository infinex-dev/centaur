#!/usr/bin/env bash
# Add/refresh Cloudinary upload credentials in harness/.env.local from 1Password.
# Values are never printed.
#
# Usage:
#   ./harness/scripts/set-cloudinary-creds.sh
#   ./harness/scripts/set-cloudinary-creds.sh <1password-item-uuid>
set -euo pipefail

ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local"
OP_ITEM="${1:-wtxlj6su6rpyipze2p3cqwkjsm}" # "Cloudinary API"
CLOUD_NAME="${CLOUDINARY_CLOUD_NAME:-infinex}"

echo "Reading Cloudinary API credentials from 1Password item $OP_ITEM..."
API_KEY="$(op item get "$OP_ITEM" --fields username --reveal 2>/dev/null || true)"
API_SECRET="$(op item get "$OP_ITEM" --fields credential --reveal 2>/dev/null || true)"

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
  echo "x Missing Cloudinary fields. Expected 1Password fields: username, credential."
  exit 1
fi

echo "Validating Cloudinary credentials for cloud '$CLOUD_NAME'..."
CODE="$(
  curl -sS -o /dev/null -w '%{http_code}' \
    -u "$API_KEY:$API_SECRET" \
    "https://api.cloudinary.com/v1_1/$CLOUD_NAME/usage" || true
)"

if [ "$CODE" != "200" ]; then
  echo "x Cloudinary rejected the credentials or cloud name (HTTP $CODE). Nothing written."
  exit 1
fi

touch "$ENV_FILE"
tmp="$(mktemp)"
grep -v -E '^(CLOUDINARY_CLOUD_NAME|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET)=' "$ENV_FILE" > "$tmp" || true
{
  cat "$tmp"
  printf 'CLOUDINARY_CLOUD_NAME=%s\n' "$CLOUD_NAME"
  printf 'CLOUDINARY_API_KEY=%s\n' "$API_KEY"
  printf 'CLOUDINARY_API_SECRET=%s\n' "$API_SECRET"
} > "$ENV_FILE"
rm -f "$tmp"
chmod 600 "$ENV_FILE" 2>/dev/null || true

unset API_KEY API_SECRET

echo "✓ Validated and written to $ENV_FILE (values not printed)."
echo "→ Restart the harness dev server so Next loads the updated env."
