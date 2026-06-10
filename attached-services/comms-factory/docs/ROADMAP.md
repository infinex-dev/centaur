# Roadmap

This is a practical handoff plan for turning the current local Pipeline 3
workbench into a production-grade service.

## Current Baseline

Working today:

- Local harness at `http://localhost:3210`
- Branch-aware fact grounding
- Release-card assembly and edit workflow
- Pipeline 3 Actor/Director generation path
- Deterministic validator and claim tripwires
- Blind Director audit with copy/fact/publication split gates
- Prompt, transcript, source-index, run-event, candidate, audit, and pick
  persistence in local SQLite
- Pipeline 3 proof banner in the harness
- Director-as-service engineering spec

Not production-ready yet:

- No service transport
- No auth
- No production database
- No deployment/runbook
- No Slack/MCP integration
- No formal secrets/logging/retention policy
- No automatic migrations beyond single-file local schema init
- Director-as-service is specified but not extracted as a stable module

## Phase 0: Repo Handoff

Goal: make this repo easy for an engineer to pick up.

Required state:

- README explains the working product and how to run it.
- Architecture doc maps the code.
- Roadmap distinguishes current, next, and future work.
- Env examples exist and contain no secrets.
- Local DB, build artifacts, and env files stay ignored.
- Tests and typechecks are run before pushing.

Exit criteria:

- A new engineer can run `pnpm dev:harness` and open `localhost:3210`.
- A new engineer can find Pipeline 3 code without reading old handovers first.
- The repo can be pushed to GitHub without local secrets or SQLite state.

## Phase 1: Stabilize Pipeline 3 As The Default

Goal: remove ambiguity around which pipeline is active.

Work:

- Keep `HARNESS_GENERATOR_ARCH=actor` as the default harness path.
- Keep `HARNESS_GENERATOR_ARCH=legacy` as an explicit rollback only.
- Keep `src/pipeline-identity.ts` proof visible in the harness.
- Make test fixtures cover the actor path, not only legacy generator behavior.
- Ensure CLI helper `scripts/run-actor-director-card.ts` remains a reliable
  no-harness path for reproducing a Pipeline 3 run.

Exit criteria:

- Any generated artifact can prove whether it came from Pipeline 3.
- Legacy output cannot be mistaken for current architecture.
- `pnpm test` and `pnpm typecheck` pass from a clean checkout.

## Phase 2: Extract Director As A Service

Goal: make the Director useful for human-written copy before generation is
productionized.

Reference: `docs/SPEC-director-as-service.md`

Work:

- Add a runtime-agnostic `auditCopy(req)` module.
- Accept raw copy, surface, voice id, optional fact source, and prior Q&A thread.
- Run deterministic validator first.
- Run blind Director voice axis without giving product context.
- If no fact source exists, return amber with clarifying questions instead of
  self-grounding.
- If fact source exists, check claims against `deployed_facts`.
- Return a structured green/amber/red verdict with separate voice and fact axes.
- Capture answered questions into draft card facts for later generation.

Exit criteria:

- Human-authored copy can be audited without invoking generation.
- The Director never calls the grounder.
- A green voice result cannot mask an unverified fact axis.
- Tests cover light rollup, regex-front-door failures, fact-source present,
  fact-source absent, and Q&A capture.

## Phase 3: Production Transport

Goal: wrap stable core functions in a deployable interface.

Likely surfaces:

- HTTP/RPC: `POST /audit`, `POST /generate`, `POST /validate`
- MCP: `audit`, `generate`, `validate`
- Slack bot: paste copy, get Director verdict and questions
- Worker queue: async generation path

Work:

- Choose deployment target and runtime.
- Replace local `.env` usage with managed secrets.
- Define auth for internal callers.
- Define request/response schemas and versioning.
- Add structured logs for prompt hashes, source indexes, model versions,
  latency, token use, and verdicts.
- Keep generated copy behind a human ship gate.

Exit criteria:

- `audit` is synchronous enough for Slack/editor workflows.
- `generate` can run asynchronously and report progress.
- Every response is traceable to prompt hash, source index, model, and card id.

## Phase 4: Persistence Migration

Goal: replace local SQLite with production persistence without changing the
pipeline contracts.

Work:

- Decide production DB.
- Convert `harness/lib/schema.sql` into migrations.
- Preserve append-only audit/history tables.
- Separate training data from production request logs if needed.
- Define retention and redaction policy for prompts, transcripts, and operator
  edits.

Exit criteria:

- Existing harness data model has a production equivalent.
- Local harness can still run against SQLite for development.
- Production service does not depend on `harness/harness.db`.

## Phase 5: Operator Agreement And Retirement Path

Goal: decide when local harness behavior is trusted enough to move behind
lighter production surfaces.

Work:

- Continue capturing approve/edit/reject decisions.
- Track agreement by stage, voice, beat, and source.
- Use operator edits to update voice specs and validator rules.
- Retire or narrow the harness once high-friction review is no longer needed.

Exit criteria:

- Agreement metrics justify which stages can run with less review.
- The harness is a debug/training tool, not the production product.

## Open Decisions

- Exact production host and service framework.
- Whether Centaur/Rails is the orchestration layer, transport layer, or both.
- Exact Director amber/green confidence thresholds.
- Whether Director Q&A answers are stored directly as draft `deployed_facts` or
  require operator approval first.
- Production storage for canonical source indexes and prompt captures.
- Slack first vs MCP first for internal usage.
- Whether the harness remains in this repo long-term or moves after service
  extraction.

## Non-Negotiables

- Do not auto-post.
- Do not collapse Actor and Director.
- Do not let Director self-ground.
- Do not let Actor invent claims outside `deployed_facts`.
- Do not add validator rules without tests.
- Do not decide brand visual specs in this repo.
