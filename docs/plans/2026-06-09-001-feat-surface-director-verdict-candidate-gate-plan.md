---
title: "feat: Surface Director verdict + ship Director's pick in comms_release candidate gate"
type: feat
status: active
date: 2026-06-09
---

# feat: Surface Director verdict + ship Director's pick in comms_release candidate gate

## Overview

The `comms_release` Slack workflow runs the full Actor→Director pipeline via the comms-factory
service `/generate`, which returns rich per-candidate `director_audit` (publication-gate issues,
factual issues, reader-fit notes, tempo, pass/fail flags) plus a Director-ranked `picks` array.
The Slack layer **discards all of it**: `candidates_from_generation()` keeps only `text`/`channel`,
the candidate gate shows bare copy, and "Mark ready" always ships candidate #1
(`_first_candidate_text`) — even when the Director ranked a different candidate best or flagged the
shown copy with publication-gate warnings.

This plan surfaces the Director's verdict in the candidate-gate message and wires "Mark ready" to
ship the Director's recommended pick instead of candidate #1. **Overlay-only change** — the service
already returns everything needed; no `services/api` / comms-factory service change is required.

---

## Problem Frame

Investigated live this session (build_card → generate against the deployed combined branch):

- The Director **does** run — `director_started`/`director_completed` fired for every candidate; each
  candidate carried a full `director_audit`; a `picks` array with rationale was returned.
- But from Slack it looks like it doesn't: the operator sees five bare copies with no tempo, no
  pass/fail, no `publication_gate_issues`, and a "Mark ready" that silently ships candidate #1.
- Concretely observed: both candidates had `publication_gate_passed: false` with actionable holds
  ("verify the $1B figure is publicly defensible before publishing") that **never reached the
  operator**. An operator can ship copy the Director gated, blind.

The generation result shape (verified from a real run) is the contract this plan relies on:

- `result.output.candidates[]` — each has `id`, `channel`, `text`, and `director_audit`.
- `director_audit` has: `copy_voice_passed`, `factual_passed`, `publication_gate_passed`,
  `primary_tempo`, `publication_gate_issues[]`, `factual_issues[]`, `voice_issues[]`,
  `reader_fit_notes[]`, `notes_for_actor[]`.
- `result.output.picks[]` — Director-ranked selection; `picks[N].id` matches a `candidate.id`
  (verified: `picks[0].id == "actor-x-option-1"` mapped to that candidate). `picks[0].text` is the
  recommended copy.

---

## Requirements Trace

- R1. The candidate-gate Slack message shows each candidate's Director verdict: tempo, the three
  pass/fail flags, and any publication-gate / factual issues as warnings.
- R2. The Director's recommended candidate (`picks[0]`) is visually marked in the gate message.
- R3. "Mark ready" ships the Director's recommended pick text, not always candidate #1. Operator
  "Edit final" (modal) input still wins over the pick.
- R4. When the shipped copy's candidate has `publication_gate_passed: false`, the "ready to ship"
  confirmation surfaces the publication-gate holds so the operator sees what to verify.
- R5. Behavior degrades gracefully when `picks`/`director_audit` are absent (older/stub results):
  fall back to today's behavior (show bare copy, ship candidate #1).
- R6. A failed brief-validation gate shows a human-readable Slack message (rule + reason + guidance),
  not a raw result-dict dump.

---

## Scope Boundaries

- Not adding per-option "Pick #N" buttons / radio selection (the deeper interactivity change). This
  plan marks the Director's pick and ships it; explicit per-candidate selection stays "Edit final"
  for now.
- Not changing the comms-factory service (`services/api`, `src/`) — it already returns `picks` and
  `director_audit`.
- Not changing the em-dash / dash-stripping behavior (separate concern; tracked below).
- Not changing `comms_audit` workflow — this is the `comms_release` candidate gate only.

### Deferred to Follow-Up Work

- **Brief-validation scoping decision (open):** the pre-generation `validate(brief)` gate runs the
  full publishable-copy allergen suite on the operator's *brief* because the service `validate()`
  ignores `surface`. It is mis-scoped (a brief is an instruction, not copy) and redundant (the same
  rules + em-dash strip run on generated candidates). U4 only humanizes the *message*; whether to
  remove/rescope the gate (overlay) or make `validate()` honor `surface` (service) is a separate
  decision.
