# Postmortem — testing the wrong pipeline for ~12 hours

**Date:** 2026-05-28
**Severity:** High — substantial wasted operator + agent time + API spend
**One-line summary:** Built A/B/C/D/E docstring tests + wall contamination sweep + change plan + literary anchor comparison against Pipeline 1 (legacy generator) when Pipeline 3 (Actor/Director) is the canonical pipeline. Discovered only when the operator explicitly pointed at `actor-director.ts` and said "look at THIS, not the other stuff."

## What happened (timeline)

1. **Session opened** with a Bridge.xyz Actor/Director run audit task. Read the run review, the Mirodan audit, the handover. Began audit work.
2. **Built v1 A/B/C grounder test** at `eval/card-docstring-ab/ab-test.ts` — tested how the `card.ts` docstring shapes a grounder LLM's proposed `through_action` + `lining`. Five docstring variants. Self-contained LLM call. Pipeline-independent at that stage.
3. **Built v2 caption-level test** at `eval/card-docstring-ab-v2/ab-test-v2.ts` — extended v1 by **calling `generate()` from `src/generator.ts` directly** with explicit `beats`. This routes through `generate.ts:277-279` into `legacySingleCall: true` — the legacy generator path.
4. **All 50 captions came from Pipeline 1.** Wall-language at 20% under CURRENT, 10% under variants. Validity 50% under Variant C. Built a rater HTML with the 50 captions.
5. **Ran contamination sweep** finding 21 wall-language sites across the codebase. Half were in `generator.ts`, `validator.ts`, `validator-llm.ts`, `orchestrator.ts` — all Pipeline 1 code.
6. **Built the end-to-end change plan** with 21 surgical fixes. Optimized Pipeline 1's prompt language without ever asking which pipeline was production.
7. **Built corpus comparison** (real Infinex tweets vs our captions) — captured the "essayist 3-beat arc" failure mode. Captured the "opens with thesis, real Infinex opens with fact" gap. Built the HTML.
8. **Built literary anchor comparison** (Werle / the Duke / Logan Roy vs our captions) — extracted the structural delta. Built the HTML. Confidently claimed the captions were essayist where canon is settlement.
9. **Operator surfaced the misalignment:** "I wonder whether we're using the actor / director pipeline?" — single sentence inside a longer message about tempo-within-vs-between-beats.
10. **Read `src/actor-director.ts` + `src/actor-memory.ts` for the first time in full.** Discovered the verb-centric, tempo-emergent architecture. Realized the entire session's analysis was on the wrong pipeline.
11. **Built the pipeline map** showing three pipelines exist, two are legacy, one is correct, the correct one is gated behind `HARNESS_GENERATOR_ARCH=actor` and is NOT the default.
12. **Re-running v2 on Pipeline 3** to get a correct baseline.

## Root causes

### 1. Started with the wrong entry point
`src/cli.ts` is the most visible entry point in the repo and routes through Pipeline 1 (`orchestrate()` / `orchestrateWithRetries()`). I treated the CLI as canonical. Should have started with `harness/app/actions/generate.ts` — the Next.js server action that drives production runs. That file branches on `HARNESS_GENERATOR_ARCH` at line 65. One grep, two minutes, would have surfaced the architecture.

### 2. Confused presence with default
Saw `auditCandidateWithDirector` and `generateActorAttempt` in the codebase. Catalogued them as "auxiliary functionality" without checking what calls them or whether they're the default. Did not grep for `generateActorAttempt` usage. Did not read `actor-orchestrator.ts`. Treated the bigger file (`generator.ts`, 1493 lines) as the more important one. Bigger file ≠ more current — often the opposite (legacy bloat).

### 3. Confirmation bias inside the wrong frame
Once contamination was found in Pipeline 1's files, every new finding REINFORCED the Pipeline 1 mental model. Each wall-language site, each prompt drift, each fact-vs-thesis gap looked like Pipeline 1's failure, so I dug deeper into Pipeline 1. The deeper I went, the more committed I became.

### 4. Ignored standing operator memory
Memory `[[methodology-actor-table-work-before-drafting]]` is loaded into every conversation and says explicitly:
> "Tempo is emergent from Deciding, never assigned. Pre-assigned tempi without inner cause read as paint-by-numbers slop."

