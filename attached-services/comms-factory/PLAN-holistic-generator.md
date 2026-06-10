# Holistic generator — Mirodan actor-process redesign

**Status:** plan, 2026-05-22. Pre-implementation.
**Trigger:** card `01KS6QJNEGFYP6X048V8Y900DM` (Bridge.xyz fiat deposit, `split`) — every candidate restated the mechanic ("fiat in, USDC out, here are the rails") instead of naming the dissolved wall. Operator: "i thought the laban character wanted to bring down walls. the connection to fiat and crypto were two silo'd walls. now they exist within your infinex account."

**Diagnosis:** the generator skips Stanislavski-inheritance table-work and starts mid-process. It receives placement + pre-assigned beat sequence + deployed_facts. It is missing the catalytic layer — Super-Objective, Given Circumstances, Through-Action, Obstacle, Lining — that makes inner work *cause* outer motor in the first place. Tempo without that catalyst is choreography, not performance.

See companion: `research/mirodan-actor-process.md` (canonical Mirodan flow with quotes/refs).

---

## Part 1 — How an actor actually generates a performance

From Mirodan, pp. 267–566. Nine sequential phases, each producing a structured artifact for the next.

### Phase 1 — Table work (Stanislavski inheritance, p. 267, 282, 306, 317)

The actor never starts with a motor. They start at the table, reading the play. Before any physical work:

1. **Given Circumstances.** What is true in the world of the play right now. The factual situation the character is dropped into.
2. **Super-Objective.** What the character *always* wants across the whole arc. Stanislavski's "the spine."
3. **Through-Action.** What the character is pursuing in *this* scene toward that super-objective. A transitive verb chain.
4. **Obstacle.** What stands in the way of the through-action right now. Another character, a circumstance, an inner counter-force.
5. **Receptive emotional-neutrality (p. 267).** The actor approaches *without* a pre-chosen emotion. Emotion will arise from inner work; if pre-imposed, it's pasted-on.

Mirodan inherits this from Stanislavski without modification. The Laban frame is applied *on top of* table work, not in place of it.

### Phase 2 — Locate the dominant Inner Attitude (p. 282–306)

Only three Inner Attitudes can be *baselines*: **Stable, Near, Adream**. Mobile, Remote, Awake are **Action Attitudes** — outer projections that fire under stress, never resting states.

The actor identifies the baseline by elimination through Drives — what cannot the character do? What language does she never use? The remainder narrows.

### Phase 3 — Pin Aspect + Dominant Stress (the Diagram)

Within a baseline, the character has:
- **Aspect** (fixed): which Inner Participation is emphasized — Enclosing (Intending), Penetrating (Attending), Circumscribing (Deciding), Radiating (Adapting).
- **Dominant Stress** (mostly fixed): one of the two stresses available to the baseline.

These together land on a specific **Diagram A/B/C/D** within that baseline. The Diagram determines the available Drive cocktail.

Infinex sits at: Stable / Penetrating / Flow-stress (bound pole) / Diagram D (Spell-Vision).

### Phase 4 — Specify Outer Action Attitudes + Lining (p. 357)

This is the load-bearing finding our pipeline missed.

- **Outer Action Attitudes.** What the character DOES — visible, what other characters see. Derived deterministically from Inner+Stress.
- **Lining.** The *hidden* Inner Action the Outer covers or lies about. Always present. Always different from the Outer.

> "Outer/Lining gap is the engine of dramatic life." (p. 357)

Without a declared Lining, the performance is flat — the audience reads the Outer at face value and there's no second register. The Lining is what generates *interestingness*. In comms terms: the Lining is what makes the post say something *underneath* what it says on the surface.

For our Bridge.xyz example:
- **Outer Action**: announce that fiat deposits via Bridge.xyz are live.
- **Lining**: the wall between fiat and crypto, which has been load-bearing for a decade, just stopped existing inside one specific account.

A post that delivers only the Outer is a press release. A post with a working Lining is comms.

### Phase 5 — Break the scene into beats (p. 470)

**Mirodan's vocabulary diverges from Stanislavski here.** A "beat" in Mirodan is a within-scene **Variation × Stress × Aspect-emphasis** switch, not a unit boundary. Characters typically use 3-of-4 Variations and switch between both available Stresses across a scene. Beats are *modulations within* the fixed Inner Attitude — the character doesn't change *who they are*, but *which axis is firing* shifts.

A post is therefore a beat sequence — but the sequence is *generated from the Through-Action and Obstacle*, not pre-assigned by card kind.

### Phase 6 — Inner loop per beat: Adapting → Sensing → Deciding → Thinking (p. 284, 286)

Within each beat, the actor runs an organic inner cycle:

