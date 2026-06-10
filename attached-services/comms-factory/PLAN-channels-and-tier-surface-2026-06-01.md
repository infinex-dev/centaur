# Plan — first-class blog/modal channels + grounder-recommended tier surface

**Date:** 2026-06-01
**Branch:** github-ready-pipeline3-handoff
**Trigger:** operator on the generate screen (localhost:3210) — channels (web/x) and comms tier are decided silently upstream and never surfaced/overridable before clicking "run generator".

## Two asks (operator chose the bold option on both)

1. **Channels** — `blog` and `modal` become **first-class generator channels** (own grammar profile + voice register + audience enum), and channel selection becomes an explicit **approve step** in the generate UI instead of silent `card.audience` derivation.
2. **Tier** — the grounder/card-builder **recommends a `kind`** with a visible reason, surfaced as a labeled recommendation, **overridable before generate**.

## Key realization from recon — most plumbing already exists

- `runGenerator(cardId, channels?)` already accepts an explicit channel list (`harness/app/actions/generate.ts:56`). The UI never passes it — it falls back to `expectedChannelsForCard()` (`:65`). The approve step is mostly UI wiring.
- The card-builder LLM **already picks `kind`** (`harness/lib/card-builder.ts:16`). Net-new is extracting the *reason* + surfacing it + making override first-class. `CardEditor.tsx` already edits `kind` via raw JSON.
- Validator is channel-agnostic — **no validator change** (`src/validator.ts`).
- Renderer only wires `data-card-official` and is a TODO stub until brand-lock — blog/modal stay text-only.

## Defaults taken (reversible, local)

- **Kind override writes back to the card** (`release_cards.release_card_json`), not a per-run ephemeral override. Kind is a card property; per-run drift between card and output is worse.
- **blog/modal are text-only** — no Remotion path. Renderer stays stub.
- Grammar profiles below are **starting values**; calibrate from generated output (cadence-by-observation), don't over-tune upfront.

## Starting channel grammar profiles

**Profiles carry SITUATION ONLY — never register/tempi.** Length, reader-context, format, CTA-or-not.
Voice and tempo emerge from the actor's table-work + the locked voice spec (`src/voice/infinex.ts`).
Stamping a tempo motor onto a channel ("Sombre-prep → Irradiant-release") is the paint-by-numbers
trap — pre-assigned tempo with no inner cause reads fruity. The actor decides HOW; the channel only
says WHAT and FOR WHOM. See [[methodology-actor-table-work-before-drafting]], [[voice-spec-laban-pure]].

| channel | length | beatless | what it is (situation only) |
|---|---|---|---|
| x (exists) | 280 chars | no | public post on the timeline |
| web (exists) | 140 chars | no | headline on a feature/announcement card, read on a page/timeline; broadcast, reader is browsing |
| in-product (exists) | 80 chars | yes | one phrase embedded in the product (button, tooltip, empty state) |
| **modal** (new) | ~250 chars | no | in-app dialog over the product, shown to a user mid-flow; short title + a line or two + a CTA; addressed to an active user with a next action |
| **blog** (new) | 300–600 words (~3600ch ceiling) | no | full long-form post; multi-paragraph, free to move |

Open: if modal's "mid-flow + CTA" framing doesn't earn a distinct channel once we see output, collapse it
into a longer in-product variant. Decide from real candidates, not upfront.

---

## STATUS

- **Phase 1 — DONE** (2026-06-01). Channel type extended (`src` + harness), all `Record<Channel>` literals filled, `Pick.channel` pointed at `Channel`, `Audience` enum extended, `expectedChannelsForCard` filter tightened to `CHANNELS` membership. SQL CHECKs dropped from `schema.sql` + idempotent `dropLegacyChannelChecks` migration in `db.ts` rebuilds existing tables. Verified: both typechecks clean, 206 tests pass, migration ran on live DB (CHECK gone, 18 cards / 1576 candidates preserved, blog+modal inserts accepted). DB backed up to `harness/harness.db.bak-*`.
- **Phase 2 — DONE** (situational guidance). `modal`/`blog` profiles written (situation only, no register). Fixed two hardcoded channel switches that would've trapped the new channels: beat-count rule (`generator.ts`, emergent beats for modal/blog instead of forced 3) and `channelFitPenalty` (`actor-orchestrator.ts`, sane ideal lengths + allow paragraphs for blog/modal). Length-penalty granularity for blog flagged for calibration once we see real candidates.
- **Phase 3 — DONE** (tier surface). `CardEditor` now shows a tier selector (4 kinds) above the JSON; the kind the card-builder chose is badged "· grounder", and a `why` + `needs/missing` line surfaces the rationale and any required fields the chosen kind still lacks. No new LLM output — surfaces the kind the builder already picks. Selecting a kind rewrites `kind` in the editable JSON; existing save/approve validates.
- **Phase 4 — DONE** (channel approve step). `GenerateControls` renders a 5-channel toggle row (defaults pre-checked from card audience, marked with `·`), passes the explicit selection to `runGenerator(cardId, channels)`. `page.tsx` candidate display loop de-hardcoded (`displayChannels`) so blog/modal candidates render. Harness typecheck clean; verified live in browser.
- Coexistence note: `src/blog-draft.ts` is a separate human-fill markdown scaffold (touchpoints `website-blog`/`website-modal`), unrelated to the new generator `blog`/`modal` channels. No conflict; keep an eye they don't drift conceptually.

