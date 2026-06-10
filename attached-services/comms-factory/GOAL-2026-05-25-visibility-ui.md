# GOAL — full pipeline visibility in the harness UI

You are picking up work mid-stream on **comms-factory** at `/Users/opaque/.superset/projects/comms-factory`. The project's `CLAUDE.md` + auto-memory (`MEMORY.md`) will auto-load and tell you the architecture, vocabulary, and operator preferences. Read those first. Do not invent terminology — call things **generator** and **validator** only (see `feedback-pipeline-vocabulary` memory for why).

## What just happened (last 6 commits)

Latest first:

1. **`0e3352d`** — LLM validator is now the default in the harness (was opt-in via `HARNESS_ACTIVE_VALIDATOR=1`; now opt-out via `=0`). Fails loud if `ANTHROPIC_API_KEY` is missing while LLM validator is on. Em-dash rule is zero-tolerance (`EM_DASH_MAX_PER_WINDOW = 0`).
2. **`5367d28`** — Reset-generator button on the harness card page. Wipes candidates + audits + decisions + edits + final picks for the active card. Resets the per-channel retry counter.
3. **`6d66869`** — `TempoBeat.tempo` made optional to match the generator's two-call no-tempo path. Cascade from `c72f77f`.
4. **`c72f77f`** — Stripped tempo from the generator's beat-plan entirely. Mirodan: the actor never picks tempo; tempo emerges from the verb under the inner work; the audience (validator) perceives it.
5. **`1628ae4`** — Validator acceptance flipped from "classified == declared" to "classified ∈ voice.tempi" (placement-membership rather than declaration-match).
6. **`9316d99`** — Handovers, plan, product maps, lateral + audit reports captured.

**Test state:** 170/170 pass; tsc clean across pipeline and harness.

## The bug that triggered this work

Operator walked the bridge card through the harness. **All 12 candidates failed.** Autopsy (see `research/autopsy-bridge-card-fail-2026-05-25.html` and `research/audit-2026-05-25-*.md`) revealed:

- The fact-contract validator does literal token matching against 100-250-character `deployed_facts` strings. Tweets are 280 chars. The model paraphrases correctly; the validator can't see paraphrase as truth. **Root cause of ~10 cascading failures per candidate.**
- The LLM validator (the agentic auditor with research tools in `src/validator-active.ts`) wasn't running because the env var was opt-in. `candidate_audits` table had 0 rows for the bridge card. Operator only saw deterministic regex failures, including "X unknown" tempo signals from the regex blind classifier.
- Per-attempt history is invisible. The harness UI shows the latest attempt's candidates only. The operator can't see what failed in attempt 1, what feedback was passed to attempt 2's generator, what attempt 2 produced, etc.
- The feedback string IS being generated (`src/orchestrator.ts:312`, `summarizeFailures`) and passed to the next attempt — but it's never persisted to the DB, and the UI has no place to surface it.

The 0e3352d commit addressed the LLM-validator-not-running issue and the em-dash issue. **It did NOT address the visibility issue.** That's the headline of this goal.

## Your mission

**Make the entire generator ↔ validator flow visible and debuggable in the harness UI**, with no "trust the magic" black boxes. Operator's exact words:

> I want to see prompt. I want to be able to like click out to see the prompt. I want to see what the prompt is and then what the generator has come up with. I want to see that and then I want to see what the validator has failed it on. And then I want to see the next prompt that's been passed to the generator. I want to see that flow. I want to see that in ad infinitum. I want to be able to see every visible part of it, otherwise I'm working blind.

The acceptance shape:

