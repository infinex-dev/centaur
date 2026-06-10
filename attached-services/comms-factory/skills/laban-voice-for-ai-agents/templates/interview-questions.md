# Interview questions — 3-move workflow

Use these scripts when running an operator through the voice-spec workflow. The questions are ordered so each answer constrains the next.

## Move 1 — Placement (Inner Attitude + Stress + Drive)

### Q1.1 — The character behind the brand

**Ask:** "When a reader encounters this brand, who are they talking to? Give me an image — not a list of adjectives. Best friend? Accountant? Taxman? Mentor? Old curmudgeon at the bar? The architect of a bridge? The watchmaker who's been making the same watch for thirty years?"

**Why:** This anchors the rest. If the operator gives adjectives ("warm, confident, but not arrogant"), push back: "what KIND of person is warm-confident-not-arrogant?" Force the concrete image.

### Q1.2 — Shipper / Visionary / Down-to-earth

**Ask:** "Does this character SHIP things — bridges built, products delivered, infrastructure done? Or are they VISION-pulled toward a future their grounding doesn't quite reach? Or are they DOWN-TO-EARTH — common sense, a-spade's-a-spade, sensory?"

**Map:**
- Ships things → **Stable** baseline (intelligent ruler, decisions taken)
- Vision-pulled-but-torn → **Adream** baseline (the lover, doubly unaware, vision exceeds grounding)
- Down-to-earth-sensory → **Near** baseline (relating, common sense)

### Q1.3 — Stress (baseline-filtered, operator-native — DO NOT name Time/Space/Flow in the question)

The question is binary and depends on which baseline Q1.2 locked. Show ONLY the row that matches.

| Q1.2 baseline | Ask: "When pressure shows up, does this character get..." | Maps to |
|---|---|---|
| **Stable** | "...HARDER (jaw set, ship the thing, no time for sentiment, war-room voice) — or SOFTER (the conviction has a tremor, feeling shows through the institutional cover, late-night truth)?" | harder → **Time-stress** · softer → **Flow-stress** |
| **Adream** | "...BRITTLE (splits / fragments under pressure, can't hold the room) — or CONSOLIDATING (aristocratic-aloof, the mask hardens into intellectual coolness)?" | brittle → **Time-stress** · consolidating → **Space-stress** |
| **Near** | "...SOPHISTICATED (mature, room-reading, position-aware) — or YIELDING (big-daddy emotional, the feeling pours out)?" | sophisticated → **Space-stress** · yielding → **Flow-stress** |

**Do NOT** present the disallowed Stress for the chosen baseline. If the operator's gut answer doesn't match the binary (e.g., they say "neither — it's more like... [description that sounds like the disallowed Stress]"), do NOT add the disallowed Stress as an option. Instead, route to Q1.5 (Aspect) — the disallowed-Stress pull is almost always the *non-Enclosing Aspect* of that baseline. See SKILL.md STUPID MISTAKES §2.

### Q1.4 — Drive lock (operator-native — DO NOT name Drive families in the question)

**Ask:** "Does this character need to say things like *'last chance, act now, hurry, limited time, this is going to fly'* to make their case land? Or do they say things like *'this has been coming for years, the rails take time, the future is patient, we built this slowly'*?"

- Needs urgency theatre → **Passion drive on-spec** (the character has urgency as a native register)
- Timeless craft, patience-as-virtue → **Spell drive on-spec, Passion off-spec**

**Drive-axis teaching (background for the agent, not the operator):** Drives come in AXES, not singletons. Each placement has a *primary axis* of two home Drives + a *sub-axis extension* determined by Stress + Aspect. For Stable: primary = Doing/Spell; Time-stress extends toward Passion (off Doing); Flow-stress + Penetrating extends toward Vision (off Spell). So "Spell-Vision" = sub-axis label meaning *home is Spell, extends toward Vision, never touches Passion*. See `references/drive-mapping.md` for the full sub-diagram table.

### Q1.5 — Aspect (baseline-filtered, operator-native — DO NOT name Enclosing/Penetrating/etc in the question)

