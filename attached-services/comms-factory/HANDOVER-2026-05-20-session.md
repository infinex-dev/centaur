# Session handover — 2026-05-19/20

**Date:** 2026-05-19 (afternoon) → 2026-05-20  
**Predecessor:** `HANDOVER-2026-05-18-laban-audit.md` (Laban audit + Phantom analysis + 3-shell viz handoff to designer)  
**Session model:** Opus 4.7 → switched to Sonnet 4.6 at close  
**Successor task:** Pick up with harness operator testing, Slack bot, or deeper corpus work — see §3

Read this top-to-bottom before resuming. Dense by design.

---

## 0. TL;DR — where we are right now

**Five major deliverables landed this session:**

1. **3-shell viz with drive layer** — designer's React/Babel app integrated at `research/laban-viz/`; drive-axis color coding added to tempo spokes + fingerprint rows + modal side panel; new `scripts/aggregate-tallies.py` for deterministic re-aggregation; server running on `http://localhost:8765/`
2. **Infinex voice character locked** — character image finalised as "banker-turned-crypto trailblazer" (`src/voice/infinex.ts` + memory); CharacterSheet for colleagues at `research/infinex-character-sheet.md` (v2, source-audited, framed as training harness not spec); portable bundle at `research/infinex-character-bundle.md`
3. **Closed-loop generator test** — bundle subagent (Sonnet) got 40% beat match; production generator (Opus) got 69% (one 4/4 perfect candidate); confirms production pipeline is the right Slack-bot backend; findings at `research/bundle-vs-production-generator-test.md`
4. **Training harness — Phase 1 + 2 + 3 complete** — `harness/` is a fully functional Next.js 15 app backed by SQLite; all 17 Server Actions wired to the real pipeline; three-mode diff capture (field, text, semantic); agreement metrics engine; DB initialized; build present; runs at `http://localhost:3210/`
5. **Design handoff zip** — `~/Downloads/comms-factory-harness-design-handoff.zip` was produced for Claude Code Design; design pass (Phase 2) was subsequently completed by Claude Code Design (Phase 1 → 2 → 3 complete sequence)

**Status: blocked on nothing.** The harness is runnable. The Slack bot is the natural next build. The corpus analysis needs a refresh pass for phantom-vs-infinex-gap.md but that's optional and can wait.

---

## 1. Session arc (phases A–M)

### Phase A — Designer's viz integration

Designer returned with a React/Babel-standalone app (vs the Python script expected). Architecture change:
- Old: `scripts/render-laban-3shell.py` → single HTML with embedded SVGs  
- New: `research/laban-viz/` — React app with `app.jsx`, `shell3.jsx`, `fingerprint.jsx`, `framework.js`, `styles.css`, `data/` directory

Designer's data JSONs were byte-identical to our v2 classifications (just renamed). Designer had hand-crafted `tallies.json` without a regeneration script. Discovered tallies were aggregated inconsistently across surfaces.

