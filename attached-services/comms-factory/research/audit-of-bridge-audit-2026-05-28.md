# Audit of the Bridge.xyz Actor/Director Audit
**Date:** 2026-05-28
**Subject under review:** the Codex-prepared "Audit Brief" diagnosing the Bridge.xyz fiat-deposit card run as scene-level prompt contamination.
**Run ID:** `01KS6QJNEGFYP6X048V8Y900DM`
**Method:** parallel Explore agents loaded `actor-director.ts`, `actor-memory.ts`, `voice/infinex.ts`, `card.ts`, the run HTML, the handover, and the independent `audit-mirodan-2026-05-27.md`. Verified critical line numbers by direct read.

---

## Headline counter-verdict

Your brief argues:
> The current failure is probably not primarily validator logic. It is also not simply "Actor bad" or "Director bad." The immediate failure is scene-level prompt contamination.

That framing **half-fits the evidence**. Scene-level contamination is real and your specific lexical reads of attempt 4 are correct. But three things in the data don't survive the brief:

1. **The "wall" lexicon is locked in the voice spec, not just the card.** `infinex.ts:101` literally registers `"The wall between <A> and <B> has been load-bearing for <duration>."` as a Sombre opening shape. `infinex.ts:103–106` lists `"load-bearing"` and `"section by section"` as Sombre vocab anchors. Even with a clean scene prompt, Sombre would reach for that template. The Bridge card is the trigger, not the source.

2. **The run finished 2/2 on attempt 4. The independent Mirodan audit (`research/audit-mirodan-2026-05-27.md` §1) verdict is "PASS 2/2 — the copy is commercially usable; the audit loop is destroying it."** Your brief reads the wall language in attempt 4 as proof of failure; the Mirodan auditor reads attempt 4 as proof of recovery and says the Director's *intermediate* criteria are the contamination engine, not the card.

3. **The Bridge card's `through_action` is a verbatim copy of the schema docstring example at `card.ts:48`.** Whoever authored the card pasted the example phrasing — "to reveal that the bank wall just dissolved inside one account" is literally the example in the file. So "the scene prompt over-determines the metaphor" is structurally true, but the lever is *change the schema example*, not *rewrite this one card*. The next card kind will do the same thing if its docstring example is similarly load-bearing.

**Reframed verdict:** the Bridge run is not a scene-prompt failure. It is a *three-layer reinforcement* — schema example, voice-spec tempo vocab, and Director criteria oscillation — that collapses 30 candidates to ~5 image systems. Your scene-rewrite fix attacks one layer. The other two will keep firing.

---

## Where your brief is correct

Direct hits:

- **Retry contamination is real.** `actor-director.ts:295–298` appends Director notes to the prior transcript without resetting `through_action`. The instruction at line 470 — "Do fresh table work only where the notes prove the prior table work/performance failed" — is the loophole. The Director never explicitly told the Actor to throw out the wall frame, so the Actor preserved it across attempts.

- **Director legality is too close to quality.** `actor-memory.ts` legality logic accepts Commanding as legal-by-definition for Infinex. The handover author flags this directly ("the Director can read a line as Commanding and still pass it. The next question is not 'why did routing fail?' It is: what should selection prefer when several allowed tempi pass?"). Both the handover and the Mirodan audit converge on this.

- **Selection takes first-pass per channel, not best-pass per channel.** Confirmed in handover §"Proposed Next Steps." This is the cheapest fix in the entire stack.

- **Final-copy lexicon should not orbit table-work nouns.** Correct as a rule. The Stage B prompt at `generator.ts:1386` already tries to enforce this ("never name innerWork.lining verbatim; never name innerWork.through_action verbatim") — but it fails because the same nouns are *also* in the voice-spec tempo vocab. The "don't quote it" rule doesn't help when the noun is licensed elsewhere.

- **"Better scene framing" example is good.** Your proposed reframe (`to make fiat deposits feel native to the Infinex account`) is closer to the Infinex Super-Objective ("to take responsibility for the tech, so the user only has to want," `infinex.ts:342`) than the original. But "feel native" risks Passion-register drift ("feel" foregrounds reader sensation); see fix list.

