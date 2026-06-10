# comms-factory

Pipeline 3 comms workbench for Infinex.

This repo turns a release brief into grounded, human-approved comms copy:

```text
brief -> grounder -> release card -> Actor -> deterministic validator -> blind Director -> operator ship gate
```

The working product is local-first today. The primary surface is the Next.js
operator harness at `http://localhost:3210`; the production integration target is
a formal service layer around the same pipeline.

## What Exists

- **Grounder**: keeps the reasoning loop and logical tool names in this repo,
  but production `/ground` executes repo/web/browser/search work through
  Centaur's native tool plane (`POST /tools/{tool}/{method}`). Legacy local
  source modules remain explicit dev/test fallback only.
- **Release cards**: Zod-validated fact contract in `src/card.ts`. Generated
  copy can only assert claims present in `deployed_facts`.
- **Pipeline 3 Actor/Director**: one Actor call performs all requested channels;
  a separate blind Director audits voice, facts, movement evidence, and
  publication readiness. See `src/actor-director.ts` and
  `src/actor-orchestrator.ts`.
- **Deterministic validator**: regex and fact-tripwire front door in
  `src/validator.ts`; no LLM self-judging.
- **Operator harness**: local Next.js app in `harness/`, backed by SQLite, with
  prompt capture, run events, Director audits, decisions, edits, and final picks.
- **Director-as-service spec**: handoff design for extracting the Director into
  a standalone audit service in `docs/SPEC-director-as-service.md`, with an
  early harness console at `/director`.

Legacy Pipeline 1/2 code remains as a rollback and comparison path. It is not the
front door for new work.

## Quick Start

Prerequisites:

- Node.js `>=20`
- pnpm
- An Anthropic API key for live grounder / Actor / Director runs

Install:

```bash
pnpm install
pnpm --dir harness install
cp .env.example .env
cp harness/.env.example harness/.env.local
```

Initialize the local harness database:

```bash
pnpm db:init
```

Run the harness:

```bash
pnpm dev:harness
```

Open `http://localhost:3210`.

## Environment

Minimum live setup in `.env`:

```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key>
HARNESS_GENERATOR_ARCH=actor
CENTAUR_BASE_URL=http://api:8000
CENTAUR_TOKEN=<scoped-research-bundle-token>
```

Production attached-service grounding must use Centaur's native tool plane. The
service should be given a token scoped to a research tool bundle only — never a
broad/admin Centaur token — and must not receive `PLATFORM_ROOT`, `gh`,
ProjectJin, local browser binaries, or Slack/GitHub tokens. Local repo/browser
execution is only for explicit dev fallback. For local dev, point
`CENTAUR_BASE_URL` at a mock `/tools` server.

Useful development switches:

- `HARNESS_GENERATOR_ARCH=actor`: Pipeline 3, the default harness path.
- `HARNESS_GENERATOR_ARCH=legacy`: old generator rollback path.
- `HARNESS_ACTIVE_VALIDATOR=0`: disables the LLM validator for legacy harness
  runs. Avoid unless intentionally testing regex-only behavior.
- `HARNESS_ACTOR_WARMUP=scene_rehearsal|daily_pages|none`: controls Actor
  warm-up shape.
- `COMMS_ACTOR_MODEL` / `COMMS_DIRECTOR_MODEL`: override model names.

Do not commit `.env`, `harness/.env.local`, `harness/harness.db`, or generated
render/build artifacts.

## Common Commands

```bash
# Local operator UI
pnpm dev:harness

# Initialize / update harness SQLite schema
pnpm db:init

# Run Pipeline 3 from CLI against a card id or card JSON
pnpm generate:actor -- --card=cards/hyperliquid-spot-unified-2026-05-29.json --channels=x,web

# Validate ad-hoc copy with deterministic rules
pnpm validate "JUST IN: Spot perps now live."

# Test and typecheck root pipeline
pnpm test
pnpm typecheck

# Typecheck / build the harness
pnpm typecheck:harness
pnpm build:harness
```

## Repo Map

| Path | Purpose |
|---|---|
| `src/card.ts` | Release card schema and `deployed_facts` contract |
| `src/fact-grounder-llm.ts` | LLM grounder that turns a brief into verified facts |
| `src/centaur-tools.ts` | Local Centaur native-tools client (`callTool` + `tool_result.v1` types) |
| `src/capability-plane.ts` | Grounding executor: maps logical tools to native `{tool, method}` and runs them via `src/centaur-tools.ts` |
| `src/fact-grounder/sources/` | Explicit local-dev grounding sources: branches, code, pages, registry, rendered pages |
| `src/actor-memory.ts` | Actor/Director memory packs, canonical source index, prompt hashes |
| `src/actor-director.ts` | Actor output contract, Director audit contract, prompt builders |
| `src/actor-orchestrator.ts` | Pipeline 3 retry loop, Director notes, final channel picks |
| `src/validator.ts` | Deterministic slop and claim tripwire rules |
| `src/pipeline-identity.ts` | Proof that a harness run used Pipeline 3 |
| `third_party/mirodan/` | Canonical Mirodan chapters, summary reference, PDF, and source manifest |
| `harness/` | Next.js operator app on `localhost:3210` |
| `harness/lib/schema.sql` | Local SQLite schema for facts, cards, candidates, audits, picks |
| `docs/ARCHITECTURE.md` | Engineering orientation and data flow |
| `docs/ROADMAP.md` | Build plan and open decisions |
| `docs/TESTING.md` | Verification checklist before pushing or handing off |
| `docs/SPEC-director-as-service.md` | Standalone Director service spec |
| `docs/solutions/` | Documented implementation lessons and best practices |

## Operating Rules

- The human ship gate always stays. The system never auto-posts.
- The Actor writes; the Director judges blind. Do not collapse them.
- The validator is deterministic code. Add tests with every new rule.
- Only assert facts that appear in `ReleaseCard.deployed_facts`.
- Do not decide visual specs here. Brand assets and locked visual decisions come
  from brand-factory.
- Do not hard-code brand hexes/fonts in Remotion compositions.

## Current Status

Pipeline 3 is the working path in the harness and CLI helper. The repo is ready
for an engineer to harden the service boundary, not to be treated as a finished
production service.

Near-term engineering work:

- Extract the Director service into a runtime-agnostic module and transport.
- Define the production persistence layer that replaces local SQLite.
- Add auth/secrets/logging around the eventual service surface.
- Keep the harness as a training/debug workbench until operator agreement is high
  enough to retire it.

Read `docs/ARCHITECTURE.md` first, then `docs/ROADMAP.md` and
`docs/TESTING.md`.
