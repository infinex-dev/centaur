# Handover — Phase 2 complete, next move is Phase 3+

**Date:** 2026-05-22 (evening)
**Supersedes:** `HANDOVER-2026-05-22-voice-pipeline-and-mirodan-tts.md` (the morning Codex handover, for the voice-pipeline thread only — the Mirodan TTS thread is unchanged, still queued).

## TL;DR

Phase 0, 0.5, 1, and 2 of the holistic-generator redesign are **shipped and tested**. The two-call generator (Stage A inner-work → Stage B drafting) produces brand-coherent prose against the locked Infinex character spec. Diagnosis-validation milestone passed: Bridge card now produces 6/6 dissolved-wall posts with 0/6 currency-list regressions and 6/6 under the channel 140-char limit.

Phase 3 (audit layer) is the next high-leverage move. There are two shapes for it — pick one, both reuse the same scorer.

## What's locked (from today)

### Voice spec (`src/voice/infinex.ts`)

- `super_objective: "to take responsibility for the tech, so the user only has to want"`
- `super_objective_examples`: Swidge / spot HL / passkey, framed as *"the X wasn't theirs to figure out"* (no wall language)
- `historical_lore`: Craterun/Yaprun/terrorists scar tissue (never name in prose; informs refusal)
- `validation_criterion`: CTO's "one real user unprompted, no incentives" test
- Per-tempo `lining` on all 12 Infinex tempi (5 main + 7 beat-only) — operator-refinable, current drafts are in the file

### Card schema (`src/card.ts`)

Optional fields added to `Base`:
- `through_action`, `obstacle`, `lining`, `reader_prior`, `not_the_point` — operator-declared per card; grounder will propose them in Phase 4

### Generator (`src/generator.ts`)

- New types: `InnerWork`, `BeatPlan`
- New functions: `generateInnerWork()` (Stage A), `draftFromInnerWork()` (Stage B)
- `generate()` is now an orchestrator that calls A → B by default
- Legacy single-call path preserved behind `opts.legacySingleCall` (used by existing tests with explicit beats)
- `generateForChannels()` runs Stage A once and fans out Stage B per channel (correct — interpretation is channel-agnostic)
- Channel-specific beat-count enforced in Stage A prompt (web=1, x=3-4, in-product=beatless)
- Strict `not_the_point` prosecution: Stage A is instructed to make negative anchors CONCRETE; Stage B treats them as hard refusal

### Tests

- 170 passing (164 baseline + 6 new for two-call flow)
- Two-call cases verify: Stage A returns valid InnerWork, tempi stay in voice's palette, Stage B respects beat plan, `generate()` routes correctly through both paths, pre-computed InnerWork can be passed in

### Methodology memories (in `~/.claude/projects/.../memory/`)

- `methodology-actor-table-work-before-drafting.md`
- `methodology-lean-upstream-fat-downstream.md`
- `methodology-framework-as-diagnostic-instrument.md`
- `infinex-cto-responsibility-frame.md`

## What's NOT done (Phase 3, 4, 5, plus small wins)

### Phase 3 — Audit layer (RECOMMENDED NEXT)

LLM-judged scorer separate from the regex validator. Scores against the six framework layers: Super-Objective alignment, historical_lore violation, validation_criterion fit, structural_traits adherence, per-tempo Lining visibility, off_spec_drives.

**Two shapes — pick one. Both reuse the same scoring engine; difference is the entry point.**

| Variant | Inputs | Output | When to pick |
|---|---|---|---|
| **3a (comms-focused)** | A candidate from Stage B + the committed InnerWork | Score per layer (0-3) + notes, written to `candidate_audits` table in harness DB | If the priority is closing the comms-pipeline loop — operator sees audit scores next to candidates in the harness |
| **3b (audit-as-CLI)** | An arbitrary HTML/markdown file path or URL + voice spec | Ranked gripes with layer attribution, printed to stdout | If the priority is dogfood-triage leverage — the same instrument scores ANY Infinex artifact (landing pages, docs, founder tweets), not just generated comms |

**Strong argument for 3b first**: the 20/24 catch-rate against operator's dogfood-triage (`research/gripe-to-framework-mapping-2026-05-22.md`) suggests the audit instrument is more valuable as a brand-coherence tool for arbitrary artifacts than as a candidate gate. The candidate audit can be added as a thin wrapper after the CLI variant ships.

**Effort estimate**: half-day for 3b (CLI scaffold + scorer + HTML parsing + report formatting); another half-day to add 3a as a wrapper.

**Implementation sketch for 3b**:
- New file `src/audit.ts` — `auditArtifact(text: string, voice: CharacterSpec) -> AuditResult`
- New CLI subcommand in `src/cli.ts` — `pnpm tsx src/cli.ts audit <path-or-url>`
- AuditResult shape: `{ overall_score: number, layers: { layer: name, score: 0-3, notes: string[] }[] }`
- Use Opus (matches generator); prompt walks the six layers explicitly, asks for score + notes per layer
- HTML input: strip tags via a lightweight library or use `node:html-parser` if installed; markdown: pass through
- URL input: fetch + extract main content (consider operating on hand-saved files first to avoid scraping)

### Phase 4 — Grounder proposes inner-work

Extend `src/grounder.ts` (already exists; currently fact-grounds with platform-code / partner-registry / infinex-page / projectjin tools) to ALSO propose `through_action` / `obstacle` / `lining` / `reader_prior` / `not_the_point` per card.

