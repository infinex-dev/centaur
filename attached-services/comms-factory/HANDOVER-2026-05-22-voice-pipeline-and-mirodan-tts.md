# Handover - voice pipeline redesign + Mirodan TTS

**Date:** 2026-05-22
**Context:** user is trying to build a Laban/Mirodan-derived brand voice system for AI-generated comms. The current system has strong placement/motor vocabulary, but generated sentences still feel AI because they often lack the broader human/contextual layer the operator already knows.
**Read first:** `PLAN-holistic-generator.md`, `research/mirodan-actor-process.md`, `src/voice/infinex.ts`, `src/generator.ts`, `src/card.ts`.

---

## 0. TL;DR

There are two live threads:

1. **Comms voice generator redesign.** The current generator starts too late in the actor process. It has Laban placement, tempi, and motors, but it skips Stanislavski/Mirodan table-work: Given Circumstances, Super-Objective, Through-Action, Obstacle, Lining, and transitive verb per beat. That is why it can sound technically on-spec but context-thin or AI-like.
2. **Mirodan audio/TTS job.** A rough PDF-to-TTS extraction exists. A separate Chapter I gold TTS manuscript has now been generated and spot-checked, but it should still get a short ElevenLabs proof listen before spending credits on the full chapter render.

Do not treat the rough Chapter I extraction as "good looks like." It is a scaffold. The gold Chapter I file is the current proof candidate.

---

## 1. What we diagnosed in the voice system

The existing pipeline shape is right:

```text
release event -> release card -> generator -> validator -> orchestrator -> renderer -> ship gate
```

Do not redesign that. The failure is not the pipeline contract. The failure is the **artifact passed into the generator**.

Current generator input:

```text
ReleaseCard + voice placement + pre-assigned beat sequence + deployed_facts
```

This gives the model:

- what facts it can say
- which brand character it is
- what tempi/motors to use
- roughly how to sequence the post

But it does not give the model:

- what the moment means
- what reader prior it is landing against
- what the character is trying to do in this scene
- what the surface announcement is covering underneath
- what transitive verb each beat is playing

Mirodan/Stanslavski implication: the actor never starts with "be Pressing" or "be Commanding." The actor starts with the scene. They know what they want, what is true, what is in the way, and what hidden action runs under the visible one. The motor falls out downstream.

For comms, that means:

```text
fact grounding -> release card -> inner-work card -> generator -> validator -> audit -> orchestrator -> ship gate
```

The new **inner-work card** is the missing bridge.

---

## 2. The Bridge.xyz example

Trigger card: `01KS6QJNEGFYP6X048V8Y900DM`, Bridge.xyz fiat deposit, `split`.

Observed failure:

The generator kept restating the mechanic: fiat comes in, USDC comes out, deposit instructions, Bridge integration, rails.

Operator's real point:

The wall between fiat and crypto used to be load-bearing. With this release, that wall stops existing inside an Infinex account.

This is the difference:

```yaml
outer_action: "announce Bridge.xyz fiat deposits are live"
not_the_point: "Bridge integration, rails, deposit instructions"
reader_prior: "fiat comes from banks, crypto lives in wallets"
through_action: "to reveal that the bank wall just dissolved inside one account"
obstacle: "reader expects another fintech partnership announcement and will skim if framed as rails"
lining: "on the surface: a new fiat deposit rail. underneath: the bank-vs-wallet wall just stopped existing for Infinex users."
```

Important answer to the user's question, "where does `reader_prior` come from?":

`reader_prior` is **not** a deployed fact and should not be asserted as fact. It is the proposed **Obstacle**: the default belief or genre expectation the post must land against. It can come from:

- operator declaration
- an upstream grounder/model proposal approved by the operator
- observed reader/category defaults in the harness

It belongs in the inner-work layer, not in `card.deployed_facts`.

---

## 3. What "interview" means here

The user asked whether this becomes "something interview or what?"

Answer: yes, but not a loose interview. It should be a compact dramaturgical intake that produces structured fields.

For each release, ask or infer:

```yaml
given_circumstances:
  - what actually shipped
  - who can use it
  - what changed from yesterday

surface_outer:
  - what the announcement is literally about

not_the_point:
  - the boring/mechanical framing to avoid

reader_prior:
  - what the reader currently assumes
  - what category/default frame they will bring

through_action:
  - "to <verb> <object>"
  - what this post is doing toward the brand Super-Objective

obstacle:
  - what stops that action from landing

lining:
  - "on the surface, X; underneath, Y"

beat_plan:
  - tempo
  - transitive verb
  - micro-objective
  - local obstacle
  - shadow/leak, if useful
```

