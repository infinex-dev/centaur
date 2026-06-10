# Generator tempo-handling audit — 2026-05-25

Auditing `src/generator.ts` (commit `eb9ddf6`, 874 LOC of two-call Phase 2 code) against
Mirodan's "tempo is emergent from Deciding, never assigned" principle (per
memory `methodology-actor-table-work-before-drafting.md`).

## Verdict (one sentence)

**Tempo is CHOSEN up-front by the LLM in Stage A, not derived from inner work.**
The `beat_plan: BeatPlan[]` artifact has `tempo` as a top-level field the model
fills in directly alongside `verb`/`micro_objective`/`obstacle_local`, with no
deterministic mapping from verbs → tempi and no Stage B verification that the
chosen tempo is consistent with the rest of the beat content.

---

## Q1 — What does Stage A output?

Stage A (`generateInnerWork`, `src/generator.ts:634-664`) outputs an `InnerWork`
object whose `beat_plan` is a list of `BeatPlan` entries. Each `BeatPlan` has:

```
src/generator.ts:79-85
export interface BeatPlan {
  tempo: TempoName;        // declared up-front, peer of verb
  verb: string;            // "to reveal" / "to land" / "to invite"
  micro_objective: string;
  obstacle_local: string;
  shadow_move?: string;
}
```

`tempo` and `verb` are **siblings**, both filled in by the model in a single
JSON emission. There is no field for `inner_action`, no field for `working_actions[]`,
no field for `deciding_mode`. The model emits the tempo label literally, the
same way it emits the verb literally.

The Stage A prompt explicitly asks for the tempo (`src/generator.ts:818-826`):

```
"beat_plan": [
    {
      "tempo": "<one of the voice's available tempi>",
      "verb": "to <transitive verb> — what this beat consciously plays",
      ...
    }
  ]
```

So: **Stage A outputs `tempo` directly per beat. It does NOT derive tempo from
verb-actions; it declares both.**

## Q2 — Is tempo selection constrained such that inner-work makes it emergent?

Partially. The Stage A prompt does scaffold the model toward considering inner
work first (`src/generator.ts:728-742`), saying *"the actor never starts with a
motor. They start with the scene… Only after this is committed do they choose
verbs and tempi."* The prompt orders the JSON output with thesis/through_action/
obstacle/lining BEFORE `beat_plan` (`src/generator.ts:811-828`), and the
docstring at `src/generator.ts:66-70` claims *"Tempo is emergent from inner
work, not pre-assigned."*

But there is **no structural constraint** that forces this. The model can emit
any combination of `(thesis, verb, tempo)` it likes; nothing programmatically
checks that the chosen tempo is consistent with the verbs/inner action. The
prompt is the only guarantor, which is exactly the failure mode the
two-stage split was supposed to *prevent* (the generator can rationalize
its way into a tempo just as easily as it can rationalize its way into a draft).

Beat count is hard-constrained per channel (`src/generator.ts:779-788`), but
tempo selection within that count is open. The prompt does tilt toward
cadence-weighted selection (`src/generator.ts:768-775`), which makes the
chosen tempo statistically character-coherent — but it is still **chosen**, not
derived.

The strongest constraint is `src/generator.ts:789`:
> *"Tempi: pick FROM the voice's available tempi (listed above)."*

That's an allowed-set guard, not an emergence guard.

## Q3 — Does Stage B use tempo as a constraint, or verify post-hoc?

**Stage B uses tempo as a hard constraint, not as a post-hoc check.** The
Stage B prompt (`src/generator.ts:962-971`) feeds the model the declared tempo
+ motor pair per beat and instructs:

```
src/generator.ts:1008-1009
"- Each paragraph must play its declared TRANSITIVE VERB. The verb is what the
  actor consciously does; the tempo's motor (e.g., pressing→punching) is the
  dynamic carrier."
```

There is **zero verification logic** in Stage B that the produced prose actually
expresses the declared tempo. `parseDraftResponseWithBeatPlan`
(`src/generator.ts:1043-1065`) just copies the `innerWork.beat_plan` tempi
verbatim onto `candidate.declared_beats`. No classifier runs. No motor-vocabulary
audit. The validator may catch tempo drift via `beat-tempo-fit` rule (referenced
in `src/__tests__/generator.test.ts:103`), but that is downstream of the
generator and outside this audit's surface.

So: **the chosen tempo flows from Stage A → Stage B → candidate without
deterministic verification.** The generator trusts its own Stage A pick.

## Q4 — Role of `motor_pair` (Sustained-prep → Quick-release)

Motor pairs live on the `Tempo` interface as `motor: [WorkingAction, WorkingAction]`
(`src/voice/types.ts:114-137`). They are **voice config**, not generator-derived
artifacts. The system prompt surfaces them as guidance:

```
src/generator.ts:298
parts.push(`Motor: ${t.motor[0]} → ${t.motor[1]} (preparation → release)`);
```

And the Stage A prompt enforces a preparation-hierarchy rule in
`src/generator.ts:790`:
> *"Preparation hierarchy: if you pick a multi-beat plan with a Sus→Q tempo… the Sus prep tempo must be earned before it."*

The hierarchy is a **selection-level structural rule**, again enforced via
prompt, not via code. The motor pair never feeds back into beat construction —
it's a reference list the model is supposed to read and obey.

The legacy `beats[]` path uses motor pairs the same way
(`src/generator.ts:418-422`), as a display string in the prompt. They are
**descriptive, not derivational**.

## Q5 — Any verb-actions → tempo deterministic mapping?

**No.** Searched the file end-to-end. There is:

