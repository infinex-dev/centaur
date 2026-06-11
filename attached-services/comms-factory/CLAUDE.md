# comms-factory — Project Rules

## What this repo is

The **automated comms pipeline** for Infinex. When something ships — a GitHub release, a product launch, a feature flag flip — comms-factory turns the event into a shippable video+text comms artifact via a single linear pipeline:

```
release event -> release card -> generator -> validator -> orchestrator -> renderer -> ship gate
```

Mirrors the **card -> generator -> validator -> orchestrator -> CLI** pattern that runs Nigel's voice subsystem. Same shape, different domain. The pattern is portable; don't redesign it.

comms-factory is the **execution surface**. The **brand spec** (palette, type, motion primitives, voice samples) is brand-factory's output, consumed here. comms-factory does NOT decide visual specs. It enforces them.

## Inheritance from global rules

Global preferences in `~/.claude/CLAUDE.md` apply unchanged: terse comms, warm sessions, ambition calibration, method compounding, parallel Task agents, turn-type modes, tool-output hygiene. **Do not duplicate.** This file only adds what's specific to comms work.

## Pipeline contract — never collapse stages

Each stage has one job and exactly one job:

| Stage | Input | Output | Job |
|---|---|---|---|
| **release card** | release event (GitHub release, ship-day record) | `ReleaseCard` (Zod-validated) | structure the event + lock the deployed_facts |
| **generator** | `ReleaseCard` + voice/brand spec | N caption `Candidate`s | produce, never self-audit |
| **validator** | one caption string | `ValidationResult` (rule-level failures) | regex/heuristic gates — no LLM judges |
| **orchestrator** | candidates + channels | per-channel `Pick`s + rejected pool | filter -> rank -> shape to channel |
| **renderer** | `Pick` + brand spec | mp4 / png / poster | Remotion composition selection by `card.kind` |
| **ship gate** | rendered artifact | post / no-post | human-approve, never auto-post |

**Why the split:** if a single model both writes AND audits its own output, it rationalizes slop. The validator must be regex-grade and external. The orchestrator must not collapse into the generator. The renderer must not pick its own template. Same discipline as Nigel.

## Release cards — what they ARE

`src/card.ts` defines `ReleaseCard` as a discriminated union over `kind`:

- **`data-card-official`** — live product metric as protagonist. Polymarket's gift. Default for shipped numbers.
- **`data-card-wry`** — same chrome, in-on-the-joke caption. The "two-register" cultural lane.
- **`launch-tier`** — reserved template, ~4x/year. Berachain's lesson: scarcity is the signal.
- **`split`** — semantic two-color split (bridge from/to, in/out, principal/yield). Pendle's lesson.

Orthogonal to `kind`, cards carry an optional editorial **`category`** (the genus, not the template): absent/`changelog` = release/changelog behavior (blog changelog scaffold + format gate); `thesis` = long-form positioning essay — no CTA anywhere (validator rule `thesis-cta`), essay-length blog cap (12k chars vs 3600), ships to X via the ship-gate X-article transform, audience typically `["blog","x-thread","x"]`. Thesis pieces do NOT consume a launch-tier slot; `kind` is renderer-only for them. Don't add a fifth `kind` for editorial genera — extend `category`.

Every card carries `deployed_facts: string[]` — the load-bearing claims the release actually makes. **The caption cannot assert anything not in deployed_facts.** This is the fact-check anchor. If the release says "yields up to 18.94% APY", that string is in deployed_facts; if the generator writes "20% APY", the validator catches the drift (TODO: fact-check rule pending; for now, prompt-level only).

Cards live in `cards/<release-id>.json` (created at ship time by whatever emits the release event). The CLI consumes them.

## Validator — what it checks (BRAND-AGNOSTIC slop)

`src/validator.ts` is real code, not vibes. Each rule is an exported function with tests. Current rules:

- **`rejectCliches`** — game-changer, unlock, paradigm, seamless, empower, leverage (verb), next-gen
- **`rejectListicleVoice`** — "N reasons", "why X matters", "the only X you'll ever need", "top N"
- **`rejectAntagonism`** — named competitors paired with pejoratives (coinbase|binance|kraken|...) — narrow today, allergen-catalog expansion in flight
- **`rejectAIslop`** — innovative, cutting-edge, revolutionary, "thrilled to", "stay tuned", em-dash density > 2 per 280 chars
- **`rejectKainBaggage`** — placeholder; allergen-catalog agent researching Kain-era verbal tics in parallel
- **`rejectClaimedPalettes`** — Polymarket #2E5CFF, Pendle #1BE3C2, Phantom #AB9FF2, Monad #6E54FF, Hyperliquid ~#97FCE4, Berachain ~#F5B82E

Anti-patterns sourced from `research/visual-vocabulary.md` §05 + Wave 1.5 tweet recon.

**Brand-specific rules belong in brand-factory's tone.md and load into the GENERATOR prompt.** Brand-agnostic slop heuristics belong HERE because they catch failure modes the prompt can't be trusted to self-police.

## Where templates live

