# Launch package workflow — Pipeline 3 production mode

**Status:** production workflow note for real Infinex comms. Human approval remains mandatory. No auto-posting or auto-sending happens from `comms-factory`.

## Source of truth

Use one canonical blog/docs source per launch, following `research/blog-docs-human-edit-template-2026-05-28.md`.

Hard rule: only `deployed_facts` can become claims. `through_action`, `obstacle`, `reader_prior`, `lining`, competitor context, and operator intent are scene/context only.

## Required launch package fields

- `release_id`
- `status: draft | reviewed | approved`
- `ship_date`
- `owner`
- `audience`
- `canonical_url`
- `slug`
- `deployed_facts`
- `proof_links`
- `non_assertable_context`
- canonical page body
- touchpoint adaptations for X, Telegram/in-app, website modal or announcement pipe, email draft, and press notes

## Generation path

1. Create or locate a `ReleaseCard` with exact `deployed_facts`.
2. Run Pipeline 3 only:
   `pnpm generate:actor -- --card=<card-id-or-json-path> --channels=x,web,in-product --n=5`
   Optional operator weighting:
   `--prefer=web:<phrase>` or `--avoid=x:<phrase>` can be repeated to affect ranked selection without changing the factual/voice gates.
3. Confirm report proof:
   - `HARNESS_GENERATOR_ARCH=actor`
   - `orchestrateActorDirectorWithRetries()`
   - `actor_attempts` rows
   - `actor_run_events` rows
   - candidate rationale contains `Actor option N`
   - Director audit JSON has `copy_voice_passed`, `factual_passed`, `publication_gate_passed`
4. Regenerate review HTML and have a human select/edit.
5. Run validator on public short copy.
6. Ship manually outside `comms-factory`.

## Channel mapping

- Blog/docs canonical page: human-editable Markdown source.
- X: Pipeline 3 `x` output, fact-first, under 280 chars.
- Telegram/in-app: use `in-product` output as the compact base; expand manually only from `deployed_facts`.
- Website modal or announcement pipe: use `web`/`in-product` outputs; keep body claim-minimal.
- Email: draft only / not sendable until Mailtrap bulk stream plus `updates.infinex.xyz` is live.
- Press: notes only unless partner/compliance approval is captured.

## Launch priorities

- Hyperliquid Spark: Hyperliquid terse-fact copy; Spark signature-object tease arc; high motion budget.
- Synthetics Perps: Pendle problem-first canonical page and educational thread.
- Bridge/on-off-ramps: Phantom three-bullet user-verb shape; arrows, not emoji; in-app carries the detail.
