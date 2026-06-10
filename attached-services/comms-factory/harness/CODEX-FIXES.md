# Codex fix pass — two items

## 1. Grounder trace not surfacing after failed run

**File:** `harness/components/FactsTable.tsx` (around line 89)

**Problem:** When `runGrounder` throws (e.g. 0 facts returned), the client sets `setError(...)` but does NOT call `router.refresh()`. The latest grounder run (with its error field set in the DB) is therefore never fetched — the operator sees the error toast but no trace.

**Fix:** Call `router.refresh()` in the catch block of `runFactGrounder()`, after `setError`.

Also check: the server page that renders `FactsTable` should pass the `latestGrounderRun` from the DB. Confirm the DB query fetches the run even when `error` is set (not just successful runs).

---

## 2. Stale downstream artifacts on re-approval

**Files:** `harness/app/actions/research.ts` (approveResearch ~line 211), `harness/app/actions/card.ts` (approveCard ~line 100)

**Problem:** Re-opening/re-approving an earlier stage leaves downstream artifacts in place:
- `approveResearch` nulls `research_approved_at` but leaves existing `release_cards`, `candidates`, and `final_picks`
- `approveCard` similarly leaves old `candidates` and `final_picks`

This means agreement metrics and ship state can reflect a stale card version.

**Fix:** Wrap each re-approval in a transaction that also deletes (or marks `superseded`) the downstream artifacts for that card. Specifically:
- `approveResearch`: delete `release_cards`, `candidates`, `candidate_decisions`, `final_picks` for `card_id` before clearing the timestamp
- `approveCard`: delete `candidates`, `candidate_decisions`, `final_picks` for `card_id` before clearing the timestamp
- `agreement_snapshots` can stay — they're historical

Check that `schema.sql` and the query mappers have no FK constraints that would block the deletes (or add `ON DELETE CASCADE` if appropriate).

---

## Checks to run after fixing

```bash
# from harness/
pnpm typecheck
pnpm build

# from repo root
pnpm test
```

Do not change `harness/lib/schema.sql` column/table names or `harness/lib/types.ts` field names without flagging — downstream components bind to those.