---

## Where your brief is wrong or incomplete

### Miss #1 — "wall" is not just in the card. It is in the voice spec.

Your brief locates contamination in the scene prompt. The actual three-source map:

| Source | Location | Wall-lexicon content |
|---|---|---|
| **Card schema example** | `card.ts:48` | `through_action` example: `"to reveal that the bank wall just dissolved inside one account"` |
| **Card schema example** | `card.ts:61–62` | `lining` example: `"on the surface: a new fiat deposit rail. underneath: the bank-vs-wallet wall just stopped existing for Infinex users."` |
| **Sombre tempo template** | `infinex.ts:101` | `opening_shape`: `"The wall between <A> and <B> has been load-bearing for <duration>."` |
| **Sombre tempo vocab** | `infinex.ts:103–106` | `vocab_anchor`: `"used to", "becomes", "stops being", "the gap between", "section by section", "load-bearing", "another section"` |
| **Sombre example_lines** | `infinex.ts:112` | `"The wallet and the venue used to be separate things. We've been taking that wall down section by section."` |
| **Sombre lining doc** | `infinex.ts:116` | `"The Outer names a wall coming down; the Lining is 'the old wall used to keep me out too…'"` |
| **Super-objective example** | `infinex.ts:395` | `"Swidge: the user wanted to be on a new chain. The bridge, the gas, the DEX — none of that was theirs to figure out."` — "bridge" loaded as problem-dissolution metaphor |
| **Generator test fixture** | `generator.test.ts:260, 299` | Test asserts `"Bridge dissolves the wall."` appears in the Stage B prompt |

Implication: if you rewrite the Bridge card per your "Better scene framing" proposal but leave the voice spec alone, the next time the Actor reaches Sombre (which is one of Infinex's five legal primary tempi, `infinex.ts:main_tempi`), it will pull `"The wall between <A> and <B> has been load-bearing for <duration>"` straight from the template. The contamination would just relocate one stage downstream.

### Miss #2 — attempt 4's winning line is the locked Sombre template firing correctly

Your brief reads attempt 4's `"The wall between bank and wallet was load-bearing for a long time. It isn't anymore."` as a contamination artifact. Compare:

- **Sombre `opening_shape` at `infinex.ts:101`:** `"The wall between <A> and <B> has been load-bearing for <duration>."`
- **Attempt 4 X winning beat 3:** `"The wall between bank and wallet was load-bearing for a long time. It isn't anymore."`

This is the template instantiated. Past tense, weighted, third-beat positioning (after pressing/gliding/pressing setup). Director read: Commanding tempo, confidence 1.0, Spell/Vision axis intact. The Mirodan audit explicitly says the copy is commercially usable.

So the question becomes: **is the wall language a bug, or is the wall language the locked Sombre output?** Per the voice spec, it's the spec's intended Sombre output. If you don't want this, the fix is not at the card layer or the Director layer — it's at the voice spec layer, and that's a much bigger decision (Sombre's whole identity is "Werle/Duke walking the reader through a wall coming down section by section").

### Miss #3 — the Mirodan audit says the failure is the Director, not the card

`research/audit-mirodan-2026-05-27.md` §1 — independent Mirodan-kernel re-grade of the same run:

> "The copy is commercially usable; the audit loop is destroying it."

Their P0 priority (verbatim):

> "Director must STOP failing copy on 'Doing is visible / Vision absent.' Mirodan ch3: Drives are read, not performed. Patch `actor-memory.ts:344-368` infinex_placement_block to remove the rule 'Infinex extravert projection must be Vision' and replace with 'Off-spec extravert is Passion (urgency, FOMO, time-pressure). Doing or Spell as visible surface is acceptable; Vision is the *target* read, but absence does not fail a single line.'"

Their evidence: attempt 1 web option `"Your Infinex account now takes a wire the way a bank does."` was Director-rejected for "Doing surface / Vision absent." That sentence is **approximately your "Expected Better Output Shape"** ("Your Infinex account can receive a bank transfer. The balance lands on-chain."). The Actor already produced the target shapes you want. The Director rejected them under canon-misuse criteria, and the Actor then escalated wall-language across three attempts to satisfy the Director's "make the Vision surface" demand — which is the inverse of Mirodan's actual canon (Lining is supposed to stay hidden, not surface visibly).