Served over HTTP (CORS blocks file:// for fetch + Babel XHR): `python3 -m http.server 8765 --directory research/laban-viz/`.

### Phase B — Drive layer restored to the viz

The designer's app had **zero drive references** — framework.js, app.jsx, shell3.jsx, fingerprint.jsx, tallies.json all stripped drive vocabulary. Re-added:

- **`scripts/aggregate-tallies.py`** — new aggregator, deterministic, primary-only for drives, primary+outer for tempi/inners. Regenerates `research/laban-viz/data/tallies.json` from the 9 `research/{phantom,infinex}-classifications-*.json`
- **`research/laban-viz/framework.js`** — added `DRIVE_COLOR`, `DRIVE_AXIS_ORDER`, `axisDestination()`, `axisColor()`, `dominantAxis()` 
- **`research/laban-viz/shell3.jsx`** — tempo spokes now filled by destination-drive color (extravert side of axis), inner-attitude color as stroke; hover tooltip gets 3rd line (dominant drive axis + count/total)
- **`research/laban-viz/fingerprint.jsx`** — second row added beneath inner-attitude bar showing drive-axis stacked bar; `driveAxisCounts` prop added
- **`research/laban-viz/app.jsx`** — `driveAxisCounts` passed to FingerprintBar at both call sites; new SidePanel "Main Character-Action Axis" section; Drives legend block added; stale footer note replaced
- **Stale footer note fixed** — designer's footer said "missing adream/remote/enclosing/radiating from classifier" — that was v1; v2 has full taxonomy

Observed axes across all 9 surfaces: doing→vision (154), passion→vision (54), spell→passion (52), passion→spell (46), doing→passion (20), spell→vision (15), doing→spell (6), passion→doing (3).

**The 12.7× fidelity ratio confirmed (9 vs 114 samples on-spec vs off-spec) is an observational baseline — the spec didn't exist when that copy was written. NOT a failure metric.**

### Phase C — CharacterSheet v1 (naive draft, then corrected)

Initial CharacterSheet at `research/infinex-character-sheet.md` used:
- "Gravity/awe/warmth" labels → **drift** from operator-canonical labels
- "Patient craftsperson" character image → **incomplete** (missed the "settled visionary watching from behind" Mirodan weight)
- "We have a voice that doesn't ship" framing → **wrong** (the spec postdates the corpus; no contemporaneous spec existed)
- Missing cadence weights, beat sequences, worked examples, all 5 named registers

**Key correction saved to memory:** `infinex-character-lock-postdates-corpus.md` + `methodology-voice-audit-spec-precedence.md` — when auditing, check whether the spec preceded the corpus. If not, use forward-looking language only.

### Phase D — Character image research + lock

Searched for operator-locked character image. Found:
- `skills/laban-voice-for-ai-agents/examples/infinex-voice-spec.md` (2026-05-12, older snapshot) — listed 3 candidate images (shipwright / cartographer / quiet architect), none explicitly locked
- `src/voice/infinex.ts` (2026-05-15, newer) — had `"wise-old-guard"` as the locked image

Operator then articulated on 2026-05-19: **"the banker-turned-crypto trailblazer — knows the old world, found the better way, decisions already taken, now mapping."** This is more castable and product-fitting than "wise-old-guard." Both describe the same Mirodan Stable-D placement.

Locked in three places:
- `src/voice/infinex.ts` — top JSDoc + structural_traits[0]
- `research/infinex-character-sheet.md` — leads with banker-trailblazer, keeps Werle/Duke as literary anchors
- Memory: `infinex-character-image-banker-trailblazer.md`

Mirodan p. 489 quote verified: *"for Stable all important decisions have already been taken and it is only a matter of pursuing the chosen course to the end."*

### Phase E — Source verification against Mirodan chapters

Cross-checked CharacterSheet against canonical source material found at `~/Downloads/nigel-session-2026-04-28/mirodan-ch{1-4}-*.md` + the 1-page synthesis (71KB) + vol 2 PDF.

**Previously I said Mirodan vol 1 chapters weren't on disk — WRONG.** They're at `~/Downloads/nigel-session-2026-04-28/`. Saved memory: `mirodan-source-files-location.md`.

**Audit verdict: 10/12 claims canonical-verified. 3 minor drift items:**

1. **LOW** — plain-English labels (Future-warmth/Institutional drop/Weight-of-conviction etc.) are operator-coined translations, not direct Mirodan vocabulary. Glossary preamble now flags this.
2. **LOW** — Werle is listed as Stable Diagram A (Time-stressed, Enclosing) in Ch4:278; Duke is the tight Diagram D match. Both share Stable baseline; Ch2:261 also lists Werle alongside Duke as Flow-stressed Stables (internal Mirodan tension). Fix applied: Duke leads, Werle noted with the chapter-conflict caveat.
3. **MEDIUM** — "5 main + 7 beat-only = 12 of 24 tempi" framing conflated Variations (4-per-attitude lattice) with Diagrams (24-cell grid). Fixed in CharacterSheet: "rare accents" section now explains Stable+Penetrating+Flow projects through Adream+Remote outer-actions; ProjectJin (Time-stressed Stable) projects through Near+Awake instead.

Full audit at `research/infinex-character-sheet-source-audit.md`.

### Phase F — CharacterSheet v2 + canonical alignment

Full rewrite of `research/infinex-character-sheet.md`:
- **Character image**: banker-turned-crypto trailblazer (now the lead); Werle/Duke as literary anchors with caveat
- **5 registers with cadence**: Irradiant 45%, Commanding 22%, Sombre 18%, Sociable 10%, Practical 5% — each with motor signature, operator-canonical example lines
- **Beat sequences** per release-card kind (from `defaultBeatsForKind()` in `src/voice/infinex.ts`)
- **Worked example**: full Spot Hyperliquid launch-tier 4-beat post (sourced verbatim from the TS spec)
- **7 beat-only registers** — rare-accents table with feel description + example line each
- **Structural sibling note**: ProjectJin = Stable+Penetrating+Time-stress (where Infinex drift goes); when Infinex slips into urgency it sounds like ProjectJin
- **Glossary**: plain English ↔ Laban term (registers, placement, motors)
- **Chronology note**: character locked AFTER corpus; all backward-looking numbers are baseline observations, not failures
- **Source audit pointer**: links to `research/infinex-character-sheet-source-audit.md`

Also produced `research/infinex-character-sheet-source-audit.md` with per-claim audit trail for external citation defense.

### Phase G — Portable bundle authored

`research/infinex-character-bundle.md` — self-contained system-prompt-ready file (~3500 tokens) for pasting into any external agent. Contains: character image + 3 rules + 5 registers with example lines + 4 beat sequences + off-spec patterns + 3 self-check questions + 2 worked examples.

### Phase H — Closed-loop generator test

**Two-pipeline test on same Trezor card (`cards/trezor-2026-05-19.json`):**

**Bundle + fresh Sonnet subagent (bundle-only context):** 4/10 beat match (40%)
- Sombre openers: 0/2 (classified as Near/Human — relational warmth contamination)
- Commanding: 2/3
- Practical: 0/2
- Irradiant: 2/3

**Production generator (Opus 4.7 + structured TS spec + per-beat user prompt + 280-char constraint):** 11/16 beat match (69%)
- Sombre openers: 4/4 ✓ (all "used to" + structural framing, no warmth contamination)
- Commanding: 4/4 ✓
- Practical: 2/4 (uses "the hard part was" anchor → Practical; lacks anchor → Self-Contained or Sociable)
- Irradiant: 2/4

**Candidate 2 hit 4/4** — proves the spec can produce on-character output across all four beats.

Results + analysis at `research/bundle-vs-production-generator-test.md`.

Saved memory: `verifier-is-gold-standard.md` — always use `scripts/classify-corpus.ts` as the judge, never a fresh subagent.

### Phase I — End-to-end pipeline walkthrough

Walked the hypothetical "Spot Hyperliquid launch" through the full pipeline: fact-grounding → card → multi-channel generation (x, web, deposit modal, withdrawal modal) → validator → orchestrator → ship gate. Confirmed architecture:
- Fact-grounder fires BEFORE the card is built
- Each channel generates independently (different constraints: x=280, web=140, in-product=80)
- Deposit-modal vs withdrawal-modal need SEPARATE cards (different user moments)
- Telegram founder-led bypasses the pipeline by design
- Ship gate is human-approve always

### Phase J — Training harness design decision + Phase 1 scaffold

Key framing established: **the harness is a training instrument, not a long-lived product.** Four approval stages. Every edit captured as structured diff. Agreement metrics accumulate. When ≥80% stage agreement reached → autonomous use permitted. Production surfaces (Slack bot, MCP) are the actual product.

Work-split convention established: **Claude writes spec + scaffold, Claude Code Design styles, Codex implements heavy code.**

Phase 1 scaffold: 23 files, ~1,956 LOC — Next.js 15 App Router skeleton, 4-panel card-detail page, mock data wired, SQLite schema, domain types. `harness/`.

Phase 3 spec: `harness/HANDOFF-SPEC.md` (~21KB) — schema, 3-mode diff capture algorithm, 17 Server Action signatures, agreement metric formulas, stage state machine, streaming requirements, edge cases, sanity checklist.

### Phase K — Design handoff zip

`~/Downloads/comms-factory-harness-design-handoff.zip` (63KB):
- Full harness scaffold
- `_handoff/DESIGN-BRIEF.md` — what's frozen vs open, 6 specific UX challenges, reference inspirations
- `_handoff/CURRENT-STATE.md` — file inventory, first-run expectations
- `_handoff/voice-context/` — CharacterSheet + bundle + BRAND.md + BRIEF.md

### Phase L — Claude Code Design visual pass

Claude Code Design ran the visual treatment pass on `harness/`. Result: TBD (details not reviewed this session). Assumed: components restyled, Tailwind tokens updated, design system applied. The design pass did not change component file names or prop shapes.

### Phase M — Codex Phase 3 implementation

**All 17 Server Actions implemented and wired to the real pipeline.** Database initialized (`harness.db`). Build present (`.next/`). Harness is runnable.

Key facts:
- `lib/db.ts` — real implementation: singleton better-sqlite3, ULID IDs, WAL mode, `writeTx()` helper
- `lib/diff.ts` — Mode A (field-level VerifiedFact/ReleaseCard diffs), Mode B (text diff via `diffWords()`), Mode C (semantic re-classification via `classifyText()`)
- `lib/classifier-wrapper.ts` — wraps `auditBeats` + `classifyTempoBlind` from pipeline validator (deterministic, NOT the full LLM v2 classifier from `scripts/classify-corpus.ts` — that has top-level CLI parsing that makes it hard to import as a module)
- `lib/card-builder.ts` — Sonnet-based ReleaseCard field assembly from approved facts
- `lib/queries.ts` — data access helpers: `listCards()`, `getCardDetail()`, `latestAgreement()`, `listFacts()`, `listCandidates()`, `expectedChannelsForCard()`
- `lib/voice.ts` — voice spec helpers: `voiceSpecFor()`, `defaultBeatsForVoice()`
- `scripts/aggregate-tallies.py` — `ANTHROPIC_API_KEY` sourced from `harness/.env` → `../.env` → `../../.env` fallback chain

**8 open questions from Codex:** `harness/SPEC-QUESTIONS.md`. Key ones:
1. Added `candidate_text_edits` + `candidate_semantic_edits` tables to schema (Mode B/C diff)
3. `abandon_reason` not persisted (schema kept minimal)
6. Clipboard destination includes `text` in response (pragmatic deviation)
7. Mode C uses deterministic classifier (not LLM v2) — deferred because `scripts/classify-corpus.ts` has top-level CLI parsing making it hard to import as a module. **Action required:** extract the classifier into a proper library module for harness + future work

**Two spec items not implemented:**
- Keyboard navigation shortcuts (j/k/a/e/x/r/n in FactsTable)
- Dedicated diff view component (diffs are captured in DB; no viewer yet)

Both are optional for MVP. Operators can use the action buttons; diffs will surface in analytics later.

---

## 2. Files added / modified this session

### New files

```
research/
  laban-viz/                           ← designer's React app (full directory)
    framework.js                       ← + DRIVE constants (DRIVE_COLOR, axisColor, etc.)
    shell3.jsx                         ← + drive spoke coloring, tooltip, driveByTempo
    fingerprint.jsx                    ← + drive-axis row beneath inner-attitude row
    app.jsx                            ← + driveAxisCounts prop, SidePanel drives section, legend, footer
    data/tallies.json                  ← regenerated by aggregate-tallies.py
    screenshots/                       ← designer's mockups (reference only)
  infinex-character-sheet.md           ← v2, source-audited, canonical
  infinex-character-sheet-source-audit.md ← 12-claim audit trail vs Mirodan ch1-4
  infinex-character-bundle.md          ← portable system-prompt-ready bundle
  phantom-vs-infinex-gap.md            ← INTERIM banner added (spec-chronology correction)
  bundle-test-corpus.md                ← Trezor test card beats for classifier
  bundle-test-classifications.json     ← classifier output on bundle-test beats
  bundle-vs-production-generator-test.md ← comparative analysis: 40% vs 69%
  trezor-production-generator.json     ← production generator output on Trezor card

scripts/
  aggregate-tallies.py                 ← deterministic tallies regenerator

cards/
  trezor-2026-05-19.json               ← Trezor launch-tier card for testing

harness/                               ← (full directory — see §0)
  app/
    actions/
      research.ts, card.ts, generate.ts, ship.ts, agreement.ts
  components/
    GenerateControls.tsx, NewCardForm.tsx, ShipPanel.tsx, RecomputeAgreementButton.tsx
  lib/
    diff.ts, card-builder.ts, classifier-wrapper.ts, voice.ts, queries.ts
  SPEC-QUESTIONS.md
  harness.db                           ← initialized SQLite DB
  harness.db-shm, harness.db-wal
  .next/                               ← Next.js build

HANDOVER-2026-05-20-session.md         ← this file
```

### Modified files

```
src/voice/infinex.ts                   ← character image locked (banker-trailblazer), JSDoc + structural_traits updated
research/infinex-character-sheet.md    ← full v2 rewrite
research/laban-viz/framework.js        ← + DRIVE layer
research/laban-viz/shell3.jsx          ← + drive spoke coloring + tooltip
research/laban-viz/fingerprint.jsx     ← + drive-axis row + driveAxisCounts prop
research/laban-viz/app.jsx             ← + driveAxisCounts + SidePanel drives + legend + footer
research/laban-viz/data/tallies.json   ← regenerated (deterministic, drive fields added)
harness/package.json                   ← + @anthropic-ai/sdk, ulid; + pnpm.onlyBuiltDependencies
harness/next.config.js                 ← + outputFileTracingRoot, extensionAlias
harness/lib/db.ts                      ← full implementation (from stub)
harness/lib/schema.sql                 ← + candidate_text_edits, candidate_semantic_edits tables
harness/components/FactsTable.tsx      ← wired to research actions + keyboard affordances
harness/components/CardEditor.tsx      ← wired to card actions
harness/components/CandidateCard.tsx   ← wired to generate + ship actions
harness/components/AgreementSummary.tsx ← real DB query (listAgreement)
harness/app/page.tsx                   ← real DB queries (no mock-data)
harness/app/cards/[id]/page.tsx        ← real DB queries (getCardDetail)
CLAUDE.md                              ← status section updated with harness + new deliverables
HANDOVER-2026-05-18-laban-audit.md     ← §H corrected (spec-chronology reframe); §7 corrected
```

### Auto-memory (saved to `.claude/projects/.../memory/`)

```
infinex-character-lock-postdates-corpus.md   ← spec postdates corpus → forward-looking language only
methodology-voice-audit-spec-precedence.md   ← portable: check chronology before writing prescriptive language
infinex-character-image-banker-trailblazer.md ← locked image + reasoning + literary anchors
mirodan-source-files-location.md             ← canonical chapters at ~/Downloads/nigel-session-2026-04-28/
verifier-is-gold-standard.md                 ← use classify-corpus.ts v2 as judge; never a fresh subagent
auto-open-deliverables.md                    ← open -a "Google Chrome" <path> after writing review-class files
training-harness-not-product.md             ← harness is temporary training instrument; retire when 80% agreement hit
work-split-convention-multi-agent.md         ← three-agent split: Claude spec, Claude Code Design style, Codex implement
```

---

## 3. Work queue — what comes next

### Ready to do now (no blockers)

**Priority 1 — Test the harness with a real card:**
```bash
cd harness && pnpm install && pnpm dev  # http://localhost:3210
# Run:
# 1. Create a card (brief: "Spot Hyperliquid is now live")
# 2. Run the grounder (will take 10-30s, no streaming yet)
# 3. Review + approve facts
# 4. Build the card
# 5. Run generator for x + web + in-product channels
# 6. Approve/edit/reject candidates
# 7. Ship
# Verify: harness.db gains rows; agreement_snapshots compute after
```
This is the integration test for all of Phase 3. First real card through the system. Expect to find bugs — the spec anticipates this; that's what Phase 4 (integration + bug fixes) is for.

**Priority 2 — Harness Phase 4 (finishing touches):**
- Keyboard navigation in FactsTable (j/k/a/e/x/r/n) — the `useEffect` skeleton is in place; needs onKeyDown handler and `selected` row state
- Diff view component — show before/after fact value edits + candidate text diffs inline; the DB has the data, just needs a viewer
- Extract classifier into proper module (`lib/classifier-wrapper.ts` uses the deterministic validator, not the full LLM v2 — unblock by pulling classifier logic out of `scripts/classify-corpus.ts` into a separate importable module)

**Priority 3 — Build the Slack bot (fast lane):**

The harness is the deep-review surface. The Slack bot is the fast lane. Architecture:
- Slack app with slash command `/copy` or `@infinex-copy generate <description>`
- Cloudflare Worker or simple Node.js webhook server
- Backend: calls `generate()` from `src/generator.ts` with the card + voice spec
- Posts 1-3 candidates back to Slack with beat-audit chips visible
- Human approves → posts to the actual surface
- Bottleneck: needs a Slack app registration (OAuth, incoming webhook) and hosting. ~1 day to MVP.

**Priority 4 — Refresh `phantom-vs-infinex-gap.md` with v2 data:**

Currently marked INTERIM. Structural findings hold but percentages need updating from corrected taxonomy data. Still needs:
- Phantom diagnostic verdict (3 competing reads: multi-voice / single-Adream-D / multi-placement-casting-director)
- Reframe from the "fidelity gap" language to spec-chronology-correct language
- Final structural note about Infinex's response strategy (match Phantom multi-cast vs hold single-voice)

**Priority 5 — CharacterSheet for Cream + ProjectJin:**

Both only have TS specs (`src/voice/cream.ts`, `src/voice/projectjin.ts`). No colleague-facing markdown equivalent of the Infinex CharacterSheet. Low-stakes but useful for the multi-brand pitch.

### Longer-term threads

**MCP server:** Expose `generate`, `validate`, `audit` as tools. The character spec becomes the system prompt; tools are the interface. Agents from other systems can invoke the pipeline without knowing Infinex's voice. This is PRODUCT-MAP Tier 5.

**Agree-to-autonomous transition:** Once the harness runs real cards and agreement metrics accumulate, the operator can decide which stages to let run autonomously (probably research + generate first, card + ship remain human-gated forever).

**Finalize the Phantom thesis:** The 3-shell viz + 860 samples are in place. Just needs synthesis writing. Multi-placement-with-Vision-destination seems the most honest read. Worth a dedicated session.

**The Mirodan vs Jung essay:** PRODUCT-MAP Tier 1 identified this as a Stripe-tier explainer. The research materials are in place. Just needs writing. ~1500-2500 words.

---

## 4. Key files for the next session

### The harness (primary)
- **`harness/`** — the runnable app; `cd harness && pnpm dev` → `http://localhost:3210`
- **`harness/HANDOFF-SPEC.md`** — the full implementation contract (don't re-derive)
- **`harness/SPEC-QUESTIONS.md`** — 8 Codex questions + resolution (don't re-ask)
- **`harness/lib/queries.ts`** — the data access layer; read before adding DB queries
- **`harness/app/actions/`** — all 5 Server Action files; read before modifying any stage flow

### The voice spec (secondary)
- **`src/voice/infinex.ts`** (2026-05-15, modified) — current source of truth for Infinex voice
- **`research/infinex-character-sheet.md`** — colleague-facing v2; share this, not the TS spec
- **`research/infinex-character-bundle.md`** — portable for external agents

### Analysis + viz
- **`research/laban-viz/`** → `http://localhost:8765/3-shell%20Laban%20viz.html` (server must be running)
- **`research/bundle-vs-production-generator-test.md`** — the closed-loop test findings
- **`research/phantom-vs-infinex-gap.md`** — INTERIM; needs refresh before publishing

### Canonical framework
- **`skills/laban-voice-for-ai-agents/references/drive-mapping.md`** — 24-cell table, page-cited
- **`~/Downloads/nigel-session-2026-04-28/mirodan-ch{1-4}-*.md`** — canonical source chapters
- **`src/voice/cream.ts`** + **`src/voice/projectjin.ts`** — the other two locked voice specs

---

## 5. Don't-repeat traps

1. **The spec postdates the corpus.** All 380 Infinex samples were produced BEFORE any voice spec existed. "The team is drifting" is wrong; "here's the baseline before the lock" is right. Memory: `infinex-character-lock-postdates-corpus.md`.

2. **The locked character image is "banker-turned-crypto trailblazer."** Not "wise-old-guard," not "shipwright," not "cartographer." `src/voice/infinex.ts:structural_traits[0]` has the definitive version. Memory: `infinex-character-image-banker-trailblazer.md`.

3. **Mirodan vol 1 chapters ARE on disk.** At `~/Downloads/nigel-session-2026-04-28/mirodan-ch{1,2,3,4}-*.md`. Don't search for them as if they don't exist. Memory: `mirodan-source-files-location.md`.

4. **The classifier is the gold-standard judge.** Use `scripts/classify-corpus.ts` v2 (all 6 inner attitudes, all 24 tempi, all 4 aspects, 3 stresses, full drive derivation). Never use a fresh LLM subagent as a substitute judge. Memory: `verifier-is-gold-standard.md`.

5. **Mode C semantic diff uses the deterministic classifier, NOT the LLM v2.** `lib/classifier-wrapper.ts` wraps `auditBeats` from `src/validator.ts`. This is a known limitation from `SPEC-QUESTIONS.md #7`. The LLM v2 would be more accurate but `scripts/classify-corpus.ts` has top-level CLI parsing that makes it non-importable. Future work to extract it.

6. **The 3-shell viz serves over HTTP, not file://.** `python3 -m http.server 8765 --directory research/laban-viz/` from the comms-factory root. Without the server, CORS blocks all XHR and the page is blank.

7. **When running the harness, source the ANTHROPIC_API_KEY from Nigel's .env.** Pattern: `grep "^ANTHROPIC_API_KEY=" ~/Sites/infinex-xyz/agents/nigel/.env | head -1 > harness/.env`. The harness `.env` is gitignored. 

8. **Laban not Larvin.** Memory: `laban-not-larvin.md`. Operator called this out on 2026-05-12; it recurs in voice transcription.

9. **Laban vocabulary only.** No synthesis labels like "Institutional weight" or "Aspirational reach." Use actual Mirodan terms or the operator-canonical plain-English translations in the glossary. Memory: `laban-vocabulary-only.md`.

10. **Open Chrome, not system default.** All review-class files open with `open -a "Google Chrome" <path>`. Memory: `auto-open-deliverables.md`.

---

## 6. Strategic threads being held

### Training harness as the transition gate
The harness IS the bridge from "we built the pipeline" to "the pipeline runs autonomously." No autonomous use is permitted for any stage until it hits the agreement threshold. The harness is the mechanism for proving readiness. Current state: 0 real cards processed, 0 agreement data points. The first real card is the unlock.

### Slack bot is the next product surface
The harness is for the operator. The Slack bot is for the team. Same backend; different UX contract. The Slack bot gets 1-3 candidates with beat-audit chips in a thread; human approves; copy lands on the surface. No stage-by-stage visibility — if the pipeline is trusted enough, skip the harness entirely.

### ProductJin-as-Stable-B structural insight
ProjectJin = Stable + Penetrating + Time-stress. That's exactly where Infinex's pre-lock corpus drifts. When Infinex slips into urgency, it literally sounds like ProjectJin. The two characters are structural siblings — same inner attitude + aspect, different stress. This is the strongest argument for time-pressure language being off-spec for Infinex: it's not just "wrong," it's "it sounds like a different agent in our brand family."

### Multi-brand character map
Infinex (Stable-D, Spell→Vision), Cream (Near-Circumscribing-Flow, Doing+Passion), ProjectJin (Stable-B, Doing→Vision), Nigel (Stable-Enclosing-Flow). All locked in TS; none have colleague-facing CharacterSheets except Infinex. A multi-brand character-family doc would be useful for the Laban-as-product pitch.

### The Phantom diagnostic verdict
Three competing reads of Phantom's corpus: multi-voice (4 people), single-Adream-D (ghost character), multi-placement-casting-director (intentional surface-by-surface casting toward Vision). The v2 data most cleanly supports option 3. This verdict shapes whether Infinex should match (multi-cast) or counter (hold single-voice). Still unresolved.

---

## 7. How to pick up cold

If you're a Claude session reading this fresh:

1. **Read this doc top-to-bottom** (15 min). Now you know the current state.
2. **`cat ~/.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/MEMORY.md`** — auto-memory index. Check the 8 new entries at the bottom.
3. **`ls -lt harness/app/actions/ harness/lib/`** — confirms what's actually in the harness.
4. **`cd harness && pnpm dev`** — boots on `http://localhost:3210`. If it fails, check `ANTHROPIC_API_KEY` in `harness/.env`.
5. **`python3 -m http.server 8765 --directory research/laban-viz/ &`** — boots the viz on `http://localhost:8765/3-shell%20Laban%20viz.html`.
6. Decide which of §3's work-queue items to tackle.

Most likely next session: run a real card through the harness and find the first real bugs. After that: Slack bot.

---

## 8. Acknowledgements / debts

**What went well:**
- Wave-based parallel agent dispatch — corpus harvest, Explore reads, Mirodan chapter audits all ran in parallel without burning main context
- Three-agent work split (Claude spec + Claude Code Design + Codex) worked cleanly; each agent had a well-defined lane; handover artifacts (HANDOFF-SPEC.md, design brief, zip) transmitted well
- Mid-session memory writes caught every significant learning before it could get lost
- Closed-loop test methodology (bundle vs production generator, same card, same classifier, comparable outputs) is reusable for any pipeline refinement

**What I didn't do well:**
- Initially said Mirodan vol 1 chapters weren't on disk — they were. Wasted a verification step.
- First CharacterSheet draft used wrong chronological framing ("the team is failing to honour the spec") — caught and corrected, but should have checked chronology first.
- First "gravity/awe/warmth" labels were invented synthesis; the operator's spec had different operator-canonical labels. Should have read the TS spec before inventing labels.
- The HANDOVER-2026-05-18's §H also had the wrong chronological framing — needed a separate correction pass.

---

End of handover. Pick up when ready.
