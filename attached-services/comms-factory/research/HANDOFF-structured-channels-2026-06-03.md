# HANDOFF — structured channels + emission architecture (2026-06-03)

**START HERE.** Single source of truth for an incoming agent (or a compacted continuation).
Everything below is on disk; nothing critical lives only in chat context.

Branch: `director-service-surface`. Card under work: `01KT5FTDJVCCE8ZG5DX4CXAG15` (Hyperliquid
Spot inside Infinex Perps) in `harness/harness.db`.

---

## 1. What this work is
Add three STRUCTURED output channels to the comms pipeline and rebuild how copy is generated:
- `web` → `{subheading,title,caption}` (feature-card-alt), `carousel` → `{slides:{name,body}[]}`
  (app-alert "What's new"), `x-thread` → `{tweets:string[]}`. Unchanged: `x`, `in-product`,
  `modal`, `blog`.
- Generate ONE coherent narrative across surfaces (vertical expand/compress), A/B by direction.
- Lean Phantom for CRAFT/cadence only (locked Infinex voice unchanged).
- regex = formatting authority (emits notes, not terminal); Director = content/tone, format-blind.
- Two-tier section-locked feedback wave (anti-collapse), cap 3.

Full rationale: memory files (below) + `research/structured-channels-build-plan-2026-06-03.md` +
`research/channel-surface-grounding-2026-06-03.md`.

## 2. Read these first (the settled design)
Memory (`~/.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/`):
- `channel-surfaces-map-to-real-platform.md` — each channel's REAL platform home + output shape.
- `emission-architecture-vertical-flow-feedback-wave.md` — vertical flow A/B, Phantom-craft, the
  TWO-TIER section-locked feedback wave. **The core architecture.**
- `methodology-thread-length-house-cadence.md` — thread length anchored on Phantom, craft-not-tone.
- `methodology-ground-channel-abstractions-vs-real-surfaces.md` — why we grounded shapes vs real code.
Docs: `structured-channels-build-plan-2026-06-03.md` (spec), `channel-surface-grounding-2026-06-03.md`
(surface map + 23 grounded facts), `thread-corpus/` (+ `length-distribution.json`).

## 3. DONE + green (✅ on disk; see §6 re: commit)
216 tests pass; harness typechecks clean; root tsc clean except PRE-EXISTING `src/eval.ts`
audience-vs-Channel errors (telegram etc. — not ours, do not "fix" by widening Channel).
- `src/generator.ts`: `Channel` += `x-thread|carousel`; `StructuredOutput` type; `Candidate.structured?`;
  `renderStructured()`; `STRUCTURED_CHANNELS`; reshaped `web` + new `x-thread`/`carousel` in
  `CHANNEL_GENERATION_PROFILES` (with `segments` budgets).
- `src/validator.ts`: `structureIssues(structured)` regex-gate (per-segment length+count) + type-only
  import of `StructuredOutput`. 10 tests in `src/__tests__/validator.test.ts`.
- `src/orchestrator.ts` + `src/actor-orchestrator.ts`: `CHANNEL_MAX_LEN` extended; structured candidates
  gated via `structureIssues` (reject with rule="structure").
- `src/card.ts`: `Audience` enum += `x-thread`,`carousel` (so Channel ⊆ Audience).
- harness: `lib/types.ts` (Channel + `HarnessCandidate.structured_json`), `lib/queries.ts` (CHANNELS +
  rowToCandidate + by-channel maps), `components/GenerateControls.tsx`, `app/cards/[id]/page.tsx` +
  `components/AttemptPanel.tsx` (CHANNEL_LABEL), `app/actions/generate.ts` (2 Record inits + both
  INSERTs/pushes write `structured_json`), `lib/mock-data.ts`, `lib/schema.sql` + `lib/db.ts`
  (`structured_json` column + `addColumnIfMissing` idempotent migration).
- `scripts/build-thread-corpus.py` → `research/thread-corpus/{infinex,polymarket,phantom,hyperliquidx}.json`
  + `length-distribution.json`.

## 4. REMAINING build (in order)
### #2 — Vertical emission flow (A/B) + structured emission + Phantom craft  ⏳ THE BIG ONE
DEFAULT harness path is the ACTOR architecture (`HARNESS_GENERATOR_ARCH !== 'legacy'`), NOT
`generator.ts`. So emission changes land in `src/actor-director.ts` + `src/actor-orchestrator.ts`.
Make the actor (LLM) EMIT structured CONTENT per surface; build BOTH flow directions
(inwards-out tweet→blog, outwards-in blog→tweet) behind the prompt-variant/eval plumbing.

