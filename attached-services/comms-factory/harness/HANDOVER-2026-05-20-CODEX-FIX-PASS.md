# Handover - Codex fix pass - 2026-05-20

## Scope

Fixed the post-Claude review issues around failed grounder visibility, downstream artifact invalidation, and grounder tool hardening.

## Changes made

- Added `harness/lib/stage-reset.ts` with FK-safe downstream cleanup:
  - `clearCardDownstream()` deletes `final_picks`, candidate edit logs, candidate decisions, and candidates.
  - `clearResearchDownstream()` also deletes `release_card_edits` and `release_cards`.
- Updated `approveResearch()` to clear release-card/generate/ship artifacts in the same transaction as the new approval timestamp.
- Updated `buildReleaseCard()`, `editReleaseCard()`, and `approveCard()` so rebuilding/editing/re-approving a card clears generated candidates and final picks instead of leaving stale outputs attached.
- Added browser confirms for re-approving research/card and for rebuilding/saving an already-approved release card.
- Added `router.refresh()` in the grounder error catch path so failed grounder runs surface their persisted trace.
- Hardened grounder tools:
  - `fetch_infinex_page` now only accepts `https://infinex.xyz` URLs/paths.
  - `fetch_json_api` is now host-allowlisted. Defaults: `api.hyperliquid.xyz`, `clob.polymarket.com`, `gamma-api.polymarket.com`. Override with `FACT_GROUNDER_JSON_API_ALLOWLIST`.
  - platform code reads/searches now use `realpath` containment checks to catch symlink escapes, not just lexical `startsWith`.
- Added regression tests for path escape rejection, Infinex URL rejection, and `fetch_json_api` allowlist rejection.
- Changed harness `typecheck` script to `next typegen && tsc --noEmit` so it works after `.next` cleanup.

## Verification

Passing:

```bash
pnpm test
pnpm typecheck
pnpm --dir harness db:init
pnpm --dir harness typecheck
pnpm --dir harness build
```

Observed test count after this pass: 148 tests passing.

Runtime smoke:

```bash
curl -I http://localhost:3210
curl -I http://localhost:3210/cards/01KS1CNF123GNFQBAV4S1P5VT0
```

Both returned `200 OK`.

## Runtime state

Harness dev server is running at:

```text
http://localhost:3210
```

I cleaned `.next` and restarted dev after `next build` to avoid mixed build/dev artifacts.

## Notes for next agent

- The reset behavior deletes downstream artifacts because the schema has no version or `superseded_at` column. This is now recorded as item 9 in `harness/SPEC-QUESTIONS.md`.
- If preserving every stale downstream row as training signal matters, add versioning/superseded columns later and update agreement queries to filter to the active stage version.
- `fetch_json_api` is intentionally allowlisted. Add hosts through `FACT_GROUNDER_JSON_API_ALLOWLIST` rather than relaxing back to a denylist.
- `better-sqlite3` was rebuilt locally once because the installed native binary had the wrong Node ABI for the Node process running Next.