I built v2 with explicit `TempoBeat[]` declarations (sombre → commanding → irradiant) — the exact thing that memory forbids. The memory was in my context. I didn't apply it. Should have flagged my own test design against the memory before running it.

### 5. Read prior audit documents in passing without internalizing implications
The file `research/audit-system-2026-05-27.md` says — and this was already in the repo, written by a prior agent or operator-led session:
> "the harness still wires the legacy two-call path as default and only flips to Actor/Director under an env var, so the runtime 'what is the pipeline' question depends on `HARNESS_GENERATOR_ARCH`. This is close, but it is not commercial-ready and it is not clean."

I grepped this file's contents during earlier work. The headline was right there. I read past it.

### 6. Sprawled instead of mapping first
The pipeline map HTML I built late in the session was the artifact I needed in hour 1, not hour 12. Should have produced an end-to-end architecture diagram BEFORE writing any test or change plan. The order was:

- **What I did:** sweep → test → change plan → comparison → MAP (last)
- **What I should have done:** MAP → identify production path → test ON production path → sweep contamination IN that path

### 7. Didn't verify the test path
The v2 test ran with `generate(card, {beats, voice, channel, n, mode: "live"})`. I never logged or asserted "this routed through legacy single-call path." If I'd printed the prompt + the code path, the divergence from the actor/director architecture would have been obvious immediately. Tests should announce their pipeline.

## Wasted effort tally

What needs to be re-done or thrown out:

| Artifact | Status | Cost to redo |
|---|---|---|
| v2 50-caption test results | INVALID — wrong pipeline | Currently re-running on Pipeline 3 (~$50, ~5min) |
| Caption rater HTML (50 captions × ratings) | INVALID — captions were from Pipeline 1 | Re-emit after Pipeline 3 test completes |
| Corpus comparison findings | PARTIALLY VALID — benchmark (real Infinex tweets) is right; subject (Pipeline 1 captions) is wrong | Re-apply to Pipeline 3 outputs |
| Literary anchor comparison | PARTIALLY VALID — benchmark (Werle/Duke/Logan) is right; subject is wrong | Re-apply to Pipeline 3 outputs |
| Wall contamination sweep (21 sites) | MOSTLY INVALID for Pipeline 3 — 11 of 21 sites are Pipeline 1 only | The pipeline map already tells us which 2-3 sites apply to Pipeline 3 |
| End-to-end change plan (21 sites) | LARGELY INVALID — optimized Pipeline 1's prompts | Replaced by the 5-fix plan in the pipeline map HTML |

What's salvageable:

| Artifact | Status |
|---|---|
| v1 grounder test | VALID — grounder is pipeline-independent. Useful for grounding-step contamination. |
| Voice spec Laban-pure refactor (this session) | VALID — both pipelines read voice/infinex.ts |
| operator_hint archive + canonical_shorthand | VALID — voice spec layer change |
| Pipeline map (HTML) | VALID — should have been built first, not last |
| Corpus + literary anchor BENCHMARKS | VALID — re-apply to Pipeline 3 captions |
| Mirodan canon source-indexing in `actor-memory.ts` | UNCHANGED — already correct, didn't touch |

**Estimated wasted operator + agent time:** ~12 hours of session work focused on Pipeline 1 when Pipeline 3 was the production target.

**Estimated wasted API spend:** ~$15 (v2 test) + ~$3 (v1 test) ≈ $18 in tests on the wrong pipeline. Plus an unknown amount of Opus inference reading and writing 21-site change plans, 11 contamination audits, etc. — Anthropic inference for the agent itself. Materially significant but hard to estimate without the cost dashboard.

## Skills / rules to encode

These are anti-patterns I demonstrated; encoding them as skills should prevent recurrence.

### Skill 1: `pipeline-orientation-first`

**Trigger:** any task that involves modifying or analyzing a multi-stage generator/audit/validator system, OR any session where the operator asks about quality of generated outputs, OR before writing any test that exercises end-to-end generation.

**Mandate (rigid):**
Before writing ANY analysis, test, change plan, or contamination audit:
1. Grep for env flags / arch toggles: `grep -rn "process.env\.[A-Z_]*ARCH\|process.env\.[A-Z_]*_FLAG\|process.env\.[A-Z_]*_MODE" src/ harness/ apps/ 2>/dev/null`
2. Read every production entry point end-to-end (harness server actions, deploy-target endpoints, public API handlers). NOT the CLI — CLI is often legacy.
3. Produce a pipeline map deliverable BEFORE any other artifact. Map: entry points, code paths, env gates, which path is default, which is gated.
4. Confirm the map with the operator. Then propose changes.

