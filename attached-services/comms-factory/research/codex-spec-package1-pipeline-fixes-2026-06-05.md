# Codex Spec — Package 1: comms-factory pipeline fixes (2026-06-05)

P0-correctness + perf fixes for the comms-factory actor-director pipeline. The launch COPY is already shipped;
these fix the pipeline/harness, not the copy.

---

## Ground rules for Codex

- **Language / tsconfig.** The repo is TypeScript. `tsconfig.json` runs `strict: true`, `exactOptionalPropertyTypes: true`,
  `noUncheckedIndexedAccess: true`. Consequences you MUST honor:
  - Optional fields (e.g. `DirectorNotes.change?` at `src/actor-director.ts:185`) cannot be dot-read without an optional-chain or guard — `notes.change.copy` is a hard "Object is possibly undefined" error. Use `notes.change?.copy` or don't touch it.
  - Indexed access (`arr[i]`, `record[key]`) yields `T | undefined`; guard before use.
- **Test command.** From `package.json`: `pnpm test` (= `vitest run`). Typecheck: `pnpm typecheck` (= `tsc --noEmit`).
  Harness typecheck/build: `pnpm typecheck:harness` / `pnpm build:harness` (NOT `pnpm --filter ./harness …` — there is no `pnpm-workspace.yaml` at the repo root). **All existing tests must stay green.**
- **Every validator rule needs positive + negative tests.** Project hard rule: no validator rule lands without a positive case and a negative case in `src/__tests__/validator.test.ts`.
- **Em-dash zero-tolerance is INTENTIONAL.** `EM_DASH_MAX_PER_WINDOW = 0` (`src/validator.ts:123`) is a locked operator decision (2026-05-25). Do NOT relax it; do NOT add a unit that depends on em-dashes passing.
- **Do not alter locked voice/spec behavior.** No edits to `src/voice/*`, no changes to tempo/Laban classification thresholds, no widening of the slop/allergen rules beyond the one targeted carousel-ordinal fix (Unit 4).
- **Minimal, targeted changes only.** Edit the named regions; don't refactor adjacent code.
- **Director verdicts must be byte-identical after the perf change.** Caching + parallelization (Unit 3) must change ONLY timing and token cost — never the inputs to any single audit, never the verdict, never candidate order in `records`.

---

## Build order

All four units have `depends_on: []` and edit largely non-overlapping regions, but Units 1 and 3 both edit the
same function `orchestrateActorDirectorWithRetries` in `src/actor-orchestrator.ts`, so land them carefully and
re-read line numbers after each lands.

1. **Unit 4 — `validator-carousel-numbering`** (isolated to `src/validator.ts` + `src/__tests__/validator.test.ts`; no orchestrator overlap; smallest blast radius — do first).
2. **Unit 2 — `wire-grounder-harness`** (isolated to `harness/app/actions/generate.ts`; no overlap with the others).
3. **Unit 3 — `director-perf-cache-parallel`** (edits `src/actor-director.ts` + the candidate loop at `src/actor-orchestrator.ts:348-404`; `records` is fully populated before line 406).
4. **Unit 1 — `orchestrator-retry-zero-pass`** (edits `src/actor-orchestrator.ts` at line ~246 and ~438-440 + a helper after ~1133). Land LAST: it reads a complete `records` regardless of how Unit 3 parallelizes the candidate loop. Non-overlapping regions with Unit 3, but both touch the same function — apply against the post-Unit-3 file and re-confirm insertion points.

---

## Unit 1 — Make any channel that ends a round with zero passing candidates ALWAYS trigger a bounded targeted regeneration (driven by its validation/Director failures, not only grounder fact-answers), with a first-class run event and a once-per-channel cap

**id:** `orchestrator-retry-zero-pass`

### Files
- `src/actor-orchestrator.ts` — edit
- `src/__tests__/actor-director.test.ts` — test
- `src/actor-director.ts` — reference

### Problem
The Actor/Director retry loop lives in `orchestrateActorDirectorWithRetries` at `src/actor-orchestrator.ts:224`. Its only success exit is at `src/actor-orchestrator.ts:431`:

```ts
      if (picks.length >= channels.length) {
        ...
        return { attempts, picks, selection_rationales: rationales, exhausted: false };
      }
```

When `picks.length < channels.length` (e.g. carousel produced ZERO passing candidates because every carousel candidate failed `validateCandidate` regex/structure/length/movement, or was rejected by the blind Director), the function does NOT return. The only feedback machinery that runs immediately after, before the loop falls through to the next attempt, is the AUDIT-TRIGGERED grounder back-edge at `src/actor-orchestrator.ts:446`:

```ts
      if (opts.grounder && !auditBackEdgeDone && grounderRounds < MAX_GROUNDER_ROUNDS && attemptNo < maxAttempts) {
        const requests = dedupeNewRequests(
          collectFactRequests(actorResult.output.table_work.fact_requests, records),
          askedQuestions,
        );
        if (requests.length > 0) {
          auditBackEdgeDone = true;
          const merged = await runFactRequestRound(opts, "audit", attemptNo, requests, currentCard);
          ...
        }
      }
```

This block is gated on `opts.grounder` being supplied AND `collectFactRequests(...)` (defined at `src/actor-orchestrator.ts:1106`) returning at least one request. A channel that fails purely on script-validation (a cliche, a length overflow, a structure error, a movement-receipt miss) or on a Director voice/legal rejection emits NO `fact_requests`, so `collectFactRequests` returns `[]`, `requests.length > 0` is false, and this back-edge does nothing.

The loop then falls through to the next `for (attemptNo)` iteration (loop opens at `src/actor-orchestrator.ts:255`). On that next iteration the Actor IS re-run via `runActor()` (`src/actor-orchestrator.ts:263`) with `director_notes` from `summarizeDirectorNotes` (reassigned into `notes` at `src/actor-orchestrator.ts:407`, fed back as `notesIn` at `src/actor-orchestrator.ts:256` / `:275`). So a multi-attempt run does technically regenerate, AND that regeneration already carries the per-channel failure reasons.

**IMPORTANT — what `summarizeDirectorNotes` already does (so this spec is not framed on a false premise):** `summarizeDirectorNotes` at `src/actor-orchestrator.ts:854` ALREADY pushes per-channel failure reasons into the `notes` that feed the next attempt. Specifically:
- a `Missing valid performances for channels: <list>.` line + `change.copy` entry for any unpicked channel (`src/actor-orchestrator.ts:874-877`);
- for each script-validation failure, a `"<channel>: regex/format rejected ..."` line plus a routed `change.movement` / `change.facts` / `change.format` entry (`src/actor-orchestrator.ts:879-895`);
- for each Director draft rejection, a `"<channel>: Director read ..."` line, the `notes_for_actor` lines, and routed `change.facts` / `change.voice` / `change.movement` entries (`src/actor-orchestrator.ts:896-915`).

So the genuinely-missing behavior is NOT "feed the failure reasons forward" (that exists). The two real defects relative to the requested behavior are:

1. **NO FIRST-CLASS CONTRACT / OBSERVABILITY** that ties "this channel ended the round with 0 picks due to script-validation/Director failures (not a fact hole)" to "a bounded regeneration was spent on it." The regeneration is purely a side effect of the loop continuing; there is no run event naming the zero-pick channel(s) being targeted, and no asserted once-per-run cap on that targeting. The only first-class, channel-scoped, observable feedback path in the file is the grounder back-edge (with its `channel_*`-style events and `auditBackEdgeDone` once-flag) — and it declines to fire for plain validation/Director failures.

2. **With `maxAttempts: 1`** (the configuration used by the existing test at `src/__tests__/actor-director.test.ts:435-476`, where a single `x` candidate "A game-changing launch." fails `rejectCliches`), the run ends `exhausted: true`, `picks: 0`, with NO regeneration attempt at all — confirmed by that test asserting `result.picks).toHaveLength(0)` and only one actor call. That is correct and must stay correct (no regeneration is possible when no attempt remains), but the system has no explicit guard documenting that a zero-pick channel SHOULD get a bounded retry whenever an attempt does remain.

**Net effect the operator wants closed:** a fully-failed channel should not be silently dropped into the generic loop-continuation with no signal; it should ALWAYS, when `attemptNo < maxAttempts`, trigger a first-class, observable, once-per-channel targeted-regeneration pass driven by its actual validation/Director failure reasons. The feed-forward of those reasons already happens via `notes`; this spec adds the missing contract, observability, and cap around it — it does NOT re-plumb the reasons into `notes` a second time.

### Change
Add an explicit, validation/Director-failure-driven targeted-regeneration pass that runs at the end of each attempt's processing, AFTER the success-return check at `src/actor-orchestrator.ts:431` (block closes at `:438`) and BEFORE the audit-triggered grounder back-edge comment at `src/actor-orchestrator.ts:440`. The pass detects zero-pick channels that failed for a concrete (non-fact-hole) reason, caps each channel to one targeted regeneration per run, and emits a first-class `channel_regeneration_targeted` run event. It does NOT call the Actor itself and does NOT mutate `notes` — the existing loop-continuation plus `summarizeDirectorNotes`-populated `notes` (already reassigned at `:407` BEFORE this pass) carries the per-channel failure reasons into the next `runActor()`. Do NOT alter the existing grounder back-edge logic, the success-return, `summarizeDirectorNotes`, or `runActor`.

**WHY no `notes` mutation (decided to avoid two-engineer divergence):** `summarizeDirectorNotes` (`src/actor-orchestrator.ts:874-915`) already pushes every script-validation reason and Director failure reason — including `notes_for_actor` and the missing-channel `change.copy` entry — into the `notes` that the next attempt's `runActor()` receives via `notesIn`. Re-annotating `notes`/`change.copy` here would double-feed identical text. This spec therefore keeps the net-new surface minimal: the run event, the once-per-channel cap, and the `attemptNo < maxAttempts` guard. (`DirectorNotes.change` is also OPTIONAL — `change?: {...}` at `src/actor-director.ts:185-192` — so any code that dot-read `notes.change.copy` would be a hard compile error under this repo's `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` tsconfig. Not mutating `notes` removes that hazard entirely.)

**EXACT IMPLEMENTATION:**

**Step 1 — Confirm `maxAttempts`.** It is declared at `src/actor-orchestrator.ts:230`:
```ts
  const maxAttempts = opts.maxAttempts ?? 3;
```
Unchanged. The new pass must respect it: never target a regeneration when `attemptNo >= maxAttempts`.

