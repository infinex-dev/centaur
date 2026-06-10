# comms-factory — product map

A groundmap for someone evaluating this work as productisable. The hypothesis: **the framework for specifying AI-agent and brand voice with mechanical, falsifiable character grain doesn't exist outside theatre, and it should.**

This doc has tiered depth. Read tier 0 in 30 seconds; tier 5 in 30 minutes if you want the full picture.

---

## Tier 0 — Front page

Most AI-agent voice work today is one of three things:

- A system prompt ("you are a friendly helpful assistant").
- A vibes-based tone-of-voice document.
- A Jung archetype ("we're the Sage" / "we're the Magician") from the 12 Mark + Pearson brand archetypes.

None of those give you a **mechanically falsifiable spec** an agent's output can be audited against. None of them let you stand up a multi-agent system where the agents are character-distinct (not just topic-distinct). None of them carry off-spec drift detection.

**This repo applies Veronica Mirodan's 1997 PhD synthesis of Laban Movement Analysis — a 70-year-old character-work framework from theatre — to AI-agent and brand voice.** Mirodan gives you:

- 24 placement cells (Inner Attitude × Aspect × Stress → Drive Axis)
- A canonical motor / Working Action vocabulary (Pressing→Punching, etc.)
- Off-spec drives that surface as red-line violations
- Literary anchors per cell (Werle, Hamlet, the Nurse, Aragorn, etc.)

It's the most-developed character-grain framework in existence, and it's been sitting in a 1000-page PhD nobody productized.

We're productizing it. Two live applications already, third in audit, infrastructure reusable across brands.

---

## Tier 1 — The thesis (5 min)

**Why Laban/Mirodan instead of Jung archetypes.**

Jung gives you 12 fuzzy archetypes (Sage, Magician, Rebel, Hero, Lover...) that feel right but resist mechanical implementation. You can't write a regex that catches "off-spec for Magician." You can't audit an agent's output against "Lover" without subjective judgment.

Mirodan gives you a placement that's a tuple of 4 axes — Inner Attitude (6 values), Aspect (4 values), Stress (3 values), Drive (4 base + 6 combos) — with **factor coherence rules** that reject illegal combinations. From any placement you mechanically derive the 4 corners of the X-diagram (Inner Character Drive, Outer Character Drive, Main Inner Action Drive, Main Outer Action Drive). Each Drive has a vocabulary footprint. Off-spec Drives surface as deterministic-regex violations OR as second-model LLM verdicts (the validator agrees the prose carries an off-spec Drive).

**The pipeline shape.**

```
release event → release card → generator → validator → orchestrator → ship gate
                              (Opus)      (Sonnet)    (channel routing)  (human approval)
```

- **Release card** locks `deployed_facts: string[]` so the generator can't hallucinate claims.
- **Generator** is current-text-blind and writes against the locked CharacterSpec.
- **Validator** has two modes: deterministic regex (cheap, fast) + LLM judge (Sonnet, second-model). Hybrid composition: regex first, LLM only if regex passes.
- **Orchestrator** routes to channels.
- **Ship gate** is human-approve. No auto-post.

The same pattern runs Nigel (Polymarket bot, in production) and is being applied to Infinex (this repo).

**Live production reference: Nigel.** A Polymarket trading bot at `~/Sites/infinex-xyz/agents/nigel/` that posts voice-locked commentary to X. Generator, validator, orchestrator wired in Python. The voice subsystem is the operational proof — this isn't theoretical.

**Why this matters for the agent economy.** Single-agent voice is already a problem. Multi-agent systems where 3+ agents speak on behalf of a brand or platform amplify it — without character-grain specification, every agent sounds like the same RLHF-pleasant assistant. With Mirodan placements, agents can be **mechanically distinct** (the financial-advisor agent at Stable+Penetrating; the cultural agent at Near+Circumscribing; the security correspondent at Stable+Penetrating-Doing). Each gets its own locked spec; each gets its own validator running off-spec drift detection.

Today: 1 live agent (Nigel) + 1 brand (Infinex) + 1 audit (Phantom). Tomorrow: voice infrastructure any brand or agent platform commissions.

---

## Tier 2 — The framework in one page

Read `skills/laban-voice-for-ai-agents/SKILL.md` for the full methodology. Compressed below.

**4 Motion Factors** — Weight (Strong/Light) · Time (Sustained/Quick) · Space (Direct/Flexible) · Flow (Bound/Free).