This can begin as three human-filled fields on the card:

```ts
through_action: string;
obstacle: string;
lining: string;
```

Later, a grounder can propose them and the operator approves or edits.

---

## 4. Where it fits in the observability loop

The harness should not only show final candidates. It should show the **chain of interpretation** before the words.

Recommended observable chain:

```text
release event
  -> fact-grounder output
  -> ReleaseCard
  -> InnerWork
       - thesis
       - given circumstances
       - super-objective link
       - through_action
       - obstacle / reader_prior
       - lining
       - beat plan: tempo + transitive verb + micro-objective
  -> generated candidates
  -> regex validator result
  -> LLM performance audit result
  -> operator edits
  -> selected pick
  -> rendered artifact
  -> human ship gate
```

Persist these artifacts separately. The useful observation is often not "candidate text bad." It is "the lining was wrong" or "the obstacle was too generic" or "the beat verb was not playable."

This matters because text edits are downstream. If the thesis is wrong, editing the sentence rarely fixes it. The operator needs to edit the inner-work artifact and regenerate.

---

## 5. Validator vs audit

Do not collapse generator and validator.

Keep `src/validator.ts` regex/heuristic only:

- cliches
- AI slop terms
- listicle voice
- antagonism
- claimed palettes
- fact drift when implemented

Add a separate **performance audit** after generation:

```text
candidate -> LLM audit -> advisory score + notes
```

This audit is allowed to be judgment-based because it is not the validator. It is a director's note layer. Suggested score:

- Lining visibility: 0-3
- Through-action executed: 0-3
- Verb/tempo coherence: 0-3
- Obstacle engagement: 0-3

Hard floor can be 8/12 before showing to operator, or simply sort by audit score at first.

---

## 6. How I would build it

### Phase 0 - Add Super-Objective to the voice spec

File: `src/voice/types.ts`

Add:

```ts
super_objective: string;
super_objective_examples: string[];
```

File: `src/voice/infinex.ts`

For Infinex:

```ts
super_objective: "to dissolve the walls between a user and the financial system - quietly, definitively, one wall at a time",
super_objective_examples: [
  "spot Hyperliquid in Infinex dissolves the wall between wallet and venue",
  "AI-augmented yield dissolves the wall between portfolio and strategy",
  "swidge / cross-chain dissolves the wall between chains",
],
```

### Phase 1 - Extend the release card with inner-work fields

File: `src/card.ts`

Add optional first, required later:

```ts
through_action: z.string().min(1).optional();
obstacle: z.string().min(1).optional();
lining: z.string().min(1).optional();
reader_prior: z.string().min(1).optional();
not_the_point: z.string().min(1).optional();
```

Keep `deployed_facts` as the only assertable fact source. The new fields guide interpretation, not claims.

### Phase 2 - Split generator into two model calls

File: `src/generator.ts`

Call A: inner work.

Input: card + voice + facts.

Output:

```ts
interface InnerWork {
  thesis: string;
  through_action: string;
  obstacle: string;
  reader_prior?: string;
  lining: string;
  beat_plan: {
    tempo: TempoName;
    verb: string;
    micro_objective: string;
    obstacle_local: string;
    shadow_move?: string;
  }[];
}
```

Call B: drafting.

Input: card + voice + `InnerWork`.

Output: existing `Candidate[]`.

The beat sequence should become emergent from the inner-work call. `defaultBeatsForKind()` becomes a fallback/hint, not the main driver.

### Phase 3 - Add performance audit

New module, likely `src/audit.ts`.

This should not gate facts or slop. It scores whether the performance earns the declared interpretation.

### Phase 4 - Harness UI

Surface:

- card facts
- inner-work fields
- beat plan
- candidate text
- validator failures
- audit scores
- operator edits at each layer

The harness metric should track operator agreement per layer, not just final text agreement.

### Phase 5 - Grounder proposes inner work

Extend the existing fact-grounder/card-builder path so the model proposes `through_action`, `obstacle`, and `lining`. The operator approves them before generation.

---

## 7. Voice loop / ElevenLabs note

The user's Claude + ElevenLabs voice loop used a voice likely referred to in-session as **Adam**. If continuity matters, use ElevenLabs voice id:

