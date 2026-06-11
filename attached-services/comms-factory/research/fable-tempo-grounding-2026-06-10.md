# Tempo-collapse fix — canon grounding, drift audit, adjudication, plan

Fable, 2026-06-10. Working from `research/fable-tempo-grounding-prompt-2026-06-10.md`.
Source ladder per `skills/mirodan-grounding/SKILL.md`: GROUNDED-FINDINGS.md first, chapter extracts for verbatim, code last.

---

## 1. From-canon model

### 1.1 What a State/Attitude is, and the "four tempi per State" question

Six Inner Attitudes, each a two-Motion-Factor compound (GROUNDED-FINDINGS §3, sourced Ch2 p.474):
Stable (Weight+Space), Near (Weight+Time), Adream (Weight+Flow) — the three possible baselines —
plus Mobile (Time+Flow), Awake (Space+Time), Remote (Space+Flow), which are Action Attitudes only.

**"Four tempi per State" is canon-correct.** The 24-tempo table is 4 variations × 6 attitudes
(GROUNDED-FINDINGS §6, mirrored in `MIRODAN_24_TEMPI`), and Ch2 confirms the character owns all four:

> "a Character has at its disposal all four Variations given to its Inner Attitude. In practice, we
> find that one of these variations tends to occur less often, reflecting the character's Aspect...
> But the other three are used to a large extent and **their use makes for variety and interest in
> performance**" (Ch3 extract quoting p. 558)

So variety across variations is the canonical norm. A character camped in ONE variation
(all-Commanding) is off-canon irrespective of placement.

The operator's "Dream" = canonical **Adream**. Vocabulary corrected; the framing survives.

### 1.2 What Flow-stress does to a Stable attitude

Stress = the third Motion Factor activated so the two-factor attitude becomes visible action
(GROUNDED-FINDINGS §5; Ch3 p.553: "Stress is added to BOTH Inner Participations of an Attitude").
For Stable (Weight+Space) the legal stresses are Time or Flow.

The Action-Attitude formation rule (Ch3 pp.553-554):
- **Outer Action Attitude = Stress + the Aspect's main Inner Participation.**
- **Inner Action Attitude = Stress + the secondary Inner Participation.**

For Infinex — Stable, Aspect Penetrating (Space-led/Attending), Stress Flow:
- Outer Action = Flow + Space = **Remote**
- Inner Action = Flow + Weight = **Adream**

This *derives* the operator's range claim from canon: the placement's reachable registers are
**Stable (baseline) + Remote (outer action) + Adream (inner action)** — exactly the three attitudes
the five locked tempi span (commanding/practical = Stable; sombre/irradiant = Adream;
sociable = Remote). "Range across Stable, Dream, Remote" is not a loose preference; it is the
mechanical output of the locked placement. Adjudication: **FAITHFUL** (with Dream→Adream).