**6 Inner Attitudes** = 2-factor pair combinations. 3 are **baselines** (only these produce embodied characters):

| Inner Attitude | Factor pair | Reads as | Literary anchor |
|---|---|---|---|
| Stable | Weight + Space | intelligent ruler, decisions taken | Werle, Logan Roy, the Duke |
| Near | Weight + Time | body-forward, relational | Big Daddy, Tony Soprano, the Nurse |
| Adream | Weight + Flow | dreamy, yielding | Hamlet, Hedda, Stanley, Ophelia |

3 are **action attitudes** — fire as Outer Action projections under stress, never as baseline:

| Inner Attitude | Factor pair | Reads as |
|---|---|---|
| Awake | Space + Time | alert sensor, strategist |
| Mobile | Time + Flow | scattered, multi-direction |
| Remote | Space + Flow | aristocratic, withdrawn |

**Stress** = the 3rd factor activated. Available stresses are the factors NOT in the inner pair, minus Weight (Weight is never a stress).

| Inner | Available stresses |
|---|---|
| Stable | Time or Flow |
| Near | Space or Flow |
| Adream | Time or Space |

**Aspect** = which factor is LED inside the placement. 4 aspects (Enclosing/Penetrating/Radiating/Circumscribing) constrained by which factors the inner contains.

**Drive** = 3-of-4 factors active. Named by the LATENT (non-firing) factor. The 4 drives:

| Latent factor | Drive | Reads as |
|---|---|---|
| Flow | Doing | action, get-things-done |
| Time | Spell | timeless craft, patient |
| Space | Passion | urgency, FOMO, hype |
| Weight | Vision | future-pull, agentic-becoming |

Each placement (Inner + Aspect + Stress) has a **Main Character-Action Axis** — the diagonal from the resting Inner Character Drive to the projected Main Outer Action Drive (e.g. "Spell→Vision" for Infinex). The full 24-cell table is at `skills/laban-voice-for-ai-agents/references/drive-mapping.md`.

**24 Tempi** = 4 per Inner Attitude, each mapping to a specific Working Action motor pair.

---

## Tier 3 — Case studies (10 min)

### Nigel — live production proof

`~/Sites/infinex-xyz/agents/nigel/` (different repo).

Polymarket trading bot. Voice spec: Stable + Flow-stressed + Bound, Light + Direct, Self-Contained register baseline (Stable-D variant with Bound flow pole). Posts voice-locked commentary on its own trades. Generator (Opus) + validator (Sonnet) loop with intent-consistency guard, three-baseline-rule check, status-grammar check.

Production-pattern files:
- `bot/voice/nigel_voice_generator.py`
- `bot/voice/nigel_voice_validator.py`
- `bot/voice/nigel_voice_llm.py`
- `docs/voice/character-spec-template.md`
- `docs/voice/laban-character-voice-runbook.md`

**This is the only known production application of Mirodan-Laban to AI agents in crypto.** Operational since ~April 2026.

### Infinex — locked spec, pipeline-in-flight

This repo (`comms-factory`). Voice spec: **Stable + Flow-stressed + Penetrating, Spell→Vision** (Mirodan Diagram D — the Werle / Duke shape). Locked in `src/voice/infinex.ts`. See:

- [`CLAUDE.md`](CLAUDE.md) — project rules + pipeline contract (read this first)
- [`src/voice/infinex.ts`](src/voice/infinex.ts) — locked CharacterSpec
- [`src/voice/types.ts`](src/voice/types.ts) — CharacterSpec type contract
- [`src/voice/{cream,projectjin,nigel}.ts`](src/voice/) — three additional brand specs (Cream of the Crop, ProjectJin, Nigel) — proves the spec format generalises

Brand background (locked placement reasoning):
- Memory: [`infinex-drive-spell-not-passion.md`](.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/infinex-drive-spell-not-passion.md)
- Memory: [`infinex-5-tempi-locked.md`](.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/infinex-5-tempi-locked.md)

Pipeline stages built (all in `src/`):
- `card.ts` — release card schema (Zod-validated)
- `generator.ts` — current-text-blind generator with `voice` + `beats` options
- `validator.ts` — deterministic regex layer + `auditTextHybrid` composition
- `validator-llm.ts` — Sonnet second-model judge with structured `detected_drive` emission + `classification_scope` for beat audits
- `copy-rewrite-llm.ts` — intent-stripped 3-subagent loop (extractor → generator → validator) with fact-grounder integration
- `fact-grounder-llm.ts` — Sonnet research agent (9 tools, max-6-turn loop, parallel research) that grounds verifiable claims before generation
- `orchestrator.ts` — channel routing (`orchestrateLLM` async variant)
- `cli.ts` — `generate / validate / tempi / demo / render / ship` commands