- Per-candidate selection buttons (one "Pick" action per option) — larger interactivity + gate-action
  change in `services/slackbot` + `actions_block`; separate plan.
- Extend dash stripping to en-dash/other Unicode dashes and sanitize fact-contract/rationale display —
  separate change in the comms-factory service (`src/actor-orchestrator.ts`).

---

## Context & Research

### Relevant Code and Patterns

- `overlays/comms-factory/workflows/comms_release.py:358-381` — first candidate gate: builds blocks
  via `markdown_block("*Choose final copy*\n" + _format_candidates(candidates))` + `actions_block`.
- `overlays/comms-factory/workflows/comms_release.py:460-485` — retry candidate gate (same pattern).
- `overlays/comms-factory/workflows/comms_release.py:522` — `final_copy = extract_modal_value(...) or
  _first_candidate_text(candidates)` — the selection fallback to ship.
- `overlays/comms-factory/workflows/comms_release.py:540-544` — "Ready to ship in Slack" post.
- `overlays/comms-factory/workflows/comms_release.py:766` — `_format_candidates(candidates)`.
- `overlays/comms-factory/workflows/comms_release.py:777` — `_first_candidate_text(candidates)`.
- `overlays/comms-factory/workflows/comms_shared.py:733` — `candidates_from_generation(result)` (keeps
  all keys via `dict(item)`, so `director_audit` already survives — the data is present, just unused).
- `overlays/comms-factory/workflows/comms_shared.py:95/104/304/310` — `actions_block`,
  `markdown_block`, `extract_action`, `extract_modal_value` (Slack block + event helpers).

### Institutional Learnings

- `docs/solutions/` (overlays) — [[overlays-no-typescript-injection]]: overlay changes are Python-only;
  base slackbot gate UI is generic/data-driven and needs no base code change for this.

---

## Key Technical Decisions

- **Pass `picks` (and the full candidate list with `director_audit`) into the formatter** rather than
  reshaping at `candidates_from_generation`. `candidates_from_generation` already preserves
  `director_audit`; the gap is purely presentation + selection. Keep `candidates_from_generation`
  unchanged; thread `picks` from `generation` into the gate display + selection helpers.
- **Resolve the pick by id, not by position.** Match `picks[0].id` to a `candidate.id`; if no match,
  fall back to `picks[0].text`, then to `_first_candidate_text`. Position-based assumptions are unsafe
  (candidate order ≠ pick order).
- **Keep generation order in the displayed list; mark the pick with a star** rather than reordering.
  Less surprising to the operator, and decouples display order from "what Mark ready ships".
- **Operator override precedence:** `extract_modal_value` (Edit final) > Director pick > candidate #1.

---

## Open Questions

### Resolved During Planning

- Do candidate ids map to pick ids? Yes — verified `picks[0].id` matches a `candidate.id`.
- Does `director_audit` survive `candidates_from_generation`? Yes — it does `dict(item)`, preserving
  all keys; it is simply never read downstream.

### Deferred to Implementation

- Exact Slack block formatting/emoji for verdict badges — choose during implementation to fit existing
  `markdown_block` style; not behavior-affecting.
- Whether to also surface `reader_fit_notes`/`notes_for_actor` (richer but noisier) — start with
  pass/fail + tempo + publication_gate/factual issues; add notes only if the block stays readable.

---

## Implementation Units

- [ ] U1. **Render Director verdict + pick marker in the candidate gate**

**Goal:** Make `_format_candidates` show each candidate's Director verdict and star the recommended
pick, so the operator reviews the Director's call instead of bare copy.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (`_format_candidates`, and its two call
  sites at ~366 and ~470 to pass `picks`)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

**Approach:**
- Change `_format_candidates(candidates)` → `_format_candidates(candidates, picks=None)` (keyword,
  defaulted for R5 backward-compat).
- Compute `recommended_id = picks[0]["id"]` when `picks` is non-empty; star that candidate's line.
- For each candidate, read `candidate.get("director_audit")`. When present, append a compact verdict
  line: `tempo` + ✅/⚠️ for `copy_voice_passed` / `factual_passed` / `publication_gate_passed`, then
  any `publication_gate_issues` / `factual_issues` as `⚠️ <issue>` bullets. When absent, render today's
  text-only line (R5).