- For each `(card, channel)` combo, the harness shows an **accordion of attempts** (attempt 1, 2, 3 — up to the retry cap).
- For each attempt the operator can click into:
  - **The auto-feedback string** that was passed to the generator before this attempt produced (empty for attempt 1; non-empty for retries — built from prior attempt's first-failure summary).
  - **The generator's full prompt** — system + user — that was sent for this attempt.
  - **The candidates produced** for this attempt (already shown today; just regroup under the attempt).
  - **For each candidate:** the regex failures (what the deterministic layer flagged), the LLM validator's full reasoning (currently in `candidate_audits.active_audit_json`), the tempo classification with rationale (when the LLM validator runs — surface what `independent_classification` returned).
- Nothing should silently disappear into a black box. If a layer didn't run (e.g., LLM validator disabled), the UI says so explicitly with a banner.

## What to build (deliverables)

### 1. Persistence: capture the generator's prompt per attempt

The generator currently builds prompts internally and discards them. The harness needs to see them.

**Approach:**
- Extend `generate()` in `src/generator.ts` to optionally return prompts alongside candidates. Two shapes:
  - The "inner-work step" prompt (system + user) used to produce `InnerWork`.
  - The "drafting step" prompt (system + user) used to produce the candidates from `InnerWork`.
- Wrap the return as `GenerateResult = { candidates: Candidate[]; prompts?: { inner_work?: PromptPair; drafting?: PromptPair } }` where `PromptPair = { system: string; user: string }`.
- The default `generate()` signature can stay the same to avoid breaking other callers — add an `opts.capturePrompts: boolean` flag that flips the return shape (or make it always return `{ candidates, prompts }` and adjust callers).
- The two-call path (`generateInnerWork` + `draftFromInnerWork`) should expose individual prompt-capture too.

### 2. Persistence: store prompts + auto-feedback per attempt

DB schema lives at `harness/lib/schema.sql`. Currently the `candidates` table has `card_id`, `channel`, `attempt`, `text`, etc. — but no place for the prompt or the auto-feedback that fed THIS attempt.

**Two options:**
- **(a)** Add columns to `candidates`: `inner_work_prompt_json TEXT`, `drafting_prompt_json TEXT`, `auto_feedback_in TEXT`. Per-row, denormalized — each candidate carries its attempt's metadata. Storage waste is small.
- **(b)** Create a new `generator_attempts` table keyed on `(card_id, channel, attempt)` with one row per attempt. Candidates reference it by `attempt_id` (already implicit via `card_id, channel, attempt`).

**(b) is cleaner.** Prefer it. Pick (a) only if you find a reason in implementation.

The `harness/app/actions/generate.ts` `generateForChannel` function already loops attempts via `orchestrateActiveWithRetries` / `orchestrateWithRetries`. The orchestrator builds the feedback string at `src/orchestrator.ts:312` and passes it to the next `generateAttempt`. To persist:
- The orchestrator's `runActiveOrchestrationForHarness` (in `harness/app/actions/generate.ts`) needs to capture the feedback string + prompts per attempt.
- Persist before inserting the attempt's candidates.

### 3. Persistence: nothing else is needed for the LLM auditor

`candidate_audits` already stores `active_audit_json` (the full LLM auditor response). After the 0e3352d commit, this table will populate when you run the generator. **Verify it does** — run the generator on the bridge card, query `SELECT COUNT(*) FROM candidate_audits;` — should be non-zero.

### 4. UI: per-attempt accordion in the Generate panel

Card detail page is at `harness/app/cards/[id]/page.tsx`. The Generate panel renders candidates grouped by channel via `candidates_by_channel`. **Change the grouping:** group by `(channel, attempt)`. Render an accordion per `(channel, attempt)` showing:

- **Header:** "Attempt 2 · web · 2 candidates · all rejected"
- **Body (when expanded):**
  - Auto-feedback chip at top (collapsible textarea, monospace). Empty for attempt 1.
  - "Generator prompt" expandable (collapsible textarea, monospace) — shows the system + user prompts from the persistence layer.
  - Candidates list (existing `CandidateCard.tsx` component, possibly modified).

### 5. UI: surface the LLM validator's reasoning per candidate

Currently `CandidateCard.tsx` shows the candidate's text + a few summary fields. Extend it:

- New "Validator" expandable section with sub-sections:
  - **Regex layer:** the existing `validation_failures_json` (already shown today, just reorganize). Include the pass/fail badge.
  - **LLM auditor:** read from `candidate_audits.active_audit_json`. Parse and show: tool calls made (the audit research used `platform-code` / `partner-registry` / `infinex-page` / `projectjin` tools), reasoning text, final verdict, the independent classification (tempo + confidence + rationale).
  - **Tempo:** show the classified tempo (from the LLM auditor's `independent_classification.tempo` when available; fall back to the regex blind classifier). When `unknown`, render explicitly as "unclassified — prose didn't match any of the voice's locked tempi" — see `research/autopsy-bridge-card-fail-2026-05-25.html` for the rationale.

### 6. UI: degraded-mode banner

If `HARNESS_ACTIVE_VALIDATOR=0` is explicitly set (regex-only mode), render a banner at the top of the Generate panel: **"⚠ Regex-only validation mode — LLM auditor disabled. Validation is pattern-matching, NOT claim-validity reasoning. Re-enable with `HARNESS_ACTIVE_VALIDATOR=1`."** Operator chose this mode explicitly; the harness should make the consequences visible.

### 7. Reset is per-attempt and per-card

The existing reset button (`GenerateControls.tsx`) wipes the whole card. **Add a per-attempt reset.** Each attempt's accordion header gets a small "reset this attempt" link that deletes just that attempt's candidates (and downstream rows for those candidates) — useful when you want to retry one bad attempt without nuking attempts 1-2.

## Constraints (read carefully)

- **Terminology:** generator and validator only. Do not introduce "Stage A / Stage B" or "active validator" in operator-facing UI text. Internally the code uses those names — leave them; just don't surface in chat or labels. See memory: `feedback-pipeline-vocabulary`.
- **No emojis in code or UI unless operator explicitly asks.** No emojis in commit messages or in chat with the operator.
- **Match repo commit style:** terse imperative subject, optional body, no Co-Authored-By trailer (existing commits don't have it). Use HEREDOC for commit messages.
- **Don't refactor the pipeline contract.** `card → generator → validator → orchestrator → renderer → ship gate` is the locked shape per project `CLAUDE.md`. The visibility UI rides on top of this, doesn't redesign it.
- **Don't kill the regex validator.** Operator floated the idea but said "not yet" — regex is the cheap pre-filter; LLM is the gating voice. Both stay.
- **Tests:** every non-trivial code change ships with tests. Run `pnpm test` from the repo root before any commit. Currently 170/170 pass.
- **TSC:** keep `pnpm tsc --noEmit` clean in BOTH the pipeline (repo root) AND the harness (`cd harness && pnpm tsc --noEmit`).
- **No silent failures.** If something can fail (missing API key, missing voice, off-spec data shape), throw with a clear error message, not fall back to a degraded path.

## Order of operations (suggested)

1. **First:** restart the harness dev server (the 0e3352d env-default change needs a fresh process). Verify the dev server boots on `:3210`. Hit the bridge card, click the reset button (just landed), run the generator. **Observe what the LLM auditor surfaces.** This is information that should shape the UI before you build it.
2. **Then:** persistence layer. Schema migration (new `generator_attempts` table or new columns). Generator-prompt capture. Auto-feedback persistence. Verify with raw SQL queries.
3. **Then:** UI build. Per-attempt accordion. Validator reasoning surface. Tempo explanation. Degraded-mode banner. Per-attempt reset.
4. **Then:** end-to-end check. Walk the bridge card. Click into every attempt. Verify you can see prompt → candidate → failure → next prompt — the whole flow.
5. **Last:** if the LLM auditor still flags semantically-correct paraphrased candidates as fact-contract failures, restructure `deployed_facts` as `{id, label, full}` so the literal checks run against short labels. This is the only path that was deferred from the autopsy. Skip unless you observe the regression.

## Verification

Operator should be able to:
1. Visit `http://localhost:3210/cards/01KS6QJNEGFYP6X048V8Y900DM` (the bridge card).
2. Click into "Generate · attempt 3 · x · 2 candidates."
3. See the auto-feedback string that was generated from attempt 2's failures and passed into attempt 3's generator prompt.
4. Click "show prompt" — see the full inner-work and drafting prompts that the generator received.
5. Pick one candidate, click "validator reasoning" — see the LLM auditor's tool calls, reasoning, verdict, tempo classification.
6. Click "reset this attempt" — only attempt 3's candidates go; attempts 1-2 persist for comparison.
7. Hit "run generator" — get attempt 4 with full visibility from the start.

## Open questions (decide as you go OR ask the operator)

- For the prompt persistence, do we store the full system + user prompt every time (cheap; some redundancy across attempts) or hash and dedupe? **Default to full + redundant; debug visibility beats storage efficiency at this scale.**
- For the auto-feedback string, should the operator be able to EDIT it before triggering the next attempt? (i.e., override the orchestrator's auto-summary with hand-written guidance.) **Probably yes, eventually. Out of scope for v1 — note as a follow-up.**
- The LLM auditor's `active_audit_json` is dense (tool calls, reasoning, verdict). Render as a structured tree, or as raw JSON in a `<pre>`? **Structured tree is operator-friendly; raw JSON is fastest to ship. Default to structured; expose a "show raw JSON" toggle.**

## Where to find context

- Project rules + pipeline contract: `CLAUDE.md` at repo root.
- Operator preferences + memory: `~/.claude/CLAUDE.md` and `MEMORY.md` (auto-loaded).
- The autopsy: `research/autopsy-bridge-card-fail-2026-05-25.html`.
- The audit reports from earlier today: `research/audit-2026-05-25-{A-src,B-harness,C-tools,D-narrative}.md`.
- The product map (post-audit-corrected): `research/product-map-2026-05-25.html`.
- The Mirodan tempo-emergence finding: `research/tempo-emergence-2026-05-25.html`.

## Operator communication style

Terse. No fluff. No trailing summaries. No "I'll now…" preambles. No emojis. Plain sentences over bullet lists when the answer is short. Direct over hedging. If something is wrong, name it; don't sandbag the bad news. Long output → file, not chat.

## What you're NOT doing

- Restructuring `deployed_facts`. Only if the LLM auditor still flags paraphrased candidates after this work lands.
- Touching the generator's no-tempo semantics. That landed in `c72f77f`/`6d66869` and is correct per Mirodan.
- Adding new validator rules. The em-dash rule is the only recent change; that's enough.
- Building the ship gate. Out of scope for this goal.
