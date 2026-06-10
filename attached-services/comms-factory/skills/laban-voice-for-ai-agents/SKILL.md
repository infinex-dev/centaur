---
name: laban-voice-for-ai-agents
description: Use this skill when designing, validating, or generating brand-voice content for an AI agent or brand. It encodes Veronica Mirodan's 1997 PhD synthesis of Laban Movement Analysis into a practical 3-move workflow that takes a brand from "we want a voice" to a locked, mechanically-validatable voice spec with a working generator/validator loop. Use when you see the word "Laban", "Mirodan", "voice spec", "tempo", "tone of voice", "Working Action", or when an operator says they want their brand's content to sound a specific way and they need a structured way to get there.
metadata:
  tags: laban, mirodan, voice, brand, character, ai-agent, slop-prevention
---

# Laban-Mirodan voice for AI agents

This skill turns "we want our brand to sound like X" into a mechanically-validatable voice spec that an AI agent can actually generate against. It's the methodology that produced the Infinex voice (Stable + Flow-stressed + Penetrating, Spell-Vision drive, 5 main tempi in beat-sequence architecture) and that grounds Nigel's voice subsystem.

## ⚠ STUPID MISTAKES — never make these

These are the failure modes that wasted hours of operator time. The framework is mechanical; these errors come from skipping the mechanics and reasoning from feel. **Read this before doing anything else.**

### The available-stresses rule

A baseline character's two available stresses are the two Motion Factors **NOT in its Inner pair**. That's it. Memorize this:

```
Stable inner = Weight + Space → available stresses: TIME or FLOW (never Space, never Weight)
Adream inner = Weight + Flow  → available stresses: TIME or SPACE (never Flow, never Weight)
Near   inner = Weight + Time  → available stresses: SPACE or FLOW (never Time, never Weight)
```

