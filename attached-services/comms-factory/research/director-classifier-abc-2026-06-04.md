# Director classification — A/B/C bake-off

**The problem we're fixing:** the Director calls everything "commanding" (34/42), and 3 of the 5 locked tempi never fire. Root cause: it classifies tempo *while staring at the answer key* (it knows Infinex is "Stable", knows the allowed palette), so it anchors to Stable and reaches for legal labels. We want the *classification* to be honest; *legality* can be checked after.

Three ways to get there. Same corpus, same ground truth, pick the winner.

---

## Option A — Classifier-first (a separate instrument does the read)

```
classify-corpus.ts (existing v2, character-blind)
   → reads the copy cold, outputs Laban classification (attitude, tempo, drive)
code gate (knows Infinex placement)
   → is that tempo legal for Infinex? pass / fail
Director (now told placement + context)
   → judges facts, voice, reader-fit; writes notes to Actor if fail
```

- **The bet:** a purpose-built classifier that was *never told* what Infinex is reads more honestly than a judge looking at the answer. One instrument for both eval grading and production = no drift between them.
- **Risk:** `classify-corpus` is itself unvalidated — if it *also* over-reads Stable, we just moved the bug. And it wasn't built for per-beat/channel-length needs.
- **What the test reveals:** does the palette breathe when an independent instrument reads it?

---

## Option B — Same Director, but with stakes (cheapest)

```
Director (keeps full Infinex placement in prompt — UNCHANGED architecture)
   + accountability frame: "a reviewer checks your call. Agree = +5.
     Overturn = -10. You're defending a rating, not nodding it through."
```

- **The bet:** the rubber-stamping is a *motivation* problem, not an *information* problem. Make being-overturned costly and it'll actually look. Pure prompt change, no new plumbing.
- **Risk:** it's still staring at the answer key. Points in a prompt aren't real stakes (the model has no memory of its score between calls) — it may just get *confidently* wrong or rationalise harder. Could be theatre.
- **What the test reveals:** can incentive-framing alone cut sycophancy with zero architecture change?

---

## Option C — Blind Director + adversarial reveal (your end-to-end favourite)

```
Director #1 — BLIND (taught Laban cleanly, told NOTHING about Infinex)
   → "what is this copy?" → reads attitude/tempo cold
code gate (knows placement)
   → legal / illegal
IF illegal:
   same warm Director — now shown the placement —
   → writes reasoning: "you read commanding; canon expects X;
      here's why this is Near not Stable / overpowering not commanding"
   → notes to the same warm Actor
   → Actor decides if it needs more grounding, revises
   → next attempt goes to a NEW blind Director (fresh context)
```

- **The bet:** separating *classify* (blind, honest) from *legality* (deterministic code) from *coaching* (informed) kills the answer-key contamination. Fresh context per attempt stops the Director learning to pattern-match "Stable."
- **Risk (your own instinct):** clean on-voice copy may genuinely read Stable to *any* honest reader — so "blind" doesn't guarantee variety. And a placement-blind reader might be high-*variance* (unreliable) rather than just unbiased.
- **What the test reveals:** does removing the answer-key produce honest *variety*, or just *noise*?

---

## The key distinction in one line

- **A** = a *different instrument* does the read.
- **B** = *same* knowledge, *same* read, but made to *care*.
- **C** = *same* model reads, but *blind*, and legality is revealed only *after*, adversarially.

## The test (identical for all three)

Corpus:
- the 42 real candidates (current monolith Director = the **baseline** to beat)
- the 56 battery items (42 mutations with *known* planted defects + 14 clean controls)
- operator ground truth: the 18 triage notes + the "good"-marked candidates

Metrics:
1. **Palette breathing** — does it stop saying commanding 34/42? do sombre/irradiant/sociable ever fire? Stable-cell share.
2. **Catch rate on planted defects** — especially *surfaced-lining*, where the current Director is 3/7.
3. **False positives** — controls failed, and any operator-"good" copy failed.
4. **Agreement with operator labels.**
5. **Variance** (C-specific) — run the same item twice; does a blind read stay stable or wobble?
6. **Cost** — calls + tokens per item.

Winner = best palette breathing + best lining catch + lowest false-positive, at acceptable cost/variance.