1. **Adapting (Feeling).** The character feels into the moment.
2. **Sensing.** They orient — what's present, what's pressing.
3. **Deciding** — the **primum mobile** (p. 284). Subconscious. Pre-selects which Inner Participations engage with the Objective.
4. **Thinking.** The conscious processing surfaces only after Deciding has already chosen.

> Tempo is "the physical realization of the Inner Participation of Deciding." (p. 286)

**This is why tempo cannot be assigned.** Tempo is the *output* of Deciding, not an input. If the actor pre-imposes a tempo without inner cause, the audience nervous system reads "inconsistent movement" — the Carpenter "threat-of-an-enemy" signal (p. 356). Comms equivalent: AI slop. The reader can't articulate it, but their nervous system flags incoherence.

### Phase 7 — Translate to Working Action + Shadow Move (p. 347, 349, 351)

Out of the inner loop falls a **Subconscious Motif** — a 3-axis cocktail (Effort qualities). The actor then chooses:

- A **Working Action** — the visible motor (Pressing, Punching, Gliding, Dabbing, Floating, Flicking, Wringing, Slashing). But the actor doesn't *play* "punching":
  > "'Punching' can't be acted. 'To box' can." (p. 351)
  The actor plays a **transitive verb** — to box, to seduce, to disarm, to reveal — that *fits* the Working Action her Subconscious Motif generated.
- A **Shadow Move** — involuntary, leaks the Lining. The body does one thing while the conscious action does another. Where Outer/Lining gap becomes visible to the audience.

**Preparation hierarchy is load-bearing.** Punch needs Pressing-prep (sustained build), Slash needs Wringing-prep, Dab needs Gliding-prep, Flick needs Floating-prep. Voice carries Working Actions as much as body — prose without prep reads as released-without-buildup, which is exactly the "AI hype-burst" smell.

### Phase 8 — Rehearsal iteration (p. 562–566, 570)

Productive ambiguity held across rehearsals. Actor tries, gets relational feedback from cast and director, adjusts. Never one-shot.

### Phase 9 — Performance of one beat

= Working Action (conscious — the verb being played) + Shadow Move (involuntary — leaking the Lining). Tempo emerges as the audience's read of the resulting movement.

---

## Part 2 — Where our generator is in this flow

