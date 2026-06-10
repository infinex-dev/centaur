# Launch package run - 2026-05-28

## Scope

Move launch package production onto Pipeline 3 / Actor-Director, with human approval still required before any public post or send.

## Pipeline 3 run completed

- Card: `01KS1CNF123GNFQBAV4S1P5VT0`
- Release: `hyperliquid-spot-2026-05-20`
- Pipeline: Pipeline 3 - Actor/Director
- Runner: `pnpm generate:actor -- --card=01KS1CNF123GNFQBAV4S1P5VT0 --channels=x,web,in-product,email --n=3`
- Email: ignored by generator and retained as draft only / not sendable.
- Review HTML: `research/actor-run-review-01KS1CNF123GNFQBAV4S1P5VT0.html`
- Canonical source draft: `drafts/hyperliquid-spot-2026-05-20.md`

## Pipeline 3 proof

- `HARNESS_GENERATOR_ARCH=actor`: passed
- Entry point `orchestrateActorDirectorWithRetries()`: passed
- `actor_attempts` rows: passed
- `actor_run_events` rows: passed
- Candidate rationale contains `Actor option N`: passed
- Director audit JSON contains `copy_voice_passed`, `factual_passed`, `publication_gate_passed`: passed

## Generated picks

### X

Spot CLOB on Hyperliquid is live on Infinex.

HYPE, UBTC, UETH, USOL, UZEC, PURR and more. Same orderbook as your perps, now for spot.

### Web

Trade spot the way you trade perps. Live on Hyperliquid.

### In-product

Fund your Spot account to start

## Validator status

- X pick: deterministic validator passed.
- Web pick: deterministic validator passed.

## Launch blockers

### Hyperliquid Spark

No ReleaseCard with deployed facts for Hyperliquid Spark was found in `cards/`, `drafts/`, or `harness/harness.db`. The research files contain strategic direction and placeholder examples, but not deployable facts. No Spark launch copy should be generated until a ReleaseCard exists with real `deployed_facts`.

### Synthetics Perps

No ReleaseCard with deployed facts for Synthetics Perps was found in `cards/`, `drafts/`, or `harness/harness.db`. The existing `cards/eval/perps-live-2025-03-04.json` is an eval card for generic perps and should not be treated as the Synthetics launch source.

### Bridge / on-off-ramps

The harness DB has `01KS6QJNEGFYP6X048V8Y900DM` for Bridge.xyz fiat deposits, but its deployed facts state that Bridge code has not yet landed in the platform codebase. Treat this as draft-only / not public until platform deployment facts replace that blocker.

## Ship gate

No posting, sending, or publishing was performed. Human selection/editing remains mandatory.