- At both call sites, derive `picks = (generation.get("output") or generation).get("picks")` (reuse a
  small accessor; mirror how `candidates_from_generation` digs into the envelope) and pass it in.

**Patterns to follow:**
- `_format_candidates` current structure (`overlays/comms-factory/workflows/comms_release.py:766`);
  `markdown_block` text style (`comms_shared.py:104`).

**Test scenarios:**
- Happy path: candidate with `director_audit` (all passed) → output includes tempo + three ✅ badges
  and the candidate text.
- Happy path: `picks=[{id: "actor-x-option-2", ...}]` → option 2's line is starred, option 1 is not.
- Edge case: `publication_gate_passed: false` with two `publication_gate_issues` → both issues render
  as ⚠️ lines under that candidate.
- Edge case (R5): candidate dicts with no `director_audit` and `picks=None` → output equals the
  current text-only format (no crash, no stray badges).
- Edge case: `picks=[]` or pick id not matching any candidate → no star, no crash.

**Verification:**
- Unit tests pass; rendering a sample generation result produces a block containing tempo, badges,
  issue warnings, and a single starred pick.

---

- [ ] U2. **Ship the Director's pick on "Mark ready"**

**Goal:** "Mark ready" ships `picks[0]`'s copy (resolved by id), not always candidate #1; operator
"Edit final" still wins.

**Requirements:** R3, R5

**Dependencies:** U1 (shares the pick-resolution accessor)

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (selection at ~522; add
  `_director_pick_text` helper near `_first_candidate_text` at ~777)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

**Approach:**
- Add `_director_pick_text(generation, candidates) -> str`: read `picks` from the generation envelope;
  if `picks[0].id` matches a candidate, return that candidate's `text`; else return `picks[0].get("text")`;
  else `_first_candidate_text(candidates)`.
- Change line ~522 to: `final_copy = extract_modal_value(candidate_event) or
  _director_pick_text(generation, candidates)`. `generation` already holds the latest result (initial
  or post-retry reassignment at ~418), so the retry path is covered with no extra change.

**Patterns to follow:**
- `_first_candidate_text` (`overlays/comms-factory/workflows/comms_release.py:777`); envelope digging
  in `candidates_from_generation` (`comms_shared.py:733`).