Drive check: Flow-stress determines formative-drive order (Ch3 p.557: "the order of Drives is
determined by the Stress"). Stable's formative confluence is Doing(W+S+T) + Spell(W+S+F)
(p.546-547); Flow sits in Spell's triple → Spell primary. The locked drive cell
`stable|penetrating|flow → primary=spell, secondary=doing, introvert=passion, extravert=vision`
matches canon, including the X-diagram tops (Remote outer carries Vision = extravert; Adream inner
carries Passion = introvert; p.556). The locked spec is NOT drifted here.

### 1.3 Why "Dream-landing is the prize" — and why Commanding-collapse is doubly wrong

Spell's tempo signature (Ch3 p.537):

> "Spell characters generally display a **Sustained tempo**... the resulting quality is
> 'dream-like: almost, but not literally, in slow motion'... a magnetic quality akin to that of
> folk dances or Arabic singing and Gregorian chants"

A Spell-primary character whose output collapses to Commanding (Strong+Direct, Pressing→Punching —
will-assertion under pressure) is presenting as a **Doing-dominant** character. The collapse isn't
just "low variety"; it's the wrong resting drive made visible. The locked cadence
(irradiant 0.45 — Light+Free Adream) is the canon-consistent artifact: irradiant is the Flow-stress
made audible. Adjudication of the operator's "Dream-landing is the prize": **FAITHFUL** —
Adream is the Inner-Action attitude of the placement, i.e. landing it is landing the character's
inner life rather than its armor.

Stress fluidity caveat (p.554, 557 fn): stress means "occurs more frequently," never exclusivity —
so Stable-register beats remain legal; the failure is only the camp-out.

### 1.4 How tempo emerges — "never pre-assigned" verified

- "Inner Participations as a whole are revealed physically in the overall tempo of the character's
  movement. **Tempo itself, being a function of Time, is the physical realization of the Inner
  Participation of Deciding.**" (Ch1 p.286, verbatim)
- Transitive-verb principle: "Working Actions are abstractions; what an actor PLAYS is a transitive
  verb that *fits* a Working Action. **'Punching' can't be acted. 'To box' can.**" (Ch1 pp.350-351)
- Working-Action tempo: each Working Action / transitive verb has a "definite tempo"; characters
  defined by dominant Working Action ARE defined by their dominant tempo (Ch1 pp.351-352).

So: the actor's only conscious lever is the verb (and its motor preparation); tempo is the
audience-perceived trace of Deciding under the inner work. "Tempo is emergent from the
Deciding/working-action, never pre-assigned" is **FAITHFUL** — the "never pre-assigned" clause is
our operational corollary, but it follows directly: a tempo label is not playable, so assigning one
per post-kind is assigning the unplayable and skipping the playable.

One refinement from canon: tempo arcs keyed to **genre/post-kind** are doubly off — drive order and
stress track *circumstance within the scene* ("the immediate need to act elicited by the given
circumstances of a scene can prevail", p.552 fn), not artifact type.

---

## 2. Drift audit (spec + generator vs the from-canon model)

### D1 — `src/generator.ts:690-712` + `:638-643` — per-kind tempo arcs in the v2 system prompt. **DRIFT (primary cause).**
The default ("current"/v2) system prompt — used by BOTH Stage A and Stage B of the live two-call
path — injects a "Beat sequences per post type" table:
Launch-tier `Sombre → Commanding → Practical → Irradiant`; Standard `Sombre → Commanding →
Irradiant`; Dry one-liner `Irradiant → Commanding`; Split `Practical → Commanding → Irradiant`;
Partner `Sociable (standalone or chained with Commanding)`. **Commanding appears in every row**,
landing position in three. This is the pre-assignment canon forbids (§1.4) AND it contradicts the
same pipeline's own user prompts ("DO NOT DECLARE A TEMPO", generator.ts:1279, 1519). The system
prompt wins that fight: it's prescriptive, table-shaped, and repeated in both stages.

### D2 — `src/generator.ts:614-615` — "Each beat fires one tempo." **DRIFT (same class).**
The tempo-palette header instructs assignment ("Each beat fires one tempo... motor pair") while the
user prompt forbids it. Mixed signals; the assignment framing primes naming-then-writing.

### D3 — `src/generator.ts:1320` — "Single-beat Commanding is legal and often correct" (x channel, Stage A). **DRIFT.**
Names a specific tempo as the often-correct answer for the highest-volume channel, three lines
after "DO NOT DECLARE A TEMPO." The actor-director path phrases the same idea correctly at the
motor level (`channelGrammarBlock`: "A single beat with Sustained→Quick motor inside it").

### D4 — `voice.cadence` is wired to NOTHING. **DRIFT (omission).**
`infinex.ts:225-231` locks cadence irradiant .45 / commanding .22 / sombre .18 / sociable .10 /
practical .05 — canon-consistent with the Spell Sustained signature (§1.3). No generation surface
ever reads it (only history-guards' anti-streak rules touch shipped history). Meanwhile every
prompt iterates `main_tempi` in array order — `commanding` first (infinex.ts:250). The model's
only distributional signal is presentation order, and it points at Commanding.

### D5 — `infinex.ts:297-335` `defaultBeatsForKind` + `generator.ts:1471-1485` fallback slices. **DRIFT, but cold paths.**
Hard-coded arcs with Commanding in every kind / `main_tempi.slice(0,N)` (commanding-first). These
feed only the legacy single-call path and stub-mode placeholders — not the live two-call path.
Same disease as D1, lower severity.

### D6 — `generator.ts:755` kernel rule 12 names the canonical launch-tier arc. **DRIFT, v1-permutation path only** (kernel/full eval permutations, not production v2).

### NOT drifted (verified):
- `infinex.ts` canonical shorthands — match `MIRODAN_24_TEMPI` verbatim incl. page refs.
- The drive table / Diagram D placement — matches Ch3 pp.546-557 (§1.2 above).
- `actor-memory.ts` Actor/Director prompts — already emergence-faithful ("Do not name, declare,
  target, or choose tempo"; Director reads post-hoc with the two-factor gate). Gap: the Actor gets
  no range/resting-register knowledge (nothing says the placement's reachable attitudes are
  Stable/Adream/Remote or that Spell rests Sustained), so the "banker, decisions taken" image plus
  Strong/Direct gravity defaults it to will-assertion.
- The five-tempi/attitude mapping in the locked spec — matches canon table.

## 3. Adjudication of the operator's four levers

1. **buildBeatSequenceSection hard-codes arcs, Commanding in every arc** — **ACCEPT** (= D1).
   Canon grounds: Ch1 p.286/350-351 (tempo unplayable; verb playable), p.558 (four-variation
   variety), p.552fn (circumstance, not genre, orders the energy).
2. **main_tempi order vs cadence contradiction; slice(0,N) fallbacks** — **ACCEPT the
   contradiction (= D4), demote the fallbacks** (= D5): the slices are stub/legacy-only and can't
   cause the live collapse, but the order-as-only-signal problem is real and the cadence being
   entirely unwired is the larger half of the finding.
3. **Stage A still asks for a tempo and discards it** — **REFUTE for current code.** The Stage A
   JSON template (generator.ts:1360) explicitly says "NO tempo field" and the parser
   (1388-1398) never reads one. This described the pre-refactor file (the 2026-05-25 audit's
   state). The *residue* of the complaint is real but lives in the v2 SYSTEM prompt (D1/D2/D3),
   not in Stage A's output contract.
4. **No per-release through_action** — **REFUTE for current code.** `InnerWork.through_action` is
   required (Stage A throws without it, generator.ts:1383); cards can carry it
   (card-level inner-work block, 1292-1311); Stage A must invent it when absent. Quality of
   invented through-actions is a real variable, but the inner-cause slot exists and is mandatory.

## 4. Fix plan

Principle: remove every site where a tempo label is handed to the model as a target; replace with
canon-grounded **placement knowledge** (what registers exist and where the character rests) and let
range emerge from verbs + motors. No quotas, no forced lottery. Zero changes to locked spec values.

1. **generator.ts `buildV2SystemPrompt`:**
   - Delete the "Beat sequences per post type" table (D1). Replace with a "Range of the placement"
     section: Stable baseline / Remote outer-action / Adream inner-action derivation, Spell's
     Sustained resting signature (p.537), four-variation variety (p.558), tempo-emerges-from-verb
     (p.286/351), explicit "do not pre-assign a tempo or an arc; sequence verbs/motors as the
     through-action demands."
   - Reframe the palette header (D2): tempi listed as what the AUDIENCE will read, not what a beat
     "fires"; do not name/target them while writing.
   - List tempi in cadence order when `voice.cadence` is present, and surface the cadence as a
     descriptive resting distribution (D4) — informational, not a quota.
2. **generator.ts:1320 (D3):** reword to motor level, mirroring the actor path: single beat
   carrying its Sustained prep inside it is legal and often right; name all four prep→release
   pairs, no tempo name.
3. **actor-memory.ts:** add the same canon-grounded range/resting-register lines to the ACTOR pack
   only (new block; `infinexPlacementBlock` stays shared/unchanged so the Director's forensic read
   is not biased toward expecting any tempo).
4. **Leave D5/D6 cold paths** except where a one-line fix is free; they don't feed live output.
5. **Write back** the three canon findings used here into GROUNDED-FINDINGS.md (per skill rule).

Locked-spec diff: none (cadence already locked; we only consume it).

## 5. Proof protocol

- `scripts/tempo-eval.ts` (new): live-generate n=3 per card across the 5 release cards on the x
  channel → Director audit each → corpus.md.
- Tempo distribution: `scripts/classify-corpus.ts` (v2 gold-standard) on corpus.md, before vs
  after. Success: no single tempo > ~60%, Adream-state tempi (sombre/irradiant) materially present,
  all reads within the locked palette.
- Director pass-rate before vs after (legal + copy_voice) — must not crater.
- Eyeball pass on tone + line craft.
- `pnpm vitest run` green.

---

## 6. Results (three fix iterations, 15 candidates each, x channel, same 5 cards)

### 6.0 Instrument finding: Director ↔ classifier disagree on Weight
**[AMENDED 2026-06-10 after operator adjudication: the DIRECTOR is the senior instrument ("the
Director is like V3"). The original framing below treated the classifier as gold per the
2026-05-19 memory — that hierarchy is superseded. Director-lens numbers govern §6.2.]**

On identical texts the **Director read 12/15 commanding; the v2 classifier read 0/15 commanding**
(6 certain, 4 self-contained, ...). The two rule homes disagree on the commanding-vs-certain
discriminator (GROUNDED-FINDINGS §2: will vs settledness). With the Director senior, the open
question runs toward the classifier: its certain/self-contained-heavy reads may be trap #2
over-correction (§9.2). Neither instrument's fine-grained distribution should be trusted for
small deltas until both are calibrated against a known-answer sample set. Logged in
GROUNDED-FINDINGS §12.

### 6.0b Director-lens adjudication (instrument of record)

| run | Director tempo reads | Director pass |
|---|---|---|
| BEFORE | **commanding 12** · practical 3 | 14/15 |
| AFTER-3 | commanding 8 · practical 7 | **15/15** |

The 80% commanding collapse is broken into a commanding/practical spread (commanding plurality —
operator-acceptable) with zero failures. Self-contained as whole-copy primary — the old
patronizing register — reads ZERO in after3, and the Director carries a deterministic gate that
FAILS beat-only tempi as primary (it did exactly that in after1/after2), so that register is
policed by the senior instrument. Sombre/irradiant/sociable do not yet appear as whole-copy
primaries; note all 5 test cards are launch announcements, the genre where Stable primaries are
most at home — Stage A now demonstrably scores light/free motors (floating→flicking, gliding) and
the Adream/Remote texture shows up in closes, per beat, rather than as post primaries. Whether a
launch post should EVER be irradiant-primary (vs irradiant-closing) is a cadence/genre question
for the operator, not a code defect.

### 6.1 Distributions (v2 classifier = instrument of record; Director shown for pass-rate)

| run | classifier tempo_primary | classifier attitude | Director pass |
|---|---|---|---|
| BEFORE | certain 6 · self-contained 4 · practical 3 · irradiant 1 · warm 1 | stable 7 · awake 6 · adream 1 · near 1 | 14/15 |
| AFTER-1 (prompt: range section, cadence order, arc-table removed) | certain 9 · sombre 3 · self-contained 2 · unacknowledged 1 | awake 9 · adream 3 · stable 2 · mobile 1 | 10/15 |
| AFTER-2 (+ anti-certain: will-or-flow rule, self-check #2 rewrite) | certain 6 · self-contained 6 · acknowledged 2 · practical 1 | stable 7 · awake 6 · mobile 2 | 13/15 |
| AFTER-3 (+ **Stage A motor scoring** — working_action + preparation_from per beat, mirroring the actor path) | **self-contained 6 · certain 4 · irradiant 3 · practical 2** | **stable 8 · awake 4 · adream 3** | **15/15** |

### 6.2 Gate adjudication (AFTER-3 vs the prompt's five bad outcomes)

1. *Director failing everything* — NO: 15/15 pass (BEFORE was 14/15).
2. *Still all-Commanding* — NO on both instruments: Director 8 commanding / 7 practical (was 12/3);
   classifier 0 commanding (largest bucket 6/15 = 40%).
3. *Off-spec drift* — IMPROVED, not eliminated: off-attitude noise (warm, unacknowledged,
   acknowledged) gone; certain (off-palette Awake) 6 → 4; **irradiant 1 → 3 (the prize lands)**;
   adream 1 → 3. Residual: self-contained over-fires as primary read (6/15; it is in the available
   12-tempo palette but beat-only in rotation), certain still present 4/15. Remote/sociable did not
   appear — no partner-moment card in the test set.
4. *Tone worse* — NO (eyeball pass §6.3): stronger character presence, zero slop/urgency markers.
5. *Verbiage worse* — NO: line craft improved; Flow-borne closes appear ("The doors after this one
   are already on their way") that the BEFORE corpus never produced.

### 6.3 What moved the needle vs what didn't

- Prompt-level nudges alone (AFTER-1/2) shuffled the collapse between certain ↔ self-contained.
  Naming a register as "marked" makes the model avoid its *vocabulary*, not find the inner cause —
  AFTER-1 even demonstrated GROUNDED-FINDINGS trap #2 live (certain 9/15 after telling it
  Strong+Direct is the marked move).
- The structural fix was **motor scoring in Stage A** (AFTER-3): each beat now commits
  `working_action` (+ `preparation_from` for Quick releases) alongside its verb — the playable
  layer per Ch1 pp. 350-351 — and Stage B plays the verb THROUGH the scored motor. Emergence
  preserved: still no tempo field anywhere; the motor is table-work, exactly as the actor path
  (`ActorBeatPlan`) already does.

### 6.4 Changed surfaces

- `src/generator.ts` — v2 system prompt: per-kind tempo-arc table REMOVED → "Range of the
  placement" section (derives Stable/Remote/Adream mechanically from attitude×aspect×stress);
  tempi listed in cadence order (D4 wired); palette header reframed as audience-read; self-check #2
  rewritten (will-or-flow); Stage A x-channel line de-tempo'd; kernel rule 12 de-arc'd; Stage A/B
  motor scoring (BeatPlan.working_action/preparation_from + prompts + parser + declared_beats).
- `src/actor-memory.ts` — `placementRangeBlock` added to the ACTOR pack only (Director untouched,
  kept forensic); actor-memory-v2.
- `third_party/mirodan/GROUNDED-FINDINGS.md` — §11 (Action-Attitude formation rule), §12 (variety
  canonical + Spell Sustained signature + instrument-sync note), citation log entries.
- Locked voice spec (`src/voice/infinex.ts`): **zero changes.**
- `scripts/tempo-eval.ts` (new) + `research/tempo-eval/{before,after,after2,after3}/` artifacts.
- Tests: 285/285 pass (the 8 "failed" files are this branch's pre-existing untracked harness/lib
  files with no vitest suites). `npx tsc --noEmit` clean apart from pre-existing
  emit-platform-pr.test.ts errors from the branch's unrelated in-flight work.

### 6.5 Follow-ups (named, not done) — [AMENDED per operator adjudication]

1. ~~Sync classifier Weight rule into Director~~ **WITHDRAWN** — Director is senior. Replacement:
   calibrate the v2 classifier against a known-answer sample set (its certain/self-contained
   gravity may be trap-2 over-correction). Until then, classifier distributions are directional
   only.
2. If Adream/Remote *primaries* are wanted (not just Adream/Remote beat texture inside
   commanding/practical posts), test non-launch card kinds — all 5 eval cards are launch
   announcements, the most Stable-native genre.
3. Re-test on the actor/harness path (`scripts/run-actor-director-card.ts`) — all measurement here
   is the CLI two-call generator; the actor path got the range block but no measurement run.
4. `eval/permutation-prompts*/` snapshots are stale captures of the old prompt; regenerate on next
   eval run.
