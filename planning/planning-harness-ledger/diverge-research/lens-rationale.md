---
title: "lens rationale: Planning Harness Diverge Research"
type: research
status: draft
date: 2026-05-22
---

# lens rationale: Planning Harness Diverge Research

## Strategic Question And Uncertainty Map

Strategic question: how should Centaur design a native planning harness that
drives humans through long-running planning workflows, maintains durable
structured state outside model context, recommends next workflow steps, and can
replicate this planning process as a smoke test?

The current manual planning state is sufficient to stop hand-authored planning
sprawl and fan out. The remaining uncertainty is architectural and workflow
level: what primitives, policies, state records, human checkpoints, and
verification loops should exist before any implementation plan is trusted?

Uncertainties this diverge run must resolve:

- Planning architecture: whether the harness should be a workflow handler, a
  Slack-thread agent pattern, a ledger-backed tool suite, or a composed system
  across all three.
- State durability: what belongs in append-only events, mutable projections,
  markdown artifacts, artifact hashes, checkpoints, and conversation epochs.
- Human orchestration: how the harness asks questions, presents choices,
  pauses, resumes, records approvals, and avoids overwhelming Slack threads.
- Policy selection: how the harness decides the next viable workflow step after
  each phase, including research, convergence, validation, context rotation,
  execution planning, or human decision.
- Reproducibility: how to test that the harness can recreate a coherent plan
  from a brief plus durable artifacts, including the "build itself" smoke test.

## Chosen Lenses

### 1. Autonomous Planning Agent Architectures

This lens owns the agent architecture question: how a planning agent decomposes
goals, maintains an explicit plan state, chooses next actions, delegates
specialist work, and avoids path dependence.

It should inspect Centaur's durable agent control plane, sandbox/harness
adapter, workflow primitives, tool system, and current planning ledger brief. It
should research planning-agent architectures broadly, including plan-and-execute
loops, ReAct-style loops, reflection, hierarchical task networks, graph/state
machine orchestration, and agentic workflow controllers.

This lens enables convergence to choose the top-level planning-harness shape.

### 2. Durable Memory And State Models

This lens owns the state model: append-only ledger events, idempotency,
artifact projections, schema versioning, checkpoint/replay semantics, content
hashing, provenance, recovery, and epoch rotation.

It should inspect Centaur's Postgres-backed runtime control plane, workflow
checkpoint engine, attachment model, execution-event tables, and the current
manual `planning.md` plus `state.json` pairing. It should research event
sourcing, CQRS/projection patterns, durable workflow state, artifact registries,
and long-running agent memory practices.

This lens enables convergence to define the planning ledger and artifact
contract without treating markdown as the source of truth.

### 3. Human-In-The-Loop Orchestration

This lens owns the Slack/chat workflow: how humans are guided through planning
without needing to know the next process step, how approvals are captured, and
how interruptions, resumptions, ambiguity, and multi-human decisions are handled.

It should inspect Centaur's Slackbot, final-delivery, streaming, handoff,
workflow, and thread/runtime APIs. It should research chat-native workflow
orchestration, approval UX, decision capture, Slack modal/message patterns,
human escalation, and collaborative agent systems.

This lens enables convergence to design the planning harness as a useful
human-facing operator, not just an internal state machine.

### 4. Workflow Policy And Next-Step Selection

This lens owns policy: how the harness decides whether to research, ask a
question, converge, validate, rotate context, fixture-lock, produce a plan,
execute, or stop.

It should inspect the current planning open questions and Centaur's workflow
engine extension points. It should research policy engines, planning guards,
workflow selection heuristics, confidence thresholds, agenda management, and
approval gates for autonomous systems.

This lens enables convergence to define the decision policy that prevents the
harness from either stalling or prematurely implementing.

### 5. Self-Evaluation And Reproducibility

This lens owns the verification model: how to prove the planning harness can
replay, reproduce, or materially regenerate a coherent implementation plan from
durable state and artifacts.

It should inspect Centaur's tests, workflow replay model, execution events,
observability, sandbox prompts, and the self-replication requirement in the
planning ledger. It should research reproducible agent evaluations, golden
traces, workflow replay tests, artifact-based smoke tests, and evaluation
rubrics for planning quality.

This lens enables convergence to specify the smoke test that proves the harness
can help build itself.

## Coverage Map

The five lenses cover the planning-harness problem from system shape, to state,
to human workflow, to step-selection policy, to verification:

- Autonomous Planning Agent Architectures defines the active planner.
- Durable Memory And State Models defines what survives context loss and
  process restarts.
- Human-In-The-Loop Orchestration defines the user-facing control surface.
- Workflow Policy And Next-Step Selection defines when the harness moves,
  pauses, or changes workflow.
- Self-Evaluation And Reproducibility defines how humans and tooling know the
  harness is ready.

Overlap is intentional around workflow checkpoints, approvals, and artifacts.
Those boundaries are exactly where a planning harness can fail by becoming too
chatty, too stateful in the wrong place, or too confident without evidence.

## Alternatives Considered

- Multi-agent divergence/convergence patterns: folded into Autonomous Planning
  Agent Architectures and Workflow Policy And Next-Step Selection. Divergence
  and convergence are useful patterns, not a primary research axis.
- Plan validation and execution-readiness gates for bare_metal: folded into
  Workflow Policy And Next-Step Selection and Self-Evaluation And
  Reproducibility. bare_metal is local evidence and a target consumer, not the
  strategic lens.
- Tooling implementation design: deferred. The diverge run should describe
  required primitives and contracts before naming code changes.
- Generic memory research without artifacts: rejected. The core problem is
  durable planning state plus human-consumable projections, not memory alone.
- A pure Slack UX critique: folded into Human-In-The-Loop Orchestration because
  the interaction model must be tied to durable state and workflow control.
- Default relflektion architecture-deepening constraints such as Minimal Deep
  Interface, Maximum Flexibility, Common Caller Simplicity, and Ports/Adapters:
  folded into the task frame instead of used as top-level lenses. The strategic
  uncertainty is the planning-harness product and state model, so the top-level
  cuts stay domain-specific while every recommendation still has to propose deep
  interfaces, dependency classification, boundaries, and verification.

## Non-Goals

- No implementation.
- No convergence or consensus document.
- No remediation backlog.
- No final bare_metal implementation plan.
- No new hand-authored planning sprawl outside this diverge output set.
- No optimizing the architecture around current bare_metal mechanics alone.
- No treating current markdown artifacts as the permanent state model.