Remotion compositions live in `src/remotion/<kind>/`:

- `src/remotion/data-card-official/`
- `src/remotion/data-card-wry/`
- `src/remotion/launch-tier/`
- `src/remotion/split/`

**These are NOT yet built.** The brand spec drives them; build only after brand-factory has Infinex at `voiced` status. Until then the renderer is a `TODO` stub in `cli.ts`.

Templates must be **chain-agnostic** (Phantom's lesson — chain references as labels inside the accent system, never as accent swings) and **product-agnostic** (one identity across all release types; differentiation is via `kind`, not via color swap).

## How brand-factory feeds in

```
brand-factory                                       comms-factory
-------------                                       -------------
brands/infinex/BRAND.md (palette, type, voice)  ->  Remotion template tokens
brands/infinex/03-identity/locked/              ->  logo lockup, wordmark, motion primitives
brands/infinex/04-voice/tone.md                 ->  generator system prompt
brands/infinex/04-voice/samples/                ->  generator few-shot examples
```

**Hard constraint:** comms-factory does not run real comms until brand-factory's Infinex brand is at `voiced` (per brand-factory's gate machine). Renders before then are stubs for pipeline-shape work only.

When brand-factory updates a locked spec, comms-factory's templates may need to refresh — but template-token wiring is the only refresh path. Never hard-code a hex or a font in a Remotion composition; read from the brand spec.

## How to run the CLI

```bash
# Ad-hoc: check whether a caption survives the validator
pnpm tsx src/cli.ts validate "JUST IN: Spot perps now live on Base."

# Generate candidates from a release card (stub generator if ANTHROPIC_API_KEY is unset)
pnpm tsx src/cli.ts generate cards/<release-id>.json

# Render (TODO once Remotion compositions land)
pnpm tsx src/cli.ts render cards/<release-id>.json

# Full pipeline including ship gate (TODO)
pnpm tsx src/cli.ts ship cards/<release-id>.json
```

The validate subcommand is the highest-frequency tool — useful immediately for ad-hoc copy review even before generation/rendering is wired.

## Anti-patterns specific to comms work

- **Don't decide visual specs.** Palette, type, motion primitives are brand-factory's output. comms-factory consumes them. If a brand decision feels load-bearing, escalate to brand-factory — don't make it here.
- **Don't auto-post.** The ship gate is human-approve. The pipeline runs end-to-end except the final POST; that's deliberate.
- **Don't add a rule to the validator without a test.** Every rule in `src/validator.ts` has positive + negative cases in `src/__tests__/validator.test.ts`. Adding a rule without tests = silently breaks the pipeline.
- **Don't collapse generator and validator.** The reason the split exists is in this file's pipeline-contract section. If you find yourself adding "and also reject X" to the generator prompt, that rule belongs in the validator instead.
- **Don't render before brand-locked.** Remotion compositions read from brand-factory's locked spec; until Infinex is at `voiced`, the renderer stays as a TODO stub.
- **Don't proliferate template families.** Four kinds (`data-card-official`, `data-card-wry`, `launch-tier`, `split`). Adding a fifth is a re-architecture decision, not a one-PR addition.
- **Don't claim a competitor palette.** Validator catches mentions in copy; reviewer catches them in visuals. See `research/visual-vocabulary.md` §06.
- **Don't write voice prompt templates here.** Voice lives in brand-factory `04-voice/tone.md`. comms-factory's generator imports/cites that path; it does not duplicate it.

## Status

Scaffolded: card schema, generator skeleton, validator (rule-complete for brand-agnostic slop), orchestrator skeleton, CLI, tests, fact-grounder LLM with platform-code/partner-registry/infinex-page/projectjin tools, v2 Laban classifier (`scripts/classify-corpus.ts`), 3-shell viz (`research/laban-viz/`), Infinex voice spec at `src/voice/infinex.ts` (locked 2026-05-15, character image "banker-turned-crypto trailblazer"), CharacterSheet at `research/infinex-character-sheet.md`, portable bundle at `research/infinex-character-bundle.md`.

**Training harness** at `harness/` (Phase 1 scaffolded 2026-05-19) — Next.js 15 + better-sqlite3 review tool to bring each pipeline stage to ≥80% operator agreement before autonomous use. Diff capture + agreement metrics are the deliverable. See `harness/HANDOFF-SPEC.md` for the Codex implementation contract. Memory: `training-harness-not-product.md`. NOT a long-lived product; production surfaces are the Slack bot + MCP server.

Pending:
- Brand spec from brand-factory (Infinex at `voiced` status)
- Remotion compositions (`src/remotion/<kind>/`)
- Harness Phase 2 (pipeline wiring) + Phase 3 (persistence, diff capture, agreement metrics) — Codex pass
- Harness visual treatment — Claude Code Design pass
- Slack bot wrapping the production pipeline (fast lane sibling to harness's deep-review lane)
- MCP server exposing `/generate`, `/validate`, `/audit` tools
- Kain-baggage allergen catalog (agent in flight)
- Ship-gate posting integration (human-in-the-loop X API client)
