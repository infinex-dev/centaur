# Audit B — `harness/` ground-truth state

**Date:** 2026-05-25
**Operator question:** Did Codex land Phase 2 + Phase 3? Reference docs (CLAUDE.md) claim only Phase 1 is scaffolded.
**Verdict:** **YES — Phase 3 is BUILT end-to-end and functional.** CLAUDE.md is stale.

---

## Headline

- The full Phase 3 implementation defined in `harness/HANDOFF-SPEC.md` was landed in a single git commit on 2026-05-22 (`22367ae Wire active audit state into harness`). The pre-existing CLAUDE.md status ("Phase 1 scaffolded 2026-05-19") predates that commit.
- Subsequent commit `bacb67d Strengthen grounder mechanics discovery` (2026-05-22) refined the grounder.
- The dev server boots on port **3210**, returns HTTP 200 on `/` and on `/cards/<id>`, and renders all four stage panels with live DB-backed data.
- 4,289 LOC of real TypeScript across `app/`, `components/`, `lib/`. No "TODO stub" placeholders in any action file.
- Live DB (`harness/harness.db`, 421 KB, last modified 2026-05-22) already contains 2 cards, 49 grounded facts, 8 grounder runs, 24 generated candidates, and 12 active-validator audits. The harness has been *used*, not just scaffolded.

The only thing the operator *hasn't* yet done in the DB is **make any operator decisions** (0 rows in `candidate_decisions`, 0 in `fact_edits`, 0 in `release_card_edits`, 0 in `agreement_snapshots`). The decision-capture machinery is fully wired; it just hasn't been exercised against this corpus yet.

---

## Phase-by-phase status

