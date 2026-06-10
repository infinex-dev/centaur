# Pre-mortem: non-canon contamination across the pipeline
**Date:** 2026-05-28
**Method:** 7 parallel Explore agents audited the Actor/Director, Generator, Validator (heuristic + LLM), CharacterSpec layer, Orchestrator + copy-rewrite, Card schema + scene inputs, and the Laban-voice skill.
**Lens:** find places where operator-prose / brand-vibes / non-Mirodan terminology is mixed with framework canon. Legitimate non-canon inputs are limited to: brand SUPER-OBJECTIVE, per-card scene fields (through_action / lining / obstacle / deployed_facts / reader_prior), brand-specific `structural_traits` + `off_spec_regexes`, brand-AGNOSTIC slop heuristics at the validator layer. Everything else in the Laban-framework layer must be canon.

---

## Executive summary

The voice spec is now Laban-pure (this session's refactor). The **consumer layer around it is not.** Three patterns emerged:

1. **The schema-docstring + defaults trap (P0).** `card.ts:48, 61-62` still uses "bank wall dissolved" as the canonical `through_action` / `lining` docstring example. `infinex.ts:303` actively injects "the wall we are taking down" into every launch-tier beat sequence via `defaultBeatsForKind`. Test fixtures (`actor-director.test.ts:28,32`, `generator.test.ts:261-262`) hardcode the same wall metaphor as templates. This is where the Bridge.xyz contamination originated — and the voice-spec refactor didn't touch any of it. Will keep contaminating every new card.

2. **Operator paraphrase of canon in framework prompts (P0).** `validator-llm.ts:169` defines `passion` as "urgency/time-pressure/hype/FOMO" and `vision` as "future-pull, agentic-becoming". `copy-rewrite-llm.ts:307` glosses Passion as "hype theatre / scarcity / time-pressure". `generator.ts:592` demands the writer not "make Passion the visible/extravert projection" — inverting Mirodan canon §7.3 (drives are READ, not performed; lining stays hidden). These prompts go to the LLM judge / Actor and get treated as canonical truth.

3. **"Stage A / Stage B" naming visible in LLM-facing prompts (P0).** `generator.ts:1184, 1218, 1379` send "Stage A" and "Stage B" pipeline-stage names directly into the Actor's system prompt. Operator banned this terminology per [[feedback-pipeline-vocabulary]] (2026-05-25) — but only in chat; the prompts themselves still leak it.

There's also a fourth-tier contamination layer: brand-vocab on `nigel.ts`, `cream.ts`, `nick-b.ts`, `nick-d.ts`, `projectjin.ts` is still in place. Each `feel` field on each of their tempi is operator-prose that flows into the validator-LLM and generator prompts whenever those voices are used. The Infinex refactor cleaned its tempi but left the consumer code reading `feel` as a fallback — which keeps the contamination live for the other brands.

**Verdict:** roughly 30 contamination points across 8 files + the skill. ~10 are P0 (will surface within a week). ~12 are P1 (2-3 weeks). ~8 are cosmetic. The architecture is correct; the consumer-layer prose has drifted.

---

## P0 — must fix before the next live run

### P0.1 — `card.ts:48` + `:61-62`: schema docstring examples are Bridge-load-bearing

```
Line 48:  Example: "to reveal that the bank wall just dissolved inside one account".
Lines 61-62:  Example: "on the surface: a new fiat deposit rail. underneath: the
              bank-vs-wallet wall just stopped existing for Infinex users."
```

The Bridge card's actual `through_action` is a verbatim copy of the schema docstring example at line 48. Whoever authored the Bridge card pasted the docstring. The voice-spec refactor didn't touch this. **Fix:** rewrite both examples to use a generic, non-brand-load-bearing image. Suggested replacements:
- through_action example: `"to reveal that a necessary intermediate step just evaporated"` (abstract, applies to any bridge / swap / onramp narrative)
- lining example: `"on the surface: a feature ships. underneath: the precondition for self-service is now met."`

### P0.2 — `infinex.ts:303`: `defaultBeatsForKind` actively injects brand metaphor

```ts
case "launch-tier":
  return [
    { tempo: "sombre", hint: "set up the wall we are taking down — Pressing prep" },
    { tempo: "commanding", hint: "land the fact — Punching release, fed by Sombre prep" },
    { tempo: "practical", hint: "justify the build decision — Wringing/Slashing" },
    { tempo: "irradiant", hint: "future-tense lift — Floating/Flicking" },
  ];
```

The `hint` strings are injected into the generator's prompt for every launch-tier card without explicit beats. "Set up the wall we are taking down" reintroduces the wall metaphor even after a Laban-pure tempi rewrite. **Fix:** strip brand metaphors. Suggested:
- sombre: `"open with the structural opposition — Pressing prep"`
- commanding: `"land the fact — Punching release, fed by Sombre prep"` *(clean already)*
- practical: `"work through the tradeoff — Wringing/Slashing"`
- irradiant: `"future-tense lift — Floating/Flicking"` *(clean already)*

### P0.3 — `actor-director.ts:429`: hardcoded brand name in framework prompt

```ts
"page_2_character_rehearsal": "how the Infinex character stands in this circumstance"
```

Brand-specific prompt text in shared Actor framework layer. Should be `"how the character stands in this circumstance"` — the character identity is wired via the voice spec parameter, not via hardcoded prompt prose.

### P0.4 — `validator-llm.ts:169`: operator-paraphrase definitions of canonical drives

```ts
"Which Mirodan drive does the prose actually carry? `doing` = direct action/getting-things-done.
 `spell` = timeless craft, slow charm. `passion` = urgency/time-pressure/hype/FOMO.
 `vision` = future-pull, agentic-becoming."
```

- `"agentic-becoming"` is Infinex-specific (crypto-agent context) → bleeds into validation of any non-Infinex brand
- `"urgency/time-pressure/hype/FOMO"` are surface symptoms of Passion-as-extravert in Infinex, not the canonical Mirodan definition (Mirodan ch3 p.534-535: Passion = "constant change" + "I've lost my head" + emotion overriding thinking)

The LLM judge reads these as canon. Validator over-penalizes Vision-flavored future-focused copy in other brands and under-penalizes non-urgency-flavored Passion. **Fix:** reference `canonical_shorthand` for tempo + use pure Mirodan canon for drives, not editorial paraphrases. Suggested:
```ts
"`passion` = Time-stressed surface (urgency vocabulary is the most common Infinex symptom but not the definition).
 `vision` = future-pull / forward-leaning intention.
 See voice.tempi[tempoName].canonical_shorthand for tempo-specific grounding."
```

### P0.5 — `generator.ts:1184, 1218, 1379`: "Stage A / Stage B" in Actor-facing prompts

Three instances of pipeline-stage names leaking into LLM prompts:

```ts
// Line 1184
"...Stage B will see... Stage B respects what you write here verbatim — if you're vague, the regression returns."

// Line 1218
"Plan only. DO NOT write the draft text. Stage B will execute your plan."

// Line 1379
"## Committed inner work (from Stage A — execute, do not re-litigate)"
```

Operator banned "Stage A / Stage B" framing in [[feedback-pipeline-vocabulary]] 2026-05-25. The ban applied to chat but not prompts. The LLM Actor reads "Stage B" as canonical pipeline vocabulary and starts using it back. **Fix:** swap to theatrical language. Suggested:
- "Stage A" → "table work" / "inner-work step"
- "Stage B" → "the drafting step" / "the actor"

### P0.6 — `generator.ts:592`: Drive performance demand inverts Mirodan canon

```ts
"Passion may exist as hidden lining. It fails when time-pressure, scarcity, or hype makes
 Passion the visible/extravert projection instead of Vision."
```

This frames Drive as something the writer controls. Mirodan ch3 p.529-530 is explicit: Externalized Drives are used to *identify* the Inner Attitude — they are read by the audience from the result, not consciously performed. The writer plays a verb under inner work; the audience reads the drive afterward. The rule conflates Infinex-brand off-spec rules with Mirodan canon. **Fix:** reframe as observation, not performance:
```ts
"Passion is present as hidden lining in Diagram D. Off-spec language surfaces Passion-inflected urgency
 (time-pressure, FOMO, scarcity-of-attention). Avoid urgency framings; the banker-trailblazer is settled."
```

### P0.7 — `generator.ts:617`: "performing the wrong character"

```ts
"3. Would this still feel right with no exclamation marks, no rocket, no 'thrilled to'?
    If not, the sentence is performing the wrong character."
```

"Performing the wrong character" is operator coinage. The writer doesn't "perform" character — the character emerges from the verb under inner work. **Fix:** reframe as character-mismatch observation:
```ts
"If the sentence requires exclamation marks, rockets, or 'thrilled to' to read as Infinex, rewrite.
 The locked placement is Stable+Penetrating — settled, direct, decisions already taken."
```

### P0.8 — `generator.ts:1403`: instructional prompt example reuses dissolved-wall metaphor

```ts
"...Refusal is the point — naming the dissolved-wall thesis WITHOUT touching the not_the_point framings is the discipline."
```

Brand metaphor as the example for what good drafting looks like. **Fix:** generic equivalent:
```ts
"naming the core transformation WITHOUT touching the not_the_point framings is the discipline."
```

### P0.9 — `copy-rewrite-llm.ts:129-132`: hardcoded Infinex tagline in brand-agnostic tool

```ts
"If the shipped text says \"Change the way you crypto.\", your intent must NOT contain
 \"change\", \"way\", or \"crypto\". It must describe the JOB (e.g. \"Tell a first-time
 visitor what Infinex is in a single decisive line...\")."
```

`copy-rewrite-llm.ts` is supposed to be brand-agnostic (it processes Cream, ProjectJin, etc.). Hardcoding Infinex's tagline + brand name in the intent-extraction example violates portability. **Fix:** swap to a generic example with no brand or product mention.

### P0.10 — `skills/laban-voice-for-ai-agents/SKILL.md:317-318` + `examples/infinex-voice-spec.md:26,28`: "Adream outer" mislabel

The skill teaches `Adream outer` for Irradiant and Sombre. Per the 24-tempi audit §3B, **Adream is an Inner Attitude (baseline-eligible)**, not outer-only. Only Mobile / Remote / Awake are outer-only Action Attitudes. The skill is teaching the wrong taxonomy — and the audit already corrected this in `research/24-tempi-audit-2026-05-27.md` but the skill never got the update. **Fix:** strip "outer" from Sombre / Irradiant / Diffused / Overpowering rows. Keep "outer" on Sociable / Egocentric / Altruistic / Unsociable (those ARE outer-only Remote).

### P0.11 — `skills/laban-voice-for-ai-agents/references/literary-refs-glossary.md:110`: Stanley Kowalski filed under wrong attitude

Stanley Kowalski is listed in the `## Near baseline` section but the placement text says `Adream Time-stressed Enclosing per Mirodan §3.2, Diagram C — Passion-Doing`. Stanley is canonical Adream (Mirodan vol 2 p. 573), not Near. **Fix:** move the entire entry to the `## Adream baseline` section.

---

## P1 — will surface in 2-3 weeks of live runs

### P1.1 — `validator-llm.ts:431`: Infinex-specific example in "off-spec drive surfaces" block

```ts
"Passion surfaces through urgency framing, time-pressure, FOMO, hype theatre, scarcity-of-attention."
```

`scarcity-of-attention` is Infinex-specific framework (crypto markets obsess over attention). When this validator runs on a non-Infinex brand, it'll keep checking for "scarcity-of-attention" as a generic Passion marker. **Fix:** scope example to the active voice ("e.g. for Infinex's banker-trailblazer, Passion surfaces through ...") or remove the example list entirely and reference `voice.off_spec_drives + voice.off_spec_regexes` directly.

### P1.2 — `infinex.ts:206-221`: off-spec regex `reason:` claims Mirodan citation

Each off-spec regex has a `reason:` field like `"time-pressure phrase surfaces Passion as visible projection — off-spec for Infinex's Spell→Vision axis"`. The regexes themselves are correct (these patterns ARE off-character for Infinex) but the `reason:` strings dress up brand rules as Mirodan canon. Per the Mirodan audit, this is "Mirodan-vocab dress-up of a brand rule." **Fix:** reframe `reason:` as brand-objective, not framework: `"Off-spec for Infinex's banker-trailblazer tone. Urgency vocabulary triggers the inverse character (Doing-as-pitch)."`

### P1.3 — `validator.ts:169-171`: visual-slop comment mixes layers

```ts
// Visual-design slop genus. ... We reject these in copy because they signal a
// visual register that fights the Spell-Vision drive (Stable + Flow + Penetrating).
```

A brand-AGNOSTIC slop rule (morphism / purple-gradient / futuristic-UI vocab) is justified via Spell-Vision drive coherence — which is Infinex-specific. The regex is right, the comment muddies the layer separation. **Fix:** reframe as "2024-era AI-design vocabulary, generic slop signal, brand-agnostic."

### P1.4 — `voice/projectjin.ts:131` + `voice/cream.ts:286`: `feel` fields leak operator metaphors

- projectjin: `"The institutional drop."`
- cream: `"...manifesto register, used rarely (risks reading manifesto-y)."`

Both are operator coinage. `feel` fields get pulled into validator-LLM and generator prompts, so this contamination is live whenever these voices run. **Fix:** either (a) strip the operator metaphors and replace with motor-grounded descriptions, or (b) wait for the broader brand-vocab migration and strip the field entirely.

### P1.5 — Test fixtures hardcode the wall metaphor

- `src/__tests__/actor-director.test.ts:28,32` — `through_action: "to reveal that the bank wall moved off the user"`, `lining: "surface: a deposit route. underneath: responsibility moved into the account."`
- `src/__tests__/generator.test.ts:261-262` — `through_action: "to dissolve the wall"`, `obstacle: "users read 'bridge' as plumbing"`
- `src/__tests__/generator.test.ts:299` — `expect(captureObj.drafting?.user).toContain("Bridge dissolves the wall.");`

These are fixtures, not docstrings, but they serve as templates when developers learn to author cards. They also embed the wall metaphor as an expected-passing string in test assertions, which couples the system's "working" state to the contaminated phrasing. **Fix:** rewrite fixtures with generic abstract values.

### P1.6 — `generator.ts:584`: Lining inversion in V2 prompt

```ts
"The Lining is the thing the post is refusing to perform."
```

Mirodan §7 says the Lining leaks involuntarily — never something the actor consciously refuses to perform. The phrasing inverts agency. **Fix:**
```ts
"The Lining is the hidden Inner Action the Outer surface carries underneath — it leaks involuntarily, never explicitly named."
```

### P1.7 — `generator.ts:688`: drive slot names use psychology language

```ts
"Each cell yields: drive_primary (resting Inner), drive_secondary (formative Outer),
 drive_introvert (hidden lining), drive_extravert (visible projection)."
```

Mirodan ch3 p.556-557 names the four X-diagram slots as Inner Character / Outer Character / Inner Action / Outer Action. The code uses introvert/extravert — psychological vocabulary Mirodan doesn't use. **Fix:** add the canonical labels as the primary reference, with introvert/extravert as a parenthetical gloss. Or rename the type fields outright (bigger lift).

### P1.8 — `generator.ts:691`: Sombre labeled as "Adream-outer" in MIRODAN_KERNEL

```ts
"11. ... Sombre (Adream-outer · Strong/Bound · Pressing→Punching bound), ..."
```

Same mislabel as the skill (P0.10). Sombre is Adream baseline, not Adream-outer. **Fix:** strip "outer".

### P1.9 — `generator.ts:687`: "Subconscious Motif" operator coinage in MIRODAN_KERNEL

```ts
"Tempo is PERCEIVED by the audience — DERIVED from the actor's Deciding (the verb being played)
 under the Subconscious Motif (Inner Attitude + Aspect + Stress + Lining)."
```

"Subconscious Motif" is operator synthesis from research notes — not Mirodan's named concept. The substance (the four components) is correct; the wrapper term is invented. **Fix:** drop the named-term wrapper:
```ts
"Tempo is PERCEIVED — DERIVED from how the verb is played under the actor's committed inner work
 (Inner Attitude + Aspect + Stress + Lining)."
```

### P1.10 — `validator-llm.ts:408-423`, 366-371: "off-rotation register" / "locked rotation" framing

"Rotation" is operator design vocabulary (which 5-of-24 tempi this brand uses), not Mirodan. The LLM treats "rotation" as a canon concept when it's a per-brand placement decision. Logic is right; framing is muddy. **Fix:** clarify that "rotation" is brand-placement-derived: `"reads as a tempo outside the character's current approved palette"`.

### P1.11 — `skills/.../working-actions.md:46-49, 67`: motor arrow notation wrong for 5 rows

Per 24-tempi audit §3A, strict prep→release ordering (`->`) is canonical ONLY for the 4 classic Sus→Q pairs. Materialistic / Human / Warm / Cool / Uncertain are co-existence rows (same Time pole, no prep order). The skill uses `->` for all. **Fix:** swap to `/` notation for the 5 co-exist rows.

### P1.12 — `skills/.../drive-mapping.md:65`: Fortinbras "(Adream outer)" parenthetical

Fortinbras is Stable Diagram C with an Adream-flavored outer; the parenthetical "(Adream outer)" is confusing because it cites him as an Adream exemplar when he's a Stable exemplar with Adream outer projection. **Fix:** clarify: `Fortinbras (Stable, with Adream outer projection)`.

---

## P2 — cosmetic / stylistic (defer)

- `generator.ts:426` — "let it surface as texture" poetic operator phrasing of Mirodan's involuntary leak
- `generator.ts:454-466` — "Sus→Q" abbreviation (use full Sustained→Quick)
- `generator.ts:583` — "Lining is the hidden drive underneath" — loose paraphrase
- `generator.ts:684` — "activates Passion / Spell" — operator coinage for drive emergence
- `SKILL.md:230` — "institutional cover" operator metaphor in Q2 phrasing
- Various `historical_lore` and `super_objective_examples` brand-specific contents in `infinex.ts:273-279` — these ARE brand-objective layer (legitimate), but they're heavily injected into framework prompts. Acceptable per the architectural rule; flag-only.

---

## Brand-vocab still-pending migrations (separate work stream)

- **nigel.ts** — all 11 tempi keep `feel`, `vocab_anchor`, `opening_shapes`, `signoff_moves`, `example_lines`. Now that `canonical_shorthand` is added, Nigel can be migrated incrementally. Until then, every Nigel validator-LLM call ships operator-prose `feel` strings to the LLM judge.
- **cream.ts** (12 tempi) — same shape, DRAFT 2026-05-13
- **nick-b.ts** (5 tempi) — minimal forward-looking spec, brand-vocab present
- **nick-d.ts** (similar to nick-b)
- **projectjin.ts** (12 tempi) — LOCKED 2026-05-12 but missing `character_image`, `super_objective`, `validation_criterion`, `structural_traits`, `drive_table_cell`, `drive_introvert/extravert`. Currently runs with operator-prose `feel` per tempo.

Each of these voices, when used, will inject its `feel` / `vocab_anchor` / `example_lines` content into the validator-LLM and generator prompts (the consumer code's fallback path I left intentionally to avoid breaking them). That's the right migration plumbing — but every brand that hasn't migrated is leaking operator-prose into framework-layer LLM calls when its voice runs.

---

## Architectural patterns

Three patterns the contamination clusters around:

1. **Docstring examples become canonical templates.** Whoever writes a real card / fixture reads the schema docstring to learn the format. If the docstring is brand-load-bearing (P0.1), every downstream card inherits the brand metaphor. Same story for super_objective_examples and beat hints.

2. **Operator paraphrase of canon in consumer code.** The voice spec is now Laban-pure, but `generator.ts`, `validator-llm.ts`, and `copy-rewrite-llm.ts` build their LLM-facing prompts using their own operator-prose definitions of drives, lining, tempo. The voice spec's `canonical_shorthand` is the locked anchor — but the consumer code doesn't USE it as the locked anchor; it uses its own paraphrases. **The Laban-pure refactor stopped one layer short.**

3. **Brand-specific examples baked into framework-shared code.** `copy-rewrite-llm.ts:129` (Infinex tagline), `actor-director.ts:429` (hardcoded "Infinex character"), `validator-llm.ts:431` ("scarcity-of-attention"), `generator.ts:1403` ("dissolved-wall thesis"). Every one of these will fire when the system runs on a non-Infinex brand.

---

## Recommended ordering

**Before next live Infinex run (this week):**
- P0.1 — rewrite `card.ts:48, 61-62` docstring examples (15 min)
- P0.2 — strip "wall we are taking down" from `infinex.ts:303` (5 min)
- P0.3 — un-hardcode "Infinex character" in `actor-director.ts:429` (5 min)
- P0.5 — rename "Stage A / B" in Actor-facing prompt strings, `generator.ts:1184, 1218, 1379` (15 min)
- P0.8 — fix `generator.ts:1403` "dissolved-wall thesis" phrase (2 min)
- P0.10 — strip "Adream outer" from skill files + `generator.ts:691` (15 min)

**Before multi-brand rollout:**
- P0.4 — rewrite validator-LLM drive descriptors per canon (30 min)
- P0.6 — reframe `generator.ts:592` from performance-demand to observation (10 min)
- P0.7 — reframe `generator.ts:617` "performing the wrong character" (5 min)
- P0.9 — generic example in `copy-rewrite-llm.ts:129` (10 min)
- P0.11 — move Stanley Kowalski to Adream section in skill glossary (3 min)
- P1.1-P1.4 — brand-specific examples + reasons leaking framework labeling (30-60 min total)

**Before relying on the Mirodan kernel for new brand work:**
- P1.6-P1.9 — generator.ts MIRODAN_KERNEL cleanup ("Subconscious Motif", Adream-outer label, introvert/extravert labels, "post is refusing to perform") (~1 hour)
- P1.11-P1.12 — skill working-actions.md + drive-mapping.md fixes (~30 min)

**Deferred until brand-by-brand migrations:**
- P1.5 — test fixtures (do alongside whichever production fix changes the relevant test path)
- Brand-vocab migrations for nigel / cream / nick-b / nick-d / projectjin (per-brand decision)

**Cosmetic (whenever):**
- All P2 items

---

## What's NOT contaminated (positive findings)

Worth knowing what survived the audit clean:

- `src/voice/types.ts` — clean after this session's refactor
- `src/voice/laban.ts` — pure framework constants
- `src/voice/infinex.ts` TEMPI const — Laban-pure (all 12 tempi)
- `src/voice/infinex.ts` `MIRODAN_KERNEL` and `MIRODAN_DRIVE_TABLE` — substance is canonical; only cosmetic notation issues
- `src/orchestrator.ts` — clean: no operator-prose in retry logic, channel selection, or candidate ranking
- `src/actor-memory.ts` — Director constitution is clean; correctly hedges "drives are read, not performed"
- `src/actor-director.ts` — Actor warmup modes (`scene_rehearsal`, `daily_pages`, `none`) are canonical Stanislavski; only the single hardcoded "Infinex character" string is contaminated
- Off-spec regexes themselves (not their `reason:` fields) — correctly placed at brand-spec layer
- The em-dash hard-limit, cliche regexes, listicle regexes in `validator.ts` — correctly placed as brand-agnostic slop heuristics
- Card-builder generic examples in `harness/lib/card-builder.ts:38-42` — fiat / ACH / stablecoin are plausibly domain-standard, not contamination
- `INFINEX_VOICE` brand-objective fields (`character_image`, `super_objective`, `structural_traits`, `historical_lore`, `validation_criterion`, `literary_anchors`) — these ARE the brand-objective layer; legitimate per the architectural rule

The architecture is correct. The consumer-layer prose around it is what drifted.
