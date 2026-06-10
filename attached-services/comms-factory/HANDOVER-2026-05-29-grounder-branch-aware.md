# Handover — 2026-05-29 · branch-aware grounder shipped & demoed

**Status: good place.** The grounder is now branch/PR-aware and was demoed end-to-end from the harness — clicking **Run Grounder** finds facts from main + the ship-bound branch/PR + their docs + our pages, and reports accurately. Proven on three real launch cards.

## What works (demo-verified)

The pipeline — grounder → card → generator (Pipeline 3 Actor/Director) → validator/director → ship gate — runs from the harness at `localhost:3210` (and CLI). This session's win: **the grounder no longer searches only `main`.**

Clicking Run Grounder in the harness, verified on:
- **Bridge fiat** (`01KSS6J…`) → discovered PR #14474 `bridge-integration` → 7 `platform-code` facts (the `bridgeXyz` API module, `enableBridgeXyz` flag, fiat→USDC-on-Base flow, Persona KYC) + provider-docs (Bridge.xyz virtual accounts) + web (Stripe acquisition).
- **Hyperliquid Spot** (`01KSS7ZW…`) → PR #14581 `infinex-platform-spot` → spot order types, USDC quote, account mechanics.
- **Unified spot+perps balance** (`01KSS8VF…`) → same branch → **caught the unified account accurately** ("one USDC balance across spot and perps"), 0 prototype leakage, 0 unverifiable. This is the exact thing the old main-only grounder missed.

## What was built this session

1. **Branch discovery + recency ranking** — `src/fact-grounder/sources/branch-discovery.ts` (`discoverSources`, `fetchRef`). Inspect via `pnpm tsx scripts/discover-sources.ts --query=bridge`. Ranks open ship-bound PRs over stale/closed "ruins"; distinguishes `feat:` code from `docs(plans)`; picks the freshest, most-complete, ship-bound primary.
2. **Ref-aware grep/read** — `src/fact-grounder/sources/platform-code.ts`: `grepPlatform`/`readPlatformFile` take a git ref (`git grep`/`git show`); a feature branch is a superset of main so one ref-scoped search covers both. Added `-E` (alternation patterns), excludes `bare_metal` and `apps/design-prototype-app` (prototype/fixture noise that was skewing facts).
3. **`groundFacts({ ref })`** — `src/fact-grounder-llm.ts`: ref threaded **explicitly** through `executeToolCall → executeResearchToolCall → grep/read`. This was the critical fix — a module-global did NOT share across Next.js server bundles, so the ref never reached grep in the harness (it worked in CLI, failed in UI). Explicit threading is bundler-proof **and** concurrency-safe (two cards can ground at once). System prompt tells the LLM it's searching the branch.
4. **Harness wiring** — `harness/app/actions/research.ts` `runGrounder`: `featureQuery(brief)` → `discoverSources` → `fetchRef` → `groundFacts({ref})`; discovery shows in the trace.
5. **Harness UI** — `harness/components/CandidateCard.tsx`: per-candidate rationale/beats/validator detail collapsed behind a default-closed toggle, so candidates are glanceable (text + verdict badges visible).
6. **CLI helpers** — `scripts/ground-once.ts` (`--ref`/`--discover`), `scripts/run-actor-nodb.ts` (Pipeline 3 without sqlite, sidesteps the stale native build).

## Gotchas / environment facts for next session

- **Platform checkout**: `~/Sites/infinex-xyz/platform` (= `PLATFORM_ROOT`). Stays on `main`; the grounder `git fetch`es and greps branch refs (`origin/<branch>`). `git` + `gh` must be on PATH (they are).
- **better-sqlite3**: the **root** copy is ABI-stale (Node 25 vs prebuilt). The **harness has its own working copy** (`harness/node_modules`) — the UI is fine. Root CLI scripts that touch `harness.db` need `pnpm rebuild better-sqlite3` first, or use `run-actor-nodb.ts`.
- **Harness dev server**: `cd harness && pnpm dev` (`-p 3210`). `harness/components/*` hot-reload; **`../src/*` changes (the `@pipeline` alias) may need a dev-server restart** to recompile.
- **`featureQuery` is keyword-based** (lexicon + proper noun). **Operator practice that matters**: briefs that *name the concept* (e.g. "unified balance") ground far more accurately, because the grounder discovers from the brief. The thin-brief spot run missed unified accounts; the brief that named it caught them.

## Known open items

- **Pipeline-proof banner green-path UNVERIFIED.** "pipeline proof absent" is a *Generate-stage* artifact — it clears only after the Generator writes a `pipeline_runs` row, not from grounding. There's a suspected split-gate mismatch (`director_passed` checks `infinex_fit.legal`; the proof checks `publication_gate_passed`) that could keep it red "proof missing" even after a good generate. **Verify the green path before relying on it in a live demo.**
- **AttemptPanel actor/director JSON block** (table-work/transcript/source-index) auto-opens when a candidate fails regex — still noisy at the top of each channel. Candidate-level collapse is done; attempt-level collapse is a pending operator call.
- **Discovery holes**: PR-less branches need raw branch enumeration (partially via `git ls-remote`); cryptic-titled branches can be missed.
- **Positioning UI**: a separate agent was handed `HANDOFF-positioning-ui-2026-05-29.md` to build the positioning layer (super-objective spine + cross-launch through-line) into the harness — the "positioning" nav is now live; check its state.

## Next steps (operator direction)

1. **Centaur (Paradigm) integration** — get the pipeline running inside Centaur. *Scope this first in the next session*: what Centaur's integration surface is (agent runtime / API / MCP), and how grounder + generator + validator map onto it. Note `CLAUDE.md` names production surfaces as the Slack bot + MCP server — reconcile with Centaur.
2. **Long-form / blog generation** — extend beyond tweets/short channel copy (x/web/in-product) to blog-length context. Starting points: the `draft-blog` CLI subcommand already exists (`src/cli.ts`, `pnpm draft-blog`); blog-pattern research is in `research/*blog-pattern-audit*` and `research/blog-docs-pattern-2026-05-28.html`. Needs: a blog card kind/channel, the generator producing structured long-form (longer beat sequences), and the validator/voice tuned for length.

## Positioning thread (context, settled this session)

Positioning = the locked **super-objective** ("take responsibility for the tech, so the user only has to want"), NOT a separate category noun. The launch story ("Infinex absorbs the plumbing you used to manage → the account becomes one thing") *derives* from it — proven by generating the three launches from the super-objective alone. See `research/positioning-thesis-2026-05-29.md`, `research/launch-copy-review-2026-05-29.html`. Memory: `feedback-positioning-is-identity-clarity`.

## Reproduce the demo

```
cd harness && pnpm dev          # localhost:3210 (restart if src/ changed)
# UI: open a launch card → Run Grounder → watch the trace discover the branch + ground it
# CLI equivalent:
pnpm tsx scripts/discover-sources.ts --query=bridge
pnpm tsx scripts/ground-once.ts --file=drafts/<seed>.md --discover=bridge --out=research/grounded.json
```