**Step 2 — Add and EXPORT a helper `collectChannelFailureFeedback`** near `collectFactRequests` (insert after the `collectFactRequests` function that ends at `src/actor-orchestrator.ts:1133`, matching the existing `export function collectFactRequests` style at `:1106`). It computes, for a given set of channels and the attempt's records, a per-channel list of human-readable failure reasons drawn from `script_validation.failures` (rule + reason) and, when the Director rejected the draft, the Director audit's `voice_issues`, `factual_issues`, `publication_gate_issues`, and `notes_for_actor`:
```ts
/**
 * Build per-channel failure feedback for channels that ended a round with zero
 * passing candidates. Pulls every reason from script validation (regex / format
 * / length / structure / movement) and the blind Director audit. Used by the
 * targeted-regeneration pass to (a) decide a zero-pick channel has a concrete,
 * non-fact-hole reason worth one more bounded attempt, and (b) surface those
 * reasons on the channel_regeneration_targeted run event. The reasons are ALSO
 * already fed to the next Actor attempt via summarizeDirectorNotes -> notes; this
 * helper does not duplicate that feed, it only gates + reports.
 */
export function collectChannelFailureFeedback(
  channels: Channel[],
  records: ActorDirectorCandidateRecord[],
): Partial<Record<Channel, string[]>> {
  const out: Partial<Record<Channel, string[]>> = {};
  for (const channel of channels) {
    const reasons: string[] = [];
    for (const record of records) {
      if (record.candidate.channel !== channel) continue;
      for (const failure of record.script_validation.failures) {
        reasons.push(`script ${failure.rule}: ${failure.reason}`);
      }
      const audit = record.director_audit;
      if (audit && !directorDraftPassed(audit)) {
        for (const issue of audit.voice_issues) reasons.push(`voice: ${issue}`);
        for (const issue of audit.factual_issues) reasons.push(`factual: ${issue}`);
        for (const issue of audit.publication_gate_issues) reasons.push(`publication-gate: ${issue}`);
        for (const note of audit.notes_for_actor) reasons.push(`director: ${note}`);
      }
    }
    if (reasons.length > 0) out[channel] = [...new Set(reasons)].slice(0, 12);
  }
  return out;
}
```
Notes on field names and the publication-gate coupling:
- `directorDraftPassed` is defined at `src/actor-orchestrator.ts:1097-1098` and is in-module; reference it directly.
- `directorDraftPassed(audit)` = `audit.copy_voice_passed && audit.factual_passed && audit.infinex_fit.legal` and DOES NOT include `audit.publication_gate_passed`. Consequence (state this so engineers don't treat it as a bug): a candidate that fails ONLY the publication gate still has `directorDraftPassed(audit) === true`, so it is a PICK (see `pickRankedPassingByChannel`, `src/actor-orchestrator.ts:644-649`) and that channel is therefore NOT zero-pick, so it never reaches this helper for that channel. The `publication-gate:` reason line above will only ever appear when SOME OTHER draft gate (voice/factual/legal) also failed on the same candidate. This is intended.
- `audit.voice_issues`, `audit.factual_issues`, `audit.publication_gate_issues`, `audit.notes_for_actor` are the same `DirectorAuditResult` fields the orchestrator already reads at `src/actor-orchestrator.ts:397-401`, so the names are correct against `src/actor-director.ts`.

**Step 3 — Add a run-scoped budget tracker** so each channel gets AT MOST one targeted regeneration per run (mirroring the grounder back-edge's `auditBackEdgeDone` once-semantics, and bounding work). Immediately after the existing `MAX_GROUNDER_ROUNDS` declaration at `src/actor-orchestrator.ts:246`, add:
```ts
  const targetedRetriedChannels = new Set<Channel>();
```

**Step 4 — Insert the new pass** between the success-return block (closing `}` of the `if (picks.length >= channels.length)` block on `src/actor-orchestrator.ts:438`) and the `// ── Phase 1: AUDIT-TRIGGERED back-edge` comment that begins at `src/actor-orchestrator.ts:440`. Insert exactly:
```ts
      // ── Targeted regeneration for zero-pick channels ─────────────────────────
      // A channel can end a round with ZERO passing candidates purely on script
      // validation (cliche, length, structure, movement) or a Director voice/legal
      // rejection, with NO fact_request to feed the grounder back-edge below. Its
      // failure reasons are already fed forward to the next attempt by
      // summarizeDirectorNotes (-> notes -> notesIn -> runActor). What was missing
      // is a first-class, observable, once-per-channel contract that a bounded
      // regeneration is actually being spent on that channel. This pass adds that:
      // it does NOT call the Actor and does NOT mutate notes; it records the
      // targeting and emits an event, then lets the loop continue.
      if (attemptNo < maxAttempts) {
        const pickedChannels = new Set(picks.map((pick) => pick.channel));
        const zeroPickChannels = channels.filter(
          (channel) => !pickedChannels.has(channel) && !targetedRetriedChannels.has(channel),
        );
        const feedback = collectChannelFailureFeedback(zeroPickChannels, records);
        const retryChannels = zeroPickChannels.filter((channel) => (feedback[channel]?.length ?? 0) > 0);
        if (retryChannels.length > 0) {
          for (const channel of retryChannels) targetedRetriedChannels.add(channel);
          await emitRunEvent(opts.onEvent, {
            attempt: attemptNo,
            event_type: "channel_regeneration_targeted",
            message: `Targeting bounded regeneration for zero-pick channel(s): ${retryChannels.join(", ")}`,
            payload: {
              channels: retryChannels,
              feedback: retryChannels.map((channel) => ({ channel, reasons: feedback[channel] ?? [] })),
            },
          });
        }
      }
```

**RATIONALE FOR THIS SHAPE (so two engineers implement identically):**
- The pass does NOT call `runActor()`. It guarantees the loop will continue (it sits before the `for` body ends, and the only early return is the success case on `:431`/`:437`). The next iteration's `runActor()` (`:263`, fed `notesIn = notes`) already carries the targeted per-channel failure feedback because `summarizeDirectorNotes` populated `notes` at `:407`. Adding a second Actor-call site OR re-annotating `notes` here would either double Actor invocations per attempt (breaking `expect(actorRequests).toHaveLength(2)` at `src/__tests__/actor-director.test.ts:288`) or double-feed identical reason text.
- The `attemptNo < maxAttempts` guard makes the targeting a no-op on the final attempt (when regeneration is impossible anyway), so behavior with `maxAttempts: 1` is unchanged.
- `targetedRetriedChannels` caps each channel to one `channel_regeneration_targeted` event per run, bounding the contract even if the channel keeps failing across remaining attempts.
- It only fires when there is at least one concrete failure reason for the zero-pick channel (`retryChannels` filter), so an empty-records edge case cannot emit a spurious event.
- **Ordering vs the grounder back-edge:** this pass runs BEFORE the back-edge (which at `src/actor-orchestrator.ts:457-461` sets `notes = undefined` when it merges grounded facts to force fresh table work). That ordering is correct and intended — if the grounder then fires and clears `notes`, grounding supersedes the validation-feedback carry. Do not reorder these two blocks. This pass is fully independent of `opts.grounder` and does not consume the `grounderRounds` / `MAX_GROUNDER_ROUNDS` budget.

### Acceptance criteria
- With `maxAttempts >= 2`, a run where one channel's only candidate fails script-validation on attempt 1 (and the Actor returns clean candidates for ALL channels on a later attempt) results in `result.exhausted === false` and a pick for that channel, AND a `channel_regeneration_targeted` run event is emitted (captured via `opts.onEvent`) whose payload `channels` names that channel.
- A channel that ends a round with zero passing candidates due to script-validation failures (e.g. `rejectCliches`, length overflow, structure, movement) OR a Director draft rejection causes the Actor to be re-run on at least one subsequent bounded attempt — for a 2-channel run where one channel fails on attempt 1 with `maxAttempts: 3`, `actor_client.messages.create` is invoked at least twice — and the next actor call's serialized params contain the per-channel failure reason text (carried via `summarizeDirectorNotes` -> `notes`, unchanged by this spec).
- The new behavior does NOT fire on the final attempt: with `maxAttempts: 1`, the existing test 'sends regex-failed candidates to the blind Director and batches regex notes into the retry wave' (`src/__tests__/actor-director.test.ts:435`) still passes unchanged — `result.exhausted === true`, `result.picks` length 0, exactly one actor call, and NO `channel_regeneration_targeted` event emitted.
- Each zero-pick channel is targeted for regeneration at most once per run: the `channel_regeneration_targeted` event for a given channel appears at most once across all attempts (guaranteed by `targetedRetriedChannels`), so the loop remains bounded by `maxAttempts`.
- `notes` / `summarizeDirectorNotes` are not modified by this change; the only net-new orchestrator surface is the `targetedRetriedChannels` set, the exported `collectChannelFailureFeedback` helper, and the `channel_regeneration_targeted` event emission.
- All existing tests in `src/__tests__/actor-director.test.ts` and `src/__tests__/orchestrator.test.ts` continue to pass; the grounder back-edge tests (eager/audit/cap-at-2) are unaffected because the new pass runs BEFORE the back-edge and does not consume the grounder budget or touch `currentCard` / `grounderRounds` / `auditBackEdgeDone`.
- `tsc`/typecheck passes: no `notes.change` dot-access is introduced (the spec mutates neither `notes` nor `notes.change`), so the optional `DirectorNotes.change` (`src/actor-director.ts:185`) and the strict tsconfig cause no 'Object is possibly undefined' error.

### Tests
- Add to `src/__tests__/actor-director.test.ts`, alongside the retry tests near line 248, a test **'targets a zero-pick channel from its script-validation failures and regenerates it (no grounder)'**: use an `actorClient` whose `create` uses a call counter (mirror the `actorRequests.length > 1` pattern at `src/__tests__/actor-director.test.ts:268`) so that on the FIRST actor call it returns an `x` candidate that PASSES the validator and a `web` candidate that FAILS the validator (e.g. `web` text contains a cliche like 'game-changer' so `rejectCliches` fires), and on the SECOND (and any later) actor call it returns clean candidates for BOTH channels via `actorOutput(cleanX, cleanWeb)` — both must be valid, because `runActor` regenerates ALL channels every attempt (closure captures the full `channels` array at `src/actor-orchestrator.ts:264`), so returning a clean `web` only would regress `x` to zero-pick on attempt 2. Use a `directorClient` returning `directorOutput(true)` always. Capture run events with an `onEvent` collector. Call `orchestrateActorDirectorWithRetries(CARD, ["x", "web"], { n: 1, mode: "live", actor_client: actorClient as never, director_client: directorClient as never, maxAttempts: 3, onEvent: (e) => { events.push(e); } })`. Assert: the actor client `create` was called at least twice; `result.exhausted === false`; `result.picks` contains both an `x` pick and a `web` pick; `events` contains at least one entry with `event_type === "channel_regeneration_targeted"` whose `payload.channels` includes `"web"`; and that no such event names `"x"`.
- Add a `channel_regeneration_targeted` **once-cap test** (or extend the above): with `maxAttempts: 3` and a `web` candidate that fails the validator on EVERY attempt while `x` passes, assert the run reaches `exhausted: true` with only the `x` pick AND that exactly ONE `channel_regeneration_targeted` event naming `"web"` is emitted across the whole run (proving `targetedRetriedChannels` caps it).
- Add a unit test for `collectChannelFailureFeedback`: import it (see the import instruction in gotchas), construct two `ActorDirectorCandidateRecord`s for channel `web` — one with `script_validation = { passed: false, failures: [{ rule: "cliches", reason: "contains banned term: game-changer" }] }`, the other with `script_validation = { passed: true, failures: [] }` and `director_audit = directorOutput(false)` (which has `directorDraftPassed` false: `copy_voice_passed:false`, `infinex_fit.legal:false`, plus `voice_issues:['fixture voice issue']` and `notes_for_actor:['Fixture note for retry handling.']`). Call `collectChannelFailureFeedback(["web"], records)`; assert the returned map has a `web` key whose array contains a `"script cliches: ..."` line, a `"voice: fixture voice issue"` line, and a `"director: Fixture note for retry handling."` line, deduped (use of `new Set`) and capped at 12. Also assert a channel with no failing records (e.g. `collectChannelFailureFeedback(["x"], records)`) returns an object with no `x` key.
- Run the full suite: `pnpm vitest run src/__tests__/actor-director.test.ts src/__tests__/orchestrator.test.ts` and confirm zero failures, including the unchanged `maxAttempts: 1` regex-fail test at `src/__tests__/actor-director.test.ts:435`.
- Run typecheck (`pnpm tsc --noEmit` or `pnpm typecheck`) and confirm zero errors — in particular no 'Object is possibly undefined' from any `notes.change` access (there should be none).

### Gotchas
- DO NOT mutate `notes` or `notes.change` in the new pass. `DirectorNotes.change` is OPTIONAL (`change?: {...}` at `src/actor-director.ts:185-192`); under this repo's tsconfig any `notes.change.copy` dot-read is a hard 'Object is possibly undefined' compile error. The decision in this spec is to NOT re-annotate `notes` at all (the reasons are already fed forward by `summarizeDirectorNotes`), which sidesteps the hazard entirely.
- DO NOT duplicate the failure-reason feed-forward. `summarizeDirectorNotes` (`src/actor-orchestrator.ts:874-915`, reassigned into `notes` at `:407` BEFORE the new pass) already pushes every script-validation reason and Director failure reason (including `notes_for_actor` and a missing-channel `change.copy` entry) into the `notes` consumed by the next `runActor()`. The net-new behavior is ONLY: the `channel_regeneration_targeted` event, the `targetedRetriedChannels` once-cap, and the `attemptNo < maxAttempts` guard.
- DO NOT remove or weaken the success-return at `src/actor-orchestrator.ts:431` — the new pass must sit AFTER it (after the block's closing `}` on `:438`) so a fully-passing round still returns immediately.
- DO NOT place the new pass inside or after the grounder back-edge `if` at `src/actor-orchestrator.ts:446`; it must run BEFORE it (between `:438` and the `:440` comment) so it is independent of `opts.grounder` and does not consume the `grounderRounds` / `MAX_GROUNDER_ROUNDS` budget. Do not reorder these two blocks: the back-edge at `:457-461` sets `notes = undefined` when it merges grounded facts; running the targeting pass first means grounding (when it fires) correctly supersedes the validation-feedback carry.
- The new pass does NOT call the Actor directly; it relies on the existing loop continuation + `notesIn = notes` feed-forward (`src/actor-orchestrator.ts:256`, `:263`, `:275`). Adding a second `runActor()` call here would double Actor invocations per attempt and break the existing `expect(actorRequests).toHaveLength(2)` assertion at `src/__tests__/actor-director.test.ts:288`.
- `publication-gate` coupling: `directorDraftPassed` (`src/actor-orchestrator.ts:1097-1098`) excludes `publication_gate_passed`. A candidate failing ONLY the publication gate has `directorDraftPassed === true`, so it is a PICK (`pickRankedPassingByChannel`, `src/actor-orchestrator.ts:644-649`) and that channel is NOT zero-pick — it never reaches `collectChannelFailureFeedback` for that reason. The `publication-gate:` reason line therefore only appears when another draft gate (voice/factual/legal) also failed on the same candidate. This is intended; do not 'fix' it by adding `publication_gate_passed` to `directorDraftPassed`.
- `emitRunEvent` is the in-module event helper (`src/actor-orchestrator.ts:487`); `channel_regeneration_targeted` is a NEW `event_type` string. The `ActorDirectorRunEvent.event_type` field is an open `string` (interface near `src/actor-director.ts:143-149`), not a closed enum, so the new value is additive. Harness consumers accept it: `harness/components/ActorRunEventsPanel.tsx` `isErrorEvent` only matches `run_error`/`run_failed`, and `harness/app/api/cards/[id]/actor-events/route.ts` stringifies arbitrary `event_type` — neither asserts an exhaustive union that would reject the new value.
- **First test description correction (load-bearing):** the SECOND actor call must return valid candidates for BOTH channels (e.g. `actorOutput(cleanX, cleanWeb)`), NOT just a clean `web`. `runActor` regenerates ALL channels every attempt (closure captures the full `channels` array at `src/actor-orchestrator.ts:264`), so a clean-`web`-only second response would regress `x` to zero-pick on attempt 2 and the 'both an x and a web pick' assertion would fail.
- **Import:** add `collectChannelFailureFeedback` to the existing test-file import from `../actor-orchestrator.js`. That import block is at `src/__tests__/actor-director.test.ts:16-22` and currently brings in `collectFactRequests, dedupeNewRequests, orchestrateActorDirectorWithRetries, validateActorMovement` (plus the `FactRequestGrounderFn` type). Add `collectChannelFailureFeedback` to that list.
- `channels` in the loop is the full original array captured by the `runActor` closure (`src/actor-orchestrator.ts:264`) — the Actor always regenerates all channels. This spec intentionally keeps that (targeting is observed + capped via the event + `targetedRetriedChannels`, and the reasons are fed via `notes`, NOT by narrowing the Actor's channel set), to avoid re-architecting the single-call-per-attempt contract that test `src/__tests__/actor-director.test.ts:248` depends on. Do NOT change `runActor` to pass only `retryChannels`.
- Export `collectChannelFailureFeedback` (it is unit-tested), matching the existing `export function collectFactRequests` style at `src/actor-orchestrator.ts:1106`.
- **Coexistence with `director-perf-cache-parallel` (Unit 3):** that unit edits the candidate loop at `src/actor-orchestrator.ts:349-404`; this unit edits at `:246` (new set) and `:438-440` (new pass) plus the helper after `:1133`. `records` is fully populated before `:406`, so this pass at `:438+` reads a complete `records` regardless of how the candidate loop is parallelized. Non-overlapping regions, but both edit `orchestrateActorDirectorWithRetries` — apply carefully if both land.

---

## Unit 2 — Harden the harness actor→grounder fact-request back-edge (grounder already wired; make groundFacts call crash-proof)

**id:** `wire-grounder-harness`

### Files
- `harness/app/actions/generate.ts` — edit
- `src/actor-orchestrator.ts` — reference
- `scripts/run-actor-director-card.ts` — reference
- `src/fact-grounder-llm.ts` — reference
- `src/__tests__/actor-director.test.ts` — reference

### Problem
**PREMISE CORRECTION (read first):** The task description says the harness "run generator" action calls the orchestrator WITHOUT `opts.grounder`, leaving the fact-request back-edge dark (0 `fact_requests_*` events). This is STALE relative to the current code. The harness ALREADY passes a grounder.

In `harness/app/actions/generate.ts`, `runActorGenerator` builds an inline grounder and passes it to the orchestrator:
- generate.ts:714-736 defines `const factRequestGrounder: FactRequestGrounderFn = async (requests) => { ... }` which calls `await groundFacts(sourceCopy, { surface: 'actor-director-back-edge', job: 'answer-fact-requests', approvedHosts })` (line 718-722), then `persistApprovalRequests(db, cardId, grounded.approval_requests ?? [])` (line 725), then maps `grounded.facts` to `GroundedFactAnswer[]` (line 726-735).
- generate.ts:741-762 calls `orchestrateActorDirectorWithRetries(releaseCard, channels, { ..., grounder: factRequestGrounder, onEvent: (event) => persistActorRunEvent(db, cardId, eventRunId, event), ... })`. The grounder is wired at line 749; the onEvent sink at line 750.

This is confirmed present at committed HEAD too: `git show HEAD:harness/app/actions/generate.ts` has `grounder: factRequestGrounder`. The working-tree diff is additive (async run wrapper) and does NOT remove the grounder.

The orchestrator already emits the events when a grounder is supplied AND a round produces fact_requests. In `src/actor-orchestrator.ts`, `runFactRequestRound` emits `fact_requests_collected` (line 1185), then calls the grounder inside try/catch (line 1190-1200) emitting `fact_request_grounding_error` on throw, then emits either `fact_requests_unanswered` (line 1204) or `fact_requests_answered` (line 1213). It is called from the eager back-edge (line 297-328) and the audit-triggered back-edge (line 446-463). So the events fire today whenever the Actor/Director emit fact_requests.

**THE REAL GAP (what to fix):** the harness inline grounder is hand-rolled and diverges from the canonical adapter `buildFactRequestGrounder({ groundFacts })` that `scripts/run-actor-director-card.ts:63` uses. Two concrete problems:

1. **Resilience to the documented `fetchRef`-on-deleted-shipped-branch failure is fragile.** The orchestrator's try/catch at actor-orchestrator.ts:1191 wraps the grounder call, so a throw from `await groundFacts(...)` is caught and surfaces as `fact_request_grounding_error` — the run does NOT crash. GOOD. BUT the harness-specific side-effect `persistApprovalRequests(...)` (generate.ts:725) sits AFTER the `await groundFacts` inside the same inline function: if `groundFacts` throws, `persistApprovalRequests` never runs, so any approval-host requests the grounder would have queued for the operator are silently lost on a partial failure. Worse, the inline grounder has NO internal try/catch isolating the `groundFacts` call from the `persistApprovalRequests` DB write — both share the orchestrator's single catch, collapsing two distinct failure modes (grounding error vs. approval-persistence error) into one `fact_request_grounding_error` event.

2. **The fact-mapping logic** (live-class basis tag, provenance string from `source_ref`+`confidence`) is duplicated between generate.ts:726-735 and `buildFactRequestGrounder` (actor-orchestrator.ts:72-82). They will drift. **NOTE:** you CANNOT simply replace the inline grounder with `buildFactRequestGrounder({ groundFacts, approvedHosts })`, because `FactRequestGrounderConfig.groundFacts` (actor-orchestrator.ts:52-57) types the return as only `{ facts: [...] }` — it does NOT expose `approval_requests` (which `groundFacts` returns per fact-grounder-llm.ts:75,502). Swapping to the adapter would DROP the harness approval-gate side-effect (`persistApprovalRequests`), a regression. So the fix hardens the inline grounder rather than replacing it.

### Change
Edit ONLY `harness/app/actions/generate.ts`. Make the inline `factRequestGrounder` (currently generate.ts:714-736) crash-proof and side-effect-safe so the back-edge can never abort the run and the approval-queue side-effect is preserved/isolated from grounding failures.

Replace the body of the `factRequestGrounder` arrow function. The CURRENT code is exactly:
```ts
  const approvedHosts = listApprovedApiHosts(db).map((h) => h.host);
  const factRequestGrounder: FactRequestGrounderFn = async (requests) => {
    const sourceCopy = requests
      .map((r) => `- ${r.question}${r.reason ? ` (needed for: ${r.reason})` : ''}`)
      .join('\n');
    const grounded = await groundFacts(sourceCopy, {
      surface: 'actor-director-back-edge',
      job: 'answer-fact-requests',
      approvedHosts,
    });
    // Respect the harness API approval gate: any host the grounder couldn't call
    // is queued for the operator, exactly like the research stage.
    persistApprovalRequests(db, cardId, grounded.approval_requests ?? []);
    return grounded.facts.map((fact): GroundedFactAnswer => ({
      question: fact.claim,
      fact: {
        claim: `${fact.claim}: ${fact.value}`,
        ...(fact.category === 'number'
          ? { basis: `grounded value; verify before ship (confidence ${fact.confidence.toFixed(2)})` }
          : {}),
      },
      provenance: `${fact.source_ref} (confidence ${fact.confidence.toFixed(2)})`,
    }));
  };
```

Replace it with exactly:
```ts
  const approvedHosts = listApprovedApiHosts(db).map((h) => h.host);
  const factRequestGrounder: FactRequestGrounderFn = async (requests) => {
    const sourceCopy = requests
      .map((r) => `- ${r.question}${r.reason ? ` (needed for: ${r.reason})` : ''}`)
      .join('\n');
    // The grounder's fetchRef step fails when a release ships from a branch that
    // was deleted post-merge. The orchestrator wraps this call in try/catch and
    // emits fact_request_grounding_error, but we still defend here so the
    // approval-gate side-effect below is reached on success and a grounding throw
    // can never abort the run or be confused with a DB write failure.
    let grounded: Awaited<ReturnType<typeof groundFacts>>;
    try {
      grounded = await groundFacts(sourceCopy, {
        surface: 'actor-director-back-edge',
        job: 'answer-fact-requests',
        approvedHosts,
      });
    } catch (err) {
      persistActorRunEvent(db, cardId, runId ?? cardId, {
        event_type: 'fact_request_grounding_error',
        message: errorMessage(err),
        payload: { surface: 'actor-director-back-edge', trigger: 'harness-grounder', error: errorMessage(err) },
      });
      return [];
    }
    // Respect the harness API approval gate: any host the grounder couldn't call
    // is queued for the operator, exactly like the research stage. Isolated from
    // the grounding call so a persistence failure cannot masquerade as a
    // grounding error and cannot drop already-grounded answers.
    try {
      persistApprovalRequests(db, cardId, grounded.approval_requests ?? []);
    } catch (persistErr) {
      console.error('Failed to persist grounder approval requests', persistErr);
    }
    return grounded.facts.map((fact): GroundedFactAnswer => ({
      question: fact.claim,
      fact: {
        claim: `${fact.claim}: ${fact.value}`,
        ...(fact.category === 'number'
          ? { basis: `grounded value; verify before ship (confidence ${fact.confidence.toFixed(2)})` }
          : {}),
      },
      provenance: `${fact.source_ref} (confidence ${fact.confidence.toFixed(2)})`,
    }));
  };
```

Rationale for each delta:
- The `try/catch` around `groundFacts` returns `[]` on a grounding throw. Returning an empty array makes the orchestrator emit `fact_requests_unanswered` (actor-orchestrator.ts:1201-1209) for the round, and the run continues. We ALSO emit our own `fact_request_grounding_error` event from inside the harness grounder so the harness timeline records the root cause (the orchestrator's own catch never fires now, because we no longer throw past it).
- The harness error-event payload includes `trigger: 'harness-grounder'` so it stays shape-symmetric with the orchestrator's own grounding-error payload `{ trigger, ...errorPayload(err) }` (actor-orchestrator.ts:1197) — a timeline/test consumer that filters error events by `payload.trigger` (as actor-director.test.ts:829 does) still captures the harness-side event. The literal value differs ('harness-grounder' vs the orchestrator's 'eager'/'audit') because the harness grounder cannot see which back-edge invoked it; that is intentional. **(This addresses the review's note that the original draft omitted `trigger` from the harness payload.)**
- `runId` is a parameter of `runActorGenerator` (`runId?: string`, generate.ts:682); the existing per-flow `eventRunId` (`runId ?? newId()`, generate.ts:740) is computed later in the loop and is NOT in scope at the grounder-definition site. Use `runId ?? cardId` as the event run_id so the error event is still recorded under a stable id when `runId` is undefined. Do NOT reference `eventRunId` here — it is declared after this block.
- The `persistApprovalRequests` call is wrapped so a synchronous DB-write failure logs and is swallowed rather than propagating into the orchestrator's grounder catch (which would mislabel it as a grounding error and discard the already-grounded `facts`).

Do NOT change `scripts/run-actor-director-card.ts`, `src/actor-orchestrator.ts`, or any other file. Do NOT add `import { buildFactRequestGrounder }` to the harness — the inline grounder is retained on purpose (the adapter cannot carry the `persistApprovalRequests` approval-gate side-effect; see problem note 2). `errorMessage` is already defined in generate.ts (line ~1086) and `persistActorRunEvent` is already defined (line ~1010); both are in module scope and need no new import.

### Acceptance criteria
- A harness-driven generator run (via runGenerator -> runActorGeneratorJob -> runActorGenerator) where the Actor or Director emits at least one fact_request results in actor_run_events rows with event_type 'fact_requests_collected' and 'fact_requests_answered' (when groundFacts returns >=1 fact) for that run_id. This already works once a grounder is passed; the change must not regress it.
- When groundFacts throws (e.g. fetchRef fails on a deleted shipped branch), the harness run does NOT crash: the actor run completes/persists candidates, and an actor_run_events row with event_type 'fact_request_grounding_error' is recorded for the run. The orchestrator continues and emits 'fact_requests_unanswered' for that round (because the harness grounder returned []).
- When groundFacts succeeds but persistApprovalRequests throws, the run still returns the grounded answers (candidates merge facts) and does NOT emit a 'fact_request_grounding_error'; the persistence failure is logged via console.error only.
- On a successful grounding round that yields approval_requests, pending_api_requests rows are still queued for unapproved hosts exactly as before (persistApprovalRequests still runs on the success path).
- TypeScript compiles: the new code references only in-scope identifiers (requests, db, cardId, runId, approvedHosts, groundFacts, persistApprovalRequests, persistActorRunEvent, errorMessage, GroundedFactAnswer). No reference to eagerDone/eventRunId/buildFactRequestGrounder.
- From the repo root, `pnpm typecheck:harness` (= `pnpm --dir harness typecheck`, i.e. `next typegen && tsc --noEmit`) passes with no new errors in app/actions/generate.ts. `pnpm build:harness` (= `pnpm --dir harness build`) also succeeds. **Do NOT use `pnpm --filter ./harness ...`** — there is no pnpm-workspace.yaml at the repo root, so the `--filter` form does not resolve. *(Review-applied fix: the original draft's acceptance criterion cited the non-runnable `--filter` form; corrected here.)*

### Tests
- From repo root with ANTHROPIC_API_KEY set, run a real harness back-edge against an existing card whose Actor emits fact_requests and confirm the events land: `pnpm tsx scripts/run-actor-director-card.ts --card=<card-id> --channels=x,web --no-review` then `sqlite3 harness/harness.db "SELECT event_type, COUNT(*) FROM actor_run_events WHERE card_id='<card-id>' AND event_type LIKE 'fact_request%' GROUP BY event_type;"` — expect fact_requests_collected and fact_requests_answered counts > 0. (This validates the orchestrator path the harness shares; the script and harness call the same orchestrateActorDirectorWithRetries.)
- Existing orchestrator back-edge unit tests must still pass: `pnpm vitest run src/__tests__/actor-director.test.ts` — specifically the assertions at lines 778-780 and 833 that check fact_requests_collected/fact_requests_answered for triggers 'eager' and 'audit'.
- Typecheck and build the harness from the repo root: `pnpm typecheck:harness` and `pnpm build:harness` (NOT `pnpm --filter ./harness build` — no workspace file exists). Both must complete with no new errors in app/actions/generate.ts.
- Resilience check (manual or new test): temporarily make a stub groundFacts throw, drive runActorGenerator with a card that emits fact_requests, and assert (a) the function resolves without throwing, (b) an actor_run_events row with event_type='fact_request_grounding_error' exists, (c) candidates were still persisted for the run.

### Gotchas
- TASK PREMISE IS STALE. The grounder is ALREADY wired (generate.ts:749, also present at HEAD). Do NOT 'add' a grounder argument or assume opts.grounder is missing — it is not. The shipped change is hardening the existing inline grounder, not introducing the wiring.
- Build/typecheck command: this repo has NO pnpm-workspace.yaml, so `pnpm --filter ./harness build` does NOT resolve. Use the root package.json scripts `pnpm typecheck:harness` (= `pnpm --dir harness typecheck`) and `pnpm build:harness` (= `pnpm --dir harness build`), run from the repo root.
- Do NOT replace the inline grounder with buildFactRequestGrounder({ groundFacts }). FactRequestGrounderConfig.groundFacts (src/actor-orchestrator.ts:52-57) types the return as only { facts: [...] } and the adapter (lines 62-83) never reads approval_requests, so swapping would silently drop persistApprovalRequests — a regression of the harness API approval gate. The script can use the adapter because the script has no approval-gate side-effect; the harness cannot.
- The orchestrator ALREADY makes the back-edge resilient: runFactRequestRound wraps opts.grounder!(requests, card) in try/catch (src/actor-orchestrator.ts:1190-1200) and emits fact_request_grounding_error, then returns null so the run continues. The harness change is belt-and-suspenders: by catching inside the harness grounder and returning [], we (a) keep the approval side-effect on the success path, (b) isolate a persistApprovalRequests DB failure from a grounding failure, (c) record the harness-side root-cause event. Returning [] (not throwing) means the orchestrator emits fact_requests_unanswered for that round rather than its own grounding-error event.
- runId is the OPTIONAL 4th param of runActorGenerator (runId?: string, generate.ts:682). At the grounder-definition site (before the for-loop over flowDirections), the per-flow eventRunId = runId ?? newId() (generate.ts:740) is NOT yet declared. Use runId ?? cardId for the error event's run_id; do NOT forward-reference eventRunId. NOTE: in production runId is always defined (runActorGeneratorJob passes opts.runId at generate.ts:118/121), so the error event groups with the success-path events under one run_id; only a direct test call that omits runId can land the error event under cardId while success events use a per-flow newId() — that is an accepted, documented consequence, not a bug.
- The harness error event payload includes trigger: 'harness-grounder' (alongside surface + error) so it is shape-symmetric with the orchestrator's own grounding-error payload { trigger, ...errorPayload(err) } at actor-orchestrator.ts:1197.
- persistActorRunEvent calls ensureActorRunEventsTable internally (generate.ts:1016), so emitting the error event from inside the grounder is safe even on the first event of a run.
- errorMessage(err) and persistActorRunEvent are already module-scope functions in generate.ts (approx lines 1086 and 1010). Do NOT re-import or redefine them.
- `Awaited<ReturnType<typeof groundFacts>>` is the correct type for the `grounded` binding so the .facts/.approval_requests accesses stay typed; do not loosen to any.
- event_type is a free-form string in ActorDirectorRunEvent (src/actor-orchestrator.ts:146 declares event_type: string and actor_run_events.event_type is an untyped TEXT column), so 'fact_request_grounding_error' is accepted with no enum/schema change. The ActorRunEventsPanel renders generic event_type strings, so the new event displays without UI changes.

---

## Unit 3 — Cache the Director rubric prefix via the SDK 0.30.x prompt-caching BETA path, pre-warm-then-fan-out the per-attempt audits in parallel, and skip auditing regex-failed candidates

**id:** `director-perf-cache-parallel`

### Files
- `src/actor-director.ts` — edit
- `src/actor-orchestrator.ts` — edit
- `src/__tests__/actor-director.test.ts` — test
- `src/actor-memory.ts` — reference
- `package.json` — reference

### Problem
A single Actor/Director attempt audits every candidate the Actor produced, serially, with no prompt caching and no skip of dead copy. Four concrete defects, plus a hard SDK constraint that the original spec got wrong.

**(1) SERIAL AUDITS.** In `src/actor-orchestrator.ts`, the per-candidate loop at line 349 runs each Director audit one at a time and awaits it before the next:
```ts
349:      for (const candidate of actorResult.candidates) {
350:        const script = validateCandidate(candidate, currentCard, voice);
...
373:        const audit = await director({
374:          card: currentCard,
375:          candidate,
376:          channel: candidate.channel,
377:          voice,
378:          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
379:          ...(opts.director_model !== undefined ? { model: opts.director_model } : {}),
380:          ...(opts.director_client !== undefined ? { client: opts.director_client } : {}),
381:        });
382:        record.director_audit = audit;
```
With N channels x n candidates each (e.g. 7 channels x 5 = 35), at ~1 min/audit this is ~35 min wall-clock.

**(2) NO PROMPT CACHING.** `grep -rn cache_control src/` returns zero hits. The Director call in `src/actor-director.ts:544-549` re-sends the full static rubric every call at full input-token price:
```ts
544:  const resp = await createMessageWithRetry(client, {
545:    model: opts.model ?? DEFAULT_DIRECTOR_MODEL,
546:    max_tokens: 4096,
547:    system: memory.system_prompt,
548:    messages: [{ role: "user", content: user }],
549:  }, "Director");
```
`memory.system_prompt` (built in `src/actor-memory.ts:183-215` `buildDirectorMemoryPack`) is a single stable string — source index, movement corpus, Mirodan kernel, drive table, director method, full tempo taxonomy, Infinex placement, blind-read rules — identical for every candidate in a run (depends only on `voice`, not on the candidate). The per-candidate volatile content (channel, candidate text, full release-card JSON) lives in the `user` message built by `buildDirectorUserMessage` (`src/actor-director.ts:873`), i.e. AFTER `system` in render order. So the prefix is already cleanly separable; nothing caches only because no `cache_control` breakpoint is set.

**(3) DEAD COPY IS AUDITED.** The loop calls `director(...)` at line 373 unconditionally — even when `script.passed === false` (line 350 `validateCandidate`). A regex/structure/length/movement-failed candidate can never be picked (`pickRankedPassingByChannel`, `src/actor-orchestrator.ts:643-649`, requires `script_validation.passed && director_audit !== undefined && directorDraftPassed(...)`), yet it still costs a ~1-min Director call.

**(4) USAGE DROPPED BY THE CLIENT TYPE.** `src/actor-director.ts:26-30`:
```ts
26: export interface AnthropicMessagesClient {
27:   messages: {
28:     create: (params: AnthropicCreateParams) => Promise<{ content: Anthropic.Message["content"] }>;
29:   };
30: }
```
`createMessageWithRetry` (src/actor-director.ts:1617-1621) returns `{ content }` only — there is no path to read cache token counts to verify cache hits.

**(5) SDK CONSTRAINT — THE STABLE MESSAGES API IN THIS SDK ERA HAS NO `cache_control`.** Verified: `package.json` declares `"@anthropic-ai/sdk": "^0.30.0"`; `node_modules/@anthropic-ai/sdk/package.json` reports installed version `0.30.1`. In 0.30.x prompt caching is BETA-ONLY. The stable system block type is `TextBlockParam = { text: string; type: "text" }` with NO `cache_control` property, and stable `Usage` is exactly `{ input_tokens: number; output_tokens: number }` (no cache fields). `cache_control` exists only on `PromptCachingBetaTextBlockParam` (`node_modules/@anthropic-ai/sdk/resources/beta/prompt-caching/messages.d.ts:142-146`, field `cache_control?: PromptCachingBetaCacheControlEphemeral | null` where the ephemeral type is `{ type: "ephemeral" }`), reached only via `client.beta.promptCaching.messages.create(...)`; and the cache token counts live only on `PromptCachingBetaUsage` (`messages.d.ts:194-211`: `cache_creation_input_tokens: number | null`, `cache_read_input_tokens: number | null`). The beta resource is `new Anthropic().beta.promptCaching`, a `PromptCaching` extends `APIResource` whose `.messages: Messages` has `.create(params: MessageCreateParamsNonStreaming): APIPromise<PromptCachingBetaMessage>`. The SDK auto-injects the `anthropic-beta: prompt-caching-2024-07-31` header inside `promptCaching.messages.create` (verified in compiled `messages.mjs`: `betas: [...(opts.betas ?? []), 'prompt-caching-2024-07-31']`), so NO manual header is needed. Because `new Anthropic().beta.promptCaching` is structurally `{ messages: { create } }`, it satisfies the existing `AnthropicMessagesClient` interface shape and every existing mock client (`{ messages: { create } }`) stays valid.

**(6) `max_tokens: 0` IS INVALID.** The beta `MessageCreateParamsBase.max_tokens` is `number` and the API minimum is 1 (`max_tokens: 0` returns a 400 "must be greater than or equal to 1"). The original spec's `max_tokens: 0` pre-warm is therefore not a valid request; the pre-warm must use `max_tokens: 1`.

**(7) DIRECT CONFLICT WITH AN EXISTING TEST.** `src/__tests__/actor-director.test.ts:435` ("sends regex-failed candidates to the blind Director and batches regex notes into the retry wave") feeds a single regex-FAILING candidate `"A game-changing launch."` (fails `rejectCliches`; verified: `validate("A game-changing launch.", { voice: INFINEX_VOICE }).passed === false`, failure rule `cliches`) with `n:1, maxAttempts:1`, and asserts at line 473 `expect(directorRequests.length).toBeGreaterThan(0)` — i.e. it asserts the regex-failed candidate IS audited. Skip-dead-copy makes this 0. This test must be re-specced (EDIT C1).

**(8) HARD-CODED DIRECTOR CALL COUNTS.** `src/__tests__/actor-director.test.ts` asserts exact counts at line 289 (`toHaveLength(20)`), line 334 (`toHaveLength(10)`), and line 625 (`toHaveLength(30)`). Reconciliation: all three tests feed `"The wall moved."` for BOTH x and web channels (the `actorOutput("The wall moved.", "The wall moved.")` fixture at lines 258/304/595). Verified `validate("The wall moved.", { voice: INFINEX_VOICE }).passed === true` with zero failures; the fixture's `movement_receipt` declares valid Mirodan Working Actions ("punching"/"pressing"), declares no per-beat tempo (no `actor-tempo-leak`), and sets no `structured` payload, so the full `validateCandidate` path passes too. Independent proof that all `"The wall moved."` candidates script-pass: the line-294 test asserts `result.picks` has length 2, and picking requires `script_validation.passed === true` in `pickRankedPassingByChannel` (line 646). Therefore every audited candidate in those three tests already script-passes, so skip-dead-copy leaves the counts UNCHANGED at 20 / 10 / 30. Only the line-435 regex-failed test changes count (to 0).

### Change
Make two coordinated source edits (A, B) plus one test-file edit (C). All edits preserve existing behavior for injected-client / injected-director tests: caching and pre-warm are no-ops/skipped against a mock, and the fan-out still calls `director(...)` per script-passing candidate with identical args, so verdicts are unchanged.

**PREREQUISITE / SDK PATH DECISION:** do NOT upgrade the SDK. Stay on the installed `@anthropic-ai/sdk@0.30.1` and use the BETA prompt-caching path (`client.beta.promptCaching.messages.create`, `PromptCachingBetaTextBlockParam` with `cache_control`, `PromptCachingBetaUsage` for cache token fields). The beta header is auto-injected by the SDK; no manual header. This is the only path that both type-checks under `strict: true` and is honored at runtime in this SDK era. *(This is the review-required resolution of the original draft's two compile blockers: the draft set `cache_control` on a stable block + widened `usage` to a type with no cache fields. The beta path below fixes both.)*

#### EDIT A — src/actor-director.ts: route the real client through the prompt-caching beta resource, cache the Director rubric prefix, add a pre-warm helper

**A1. Repoint the shared param/return types and the real-client construction to the beta prompt-caching resource.** The injected `AnthropicMessagesClient` abstraction is shared by Actor, Director audit, and pre-warm; switching the real construction to the beta resource keeps a single endpoint and a single usage type, and every existing mock client (`{ messages: { create } }`) stays valid because `new Anthropic().beta.promptCaching` is itself `{ messages: { create } }`.

A1a. Replace the param-type alias at src/actor-director.ts:24:
```ts
type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];
```
with the beta non-streaming params type (a superset of the stable params — the Actor's bare-string `system` and plain `messages` remain valid):
```ts
type AnthropicCreateParams = Anthropic.Beta.PromptCaching.MessageCreateParamsNonStreaming;
```

A1b. Widen the client return type to carry beta `usage`. Replace lines 26-30 with:
```ts
export interface AnthropicMessagesClient {
  messages: {
    create: (
      params: AnthropicCreateParams,
    ) => Promise<{
      content: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage["content"];
      usage?: Anthropic.Beta.PromptCaching.PromptCachingBetaUsage;
    }>;
  };
}
```
`PromptCachingBetaUsage` carries `cache_creation_input_tokens: number | null` and `cache_read_input_tokens: number | null` (the fields the acceptance criteria assert). Keep `usage` OPTIONAL so existing mock clients returning `{ content }` still typecheck. `PromptCachingBetaMessage["content"]` is structurally identical to `Anthropic.Message["content"]` for `textFromMessage`'s `block.type === "text"` check, so widen `textFromMessage`'s parameter (src/actor-director.ts:1602) to `{ content: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage["content"] }` for consistency; either type compiles.

A1c. Update `createMessageWithRetry`'s return type (src/actor-director.ts:1617-1621) from `Promise<{ content: Anthropic.Message["content"] }>` to:
```ts
Promise<{
  content: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage["content"];
  usage?: Anthropic.Beta.PromptCaching.PromptCachingBetaUsage;
}>
```
No body change.

A1d. Change BOTH real-client constructions from the stable `new Anthropic()` to the beta prompt-caching resource, so the live path uses an endpoint that honors `cache_control`:
- In `generateActorAttempt` (src/actor-director.ts:499): replace `const client = opts.client ?? (new Anthropic() as unknown as AnthropicMessagesClient);` with `const client = opts.client ?? (new Anthropic().beta.promptCaching as unknown as AnthropicMessagesClient);`
- In `auditCandidateWithDirector` (src/actor-director.ts:543): identical replacement.

The Actor keeps its bare-string `system` (no `cache_control`), so its behavior is unchanged; it merely rides the same beta resource. Only the Director gains the breakpoint.

**A2. In `auditCandidateWithDirector` (src/actor-director.ts:535-556),** convert the `system` argument from a bare string to a single-element block array with an ephemeral cache breakpoint on that last (only) block. Replace lines 544-549:
```ts
  const resp = await createMessageWithRetry(client, {
    model: opts.model ?? DEFAULT_DIRECTOR_MODEL,
    max_tokens: 4096,
    system: memory.system_prompt,
    messages: [{ role: "user", content: user }],
  }, "Director");
```
with:
```ts
  const resp = await createMessageWithRetry(client, {
    model: opts.model ?? DEFAULT_DIRECTOR_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: memory.system_prompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  }, "Director");
```
Do NOT interpolate anything per-call (no timestamp, candidate id, channel, or card) into `memory.system_prompt` or into the system block — it must stay byte-identical across every Director call in a run so the prefix matches. The per-candidate `user` message is unchanged and stays after the breakpoint. (`memory.system_prompt` is already free of per-call interpolation; see `buildDirectorMemoryPack` in src/actor-memory.ts:183-215.) Leave the Actor call (src/actor-director.ts:502-507) unchanged for this unit (still bare-string `system`, no `cache_control`).

**A3. Add an exported pre-warm helper** immediately after the closing brace of `auditCandidateWithDirector` (currently src/actor-director.ts:556). It issues one `max_tokens: 1` prefill against the exact same cached system prefix so the cache entry is written and readable before fan-out. Note `max_tokens: 1`, NOT 0 — the API rejects `max_tokens: 0` with a 400.
```ts
/** Pre-warm the Director rubric cache: one minimal (max_tokens:1) prefill that
 *  writes the ephemeral cache entry for the shared system prefix, so parallel audits
 *  read it instead of each prefilling the rubric independently. Awaiting this to
 *  completion guarantees the cache entry is readable before fan-out. No-op-safe:
 *  returns without throwing if the warm call fails, so a warm failure never blocks
 *  the run — the audits just miss the cache. Must use the SAME voice and model the
 *  audits will use, so the prefix bytes and cache scope match. */
export async function prewarmDirectorCache(opts: {
  voice?: CharacterSpec;
  mode?: "live" | "stub" | "auto";
  model?: string;
  client?: AnthropicMessagesClient;
}): Promise<void> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const memory = buildDirectorMemoryPack(voice);
  assertLiveActorDirectorMode("Director", opts.mode, opts.client);
  const client = opts.client ?? (new Anthropic().beta.promptCaching as unknown as AnthropicMessagesClient);
  try {
    await client.messages.create({
      model: opts.model ?? DEFAULT_DIRECTOR_MODEL,
      max_tokens: 1,
      system: [{ type: "text", text: memory.system_prompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "warmup" }],
    });
  } catch {
    // Warm failures are non-fatal; audits will simply miss the cache.
  }
}
```
Notes for the implementer: `CharacterSpec`, `INFINEX_VOICE`, `buildDirectorMemoryPack`, `Anthropic`, `assertLiveActorDirectorMode`, `DEFAULT_DIRECTOR_MODEL`, and `AnthropicMessagesClient` are all already imported/defined in this file (`buildDirectorMemoryPack` imported from ./actor-memory.js at line 18; `INFINEX_VOICE` at line 14; `CharacterSpec` at line 15). Use `prewarmDirectorCache` directly — do NOT route the warm through `createMessageWithRetry` (a 1-token prefill should not be retried). Do NOT set `stream`, `thinking`, or `tool_choice: {type:'tool'|'any'}` on the warm call (those reject a 1-token request).

#### EDIT B — src/actor-orchestrator.ts: skip dead copy + pre-warm-then-parallel fan-out

Replace the entire serial per-candidate loop at src/actor-orchestrator.ts lines 348-404 with a two-phase version (Phase 1: validate all + emit script events serially, in original order, building one record per candidate; Phase 2: pre-warm the cache, then audit ONLY script-passing candidates in parallel under a concurrency cap). Replace exactly:
```ts
      const records: ActorDirectorCandidateRecord[] = [];
      for (const candidate of actorResult.candidates) {
        const script = validateCandidate(candidate, currentCard, voice);
        const record: ActorDirectorCandidateRecord = {
          candidate,
          script_validation: script,
        };
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "script_validation_completed",
          message: `${candidate.channel} script validation ${script.passed ? "passed" : "failed"}`,
          payload: {
            passed: script.passed,
            failure_rules: script.failures.map((failure) => failure.rule),
            text: candidate.text,
          },
        });
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "director_started",
          message: `${candidate.channel} sent to blind Director${script.passed ? "" : " with regex notes pending"}`,
          payload: { text: candidate.text, regex_passed: script.passed },
        });
        const audit = await director({
          card: currentCard,
          candidate,
          channel: candidate.channel,
          voice,
          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
          ...(opts.director_model !== undefined ? { model: opts.director_model } : {}),
          ...(opts.director_client !== undefined ? { client: opts.director_client } : {}),
        });
        record.director_audit = audit;
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "director_completed",
          message: `${candidate.channel} Director ${directorDraftPassed(audit) ? "passed" : "rejected"} as ${audit.primary_tempo}`,
          payload: {
            passed: directorDraftPassed(audit),
            regex_passed: script.passed,
            copy_voice_passed: audit.copy_voice_passed,
            factual_passed: audit.factual_passed,
            publication_gate_passed: audit.publication_gate_passed,
            legal: audit.infinex_fit.legal,
            primary_tempo: audit.primary_tempo,
            primary_confidence: audit.primary_confidence,
            notes_for_actor: audit.notes_for_actor,
            factual_issues: audit.factual_issues,
            publication_gate_issues: audit.publication_gate_issues,
            voice_issues: audit.voice_issues,
          },
        });
        records.push(record);
      }
```
with:
```ts
      // Phase 1: validate every candidate (cheap, deterministic) and emit script
      // events in the original candidate order. Build one record per candidate.
      const records: ActorDirectorCandidateRecord[] = [];
      for (const candidate of actorResult.candidates) {
        const script = validateCandidate(candidate, currentCard, voice);
        const record: ActorDirectorCandidateRecord = {
          candidate,
          script_validation: script,
        };
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "script_validation_completed",
          message: `${candidate.channel} script validation ${script.passed ? "passed" : "failed"}`,
          payload: {
            passed: script.passed,
            failure_rules: script.failures.map((failure) => failure.rule),
            text: candidate.text,
          },
        });
        records.push(record);
      }

      // Only script-passing candidates are auditable: a regex/structure/length/movement
      // -failed candidate can never be picked (pickRankedPassingByChannel requires
      // script_validation.passed). Auditing dead copy wastes a ~1-min Director call.
      const auditable = records.filter((record) => record.script_validation.passed);

      // Phase 2: pre-warm the shared Director rubric cache ONCE, then fan out the
      // audits in parallel under a concurrency cap. The pre-warm MUST reach completion
      // before the parallel calls start, or every parallel call prefills the rubric
      // independently and ALL miss the cache. Gate to the real-API path: skip when a
      // mock director fn OR a mock director_client is injected, or mode is stub.
      const usingRealDirector =
        opts.director === undefined &&
        opts.director_client === undefined &&
        opts.mode !== "stub";
      if (auditable.length > 0 && usingRealDirector) {
        await prewarmDirectorCache({
          voice,
          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
          ...(opts.director_model !== undefined ? { model: opts.director_model } : {}),
        });
      }

      const concurrency = Math.max(1, Math.min(8, cpus().length));
      const auditOne = async (record: ActorDirectorCandidateRecord): Promise<void> => {
        const candidate = record.candidate;
        const script = record.script_validation;
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "director_started",
          message: `${candidate.channel} sent to blind Director`,
          payload: { text: candidate.text, regex_passed: script.passed },
        });
        const audit = await director({
          card: currentCard,
          candidate,
          channel: candidate.channel,
          voice,
          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
          ...(opts.director_model !== undefined ? { model: opts.director_model } : {}),
          ...(opts.director_client !== undefined ? { client: opts.director_client } : {}),
        });
        record.director_audit = audit;
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "director_completed",
          message: `${candidate.channel} Director ${directorDraftPassed(audit) ? "passed" : "rejected"} as ${audit.primary_tempo}`,
          payload: {
            passed: directorDraftPassed(audit),
            regex_passed: script.passed,
            copy_voice_passed: audit.copy_voice_passed,
            factual_passed: audit.factual_passed,
            publication_gate_passed: audit.publication_gate_passed,
            legal: audit.infinex_fit.legal,
            primary_tempo: audit.primary_tempo,
            primary_confidence: audit.primary_confidence,
            notes_for_actor: audit.notes_for_actor,
            factual_issues: audit.factual_issues,
            publication_gate_issues: audit.publication_gate_issues,
            voice_issues: audit.voice_issues,
          },
        });
      };

      // Bounded parallel: at most `concurrency` audits in flight. Each worker pulls
      // the next auditable record off a shared cursor. Records are mutated in place,
      // so order in `records` is preserved regardless of completion order.
      let auditCursor = 0;
      const runWorker = async (): Promise<void> => {
        for (;;) {
          const index = auditCursor++;
          if (index >= auditable.length) return;
          await auditOne(auditable[index]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(concurrency, auditable.length) }, () => runWorker()),
      );
```
**NOTE on `noUncheckedIndexedAccess`:** `auditable[index]` is `T | undefined` under the strict tsconfig. The `if (index >= auditable.length) return;` guard precedes it, but TS will still narrow `auditable[index]` to possibly-undefined. Either capture `const record = auditable[index]; if (!record) return;` then call `await auditOne(record);`, or assert — prefer the guard form to stay strict-clean.

**B-imports.** At the top of src/actor-orchestrator.ts:
- Add `import { cpus } from "node:os";` near the top (e.g. after line 7, before the `./actor-director.js` import block at line 8).
- In the existing `import { ... } from "./actor-director.js";` block (lines 8-23), add `prewarmDirectorCache,` to the named VALUE imports (alongside `auditCandidateWithDirector` on line 9). It is a runtime export, not a type, so it goes with the value imports, not the `type` imports.

**B-notes for the implementer:**
- Behavior parity: `auditOne` calls `director(...)` with the SAME argument object as the original loop (same `card`/`candidate`/`channel`/`voice`/`mode`/`director_model`/`director_client` spreads), so each verdict is computed per-candidate and blind exactly as before. Caching + parallelism change ONLY timing and token cost, never the inputs to any single audit.
- The `director_started` message dropped the `" with regex notes pending"` suffix because the loop now never sends a script-failed candidate to the Director — every audited candidate is `regex_passed: true`. Keep `regex_passed: script.passed` in the payload (always true here) for downstream event-shape compatibility.
- Pre-warm gate: `usingRealDirector` skips the warm when EITHER a mock `director` fn (`opts.director !== undefined`, which is how the new skip-dead-copy / parity / concurrency tests inject) OR a mock `director_client` (`opts.director_client !== undefined`, the existing count tests) is present, OR `opts.mode === "stub"`. This prevents `prewarmDirectorCache` from constructing a real `new Anthropic().beta.promptCaching` and attempting a network call (or throwing on missing `ANTHROPIC_API_KEY` via `assertLiveActorDirectorMode`) during any mocked test. `opts.mode` has no orchestrator-level default, so leaving it undefined is fine — the gate keys on the injection flags, not on mode alone. *(Review-required: the original draft's gate omitted the `opts.director` path, which would have fired a real `new Anthropic()` in CI for the new mock tests.)*
- Records for script-FAILED candidates keep `director_audit` undefined, exactly as the picker already tolerates (`pickRankedPassingByChannel` checks `director_audit !== undefined` at line 647), and `summarizeDirectorNotes` already guards `if (!audit) continue;` (src/actor-orchestrator.ts:897) and reports regex failures from `script_validation.failures` independently (lines 880-895) — so dropping the dead-copy audit does not lose the regex-failure feedback that drives regeneration.
- Do not change `pickRankedPassingByChannel`, `summarizeDirectorNotes`, or `buildFeedbackWaveSummary` — they already handle undefined audits.

#### EDIT C — src/__tests__/actor-director.test.ts: re-spec the one conflicting test; the count tests stay as-is

**C1.** Re-spec the test at src/__tests__/actor-director.test.ts:435 (title "sends regex-failed candidates to the blind Director and batches regex notes into the retry wave"). Its premise inverts under skip-dead-copy. Change the title to "skips the blind Director for regex-failed candidates but still batches regex notes into the retry wave" and replace the line-473 assertion:
```ts
		  expect(directorRequests.length).toBeGreaterThan(0);
```
with:
```ts
		  expect(directorRequests.length).toBe(0);
```
Keep lines 471-472 (`expect(result.exhausted).toBe(true)`, `expect(result.picks).toHaveLength(0)`) and lines 474-475 unchanged — those still pass: the single candidate `"A game-changing launch."` script-fails (cliches), so it is never audited (`directorRequests` empty), `picks` is empty, the run exhausts after the single attempt, and the regex-format feedback still flows from `script_validation.failures` via `summarizeDirectorNotes` (line 474 `change.format` contains "game-changing"; line 475 `feedback_wave.regex_format_notes` contains "regex/format"). Verified that `summarizeDirectorNotes` populates `change.format` and `regex_format_notes` from `script_validation.failures` independent of any audit (src/actor-orchestrator.ts:880-895).

**C2.** Do NOT change the count assertions at lines 289 (`toHaveLength(20)`), 334 (`toHaveLength(10)`), 625 (`toHaveLength(30)`). Reconciliation (see Problem item 8): every audited candidate in those three tests is `"The wall moved."`, which script-passes the full `validateCandidate` path, so skip-dead-copy does not reduce the count. These three tests inject `director_client`, so the pre-warm gate also skips them. They must stay green unchanged.

**C3.** Add the new tests listed in the `Tests` field to this same file (or a sibling `*.test.ts` in src/__tests__/). Mocks must follow the existing pattern: a client object `{ messages: { create: async (params) => ({ content: [...], usage?: {...} }) } }` injected via `opts.director_client`; or a deterministic `opts.director` fn (matching `DirectorAuditFn`, src/actor-orchestrator.ts:139) for parity/concurrency/skip tests.

*(No change to src/actor-memory.ts — reference only — confirms `system_prompt` is interpolation-free; no SDK upgrade.)*

### Acceptance criteria
- **STRUCTURAL PARALLELISM** (replaces wall-clock target): the audits for one attempt are dispatched via a single bounded `Promise.all` of worker loops sharing a cursor; with a mock director that records concurrent in-flight count, observed peak concurrency is > 1 (when auditable count > 1 and cpus().length > 1) and never exceeds `Math.max(1, Math.min(8, cpus().length))`. Serial-per-candidate awaiting is gone.
- On a real live run, the fanned-out audit responses expose `usage.cache_read_input_tokens > 0` (shared Director rubric prefix served from cache) and the pre-warm response exposes `usage.cache_creation_input_tokens > 0` (it wrote the entry) — both fields exist on the widened `Anthropic.Beta.PromptCaching.PromptCachingBetaUsage` return type. In a mock test, assert instead on the captured `system` block shape (block array with `cache_control:{type:'ephemeral'}`).
- `grep -rn cache_control src/actor-director.ts` shows the ephemeral breakpoint on the Director system block in BOTH `auditCandidateWithDirector` and `prewarmDirectorCache`; the per-candidate `user` message carries the candidate text and card JSON and has NO cache_control. The Actor call retains a bare-string `system` with no cache_control.
- The real client in `auditCandidateWithDirector`, `generateActorAttempt`, and `prewarmDirectorCache` is constructed from `new Anthropic().beta.promptCaching` (the only 0.30.1 path that honors `cache_control` and returns cache token counts), and `AnthropicCreateParams` is `Anthropic.Beta.PromptCaching.MessageCreateParamsNonStreaming`. `pnpm tsc --noEmit` (or `pnpm typecheck`) passes under `strict: true`.
- The pre-warm uses `max_tokens: 1` (NOT 0); a `max_tokens: 0` request would be rejected with a 400 by the API.
- Candidates whose `script_validation.passed === false` are NEVER passed to `director(...)` — no `director_started`/`director_completed` events are emitted for them, and their record's `director_audit` stays undefined while the record still appears in `records`. In a test where one candidate fails a regex/length/movement rule, the mock director receives exactly (number of script-passing candidates) calls.
- Director verdicts are deep-equal to a serial reference run for the same inputs: given a deterministic mock director keyed on candidate text, `records[i].director_audit` for every script-passing candidate equals the serial result, and candidate order in `records` is preserved (records built in Phase 1 original order, mutated in place in Phase 2).
- The system prefix sent on every Director audit call within one run is byte-identical (no per-call timestamp/id/channel/card interpolation in the cached block); only the `user` message varies.
- Pre-warm is skipped on every mocked path: gate `opts.director === undefined && opts.director_client === undefined && opts.mode !== 'stub'`. Tests injecting `opts.director` (skip-dead-copy, parity, concurrency) and tests injecting `opts.director_client` (existing count tests) never trigger a real `new Anthropic()` construction or network call.
- The re-specced test at actor-director.test.ts:435 asserts `directorRequests.length === 0` for the regex-failed candidate while lines 474-475 still pass (regex feedback flows via `script_validation.failures`). The count tests at lines 289/334/625 stay at 20/10/30 unchanged because all their fixtures (`'The wall moved.'`) script-pass.
- Existing injected-`director_client` tests still pass: pre-warm is skipped, and the parallel fan-out still invokes the injected mock per script-passing candidate with the same args. `pnpm test` is fully green.
- The system prefix is well over the SDK/model caching minimum (the Director rubric is large), so the ephemeral breakpoint actually caches for both the default `claude-sonnet-4-6` and any Opus override via `COMMS_DIRECTOR_MODEL`.

### Tests
- **System-block-shape test:** a mock `AnthropicMessagesClient` (`{ messages: { create } }`) injected as `opts.director_client` whose `create` captures every `params.system` and `params.messages`. Assert the Director audit call passes `system` as a block array `[{type:'text', text:<rubric>, cache_control:{type:'ephemeral'}}]` (not a bare string), and that the candidate text appears only in `params.messages[0].content`, never in the system block. (This test injects `director_client`, so pre-warm is skipped.)
- **Skip-dead-copy test:** Actor result with N candidates where >=1 fails a deterministic validator rule. Reuse the existing `actorOutput('A game-changing launch.', ...)` fixture (fails `cliches`) for one x candidate, n:1, maxAttempts:1, mode:'live'. Inject a mock `opts.director` fn that increments a counter and returns a fixed passing audit. Run `orchestrateActorDirectorWithRetries`. Assert the counter equals the number of script-PASSING candidates (0 for the single cliche fixture), and that the failed candidate's record has `director_audit === undefined` while still appearing in `records`. (Injecting `opts.director` means pre-warm is skipped — no real Anthropic construction.)
- **Parity test:** run the new parallel orchestrator and a reference serial implementation against the same Actor result with a deterministic mock `opts.director` keyed on `candidate.text`; assert `records.map(r => r.director_audit)` is deep-equal between the two, proving parallelism does not change verdicts and order is preserved.
- **Pre-warm ordering test** (direct unit test of the helper): unit-test `prewarmDirectorCache` with an injected `client` whose `create` resolves only after a microtask and records a warm-completed timestamp, then a separate serial harness that records audit-call timestamps; assert the warm `create` (max_tokens:1) resolves before any audit `create` begins. (Prefer the direct helper unit test over an orchestrator-level test because the orchestrator gate skips pre-warm on every mocked path.)
- **Pre-warm-skipped-on-mock test (BOTH injection paths):** (a) run the orchestrator with an injected `opts.director_client` and assert no `max_tokens:1` warmup-shaped call reaches it (the mock only ever sees audit-shaped `max_tokens:4096` calls); (b) run with an injected `opts.director` fn and assert no real Anthropic client is constructed and no network error surfaces (e.g. assert the run completes and the `director` fn receives only audit calls).
- **Concurrency-cap test:** inject a mock `opts.director` that tracks concurrent in-flight count (increment on entry, await a deferred, decrement on exit); assert peak concurrency never exceeds `Math.max(1, Math.min(8, cpus().length))` and is > 1 when auditable candidates > 1 and cpus().length > 1.
- Re-spec the existing test at actor-director.test.ts:435 per EDIT C1: change the title, assert `directorRequests.length === 0`, keep lines 471-472 and 474-475 green.
- **Type-check:** `pnpm tsc --noEmit` (or `pnpm typecheck`) passes under strict mode with the beta-typed `AnthropicCreateParams` / `AnthropicMessagesClient` / `createMessageWithRetry` return.
- **Run the existing suite:** `pnpm test` — all current actor-director/orchestrator tests stay green, including the unchanged count assertions at lines 289/334/625.

### Gotchas
- SDK PATH IS BETA-ONLY in 0.30.1. `cache_control` and the cache `usage` fields do NOT exist on the stable `messages.create` types. You MUST construct the real client as `new Anthropic().beta.promptCaching` and type params/returns with `Anthropic.Beta.PromptCaching.MessageCreateParamsNonStreaming` / `PromptCachingBetaMessage` / `PromptCachingBetaUsage`. The SDK auto-injects the `anthropic-beta: prompt-caching-2024-07-31` header inside `promptCaching.messages.create` — do not add it manually. Do NOT upgrade the SDK for this unit.
- `new Anthropic().beta.promptCaching` is structurally `{ messages: { create } }`, identical to the existing mock-client shape, so the `AnthropicMessagesClient` interface and every existing `{ messages: { create } }` mock stay valid. Do not introduce an adapter wrapper.
- `max_tokens` MUST be >= 1. The original spec's `max_tokens: 0` pre-warm is a 400. Use `max_tokens: 1` for the warm.
- **CRITICAL ORDERING:** the pre-warm (max_tokens:1) MUST be awaited to completion BEFORE the parallel fan-out starts. A cache entry is only readable after the first request has begun; if you fire the warm and the audits together (e.g. `Promise.all([warm, ...audits])`), every parallel audit prefills the rubric independently and ALL miss the cache. `await prewarmDirectorCache(...)` then `await Promise.all(workers)` — not interleaved.
- Do NOT interpolate anything per-call into the cached system block — no timestamp, candidate id, channel, or card. Any byte change in the prefix invalidates the cache. The candidate-specific content already lives in the `user` message (after the breakpoint) via `buildDirectorUserMessage`; keep it there.
- Put `cache_control` on the LAST (here only) system block, and use block-array `system` in BOTH `auditCandidateWithDirector` and `prewarmDirectorCache`. If one uses block form and the other a bare string, the rendered bytes differ and the audit won't read the warm's entry.
- The audit and warm calls must use the SAME `voice` (hence same `memory.system_prompt`) and SAME model. `prewarmDirectorCache` rebuilds `buildDirectorMemoryPack(voice)` — pass the orchestrator's `voice` through. Caches are model-scoped, so the warm model must equal the audit model (both default to `DEFAULT_DIRECTOR_MODEL`, or both honor `opts.director_model`).
- Pre-warm gate must skip on BOTH mock-injection paths: `opts.director !== undefined` (the new tests inject the director FN, see actor-orchestrator.ts:232 `const director = opts.director ?? auditCandidateWithDirector`) AND `opts.director_client !== undefined` (existing count tests inject the CLIENT), plus `opts.mode === 'stub'`. The orchestrator sets no default `mode`, so do NOT gate on mode alone — gate on the injection flags. If you only check `director_client`, the new `opts.director` tests would trigger a real `new Anthropic().beta.promptCaching` and the pre-flight `assertLiveActorDirectorMode` throw (before the helper's try) would propagate — wasteful and flaky in CI with no API key.
- Concurrency cap is `Math.max(1, Math.min(8, cpus().length))`. Import `cpus` from `node:os`. The cap bounds WALL parallelism; the real rate limiter is the Anthropic 429/529 path already handled by `createMessageWithRetry` — do not raise the cap to fire all 35 at once.
- Preserve candidate order in `records`: build ALL records in Phase 1 (original order), then mutate `record.director_audit` in place during the parallel Phase 2. Do not rebuild `records` from `Promise.all` results (that would reorder by completion time and break the picker's per-channel grouping).
- Script-failed candidates must remain in `records` with `director_audit === undefined`. `summarizeDirectorNotes` (actor-orchestrator.ts:897 `if (!audit) continue;`) and `pickRankedPassingByChannel` (line 647 `director_audit !== undefined`) already tolerate this; their regex-failure feedback comes from `script_validation.failures` (lines 880-895), not from a Director audit, so regeneration still gets the format notes.
- Keep the widened `usage` OPTIONAL on `AnthropicMessagesClient.messages.create`. Mock clients that return only `{ content }` must still typecheck.
- Do NOT route the max_tokens:1 warm through `createMessageWithRetry` — a 1-token prefill should not be retried, and a transient warm failure must be swallowed (try/catch in `prewarmDirectorCache`) so it never blocks the run.
- EXISTING TEST CONFLICT: actor-director.test.ts:435 currently asserts the regex-failed candidate IS audited (`directorRequests.length > 0`). This is the inverse of skip-dead-copy and MUST be re-specced to `=== 0` (EDIT C1), or `pnpm test` fails. Lines 474-475 of that test stay green (regex feedback via script_validation.failures). The count tests at 289/334/625 stay UNCHANGED at 20/10/30 because every audited fixture ('The wall moved.') script-passes — verified, do not edit them.
- `prewarmDirectorCache` calls `assertLiveActorDirectorMode('Director', opts.mode, opts.client)` BEFORE the try block and BEFORE constructing the client; with no client and no `ANTHROPIC_API_KEY` it throws and that throw is NOT swallowed (it is outside the try). This is exactly why the orchestrator gate must prevent calling `prewarmDirectorCache` on any mocked path — rely on the call-site gate, not on the helper's try/catch, to keep mocked tests clean.

---

## Unit 4 — Stop the numeric-claim rule from rejecting structural carousel ordinals (false positive on slide sequence numbers)

**id:** `validator-carousel-numbering`

### Files
- `src/validator.ts` — edit
- `src/__tests__/validator.test.ts` — test
- `src/generator.ts` — reference (carousel render shape)

### Problem
The numeric tripwire used by the claim contract flags carousel slide ordinals (`"1"`, `"2"`, `"3"`, `"4"`) as numeric claims not in `deployed_facts` — a false positive. They are structural sequence numbers (the app numbers the cards), not factual figures.

**Root cause (single function, two call sites):** `extractClaimNumbers` at `src/validator.ts:355-357`:
```ts
function extractClaimNumbers(text: string): string[] {
  return text.match(/\b(?:\$?\d[\d,.]*(?:\.\d+)?%?|\d+x|\d+\+)\b/gi) ?? [];
}
```
This is consumed by `auditClaimTripwires` (`src/validator.ts:294-301`) and `auditUnsupportedClaims` (`src/validator.ts:321-328`), both of which raise an `unsupported-claim` failure for any extracted token not present in `card.deployed_facts`. `auditClaimTripwires` is the HARD gate run by default inside `validate()` (`src/validator.ts:853-855`, whenever a card is supplied and `fact_contract !== "off"`).

**Why carousel ordinals hit it:** carousel candidates are rendered to readable `.text` by `renderStructured` (`src/generator.ts:130-135`):
```ts
    case "carousel":
      return s.slides.map((sl, i) => `${i + 1}. ${sl.name}\n${sl.body}`).join("\n\n");
```
So every carousel candidate's `.text` deterministically begins each slide with `"1. "`, `"2. "`, `"3. "`, … (the candidate's `.text` field is set to this rendered string at `src/generator.ts:938` and `:1631`). The slop/claim rules run on that `.text`. Empirically confirmed: against the rendered carousel text, `extractClaimNumbers` returns `['1','2','3','4']`, and each is then flagged "numeric claim is not in deployed_facts" — a candidate that carries no in-body figures at all is rejected purely for its structural numbering.

Project intent (memory `channel-surfaces-map-to-real-platform`, `emission-architecture-vertical-flow-feedback-wave`): carousel numbering is STRUCTURAL — the app/app-alert surface numbers the cards 1:1; the copy carries no in-body digits of its own. The numbering exists only because `renderStructured` prefixes it for readability; it must not be read as a factual claim.

### Change
**Approach chosen: (b) exempt leading list ordinals.** Reason it fits the existing code best: the false positive is created entirely by `renderStructured`'s deterministic `"${i + 1}. "` prefix at line-start. Stripping that leading list-ordinal prefix before number extraction is surgical and provably safe — it removes ONLY the rendered structural prefix and leaves every in-body figure intact. Approach (a) "only flag numbers co-occurring with a unit/%/currency/x/named-quantity" was rejected as too broad: it would also stop flagging bare in-body figures the rule legitimately catches today (e.g. `"100 markets"`, asserted by the existing test at `src/__tests__/validator.test.ts:404-412`), regressing the gate. Approach (b) touches one extraction function and keeps every real-claim test green.

**Edit — `src/validator.ts`.** Add a leading-ordinal stripper and apply it inside `extractClaimNumbers` (the single chokepoint feeding both `auditClaimTripwires` and `auditUnsupportedClaims`, so one edit fixes both). Replace `extractClaimNumbers` at `src/validator.ts:355-357`:
```ts
function extractClaimNumbers(text: string): string[] {
  return text.match(/\b(?:\$?\d[\d,.]*(?:\.\d+)?%?|\d+x|\d+\+)\b/gi) ?? [];
}
```
with:
```ts
// Structural list/carousel ordinals are NOT factual claims. renderStructured()
// (generator.ts) prefixes each carousel slide with a deterministic "${i+1}. "
// at line-start; the app numbers the cards, the copy carries no in-body digits.
// Strip a leading 1–2 digit ordinal followed by ". " at the start of each line
// before extracting numeric claims, so structural sequence numbers never read as
// "numeric claim is not in deployed_facts". In-body figures (e.g. "20% APY",
// "$5", "100 markets", "10x") are untouched and still flagged.
const LIST_ORDINAL_PREFIX_RE = /^[ \t]*\d{1,2}\.(?=[ \t])/gm;

function extractClaimNumbers(text: string): string[] {
  return text.replace(LIST_ORDINAL_PREFIX_RE, "").match(/\b(?:\$?\d[\d,.]*(?:\.\d+)?%?|\d+x|\d+\+)\b/gi) ?? [];
}
```

Notes:
- The stripper is anchored to line-start (`^` with the `m` flag) and requires `\d{1,2}` followed by `.` and a space/tab — this matches `renderStructured`'s `"1. "`…`"99. "` ordinal prefix and nothing mid-sentence. A figure like `"3.5%"` (no following space after the dot) or `"Section 4. of the docs"` (not at line-start) is NOT stripped. A genuine in-body number that happens to lead a line, e.g. `"20% APY now live."`, is NOT a `\d{1,2}\.` form so it is untouched and still flagged.
- Only the structural prefix is removed; the remainder of each slide line (`sl.name` + `sl.body`) is still scanned for real numeric claims. So a carousel slide whose BODY asserts `"20% APY"` is still caught (the ordinal `"1"` is stripped, `"20"` remains and fails).
- This is the minimal change: one regex const + one `.replace()` inside the existing extractor. No call-site changes; `auditClaimTripwires` and `auditUnsupportedClaims` both benefit automatically.

### Acceptance criteria
- A numbered carousel candidate whose slide ordinals are the only digits in its rendered text PASSES the numeric tripwire: `auditClaimTripwires(<rendered carousel text with leading "1."/"2."/"3."/"4." and no in-body figures>, card)` returns `[]` (no `unsupported-claim` failure), and `validate(<same text>, { card })` does not produce an `unsupported-claim` failure for the ordinals.
- A real unsupported numeric claim still FAILS: `auditClaimTripwires("Yields up to 20% APY.", card)` (where `"20"` is NOT in `card.deployed_facts`) returns a failure with `rule === "unsupported-claim"` and reason containing `"20"`. Likewise `"Also supports 100 markets."` still flags `"100"` (the existing behavior asserted at `src/__tests__/validator.test.ts:404-412` stays green).
- No regression to the existing `auditClaimContract` / `auditClaimTripwires` / `auditUnsupportedClaims` tests, the structured-channel tests, or any other validator test. `pnpm test` is fully green.
- A leading mid-line or decimal figure is still flagged: a slide body like `"20% APY now live."` still produces an `unsupported-claim` for `"20"` when `"20"` is not in deployed_facts (the stripper does not touch it, since it is not a `\d{1,2}. ` ordinal at line-start).
- `pnpm typecheck` passes (no type-level change; `extractClaimNumbers` keeps its `(text: string) => string[]` signature).

### Tests
Add to `src/__tests__/validator.test.ts`. Both a positive (carousel numbering now passes) and a negative (real numeric claim still fails) are MANDATORY per the repo's "no validator rule without a test" rule.

- **Positive** (numbered carousel passes): build the rendered carousel text the way `renderStructured` produces it, with structural ordinals and no in-body figures, and assert no numeric `unsupported-claim` fires. Either render via the helper or inline the shape:
```ts
it("does not flag structural carousel slide ordinals as numeric claims", () => {
  const carousel: StructuredOutput = {
    kind: "carousel",
    slides: [
      { name: "Real order book", body: "Hyperliquid Spot now trades inside Infinex." },
      { name: "Same account", body: "Quote in USDC, no new wallet." },
      { name: "Start trading", body: "Switch to Spot to place your first order." },
      { name: "Onchain CLOB", body: "Every order, cancel, and trade onchain." },
    ],
  };
  const text = renderStructured(carousel); // "1. ...\n\n2. ...\n\n3. ...\n\n4. ..."
  const failures = auditClaimTripwires(text, CARD);
  expect(failures.filter((f) => f.rule === "unsupported-claim")).toEqual([]);
  // and via the composite validator (auditClaimTripwires is the default hard gate)
  const r = validate(text, { card: CARD });
  expect(r.failures.filter((f) => f.rule === "unsupported-claim")).toEqual([]);
});
```
(`renderStructured` and `StructuredOutput` are already imported in this test file at line 21; `auditClaimTripwires`, `validate`, and `CARD` are already in scope.)

- **Negative** (real numeric claim still fails): assert a genuine in-body figure not in deployed_facts is still rejected, including the case where it leads a carousel slide body:
```ts
it("still flags a real numeric claim not in deployed_facts (carousel ordinals exemption is structural only)", () => {
  // bare in-body claim
  const r1 = auditClaimTripwires("Yields up to 20% APY.", CARD);
  expect(r1.map((f) => f.rule)).toContain("unsupported-claim");
  expect(r1.map((f) => f.reason).join("\n")).toContain("20");

  // numbered carousel whose BODY still asserts an unsupported figure
  const carousel: StructuredOutput = {
    kind: "carousel",
    slides: [
      { name: "Big yields", body: "20% APY now live." },
      { name: "Real order book", body: "Hyperliquid Spot trades inside Infinex." },
      { name: "Start trading", body: "Switch to Spot to begin." },
    ],
  };
  const r2 = auditClaimTripwires(renderStructured(carousel), CARD);
  expect(r2.map((f) => f.rule)).toContain("unsupported-claim");
  expect(r2.map((f) => f.reason).join("\n")).toContain("20");
  // the structural ordinals 1/2/3 are NOT flagged — only "20" is
  expect(r2.map((f) => f.reason).join("\n")).not.toMatch(/"1"|"2"|"3"/);
});
```

- Run the validator suite: `pnpm vitest run src/__tests__/validator.test.ts` — zero failures, including the pre-existing `"fails when copy asserts an extra numeric claim outside deployed_facts"` (`100 markets`, line 404) and the structured-channel carousel tests (lines 74-107).

### Gotchas
- Edit the SHARED extractor `extractClaimNumbers`, not the two call sites. Both `auditClaimTripwires` (the default hard gate inside `validate()`) and `auditUnsupportedClaims` (the strict-mode path) call it; fixing it once covers both and keeps them from drifting.
- Use approach (b) — line-leading ordinal strip — NOT approach (a) — "require a co-occurring unit." Approach (a) would also stop flagging bare in-body figures the rule legitimately catches (`"100 markets"` at `src/__tests__/validator.test.ts:404` has no unit), regressing the negative test. State this choice in the commit.
- The stripper MUST be line-anchored (`^…` + `m` flag) and require a trailing space/tab (`(?=[ \t])`). Do NOT use a global non-anchored `\d{1,2}\.` strip — that would eat decimals like `"3.5"` mid-sentence and blind the gate to real claims.
- `$5M` is NOT caught by the existing numeric regex (the `M`/`K`/`T` suffix breaks the `\b` boundary — verified: `"$5M".match(...) === null`), so do NOT use `$5M` as the negative test fixture expecting a failure; it would fail today too and is out of scope for this unit. Use `"20% APY"` (catches `20`) or `"$5"`/`"$5,000,000"` (catches `5`/`5,000,000`) instead. Do NOT expand the rule to catch `M`/`K`/`T` suffixes here — that is a separate concern, not this false-positive fix.
- Do NOT touch the URL tripwire (`extractUrls`) or the readiness/assertive-claim extractors — they are unaffected by carousel numbering.
- The `CARD` fixture in the test file (`src/__tests__/validator.test.ts:25-34`) has `deployed_facts: ["Fact A is live", "Fact B stays private"]` — neither contains `"1"`, `"2"`, `"20"`, or `"100"`, so the assertions above are valid against it without adding numeric facts to the card.

### Review note (residual)
This unit was authored against the real `src/validator.ts` / `src/__tests__/validator.test.ts` and the carousel render path was verified empirically (ordinals `['1','2','3','4']` extracted today; stripped to `[]` after the fix; `20%`/`100`/`$5` still extracted). The chosen approach (b) is stated with file:line justification per the task. No outstanding blockers.

---

## Verification

Run after each unit lands, and once more after all four:

1. **Tests green.** `pnpm test` (= `vitest run`) — entire suite passes, including the unchanged Director-call-count assertions (`actor-director.test.ts` lines 289/334/625 at 20/10/30) and the re-specced regex-failed test at line 435 (`directorRequests.length === 0`). `pnpm typecheck` and `pnpm typecheck:harness` both clean.
2. **Carousel numbering (Unit 4).** Confirm a numbered carousel candidate passes the numeric tripwire: `auditClaimTripwires(renderStructured(<carousel with structural ordinals, no in-body figures>), CARD)` returns no `unsupported-claim` failure, while `"20% APY"` (not in deployed_facts) still fails.
3. **Director perf (Unit 3).** On a real ≥35-audit live run, confirm `usage.cache_read_input_tokens > 0` on the fanned-out audit responses and `usage.cache_creation_input_tokens > 0` on the pre-warm response; confirm wall-clock drops from ~35 min (serial) toward ~5 min (bounded parallel). In CI/mock, confirm the system-block-shape test (`cache_control:{type:'ephemeral'}` block array) and the concurrency-cap test (peak in-flight > 1, ≤ `min(8, cpus().length)`).
4. **Zero-pass regeneration (Unit 1).** Confirm a channel that ends a round with zero passing candidates triggers a bounded regeneration with the new `channel_regeneration_targeted` run event (payload names the zero-pick channel), capped at once per channel, and no-op on the final attempt (`maxAttempts: 1`).
5. **Harness back-edge (Unit 2).** Confirm a harness run whose Actor emits fact_requests records `fact_requests_collected` + `fact_requests_answered` rows; confirm a grounder throw records `fact_request_grounding_error` and the run continues (does not crash), with candidates still persisted.