```text
pNInz6obpgDQGcFmaJgB
```

Do not spend credits until a proofed text sample is ready. The right flow is:

```text
PDF -> raw pdftotext extraction -> clean main-text transcript -> proofed TTS manuscript -> 5-10 min audio proof -> pronunciation/tempo fixes -> chapter render -> stitched audiobook
```

---

## 8. Mirodan TTS current state

Source PDF:

```text
/Users/opaque/Downloads/Mirodan-PhD-1997-Vol2.pdf
```

Raw extraction:

```text
/Users/opaque/Downloads/mirodan-tts/mirodan-vol2.raw.txt
```

Cleaning script added:

```text
scripts/prepare-mirodan-tts.mjs
```

Current generated rough outputs:

```text
/Users/opaque/Downloads/mirodan-tts/clean/mirodan-vol2-clean-transcript.md
/Users/opaque/Downloads/mirodan-tts/clean/mirodan-vol2-tts-narration.md
/Users/opaque/Downloads/mirodan-tts/clean/chapters/01-chapter-i-basic-concepts.md
/Users/opaque/Downloads/mirodan-tts/clean/manifest.json
```

Gold Chapter I TTS manuscript:

```text
/Users/opaque/Downloads/mirodan-tts/gold/chapter-01-basic-concepts.tts.md
/Users/opaque/Downloads/mirodan-tts/gold/chapter-01-basic-concepts.tts.txt
```

Rough full TTS narration stats from manifest:

```text
434,850 chars
70,285 words
~7.8 hours at 150 wpm
~217,425 ElevenLabs credits at 0.5 credit/char
~434,850 ElevenLabs credits at 1 credit/char
```

Current rough Chapter I file:

```text
/Users/opaque/Downloads/mirodan-tts/clean/chapters/01-chapter-i-basic-concepts.md
```

Latest measured Chapter I rough stats:

```text
23,583 words
144,245 chars
~2h37m at 150 wpm
~2h48m at 140 wpm
~72,123 ElevenLabs credits at 0.5 credit/char
~144,245 ElevenLabs credits at 1 credit/char
```

Original quality warning on the rough file:

The rough Chapter I extraction was **not ready** for TTS as a "good looks like" sample. Spot checks found:

- footnote fragments spliced into the main argument
- page-transition joins that changed meaning
- citation ghosts: `op. cit. p.`, `cf.`, `Tapes:`, `pp.`
- OCR typos: `froi`, `enerqy`, `primwaz`, `e,pression`, `Malingren`, `Ma].mgren`
- malformed quotation punctuation
- diagrams/tables sometimes flattened into unlistenable paragraphs

Current gold Chapter I stats:

```text
22,916 words
141,460 chars
~2h33m at 150 wpm
~2h44m at 140 wpm
~70,730 ElevenLabs credits at 0.5 credit/char
~141,460 ElevenLabs credits at 1 credit/char
```

The gold file converts the flattened Grand Equation, Elements, Inner Quests, Working Actions, and Effort Cube material into spoken prose, restores a missing Flow continuation, and removes the known citation/OCR debris. Do not overwrite the rough extraction; it remains useful as a comparison scaffold.

Proofing passes:

1. Structural pass: remove footnotes, diagrams, page headers, image captions; preserve main prose and meaningful lists.
2. Text pass: fix OCR, page joins, quote punctuation, citation ghosts.
3. Read-aloud pass: inspect beginning/middle/end, then create a 5-10 minute ElevenLabs proof before rendering the full chapter.

For "accurate representation of what good looks like," use the gold Chapter I file, then do a 5-10 minute ElevenLabs proof listen before rendering the full 2h40m-ish chapter.

---

## 9. Immediate resume instructions

If resuming the comms voice redesign:

1. Implement Phase 0 and Phase 1 from this handover.
2. Re-run the Bridge.xyz card.
3. Compare whether candidates name the dissolved wall, not just the rail.
4. Do not alter validator architecture.

If resuming Mirodan Chapter I proofing:

1. Treat `clean/chapters/01-chapter-i-basic-concepts.md` as rough only.
2. Continue from `gold/chapter-01-basic-concepts.tts.md`.
3. First listen-proof a 5-10 minute ElevenLabs sample.
4. If the sample exposes pronunciation or punctuation issues, patch `scripts/prepare-mirodan-tts.mjs` and regenerate.
5. Spot-check first 10 minutes, middle 10 minutes, and final 10 minutes before calling it ready.