**Pinned actor-path edit points (DEFAULT path) — captured here so they survive context loss:**
- `src/actor-director.ts`:
  - `ActorOutput` interface (~L111-113): `performances` + `selected_performances` are
    `Partial<Record<Channel, ...>>`.
  - `ACTOR_PERFORMANCE_EXAMPLE` (~L408-414): the JSON template the model fills — currently each
    performance = `{text, rationale, movement_receipt[], deployed_facts_used[], not_said[]}`.
    → For structured channels, the example must request `tweets[]` / `slides[{name,body}]` /
    `{subheading,title,caption}` instead of/in addition to `text`.
  - `parsePerformanceArray()` (~L879-891): parses `text` per performance → extend to parse the
    structured shape per channel, build `Candidate.structured` + `text = renderStructured(...)`.
  - `actorOutputToCandidates()` (~L637-676; `text: candidate.text` ~L650): carry `structured` through.
  - Actor prompt length guidance (~L356-357: "X: max 280 chars", "Web: max 140"): keep as WRITING
    guidance only; regex (`structureIssues`) remains the AUTHORITY. Add per-segment budgets for the
    new channels + the x-thread target length (see §5).
  - `DirectorAuditResult` (~L199+): `copy_voice_passed`, `factual_passed`, `infinex_fit.legal` —
    content/tone only, NO length checks. KEEP format-blind. (Confirmed it never checks chars.)
- `src/actor-orchestrator.ts`:
  - `CHANNEL_MAX_LEN` (~L105) ✅ extended; `validateCandidate` (~L291) ✅ calls `structureIssues`.
  - `channelFitPenalty` ideal lengths (~L617) + `allowsParagraphs` (~L620): add web/carousel/x-thread cases.
  - movement-receipt span check (~L387: `candidate.text.includes(receipt.text_span)`): for structured,
    check against the RENDERED text (it already is `candidate.text`, so OK if renderStructured ran).
  - `pickRankedPassingByChannel` (~L411-457): returns winning `Candidate[]` per channel.
- `harness/app/actions/generate.ts`: `persistActorDirectorResult` (~L648-778) ✅ writes `structured_json`.

### #5 — Two-tier section-locked feedback wave (cap 3)  ⏳
See `emission-architecture-vertical-flow-feedback-wave.md` §4. Tier 1 (no locks) iterate whole until
HOLISTIC green; Tier 2 lock green sections, polish red ones neighbor-aware. regex emits per-section
mechanical notes batched with Director notes in one wave. Locking regime = a PARAMETER (A/B-able).
Builds on `declared_beats`/`movement_receipt` (already per-section). Existing Director→actor retry
loop + `DirectorNotes`/`formatChangeLanes` (`src/actor-director.ts` ~L495-518) is the scaffold.

### #3 — Harness UI renders structured  ⏳
`harness/components/CandidateCard.tsx`: when `candidate.structured_json` present, parse + render per
kind (thread = numbered tweet stack w/ per-tweet char counts; carousel = slide cards; web = labeled
triple). Falls back to `.text`. (Today CandidateCard reads `.text` only.)

### #6 — Flow A/B eval  ⏳ (blocked by #2)
Same card through both directions → score with `scripts/classify-corpus.ts` (gold-standard verifier)
+ Director audit + operator eye → pick winner. Prior (untested): inwards-out wins.

### Then — generate the card
Build a `ReleaseCard` from `research/grounded-hl-spot-2026-06-03.json` (23 facts; `not_said`: Infinex
Pro) → run both flows for all surfaces in the harness → review X solo + X thread first.

## 5. x-thread length variety
Sample target tweet count per generation from PHANTOM-anchored cadence (~3 center, vary 2–4), NOT
Infinex's own 61%-twos. Source distribution: `research/thread-corpus/length-distribution.json`
(`editorial` block). Bound 2–6 by `structureIssues`. Pass as the content/beat target into the actor.
Phantom/Polymarket threads = few-shot for SHAPE only. (Operator: lean Phantom, craft-not-tone.)

## 6. Open evals / decisions (don't hard-code)
- Flow direction: inwards-out vs outwards-in — A/B, pick winner.
- Locking regime: two-tier (DEFAULT) vs section-autonomous — keep a parameter, A/B on real blogs.

## 7. How to run
- Tests: `npx vitest run` (root). Typecheck: `npx tsc --noEmit` (root) / `cd harness && npx tsc --noEmit`.
- Rebuild thread corpus: `python3 scripts/build-thread-corpus.py`.
- Ground a brief: `pnpm tsx scripts/ground-once.ts --file=<seed.md> --discover="<subject>" --out=<json>`.
- Harness: Next 15 on localhost:3210; generation = actor path unless `HARNESS_GENERATOR_ARCH=legacy`.
- ANTHROPIC_API_KEY is in `.env` (live generation; else stub).

## 8. Guardrails (project rules that bite)
- Don't widen `Channel` to "fix" `src/eval.ts` — those errors pre-exist (Audience ⊃ Channel).
- Every validator rule needs +/- tests (CLAUDE.md). `structureIssues` has them.
- regex = formatting authority; Director NEVER checks format. Keep the lanes clean.
- Don't drift the locked Infinex voice (`src/voice/infinex.ts`) — Phantom is craft, not tone.
- Ship gate is human; never auto-post. Four template kinds — don't proliferate.