- No function like `tempoFromVerbs(verbs: WorkingAction[]): TempoName`
- No table mapping verb sequences → tempi
- No constraint that the `verb` field must align with the tempo's motor vocabulary
- No validator hook called from inside the generator that classifies the
  declared beat plan against the spec

The only "tempo-shape" awareness is the prompt-side preparation-hierarchy
guidance (`src/generator.ts:308-320`) — *"Pressing → Punching · Wringing →
Slashing · Gliding → Dabbing · Floating → Flicking"* — which is told to the
model in English. The model is trusted to obey it.

`scripts/classify-corpus.ts` (per memory `verifier-is-gold-standard.md`) is the
canonical verb → tempo classifier, but **it is not wired into the generator at
all**. It runs offline on corpus samples.

## Q6 — What do the tests expect?

Tests (`src/__tests__/generator.test.ts:107-214`) check **declaration
fidelity**, not emergence:

- `:131-145` — Stage A picks tempi from the voice's allowed set (allowed-set guard, same as the prompt rule)
- `:147-168` — Stage B's `declared_beats` match `innerWork.beat_plan` tempi positionally (passthrough check)
- `:170-180` — Default path goes Stage A → Stage B (routing check)
- `:182-198` — Pre-computed `innerWork` honored (cache-skip check)

The only test that touches tempo-vs-prose coherence is `:75-105`
(`"keeps compact multi-beat stubs classifiable by the selected voice"`), which
runs the validator on the generated stub text and asserts `beat-tempo-fit`
**does not appear in failures**. That is downstream-validator territory — and
notably uses the stub path, which assembles candidates from
`tempo.example_lines` (`src/generator.ts:546-553`), so passing it only proves
the example library matches its own tempi. It does **not** prove a Stage A LLM
pick was emergent from inner work.

**No test asserts that beat_plan tempo is consistent with the chosen verb /
micro_objective / obstacle_local.**

---

## Where tempo first gets assigned in the Stage A flow

`src/generator.ts:820` — the JSON template in the Stage A user prompt:
```
"tempo": "<one of the voice's available tempi>",
```
…which the model fills in directly. Parsed at `src/generator.ts:855`:
```
tempo: beat.tempo as TempoName,
```
Cast straight from `beat.tempo` (a JSON string) with no derivation, no
verification, no mapping from upstream fields.

## Divergence from Mirodan's "tempo emerges from Deciding"

Mirodan's claim (per the operator's memory entries on tempo-locked /
actor-table-work / framework-as-diagnostic): tempo is the **outer phenomenon**
of an Inner Attitude + Stress + Drive combination running through Deciding.
The character chooses an inner action ("to reveal", "to refuse"), commits to
working-actions (pressing → punching, etc.), and the resulting tempo is
classifiable from the motor sequence. Tempo is **read off** the Deciding, not
declared before it.

The current code inverts this: the model declares `tempo` and `verb` as
**siblings**, in the same JSON object, in the same generation pass. The prompt
asks for thesis/through_action/obstacle/lining first (`src/generator.ts:811-817`),
which is good — but `beat_plan` is part of the same JSON object and is
generated in one shot. There is no point at which the verbs are committed and
the tempo is *then* derived. There is no point at which the working-action
sequence is named and the tempo is *then* classified.

In Mirodan terms, this is "pre-assigning the motor" — the same failure mode the
operator flagged in the `methodology-actor-table-work-before-drafting` memory:
*"pre-assigned tempi without inner cause read as paint-by-numbers slop."*

The Stage A prompt knows this (it literally says "the actor never starts with
a motor" at `src/generator.ts:731`), and the docstring at `:66-70` *claims* tempo
is emergent, but the implementation contradicts both. The model is asked to
both plan AND name the tempo simultaneously, which is the same epistemics as
single-call.

## Minimum-viable fix if tempo is being chosen incorrectly

Three options, ordered cheap → expensive:

**1. Strip `tempo` from Stage A; add a deterministic tempo-derivation pass.**
Stage A emits beat_plan with `verb` + `working_actions: [WorkingAction, WorkingAction]`
+ `micro_objective` + `obstacle_local`, no `tempo`. After Stage A returns, a
new function `deriveTempoFromBeat(beat, voice)` looks at `working_actions` and
matches against `voice.tempi[*].motor` to find the unique tempo. If multiple
match (or none match), Stage A retries with the ambiguity surfaced as feedback.
Tempo is then **read off** the working-actions, classifier-style, before Stage B
sees the plan. ~80 LOC of new code, no LLM round-trip added, but requires
extending the prompt to demand working_actions instead of tempo.

**2. Split Stage A into A1 (inner work + verbs) and A2 (tempo classification).**
A1 emits thesis/through_action/obstacle/lining/beat_plan-with-verbs-only. A2
takes A1's output and classifies tempi from the verbs, using the same
`scripts/classify-corpus.ts` classifier the operator already considers
gold-standard (per `verifier-is-gold-standard.md`). Adds one LLM call per
release if A2 is LLM-driven, but enables true emergence by structurally
separating "what is the actor doing" from "what is the tempo of doing it".
Aligns with the lean-upstream/fat-downstream principle (memory:
`methodology-lean-upstream-fat-downstream.md`).

**3. Keep Stage A as-is but add a verification gate.**
After Stage A, run the classifier from `scripts/classify-corpus.ts` against
the declared beat_plan's verb/inner-work to check whether the declared tempo
is one the classifier would have chosen. If divergence > threshold, retry
Stage A with the divergence surfaced as feedback. Lighter touch but
half-measure — the model still chooses the tempo first, the gate just
catches obvious misroutes. **Best as a near-term scar-tissue layer while
option 1 or 2 is built.**

The operator's verifier-is-gold-standard memory points at option 2 as the
right shape: use the same classifier that grades corpus samples to grade
generator output, mid-pipeline.