### Phantom — audit case study (in progress)

The 9-surface analysis. Methodology:

1. **Corpus harvest** — website, store-adjacent, app screenshots, tweets. 479 samples across 4 surfaces.
2. **Mirror Infinex corpus harvest** — 5 surfaces × 380 samples (marketing, utility, emergency, tweets, blog).
3. **Classify** with the Laban classifier at `scripts/classify-corpus.ts` (v2 rewrite — full taxonomy + factor coherence + rich emission per sample).
4. **Analyze** with `scripts/analyze-laban-coherence.py` + `scripts/render-laban-3shell.py`.

Outputs:
- [`research/phantom-vs-infinex-gap.md`](research/phantom-vs-infinex-gap.md) — synthesis doc (currently INTERIM, pre-corrected-taxonomy)
- [`research/viz-yours-3shell.html`](research/viz-yours-3shell.html) — interactive 3-shell viz (4 aspect nodes + 6 inner attitudes hexagon + 3 stress triangles + 24 tempi outer ring)

Key emerging finding (pending re-classify validation): **Phantom may be one Adream-Diagram-D character (Passion→Vision) with multi-surface Outer Action Attitudes**, not four separate "people" as initially read. The ghost mascot IS an Adream creature. "The money app that'll take you places" reads as Overpowering (Adream Diagram D) — Blanche-or-Lovborg shape.

---

## Tier 4 — The infrastructure (15 min)

What's reusable across brands. Each script is corpus-agnostic.

### Pipeline (src/)

The core comms-factory pipeline. Card-driven, voice-locked, channel-routed, human-gated.

- Generator, validator, orchestrator, fact-grounder — all detailed in tier 3 above.
- Test surface: `src/__tests__/` — 143 passing tests covering the voice-blind generator, the hybrid validator, the intent-strip rewrite loop, the fact-grounder tool loop.

### Classifier (scripts/classify-corpus.ts)

Reusable Laban classifier. Takes a markdown corpus + emits structured per-sample placement classification.

Per-sample emission:
- `tempo_primary` (one of 24 tempi)
- `inner_attitude` (auto-derived from tempo)
- `aspect`, `stress`, `pole` (factor-coherence enforced)
- `drive_primary`, `drive_secondary`, `drive_introvert`, `drive_extravert` (auto-derived from 24-cell table)
- `drive_axis` (e.g. "Spell→Vision")
- `motor_pair` (Working Actions)
- `outer_action_tempi` + `outer_action_inners` (transient outer-action beats)
- `confidence`, `rationale`, `literary_anchor`

Run on any corpus file with markdown ID + Text columns. Cost: ~$0.01-0.10 per surface depending on sample count.

### Analyzer (scripts/analyze-laban-coherence.py)

Reusable cross-surface coherence analysis. Computes per-axis tallies, drive-family share, anchor identification, cross-surface comparison, contrast against a reference spec.

### Visualization (scripts/render-laban-3shell.py)

Reusable structural viz — 3 concentric shells (4 aspect nodes / 6 inner attitudes / 24 tempi) + 3 stress triangles overlay. Mirodan canonical colors. Per surface gets one small-multiple lattice.

Open the output HTML in a browser. No JS framework dependency (inline SVG + minimal CSS).

### Skills

- [`skills/laban-voice-for-ai-agents/`](skills/laban-voice-for-ai-agents/) — the operator-facing skill that converts "we want our brand to sound like X" into a mechanically-validatable spec. Inside-out interview methodology (sample-recognition + backward-derivation) avoids abstract-question vocabulary leakage.
- [`skills/laban-voice-for-ai-agents/references/drive-mapping.md`](skills/laban-voice-for-ai-agents/references/drive-mapping.md) — canonical 24-cell drive table (vol 2 pp. 525-557 page-cited).
- [`skills/laban-voice-for-ai-agents/references/mirodan-master.md`](skills/laban-voice-for-ai-agents/references/mirodan-master.md) — full Mirodan synthesis.

### Brand asset surface

[`public/brand-assets/infinex/`](public/brand-assets/infinex/) — locked Infinex assets (logos, tokens). Renderer-ready.

