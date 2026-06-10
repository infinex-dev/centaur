# Codex handover — make the harness generator a background job (kill "failed to fetch")

## Context (what this repo is)
`comms-factory` is a comms pipeline. The **training harness** (`harness/`, Next.js 15 + better-sqlite3) is an internal review tool to drive the Actor→Director generation pipeline and inspect output. It is NOT production. This task is **purely a harness orchestration/UX refactor + two robustness fixes** — do NOT change the pipeline logic, the Actor/Director prompts, the Mirodan voice memory, or the validator rules.

## The problem (root cause, already diagnosed — do not re-investigate)
The generator runs as **one ~7-minute synchronous server action the browser awaits**:
- `harness/components/GenerateControls.tsx:46` → `await runGenerator(cardId, selected)`. The action calls `orchestrateActorDirectorWithRetries` (Opus actor generates 7 surfaces + a per-surface Director feedback wave). Observed in logs: `POST /cards/<id> 200 in 433695ms` (7.2 min).

Everything broken follows from that synchronous await:
1. **"failed to fetch"** — the browser times out on the 7-min request and the `catch` at `GenerateControls.tsx:48-49` shows "failed to fetch", *even though the server completes and returns 200*. The work isn't failing; the request is just too long.
2. **No live visibility** — it's a black-box `await` + spinner. Events ARE written live to the `actor_run_events` table (via `persistActorRunEvent`, `harness/app/actions/generate.ts:~859`, passed as the orchestrator's `onEvent`), and a polling endpoint **already exists**: `GET /api/cards/[id]/actor-events` (returns 200 in logs). But the card page doesn't render that stream during a run.
3. **Duplicate concurrent runs** — because it looks failed, the operator re-clicks; each click spawns another full 7-min run on the same card (multiple long POSTs observed, interleaving in the DB).
4. **Channels untick** — `selected` is `useState` initialized from card audience (`GenerateControls.tsx:31-33`). The generator "phase" swaps the component in/out of the DOM; on every re-render/remount (after a failed fetch or completion) `selected` resets to the default, wiping the operator's toggles.
5. **Actor JSON parse can hard-fail** — observed `SyntaxError: Expected ',' or ']' ... JSON at position 13895` on the large 35-candidate Opus response. Grep for the `No JSON object found` throw (around `src/actor-director.ts:~1564`); a malformed response kills the whole run instead of retrying.

## Required outcome
Clicking **generate** returns immediately, the live trace streams in the UI within ~2s and updates through completion, re-clicking during an active run is refused, channel selection persists, and a malformed actor response retries instead of failing the run.

## Implementation spec

### 1. Background job (the core fix)
Refactor `runGenerator` (`harness/app/actions/generate.ts`) from "await the whole run" to "kick off + return immediately":
- On invoke: create/locate a run record with a status (`running`), `started_at`, `run_id`, `card_id`. Reuse the existing `actor_run_events` `run_id` and add a lightweight run-status row — check whether `pipeline_runs` or a new `actor_runs` table fits; prefer the smallest change consistent with existing tables. Status values: `running | completed | failed`.
- **Dedupe:** if a `running` run already exists for the card, refuse to start another (return the existing `run_id`, do not spawn). This kills duplicate concurrent runs.
- Start `orchestrateActorDirectorWithRetries(...)` **without awaiting it in the request**. better-sqlite3 is synchronous and the harness is a single Node process, so run the orchestration as a detached async task in-process — **do NOT add a queue/worker/external infra**. Capture completion and errors: on resolve set status `completed` + `completed_at`; on reject set status `failed` + persist the error (write a terminal event too — see #4). Ensure unhandled rejections in the detached task are caught and recorded, never lost.
- Return `{ run_id }` to the client synchronously.

### 2. Live-trace polling UI
- On generate: client calls the kickoff action, gets `run_id`, then polls `GET /api/cards/[id]/actor-events` (already exists) every ~2s and renders the event stream (timestamp · event_type · channel · message) for the **active card** (the bug today is the poller hitting a stale card — make it always the card being viewed). Also poll/refresh candidates as they land.
- Stop polling when a terminal event / run status `completed|failed` is seen; show the final state (and the error on failure).
- Disable the generate button while a run is `running` for this card.

### 3. Persist channel selection
- Stop `selected` (`GenerateControls.tsx:31`) from resetting on re-render/remount. Either lift it to a stable parent that isn't unmounted by the phase swap, persist to `localStorage`/URL keyed by card, or stop unmounting the controls during "generating". Operator toggles must survive the full run lifecycle.

### 4. Terminal run events
- Have the orchestration emit explicit terminal events through the existing `onEvent` sink: `run_completed` (with candidate counts) and `run_failed` (with the error message), and set the run-status row accordingly. The poller uses these to know when to stop. (Today the trace just stops with no terminal signal.)

### 5. Harden actor JSON parse
- Where the actor response is parsed (grep `No JSON object found`, ~`src/actor-director.ts:1564`), on a `SyntaxError`/parse failure retry the actor call a bounded number of times (e.g. 2) before failing the attempt. A single malformed Opus response must not kill the whole run. Keep this minimal and within the existing retry structure if one exists.

## Constraints / do NOT touch
- Do not modify pipeline semantics: `src/actor-director.ts` / `src/actor-orchestrator.ts` Mirodan/voice logic, the Director memory (`src/actor-memory.ts`), `src/validator.ts` rules, the emission/flow logic. Only add the terminal-event emissions (#4) and the parse-retry (#5).
- Do not add external job queues, Redis, workers, or new services. In-process detached task + DB-backed status only.
- Keep the `actor_run_events` schema and the orchestrator `onEvent` contract intact (it already emits the right per-surface events).
- Match existing harness patterns (see `grounder_runs` for the started_at/completed_at/error + events_json shape — a good model for run status).

## Acceptance criteria
1. Generate returns immediately; **no "failed to fetch"**; trace streams live in the UI and updates to completion.
2. Re-clicking generate while a run is active is refused (no duplicate concurrent runs in `actor_run_events`).
3. Channel toggles persist across the entire run lifecycle (no unticking).
4. A malformed actor JSON response retries; the run survives.
5. Candidates appear in the UI as they land; a clear terminal (done/failed) state shows at the end.
6. `pnpm --dir harness typecheck` (or `npx tsc --noEmit -p harness/tsconfig.json`) and `npx tsc --noEmit -p tsconfig.json` both pass.

## Key files
- `harness/components/GenerateControls.tsx` — run() await (`:46`), selected state (`:31`), error catch (`:48`)
- `harness/app/actions/generate.ts` — `runGenerator`, `persistActorRunEvent` (~`:859`), orchestrate call (~`:623`), `runActorGenerator` (~`:566`)
- `harness/app/api/cards/[id]/actor-events/route.ts` — existing poll endpoint (verify path)
- `harness/app/cards/[id]/page.tsx` — card page / generate tab
- `src/actor-orchestrator.ts` — `orchestrateActorDirectorWithRetries` (emit terminal events here)
- `src/actor-director.ts` — actor response parse (harden; grep `No JSON object found`)
- DB tables: `actor_run_events`, `candidates`, `grounder_runs` (pattern), `pipeline_runs` (candidate for run status)
