# Handover — Actor/Director "visible Vision" mandate fix

**Date:** 2026-05-27
**Audience:** Codex (implementation pass)
**Status:** Awaiting operator decision between fix #1 and fix #2 (see "Open decision" below). Do NOT implement until operator picks.

---

## TL;DR

The Director rejects shippable Infinex copy on the grounds that the visible surface doesn't carry the Vision drive. Two parallel Opus audits (system + Mirodan-canon lenses) both diagnosed the symptom but neither located the actual cause in the prompt. The cause is one line in `src/actor-memory.ts:361` that explicitly mandates *"compatible with the locked axis: resting Spell, visible Vision"* — and is contradicted by the very next bullet at line 362 that says *"resting Spell without a visible Vision projection is not automatically off-character."* The model is correctly executing line 361. The hedge at 362 doesn't bite.

Operator wants the smallest correct fix. Two candidates are below. Operator will pick one; you implement only the one chosen.

---

## What was audited and where the evidence lives

**Audited run:** card `01KS6QJNEGFYP6X048V8Y900DM` ("bank wall dissolved" / Bridge.xyz fiat deposit release).

**Artifacts (all in repo):**
- `research/actor-run-review-01KS6QJNEGFYP6X048V8Y900DM.html` — generated output, all candidates, all attempts.
- `research/audit-system-2026-05-27.md` — system/code lens, fresh Opus audit.
- `research/audit-mirodan-2026-05-27.md` — copy/Mirodan canon lens, fresh Opus audit.
- `harness/harness.db` — SQLite with `actor_attempts`, `director_audits`, etc. Contains the exact prompts and responses for the run.

**Canon sources (authoritative for Mirodan claims):**
- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch1-basic-concepts.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch2-attitudes.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch3-drives.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/laban-mirodan-reference-2026-04-28.md`

---

## Empirical findings from this run

Three attempts. Top-level table-work is stable across all three:

| Field | Attempts 1, 2, 3 |
|---|---|
| `through_action` | "to reveal that the bank wall just dissolved inside one account" (verbatim across all 3) |
| `obstacle` | substantively stable — "reader will pattern-match to fintech partnership / on-ramp announcement and skim" |
| `lining` | semantically stable — the categorical boundary is gone |
| `not_the_point` | grows slightly across attempts but Bridge-as-headline / rails enumeration / partnership announcement framing is consistently suppressed |

So inner work is **upstream of copy and stays stable** through Director retries. The "one guy who acts and then hands off" architecture is doing real causal work at this layer.

Beat-plan structure (press/press/punch for X attempt 1) is honored by all 5 X candidates.

**Where motors actually drift:**

| Channel | Attempt 1 motors | Attempt 2 motors | Attempt 3 motors |
|---|---|---|---|
| X beats | press / press / punch | wring / wring / slash | wring / wring / slash |

That's a Drive-layer pivot (different Effort-space) while Through-Action stays verbatim. The Director's critique is driving motor selection, not the inner work driving it.

**`movement_receipt` is ornament.** Per-candidate receipts return `verb: None`, `embodiment: None`, `beat_index: None`. Only `working_action` survives as a bare label. The schema asks for those fields; the model fills them with null; nobody catches it. Real bug, separate from the Vision-mandate issue.

---

## Director rejection notes (the smoking gun)

Pulled from `director_audits.director_audit_json` for this run.

**Attempt 2 web** is the cleanest example. Director marked:
- `primary_tempo: commanding` (a primary-allowed Infinex tempo)
- `drive_read: spell`
- `infinex_fit.legal: TRUE` with reason *"Legal placement confirmed. No Passion surface."*
- **`passed: 0`** anyway
- `voice_issues` includes verbatim: *"this line needs a second sentence that carries the Vision extravert"*
- `notes_for_actor` includes verbatim: *"a second sentence must carry the Vision extravert"*

By attempt 3 the Director has dragged the X copy from solid SHIPPABLE (*"A wire can now arrive into your Infinex account. So can a SEPA transfer. The account holds it. The wall between your bank and your wallet was the part you were tolerating. It isn't there anymore."*) into Awake-outer territory (tempo `certain`) — a tempo Infinex literally cannot occupy as a baseline.

---

## The mandate source

`src/actor-memory.ts:361` (inside `infinexPlacementBlock`), present in the run-time Director system prompt at character offset @17070:

```
- Do not recompute the brand drive from a single tempo read. Judge whether
  the prose is compatible with the locked axis: resting Spell, visible Vision.
  Do not ask the Actor to perform Spell -> Vision as a verb.
