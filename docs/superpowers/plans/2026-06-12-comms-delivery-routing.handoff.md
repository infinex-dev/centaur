# Handoff prompt: plan + implement comms delivery routing (phase 2)

Paste everything below this line into a fresh agent session in this repo.

---

Implement the comms **delivery routing** phase: route each approved channel from a
`ready_to_ship` comms release to its real destination behind a human-confirmed delivery
gate, per the spec at `docs/superpowers/specs/2026-06-11-comms-delivery-routing-design.md`
(blog/web → platform PR via GitHub REST; x/x-thread → Typefully drafts; optional
display.dev draft-review loop for blog; one additive NetworkPolicy 443 egress hook).

## Sequencing — this is a two-stage handoff

**Stage A — write the plan (do NOT start coding):**
1. Read the spec end-to-end. It was adversarially reviewed (29 findings, 9 confirmed);
   its design decisions are settled — encode them, don't relitigate them.
2. Resolve the spec's "Open verifications" section FIRST (the live `FEATURES_COPY`
   schema in `infinex-xyz/platform` — no local checkout exists; read via the GitHub API).
   If a verification fails, STOP and surface it before planning around it.
3. Ask the operator for the external prerequisites up front (all `optional`/absent by
   default in the chart): `COMMS_GITHUB_TOKEN` (write-scoped, SEPARATE from the read-only
   repo-cache token), `TYPEFULLY_API_KEY`, display.dev credentials (org account:
   `infinex.dsp.so`), and — for E2E — a TEST target repo and private Typefully workspace,
   because delivery E2E performs real outward writes (PR branches + drafts; both
   reversible, still external).
4. Write the implementation plan with superpowers:writing-plans (bite-sized TDD tasks,
   exact anchors verified against the tree). Run a document review on it. Then STOP and
   get the operator's approval of the plan before Stage B.

**Stage B — execute** with superpowers:subagent-driven-development, task-by-task, exactly
like the surfacing phase (fresh implementer per task + spec review per task).

## Preconditions
- The surfacing phase is PR #20 (`feat/comms-multichannel-surfacing`). If it is merged,
  branch `feat/comms-delivery-routing` off `origin/main`; if not, STACK on
  `origin/feat/comms-multichannel-surfacing` and say so in the PR. Delivery consumes
  `final_by_channel` — it cannot land first. The spec + amended surfacing plan are
  in-tree on that branch (`docs/superpowers/{plans,specs}/`).

## Verified invariants from the shipped surfacing phase (do not "simplify" away)
- `final_by_channel[<ch>]` = `{text, candidate_id, edited, pick}`; `None` = channel
  missing; `missing_channels` rides alongside. `final_copy` no longer exists.
- **Structured payloads are NOT in `final_by_channel`** — join `candidate_id` back into
  `result["candidates"][i].structured` to get typed thread tweets / web-card fields.
  Typefully threadified delivery MUST consume the tweets array, not re-split the
  flattened `text`.
- Workflow events are FIRST-WRITE-WINS per `(event_type, correlation_id)`. Any new
  delivery gate gets a fresh `gate_version` per interactive round; never reuse a
  correlation for a second wait. Every `Gate(...)` carries
  `inp.user_id, approver_user_ids` or the slackbot rejects its buttons. Every gate exit
  leaves the message terminal and buttonless.
- Long copy renders via `chunked_markdown_blocks` (comms_shared) — never `markdown_block`
  alone for blog-length text. The Slack edit modal caps at 2500 chars (blog edits don't
  fit — that's what the display.dev loop is for).

## Spec hard rules (operator-confirmed)
- GitHub via **REST only** (no git/gh in the pod); idempotent via pre-flight + blob sha;
  PRs are NEVER auto-merged; Typefully drafts are NEVER auto-published.
- display.dev drafts publish with `--visibility private/company` + explicit reviewer
  allowlist; humans comment, the bot revises — no in-browser human edits.
- `in-product`/`modal` are copy-only ("deliver manually" note); `carousel` delivery is
  dropped; the ONLY base-chart change is the additive NetworkPolicy 443 egress hook.
- Tokens travel header-only — never argv, never URLs, never logged (http.ts sanitizer).

## Environment facts (hard-won this session — trust these over docs)
- Python: `uv run --project services/api pytest overlays/comms-factory -q` (bare
  `uv run pytest` FAILS — no root pyproject). Ruff: same `--project` flag; scope
  `ruff format --check` to `overlays/comms-factory` (the repo at large is not
  format-clean); overlays format at ruff default 88.
- TS: `cd attached-services/comms-factory && pnpm install --ignore-workspace && pnpm test
  && pnpm typecheck` (intentionally outside the root pnpm workspace).
- Local stack: `contrib/scripts/deploy-local.sh --services api --with-comms-factory`
  rebuilds + redeploys everything relevant (podman→k3s; see CLAUDE.md gotchas). The
  deploy box / FirenzeStaging is PRODUCTION (deploys from main) — never test there.
- Headless gate E2E recipe (start runs, inject `comms.action` events, inspect Slack
  blocks): memory file `comms-e2e-gate-driving.md`; timing: grounding ~2 min, generation
  ~5 min/channel sequential.

## Definition of done
- Stage A: plan reviewed + operator-approved. Stage B: all tasks committed, Python + TS
  suites green, ruff clean; local-k8s E2E of the delivery gate with REAL destinations
  (test repo PR opened, private Typefully draft created, display.dev loop exercised on a
  gated draft) with observations recorded. Do NOT push or open a PR without explicit
  operator go-ahead.

If anything in the spec contradicts the tree (a drifted anchor, a failed verification),
stop and surface the discrepancy — don't improvise around a spec decision.
