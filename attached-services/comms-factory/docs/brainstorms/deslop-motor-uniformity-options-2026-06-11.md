# Deslop at the motor, not the lexicon — the potential edits

**Context (security-thesis card, 2026-06-11).** The blog candidates are lexically clean — the
slop-feel is **motor uniformity**: every beat closes Sustained-prep → Quick-release with an
aphoristic button ("…the same root cause wearing different clothes." ×5 sections), and the
antithesis grammar ("not X. It is Y.") recurs ~5 times. Per the table-work principle, a release
pattern that reads as *assigned* rather than emergent from Deciding is what registers as
paint-by-numbers. The fix can live at **generation** (actor), **direction** (Director audit), or
**validation** (regex) — these are the concrete edits for each, all in Mirodan/Laban vocabulary.

---

## Option A — generation: a release-economy constraint in the Actor's beat-plan instructions

**Where:** the Actor system prompt's beat-plan section (`src/actor-director.ts`, next to the
`preparation_from` instruction).

**The edit (verbatim text to add):**

> **Release economy.** A Quick-release close — punching / slashing / dabbing / flicking landing an
> aphoristic final line — may end AT MOST ONE beat per post. The character chooses *where* the post
> earns it; that choice is part of Deciding. Every other beat ends inside its Sustained action
> (pressing, gliding, wringing, floating): on mechanism, on evidence, or on unresolved weight — no
> button. Antithesis grammar ("not X. It is Y.") is one tool, not a meter: at most once per post.

**Why it stays Laban-pure:** it constrains the *distribution* of Working-Action releases, not which
tempo any beat takes — the beat sequence still emerges from Deciding. It's craft discipline of the
same kind as the existing "tempo is never declared" rule.

**Pros:** fixes at source; all channels benefit; no new rejection loops; cheapest in wave rounds.
**Cons:** fattens the upstream (lean-upstream principle — though this is a diagnosed gap, which is
the sanctioned trigger); risk the model complies mechanically (always banks the one button on the
final beat — watch for this in the next few runs).

---

## Option B — direction: a motor-uniformity check in the Director's audit rubric

**Where:** the Director system prompt's audit instructions (`src/actor-director.ts`,
`buildDirectorMemoryPack`). The Director already receives the movement receipts (Stage A motor
scoring), so it can *see* this — it just isn't told to look.

**The edit (verbatim rubric line to add):**

> **Motor uniformity.** Read the movement receipts across the whole piece, not beat-by-beat. If
> more than one beat closes with the same Quick-release shape (an aphoristic button on the final
> line), or one sentence grammar (antithesis "not X. It is Y.") carries 3+ beats, the release
> pattern is assigned, not decided — flag it and hand back naming WHICH beats should end Sustained
> instead. The Zcash-style unresolved close (Sombre, no button) is the model of a beat that ends
> without release.

**Pros:** judgment lives at the judgment layer (Director is the LLM gate; the validator stays
regex-grade per the pipeline contract); the feedback wave already routes Director notes into the
actor's next attempt; catches *any* uniformity, not just pre-listed tells.
**Cons:** fires after generation — costs a wave round each time it triggers (bounded by the 3-round
cap).

---

## Option C — validation: ONE narrow regex rule (the antithesis meter), nothing more

**Where:** `src/validator.ts` + tests. The only cadence tell regex can catch with honest precision:

```ts
// Antithesis ("not X. It is Y.") is a voice tool, not a meter. Three or more
// in one piece is cadence slop regardless of vocabulary.
const ANTITHESIS_RE =
  /\b(?:is|are|was|were)\s+not\b[^.!?]{0,80}[.!?]\s+(?:It|That|This|They)\s+(?:is|are|was|were)\b/g;

export function rejectAntithesisMeter(s: string): RuleResult {
  const count = (s.match(ANTITHESIS_RE) ?? []).length;
  if (count >= 3) {
    return { passed: false, reason: `antithesis meter ×${count} — "not X. It is Y." may appear at most twice` };
  }
  return { passed: true };
}
```

**Pros:** deterministic, zero-cost, threshold ≥3 keeps false positives near zero (short channels
can't hit it).
**Cons:** covers exactly one tell. **Do NOT extend regex toward "detect aphoristic closes"** —
there is no honest pattern for it, and a fuzzy rule would deadlock waves exactly the way the
`unlock` cliché false-positive did this morning. Cadence-shape judgment belongs to the Director
(Option B).

---

## Recommendation

**A + B together** — the constraint at source and the Director as backstop — with **C** as an
optional cheap add. They are complementary, not redundant: A reduces how often the problem is
generated; B catches the residue and produces the handback note automatically (today the operator
writes that note by hand); C makes one specific tell free to reject.

What was *already fixed* alongside this doc (mechanical, not judgment):
- `unlock` cliché narrowed to marketing collocations — literal passkey/enclave mechanism passes
- claim audits scan the body only — frontmatter dates/dimensions are no longer "numeric claims"
- actor schema violations (e.g. off-enum `preparation_from`) now feed back as a correction turn
  instead of killing the run
