# HANDOFF — Surface "positioning" in the harness UI (2026-05-29)

**For:** a Claude agent (frontend-design + Next.js build pass) picking this up cold.
**Goal:** add a **positioning layer** to the harness at `http://localhost:3210/` — the things that sit *above* individual cards/runs: the super-objective, the cross-launch through-line, and how each launch ladders to it. Today the harness shows per-card runs but has **no surface for the layer that's larger than any single card.**

---

## TL;DR

The harness renders the pipeline bottom-up: cards → grounded facts → actor/director runs → picks. What's missing is the **top-down spine** — the brand's *positioning*, which in this project IS the locked super-objective, plus the through-line that emerges *across* launches. Make that spine a first-class, prominent surface that the cards hang underneath as evidence.

We proved this session (see `research/positioning-thesis-2026-05-29.md`) that positioning is **derived, not authored**: run any launch from the super-objective with empty inner-work and the actor's table-work lands on the same anchors. The UI should *show* that — the spine up top, each card's derived thesis laddering to it, and whether the set coheres.

A static v0 of exactly this view already exists: **`research/launch-copy-review-2026-05-29.html`** — open it. That's the target, elevated into the live harness with real data.

---

## The concept (read this before building)

- **Positioning = the super-objective.** Not a separate artifact, not a category noun. "Take responsibility for the tech, so the user only has to want." It is simultaneously the company position and the voice spine. (Settled this session; don't re-litigate by adding a "positioning statement" field.)
- **It lives ABOVE cards.** A card is one launch (spot, Synthetix perps, Bridge fiat). The super-objective and the through-line that connects the launches ("Infinex absorbs the plumbing you used to manage → the account becomes one thing") are *larger than any card* and currently invisible in the UI.
- **The cards are evidence for the spine.** Each card's derived `thesis` / `through_action` is a proof-point that should visibly ladder up to the super-objective. The value of the view is seeing coherence (or drift) across the set.

## What to surface (the layer)

1. **The super-objective**, persistent and prominent — the spine of the whole tool. Plus the `validation_criterion` as the test it's held to.
2. **The cross-launch through-line** — synthesized from the derived theses across all cards. ("The account absorbs the plumbing.") This is the headline of the positioning surface.
3. **Per-card ladder** — for each card, its derived `thesis` + `through_action` + the `lining`, shown as "how this launch expresses the super-objective." (Spot: "retire the seam." Synthetix: "widen the room." Bridge: "the bank wall dissolved.")
4. **A coherence read** — are the cards telling one story or drifting? Even a simple "all N launches resolve to the account / we-absorb-the-work" rollup beats nothing. (Stretch: flag a card whose derived thesis doesn't ladder.)
5. **Status honesty** — each card's live/ship status (merged / in-flight PR / not-built) so the positioning view never implies something's live when it isn't.

## Data sources (exact)

- **Super-objective + voice spine:** `src/voice/infinex.ts` — `super_objective` (~L271–277), `super_objective_examples`, `validation_criterion` (~L280), `character_image`, `historical_lore`. These are the spine content. Import the `INFINEX_VOICE` object.
- **Per-card derived positioning:** persisted in `harness.db`, table `actor_attempts`, column **`table_work_json`** — parses to `{ thesis, through_action, obstacle, reader_prior, lining, not_the_point, channel_beat_plans }`. This is the gold: the actor's derived positioning per run. (Pull the latest attempt per card.)
- **Picks / candidates:** `candidates` table (text, channel, validation), `director_audits` table.
- **Cards:** `release_cards.release_card_json` (deployed_facts, kind), `cards` table (brief, status).
- **Existing query layer:** `harness/lib/queries.ts`, schema in `harness/lib/schema.sql`, DB handle `harness/lib/db.ts`.

## Harness architecture & files

- Next.js 15 + better-sqlite3. **Note:** `harness/` has its **own** `node_modules/better-sqlite3` (built for the running Node) — it works. The **root** copy is ABI-stale; don't let that confuse you. Don't run root CLI scripts expecting DB writes without rebuilding root better-sqlite3.
- Pipeline is **Actor/Director (Pipeline 3)** — `runGenerator` in `harness/app/actions/generate.ts` defaults to actor (`HARNESS_GENERATOR_ARCH` unset = actor; legacy is dead code). Grounder is wired into the UI too (`harness/app/actions/research.ts` → `groundFacts`).
- Surfaces today: `harness/app/page.tsx` (card list — the natural home for the positioning header), `harness/app/cards/[id]/page.tsx` (per-card run view), components: `GenerateControls`, `AttemptPanel` (already renders table-work/warmup/transcript/director audit), `ActorRunEventsPanel` (live 2s poll), `FactsTable`, `CandidateCard`, `ShipPanel`, `OperatorFeedbackForm`.
- **Likely shape:** a new prominent banner/panel on `app/page.tsx` (above the card list) for the super-objective + through-line, and/or a dedicated `/positioning` route that aggregates `table_work_json` across all cards into the ladder + coherence view. The per-card page can show the "ladders to the super-objective" tie-in.

## Visual reference

`research/launch-copy-review-2026-05-29.html` is a hand-built v0: through-line pull-quote at top, three launches with channel copy + collapsible derived table-work, status chips, reading notes. **Match its restraint** (editorial serif headers, one accent, lots of whitespace, no slop). Use the `frontend-design` skill; detect and respect any design system already in `harness/`.

## Constraints (project rules — non-negotiable)

- **Don't decide brand specs.** comms-factory consumes the brand; it doesn't author palette/type/voice. The super-objective is the source of truth — read it, don't invent positioning.
- **Don't add a "category noun" / "positioning statement" field.** We proved the super-objective derives positioning; a separate field would re-introduce the thing we disproved.
- **Voice spec stays Laban-pure** — don't put brand vocab into `src/voice/infinex.ts`.
- **Pipeline vocabulary in UI = generator + validator** (and Actor/Director for pipeline 3). Don't surface "Stage A/B."
- **Harness is a review tool, not product** — pragmatic, legible, not over-built. Diff/agreement metrics are its real job; this positioning layer is an operator-comprehension aid on top.

## Suggested first tasks

1. Add a `getTableWorkByCard()` (latest attempt per card) to `harness/lib/queries.ts`, parsing `table_work_json`.
2. Build a `PositioningSpine` server component: super-objective + validation_criterion from `INFINEX_VOICE`, rendered as the persistent header on `app/page.tsx`.
3. Build the cross-card ladder: list cards with their derived `thesis` + `through_action`, grouped under the spine, with status chips.
4. Synthesize/display the through-line (for v1, a static curated line is fine; stretch: derive it).
5. Screenshot-verify against `launch-copy-review-2026-05-29.html` for restraint.

## Open questions for the operator (surface these, don't guess)

- Home-page banner vs dedicated `/positioning` route (or both)?
- Is the through-line curated by the operator, or auto-synthesized from the theses?
- Should the coherence read be a manual operator judgment or an automated flag?

## Session context to inherit

- `research/positioning-thesis-2026-05-29.md` — the thesis + the empirical test result (positioning is derived; super-objective is sufficient).
- `research/launch-copy-review-2026-05-29.html` — the v0 visual.
- The three derived theses (spot/Synthetix/Bridge) are in `research/test-gen-*-2026-05-29.json`.
- Memory: positioning = identity clarity, not competition; super-objective is both company + voice.
