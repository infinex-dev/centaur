# Handoff prompt: implement comms multi-channel surfacing

Paste everything below this line into a fresh agent session in this repo.

---

Implement the comms multi-channel surfacing feature by executing the plan at
`docs/superpowers/plans/2026-06-11-comms-multichannel-surfacing.md`

## How to execute
- Use the superpowers:executing-plans skill (or superpowers:subagent-driven-development
  if dispatching a subagent per task). The plan is 8 tasks of bite-sized TDD steps with
  exact code — follow it task-by-task, in order, checking off steps as you go.
- First action: create branch `feat/comms-multichannel-surfacing` off **`origin/main`**
  (the plan + specs are on main via PR #12; the PR #13 launch-week comms-factory sync is
  also on main and has been verified NOT to move any anchor this plan relies on).
- TS deps: `cd attached-services/comms-factory && pnpm install --ignore-workspace`
  (intentionally outside the root pnpm workspace).
- Commit after every task exactly as the plan's commit steps specify.

## Context you need (read before Task 1)
1. The plan itself — it embeds the verified mechanics; trust it over your instincts.
2. The spec it implements: `docs/superpowers/specs/2026-06-10-comms-multichannel-release-design.md`
   (adversarially reviewed; the plan encodes its decisions — if plan and spec ever
   disagree, stop and flag it rather than guessing).
3. `CLAUDE.md` at repo root. Non-negotiables that apply here:
   - NEVER touch the deploy box; it is production. All testing is local.
   - Test locally E2E before considering work done (Task 8 has the exact checklist).
   - Absolute imports only; all imports at top of file; ruff line-length 100.
   - `attached-services/comms-factory` is a standalone pnpm/vitest project, excluded
     from root ruff — its tests run with `pnpm test` from that directory.

## Toolchains
- Python: from repo root — `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -v`,
  `uv run ruff check overlays/comms-factory`
- TS: `cd attached-services/comms-factory && pnpm test && pnpm typecheck`

## Critical invariants the plan encodes (do not "simplify" them away)
- The workflow-engine event table is FIRST-WRITE-WINS per `(event_type, correlation_id)`:
  one gate action per correlation, ever. That's why the candidate gate uses a fresh
  `gate_version` per round. Never reuse a correlation for a second wait.
- Every `Gate(...)` must carry requester/approver args (`inp.user_id, approver_user_ids`)
  or the slackbot silently rejects all its buttons.
- Edit buttons carry their channel as `target_id` WITHOUT `per_item` (payload, not
  correlation). `per_item` without `target_id` is rejected by the base slackbot.
- Picks from `/generate` are FLAT candidate dicts (top-level `id`/`text`/`channel`) —
  never reach for a nested `.candidate` key.
- Per-channel Edit buttons each get their OWN actions block (duplicate action_ids
  within one block are unproven; across blocks is production-proven).
- A failed retry must NOT consume the one-retry budget, and its durable step name is
  round-scoped (`generate_candidates_r{n}`) so replay doesn't serve a cached failure.
- Empty modal submissions are a no-op with a warning — never raise `GateValidationError`
  for them inside the loop (that would kill the run and discard operator edits).
- Every loop exit leaves the gate message terminal and buttonless, and every terminal
  payload carries `final_by_channel`/`missing_channels`.
- `final_copy` is REMOVED, not aliased — no backward compat (explicit user decision).

## Definition of done
- All 8 tasks committed; full Python + TS suites green; ruff clean.
- Task 8's local-k8s E2E checklist executed with real observations recorded
  (the stack runs on podman/k3s — see CLAUDE.md "Local-environment gotchas").
- Do NOT push or open a PR without explicit user go-ahead; report completion with
  a summary of commits + E2E evidence instead.

If you hit something the plan didn't anticipate (a drifted line number, a failing
assumption), stop and surface it with the discrepancy spelled out — don't improvise
around a spec decision.