This reframes the failure mode completely:

- **Your brief's mechanism:** Card prompt → Actor literalizes wall → Director rubber-stamps.
- **Mirodan auditor's mechanism:** Card-and-spec license wall → Actor produces clean Doing-surface first → Director rejects under inverted criteria ("Lining must surface, Vision must be visible") → Actor escalates to wall-talk to satisfy demand → wall metaphor goes from invisible Lining to visible Outer.

The second mechanism fits the four-attempt trajectory better. Attempt 1 was the *correct* Doing-surface that the Director shouldn't have rejected. The drift toward wall-language was the Actor *complying with bad Director criteria*, not the Actor failing to escape scene contamination.

### Miss #4 — the schema example IS the Bridge card framing

`card.ts:48` example: `"to reveal that the bank wall just dissolved inside one account"`
Bridge card actual `through_action` (per run HTML): `"to reveal that the bank wall just dissolved inside one account"`

Whoever authored the Bridge card copied the docstring verbatim. This isn't "scene framing is too prescriptive" — it's *the documented example was treated as the canonical card template*. So the fix is not "rewrite this one card." The fix is "stop using load-bearing brand-specific metaphors as schema docstring examples." Otherwise every fiat-deposit card going forward will inherit "bank wall."

### Miss #5 — Director self-contradicts the same string across attempts

From the run HTML (verified by run-transcript Explore agent):

- **Attempt 2 web:** `"In an Infinex account, fiat and crypto live in the same place."` → Director: self-contained tempo, **legal**, confidence 1.0.
- **Attempt 3 X (same opening line):** `"In an Infinex account, fiat and crypto live in the same place."` → Director: certain tempo (Awake-outer), **illegal**, confidence 1.0.

