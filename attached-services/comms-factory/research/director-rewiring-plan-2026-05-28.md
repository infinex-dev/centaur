# Director criteria rewiring — plan (no code changes yet)

**Date:** 2026-05-28
**Status:** Plan-only. No code changes in this session. Operator wants explanation + scoped plan first, then a separate session to execute.

## What this is

The Mirodan audit (`research/audit-mirodan-2026-05-27.md`) flagged the Director's classification criteria as the root cause of the Bridge.xyz Actor over-fixation. Per that audit's headline finding: **"the copy is commercially usable; the audit loop is destroying it."** The Director is rejecting candidates under criteria that invert Mirodan canon — specifically demanding that the Lining surface visibly and that Vision be the visible/extravert projection — which Mirodan §7.3 and ch3 p.529-530 explicitly contradict.

This document explains what's wrong, what the fix shape looks like, and what the cascade hits when we change it. Read this before the execution session.

## The two canon inversions

### Inversion #1 — "Lining must surface visibly"

**Where it lives:** `src/actor-memory.ts:302-327` (`directorMethodBlock`) and the Director's notes in `src/actor-director.ts:461-471` (`buildDirectorNotesMessage`). The current Director method does not directly demand "Lining-surface", but the cumulative criteria across attempts produce that effect — the Director in the Bridge.xyz run kept pushing the Actor to make the wall-dissolution language surface, which is what eventually contaminated attempt 4. The classification criteria (drive_read, lining_read) treat absent Lining surfaces as ambiguity or as a sign the Actor hasn't done the work.

**What Mirodan canon says:** Lining is the **hidden Inner Action** the visible Outer covers (Mirodan §7.1, pp. 554–555). The Outer/Lining gap is the engine of dramatic life (§7.2). Authoring discipline (§7.3): **write the Outer, leak the Lining. Never name the Lining in the prose.** The Lining leaks involuntarily underneath the Outer — it is *not* something the actor performs, surfaces, or visibly declares. The audience reads the Lining from texture, restraint, and what the prose refuses to say.

**Why the Director got it backwards:** Looking at the Bridge transcript, Director attempt 1 said "the lining is structurally absent" → Actor responded by making "the wall dissolved" the visible line → Director attempt 3 then penalized that for "shedding Weight" — the Actor was caught between two contradictory demands across attempts. The first attempt's read was the inverse of canon: Lining absent isn't a failure if the Outer is doing its job; absence is the correct state.

**What needs to change:**
1. `directorMethodBlock` should explicitly state: "Lining check — if the prose accidentally REVEALS what should remain hidden (the strategic anti-pattern of the character), fail. Otherwise hidden is correct. Do NOT mark a candidate as missing the Lining solely because the Lining doesn't surface in visible prose."
2. The Director's output schema (whatever fields it emits about Lining read) should explicitly accept "hidden — appropriate" as a passing classification, not a degraded one.
3. Retry notes (`buildDirectorNotesMessage`) need to stop saying "make the lining surface" or equivalent. If the Lining IS surfacing visibly, that's the failure direction — push it back underneath.

### Inversion #2 — "Vision must be the visible/extravert projection"

**Where it lives:** `src/actor-memory.ts:343-368` (`infinexPlacementBlock`), particularly the parts that say things like "off-spec drive surfaces" and the broader semantic that "the locked drive axis must be visibly projected." Specifically:
- Line 354: `Drive primary: ${voice.drive_primary}; secondary: ${voice.drive_secondary}; introvert: ${voice.drive_introvert ?? "n/a"}; extravert: ${voice.drive_extravert ?? "n/a"}.`
- Line 355: `Off-spec as visible/extravert surface: ${voice.off_spec_drives.join(", ") || "none"}.`
- Line 359-362 partially hedge this ("Resting Spell without a visible Vision projection is not automatically off-character") — these hedges are CORRECT and were probably added after the Mirodan audit. But the framing of "drive_extravert" as a target the prose must hit is still implicit in the field names.

**What Mirodan canon says:** Externalized Drives are used to **identify** the Inner Attitude of the Character (Mirodan ch3 p.529-530). They are READ by the audience from the visible Working Action, not performed by the actor. The writer plays a verb under inner work; the audience reads the drive afterward. **The writer has no lever over which Drive the audience reads** — only over which verb is played.

