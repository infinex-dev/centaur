# Structured channels build plan — 2026-06-03

> ⚠️ AUTHORITATIVE CURRENT STATE + entry points: **`research/HANDOFF-structured-channels-2026-06-03.md`**.
> This doc is the original spec. The "Edit list" below was written for the FIRST design
> (per-channel independent emission); the EMISSION ARCHITECTURE section (further down) and the
> HANDOFF doc SUPERSEDE it (vertical flow A/B + two-tier section-locked feedback). Read the
> HANDOFF doc first. Status tags: ✅ shipped+green · ⏳ remaining.

Goal: make `web`, `carousel`, `x-thread` emit FAITHFUL structured output (not single
strings), reusable + reviewable in the harness, with validator coverage + tests. Then
generate the Hyperliquid-Spot card across all surfaces.

## Output shapes (from real platform surfaces)
- **web** → `{ subheading, title, caption }` (feature-card-alt). Budgets: subheading ≤24, title ≤48, caption ≤44 (real maxes +slack).
- **carousel** → `{ slides: { name, body }[] }` (app-alert "What's new"). 3–6 slides; name ≤40, body ≤240 (1–3 sentences). Numbered to match the changelog.
- **x-thread** → `{ tweets: string[] }`. 2–6 tweets, each ≤280.
- unchanged single-string: `x`, `in-product`, `modal`, `blog`.

## Representation (low-blast, additive)
`Candidate.text: string` stays the canonical READABLE rendering (slop rules, history-guards,
display, DB all keep working on it). Add optional `Candidate.structured?: StructuredOutput`:
```ts
type StructuredOutput =
  | { kind: 'web-card'; subheading: string; title: string; caption: string }
  | { kind: 'carousel'; slides: { name: string; body: string }[] }
  | { kind: 'thread'; tweets: string[] };
```
Readable rendering for `.text`: web → `subheading\ntitle\ncaption`; thread → tweets joined
`\n\n———\n\n`; carousel → `N. name\nbody` joined `\n\n`. Slop rules run on real words, not JSON.

## Edit list
1. **src/generator.ts** — Channel union += `x-thread|carousel`; `StructuredOutput` type +
   `Candidate.structured?`; `renderStructured()` helper; CHANNEL_GENERATION_PROFILES entries
   (web reshaped, x-thread, carousel) with per-segment budgets; Stage-B prompt + parse emit
   structured for these channels (`buildDraftFromInnerWorkUserPrompt` output shape switch;
   `parseDraftResponseWithBeatPlan` builds structured + text); stub paths.
2. **src/validator.ts** — `structureIssues(channel, structured): string[]` (per-segment length
   + count) exported, rule-grade. Slop RULES still run on `.text`. + tests.
3. **src/orchestrator.ts** + **src/actor-orchestrator.ts** — length gate uses `structureIssues`
   for structured channels instead of `c.text.length > CHANNEL_MAX_LEN`.
4. **src/actor-director.ts / actor-orchestrator.ts** (DEFAULT harness path) — produce structured
   per channel. [edit points pinned by explore — see below]
5. **harness/lib/types.ts** — Channel += both; `HarnessCandidate.structured?`.
6. **harness/lib/queries.ts** — CHANNELS += both.
7. **harness/components/GenerateControls.tsx** — channel options += both.
8. **harness/app/actions/generate.ts** — two `Record<Channel,...>` initializers; persist
   `structured` (JSON) into candidates; read back.
9. **harness/components/CandidateCard.tsx** — render structured (thread = tweet stack, carousel
   = slide cards, web = labeled triple) instead of raw `.text`.
10. **harness/lib/schema.sql + db.ts** — add nullable `structured_json` column to candidates via
    idempotent migration (mirror dropLegacyChannelChecks). No CHECK changes (already dropped).
11. **tests** — validator structureIssues (TDD), generator parse for structured, channel enumerations.

## Emission architecture (RESHAPED 2026-06-03 — operator design session)
The original "generate each channel independently" is replaced. See memory
[[emission-architecture-vertical-flow-feedback-wave]].

- **Vertical flow, A/B by direction.** One coherent narrative derived across lengths, NOT 5
  independent actors. Build BOTH: inwards-out (tweet→thread→modal→web→carousel→blog) and
  outwards-in (blog→carousel→web→modal→thread→tweet). Same card through each → score with
  verifier (classify-corpus) + Director + operator eye → pick winner. Prior: inwards-out likely
  wins (untested).
- **Phantom craft, not tone.** Thread shape + length cadence (~3-center, vary 2–4) + structural
  few-shot from `research/thread-corpus/phantom.json`. Locked Infinex voice UNCHANGED.
- **Unified regex+Director feedback wave (cap 3).** regex (validate + structureIssues) stops
  being a terminal gate — it emits mechanical notes ("tweet 3: 291/280"; "banned word X")
  batched with Director notes → actor revises in one wave → re-gate. Cap 3 (= Director→actor
  cap). regex owns format authority; Director stays format-blind (tone/content only).
- **TWO-TIER section-locked feedback (anti-collapse).** Section = beat = paragraph/tweet/slide.
  Holistic (whole coheres) and section (individually clean) are DISTINCT checks; "done" = both
  green. Principle: don't lock until the whole coheres, else you cement global incoherence (two
  locally-green commanding beats that make the whole monotonous — locking both means holistic can
  never go green). **Tier 1 (no locks):** iterate the whole vs the holistic verdict, free to
  reshape any section, until HOLISTIC green. **Tier 2 (lock+polish):** lock green sections, polish
  red ones neighbor-aware, keep holistic green; a local fix that breaks the whole drops back to
  Tier 1. Mirrors human drafting (arc first, line-edit second). Cap 3 waves total; stragglers →
  human ship gate. NO long-form data yet → two-tier is DEFAULT but the locking regime is a
  PARAMETER, A/B-able vs section-autonomous later. Builds on declared_beats/movement_receipt.

## Then
Build ReleaseCard from `research/grounded-hl-spot-2026-06-03.json` (23 facts; not_said: Infinex
Pro) → run BOTH flows for all surfaces in harness → eval → review X solo + X thread first.

Ship target note: x-thread publishes via Typefully (no native API); carousel = author an
`app-alert` entry; web = data.ts edit. Documented, not auto-posted (ship gate is human).

## Thread corpus + x-thread length variety (task #4 — DONE: corpus built)
Built `research/thread-corpus/{infinex,polymarket,phantom,hyperliquidx}.json` +
`length-distribution.json` from the on-disk wave-1.5 harvest (`scripts/build-thread-corpus.py`,
self-reply reconstruction — NO X API fetch; the data was already on disk).

Dataset-audit finding: raw thread counts are 84% 2-tweet, but that's POLLUTED by
announcement+link / announcement+disclaimer pairs (Polymarket "28% chance" link reply;
HyperliquidX legal disclaimer). After an editorial filter (drop 2-tweet threads whose 2nd
tweet is a bare link or boilerplate), the real signal is **brand house-cadence**:
- Polymarket: ~all 2-tweet (hook + odds)
- Phantom: 3-tweet dominant
- **Infinex (our voice): 2:17, 3:2, 4:4, 5:2, 6:3, 7:2 — a genuine 2→7 spread**

Variety mechanism (cadence-by-observation): for each x-thread generation, sample a target
tweet count from INFINEX's own editorial distribution (not the cross-brand average, which
washes the spread out), bounded 2–6 by `structureIssues`. Pass the target as a soft beat
count into the actor inner-work; use Polymarket/Phantom threads as few-shot for thread SHAPE,
not length. This gives "2 one time, 3 another, 4 another" grounded in real Infinex cadence.