Identical prose, opposite legality, both at confidence 1.0. The Director is not just permissive (your brief's framing) — it's *unstable*. The Mirodan audit P0 #3 calls this out: "two-factor reads on 5–12 word web copy cannot be 1.00 confident" and recommends hardcoding a confidence cap (cap at 0.6 and emit `"tempo: short-copy-undetermined"` when copy is <3 beats and <20 words).

This is a much bigger failure mode than "Director legality is too close to quality" — it's "Director classification is non-deterministic on short copy and over-confident about it."

---

## Answers to your evaluation questions

### Q1. Is "bank wall dissolved" too metaphorically prescriptive for a scene prompt?

**Yes — and worse than that.** It's the schema docstring example at `card.ts:48`, copied into the Bridge card, AND simultaneously the Sombre opening_shape at `infinex.ts:101`. Three reinforcement layers, not one. A scene-level rewrite touches one layer; the other two will still pull the Actor back to the metaphor whenever Sombre fires.

Concrete fix: change `card.ts:48` and `:61–62` examples to use an image system that is **not** in any tempo's `vocab_anchor` or `opening_shapes`. Pick something deliberately bland — "Example: 'to position fiat deposit as a property of the account, not a feature of a partner.'" Then sweep `cards/` for cards copying the old example phrasing and rewrite them.

### Q2. Which card fields should be playable analysis only, never final-copy vocabulary?

**`through_action`, `lining`, `obstacle`, `reader_prior`, and the channel beat_plans' `physical_score` and `micro_objective` fields.** All of these are dramaturgical intake meant to shape inner work, not vocabulary supply.

But this is already nominally enforced. `generator.ts:1386` says "never name innerWork.lining verbatim; never name innerWork.through_action verbatim; never quote innerWork.obstacle." The rule fails because **the same noun can appear in the scene fields AND in a licensed tempo's vocab_anchor**, and the latter is not covered by the "don't quote it" rule. Strengthen to: "if a noun appears in both `through_action`/`lining`/`obstacle` AND in any tempo's `vocab_anchor`/`opening_shapes`/`example_lines`, treat that noun as forbidden in final copy unless it is a literal `deployed_facts` token." That catches "wall" because it's a metaphor (not a deployed fact) and it's in both layers.

### Q3. Should `through_action` be abstracted away from sticky image nouns?

**Yes, in two places:** (a) the schema docstring example must not use a brand-load-bearing noun, and (b) the fact-grounder / card-authoring step (whatever produces `through_action` at ship time) must be instructed to avoid nouns that appear in voice-spec tempo vocab. Otherwise the grounder will keep proposing image-system phrases that the Actor will then literalize.

Counter-point: `through_action` *should* contain an action verb that the Actor can play. "To reveal that X" is a fine grammar. The fix is in the **object of the verb**, not the verb shape. "To reveal X" where X is an image noun → contamination. "To reveal X" where X is a product behavior → clean.

### Q4. Should retry notes strip Director metaphor wording before feeding the Actor?

**Stripping is too aggressive and would mask real Director signal.** The actual problem is upstream: Director notes don't differentiate "this metaphor needs to change" from "this metaphor needs to be repositioned (e.g., from light to weighted, from punchline to opener)." The run transcript shows the Actor escalated wall-language because the Director asked for Vision-surface emergence; the Director then penalized that escalation in attempt 3 for shedding Weight. The Actor was chasing contradictory metaphor instructions across attempts.

Better fix: change the Director-notes schema to distinguish:
- **Repositioning notes** — "use this metaphor but at different Weight / different Aspect / different beat position"
- **Replacement notes** — "this metaphor is wrong; replace it; here is the kind of image system to try instead"
- **Removal notes** — "this metaphor is fine but it's saturating the candidate pool; one of the next options must use a different image system"

If the Director must declare which kind of note it's giving, the Actor's response shape becomes legible to the orchestrator (and the orchestrator can re-route).

### Q5. Should final selection rank legal candidates for freshness/image diversity instead of taking first pass?

**Yes. This is the cheapest fix in the entire stack and both the handover and the Mirodan audit independently recommend it.**

Concrete implementation: after the Director declares legal candidates, the orchestrator should:
1. Cluster candidates by image system (a simple noun-set diff is enough; "wall/territory/map/place" is one cluster, "deposit/account/arrive" is another).
2. Prefer the legal candidate in the **smallest cluster** (rarest image system) — assuming all clusters meet the Director's quality bar.
3. If only one cluster has legal candidates, post warning to the operator: "Director passed N candidates, all using image system X. Consider re-routing."

Per Mirodan audit §4: 28 of 30 candidates across this run used `wall/territory/place/boundary/same place/one place/map/crossing/no other side`. Image-diversity ranking would have surfaced the 2/30 outlier candidates and forced operator attention to lexical saturation before pick.

The Mirodan audit P1 #6 proposes the Actor-side version of this (Actor enforces 5 candidates must span distinct image systems). That's even better because it expands diversity *earlier* in the pipeline. Both fixes are compatible.

---

## Priority-ordered fix list

Reordering your brief's recommendations against the evidence:

### P0 — Director criteria stability (Mirodan audit's #1, your brief's #5)
1. Patch `actor-memory.ts:344-368` to remove "Infinex extravert projection must be Vision" rule. Replace with "Off-spec extravert is Passion; Doing or Spell as visible surface is acceptable; Vision is the *target* read but absence is not a single-line failure."
2. Patch `actor-memory.ts:312-326` (`directorMethodBlock`) to invert the Lining rule. Mirodan canon: Lining stays hidden. Current Director: Lining must surface visibly. Fix: "Lining check — if prose accidentally reveals the strategic anti-pattern, fail. Otherwise hidden is correct."
3. Hardcode classifier confidence cap: candidates with <3 beats AND <20 words → cap at 0.6 and emit `"tempo: short-copy-undetermined"`.

Without P0, every other fix is downstream of a broken evaluator.

### P1 — Image diversity at orchestrator selection (handover #3, Mirodan audit P1 #6, your brief Q5)
4. Replace "first passing per channel" with "image-diverse passing per channel" in the orchestrator.
5. Actor-side soft check: if 4 of 5 generated options share image system, regenerate one option with explicit "different image system" instruction.

P1 is the cheapest fix in the stack and has independent support from two reviewers.

### P2 — Schema-level decontamination (this audit's primary contribution)
6. Rewrite `card.ts:48` and `:61–62` schema docstring examples. Use bland generic phrasing not present in any tempo `vocab_anchor`. Sweep `cards/` for cards copying the old example.
7. Add a lint rule: "if a noun appears in both card field (`through_action`/`lining`/`obstacle`/`reader_prior`) AND in any tempo's `vocab_anchor`/`opening_shapes`/`example_lines`, flag it." Run at card-creation time, not at Actor time.
8. Audit `infinex.ts` Sombre — `"The wall between <A> and <B> has been load-bearing for <duration>"` is a *very specific* template. Decide: is wall-and-load-bearing the locked Sombre signature (then own it, narrow Sombre to that beat), or is it a one-of-many examples that's overweighting because it's first in the list (then add 2-3 more opening_shapes with different image systems).

### P3 — Retry path & two-stage Actor
9. Director notes schema: tag each note as `reposition`, `replace`, or `remove` (Q4 above). The Actor can then act on it without ambiguity.
10. Split the Actor call into two stages (Mirodan audit P1 #4): inner-work-only JSON first, then performances given inner-work as system context. Operator's `methodology-actor-table-work-before-drafting` memory is explicit on this; today's single-call pattern lets the model rationalize backward.

### P4 — Your scene-rewrite proposal
11. The proposed `through_action: "to make fiat deposits feel native to the Infinex account"` is good but "feel native" reads as Passion-register (foregrounds reader sensation). Better: `"to position fiat deposit as a property of the account, not a feature of a partner."` Or use `"to make fiat deposit a behavior of the Infinex account rather than a route through a partner."`
12. After P0–P3 ship, the scene rewrite is incremental polish, not the load-bearing fix.

---

## Specific lines, copy-pasteable

For when you (or Codex) actually go to make the edits:

```
# P0
src/actor-memory.ts:344-368   — remove "extravert must be Vision" rule
src/actor-memory.ts:312-326   — invert Lining-surfacing rule
src/actor-memory.ts:359       — add confidence cap for short copy

# P1
src/orchestrator.ts            — implement image-cluster selection (cluster on noun overlap, prefer rare cluster)
src/actor-director.ts:303–400  — add Actor-side image-system diversity instruction

# P2
src/card.ts:48                  — rewrite through_action example
src/card.ts:61–62               — rewrite lining example
src/voice/infinex.ts:97–117    — decide Sombre's locked metaphor scope; add diversity if not locked

# P3
src/actor-director.ts:461–471  — extend Director-notes schema with reposition/replace/remove tags
src/actor-director.ts:228–263  — split generateActorAttempt into Stage A (inner) + Stage B (performance)
```

---

## What this audit doesn't try to settle

- **Whether Sombre should be a primary Infinex tempo at all.** If wall/load-bearing/section-by-section is too tonally narrow to be 20% of Infinex's voice, that's a voice-spec decision, not a pipeline decision. Out of scope here.
- **Whether the run's final pick is shippable.** The Mirodan auditor says yes. Your brief implicitly says no. That's a brand-call, not an audit-call. The pipeline produced what the spec asked for; whether the spec is right is upstream of this review.
- **Whether to keep the Director at all.** Not on the table in your brief or the handover. If P0–P3 don't restore Director quality across a 5-card test corpus, then the question of whether to replace the Director with a different evaluator becomes live. Not now.

---

## Confidence and caveats

- High confidence on the three-source contamination map (verified by direct file reads).
- High confidence on the Director instability claim (verified by run-transcript Explore — same string, opposite legality verdicts, both at 1.0).
- Medium confidence on the Mirodan-audit reframing — the independent audit is a strong second-source signal, but it's still one document; cross-checking with the operator's own read of the Mirodan canon is worth doing before patching `actor-memory.ts:344-368`.
- Low confidence on the "rewrite Sombre" recommendation (P2 #8) — that's a voice-spec decision and should not be made from an audit of one run.