`HANDOFF-SPEC.md` defines a single Phase 3 (Codex's "make it actually work end-to-end"). I'm decomposing it against the spec's 12 numbered deliverables in §9.

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 1 | `lib/db.ts` extended | **BUILT** | `harness/lib/db.ts:1-66` — WAL mode, FK on, ULID `newId()`, `writeTx()`, schema-init runner, CLI `pnpm db:init` |
| 2 | `lib/diff.ts` (3 modes) | **BUILT** | `harness/lib/diff.ts:1-184` — `makeFieldDiff` (Mode A), `makeTextDiff` w/ `diffWords` (Mode B), `makeSemanticShifts` (Mode C), plus `getPathValue`/`setPathValue` for path-based edits |
| 3 | `lib/card-builder.ts` | **BUILT** | `harness/lib/card-builder.ts:1-158` — Sonnet (`claude-sonnet-4-6`) prompt that builds ReleaseCard JSON from brief + facts; calls `buildDeployedFacts()`, retries on Zod failure, returns parsed `ReleaseCard` |
| 4 | `lib/classifier-wrapper.ts` | **BUILT** | `harness/lib/classifier-wrapper.ts:1-35` — exposes `classifyText()` using `auditBeats` + `classifyTempoBlind` from `@pipeline/validator` (extracted from `scripts/classify-corpus.ts` logic via the shared validator module) |
| 5 | `app/actions/research.ts` | **BUILT** | `harness/app/actions/research.ts:1-264` — `createCard`, `runGrounder` (persists `grounder_runs` with `events_json` trace), `decideFact` (writes `fact_edits` rows per changed field via `makeFieldDiff`), `addManualFact`, `approveResearch` (clears downstream artifacts via `clearResearchDownstream`) |
| 6 | `app/actions/card.ts` | **BUILT** | `harness/app/actions/card.ts:1-151` — `buildReleaseCard`, `editReleaseCard` (writes one `release_card_edits` row per changed field, validates via `parseReleaseCard`), `approveCard` |
| 7 | `app/actions/generate.ts` | **BUILT** | `harness/app/actions/generate.ts:1-383` — `runGenerator` calls `generate()` + `validate()`, persists candidates with `validation_passed`/`validation_failures_json`/`beat_audit_json`; `decideCandidate` fires Mode B text diff and Mode C semantic re-classification on `action='edit'`; `retryChannel` with 3-attempt cap; supports active-validator + history-guard orchestration when `HARNESS_ACTIVE_VALIDATOR=1` |
| 8 | `app/actions/ship.ts` | **BUILT** | `harness/app/actions/ship.ts:1-128` — `approvePick` (upserts `final_picks`), `shipPick` (clipboard / Slack webhook / x / in-product log), `abandonCard`, `completeCard` (verifies all expected channels) |
| 9 | `app/actions/agreement.ts` | **BUILT** | `harness/app/actions/agreement.ts:1-216` — `recomputeAgreement(window_days=7)` writes top-level + per-beat + per-fact-source snapshots; `getAgreement` reads latest. Counts `approved_as_is` / `edited` / `rejected` per §4.2; per-beat uses `candidate_semantic_edits.shifted_beats_json` per §4.3 |
| 10 | Wire actions into components | **BUILT** | `components/FactsTable.tsx` calls `runGrounder`/`decideFact`/`approveResearch`/`addManualFact` w/ `useTransition`; `CardEditor.tsx` calls `buildReleaseCard`/`editReleaseCard`/`approveCard`; `CandidateCard.tsx` calls `decideCandidate`/`approvePick`; `GenerateControls.tsx` calls `runGenerator`; `ShipPanel.tsx` calls `shipPick`/`completeCard`; `RecomputeAgreementButton.tsx` calls `recomputeAgreement` |
| 11 | Edit flows + keyboard handlers | **PARTIAL** | Inline edit experience present in `FactsTable.tsx` and `CandidateCard.tsx` (textarea + save + cancel). Keyboard handlers (`j/k/a/e/x/r/n`) — I did not find dedicated `useEffect`/`onKeyDown` wiring. Edits via mouse work; vim-style nav not in scope of the committed code. |
| 12 | Migration system | **MISSING (deferred per spec)** | No `lib/migrations.ts` and no `migrations/` directory. Spec §1.4 marks this as "defer if time is tight." Schema is single-file (`lib/schema.sql`), idempotently applied on every `getDb()` via `ensureSchema()` (`db.ts:51-56`). |

### Streaming (spec §6) — explicitly out of scope in MVP

- `runGrounder({ stream: true })` throws `'Grounder streaming is not implemented in Phase 3 MVP'` (`research.ts:32-34`). Non-streaming path persists per-turn events to `grounder_runs.events_json` instead, which the UI reads back after the call completes. Spec marks streaming "medium priority, UI should work without it."
- `runGenerator` streaming also not implemented (spec calls it "lower priority").

### Beyond-spec additions (post-Codex hardening, committed 22367ae)

Both came from post-Codex fix passes documented in `harness/CODEX-FIXES.md` and `harness/HANDOVER-2026-05-20-CODEX-FIX-PASS.md`:

- **`lib/stage-reset.ts`** — FK-safe downstream cleanup on re-approval (`clearCardDownstream`, `clearResearchDownstream`). Wired into `approveResearch`, `buildReleaseCard`, `editReleaseCard`, `approveCard`.
- **`candidate_audits` table** + `app/actions/generate.ts` active-validator path — orchestrates via `orchestrateActiveWithRetries` when `HARNESS_ACTIVE_VALIDATOR=1`, persists `active_audit_json` + `history_guard_json` per candidate. 12 audit rows in the live DB.
- Grounder hardening: `fetch_infinex_page` URL whitelist, `fetch_json_api` host allowlist, symlink-escape guards.

---

## Spec §11 sanity checks — pass/fail against live state

- [x] `pnpm install && pnpm dev` boots cleanly. Verified — HTTP 200 on `/` (24,348 b) and `/cards/01KS1CNF123GNFQBAV4S1P5VT0` (195,950 b).
- [x] `pnpm db:init` creates `harness.db` with all tables. Verified — 14 tables present (cards, facts, fact_edits, grounder_runs, release_cards, release_card_edits, candidates, candidate_audits, candidate_decisions, candidate_text_edits, candidate_semantic_edits, final_picks, agreement_snapshots, stage_durations).
- [x] Creating a card via the UI persists it. 2 real cards in DB, queue page lists both.
- [x] Running the grounder populates the facts table. 8 grounder runs recorded, 49 facts. Most facts still `status='pending'` — never decided on.
- [ ] Approving / editing / rejecting a fact captures the decision — *machinery built but 0 `fact_edits` rows so unexercised in this corpus.*
- [x] Building the release card produces valid Zod-parsed `ReleaseCard` JSON. 2 release_cards rows.
- [ ] Editing the release card captures field-path diffs — *machinery built (`release_card_edits` table + `editReleaseCard` writes), 0 rows so unexercised.*
- [x] Running the generator produces candidates with beat-audit data. 24 candidates, all with `beat_audit_json` and `declared_beats_json` populated.
- [ ] Approving a candidate creates a `final_picks` row — *machinery built, 0 rows.*
- [ ] Editing a candidate captures the text-diff + semantic re-classification — *machinery built (`candidate_text_edits` + `candidate_semantic_edits` tables, both wired in `decideCandidate`), 0 rows.*
- [ ] Recomputing agreement metrics produces snapshots — *machinery built, button present (`RecomputeAgreementButton.tsx`), 0 `agreement_snapshots` rows because no decisions have been captured to count.*
- [x] Agreement dashboard displays them. Component renders; with 0 snapshots it shows "No agreement snapshots yet."

The pattern: every "decision-side" check is unexercised because the operator hasn't yet sat down and walked a card through end-to-end. The implementation is there.

---

## Live boot verification

```
$ cd harness && pnpm dev   # next dev -p 3210
... ready in ~2s ...
$ curl http://localhost:3210/
HTTP 200 24348b in 0.32s
$ curl http://localhost:3210/cards/01KS1CNF123GNFQBAV4S1P5VT0
HTTP 200 195950b
```

Headings present on `/`:
- `<title>comms-factory · harness</title>`
- `Agreement · 7-day rolling · Infinex voice`
- `Cards` list, 2 cards both "in progress"

Panels present on `/cards/<id>`:
- `Research — fact grounding`
- `Card — release card assembly`
- `Generate — caption candidates`
- `Ship — final picks`

Server killed after verification.

---

## Git timeline

```
22367ae  2026-05-22  Wire active audit state into harness     [Phase 3 BIG BANG: all 4289 LOC]
bacb67d  2026-05-22  Strengthen grounder mechanics discovery
```

Phase 1 scaffolding was never separately committed — the entire harness (Phase 1 + 3 + Codex fixes + active-validator wiring) shipped in one commit. The CLAUDE.md status line "Phase 1 scaffolded 2026-05-19" reflects pre-commit context that was overwritten by the 2026-05-22 single-shot land.

---

## Bottom line

**Did Codex land Phase 2 + Phase 3?** **Yes.** All 12 §9 deliverables are present and functional. Only deferred items are migration system (spec allows) and keyboard nav (not load-bearing). Streaming is intentionally not implemented per spec priority. Active-validator + history-guard wiring is *beyond* the original Phase 3 spec — a post-Codex hardening pass landed simultaneously.

**What's stale:** `CLAUDE.md`'s "Training harness at `harness/` (Phase 1 scaffolded 2026-05-19)" line and the "Pending: Harness Phase 2 (pipeline wiring) + Phase 3 (persistence, diff capture, agreement metrics) — Codex pass" bullet. Both should be updated to reflect Phase 3 BUILT, awaiting operator decision-capture sessions to start producing agreement-snapshot data.

**What's MISSING from Phase 3 spec:**
- `lib/migrations.ts` + `migrations/` directory (deferred per spec §1.4)
- Vim-style keyboard nav (`j/k/a/e/x/r/n`) — only the buttons exist (spec §9.11)
- `runGrounder` streaming (spec §6, marked "medium priority")
- `runGenerator` streaming (spec §6, marked "lower priority")

**What's untested by usage** (the implementation is wired; the operator just hasn't driven a card all the way through yet to populate these tables):
- `fact_edits` (0 rows)
- `release_card_edits` (0 rows)
- `candidate_decisions` (0 rows)
- `candidate_text_edits` (0 rows)
- `candidate_semantic_edits` (0 rows)
- `final_picks` (0 rows)
- `agreement_snapshots` (0 rows)
