#!/usr/bin/env bash
# Copy Cloudinary upload credentials from generated platform env files into
# harness/.env.local without printing secret values.
#
# Usage:
#   ./harness/scripts/set-cloudinary-creds-from-platform.sh
#   PLATFORM_ROOT=/path/to/platform ./harness/scripts/set-cloudinary-creds-from-platform.sh
set -euo pipefail

HARNESS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$HARNESS_ROOT/.env.local"
PLATFORM_ROOT="${PLATFORM_ROOT:-/Users/opaque/platform}"

if [ ! -d "$PLATFORM_ROOT" ]; then
  echo "x Platform root not found: $PLATFORM_ROOT"
  exit 1
fi

CANDIDATE_LIST="$(mktemp)"
trap 'rm -f "$CANDIDATE_LIST"' EXIT

find "$PLATFORM_ROOT" -maxdepth 4 -type f \
  \( -name ".env" -o -name ".env.*" -o -name ".*.vars" -o -name "*.vars" \) \
  ! -name "*.template" \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  | sort > "$CANDIDATE_LIST"

CANDIDATE_COUNT="$(wc -l < "$CANDIDATE_LIST" | tr -d ' ')"

find_line() {
  local key="$1"
  local file line
  while IFS= read -r file; do
    line="$(grep -m 1 -E "^${key}=" "$file" 2>/dev/null || true)"
    if [ -n "$line" ]; then
      printf '%s\t%s\n' "$file" "$line"
      return 0
    fi
  done < "$CANDIDATE_LIST"
  return 1
}

hit_cloud_name="$(find_line CLOUDINARY_CLOUD_NAME || true)"
hit_api_key="$(find_line CLOUDINARY_API_KEY || true)"
hit_api_secret="$(find_line CLOUDINARY_API_SECRET || true)"

source_cloud_name=""
source_api_key=""
source_api_secret=""
line_cloud_name=""
line_api_key=""
line_api_secret=""

if [ -n "$hit_cloud_name" ]; then
  source_cloud_name="${hit_cloud_name%%$'\t'*}"
  line_cloud_name="${hit_cloud_name#*$'\t'}"
fi
if [ -n "$hit_api_key" ]; then
  source_api_key="${hit_api_key%%$'\t'*}"
  line_api_key="${hit_api_key#*$'\t'}"
fi
if [ -n "$hit_api_secret" ]; then
  source_api_secret="${hit_api_secret%%$'\t'*}"
  line_api_secret="${hit_api_secret#*$'\t'}"
fi

missing=""
if [ -z "$line_api_key" ]; then missing="$missing CLOUDINARY_API_KEY"; fi
if [ -z "$line_api_secret" ]; then missing="$missing CLOUDINARY_API_SECRET"; fi

if [ -n "$missing" ]; then
  echo "x Missing required Cloudinary key(s):${missing}"
  echo "  Run platform secret pull first, for example:"
  echo "  cd $PLATFORM_ROOT && just auth-google && just secrets-pull"
  echo "  Searched $CANDIDATE_COUNT generated env file(s)."
  exit 1
fi

if [ -z "$line_cloud_name" ]; then
  line_cloud_name="CLOUDINARY_CLOUD_NAME=infinex"
  source_cloud_name="harness default"
fi

touch "$ENV_FILE"
tmp="$(mktemp)"
grep -v -E '^(CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET|CLOUDINARY_CLOUD_NAME)=' "$ENV_FILE" > "$tmp" || true
{
  cat "$tmp"
  printf '%s\n' "$line_cloud_name"
  printf '%s\n' "$line_api_key"
  printf '%s\n' "$line_api_secret"
} > "$ENV_FILE"
rm -f "$tmp"
chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "✓ Wrote Cloudinary keys to $ENV_FILE (values not printed)."
echo "  CLOUDINARY_CLOUD_NAME <- $source_cloud_name"
echo "  CLOUDINARY_API_KEY <- $source_api_key"
echo "  CLOUDINARY_API_SECRET <- $source_api_secret"
echo "→ Restart the harness dev server so Next loads the updated env."