**Combinations that DO NOT EXIST and will get you corrected by anyone fluent:**
- ❌ Space-stressed Stable (Stable's inner already has Space)
- ❌ Flow-stressed Adream (Adream's inner already has Flow)
- ❌ Time-stressed Near (Near's inner already has Time)
- ❌ Weight-stressed anything (Weight is in every baseline's inner pair)

If you find yourself about to type one of those, stop and re-check the baseline's inner pair.

### Aspect-vs-Stress confusion (the disallowed-Stress trap)

Operators (and you, running the skill) will repeatedly reach for an *impossible Stress* because the gut-feel they're trying to name is real — they just mis-name the cell. The pull they feel is the **Aspect**, not the Stress.

The mapping is mechanical and exact:

```
"Space-stressed Stable"  → operator actually wants  Penetrating Stable    (the Werle / Duke shape)
"Flow-stressed Adream"   → operator actually wants  Radiating Adream      (the Hamlet / Hedda shape)
"Time-stressed Near"     → operator actually wants  Circumscribing Near   (Tesman / soldier shape)
```

**Why:** each impossible-Stress combo maps to the *non-Enclosing* Aspect of that baseline. Enclosing leans into the baseline's inner pair (Weight-forward, sensuous). The OTHER Aspect (Penetrating / Radiating / Circumscribing) leans toward the *third axis* — same direction the operator was reaching when they tried to make it the Stress. Aspect = within-baseline orientation. Stress = the third axis that produces the Outer Action Attitude. They're felt similarly but they're DIFFERENT cells.

**Rule for the interview:** if the operator's gut answer to "what presses them?" is the disallowed Stress, do not list it as an option. Instead acknowledge the pull and defer to the Aspect question (Q4). Their gut is correctly identifying the Aspect direction; you're just routing it to the right slot.

### Mobile, Remote, Awake are NEVER baselines

They are outer Action Attitudes ONLY. They fire as projections of Stable, Adream, or Near under stress. A character spec with `inner_attitude: "remote"` is invalid. Mirodan §3.4-3.6 is explicit: "There are no genuinely Mobile characters" (and the same for Remote and Awake).

If an operator says "the brand feels Remote / dreamy / detached," they mean an Adream or Stable baseline that projects Remote as outer when Flow-stress fires. Pin the baseline first.

### Laban ≠ Mirodan

Laban Movement Analysis is the underlying framework (4 motion factors, 8 effort actions, etc.). Mirodan's 1997 PhD synthesizes Laban + Yat Malmgren + Carpenter into a working character vocabulary (~70 specialised terms) for theatre. **Mirodan is denser, sharper, and overrides several simpler Laban readings** (top-12 overrides in `references/mirodan-master.md` §1).

Treating them interchangeably will cause you to miss key overrides — especially the three-baseline rule, the Adream split (§4.5), and the Fusion mechanic on Flow only (§1).

### Cadence is per-post; beats are per-paragraph

A post is a beat sequence (~3-4 paragraphs, each in its declared tempo). Cadence is the meta-statistic — what percentage of posts open in which tempo over time. **They are not the same axis.** Operators sometimes give cadence percentages and you assume single-tempo posts. Always check whether posts are multi-beat in this brand's voice.

### Drive determines off-spec language, not vibes

If the operator says "we want timeless, not urgent" → Spell drive locked → Passion-vocabulary is off-spec. The validator regex enforces this mechanically. Don't paper over with "but this one ad needs urgency" — either the spec was wrong (rerun Move 1) or the operator wants two characters (don't).

---

## Recommended flow: inside-out (quotes-first, backward-derive placement)

**This is the DEFAULT flow for any new brand.** The abstract-Q "fast path" below is a fallback for operators already fluent in Mirodan terminology, or for spot-checking a known placement.

**Why inside-out is the default:** abstract questions like "does this character get harder or softer under pressure" require the operator to self-articulate something they may not have language for, AND leak context that biases their answer (validated 2026-05-13 — Cream of the Crop cold test mis-routed via abstract Q2 because the question's framing recycled Q1 vocabulary; samples-first method correctly re-routed it). The operator's gut about voice samples > the operator's articulation of abstract preferences. See `methodology-inside-out-interview` in the user's memory for the cross-domain pattern.

### Step 1 — Character image (Q1, same as fast path)

> "When a reader encounters this brand, who are they talking to? Give a concrete image, not a list of adjectives."

Push for the room they're in, what they're holding, who they're talking to. Adjectives like "warm but confident" should be pushed back on — *what KIND of person* is warm-confident? Examples: *"the watchmaker who's been making the same watch for thirty years"*, *"the curator at the gallery who actually gets internet art"*, *"the newspaper-guy meme historian who's natively rich and collects Pokemon cards"*.

### Step 2 — Scenarios

> "What 3-5 situations does this brand actually need to write content for? Concrete moments — not 'launches' generically but specific instances."

Examples for a meme app:
- A new meme just launched (with a real example name)
- A listed meme went up 10x — opportunity to sell (with a real ticker)
- A trending wave forming (e.g., World Cup memecoins)
- A meme failed dramatically
- A peer / publication called the brand out

Lock a specific concrete instance per scenario (e.g., "$WOJAK-MILK +10x" not "any price move"). This becomes the anchor for the samples in Step 3.

### Step 3 — Generate samples across the framework, per scenario

For each scenario, generate **one sample post per tempo** (24 total per scenario). Each sample uses:
- The character voice from Step 1 as the **consistent anchor** (the voice doesn't drift across samples)
- The motor signature of the tempo as the **varying dimension** (Pressing→Punching for Materialistic, Floating→Gliding for Human, etc. — see `references/working-actions.md`)

Group the 24 samples by Inner Attitude bucket:
- 4 Near tempi (Materialistic, Human, Warm, Cool)
- 4 Stable tempi (Commanding, Receptive, Practical, Self-Contained)
- 4 Adream tempi (Sombre, Irradiant, Overpowering, Diffused)
- 4 Mobile tempi (Unacknowledged, Acknowledged, Revealed, Concealed) — outer of Adream-Time or Near-Flow
- 4 Remote tempi (Egocentric, Altruistic, Sociable, Unsociable) — outer of Adream-Space or Stable-Flow
- 4 Awake tempi (Acute, Doubting, Certain, Uncertain) — outer of Stable-Time or Near-Space

The full 24 is exhausting for the operator. **In practice: start with 12 (4 Near + 4 Stable + 4 Adream) for the first scenario, then expand to the other 12 outer projections only if the operator's picks suggest a non-obvious placement.** This is the Cream of the Crop test pattern (2026-05-13).

### Step 4 — Operator picks per scenario

For each sample, operator marks: **feels-like** / **neutral** / **not-like**. For feels-like picks, weight: **dominant** / **common** / **occasional** / **rare**.

**Escape hatch (write-your-own):** for any motor-direction where the operator says "*none of these BUT I sense there should be something here*", the operator writes a line themselves; the agent backward-classifies the line to a tempo (same mechanism as validator's `auditBeats`), adds it to the rotation with the operator's weight. This doubles as the operator's framework-vocabulary teaching mechanic.

### Step 5 — Agent backward-derives the placement

After Step 4, the agent has a distribution of operator picks across 12-24 tempi per scenario. Apply:

1. **Baseline (Inner Attitude)** — which Inner-Attitude bucket has the most picks? Near tempi vs Stable tempi vs Adream tempi. The home with most picks is the baseline candidate. Validate: the outer projections that ALSO got picks must be the outer projections AVAILABLE to that baseline+stress combo (e.g., Adream + Mobile outers fit only Near-Flow or Adream-Time; Stable + Awake fit only Near-Space or Stable-Time).

2. **Stress** — count picks across outer projections.
   - Near baseline + Stable/Awake outer picks → Space-stress
   - Near baseline + Adream/Mobile outer picks → Flow-stress
   - Stable baseline + Adream/Remote outer picks → Flow-stress
   - Stable baseline + Near/Awake outer picks → Time-stress
   - Adream baseline + Near/Mobile outer picks → Time-stress
   - Adream baseline + Stable/Remote outer picks → Space-stress

3. **Aspect** — within the baseline-home tempi, observe which sub-axis dominates. Strong-Weight tempi (Materialistic, Warm) lean Enclosing for Near; Light-Weight tempi (Human, Cool) lean Circumscribing. Same pattern within Stable (Commanding/Practical = Enclosing-leaning; Receptive/Self-Contained = Penetrating-leaning) and Adream (Sombre/Overpowering = Enclosing; Irradiant/Diffused = Radiating).

4. **Drive sub-axis** — derived mechanically from (Inner + Stress + Aspect) per `references/drive-mapping.md`. The operator doesn't pick the Drive; it falls out.

5. **Rotation** — the feels-like picks ARE the rotation.

6. **Cadence** — weights translate to percentages. Dominant ~35-50%, common ~15-30%, occasional ~5-15%, rare ≤5%.

### Delivery mechanics — how to actually run Steps 3-5

Running Steps 3-5 by hand is painful. Two prebuilt mechanisms make it tractable.

**Sample generation (Step 3) — automated:**

```bash
# Write brand-config.json with brand_name, brand_slug, Q1, scenarios[3], optional model
export ANTHROPIC_API_KEY=...
python3 scripts/gen-samples-and-classifier.py brand-config.json /tmp/<brand-slug>/
```

This produces:
- `<slug>-samples.json` — 72 samples (24 tempi × 3 scenarios) generated by Sonnet
- `<slug>-classifier.html` — clickable UI with all 72 samples, color-coded by Inner Attitude bucket

Sample generation takes ~30-60s via one Sonnet API call. The script lives at `scripts/gen-samples-and-classifier.py` and accepts any brand — same script for opaque, ProjectJin, Nigel, Cream of the Crop, anyone.

**Operator pick (Step 4) — clickable HTML:**

The generated HTML shows all 72 samples grouped by scenario, each labeled with its tempo + motor signature. Operator clicks samples that feel like the brand. Live bucket distribution + backward-derived placement appears at the top (after 5+ picks). State persists to localStorage (refresh-safe). Export-to-JSON button at the top emits picks for the agent to consume.

**Backward derivation (Step 5) — runs live in the HTML.** The HTML's JS does the same baseline / stress / aspect derivation logic spelled out below. Operator sees the placement update as they pick. Final picks export gives the agent the same data — no separate derivation step needed if you trust the in-browser derivation.

**Alternative when the brand has an X account:** if the brand posts publicly, skip Step 3-4 entirely. Scrape the last 100 originals via the X API (see `research/X_API_RECIPE.md` if in comms-factory), auto-classify each post against the 24 tempi via Sonnet, derive placement from the distribution. Same backward-derivation logic, real data instead of generated samples. Use when corpus exists; fallback to sample-recognition when it doesn't.

Methodology references:
- `methodology-inside-out-interview` — why sample-recognition beats abstract Qs
- `methodology-out-of-placement-diagnostic` — sample adjacent cells when picks are ambiguous
- `methodology-cadence-by-observation` — set even cadence initially, calibrate from real output
- `methodology-skill-cold-test` — validate convergence against known-answer brands

### Step 6 — Confirm derived placement with operator

Present: "Based on your picks, the character is **{Baseline} + {Stress}-stressed + {Aspect}**, drive sub-axis **{Drive-axis}**. Available outers: **{Outers}**. Locked rotation: **{tempi with cadence%}**." Operator confirms or pushes back. If they push back on a specific dimension, sample more in that area (Step 3 expansion) and re-derive.

### Why this eliminates Q2/Q3/Q4 leakage

The old fast path (below) asks operators abstract questions about pressure, urgency, and body-vs-mind. Each question's options are described in language that can leak the operator's own Q1 vocabulary, biasing the answer (validated bug #13 from 2026-05-13 Cream of the Crop test). Inside-out: operator never sees framework terms. They just pick samples. The framework mapping happens entirely on the agent side.

---

## Fallback: Abstract-Q fast path (3 questions to placement, for fluent operators)

Use this when the operator is already fluent in Mirodan or when you're spot-checking a known answer. For new brands and novice operators, use the inside-out flow above.

## When to use this skill

- You're starting a brand voice from scratch and want it to be more than vibes
- An operator describes their voice in terms an AI agent can't act on ("warm but not soft, confident but not arrogant, kind of like Karpathy but for crypto")
- You're building a generator/validator loop for branded content and need the validator to have actual rules
- You see the word "Laban", "Mirodan", "tempo", "Working Action", "Inner Attitude", "Stable", "Adream", "Near"
- You're handed an existing voice spec and need to audit whether it's coherent under Mirodan
- You're trying to figure out why some posts from a brand land and others don't — Mirodan's status-grammar and Drive-axis lenses often diagnose this

## What this skill produces

A complete `CharacterSpec` object containing:

1. **Inner Attitude** (Stable, Adream, or Near — only these 3 can baseline)
2. **Stress** (Time, Space, or Flow — restricted to the two stresses available to the chosen baseline)
3. **Aspect** (Enclosing, Penetrating, Circumscribing, or Radiating)
4. **Drive axis** (combination of Doing, Spell, Passion, Vision — locks which language families are off-spec)
5. **Main tempi rotation** (typically 3-5 tempi in regular use; the rest available as rare beats)
6. **Off-spec regex rules** (vocabulary that violates the locked Drive)
7. **Cadence distribution** (approximate % per main tempo)
8. **Beat-sequence templates** (default beat order per release-card kind)
9. **Few-shot example library** (real sample posts per tempo, used as generator priming)

Plus a working generator + validator pair that consumes this spec.

## Fast path — 3 questions to a draft spec

For operators who don't want the long workflow, this is the minimum interview. Answer these three, and the spec writes itself (with one Aspect follow-up):

### Question 1 — WHO is the character?

Give a concrete image, not adjectives. **"Old curmudgeon at the end of the bar."** **"The shipwright building the boat to the new continent."** **"A psychohistorian who plots 1000 years ahead."** **"The taxman."** **"Your sober friend at 2am."**

If the operator gives adjectives ("warm, confident, but not arrogant"), push back: *"what KIND of person is warm-confident-not-arrogant? Give me the room they're in."*

### Question 2 — What presses them?

**Phrase this in operator-native language. The framework terms (Time, Space, Flow) should NEVER appear in the question. The agent translates the operator's answer.**

The question is binary, pre-filtered by Q1's baseline. Use the row matching the baseline:

| If Q1 = | Ask: "When pressure shows up, does this character get..." | Maps to |
|---|---|---|
| **Stable** | "...HARDER (jaw set, ship the thing, no time for sentiment, war-room voice) — or SOFTER (the conviction has a tremor, feeling shows through the institutional cover, late-night truth)?" | harder → **Time-stress** · softer → **Flow-stress** |
| **Adream** | "...BRITTLE (splits / fragments under pressure, can't hold the room) — or CONSOLIDATING (aristocratic-aloof, the mask hardens into intellectual coolness)?" | brittle → **Time-stress** · consolidating → **Space-stress** |
| **Near** | "...SOPHISTICATED (mature, room-reading, position-aware) — or YIELDING (big-daddy emotional, the feeling pours out)?" | sophisticated → **Space-stress** · yielding → **Flow-stress** |

**Do NOT** list the disallowed Stress for the chosen baseline as an option. (Stable doesn't get Space, Adream doesn't get Flow, Near doesn't get Time.) See *Aspect-vs-Stress confusion* above — if the operator's gut answer is the disallowed Stress, route it to Aspect (Q4), not Stress.

### Question 3 — Does the voice carry timeless craft, or does it need urgency theatre?

**Again, operator-native. Don't name Drives in the question.**

> "Does this character need to say things like *'last chance, act now, hurry, limited time, this is going to fly'* to make their case land? Or do they say things like *'this has been coming for years, the rails take time, the future is patient, we built this slowly'*?"

- Needs urgency theatre → **Passion drive is on-spec** (the character has urgency as a native register)
- Timeless craft, patience-as-virtue → **Spell drive is on-spec, Passion is off-spec**

**Drive-axis mechanic (important — the skill underplayed this):** Drives are AXES, not singletons. Every placement has a *primary axis* of two home Drives, plus a *sub-axis extension* determined by Stress + Aspect. For Stable: primary = Doing/Spell. Time-stress extends toward Passion (off Doing). Flow-stress + Penetrating extends toward Vision (off Spell). So "Spell-Vision" = sub-axis label for Flow-stressed Penetrating Stable — meaning *home is Spell, extends toward Vision, never touches Passion*. The reference table is in `references/drive-mapping.md`. Don't think of Drives as a single Drive — think of an axis the character lives on.

### Decision tree to placement

```
Q1 reveals the basic shape:
  - Ships things, decisions taken → Stable baseline
  - Vision-pulled, torn between feeling and grounding → Adream baseline
  - Down-to-earth, sensory, common sense → Near baseline

Q2 (baseline-filtered, operator-native phrasing) narrows the third axis:
  - Stable + harder → Time-stress → outer projects as Near + Awake (brutal "rock-like Stable")
  - Stable + softer → Flow-stress → outer projects as Adream + Remote (softer, yielding)
  - Adream + brittle → Time-stress → outer fragments to Near + Mobile (Adream split)
  - Adream + consolidating → Space-stress → outer consolidates to Stable + Remote (aristocratic aloofness)
  - Near + sophisticated → Space-stress → outer projects as Stable + Awake (intellectualized)
  - Near + yielding → Flow-stress → outer projects as Adream + Mobile (Big Daddy energy)

Q3 locks the Drive sub-axis (Drives are AXES, not singletons):
  - Time-stress always extends home toward Passion
  - Flow-stress on Stable + Penetrating → Spell-Vision sub-axis on Doing/Spell home (Diagram D); Passion is hidden lining, not visible projection
  - Flow-stress on Stable + Enclosing → Spell-Passion sub-axis on Doing/Spell home; Vision is hidden lining
  - Space-stress on Adream Radiating → Spell-Vision sub-axis but mixes in Passion (Diagram B)
  - Adream + Enclosing variants → Spell-Doing sub-axis
  - Near is always Doing-Passion (Spell-only Near doesn't exist)

If Q3 = "no urgency" but Q1 said "Near baseline" → contradiction. Surface to operator:
  "Near is structurally Doing+Passion-driven. If you don't want Passion, the
  character isn't Near. Re-pick Q1."
```

### Follow-up: Aspect (1 more question after the 3)

Once baseline + stress are locked, ask the **Aspect question** with the 2 valid options for that baseline. **Phrase operator-native — don't name "Enclosing" or "Penetrating" in the question itself.**

| Baseline | Operator-native binary | Maps to |
|---|---|---|
| **Stable** | "Do they make their case from the BODY (warmth, weight, the room they're in, sensual gravity, the *feel* of what they're holding) — or from the MIND (precision, cutting through to the structural insight, the elegant point)?" | body → **Enclosing** · mind → **Penetrating** |
| **Adream** | "Does the feeling SETTLE-IN (held, contained, sensuous-enfolding) — or RADIATE-OUT (visibly streaming, the feeling reaches the reader)?" | settle-in → **Enclosing** · radiate-out → **Radiating** |
| **Near** | "Earthy and WEIGHTY (slow common sense, the body talks) — or CONVENTIONAL (using inherited form, well-mannered, thought-as-cover for action)?" | weighty → **Enclosing** · conventional → **Circumscribing** |

**Tiebreaker for toss-up images:** if the operator says "both fit," look at the actual brand CONTENT / PRODUCT:
- Structural / cognitive language native (rails, mechanisms, architecture, systems, maps) → **non-Enclosing** Aspect (Penetrating / Radiating / Circumscribing per baseline)
- Sensuous / relational language native (warmth, presence, holding, the room, embodiment) → **Enclosing**

Most modern tech / finance / infra brands route to non-Enclosing because their content is structural. Hospitality / consumer / lifestyle brands route to Enclosing because their content is sensuous-embodied.

**Total: 4 questions to a complete placement.** Then move to cadence (Move 2) and beat sequences (Move 3). The placement is the hard part; the next moves are interview-driven with the operator's gut as the signal.

## After placement: what the operator just unlocked

Once placement is locked, **the 12 tempi available to the character are determined mechanically** — 4 baseline-internal + 4 of each outer projection (which Stress determines). The next move (Move 2) is operator-taste-driven: which subset of the 12 belongs in the main rotation, and at what cadence.

**Before Move 2, surface this teaching for the operator** — it's the single most useful insight about their character, and most operators don't have it:

### Inner = who they ARE. Outer = how they're SEEN.

The character's **Inner Attitude** (Stable, Adream, or Near) is the home — the unchanging substrate of who they are when no pressure is on. But Inner uses only 2 Motion Factors, which means it produces only Shadow Moves (subliminal). It's not visible to a reader.

The **Outer Action Attitudes** (Mobile, Remote, Awake, plus the other two baselines) are how the character APPEARS when the Stress activates. The Stress is the bridge — it adds the third Motion Factor and makes the character readable.

**Concrete: Flow-stressed Stable Penetrating (Infinex).**

- Inner = Stable (intelligent ruler, decisions taken)
- Stress = Flow → outer projections available: Adream + Remote
- 12 tempi = 4 Stable + 4 Adream + 4 Remote

When Infinex picks its rotation as Commanding + Practical + Sombre + Irradiant + Sociable (the locked spec), at cadence Irradiant 45 / Commanding 22 / Sombre 18 / Sociable 10 / Practical 5:

| Bucket | Tempi | Share of visible time |
|---|---|---|
| Stable home (intelligent ruler shows through) | Commanding 22 + Practical 5 | **27%** |
| Adream outer (Flow-yielding visible) | Irradiant 45 + Sombre 18 | **63%** |
| Remote outer (cordial companionship) | Sociable 10 | **10%** |

**The character LIVES IN ADREAM OUTER 63% of the time even though their HOME is Stable.** This is not a contradiction — it's the stress mechanic working as designed. The Stable home only shows through when they need to land a decision (Commanding) or do mechanical justification (Practical). Most of the time, the visible behavior is Adream-flavored — soft, feeling-yielding, sympathetic — because that's where Flow-stress projects them.

For the operator: this is the SHAPE of their character at the reader's level. The placement names the substrate; the cadence names the visible distribution.

**The skill's main teaching error is letting operators believe "Stable" means the character reads as Stable." It doesn't. It means the character IS Stable. How they READ depends on the cadence across baseline-home and outer-projection tempi.**

## The full 3-move workflow

Detailed version of the above. Use when the operator wants to A/B feel before locking — typically for the first brand they run through the skill.

### Move 1 — Inner Attitude + Stress + Drive (the placement)

Ask the operator these questions in order. Each answer constrains the next.

1. **"Who is the character behind this brand when a reader encounters them?"** (Best friend? Accountant? Taxman? Mentor? Trickster? Old curmudgeon at the bar? The architect of a bridge?) — surface a concrete image, not a list of traits.
2. **"Does this character SHIP things, or are they VISION-pulled toward a future their grounding doesn't quite reach?"** — Shippers anchor to Stable (intelligent ruler, decisions taken). Vision-pulled-but-torn anchor to Adream (the lover, doubly unaware, vision exceeds grounding). Down-to-earth-sensory anchor to Near (a spade's a spade, common sense).
3. **(Baseline-filtered, operator-native phrasing — never name Time/Space/Flow in the question.)** Use the row matching Q1's baseline (full table in the fast-path Q2 section above):
   - Stable → "harder under pressure" (Time) vs "softer/yielding under pressure" (Flow)
   - Adream → "brittle/splitting" (Time) vs "consolidating/aristocratic-aloof" (Space)
   - Near → "sophisticated/room-reading" (Space) vs "yielding/big-daddy emotional" (Flow)
4. **"Does the voice need urgency theatre to work, or does it carry timeless craft?"** (urgency theatre needed → Passion-drive on-spec; timeless craft → Spell-driven, Passion off-spec). See fast-path Q3 above for the operator-native phrasing.

Map the answers to placement using the deterministic table in `references/mirodan-master.md` §4.1. If the operator's answers contradict each other (e.g., "vision-pulled-torn" + "no urgency" — Adream rules out the no-Passion option for Time-stress, and Space-stressed Adream mixes Spell with Passion), surface the contradiction and ask which they want to keep.

**Hard rules (never violate):**
- Mobile, Remote, Awake can NEVER be the baseline — they are Action Attitudes only (outer projections).
- Space-stressed Stable does NOT exist (Stable's Inner = Weight+Space, so Space cannot be the stress).
- Flow-stressed Adream does NOT exist (Adream's Inner = Weight+Flow, so Flow cannot be the stress).
- Time-stressed Near does NOT exist (Near's Inner = Weight+Time, so Time cannot be the stress).
- The three opposite-pairs are mutually exclusive: Stable↔Mobile, Near↔Remote, Awake↔Adream.
- Operators reaching for a disallowed Stress almost always mean the *non-Enclosing Aspect* of that baseline — route to Aspect (Q4), not Stress. See STUPID MISTAKES §2 above.

### Move 2 — Tempi rotation + cadence (recognition + escape hatch)

Once placement is locked, the 12 tempi available are determined mechanically (4 baseline-internal + 4 of each outer projection — see `references/working-actions.md`). Move 2 is operator-taste-driven: which subset of 12 belongs in the main rotation, and at what cadence.

**Method: recognition-primary with "write-your-own" escape hatch.**

5. **Generate 12 sample posts.** Pick a real product fact from the operator (a recent release, a deployed metric, an in-flight feature). Using the locked placement, generate one sample post per tempo (12 total). Each sample is 2-4 sentences in the motor-pair signature for that tempo. Use the same product fact across all 12 so the operator A/B-compares pure tempo, not content.

6. **Operator review pass.** For each of the 12 samples, the operator marks one of three:
   - *feels like X* — this is the character
   - *neutral* — could be, but doesn't define
   - *not like X* — this is not the character

7. **Weight the "feels like X" picks.** For each marked sample, operator weights:
   - *dominant* (35-50% of posts)
   - *common* (15-30%)
   - *occasional* (5-15%)
   - *rare* (≤5%, beat-only)

8. **Escape hatch — write-your-own.** If the operator sees a tempo where they say *"none of these samples feel right BUT I sense there should be something here / I want a slot for this motor-direction"*, ask them to **write one line themselves** in the voice they're aiming at. The agent then:
   - Classifies the line backward to a tempo (using the same regex/motor-anchor logic as `auditBeats` in `src/validator.ts`)
   - Reports the tempo: *"what you wrote is Sombre → Practical — that's the slot you wanted"*
   - Adds it to the rotation with the operator's weight

   This doubles as the operator's **framework-vocabulary teaching mechanic** — the agent names what they wrote in Mirodan terms, building their literacy over time. It also uses the SAME mechanism as the validator's `auditBeats`, so the skill and validator share the operation.

9. **Cadence approximation.** Cadence comes out of step 7's weights, normalized to sum to 100%. Don't force exact percentages — the spec captures intent.

The cadence is approximate, not enforced. Concrete example from the Infinex spec: `Irradiant 45% / Commanding 22% / Sombre 18% / Sociable 10% / Practical 5%`. Note this spans baseline-home (Stable: Commanding + Practical = 27%) and outer projections (Adream: Irradiant + Sombre = 63%, Remote: Sociable = 10%). See the *Inner = who they ARE / Outer = how they're SEEN* teaching above.

### Move 3 — Beat-sequence templates + few-shot library + off-spec regexes

7. **Beat-sequence per release-card kind.** Posts arc through tempi as beat sequences, not single-tempo monoliths. For each release-card kind (launch, data-update, partner-announcement, post-mortem), draft the canonical beat sequence. Example for a major launch: `Sombre (Pressing prep) → Commanding (Punching release) → Practical (Wringing/Slashing justify) → Irradiant (Floating/Flicking lift)`.

8. **Few-shot library.** Take 3-5 sample posts per main tempo (real, ideally drawn from existing voice or from accounts the operator admires). These become the generator's prompt examples.

9. **Off-spec regex rules.** Based on the Drive lock, identify vocabulary families that foreground off-spec drives as the visible projection. Time-pressure markers (`act now`, `hurry`, `last chance`) foreground Passion — off-spec for an Infinex-style Spell→Vision axis where Passion is hidden lining. Hype theatre (`buckle up`, `wagmi`, `let's go`) foregrounds Passion. Build a regex per family.

Output: a `CharacterSpec` in TypeScript matching `src/voice/types.ts` (see Infinex's at `src/voice/infinex.ts`).

## Generator + validator architecture

The voice spec feeds directly into the existing scaffold at `comms-factory/src/`:

```
release card  →  generator  →  validator  →  orchestrator  →  ship gate
                     ↑              ↑
            voice spec       voice spec
            + beats[]        + beats[]
```

### Generator (`src/generator.ts`)
- Takes `(ReleaseCard, BeatSequence, CharacterSpec)`
- Builds a system prompt containing:
  - Placement (Inner + Stress + Aspect + Drive)
  - Main tempi reference (motor pairs + opening shapes + vocab + few-shots)
  - Preparation hierarchy reminder (canonical Sustained→Quick tempi enforce visible prep; both-Sustained and both-Quick tempi do not require an earlier prep beat)
  - Hard rules + off-spec drive language
- Builds a user prompt with the release card + the declared beat sequence
- Returns N candidates, each a multi-paragraph post (one paragraph per beat)
- Falls back to a deterministic stub mode when `ANTHROPIC_API_KEY` is unset (composes sample post from the few-shot library)

### Validator (`src/validator.ts`)

**Layer 1 — regex-grade slop/allergen rules (brand-agnostic):**
- `rejectCliches` — game-changer / unlock / paradigm / seamless / empower / next-gen / leverage
- `rejectListicleVoice` — N reasons / why X matters / top N / only X you'll ever need
- `rejectAntagonism` — competitor names paired with negative descriptors
- `rejectAIslop` — vague nouns + em-dash density (> 2 per 280 chars)
- `rejectKainBaggage` / `rejectClaimedPalettes` — brand-specific allergens
- `rejectOffSpecDrive` — Drive-lock regex (time-pressure / hype-theatre for Spell-Vision)

**Layer 2 — beat-sequence audit (Mirodan-grounded):**
- `auditPrepHierarchy(beats)` — checks canonical Sustained→Quick tempi only. Both-Sustained tempi have no Quick action; both-Quick tempi handle prep internally in the character's inner state and should not force an earlier prep beat.
- `auditBeats(text, beats)` — splits post into paragraphs, classifies each against declared tempo, reports mismatches

**TODO (Nigel Track-5b mechanic):** intent-consistency-vs-blind-classify. Currently `auditBeats` uses vocab-anchor regex; the production version should call Claude Sonnet to blind-classify each beat's tempo and confidence, then compare to the declared tempo. The pattern is in `references/nigel-pattern.md`.

## Example: the Infinex spec at full fidelity

`examples/infinex-voice-spec.md` shows the locked Infinex voice as a complete worked example. Reading it end-to-end takes ~10 minutes and produces an agent that can generate posts in voice.

## Related skills

This skill is for **creating a voice from scratch**. Once a voice is locked and the generator/validator loop is running, downstream extensions use:

- **`nigel-voice-extend`** — adding a new post type to an existing voice subsystem (e.g., epoch_open, drawdown_post, anniversary_post). Captures the seven file shapes a new post type requires + the specific gotchas that bit on Nigel's Track 9 build. Different concern: this skill creates the voice; `nigel-voice-extend` extends it with new card types after it's running.

If you're being asked to "add a new post type to Infinex" or similar, you want `nigel-voice-extend`, not this skill. If you're being asked to "build a voice for X" or "we need a brand voice", you want this skill (then `nigel-voice-extend` for each new post type after).

## Reference materials

- `references/mirodan-master.md` — the full Mirodan synthesis (462 lines, includes top-12 overrides of simpler Laban readings). The single most important file in this skill.
- `references/literary-refs-glossary.md` — modern equivalents for every Mirodan literary character (Werle / Big Daddy / Tesman / Hamlet / etc.). Use when an operator isn't fluent in Williams/Ibsen/Shakespeare. The framework refs become operator-actionable via modern parallels (Tony Soprano / Anthony Bourdain / Wes Anderson narrators / Logan Roy / etc).
- `references/working-actions.md` — the 8 Working Actions table + preparation hierarchy
- `references/drive-mapping.md` — Drive sub-diagrams; how Inner + Stress + Aspect determine which Drives are active
- `references/nigel-pattern.md` — the generator/validator/orchestrator pattern from Nigel (the prior voice subsystem this skill generalizes)

Mirodan's original PhD is at `Mirodan-PhD-1997-Vol2.pdf` (50MB, not included in this skill — locate it in the operator's Downloads or via library.london.ac.uk).

## Templates

- `templates/interview-questions.md` — the question scripts for Moves 1-3
- `templates/voice-spec-template.md` — fillable TypeScript skeleton
- `templates/beat-sequence-templates.md` — canonical beat orders per release-card kind

## Examples

- `examples/infinex-voice-spec.md` — Infinex: Stable + Flow + Penetrating, Spell-Vision, 5-tempo rotation. Includes all 36 sample posts (3 facts × 12 tempi).
- `examples/nigel-summary.md` — Nigel for reference: Flow-stressed Stable, Bound, Light + Direct, three registers (Self-Contained / Diffused / Egocentric).

## Hard rules to never break

```
1. Mobile, Awake, Remote are NEVER baselines. CharacterSpec.inner_attitude
   must be one of: Stable, Adream, Near.

2. Available stresses are determined by the baseline:
   - Stable: time | flow  (NOT space)
   - Adream: time | space (NOT flow)
   - Near:   space | flow (NOT time)

3. The three opposite-pairs are absolute:
   Stable ↔ Mobile, Near ↔ Remote, Awake ↔ Adream.

4. Preparation hierarchy: canonical Sustained→Quick tempi require their visible Sustained partner; both-Sustained and both-Quick tempi are not sequence-level prep failures.
   as prep, or it degrades.

5. Drive determines off-spec language:
   - Time-stress activates Passion drive
   - Flow-stress on Stable activates Spell; Passion may still exist as hidden lining depending on diagram
   - Space-stress on Adream mixes Spell with Passion
   - Off-spec language is the part of Drive language the character must not foreground as its visible projection.

6. Inner Attitudes use 2 Motion Factors → Shadow Moves (subliminal).
   Action Attitudes use 3 Motion Factors → visible Working Actions.
   The Stress is the bridge — the third axis.
```

## Operator success criteria

This skill has succeeded for an operator when:

1. They can answer "who is X when a reader encounters them?" with a concrete image
2. They have a locked `CharacterSpec` (placement + cadence + off-spec rules)
3. The generator produces posts in their voice on first call (with sensible beat sequences)
4. The validator rejects slop without manual rule-writing per failure
5. They can extend the spec (add tempi, refine off-spec regexes) without needing this skill again

If any of these fail, the workflow surfaced a contradiction that needs the operator's judgment — surface it, don't paper over it.
