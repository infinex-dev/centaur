---
title: "fix: Consistent grounding depth + drop mis-scoped brief gate + readable generation error"
type: fix
status: active
date: 2026-06-09
---

# fix: Consistent grounding depth + drop mis-scoped brief gate + readable generation error

## Overview

Three fixes for the comms-factory release pipeline, all root-caused by investigation this
session (live grounding runs + code trace):

- **Issue 1 (high):** grounding depth is inconsistent — the *same* brief produced 2 facts one run
  and 7 another. The `/ground` route never sets a git ref, so the grounder's deterministic
  "sweep the branch for salient facts" behavior (gated on a ref) never fires, leaving depth to model
  discretion; the route also caps `max_turns` at a low 4.
- **Issue 2 (medium):** the pre-generation brief-validation gate runs **publishable-copy allergen
  rules** (cliché, em-dash) on the operator's **brief**, rejecting legitimate briefs ("leverage", an
  em-dash). Decision: **remove the gate** (overlay) — copy quality is already enforced on generated
  candidates.
- **Issue 3 (low):** generation failures surface as a raw dict in Slack; humanize the message.

Cross-repo: Issues 1 lives in the **comms-factory service** (PR #3); Issues 2–3 live in the **centaur
overlay**. The `repo_context` tool, repo availability, and tool wiring are **fine** — confirmed (repo
available, 50+ matches for perps, `search` + deep `read_range` both wired). This plan does not touch
them.

---

## Problem Frame

Evidence gathered this session:

- Grounding the brief *"Infinex perps are powered by Hyperliquid with up to 50x leverage on majors"*
  twice: once **2 facts / 1 search**, once **7 facts / 10 repo_context calls** (the deep run even
  fact-corrected the brief — max leverage is 40 not 50, added Lighter venue, 100+ markets). Same
  input, same path. The Collector Crypt brief grounded **15 facts** because it carried many literal
  claims. So depth tracks (a) how many literal claims the brief has and (b) whether the deep sweep
  fires — and the sweep is unreliable.
- Root cause for Issue 1: `services/api/routes/ground.ts` builds the grounder `opts` (surface, job,
  tool_executor) but **never sets `opts.ref`**. The sweep is gated on a ref in
  `src/fact-grounder-llm.ts:184` (and the ref system-prompt block ~144-151). No ref → no reliable
  sweep. Contributing: `ground.ts:16` `maxTurns = boundedInteger(body,"max_turns",4,1,6)` (default 4,
  cap 6) vs the grounder's native `DEFAULT_MAX_TURNS = 16`.
- Issue 2: `overlays/comms-factory/workflows/comms_release.py` calls `validate` on the brief
  (surface `"brief"`), but the service `validate()` ignores `surface` (`services/api/routes/audit.ts:13`,
  `src/validator.ts` RULES always run), so allergen rules hit the brief. Redundant with
  candidate-level validation (orchestrator strips em-dashes + runs RULES + Director per candidate).
- Issue 3: the generation-error branch posts a raw dict (`f"...{generation}"`), the same UX problem
  already fixed for validation this session via `_format_validation_failure`.

---

## Requirements Trace

- R1. Grounding via `ground_from_tools` reliably performs the deep discovery sweep (not left to model
  discretion) so depth is consistent across runs of the same brief.
- R2. The `/ground` grounder runs against a defined git ref (default: the repo's default branch) when
  the caller supplies none.
- R3. The `/ground` `max_turns` ceiling is raised so the grounder can dig (default well above 4).
- R4. The pre-generation brief-validation gate is removed; a brief containing copy-allergen words
  (e.g. "leverage", an em-dash) proceeds to grounding instead of being rejected.
- R5. Copy-quality enforcement is preserved on generated candidates (unchanged) after removing the
  brief gate.
- R6. Generation failures surface a human-readable Slack message (operation + reason + guidance), not
  a raw result dict.

---

## Scope Boundaries

- Not changing `repo_context`, repo availability, or the tool wiring (`centaur-research.ts`) — they
  work.
- Not changing candidate-level validation, the Director audit, or em-dash stripping on candidates
  (R5 — left intact).
- Not changing the `comms_audit` workflow.
- Not making the service `validate()` surface-aware (the rejected alternative for Issue 2).

### Deferred to Follow-Up Work

- **Resolve the actual launch/feature branch** for grounding (vs defaulting to the repo default
  branch). The brief on the Centaur path names no branch; true launch-branch resolution would need
  Centaur-side discovery (e.g. `repo_context.discover_refs`). This plan defaults to the repo default
  branch, which reliably fires the sweep; launch-branch resolution is a later enhancement.

---

## Context & Research

### Relevant Code and Patterns

**comms-factory service** (Target repo: `infinex-dev/comms-factory`, branch
`feat/centaur-integration-on-director` = PR #3; checkout at `~/src/comms-factory-rebase`):
- `services/api/routes/ground.ts` — `/ground` handler; builds grounder `opts` (~62), `max_turns`
  bound (~16), tool_executor wrapper (~78), `groundFacts(brief, opts)` (~86).
- `src/fact-grounder-llm.ts` — `groundFacts`, `buildGrounderSystemPrompt`; ref block ~144-151,
  discovery-sweep instruction ~184, finishing instruction ~243, `DEFAULT_MAX_TURNS=16`.
- `src/centaur-research.ts` — logical-tool → `repo_context.search`/`read_file`/`read_range` mapping
  (already correct; reference only).
- Tests: `services/api/server.test.ts`, `src/__tests__/fact-grounder-llm.test.ts`.

**centaur overlay** (this repo, branch `feat/comms-factory-overlay`):
- `overlays/comms-factory/workflows/comms_release.py` — brief gate ~64-82 (`validate_brief` call +
  `_format_validation_failure`); generation-error branch ~340-356 (`_post_blocked_tool_result` /
  `_generation_result_error`); `_format_validation_failure` + `_VALIDATION_RULE_HINTS` helpers.
- Tests: `overlays/comms-factory/tests/test_comms_workflows.py`.

### Institutional Learnings

- [[overlays-no-typescript-injection]] — overlay changes are Python-only; the service is a separate
  repo/image pinned by `COMMS_FACTORY_REF`.
- [[comms-factory-combined-branch]] — service image builds from the **pinned, pushed** ref, so service
  (Issue 1) changes need commit→push→pin-bump; overlay (Issues 2–3) changes build from the working
  tree via `just comms-factory-up`.

---

## Key Technical Decisions

- **Issue 1 — set a ref + raise max_turns, rather than re-architecting discovery.** Defaulting
  `opts.ref` to the repo's default branch is the smallest change that reliably fires the existing deep
  sweep; raising `max_turns` lifts the ceiling. Launch-branch resolution is deferred.
- **Issue 1 — also decouple the sweep from a feature-branch assumption.** The ref system-prompt block
  says "the launch's feature branch, a SUPERSET of main"; when the ref is the default branch that
  wording is misleading. Adjust so the sweep instruction is reliably active and the wording is correct
  for a default-branch ref. (Reinforces R1 beyond just setting a ref.)
- **Issue 2 — remove the brief gate (overlay), don't soften.** Per decision. Copy allergens belong on
  candidates, not the brief; the gate is redundant. Removing it makes `_format_validation_failure` +
  `_VALIDATION_RULE_HINTS` dead → delete them and their tests.
- **Issue 3 — mirror the validation-message helper.** Add a `_format_generation_failure` analogous to
  the (now-removed) validation formatter, including a "transient — retry" hint since the observed 500
  was a transient Anthropic overload.

---

## Open Questions

### Resolved During Planning

- Brief-gate fix approach: **remove it (overlay)** — user decision.
- Does setting `opts.ref` to the default branch fire the sweep? Yes — the sweep + ref prompt block are
  gated on `opts.ref` being truthy; any ref activates them (U2 also makes this robust).
- Is the repo/tool at fault? No — ruled out (repo available, rich, tools wired).

### Deferred to Implementation

- Exact new `max_turns` default/cap values (e.g. default ~10, cap ~16) — pick during implementation.
- Exact default-ref source in `ground.ts` (literal `"main"` vs reading the repo's reported default
  ref) — decide when touching the code; either satisfies R2.

---

## Implementation Units

- [ ] U1. **`/ground`: default the grounder ref + raise the turn ceiling** *(Target repo:
  `infinex-dev/comms-factory`, PR #3)*

**Goal:** Make `ground_from_tools` reliably search deeply by giving the grounder a ref and more turns.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `services/api/routes/ground.ts`
- Test: `services/api/server.test.ts`

**Approach:**
- When the request supplies no ref, set `opts.ref` to the repo's default branch (literal `main` or the
  repo-reported default) so the deep-sweep precondition is met on every `ground_from_tools` call.
- Raise the `max_turns` default and cap (from default 4 / cap 6) to a higher ceiling (e.g. default ~10,
  cap ~16) so the grounder can iterate; keep it caller-overridable.

**Patterns to follow:**
- Existing `opts` assembly + `boundedInteger` usage in `services/api/routes/ground.ts`.

**Test scenarios:**
- Happy path: POST `/ground` (tool mode) with no `ref` → grounder is invoked with a non-empty ref
  (assert via the route's option assembly / a spy on `groundFacts`, mirroring how `server.test.ts`
  exercises routes).
- Happy path: no `max_turns` in body → effective max_turns equals the new default (> 4).
- Edge case: `max_turns` above the new cap → clamped to the cap; below 1 → clamped to 1.
- Edge case: caller supplies an explicit `ref` → it is used as-is (not overridden by the default).
- Note: end-to-end *depth* (fact count) is validated E2E (see Verification), not unit-asserted.

**Verification:**
- Re-grounding the Hyperliquid brief several times yields consistently richer results (no more
  2-fact runs); unit tests for ref-defaulting + max_turns bounds pass.

---

- [ ] U2. **Make the discovery sweep reliable regardless of ref shape** *(Target repo:
  `infinex-dev/comms-factory`, PR #3)*

**Goal:** Ensure the grounder always performs the salient-facts sweep and that the ref prompt wording
is correct when the ref is a default branch (not a feature branch).

**Requirements:** R1

**Dependencies:** U1 (U1 guarantees a ref is present; U2 makes the sweep robust given one)

**Files:**
- Modify: `src/fact-grounder-llm.ts` (`buildGrounderSystemPrompt` — ref block ~144-151, sweep
  instruction ~184, finishing ~243)
- Test: `src/__tests__/fact-grounder-llm.test.ts`

**Approach:**
- Adjust the discovery-sweep instruction so it reliably directs the grounder to sweep the resolved ref
  for the product's salient, comms-relevant attributes — not phrased as conditional on a *feature*
  branch specifically.
- Fix the ref-block wording so it is accurate when the ref is a default branch (avoid asserting "the
  launch's feature branch, a SUPERSET of main" when the ref is `main`).

**Patterns to follow:**
- The existing `buildGrounderSystemPrompt` line-assembly + the existing
  `buildGrounderSystemPrompt`-shape tests in `fact-grounder-llm.test.ts`.

**Test scenarios:**
- Happy path: `buildGrounderSystemPrompt({ ref: "main" })` includes the salient-attributes sweep
  instruction and does not describe `main` as a feature branch.
- Edge case: `buildGrounderSystemPrompt({ ref: "origin/some-branch" })` still includes correct
  ref-scoped guidance.
- Edge case: `buildGrounderSystemPrompt({})` (no ref) still produces a valid prompt (no crash).

**Verification:**
- Prompt unit tests pass; combined with U1, repeated groundings of the same brief produce
  consistent, repo-sourced depth.

---

- [ ] U3. **Remove the mis-scoped brief-validation gate** *(centaur overlay)*

**Goal:** Stop rejecting legitimate briefs; let briefs flow straight to grounding. Copy quality stays
enforced on candidates.

**Requirements:** R4, R5

**Dependencies:** None

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (remove the `validate_brief` call +
  `red`/return at ~64-82; remove now-dead `_format_validation_failure` + `_VALIDATION_RULE_HINTS`)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py` (remove the two
  `_format_validation_failure` tests; add a handler test that a previously-rejected brief proceeds)

**Approach:**
- Delete the pre-grounding `validate` call and its failure branch so the handler goes brief →
  grounding directly.
- Remove `_format_validation_failure` and `_VALIDATION_RULE_HINTS` (only the removed gate used them)
  and their unit tests.
- Leave candidate-level validation / Director / em-dash stripping untouched (R5).

**Patterns to follow:**
- The existing async handler tests in `test_comms_workflows.py` (mocked `call_comms_tool`, `Ctx`).

**Test scenarios:**
- Happy path: handler with brief "…up to 50x leverage…" (and one containing an em-dash) does **not**
  short-circuit at validation and proceeds to the grounding call (assert the grounding tool is
  invoked; assert no "stopped at validation" post).
- Edge case: empty/whitespace brief still returns `missing_brief` (existing early guard at ~56-61 is
  unchanged).
- Regression: removing `_format_validation_failure` leaves no other references (grep clean); its
  tests are deleted, suite still green.

**Verification:**
- In Slack, the "leverage" brief now reaches "Grounding comms facts…" instead of being rejected.

---

- [ ] U4. **Human-readable generation-failure message** *(centaur overlay)*

**Goal:** Replace the raw-dict generation error with a readable Slack message + retry hint.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (generation-error branch ~340-356; add
  `_format_generation_failure`)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

**Approach:**
- Add `_format_generation_failure(generation)` that renders a header + the error/operation + any
  message/reason, plus a note that generation errors are often transient (Anthropic overload) and to
  retry. Use it where the generation-error branch currently posts `f"...{generation}"`.
- Mirror the structure/quality bar of the validation formatter we built earlier (no raw dict; `.get()`
  guarded; graceful when fields are missing).

**Patterns to follow:**
- The (pre-U3) `_format_validation_failure` shape; `_post_blocked_tool_result` /
  `_generation_result_error` usage at the generation-error branch.

**Test scenarios:**
- Happy path: a `comms_factory_http_error` result with `status_code: 500` → message contains a
  readable error label + retry guidance; contains no raw dict (`{`, `'ok'`).
- Edge case: result with a nested `response.message` → that message is surfaced.
- Edge case: result with no structured error fields → falls back to a generic readable message, still
  no dict dump.

**Verification:**
- A forced/observed generation failure in Slack shows a readable message with a retry hint.

---

## System-Wide Impact

- **Interaction graph:** U1/U2 affect every `ground_from_tools` call (both Slack workflows and any
  direct tool callers). U3/U4 affect only the `comms_release` Slack workflow.
- **Error propagation:** U4 only changes presentation; the workflow still returns its `blocked`/`red`
  status objects unchanged.
- **API surface parity:** U1 changes `/ground` *defaults* (ref now defaulted, higher max_turns), not
  its request/response contract; explicit caller values still honored.
- **Unchanged invariants:** candidate-level validation, Director audit, em-dash stripping, the
  candidate-gate verdict surfacing (plan 001), and `comms_audit` are all untouched.
- **Cost note:** higher `max_turns` + always-on sweep increases LLM calls per grounding (deeper =
  more `repo_context`/Anthropic calls). Acceptable for quality; keep the cap bounded.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Defaulting ref to `main` mis-describes the ref as a "feature branch" in the prompt | U2 fixes the wording so it's correct for a default-branch ref. |
| Higher max_turns + always-sweep raises latency/cost per grounding | Keep a bounded cap; depth is the explicit goal; revisit if latency hurts. |
| Removing the brief gate lets a junk brief reach grounding | Acceptable — grounding/candidate validation handle quality; empty-brief guard remains. |
| Cross-repo drift: service (U1/U2) deploys only via pin bump | After U1/U2 land on PR #3, bump `COMMS_FACTORY_REF` and `just comms-factory-up` (see Verification). |

---

## Verification (end-to-end)

1. **Service (U1/U2):** in `~/src/comms-factory-rebase` run `pnpm typecheck` + the service/grounder
   tests (`server.test.ts`, `fact-grounder-llm.test.ts`). Commit + push to PR #3.
2. **Overlay (U3/U4):** run the workflow suite
   (`overlays/comms-factory/tests/test_comms_workflows.py` via the API venv) — green.
3. **Deploy:** bump `COMMS_FACTORY_REF` in `contrib/scripts/deploy-local.sh` to the new PR #3 head,
   then `just comms-factory-up`.
4. **Grounding consistency (R1-R3):** ground the Hyperliquid brief 3× and the Collector Crypt brief 1×
   via `comms_factory.ground_from_tools` — expect consistently rich, repo-sourced facts each run (no
   2-fact runs), and repo_context call counts in the high single digits / teens.
5. **Brief gate (R4):** in Slack, `comms generate for x: …up to 50x leverage…` reaches grounding (no
   "stopped at validation").
6. **Generation error (R6):** if a generation failure occurs, Slack shows the readable message +
   retry hint (and the service logs `cause_stack`, from the prior fix).

---

## Sources & References

- Investigated this session: live `ground_from_tools` runs (2 vs 7 facts, same brief), repo probes
  (50+ perps matches), and the `ground.ts` / `fact-grounder-llm.ts` code trace.
- Related: plan `docs/plans/2026-06-09-001-feat-surface-director-verdict-candidate-gate-plan.md`
  (candidate-gate verdict surfacing + the validation-message helper this plan removes in U3).
- Service code: `services/api/routes/ground.ts`, `src/fact-grounder-llm.ts` (comms-factory repo).
- Overlay code: `overlays/comms-factory/workflows/comms_release.py`.