## Phase 1 — channel type + plumbing (mechanical, type-driven)

Add `blog`, `modal` to the channel enum and propagate. Type system will flag every incomplete `Record<Channel,...>`.

- `src/generator.ts:110` — `Channel` type: add `"blog" | "modal"`.
- `src/generator.ts:212-226` — `CHANNEL_GENERATION_PROFILES`: add blog + modal entries (table above).
- `src/orchestrator.ts:50-54` — `CHANNEL_MAX_LEN` (legacy path).
- `src/actor-orchestrator.ts:105-108` — `CHANNEL_MAX_LEN` (actor path).
- `harness/lib/types.ts:10` — `Channel` re-export.
- `harness/lib/queries.ts:25` — `CHANNELS` const.
- `harness/lib/schema.sql:126,201,233,277,353` — five `channel` CHECK constraints (generator_attempts, actor_run_events, candidates, director_audits, final_picks). **Migration needed** — SQLite CHECK can't be altered in place; rebuild-table migration or relax to app-level validation.
- `src/card.ts:29` — `Audience` enum: add blog/modal if audience is the channel source. Verify whether audience and channel should stay coupled.
- Every `Record<Channel,...>` literal grouping: `generate.ts:73,588` (`{x:[],web:[],'in-product':[]}` → add blog/modal).

**Test:** existing generator/orchestrator tests compile + pass with new keys; add a generate-for-blog and generate-for-modal smoke test.

## Phase 2 — channel situation profiles (NOT register)

- Write blog + modal `guidance` strings as **situational** only: what the surface is, who reads it and in
  what context, whether there's a CTA, the length budget. NO tempo/register prescription — the actor derives
  voice from table-work + the voice spec. Match the plainness of the existing x/web/in-product guidance.
- `blog` breaks the char-only model: store ceiling ~3600 chars in `CHANNEL_MAX_LEN`, express target as
  "300–600 words" in guidance.
- Check beat-to-prompt translation handles the new non-beatless channels (`generator.ts:791-815`).
- Generate a few real candidates per new channel, eyeball that length + reading-context land. Calibrate
  length only. If modal doesn't read as distinct from a longer in-product, collapse it.

## Phase 3 — tier recommendation surface

- `harness/lib/card-builder.ts` — have `buildReleaseCardFromFacts()` return `{ releaseCard, recommended_kind, recommendation_reason }`. Prompt the builder to emit a one-line reason for its kind choice.
- `harness/app/actions/card.ts:11-42` — `buildReleaseCard()` plumbs recommendation to the client.
- `harness/components/CardEditor.tsx` — surface recommendation as a labeled badge ("grounder recommends **launch-tier** — first spot CLOB on Arbitrum") with a discrete kind selector (4 options) above/instead of burying `kind` in the JSON textarea. Override persists via existing `editReleaseCard`.
- Generate screen — echo the locked tier + reason as a readout (so it's visible "before I click generate"), with a "change tier" affordance that routes back to the card edit (or inline updates the card).

## Phase 4 — channel approve step in generate UI

- `harness/components/GenerateControls.tsx` — add a channel multi-select, pre-checked from `expectedChannelsForCard()` (the recommendation), with blog/modal toggleable. Pass the selected array to `runGenerator(cardId, selectedChannels)`.
- Surface the run config readout the operator already sees (max attempts 3, 5/channel, memory act-in-memory-v1) as an explicit pre-run panel rather than only in the post-hoc live trace.

## Phase 5 — renderer guard (optional, low priority)

- `src/remotion/render.ts:76-146` — since kind is now freely overridable, add a pre-render check that the card carries the fields its kind needs (launch-tier→headline, split→from/to, data-card→metric+value). Low priority — renderer is stub until brand-lock.

---

## Blast radius of free kind override

- generator beats per kind: legacy/stub fallback only — live two-call path doesn't use kind for beats. LOW.
- voice defaults per kind: CLI fallback only. LOW.
- renderer slots per kind: HIGH if rendering — but renderer is stubbed. Deferred to Phase 5 guard.

## Open question deferred

Audience↔Channel coupling: `expectedChannelsForCard` derives channels by filtering `audience`. If blog/modal are channels, do they belong in `audience` too, or does channel selection fully decouple from audience at generate-time? Phase 4 leans toward decoupling (explicit per-run selection); audience becomes the default seed, not the source of truth.