**Failure mode this prevents:** the exact thing I did — optimize a non-production path for 12 hours.

### Skill 2: `honor-standing-memories-before-test-design`

**Trigger:** before authoring any test, evaluation harness, or experimental scaffold that exercises a system the operator has established principles about.

**Mandate:**
1. List the relevant operator memories at the top of the test file as comments.
2. Verify the test design does not violate any memory principle.
3. If the test design would violate a memory, either STOP and ask the operator, or explicitly justify the deviation in the test file's docstring.

**Example violation in this session:** `[[methodology-actor-table-work-before-drafting]]` says "tempo is emergent from Deciding, never assigned." I built the v2 test with explicit TempoBeat[] declarations forcing tempo arcs. The memory was in context. I didn't check.

### Skill 3: `tests-announce-their-pipeline`

**Trigger:** any test or eval harness that invokes generation/validation/orchestration functions.

**Mandate:**
1. At the top of the test, log/assert which pipeline is being exercised.
2. Print the code path (e.g., "calling `generate()` with explicit beats → legacy single-call path per generator.ts:277-279").
3. Make the pipeline choice an explicit input parameter, not an implicit consequence of which function is imported.

**Example fix:** the v2 test should have had a top-of-file comment:
```ts
// Pipeline tested: Pipeline 1 (legacy single-call generator).
// Routed via: generate(card, {beats, ...}) → generator.ts:277-279 → legacySingleCall.
// NOT TESTED: Pipeline 3 (Actor/Director). To test Pipeline 3, swap to
// orchestrateActorDirectorWithRetries() from src/actor-orchestrator.ts.
```
That single comment would have caught the error during code review.

### Skill 4: `bigger-file-bias`

**Trigger:** when triaging multiple files that implement similar functionality.

**Mandate:**
1. Do not assume the larger file is the more current one. Often the opposite.
2. Check `git log --follow` on each file — newer commits often live in smaller files.
3. Check `git blame` for the entry point that the production deploy calls.

**Example violation in this session:** `src/generator.ts` is 1493 lines, `src/actor-director.ts` is 1035 lines. I treated them as equally weighted. The smaller file was the canonical one.

### Skill 5: `production-entry-first`

**Trigger:** orienting in a new codebase.

**Mandate:**
1. The CLI is usually legacy. Don't start there.
2. Start with the production deploy's entry point — the web app's server action, the cron job's main function, the public API handler.
3. Read that entry point end-to-end before any other file.
4. Trace through every branch in the entry point and identify what gates each.

## Handover to Codex — specific fixes to ship

Order matters. Codex should land these as separate PRs in this order:

### PR 1: Switch Pipeline 3 to default
**File:** `harness/app/actions/generate.ts`
**Change:**
- Line 65 currently: `if (process.env.HARNESS_GENERATOR_ARCH === 'actor') { return runActorGenerator(...) }`
- Either flip the gate (`if (process.env.HARNESS_GENERATOR_ARCH !== 'legacy')` defaults to actor), OR remove the env var check entirely and unconditionally call `runActorGenerator`.
- Tests in `harness/__tests__/` need verification.

**Also update:** `.env` should be cleaned up — remove `HARNESS_GENERATOR_ARCH=actor` if added as a workaround; the default is now actor.

### PR 2: Fix actor-memory.ts channel grammar
**File:** `src/actor-memory.ts:373`
**Change:**
```ts
// Before
"- X: up to 280 characters. Usually 3-4 short paragraphs/beats. Let sustained-feeling setup precede quick-feeling release.",

// After
"- X: up to 280 characters. Beat count emerges from verb selection (Mirodan §1.7, vol 2 p. 347). A single beat with Sustained→Quick motor inside it (e.g., Pressing→Punching) is legal and often correct. Multi-beat composition is for cases where the next circumstance forces a new local action.",
```

### PR 3: Un-hardcode "Infinex character"
**File:** `src/actor-director.ts:429`
**Change:**
```ts
// Before
"page_2_character_rehearsal": "how the Infinex character stands in this circumstance",

// After
"page_2_character_rehearsal": "how the character stands in this circumstance",
```