**Test scenarios:**
- Happy path: `picks[0].id` matches candidate #2 → returned final copy is candidate #2's text (not #1).
- Happy path: operator "Edit final" modal value present → `extract_modal_value` wins; pick ignored.
- Edge case: `picks` present but id matches nothing → returns `picks[0].text`.
- Edge case (R5): no `picks` → returns `_first_candidate_text` (candidate #1), preserving today's
  behavior.
- Edge case: empty candidates and no picks → returns "" (so the existing `missing_final_copy` block at
  ~525 still triggers).

---

- [ ] U3. **Surface publication-gate holds on the ready-to-ship confirmation**

**Goal:** When the shipped copy's candidate was Director-flagged `publication_gate_passed: false`, the
"Ready to ship" message lists the publication-gate holds so the operator knows what to verify.

**Requirements:** R4, R5

**Dependencies:** U2 (needs the resolved final candidate)

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (ready-to-ship post at ~540-544)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

**Approach:**
- After resolving `final_copy`, locate the matching candidate (by text, or reuse the resolved pick
  candidate from U2). If its `director_audit.publication_gate_passed` is `false`, append a
  `⚠️ Publication holds (verify before posting):` section listing `publication_gate_issues` to the
  ready-to-ship message.
- Operator override (Edit final) with no matching candidate → no holds appended (nothing to map);
  don't fabricate warnings.

**Patterns to follow:**
- `_post_simple` ready-to-ship call (`overlays/comms-factory/workflows/comms_release.py:540`).

**Test scenarios:**
- Happy path: chosen candidate `publication_gate_passed: false` with 2 issues → ready-to-ship text
  contains both holds.
- Edge case: chosen candidate `publication_gate_passed: true` → no holds section appended.
- Edge case (R5): no `director_audit` on chosen candidate → no holds section, message equals today's.

---

- [ ] U4. **Human-readable brief-validation failure message**

**Goal:** When the pre-generation brief `validate` gate fails, post a readable Slack message
(rule + reason + guidance) instead of dumping the raw result dict.

**Requirements:** R6 (added during execution)

**Dependencies:** None

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (validation gate at ~64-82; add
  `_format_validation_failure` + `_VALIDATION_RULE_HINTS`)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

**Approach:**
- The brief gate currently posts ```` ```{validation}``` ```` (raw Python dict). Replace with
  `_format_validation_failure(validation)`: header + one `• *rule* — reason` line per
  `failures[]`, a small `rule → hint` map for terse rules, and a closing guidance line noting these
  are copy-style rules applied to a brief (rephrase / can be relaxed). Fall back to `error`/`status`
  when there are no structured failures (tool-level failure).
- Context: `validate()` ignores `surface`, so the brief is judged by the full publishable-copy
  allergen suite — see the scoping question deferred below. This unit only fixes the message; it does
  not change whether/what the brief is validated against.

**Patterns to follow:**
- `_post_simple` usage at the validation gate; `failures` shape `[{rule, reason}]` from the service
  `validate()` deterministic RULES.

**Test scenarios:**
- Happy path: validation with `cliches` + `ai-slop` failures → output contains `*cliches*`,
  the reason text, `*ai-slop*`, and "Rephrase"; contains no raw dict (`{`, `'ok'`).
- Edge case: `ok: false` with no `failures[]` → falls back to `error`/`status` text, still no dict dump.

**Verification:**
- Unit tests pass; a failing brief in Slack shows a readable rule + reason + guidance message.

---

## System-Wide Impact

- **Interaction graph:** Pure Slack-presentation + selection logic inside `comms_release`. No change to
  gate-action wiring (`actions_block`, `wait_for_gate_action`) or to `services/slackbot`.
- **API surface parity:** None — the service `/generate` contract is unchanged (already returns
  `picks`/`director_audit`).
- **Unchanged invariants:** `candidates_from_generation`, the gate buttons (Mark ready / Edit final /
  Retry / Abandon), and the retry loop are unchanged. "Edit final" precedence is preserved.
- **Backward compatibility:** All new reads are `.get()`-guarded so older/stub generation results
  (no `picks`/`director_audit`) render and ship exactly as today (R5).

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Pick id doesn't map to a candidate (schema drift) | Fall back to `picks[0].text`, then candidate #1; covered by U2 tests. |
| Verdict block becomes noisy / unreadable in Slack | Start with tempo + 3 badges + gate/factual issues only; defer `reader_fit_notes` unless readable. |
| Stub/older results lack `picks`/`director_audit` | `.get()`-guarded throughout; R5 fallback tests assert today's behavior. |
| Operator confusion: starred pick (display order) vs shipped pick | Star marks exactly the candidate "Mark ready" ships; keep them the same resolved pick. |

---

## Verification (end-to-end)

1. Unit tests: `cd overlays/comms-factory && uv run pytest tests/test_comms_workflows.py` (or repo-root
   `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py`) — all new scenarios green.
2. Rebuild + redeploy the overlay: `just comms-factory-up` (overlay image rebuilds from
   `overlays/comms-factory/`).
3. Slack E2E: `@centaur comms generate for x: Infinex perps are powered by Hyperliquid with up to 50x
   leverage on majors.` → confirm the "Choose final copy" message now shows per-candidate tempo +
   pass/fail badges + any publication holds, with one starred (Director-recommended) option.
4. Click "Mark ready" → confirm the shipped copy is the starred pick (not necessarily option 1), and
   that any publication holds appear in the ready-to-ship message.
5. Regression: a brief whose result has no picks (or a stubbed result) still shows bare copy and ships
   option 1.

---

## Sources & References

- Investigated this session: live `build_card`→`generate` run confirming `director_audit` + `picks`
  shape and candidate↔pick id mapping.
- Related code: `overlays/comms-factory/workflows/comms_release.py`,
  `overlays/comms-factory/workflows/comms_shared.py`.
- Service contract (unchanged): `services/api/routes/generate.ts` (`handleGenerate` returns
  `candidates` with `director_audit`, `picks`, `selection_rationales`) in the comms-factory repo.