---

## Tier 5 — The product wedge (the pitch)

**Voice infrastructure for the agent economy.** Three concrete product surfaces:

### Surface 1 — Brand voice consultancy + spec authoring

Brands commission a Laban CharacterSpec via the operator-interview skill (inside-out methodology, sample-recognition). Deliverable: a TypeScript-compatible `CharacterSpec` object + a tone-of-voice document anchored on the placement + an off-spec regex library + a validator-ready prompt for the second-model judge.

Existing format: see [`src/voice/types.ts`](src/voice/types.ts) (CharacterSpec) and [`src/voice/infinex.ts`](src/voice/infinex.ts) (worked example).

### Surface 2 — Brand voice audit (Phantom-style)

For brands with shipped voice surfaces, classify the corpus against Mirodan and produce a gap analysis:

- Are they hitting their (stated or implicit) placement?
- Where do their surfaces diverge from each other? Intentional projection vs incoherent drift?
- Where are they vs adjacent brands?
- What's missing structurally?

Worked example: [`research/phantom-vs-infinex-gap.md`](research/phantom-vs-infinex-gap.md). Reusable methodology, reusable infrastructure.

### Surface 3 — Multi-agent voice infrastructure (the wedge)

Where the work compounds. A brand running multiple AI agents (customer support, marketing, security correspondent, cultural voice) can:

- Spec each agent in a **distinct Laban cell** so they're mechanically character-distinct
- Run **shared validation infrastructure** — one validator per cell, swappable across agents
- Get **off-spec drift detection** — the validator catches when the cultural agent starts sounding like the security agent
- **License or commission** new characters as new agent surfaces emerge

Today's analog products:
- Brand archetypes (Jung) — qualitative, no audit surface
- Tone-of-voice consultancies (Lippincott, Wolff Olins) — opinionated, expensive, not auditable
- Style guides — documentation, no enforcement

Mirodan-grounded infrastructure offers: **mechanical specification + automated validation + auditable drift detection**. None of the analogs have all three.

---

## Demo path — what to run if you have N minutes

**5 min:** open [`research/viz-yours-3shell.html`](research/viz-yours-3shell.html) in a browser. Read [`research/phantom-vs-infinex-gap.md`](research/phantom-vs-infinex-gap.md) (interim banner explains state). Skim [`CLAUDE.md`](CLAUDE.md) for pipeline contract.

**15 min:** above + [`skills/laban-voice-for-ai-agents/SKILL.md`](skills/laban-voice-for-ai-agents/SKILL.md) (methodology) + [`skills/laban-voice-for-ai-agents/references/drive-mapping.md`](skills/laban-voice-for-ai-agents/references/drive-mapping.md) (24-cell table). Now you know how the framework works.

**30 min:** above + skim [`src/voice/infinex.ts`](src/voice/infinex.ts) + [`src/voice/types.ts`](src/voice/types.ts) (locked CharacterSpec format) + [`src/validator-llm.ts`](src/validator-llm.ts) (second-model judge — see the system prompt). Now you know what the spec actually looks like in code.

**60 min:** above + [`src/copy-rewrite-llm.ts`](src/copy-rewrite-llm.ts) (intent-stripped rewrite loop with fact-grounding) + [`src/fact-grounder-llm.ts`](src/fact-grounder-llm.ts) (research agent). Now you know the pipeline end-to-end.

**Try it:**

```bash
# Classify any corpus of brand copy
pnpm tsx scripts/classify-corpus.ts your-corpus.md output.json

# Visualize the placement
python3 scripts/render-laban-3shell.py viz.html "Your brand"=output.json

# Validate a single string against a locked spec
pnpm tsx src/cli.ts validate --validator=hybrid "your string here"

# Generate from a release card
pnpm tsx src/cli.ts generate cards/your-release.json
```

---

## Honest demarcation — what's shipped, what's in-flight, what's pitched

### ✅ Shipped