### PR 4: Apply Variant C to card.ts docstrings
**File:** `src/card.ts:48, :61-62`
**Change:** see `research/card-docstring-variants-2026-05-28.html` for full Variant C text. Strip the "bank wall dissolved" example; replace with canon-reference + forbidden-list.

### PR 5: Strip wall anchor from voice/cream.ts
**File:** `src/voice/cream.ts:22, :361`
**Change:** remove "section by section" from the comments and any related wall-anchor vocabulary.

### PR 6 (after re-test confirms Pipeline 3 is the right path): Tag the pre-deletion commit
```bash
git tag -a legacy-pipeline-final -m "Last commit with Pipeline 1 (legacy generator) + Pipeline 2 (legacy + LLM validator) before deletion. Recovery: git checkout legacy-pipeline-final."
git push origin legacy-pipeline-final
```

### PR 7 (deletion): Remove legacy code
See `research/legacy-pipeline-archive-2026-05-28.md` for the full file list. Deleted files:
- `src/generator.ts` (1493 lines)
- `src/validator.ts` (840 lines)
- `src/validator-llm.ts` (849 lines)
- `src/validator-active.ts` (326 lines)
- `src/orchestrator.ts` (388 lines) — keep `Pick`, `OrchestrationResult` types if shared
- `src/eval.ts` (109 lines)
- Tests: `src/__tests__/generator.test.ts`, `validator.test.ts`, `validator-active.test.ts`, `orchestrator.test.ts`, `eval.test.ts`
- Harness legacy branch in `harness/app/actions/generate.ts:346-440`
- `voice/infinex.ts:defaultBeatsForKind()` and its callers

**DO NOT touch:** `src/copy-rewrite-llm.ts` (separate tool — deferred decision). `eval/permutation-prompts/*` (classifier eval — separate concern). `eval/mirodan-competence/*` (classifier eval).

**Open question for the operator before PR 7:** keep `validator.ts` regex rules (~150 lines) as a Pipeline 3 deterministic pre-filter? See `research/legacy-pipeline-archive-2026-05-28.md` deferred decision #3.

### PR 8 (data plumbing for the harness UI)
After Pipeline 3 becomes the default, the harness UI may need schema updates:
- `harness/lib/queries.ts` and `harness/lib/types.ts` may reference legacy fields (`declared_beats_json`, etc.) that are different in Pipeline 3 (actor_table_work, actor_movement_receipt).
- Check `harness/components/AttemptPanel.tsx` and `harness/components/CandidateCard.tsx` for legacy field references.
- Mock data at `harness/lib/mock-data.ts:158` has wall-flavored sample copy — rewrite to reflect Pipeline 3's expected output shape.

## What I would do differently next time

If I started this session over:

1. **Hour 1:** Grep `HARNESS_GENERATOR_ARCH` and `process.env.*ARCH*` across the repo. Read `harness/app/actions/generate.ts` end-to-end. Build the pipeline map HTML. Confirm with operator.
2. **Hour 2:** Read `src/actor-director.ts` and `src/actor-memory.ts` in full. Read `src/actor-orchestrator.ts`. Map the Actor/Director architecture.
3. **Hour 3:** ONLY THEN design any test or contamination audit. Verify the test exercises the production path (Pipeline 3). Add the "pipeline announcement" comment at the top of the test file.
4. **Hour 4-onward:** Tests and analysis on the correct artifact.

The pipeline map I built at the end was a 30-minute task. Doing it first would have saved 11+ hours of misallocated work.

## What to do with this postmortem

1. **Operator:** review the skill drafts above; install whichever are useful via `superpowers:writing-skills`.
2. **Codex:** ingest the "Handover to Codex" section. Land PRs 1-5 first (the surgical fixes). Wait for operator approval before PR 6-7 (deletion).
3. **The agent (me, future sessions):** if this postmortem ever surfaces in context, the highest-leverage takeaway is: **build the pipeline map before any other artifact when working with multi-pipeline codebases.** Everything else flows from getting orientation right.

The framework wasn't wrong. The Mirodan analysis wasn't wrong. The Laban-pure refactor wasn't wrong. The wall finding wasn't wrong. What was wrong was the SUBJECT of analysis — Pipeline 1 instead of Pipeline 3. Orientation is everything.