| Baseline | Ask: "When this character makes their case, do they bring it from..." | Maps to |
|---|---|---|
| **Stable** | "...the BODY (warmth, weight, the room they're in, sensual gravity, the *feel* of what they're holding) — or the MIND (precision, cutting through to the structural insight, the elegant point)?" | body → **Enclosing** · mind → **Penetrating** |
| **Adream** | "...feeling that SETTLES-IN (held, contained, sensuous-enfolding) — or feeling that RADIATES-OUT (visibly streaming, the feeling reaches the reader)?" | settle-in → **Enclosing** · radiate-out → **Radiating** |
| **Near** | "...the body, slowly (earthy, weighty, common-sense talk) — or the inherited form (well-mannered, conventional, thought-as-cover-for-action)?" | weighty → **Enclosing** · conventional → **Circumscribing** |

**Tiebreaker for toss-up images:** if the operator says "both fit, hard to pick," look at the actual brand CONTENT / PRODUCT:
- Structural / cognitive language native (rails, mechanisms, architecture, systems, maps) → **non-Enclosing** (Penetrating / Radiating / Circumscribing)
- Sensuous / relational language native (warmth, presence, holding, the room, embodiment) → **Enclosing**

Most modern tech / finance / infra brands route to non-Enclosing. Hospitality / consumer / lifestyle brands route to Enclosing.

### Output of Move 1

A locked placement: e.g., `Stable + Flow-stressed + Penetrating, Drive sub-axis: Spell-Vision on Doing/Spell home (Diagram D)` (Infinex).

### Move 1 → Move 2 hand-off (mandatory teaching for the operator)

Before starting Move 2, show the operator the **Inner = who they ARE / Outer = how they're SEEN** distinction. This is the single most useful insight about their character and most operators don't have it.

- The Inner Attitude (Stable / Adream / Near) is the home. It uses 2 Motion Factors → Shadow Moves (subliminal, invisible).
- The Outer Action Attitudes (the other two baselines + Mobile / Remote / Awake, depending on placement) are how the character APPEARS when Stress activates. The Stress is the bridge — adds the third factor → visible Working Actions.
- The 12 tempi available split: 4 baseline-home + 4 of each outer projection (which Stress determines). E.g., Flow-stressed Stable has Stable + Adream + Remote tempi available.

When the operator picks a cadence in Move 2, they're picking how much of visible-time the character spends in each bucket. E.g., Infinex's cadence (Irradiant 45 / Commanding 22 / Sombre 18 / Sociable 10 / Practical 5) means 27% Stable home + 63% Adream outer + 10% Remote outer. The character IS Stable but READS as Adream-flavored most of the time. That's not a contradiction — it's the stress mechanic working as designed. Surface this BEFORE Move 2 so the operator's cadence picks are informed.

## Move 2 — Tempi rotation + cadence (recognition + escape hatch)

The 12 tempi available to the locked placement are determined mechanically (4 baseline-home + 4 of each outer projection). Move 2 is operator-taste-driven: which subset of 12 belongs in the main rotation, and at what cadence.

### Q2.1 — Pick a product fact

Ask the operator to name a real, concrete product fact (a recent release, a deployed metric, an in-flight feature). E.g., for Infinex: "Hyperliquid spot trading is live on Infinex with up to 18.94% yield on USDC collateral." The same fact is used for all 12 samples in Q2.2 so the operator A/B-compares pure tempo, not content.

### Q2.2 — Generate 12 sample posts (recognition primary)

Generate one sample post per tempo (12 total), each 2-4 sentences in the motor-pair signature for that tempo. Show all 12 to the operator with:

- The tempo label (Commanding, Sombre, Irradiant, etc. — at this point the operator IS learning the framework vocabulary, that's fine)
- The motor pair (e.g., Pressing → Punching)
- The sample post

For each sample, the operator marks one of three:
- **feels like X** — this is the character
- **neutral** — could be, but doesn't define
- **not like X** — this is not the character

### Q2.3 — Weight the "feels like X" picks

For each *feels like X* marked sample, ask: "of all the posts this brand writes, how often does this tempo show up?"

- **dominant** (35-50% of posts)
- **common** (15-30%)
- **occasional** (5-15%)
- **rare / beat-only** (≤5%)

### Q2.4 — Escape hatch: write-your-own (with backward-classification teaching)

If the operator sees a tempo where they say "*none of these samples feel right BUT I sense there should be something here / I want a slot for this motor-direction*" — invite them to **write one line themselves** in the voice they're aiming at.

The agent then:
1. Classifies the line backward to a tempo (using the same regex/motor-anchor logic as `auditBeats` in `src/validator.ts`)
2. Reports the tempo to the operator: "*what you wrote is Sombre → Practical — that's the slot you wanted*"
3. Adds the classified tempo to the rotation with the operator's weight (dominant / common / occasional / rare)

This serves TWO functions:
- **Captures tempi the sample-generation missed.** The samples are good but imperfect; the operator's own line is ground truth for that slot.
- **Teaches the operator framework vocabulary.** Over time the operator builds an ear for "I wrote in Sombre" without having to learn Mirodan from a textbook. The skill teaches via doing.

Use this escape hatch liberally — every brand will surface 1-3 slots where the sample didn't capture what the operator wanted.

### Q2.5 — Cadence normalization

Total cadence across main tempi should sum to 100%. The weight buckets translate roughly:
- *dominant* = 35-50%
- *common* = 15-30%
- *occasional* = 5-15%
- *rare / beat-only* = excluded from main rotation, kept available as rare beats

If the total doesn't sum cleanly, ask the operator to tweak the dominant tempo's % up or down. Don't force exact percentages — the spec captures intent.

### Output of Move 2

`main_tempi: TempoName[]` + `beat_only_tempi: TempoName[]` + `cadence: Partial<Record<TempoName, number>>`. Concrete example from the Infinex spec: `Irradiant 45 / Commanding 22 / Sombre 18 / Sociable 10 / Practical 5`.

## Move 3 — Beat sequences + few-shot + off-spec rules

### Q3.1 — Beat sequence per release-card kind

Walk the operator through their release-card kinds (launch, data-update, partner-announcement, post-mortem, status-report, etc.). For each, draft a canonical beat sequence and ask: "for a typical [launch], does the post want to arc Sombre → Commanding → Practical → Irradiant? Or something else?"

Capture as `defaultBeatsForKind(kind: string) → TempoName[]`.

### Q3.2 — Few-shot library

**Ask:** "Give me 3 real examples of voice you wish the brand sounded like — yours or other accounts. Doesn't have to be perfect; we'll iterate."

For each, identify which tempo it best exemplifies and add to that tempo's `example_lines[]`. The generator uses these as priming.

### Q3.3 — Off-spec regex iteration

Show the operator the default off-spec regexes for their Drive lock (e.g., for Spell-Vision: time-pressure / FOMO / hype-theatre lists).

**Ask:** "Anything missing? Anything you want to add specifically because past comms used it?"

Capture as `off_spec_regexes: { name, re, reason }[]`.

### Output of Move 3

A complete `CharacterSpec` ready to write into `src/voice/<brand>.ts`.

## After the interview — verification

1. Generate 3 sample posts using the spec (run the stub generator).
2. Show them to the operator alongside the operator's own examples.
3. If 2 of 3 generated posts read as "the brand" without intervention, ship the spec.
4. If not, ask: "what about [specific post] is off?" — and iterate the off-spec regex, the few-shots, or the cadence based on the answer.

The spec is a living artifact, not a one-shot output. The first 30 days after deployment will surface 5-10 regexes / few-shot updates the interview missed.

## Time budget

- Move 1 (placement, 4 questions): 10-20 minutes via the SKILL.md fast path; 20-30 via the full Move 1 in this template
- Move 2 (recognition + escape hatch): 20-40 minutes (sample generation + operator review + 1-3 write-your-own iterations)
- Move 3 (beat sequences + few-shots + off-spec regexes): 30-45 minutes
- Verification: 15 minutes

Total: ~90 minutes for a complete locked spec via the fast path, ~2 hours via the full workflow. Without this skill: ~10 sessions across weeks of voice-by-vibes iteration.