- Mirodan / Laban canonical reference (24-cell drive table, 6 inner attitudes, 4 aspects, 3 stresses, 4 drives + combos) — `skills/laban-voice-for-ai-agents/references/drive-mapping.md`
- comms-factory pipeline (card → generator → validator → orchestrator → ship gate) — `src/`
- Hybrid validator (deterministic regex + Sonnet second-model judge) — `src/validator.ts` + `src/validator-llm.ts`
- Intent-stripped rewrite loop with fact-grounding — `src/copy-rewrite-llm.ts` + `src/fact-grounder-llm.ts`
- 4 locked brand specs (Infinex, Cream of the Crop, ProjectJin, Nigel) — `src/voice/{infinex,cream,projectjin,nigel}.ts`
- Reusable Laban classifier (v2 with full taxonomy + factor coherence + rich emission) — `scripts/classify-corpus.ts`
- Reusable cross-surface analyzer — `scripts/analyze-laban-coherence.py`
- Reusable 3-shell viz — `scripts/render-laban-3shell.py`
- Operator-facing skill (inside-out interview methodology) — `skills/laban-voice-for-ai-agents/`
- Test suite (~143 passing tests on the pipeline)
- Nigel (live Polymarket bot in production at `~/Sites/infinex-xyz/agents/nigel/`)
- 9-surface Phantom audit (corpora harvested + classified)

### 🟡 In-flight

- Re-classification of all 9 Phantom + Infinex surfaces with the corrected classifier — running 2026-05-18, ~10 min wall clock
- Extended 3-shell viz with motor/pole/drive layers — designed, not built
- Phantom-vs-Infinex gap synthesis update with corrected-taxonomy data
- Remotion compositions for the 4 release card kinds (`data-card-official`, `data-card-wry`, `launch-tier`, `split`) — blocked on brand-factory's Infinex `voiced` status

### ⏳ Pitched but not built

- Multi-agent character licensing (Surface 3 wedge)
- Drift detection product surface (real-time)
- Web app for non-engineer brand teams to commission their own Laban placement
- Marketplace for licensed CharacterSpecs
- Public API for brand-voice classification + audit
- Integration SDK for agent platforms (LangChain, AutoGen, etc.) so agents can be spec'd in Laban cells natively
- Codex / GPT-equivalent character-aware models (the validator currently uses Anthropic; cross-provider would broaden adoption)

---

## Files map

```
comms-factory/
├── PRODUCT-MAP.md                         ← you are here
├── CLAUDE.md                              ← project rules / pipeline contract
├── src/
│   ├── voice/
│   │   ├── types.ts                       ← CharacterSpec type contract
│   │   ├── infinex.ts                     ← Infinex locked CharacterSpec (Stable-D, Spell→Vision)
│   │   ├── cream.ts                       ← Cream of the Crop CharacterSpec
│   │   ├── projectjin.ts                  ← ProjectJin CharacterSpec
│   │   └── nigel.ts                       ← Nigel CharacterSpec
│   ├── card.ts                            ← ReleaseCard schema
│   ├── generator.ts                       ← current-text-blind generator
│   ├── validator.ts                       ← deterministic regex layer + hybrid composition
│   ├── validator-llm.ts                   ← Sonnet second-model judge
│   ├── copy-rewrite-llm.ts                ← intent-stripped 3-subagent loop
│   ├── fact-grounder-llm.ts               ← Sonnet research agent (9 tools, 6 turns max)
│   ├── orchestrator.ts                    ← channel routing
│   ├── cli.ts                             ← generate / validate / tempi / demo / render / ship
│   ├── brand-stub.ts                      ← stub for brand-factory locked tokens
│   ├── fact-grounder/sources/             ← platform-code, partner-registry, infinex-pages, projectjin-research
│   ├── remotion/                          ← Remotion compositions (stub pending brand-factory)
│   └── __tests__/                         ← 143 passing tests
├── skills/
│   └── laban-voice-for-ai-agents/
│       ├── SKILL.md                       ← operator-facing methodology
│       └── references/
│           ├── drive-mapping.md           ← canonical 24-cell drive table
│           ├── mirodan-master.md          ← full Mirodan synthesis
│           ├── working-actions.md         ← 8 Working Action motor vocabulary
│           ├── literary-refs-glossary.md  ← Mirodan character → modern equivalent
│           └── nigel-pattern.md           ← generator/validator architecture
├── scripts/
│   ├── classify-corpus.ts                 ← Laban classifier (v2 — full taxonomy + rich emission)
│   ├── analyze-laban-coherence.py         ← cross-surface analysis
│   ├── render-laban-3shell.py             ← 3-shell structural viz (4 aspect nodes + 6 inner attitudes + 24 tempi)
│   ├── render-laban-radar.py              ← DEPRECATED — percentage radar
│   ├── render-laban-lattice.py            ← DEPRECATED — 6-node hexagon
│   ├── render-laban-cube.py               ← DEPRECATED — Mirodan Effort Cube (caps at 12 tempi)
│   ├── rewrite-homepage-copy.ts           ← shipped-copy audit harness
│   ├── dogfood-existing-copy.ts           ← platform-copy dogfood
│   ├── dogfood-homepage-tempo-fit.ts      ← homepage-copy dogfood
│   └── build-soft-vs-hardened-html.ts     ← soft-vs-hardened HTML diff viewer
├── research/
│   ├── phantom-vs-infinex-gap.md          ← case study synthesis (currently INTERIM)
│   ├── viz-yours-3shell.html              ← 3-shell viz (open in browser)
│   ├── phantom-corpus-{website,tweets,app-adjacent,app,app-adjacent}.md   ← Phantom corpora
│   ├── phantom-classifications-{...}.json ← Phantom classifications
│   ├── infinex-corpus-{marketing,utility,emergency,tweets,blog}.md        ← Infinex corpora
│   ├── infinex-classifications-{...}.json ← Infinex classifications
│   ├── phantom-laban-coherence.md         ← Phantom-only coherence analysis
│   ├── infinex-laban-coherence.md         ← Infinex-only coherence analysis
│   ├── wave-1.5-tweets/                   ← raw tweet feeds for 6 brands (Berachain, HyperliquidX, Phantom, etc.)
│   ├── infinex-dogfood-{triage,audit,handover}.md  ← shipped-copy audit research
│   └── implementation-plan-2026-05-15.md  ← voice pipeline hardening plan (Phase 1-5)
├── config/
│   └── partner-registry.json              ← maintained partner → provider mapping
└── public/
    └── brand-assets/infinex/              ← locked Infinex assets (logos, tokens)
```