```

The phrase **"compatible with the locked axis: resting Spell, visible Vision"** is the judgment criterion the Director was handed. It hands the Director a checkbox: is the prose carrying *resting Spell + visible Vision*? When the Director's `drive_read` returns `spell` and no Vision is visible, the criterion fails — `passed` flips to false. The model is obeying the prompt.

`src/actor-memory.ts:362` then tries to walk it back:

```
- Resting Spell without a visible Vision projection is not automatically
  off-character. It can be a legal contained beat, especially in one-line
  web or UI copy. Mark it incomplete only if the brief requires an arc
  and the copy cannot stand alone.
```

But 361 establishes the criterion; 362 hedges it. The model treats 361 as the rule and 362 as a tiebreaker — and it never reaches the tiebreaker because the criterion at 361 has already failed.

`actor-memory.ts:319` (the *"Do not prescribe `add a second sentence` as a movement rule"* line) is a more recently added hedge against a symptom. It also doesn't override the mandate at 361. Codex: ignore line 319 for this fix; it's downstream of the real problem.

---

## What the parallel audits actually said vs what they missed

This matters because the audit reports in `research/` look authoritative but missed the cause. Read them as evidence about the symptom, not as a fix prescription.

**System audit (`research/audit-system-2026-05-27.md`):**
- **Correctly identified** that `passed: boolean` collapses three different gates (draft validity, voice fit, publication readiness) into one verdict.
- **Correctly identified** that the Director is one LLM call doing motion classification + drive read + legality verdict + voice notes + factual audit + publication audit.
- **Correctly identified** that only 1 of N actor performances per channel reaches the harness UI.
- **Used the Vision rejection as an illustration** of the `passed`-conflation bug, but pointed at line 319 as a contradicted-by-behavior hedge — did not locate the mandate at 361.
- Implied fix: split `passed` into separate gates. That's a larger architectural change than the current task.

**Mirodan audit (`research/audit-mirodan-2026-05-27.md`):**
- **Correctly identified** that the Director's Vision-projection demand is a Mirodan canon error (ch3 p.527: Drives are how the audience *identifies* the Attitude, not what the actor *performs*).
- **Stated** *"The Director kernel even contains the correct hedge but the model overrides it."* This is the miss. The model isn't overriding the hedge — the hedge at 362 is contradicted by the mandate at 361, and the model is following 361. The auditor saw 362 (the hedge) and concluded "override" rather than checking the surrounding text.
- Implied fix: treat drives as diagnostic (audience-identification), not gating (actor-performance).

**Earlier wrong attempt by Claude in-thread:** strengthened line 319 with extra phrasings. Reverted. Line 319 wasn't the cause and didn't exist in HEAD at the time of the audited run.

---

## Open decision (operator picks one)

### Fix #1 — Strike "visible Vision" from line 361 (mechanically smallest)

Change `src/actor-memory.ts:361` from:

```typescript
"- Do not recompute the brand drive from a single tempo read. Judge whether the prose is compatible with the locked axis: resting Spell, visible Vision. Do not ask the Actor to perform Spell -> Vision as a verb.",
```

to:

```typescript
"- Do not recompute the brand drive from a single tempo read. Judge whether the prose is compatible with the locked axis (Spell → Vision). Do not ask the Actor to perform Spell -> Vision as a verb.",
```

This removes the *"resting Spell, visible Vision"* decomposition. The criterion becomes "is the prose compatible with the Spell → Vision axis" without specifying which side must be visible. The hedge at 362 stops being contradicted and starts being the rule.

**Pros:** one-bullet edit; preserves the structural framing of the placement; reversible in one commit.
**Cons:** doesn't address the deeper canon problem the Mirodan auditor flagged — drives are still being framed as something the prose must "be compatible with" rather than something the audience reads.

### Fix #2 — Reframe drive_read as diagnostic, not gating (canon-correct)

Per Mirodan ch3 p.527: drives are how the audience *identifies* the Attitude. They are not a checkbox the prose must satisfy.

Rewrite line 361 to:

```typescript
"- drive_read names which drive the audience would identify if asked, not a checklist the prose must satisfy. Report the read; do not fail legal placements solely because drive_read does not visibly project the locked axis. The Spell → Vision axis is a property of the character's stance over time, not a per-line presence test.",
```

And consider rewording line 354 (`drive_extravert: vision`) framing to be observational ("if the audience reads the extravert, it would be Vision") rather than declarative ("extravert IS Vision"). Optional; codex decides whether to touch 354 — operator's instruction is "smallest fix," so default to leaving 354 alone unless Codex finds 361 alone insufficient.

**Pros:** canon-correct; closes the structural loophole that lets the Director invent any drive-mandate critique.
**Cons:** bigger semantic shift in the prompt — may have unintended effects on the Director's other judgments. Untested.

### Operator must pick #1 or #2 before Codex starts.

---

## Verification plan (same for either fix)

1. Re-run card `01KS6QJNEGFYP6X048V8Y900DM` through the harness with the patched `actor-memory.ts`.
2. Compare attempt-1 Director audit JSON to the prior run.
3. **Expected:**
   - Attempt-1 X copy passes Director on first attempt (`passed: 1`).
   - `voice_issues` no longer contains *"needs a second sentence"* / *"missing Vision projection"* / *"needs the Vision extravert"* phrasings.
   - No second / third retry needed.
   - Motors stay press/press/punch instead of pivoting to wring/wring/slash.
4. **If still rejected on Vision grounds:** fix #1 was insufficient; escalate to fix #2.
5. **If passes:** capture a fresh `research/actor-run-review-<new-ulid>.html` so the operator can eyeball the SHIPPABLE candidates without a Director-induced rewrite.

---

## What is OUT OF SCOPE for this handover

The wider audit surfaced other bugs. Operator has explicitly parked them:

- **Rejected-pool invisibility.** `src/actor-director.ts:577-583` (`actorOutputToCandidates`) picks 1 of 5 performances per channel and discards 4. `harness/components/CandidateCard.tsx` only renders the survivor. Both audits flagged this. **NOT this PR.**
- **`passed` boolean conflation.** Director's single LLM call audits three things and emits one verdict. System audit flagged as BLOCKER-2. **NOT this PR.**
- **`movement_receipt` null fields.** Schema asks for `verb`/`embodiment`/`beat_index` per receipt; model returns null on all three. Empirical finding from this audit. **NOT this PR.**
- **Director rewriting motors on retry.** Attempt 1 was press/press/punch; attempt 2 swapped to wring/wring/slash while Through-Action stayed verbatim. **NOT this PR.**
- **Director split into three gates** (deterministic legality / forensic classification / publication readiness). **NOT this PR. Future architectural work.**

Do not bundle. Do not refactor. Touch only the line(s) required for the chosen fix.

---

## Files Codex may touch in this PR

- `src/actor-memory.ts` — line 361 only (and optionally 354 if fix #2 is picked AND Codex judges 361 alone insufficient).

## Files Codex must NOT touch

- `src/actor-director.ts`
- `src/actor-orchestrator.ts`
- `harness/**`
- `src/validator.ts`, `src/validator-llm.ts`
- `src/voice/infinex.ts` (the voice spec — the prompt instruction is in actor-memory.ts, not in the spec)
- Tests — no test asserts on the exact prompt string (verified by grep before this handover); do not add tests for prompt content.

## Typecheck before reporting done

```
pnpm tsc --noEmit
```

Exit 0 expected.

---

## Commit message template

Once operator picks fix and Codex implements:

```
Fix Director's "visible Vision" mandate that rejected shippable copy

src/actor-memory.ts:361 was instructing the Director to judge prose against
"resting Spell, visible Vision" as a checkbox criterion. Per Mirodan ch3 p.527,
drives are how the audience identifies the Attitude, not a checklist the prose
must satisfy. The mandate at 361 contradicted the hedge at 362 and the model
correctly followed the mandate, rejecting legal placements (e.g. attempt 2
of run 01KS6QJNEGFYP6X048V8Y900DM, card "bank wall dissolved") with notes
like "this line needs a second sentence that carries the Vision extravert."

[Fix #1 or #2 description here, matching what was implemented]

Verification: rerun card 01KS6QJNEGFYP6X048V8Y900DM and confirm attempt-1
Director audit returns passed=1 with no missing-Vision-projection notes.
```

---

## End of handover

Operator review: pick fix #1 or #2, edit any of the above, then hand to Codex.
