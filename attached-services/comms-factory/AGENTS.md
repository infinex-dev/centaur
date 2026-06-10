# AGENTS.md — comms-factory

Terse agent-facing rundown. Full project rules in `CLAUDE.md`.

## What this is

Automated comms pipeline for Infinex.

```
brief -> grounder -> release card -> Actor -> deterministic validator -> blind Director -> ship gate
```

Pipeline 3 is the current working path. Legacy generator/orchestrator code remains as rollback only. Don't redesign the split.

## Where things live

| Path | Purpose |
|---|---|
| `src/card.ts` | `ReleaseCard` Zod schema (discriminated union over `kind`) |
| `src/fact-grounder-llm.ts` | brief -> verified facts, branch/PR-aware |
| `src/actor-memory.ts` | Actor/Director memory packs, prompt hashes, canonical source index |
| `src/actor-director.ts` | Actor output contract + blind Director audit contract |
| `src/actor-orchestrator.ts` | Pipeline 3 retry loop and per-channel pick ranking |
| `src/pipeline-identity.ts` | proof that a run used Pipeline 3 |
| `src/generator.ts` | legacy/two-call generator path; rollback/comparison, not front door |
| `src/validator.ts` | brand-agnostic slop rules + claim tripwires — deterministic front door |
| `src/orchestrator.ts` | legacy orchestrators, active validator helpers |
| `src/cli.ts` | `generate | validate | render | ship` subcommands |
| `scripts/run-actor-director-card.ts` | CLI helper for Pipeline 3 without the harness |
| `harness/` | Next.js operator workbench on `localhost:3210` |
| `harness/lib/schema.sql` | local SQLite schema for facts/cards/candidates/audits/picks |
| `docs/ARCHITECTURE.md` | human engineering orientation |
| `docs/ROADMAP.md` | service/handoff roadmap |
| `docs/SPEC-director-as-service.md` | standalone Director service spec |
| `src/__tests__/validator.test.ts` | per-rule positive + negative cases |
| `src/remotion/<kind>/` | TODO — Remotion compositions, gated on brand-factory `voiced` |
| `research/visual-vocabulary.md` | template families (§03), antipatterns (§05), claimed palettes (§06) |
| `research/wave-1.5-tweets/` | per-brand X copy patterns (Polymarket JUST IN:, Phantom emoji-reply, Pendle RT-army) |
| `.claude/skills/remotion-best-practices/` | Remotion patterns — read before any Remotion work |
| `docs/solutions/` | documented solutions to past problems (bugs, best practices, workflow patterns), by category with YAML frontmatter (`module`, `tags`, `problem_type`) — relevant when implementing or debugging in documented areas |

## Cross-repo dependencies

| Source | Path | Consumed as |
|---|---|---|
| brand-factory | `brands/infinex/BRAND.md` | palette, type, voice adjectives (Remotion tokens + generator prompt) |
| brand-factory | `brands/infinex/04-voice/tone.md` | generator system prompt (TODO: not yet authored) |
| brand-factory | `brands/infinex/04-voice/samples/` | generator few-shot examples |
| brand-factory | `brands/infinex/03-identity/locked/` | logo lockup, motion primitives |

comms-factory does NOT run real comms until brand-factory's Infinex brand is at `voiced` status.

## Hard rules

- **Never decide visual specs.** Escalate to brand-factory.
- **Never auto-post.** Ship gate is human-approve.
- **Never add a validator rule without tests.**
- **Never collapse Actor + Director.** Split exists to prevent self-rationalized slop.
- **Never let Director self-ground.** Director asks human on fact gaps; Actor/generator path earns context via grounder.
- **Never claim a competitor palette** (see visual-vocabulary.md §06).
- **Never hard-code hexes/fonts in Remotion compositions** — read from brand spec.
- **Only assert claims that appear in `card.deployed_facts`.** Inventing claims is a hard fail.
- **Never patch a second path for a missing-data bug** ("grounder/agent can't find X") without a source-coverage audit first: per channel (branch code · docs `.md` · live API · website · on-chain) check *reached this run?* + *capable of returning it?* The deepest miss is usually a channel never reached — e.g. a live API never called. See `docs/solutions/workflow-issues/agent-cant-find-fact-run-source-coverage-audit-2026-06-01.md`.

## Quick CLI

```bash
pnpm dev:harness
pnpm tsx src/cli.ts validate "JUST IN: Spot perps now live."
pnpm generate:actor -- --card=cards/<release-id>.json --channels=x,web
pnpm test
```

## Template families (don't proliferate)

Four. Adding a fifth = re-architecture, not a PR.

- `data-card-official` — Polymarket's gift; live metric as protagonist
- `data-card-wry` — same chrome, in-on-the-joke caption
- `launch-tier` — reserved, ~4x/year; scarcity is the signal
- `split` — semantic two-color split (bridge, swap, principal/yield, etc.)