---

## Related work (different repos / external)

- **Nigel** (`~/Sites/infinex-xyz/agents/nigel/`) — production Polymarket bot. The live application of the framework. Voice subsystem at `bot/voice/`, runbook at `docs/voice/laban-character-voice-runbook.md`.
- **brand-factory** (`~/Sites/infinex-xyz/brand-factory/`) — upstream brand-spec authoring system. comms-factory consumes its locked outputs (palette, type, motion, voice samples).
- **Mirodan vol 2 PDF** — primary source. `/Users/opaque/Downloads/Mirodan-PhD-1997-Vol2.pdf`. ~1000 pages. Drive theory at pp. 525-557.
- **Master reference markdown** — `~/Downloads/nigel-session-2026-04-28/laban-mirodan-reference-2026-04-28.md`. 1070-line operator synthesis of the Mirodan PDF.

---

## Glossary (terms a non-Laban evaluator might trip on)

- **Inner Attitude** — the character's resting two-factor home (Stable / Near / Adream / Awake / Mobile / Remote).
- **Aspect** — which factor is foregrounded within the placement (Enclosing / Penetrating / Radiating / Circumscribing).
- **Stress** — the activated 3rd factor under which the character projects to Outer Action Attitudes (Time / Space / Flow).
- **Drive** — 3-of-4 motion factors firing. Named by the latent factor (Doing / Spell / Passion / Vision).
- **Action Axis** — the diagonal of the X-diagram from the resting Inner Character Drive to the projected Main Outer Action Drive (e.g. "Spell→Vision"). Names the placement's dominant projection axis.
- **Tempo** — one of 24 named character registers (Commanding / Sombre / Irradiant / Practical / Sociable / Materialistic / Warm / Cool / Receptive / Self-Contained / Overpowering / Diffused / Unacknowledged / Acknowledged / Revealed / Concealed / Egocentric / Altruistic / Unsociable / Acute / Doubting / Certain / Uncertain). Each Inner Attitude has 4 tempi.
- **Working Action** — one of 8 motor verbs (Pressing / Wringing / Gliding / Floating / Punching / Slashing / Dabbing / Flicking). Tempi fire as Sustained→Quick Working Action pairs.
- **CharacterSpec** — the locked TypeScript object that encodes a character placement + tempi rotation + structural traits. See `src/voice/types.ts`.
- **Card** — the unit of work the pipeline consumes. A release card carries the surface, the job, the deployed_facts, the audience channels.
- **Off-spec drive** — vocabulary that activates a Drive not on the locked spec's Action Axis. Caught by deterministic regex + LLM validator.

---

Generated 2026-05-18 from active session state. Update as the work evolves — particularly the In-flight / Pitched sections.