Workflow:
1. Card arrives with raw `deployed_facts`
2. Grounder runs, proposes inner-work fields
3. Operator reviews in harness, approves/edits
4. Generator (Phase 2 two-call) runs against the approved card

**Effort estimate**: half-day. The grounder already has the tooling; this adds a new pass that synthesizes facts into interpretive fields.

### Phase 5 — Harness UI surfaces full chain

Currently harness shows: card → candidates → text edits.

After: card → inner-work fields → Stage A's InnerWork (thesis + beat plan + verbs) → Stage B's candidates → validator failures → audit scores → operator edits at any layer.

DB already has the right tables (`release_cards`, `candidates`, `candidate_audits`, `agreement_snapshots`, `grounder_runs`). New tables likely needed:
- `inner_works` keyed on (card_id, attempt) — persists Stage A output so operator can review interpretation history

**Effort estimate**: half-day code + half-day design pass (the design pass is Claude Code Design's existing scope per project status).

### Small wins (independent of Phase 3-5)

| # | What | Effort | Where |
|---|---|---|---|
| 1 | Validator: `rejectNamedLining` regex rule | 30 min | `src/validator.ts` + test. Catches candidates that name `card.lining` / `card.through_action` / `card.reader_prior` / `card.not_the_point` verbatim. Mirodan §7.3: leak, never name. |
| 2 | Compile Kain-baggage allergen catalog into `off_spec_regexes` | Few hours research + 30 min code | Memory mentions "agent in flight" for this. The 8 patterns become regex-grade brand-allergen checks alongside the existing 3 (time-pressure, fomo-urgency, hype-theatre). |
| 3 | Run Phase 2 against x channel (3-4 beats) | 30 min | Only web (1-beat) was validated this session. X channel needs a real card to test — the only multi-beat card in harness is the Spot CLOB Hyperliquid launch-tier. |
| 4 | Run Phase 2 against a non-wall release | 30 min | All Phase 2 testing was Bridge.xyz (which is wall-shaped). A maintenance window or yield update would test that the prompt doesn't force wall-metaphors. None currently in harness; would need to create one. |

## Recommended sequencing for next session

1. **Phase 3b first** (audit-as-CLI). High leverage — instrument works on arbitrary artifacts, dogfood-triage becomes a 30-second tool, candidate audit (3a) drops in afterward as a wrapper.
2. **Validator `rejectNamedLining` rule** alongside Phase 3b — they touch related code and both add brand-grade gates.
3. **Phase 4 grounder extension** — once audit exists, the grounder's inner-work proposals can be audit-scored before going to the operator. Closes a loop.
4. **Phase 2 channel validation** — run against x channel using the existing Spot HL card, plus a synthetic non-wall card. Document what generalizes vs. what doesn't.
5. **Phase 5 harness UI** — last, because by then the data model is settled and the design pass has the chain it's supposed to surface.

## Files to read first (canonical reading order)

If you're picking this up cold:

1. **This file** — current state + what's next.
2. `src/voice/infinex.ts` — the locked character spec, including new fields. Read this to understand what the generator is constrained by.
3. `src/generator.ts` — the two-call generator. Lines 73-160 are `generate()` + `generateForChannels()`. Lines ~575+ are the new Stage A / Stage B code, the InnerWork / BeatPlan types, the prompts, and stub modes.
4. `research/bridge-card-rerun-2026-05-22.md` — the latest run output. See what the architecture produces.
5. `research/gripe-to-framework-mapping-2026-05-22.md` — the 20/24 catch-rate analysis. Frames why Phase 3b is the high-leverage move.
6. `research/mirodan-actor-process.md` — the Mirodan grounding. Read if you need to defend or extend the architecture.
7. `PLAN-holistic-generator.md` — original morning plan, with Phase 0/1/2 marked complete below. Useful for the WHY behind each phase.
8. **Memory files** at `~/.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/` — the methodology entries explain *how to think about extending this*. Especially:
   - `methodology-lean-upstream-fat-downstream.md` — keep upstream lean
   - `methodology-framework-as-diagnostic-instrument.md` — what the framework IS and isn't
   - `methodology-actor-table-work-before-drafting.md` — Mirodan inheritance
   - `infinex-cto-responsibility-frame.md` — load-bearing brand intent

## Open questions / pending operator decisions

None blocking. Operator-refinable but not urgent:

1. **Per-tempo Linings on `INFINEX_VOICE`** are my drafts (e.g., Sombre = "the trailblazer's awareness that this was once unthinkable"). Operator may want to rewrite some; the drafts work but aren't sacred.
2. **The 4 strict structural gaps from the gripe inventory** are brand-factory work, not comms-factory:
   - Typography lock
   - Motion vocabulary
   - Illustration system
   - Security-alert template family
   These should be flagged to brand-factory; comms-factory cannot fix them.
3. **Whether to retire `defaultBeatsForKind`** — currently demoted to fallback. Once Phase 2 has been validated on x channel and a non-wall card (small wins #3 + #4 above), can be deleted entirely.

## Test the build is clean before starting

```bash
pnpm test          # should report 170 tests passing across 10 files
pnpm tsc --noEmit  # should be silent
```

If either fails, the spec/generator changes from today did not land cleanly — bisect against the recent commits.

## Recovery if something breaks

The single-call legacy path is preserved. To fall back to pre-Phase-2 behavior in any caller:

```ts
const candidates = await generate(card, { legacySingleCall: true, beats: { beats: [...] }, ... });
```

The legacy path produces what it produced before today.