| Phase | Mirodan artifact | Our pipeline has it? | Notes |
|---|---|---|---|
| 1a | Given Circumstances | ⚠️ Partial | Card holds `deployed_facts` (the raw situation) but no situational frame. |
| 1b | Super-Objective | ❌ Missing | Should live on the voice spec — Infinex's super-objective is implicit in the character image (dissolve walls between user and crypto/finance; bring craft to wild markets) but never *declared* as a structured artifact the generator can reason against. |
| 1c | Through-Action | ❌ Missing | Per-card. Should be operator-declared OR derived by an upstream stage. Currently: absent. |
| 1d | Obstacle | ❌ Missing | The reader's prior, the genre default, the competitor frame. Critical: the obstacle is what gives the Working Action something to *land against*. |
| 1e | Receptive neutrality | n/a | Prompt-discipline concern; current prompt is fine here. |
| 2 | Inner Attitude | ✅ Present | `voice.inner_attitude = "stable"`. |
| 3 | Aspect + Stress + Diagram | ✅ Present | `voice.aspect = "penetrating"`, `stress = "flow"`, `drive_axis = "Spell-Vision (Diagram D)"`. |
| 4a | Outer Action Attitudes | ✅ Present | Encoded as the 12 available tempi in `voice.tempi`. |
| 4b | **Lining** | ❌ **Missing** — load-bearing | The gap between Outer and Lining is "the engine of dramatic life" (p. 357). Our pipeline has no concept of Lining. This is the single biggest gap. |
| 5 | Beat sequence | ⚠️ Present but pre-assigned | `defaultBeatsForKind(card.kind)` hands the model `[sombre, commanding, irradiant]` for any split card. Beats should emerge from Through-Action + Obstacle, not from card.kind. |
| 6 | Inner loop (Adapting→Sensing→Deciding→Thinking) | ❌ Missing | No upstream stage where the model runs inner work before drafting. |
| 7a | Working Action / motor | ✅ Present | `tempo.motor: [WorkingAction, WorkingAction]`. |
| 7b | **Transitive verb per beat** | ❌ Missing | We hand the model "commanding (pressing→punching)" — a motor. We never hand it "to reveal" or "to disarm" — the verb the actor would consciously play. The `hint` field is freeform and rarely populated. |
| 7c | Shadow Move | ❌ Missing | No vocabulary for the involuntary Lining-leak. (Less urgent than #4b — Shadow Move follows from declared Lining.) |
| 8 | Iteration | ⚠️ Partial | Harness supports operator review; generator has a retry-with-feedback loop. But no structured "rehearsal" stage where the model critiques its own draft against the Through-Action. |
| 9 | Final beat | ✅ Present | The text comes out. |

**Net diagnosis.** Of 9 phases, we implement {2, 3, 4a, 7a, 9} — character placement and motor mechanics. We *skip* {1b, 1c, 1d, 4b, 6, 7b} — every catalytic layer that turns placement into performance. The generator is being asked to perform without preparation work. The result is exactly what an actor's performance looks like in the same condition: dynamically competent, dramatically inert.

---

## Part 3 — Actionable plan

Phased. Each phase produces a working artifact that can be tested in isolation.

### Phase 0 — Brand-level Super-Objective (one-shot, ~1 hour)

Add to `src/voice/types.ts` `CharacterSpec`:

```ts
super_objective: string;  // standing transitive-verb description of what the character ALWAYS wants
super_objective_examples: string[];  // 2-3 worked examples of how the SO shows up in different events
```

Set on `INFINEX_VOICE`:

```ts
super_objective: "to dissolve the walls between a user and the financial system — quietly, definitively, one wall at a time",
super_objective_examples: [
  "spot Hyperliquid in Infinex: dissolves the wall between wallet and venue",
  "AI-augmented yield: dissolves the wall between portfolio and strategy",
  "swidge / cross-chain: dissolves the wall between chains",
],
```

This is operator-declared (you), not generated. Lives in the voice spec because it's a property of the character, not the release.

**Test:** generator prompt now includes the SO. Re-run the Bridge.xyz card. Does *any* candidate now name the dissolved wall? If yes, this single change is most of the lift.

### Phase 1 — Per-card Through-Action + Obstacle (card schema extension, ~2 hours)

Extend `Base` in `src/card.ts`:

```ts
through_action: z.string().min(1).describe(
  "transitive verb — what THIS post is doing toward the brand's super-objective. " +
  "Format: 'to <verb> <object>'. Examples: 'to retire the on-ramp app', 'to reveal that fiat already lives inside the account'"
),
obstacle: z.string().min(1).describe(
  "what stands in the way of the through-action landing. " +
  "Usually a reader-side prior, a genre default, or a competitor framing. " +
  "Examples: 'reader expects another bridge announcement', 'partner-launch posts default to thanks-and-CTA'"
),
lining: z.string().min(1).describe(
  "the hidden Inner Action the Outer covers. Outer/Lining gap is the engine of the post. " +
  "Format: 'on the surface, X; underneath, Y'. " +
  "Example: 'on the surface: a new deposit rail. underneath: the bank-vs-wallet wall just got quietly dissolved.'"
),
```

These are **operator-declared per card** initially. Later (Phase 4) a grounder LLM can propose them and the operator approves/edits.

For the Bridge.xyz card retroactively:
- through_action: "to reveal that the bank wall just dissolved inside one account"
- obstacle: "reader expects another fintech partnership announcement; will skim if framed as a rail"
- lining: "on the surface: Bridge.xyz fiat deposits are live. underneath: the wall between fiat banking and on-chain assets just stopped existing for Infinex users."

**Test:** re-run with these declared. The generator now has the catalytic layer.

### Phase 2 — Pre-beat inner work as an explicit generator stage (~half a day)

Refactor `src/generator.ts` `generate()` into two model calls:

**Call A — Inner work.** Model receives card + voice spec (with SO). Returns structured JSON:

```ts
interface InnerWork {
  thesis: string;             // the single declarative interpretation
  through_action: string;     // either inherited from card or refined
  obstacle: string;           // either inherited from card or refined
  lining: string;             // either inherited from card or refined
  through_line: {             // beat sequence proposed, not assigned
    tempo: TempoName;
    verb: string;             // TRANSITIVE — "to reveal", "to disarm", "to land", "to invite"
    micro_objective: string;  // what this beat is trying to make the reader feel/notice
    obstacle_local: string;   // what this beat is fighting against in the reader
  }[];
}
```

The model proposes the beats *from* the through-action + obstacle, constrained to the character's available tempi and respecting cadence. `defaultBeatsForKind` becomes a *fallback hint*, not a hard input.

**Call B — Drafting.** Model receives card + voice + the inner work from Call A. Generates the text — N candidates, each a multi-beat post where each paragraph plays its declared verb in its declared tempo.

This separation matters because:
- Single-call generators rationalize. Two-call generators have to *commit* to interpretation before drafting.
- The inner-work JSON is persisted to the harness DB. Operators can review the *interpretation* separately from the text. If the thesis is wrong, no amount of text editing fixes it.
- It mirrors the actor's table-work → drafting → performance separation.

### Phase 3 — Audit layer scores thesis-earning (~half a day)

Separate from the regex validator. Uses the existing `candidate_audits` table in the harness DB.

For each candidate, an LLM audit pass scores:

1. **Lining visibility.** Is the Outer/Lining gap detectable in the text? (Score 0-3.)
2. **Through-action.** Does the post execute the declared through-action, or does it restate the mechanic? (Score 0-3.)
3. **Verb-tempo coherence.** For each beat, does the prose play the declared transitive verb in the declared tempo's motor? (Score 0-3 per beat, averaged.)
4. **Obstacle-engagement.** Does the post *land against* the declared obstacle, or sail past it as if the obstacle isn't there? (Score 0-3.)

Total /12. Hard floor: 8/12 to pass to operator. Below that, retry with feedback. The audit is **judgment-grade**, not regex-grade — explicitly LLM-judged, explicitly outside the validator (which stays regex-only per pipeline contract).

Why this is OK against the "no LLM judges" rule:
- The rule's intent is that the *validator* — the gate that says yes/no on brand-agnostic slop — can't be an LLM judge, because LLMs rationalize and can't be tested.
- The audit is **performance scoring**, not slop gating. It's the *director's note* layer, not the brand-bouncer layer. It uses LLM judgment because that's the only thing that can judge thesis-earning.
- Audit results are *advisory and reviewable* — operator can override. Validator results are *gates*. Different role, different rule.

### Phase 4 — Grounder proposes inner-work fields (~half a day, optional)

After Phase 2+3 are working, add an *upstream* grounder stage that runs *before* the operator sees the card. Given the deployed_facts + voice spec, the grounder proposes:
- through_action
- obstacle
- lining

Operator approves / edits before the generator runs. Reduces operator burden from "fill three fields" to "approve three suggestions."

The grounder is already present for fact-grounding (see `src/grounder.ts` per project status); this extends its role.

### Phase 5 — Harness surfaces the full chain (~half a day, harness work)

Currently the harness shows: card → candidates → text edits.

After: card → **inner work** (thesis, through-action, obstacle, lining) → **beat plan** (tempo + verb + micro-objective per beat) → candidates → audit scores → text edits → final pick.

Operator can edit at *any* layer. If the thesis is wrong, edit it and regenerate downstream. Currently the operator can only edit the text — which is downstream of every actual creative choice and can't fix structural issues.

This is harness Phase 3 work (per CLAUDE.md status: "Phase 3 (persistence, diff capture, agreement metrics)") plus the visual treatment pass.

---

## Sequencing

| Phase | Effort | Unblocks |
|---|---|---|
| 0 — SO on voice spec | 1 hour | Most of the lift — immediate test |
| 1 — Card schema + through_action/obstacle/lining | 2 hours | Generator has the catalytic layer |
| 2 — Two-call generator with inner-work stage | half-day | Beats become emergent, not assigned |
| 3 — Audit layer for thesis-earning | half-day | Quality gate independent of slop validator |
| 4 — Grounder proposes inner-work | half-day | Operator burden drops |
| 5 — Harness shows full chain | half-day + design | Operator edits at the right layer |

**Recommended path:** Phase 0 + 1 same session — together they're the smallest viable change that puts the catalytic layer in front of the generator. Re-run Bridge.xyz, see if candidates start naming dissolved walls. If yes, schedule Phase 2 next session. Phase 3+ after Phase 2 is stable.

**Pitfall to flag.** This redesign moves work *upstream* (to the operator and the grounder). It will feel slower per-card. The payoff is that the text downstream stops being slop-shaped because every catalytic decision was made consciously before drafting. Same trade as actor table-work — slower in rehearsal, infinitely faster in performance.

---

## Open questions

1. **Should Lining live on the card or the voice spec?** Probably card — Lining is per-event ("THIS wall just dissolved"), not standing. Super-Objective is voice-spec ("dissolving walls is what Infinex always does"), Lining is the *specific wall* this release dissolved. Confirm before Phase 1.

2. **Is `kind` still load-bearing?** Once beats are emergent from through-action, `card.kind` becomes a *rendering hint* (which Remotion composition to use) rather than a *generation* hint. The default-beat-sequence function `defaultBeatsForKind` either deletes or downgrades to a fallback only.

3. **Does the operator need a Lining vocabulary?** "On the surface, X; underneath, Y" is a workable template. Worth piloting on 5–10 cards and seeing whether operators converge or diverge before formalizing.

4. **What's the regression test?** Probably: re-run the Bridge.xyz card + a Hyperliquid-spot card + the Trezor card retrospectively. Compare before/after candidates. Headline metric: does the post name something that *ends* / *dissolves* / *stops being* — i.e., does it have a Lining at all?

5. **Where do Mirodan's "Outer Action Attitudes" map to our tempi?** Cleanly — the 9 outer-only tempi (Mobile/Remote/Awake variants) are exactly Outer Action Attitudes; the 12 baseline tempi (Stable/Adream/Near variants) are baseline projections. Currently encoded but never explicitly distinguished in prompts. Worth surfacing the distinction so the model knows when it's playing an Outer projection vs. a baseline tempo.
