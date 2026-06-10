#!/usr/bin/env bash
# Sequential driver for the A/B/C bake-off. Each invocation runs a bounded slice
# with internal concurrency + a resume guard, so re-running is idempotent.
set -uo pipefail
cd "$(dirname "$0")/.."

run() {
  local arm="$1" off="$2" lim="$3" extra="${4:-}"
  npx tsx scripts/run-classifier-abc.ts --arm "$arm" --offset "$off" --limit "$lim" --concurrency 4 $extra >/dev/null 2>&1
  local rc=$?
  local file="research/classifier-abc-2026-06-04/arm-${arm}-results.jsonl"
  [ -n "$extra" ] && file="research/classifier-abc-2026-06-04/arm-${arm}-variance.jsonl"
  local n; n=$(wc -l < "$file" 2>/dev/null | tr -d ' ')
  echo "CHUNK arm=$arm off=$off lim=$lim rc=$rc rows=$n"
}

# Arm A: full 98 in chunks of 14 (concurrency 4 inside each).
for off in 0 14 28 42 56 70 84; do run A "$off" 14; done
echo "ARM_A_DONE rows=$(wc -l < research/classifier-abc-2026-06-04/arm-A-results.jsonl | tr -d ' ')"

# Arm B: full 98 in chunks of 20.
for off in 0 20 40 60 80; do run B "$off" 20; done
echo "ARM_B_DONE rows=$(wc -l < research/classifier-abc-2026-06-04/arm-B-results.jsonl | tr -d ' ')"

# Variance: 12-item subset, twice, arms A and C.
run A 0 12 "--variance --pass 1"
run A 0 12 "--variance --pass 2"
run C 0 12 "--variance --pass 1"
run C 0 12 "--variance --pass 2"
echo "VARIANCE_DONE"
echo "ALL_DONE"
