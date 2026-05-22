---
title: "source index: Planning Harness Diverge Research"
type: research-source-index
status: draft
date: 2026-05-22
---

# source index: Planning Harness Diverge Research

## Purpose

This file defines the allowed local source material and required external
research baseline for the planning-harness diverge run.

Research tasks must use local artifacts as evidence, not as unquestioned
authority. If local planning artifacts conflict with current official docs,
source files, or external research, the recommendation must call out the
discrepancy.

This is a relflektion-style read-only architecture diverge, but it is not based
on prior audit reports. There is no audit directory for this run. The local
planning ledger and Centaur source/docs are the repo evidence, while current
external research is required for every lens.

## Authoritative Brief And Current Planning State

- `planning/planning-harness-ledger/planning.md`
  - Authoritative for the current human brief, accepted planning decisions, open
    questions, anti-pattern observed, and desired next workflow.
  - Advisory for the final implementation architecture.
- `planning/planning-harness-ledger/state.json`
  - Authoritative machine-readable snapshot of the current manual planning
    state.
  - Advisory for the final ledger schema.

## Paradigm Centaur Article

- Paradigm, "Open Sourcing Centaur: Multiplayer, Self-Hosted, Secure Agents"
  - URL: `https://www.paradigm.xyz/2026/05/open-sourcing-centaur-multiplayer-self-hosted-secure-agents`
  - Use as the product framing source for Centaur's Slack-native, durable,
    self-hosted, multiplayer agent model.
  - If the live article differs from local summaries, cite the live article and
    call out the discrepancy.

## Centaur Docs

Inspect only the docs relevant to the assigned lens:

- `docs/public/md/what-is-centaur.md`
- `docs/public/md/architecture.md`
- `docs/public/md/security.md`
- `docs/public/md/quickstart.md`
- `docs/public/md/extend/tools.md`
- `docs/public/md/extend/workflows.md`
- `docs/public/md/extend/skills.md`
- `docs/public/md/extend/overlay.md`
- `docs/public/md/operate/slack-etl.md`
- Matching `docs/pages/**/*.mdx` files only when the generated markdown appears
  stale or incomplete.

## Centaur API And Durable Runtime Code

Inspect only files relevant to the assigned lens:

- `services/api/api/runtime_control.py`
- `services/api/api/workflow_engine.py`
- `services/api/api/final_delivery.py`
- `services/api/api/observability.py`
- `services/api/api/models.py`
- `services/api/api/routers/agent.py`
- `services/api/api/routers/workflows.py`
- `services/api/api/workflows/agent_turn.py`
- `services/api/api/workflows/slack_thread_turn.py`
- `services/api/api/tool_manager.py`
- `services/api/api/warm_pool.py`
- `services/api/api/sandbox/harness_protocol.py`
- `services/api/api/sandbox/kubernetes.py`
- `services/api/api/sandbox/normalize.py`
- `services/api/db/migrations/007_attachments.sql`
- `services/api/db/migrations/008_agent_runtime_control_plane.sql`
- `services/api/db/migrations/011_agent_execution_worker_leases.sql`
- `services/api/db/migrations/013_workflow_engine.sql`

## Slackbot And Chat Surface Code

Inspect only files relevant to the assigned lens:

- `services/slackbot/src/index.ts`
- `services/slackbot/src/centaur/final-delivery.ts`
- `services/slackbot/src/centaur/handoff.ts`
- `services/slackbot/src/slack/agent-session.ts`
- `services/slackbot/src/slack/codex-session.ts`
- `services/slackbot/src/slack/final-message.ts`
- `services/slackbot/src/slack/render.ts`
- `services/slackbot/src/slack/streaming.ts`
- `services/slackbot/src/slack/types.ts`

## Sandbox And Harness Code

Inspect only files relevant to the assigned lens:

- `services/sandbox/SYSTEM_PROMPT.md`
- `services/sandbox/harness_adapter.py`
- `services/sandbox/call.sh`
- `services/sandbox/entrypoint.sh`
- `services/sandbox/amp-wrapper.py`
- `services/sandbox/claude-app-wrapper.py`
- `services/sandbox/codex-app-wrapper.py`

## Tests And Verification Evidence

Inspect only files relevant to the assigned lens:

- `services/api/tests/test_agent_control_plane.py`
- `services/api/tests/test_agent_resilience.py`
- `services/api/tests/test_inflight_replay.py`
- `services/api/tests/test_workflows.py`
- `services/api/tests/test_workflow_idempotency_unit.py`
- `services/api/tests/test_observability.py`
- `services/api/tests/test_sse_keepalive.py`
- `services/api/tests/test_stream_turn_skip_done.py`
- `services/slackbot/src/centaur/final-delivery.test.ts`
- `services/slackbot/src/centaur/handoff.test.ts`
- `services/slackbot/src/slack/agent-session.test.ts`
- `services/slackbot/test/emulate/slack-e2e.test.ts`

## External Research Requirement

Every recommendation must perform current external research for its lens.

Minimum requirements:

- Prefer sources from the last 30 days where available.
- Use official docs for tool-specific claims.
- Include source names, URLs when available, publication or update dates when
  visible, and access date.
- Explicitly state whether useful last-30-days sources were found.
- Separate external/SOTA findings from local Centaur evidence and from the final
  recommendation.

## Read Boundaries

Tasks must not inspect unrelated local repositories, prior Infinex bare_metal
plans, unrelated planning folders, package caches, generated dependency trees,
or production deployment boxes.

The Infinex bare_metal plans were used only as examples for this plan's schema
shape. They are not source material for the research tasks.
