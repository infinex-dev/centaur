# Planning Harness Ledger

Created: 2026-05-22

## Purpose

Design and implement a Centaur-based planning harness that drives long-running planning workflows from Slack while preserving durable planning memory outside model context.

## Target Outcome

Build a planning harness where an agent can own a planning thread, guide humans through required workflow phases, invoke expert agents/tools, and produce validated planning artifacts such as `plan.json` without depending on fragile chat history.

The first concrete target is a harness suitable for planning workflows like:

`/Users/kain/Sites/infinex-platform-spot/bare_metal/perps-refactor`

## Problem

The current planning process around `bare_metal` execution is ad hoc, synchronous, and spread across sessions. Decisions can be lost, agents can become confused, and the process is path dependent enough that humans have to repeat workflows to regain confidence.

The desired inversion:
- start from an idea or planning goal;
- assign a Slack thread to an agent;
- let the agent assess the project and propose required planning workflows;
- after human agreement, have the agent drive the humans through the flow;
- invoke the right tools and expert subagents as needed;
- preserve durable planning state in artifacts and structured records;
- produce a valid `plan.json` plus supporting artifacts.

## Source Material

### Paradigm Centaur Open Source Announcement

Source: `https://www.paradigm.xyz/2026/05/open-sourcing-centaur-multiplayer-self-hosted-secure-agents`

Captured: 2026-05-22

Relevance:
- Centaur is framed as a Slack-native, self-hosted, durable, multiplayer agent runtime.
- One Slack thread maps to one isolated agent session.
- API, Slackbot, sandbox, firewall, observability, and Postgres are separate services.
- Postgres is the single source of truth for durable state.
- Tools, skills, and workflows are userspace extension points.
- Workflows are durable, checkpointed units that can resume after crashes.
- The planning harness should preserve this model rather than becoming a bespoke side system.

## Centaur/Codex Memory Finding

Centaur sends each user turn to Codex app-server via `turn/start` against a Codex `threadId`.

Codex app-server keeps its own thread history, including tool calls and tool outputs, and sends that history into subsequent model calls while it remains in active history.

The important caveat is compaction:
- tool outputs can be truncated when recorded;
- old detailed tool traces can be summarized or dropped when Codex compacts history;
- therefore durable planning state must not rely on model context retaining every prior tool call.

Lower sandbox TTL can reduce live process duration, but it does not by itself guarantee a fresh Codex planning context because Centaur can resume the prior app-server thread by thread ID.

## Decisions

### Chat Context Is Not Durable Planning State

Planning state must be captured in artifacts and structured records, not only in Slack or model context.

### Conversation Rotation Should Be Explicit

The planning harness should model explicit conversation epochs:
- `planning_run_id`
- `conversation_epoch_id`
- `parent_epoch_id`
- `thread_key`
- `artifact_set_id`

### Deterministic Planning Tools Are Needed

Agents should not only write markdown files. Critical planning memory should be recorded through deterministic tools that create append-only structured records with timestamps, actor identity, artifact hashes, and trace links.

### Self-Replication Is A Smoke Test

The planning process for this harness is itself the target workflow shape. Every meaningful step, decision, question, and artifact should be documented so the future planning harness can consume this planning folder and attempt to reproduce a coherent implementation plan from the original brief.

Success criterion:
- Given the brief to build a planning harness and the accumulated planning state, the harness should produce a plan that is materially close to the manually developed plan.

### The Harness Must Recommend Next Viable Paths

The harness should not wait for the user to guess the next planning step. After each completed phase, it should inspect the current artifacts, identify what is known and unknown, and propose two to three viable next paths with tradeoffs.

For this planning run, the correct next recommendation is a diverge research plan that fans out across multiple lenses to study autonomous planning agents and planning systems before converging on an implementation architecture.

## Deterministic Ledger Tools

Candidate tools:
- `planning.record_decision`
- `planning.record_assumption`
- `planning.record_open_question`
- `planning.record_evidence`
- `planning.record_workflow_result`
- `planning.update_artifact`
- `planning.create_checkpoint`
- `planning.start_epoch`
- `planning.close_epoch`

Every ledger event should receive server-added fields:
- `event_id`
- `created_at`
- `actor_type`
- `actor_id`
- `thread_key`
- `trace_id`
- `execution_id`
- `schema_version`

Important properties:
- append-only;
- idempotent by caller-provided idempotency key;
- artifact updates include previous and new content hashes;
- Slack/thread/source references are explicit;
- markdown is a human projection, not the sole source of truth.

## Open Questions

Product flow:
- What exact workflow phases should the first planning harness support for a bare_metal `plan.json` outcome?
- Should the harness require human approval between every phase, or only at decision/checkpoint boundaries?
- How should the harness present next-step options: ranked recommendation, menu of viable paths, or direct proposed action with alternatives?
- What evidence threshold is required before the harness recommends divergence, convergence, implementation planning, fixture lock, scope review, or execution?

Architecture:
- Should the planning ledger live in Centaur's Postgres schema, in repo-local files, or both?
- Should ledger events be exposed as Centaur tools, MCP tools, or native harness endpoints?
- Should markdown artifacts be derived from ledger state, or should ledger events reference independently authored markdown artifacts?
- How should subagent outputs be attached to the planning run: raw execution events, summarized workflow results, or both?

Context management:
- What policy should trigger conversation epoch rotation: token threshold, elapsed time, phase boundary, manual Slack command, or a combination?
- What exact handoff bundle should seed a new epoch?
- How should the harness verify that the new epoch has correctly loaded canonical planning state?

Validation:
- What schema should define a valid planning ledger event?
- What schema should define a valid artifact set?
- What gates should run before declaring the final `plan.json` ready for bare_metal execution?
- How should we evaluate whether the harness selected the right next workflow at each step?

## Next Workflow

Run a read-only diverge research plan over autonomous planning agents and planning systems from multiple lenses.

Desired diverge shape:
- read-only fanout;
- one task per provider/lens;
- current external/SOTA research required;
- local planning artifacts treated as advisory evidence;
- independent recommendation documents;
- no convergence task;
- no implementation edits.

Candidate lenses:
- autonomous planning agent architectures;
- durable memory, ledgers, and artifact state models;
- human-in-the-loop workflow orchestration from Slack or chat;
- multi-agent divergence/convergence patterns;
- plan validation and execution-readiness gates for systems like bare_metal.

## Anti-Pattern Observed

This planning folder initially split state across `README.md`, `decisions.md`, `notes.md`, `open-questions.md`, `ledger-tooling.md`, `source-artifacts.md`, and briefly `next-steps.md`.

That was the same manual failure mode the harness is meant to prevent: multiple markdown files became divergent sources of truth before there was a structured ledger.

Correction:
- use one canonical planning state file for the current manual phase;
- keep one machine-readable state file beside it so the future harness can consume and replicate the planning state;
- only split into additional files when a workflow requires separate outputs, such as independent diverge recommendations;
- eventually replace this manual file with a deterministic ledger plus generated human projections.

## State Tracking

Manual planning should maintain exactly two canonical artifacts during this phase:
- `planning.md` for human-readable planning state;
- `state.json` for machine-readable planning state.

The JSON state file exists because self-replication is an explicit goal. The future harness should be able to consume structured state, not only prose, when attempting to reproduce or continue this planning process.