**Why the Director got it backwards:** The Bridge attempt 1 web option "Your Infinex account now takes a wire the way a bank does." was Director-rejected as "visible surface is Doing, not Vision." That's the inverse of canon — Doing-surface is a legitimate read for a Stable+Penetrating character; the audience would identify Spell-Vision from the cumulative texture, not from any single line foregrounding Vision. Demanding Vision-surface forces the Actor to perform something Mirodan says emerges, not performs.

**What needs to change:**
1. `infinexPlacementBlock` should explicitly state: "Drive reads are **inferred** from the visible Working Action; the writer cannot project a specific drive directly. Doing or Spell as visible surface is acceptable; Vision is the target read across the cumulative arc, but absence in any single line is not a failure."
2. The off_spec_drives check should be reframed: off-spec is "visible surface that systematically misroutes the drive read" — i.e., Passion-flavored urgency that the audience would read as Passion-driven. NOT "any line where the visible drive isn't Vision."
3. Director output schema should treat `drive_read: doing` or `drive_read: spell` on a single line as informational, not a failure trigger. The fail trigger is `drive_read: passion` with off-spec surface markers.
4. The hedges already present at lines 359-362 should be promoted from hedges to the primary rule, not buried at the bottom.

## What the cascade hits

If we make the two inversions above, downstream behavior changes:

**Direct effects:**
- Director will pass more Doing-surface candidates that previously got rejected for "Vision absent."
- Director will stop demanding the Lining surface visibly, so the Actor's escalation across retries (which is what contaminated the Bridge run) should stop.
- The Mirodan auditor's verdict of "the copy is commercially usable" should hold consistently — attempt 1 outputs will pass at the Director layer.

**Indirect effects:**
- The retry orchestration becomes important: with the Director rejecting fewer candidates, retries should be rarer. Need to check that `actor-director.ts` doesn't have a hardcoded retry count that becomes wasteful.
- `validator-llm.ts:169` drive-descriptor cleanups (per the pre-mortem P0.4) need to land in the same change — if the validator still uses operator-paraphrase drive definitions, the Director may pass a candidate that the validator rejects, creating cross-layer inconsistency.
- Selection logic (orchestrator) currently picks "first passing per channel." With the Director passing more candidates, the question "WHICH passing candidate is best?" becomes load-bearing. The image-diversity selection from the original Bridge audit (P1 in pre-mortem) is the right lever here. Without it, candidates might still cluster on the same image system even though more pass the Director.

**Test cascade:**
- `actor-director.test.ts` has 11 tests, all passing. Many test the legality/passing logic. Changes to Director criteria will likely change which test cases pass at which layer. Worth running tests early and updating expectations carefully.
- Eval-harness integration tests may need new fixtures (the existing fixtures may have been calibrated around the inverted criteria).

## Specific edit plan (for the next session)

### Edit 1 — `src/actor-memory.ts:302-327` (`directorMethodBlock`)

Add a top-level explicit rule:

```ts
"- Lining check: if the prose accidentally REVEALS what should remain hidden (the strategic anti-pattern of the character), fail. Otherwise hidden is correct. Per Mirodan §7.3: write the Outer, leak the Lining; the Lining is not something the actor performs or surfaces. Do not mark a candidate as missing the Lining solely because the Lining is not visible in the prose.",
```

And remove (or rewrite) any existing rule that demands Lining-surface.

### Edit 2 — `src/actor-memory.ts:343-368` (`infinexPlacementBlock`)

Promote the hedges at lines 359-362 to primary rules. Add at the top:

```ts
"- Per Mirodan ch3 p.529-530: Drives are READ from the visible Working Action, not performed. The writer plays a verb under inner work; the audience identifies the drive afterward.",
"- Off-spec is a visible surface that systematically misroutes the drive read (e.g. urgency/FOMO surfaces Passion). Doing or Spell as visible surface is acceptable; Vision is the cumulative target across an arc, not a per-line requirement.",
```

And rewrite line 355 to be observational, not prescriptive:

```ts
// Was:
"- Off-spec as visible/extravert surface: ${voice.off_spec_drives.join(", ") || "none"}. Hidden/introvert lining may still exist."
// To:
"- Off-spec markers (urgency / FOMO / scarcity / hype-theatre) systematically project ${voice.off_spec_drives.join(", ") || "no off-spec drives"} when foregrounded. The Director identifies these as off-spec surface; otherwise drive reads are informational."
```

### Edit 3 — `src/actor-director.ts:461-471` (`buildDirectorNotesMessage`)

Change retry-notes framing so the Director can mark notes as `reposition`/`replace`/`remove` (per the pre-mortem P3 recommendation):

```ts
notes.notes.map((note) => `- [${note.kind ?? "reposition"}] ${note.text}`)
```

This needs a schema change to `DirectorNotes.notes` type. Bigger lift; defer to a dedicated session.

### Edit 4 — `src/validator-llm.ts:169` (drive descriptors)

Replace operator-paraphrase definitions with pure Mirodan canon (already in pre-mortem P0.4):

```ts
// Was:
"`passion` = urgency/time-pressure/hype/FOMO. `vision` = future-pull, agentic-becoming."
// To:
"`passion` = Time-stressed visible surface (urgency vocabulary is the most common Infinex symptom but not the definition; ref Mirodan ch3 p.534-535)."
"`vision` = future-pull / forward-leaning intention."
"See voice.tempi[tempoName].canonical_shorthand for tempo-specific grounding."
```

### Edit 5 — `src/generator.ts:592` + `:617` + `:584` (drive performance demands)

Per pre-mortem P0.6, P0.7, P1.6. Reframe writing instructions from "make Drive visible" to "play the verb; the drive reads from there."

## What this DOESN'T cover (deferred work)

- **Director-notes schema tags** (`reposition` / `replace` / `remove`) — touched briefly in Edit 3 but the schema change is substantial. Separate session.
- **Image-diversity at orchestrator selection** — pre-mortem P1, also touched in audit-of-bridge-audit-2026-05-28.md. Separate session.
- **Nigel placement audit** — explained inline below in the README section. Out of scope for Infinex Director work.
- **Stage A / Stage B rename across `generator.ts`** — pre-mortem P0.5. Touches a lot of strings; do it as a dedicated rename pass.
- **Other brand voice migrations** (nigel / cream / nick-b / nick-d / projectjin) — per-brand decisions; defer.

## Risk assessment

**Why this needs its own session:**

1. **Behavioral surface area:** Director criteria affect every Actor output via retry. A wrong fix here cascades through every comms run. Worth getting it right rather than rushing it after the other changes today.
2. **Test cascade:** 11 actor-director tests + eval integration tests likely have implicit assumptions about which criteria fire. Need to read them carefully before changing the criteria.
3. **Cross-layer consistency:** Director changes must land alongside validator-LLM changes (Edit 4) or the two layers will disagree. Single session with full cross-check.
4. **The hedges already present at infinexPlacementBlock:359-362** suggest someone partially recognized this issue before. Worth understanding why those hedges exist (and were they enough?) before extending them.

**Why this is safe to defer to a separate session (not blocking):**

1. The Laban-pure voice spec refactor + downstream consumer updates landed cleanly this session; no regressions.
2. The blind classifier is now informational only; the validator-LLM is the gate. The Director sees the same canon either way.
3. The pre-mortem fixes (P0.1-P0.11) are tractable as a separate fix batch; this Director rewiring is the meatier piece and earns its own session.

## Reading list before executing

1. `research/audit-mirodan-2026-05-27.md` — the independent Mirodan re-audit. Read §1-3 (verdict + drive-rule inversions) + §6 (recommended P0 fixes).
2. `research/pre-mortem-non-canon-contamination-2026-05-28.md` — P0.4, P0.6, P0.7 (cross-references).
3. `research/audit-of-bridge-audit-2026-05-28.md` — the operator-side rewrite of the Bridge audit; cross-check that the fix matches the reframing there.
4. The two Mirodan source files: `~/Downloads/nigel-session-2026-04-28/mirodan-ch3-drives.md` and `mirodan-ch7-outer-lining.md` (or wherever §7 lives) — verify the canon citations before editing.
5. `src/actor-memory.ts` in full — particularly the directorMethodBlock and infinexPlacementBlock.
6. `src/__tests__/actor-director.test.ts` — read the existing test cases to know which assumptions to update.
