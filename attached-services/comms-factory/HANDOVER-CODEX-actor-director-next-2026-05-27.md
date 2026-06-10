# HANDOVER - Actor/Director Pipeline Next Steps - 2026-05-27

This is a self-contained handover for picking up the Infinex Actor/Director work from scratch.

Repo:

```text
/Users/opaque/.superset/projects/comms-factory
```

Local harness card:

```text
http://localhost:3210/cards/01KS6QJNEGFYP6X048V8Y900DM
```

Primary review HTML:

```text
research/actor-run-review-01KS6QJNEGFYP6X048V8Y900DM.html
```

Do not expose or print API keys. `.env` and `harness/.env.local` contain the local env needed for live calls.

## Core Objective

The product goal is not "make a generic copy generator." It is:

1. Use the operator's expertise in Mirodan/Laban/Malmgren/Carpenter to build fixed, actor-like brand characters.
2. Use that fixed character to make Infinex, Nigel, Cream of the Crop, etc. sound like people rather than generic AI.
3. Preserve character against drift with a separate Director/validator/audience pass.

The desired shape is:

```text
Release card
-> Actor memory + character memory + card facts
-> Actor table work + rehearsal + multiple performances
-> Script/regex hard gates
-> Blind Director reads final prose
-> Director notes if needed
-> same Actor retries with notes
-> harness persists every artifact for operator review
```

The Actor should not consciously name or target tempo. The Actor plays transitive objective verbs through Mirodan Working Actions. The Director/audience reads tempo after the fact.

## Canonical Source Priority

Use local canonical Mirodan docs before any handover, comments, or model guesses.

Canonical local sources:

```text
/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch1-basic-concepts.md
/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch2-attitudes.md
/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch3-drives.md
/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch4-applications.md
/Users/opaque/Downloads/nigel-session-2026-04-28/laban-mirodan-reference-2026-04-28.md
```

Important canon already established:

- A tempo/variation is named from exactly two Motion Factors for the relevant Attitude/state.
- A Working Action uses Weight + Space + Time and is motor/rhythm, not the whole tempo taxonomy.
- Strong + Direct = Stable/Commanding shape.
- Strong + Sustained is not Commanding.
- Direct + Sustained is not Commanding.
- Light + Direct = Self-contained shape.
- Bound/Free Flow is stress/context for Stable, not part of the two-factor Stable tempo name.
- Quick actions require sustained preparation in the same score:
  - Pressing -> Punching
  - Wringing -> Slashing
  - Gliding -> Dabbing
  - Floating -> Flicking
- Same-Time-pole pairings are not strict arrows unless canon gives the sustained->quick preparation pair.
- Mirodan's OR construction in the 24 Outer Interpretations is a directional-intent axis, not a yielding/contending split.

## Current Architecture Names

Avoid "Stage A/Stage B" in discussion unless referring to the legacy generator code. The current work is better named:

```text
Actor table work
Actor rehearsal / warm-up
Actor performance options
Script supervisor / regex hard gates
Blind Director audit
Director notes
Actor retry
```

The legacy generator still has Stage A/B comments in `src/generator.ts`. That path is not the new Actor/Director harness path unless `HARNESS_GENERATOR_ARCH` is unset.

## What Was Just Implemented

### 1. Director sees all script-passing Actor options

Status: implemented and verified.

Before:

- Actor wrote 5 options per channel.
- Actor selected one favorite.
- Only that selected favorite went forward.
- Director never saw the rest of the option pool.

Now:

- Actor still writes exactly `n` final-copy options per requested channel.
- Actor still recommends one favorite per channel.
- `selected_performances` is only recommendation metadata.
- `actorOutputToCandidates()` emits every option as a candidate.
- Regex/script validation runs per option.
- Every script-passing option goes to the Director.

Important code:

```text
src/actor-director.ts
  buildActorAssignmentMessage()
  actorOutputToCandidates()

src/actor-orchestrator.ts
  orchestrateActorDirectorWithRetries()
```

Current caveat:

- The Director sees the option pool, but the orchestrator still picks the first passing candidate per channel.
- It does not yet rank all passing candidates and choose the best.
- This matters because multiple mediocre options can pass, and first pass is not necessarily best pass.

Likely next fix:

```text
Replace pickFirstPassingByChannel() with a ranked selection step:
- consider all records per channel
- reject failed regex / failed draft gate
- rank passing Director audits by legal fit, primary confidence, voice issues, rail-token excess, operator preferences
- persist the reason for final pick
```

### 2. Director gates split into copy/voice, factual, publication

Status: implemented and verified.

Before:

- `passed` was overloaded.
- A line could be blocked because code/live-product readiness was not confirmed.
- That made sense for autonomous posting, but not for draft generation while the operator is preparing copy.

Now Director outputs:

```json
{
  "passed": false,
  "copy_voice_passed": false,
  "factual_passed": false,
  "publication_gate_passed": false
}
```

Draft pass means:

```text
copy_voice_passed && factual_passed && infinex_fit.legal
```

Publication gate is separate:

```text
publication_gate_passed
publication_gate_issues
```

So draft generation can continue even when live posting should still be blocked.

Important code:

```text
src/actor-director.ts
  DirectorAuditResult
  buildDirectorUserMessage()
  parseDirectorAudit()

src/actor-orchestrator.ts
  directorDraftPassed()
  directorFailureReason()

harness/app/actions/generate.ts
  directorPassed persistence now uses draft gate, not publication gate

harness/components/CandidateCard.tsx
  UI displays copy/voice, factual, publish gates separately

scripts/build-actor-run-review.mjs
  HTML review displays the split gates
```

## What 3-5 Are

These are the remaining items from the numbered plan.

### 3. Movement receipt decision

Status: partially implemented, not conceptually settled.

What `movement_receipt` is:

```text
The Actor's claim that an exact text span carries a specific Mirodan Working Action.
```

Example shape:

```json
{
  "text_span": "Your Infinex account can now receive a bank transfer.",
  "objective_verb": "to reveal",
  "working_action": "pressing",
  "evidence": "single weighted sentence, held without expansion"
}
```

What is currently load-bearing:

- Missing receipt fails script validation.
- Illegal Working Action fails script validation.
- Receipt Working Action absent from channel score fails script validation.
- `text_span` not appearing exactly in final text fails script validation.

Important code:

```text
src/actor-orchestrator.ts
  validateActorMovement()
```

What is not load-bearing yet:

- The system does not prove the text span actually feels like pressing, punching, gliding, etc.
- Regex can only check structure and consistency.
- The semantic truth of "this sentence is pressing" is still Director/audience judgement.

Why this matters:

- The receipt can become fake accounting if it is only an ornament.
- In latest run, one web option failed regex because receipt used `gliding` while the web channel score only had `pressing`. That is a useful hard fail.
- But if the model says "this is pressing" for any sentence, regex cannot know whether that is true.

Decision needed:

Option A - make movement receipts genuinely load-bearing:

- Keep `movement_receipt`.
- Director explicitly audits whether the receipt/action claim is true in prose.
- HTML surfaces discrepancies between Actor receipt and Director working_actions.
- Retry notes can say "you claimed pressing, but the prose reads dabbing/commanding/punching."

Option B - demote movement receipts to debug-only:

- Keep them in rationale/UI for operator inspection.
- Stop hard-failing otherwise decent copy because of receipt mismatch.
- Regex still checks no tempo leak and basic movement_score legality.

Current recommendation:

Keep `movement_receipt`, but define it as "traceability + Director-checkable claim," not truth by itself. Regex should catch impossible wiring; Director should judge actual movement truth.

### 4. Retry notes less deforming

Status: defined, not implemented enough.

Problem:

- Director notes can over-deform the next Actor attempt.
- The Actor may throw away a good table-work/motor score just because one local line failed.
- Example risk: attempt 1 has press/press/punch rhythm; Director says the visible drive is wrong; retry mutates into wring/slash or a different rhythm instead of preserving the correct motor and fixing the target.

Desired rule:

```text
On retry, preserve the prior table-work and Working Action score unless the Director specifically diagnoses that table-work or motor as failing.
```

The note should distinguish:

```text
keep:
- through_action
- channel beat count
- objective verbs
- Working Actions / preparation hierarchy

change:
- final wording
- fact selection
- rail/token excess
- visible drive target
- factual issue
- line-specific voice issue
```

Likely implementation:

- Change `DirectorNotes` into a structured shape, not just free text.
- Include fields like:

```ts
interface DirectorNotes {
  attempt: number;
  summary: string;
  notes: string[];
  preserve?: {
    through_action?: boolean;
    beat_plan?: boolean;
    working_actions?: boolean;
    objective_verbs?: boolean;
  };
  change?: {
    copy?: string[];
    facts?: string[];
    voice?: string[];
    movement?: string[];
  };
}
```

- Update `buildDirectorNotesMessage()` so it tells the Actor:

```text
Do not change the prior table work, objective verbs, or Working Actions unless a note explicitly says the motor/table-work failed.
```

Current related code:

```text
src/actor-director.ts
  buildDirectorNotesMessage()

src/actor-orchestrator.ts
  summarizeDirectorNotes()
```

### 5. Run small corpus and inspect quality

Status: not done after the latest code changes.

The immediate single-card live run was done. A corpus run is still needed.

The right order:

1. Finish movement receipt policy enough that failures mean something.
2. Finish retry-note preservation enough that retries do not scramble good table-work.
3. Run a small corpus, not just the current Bridge card.
4. Generate HTML.
5. Inspect quality by human/operator judgement and Director distributions.

Suggested corpus:

```text
cards/eval/account-abstraction-launch-2024-09-15.json
cards/eval/deposits-milestone-2025-07-22.json
cards/eval/passkey-recovery-audit-2025-12-05.json
cards/eval/perps-live-2025-03-04.json
cards/eval/usdc-to-yield-split-2025-10-04.json
```

What to measure:

- Are outputs actually usable?
- Are they over-naming rails: wire, SEPA, EUR, PIX, BRL, IBAN, routing number?
- Are they over-defaulting to "account holds it", "territory", "wall", "map"?
- Are they getting nauseatingly repetitive?
- Are they mostly Commanding/Self-contained?
- Are Director passes too permissive?
- Do regex hard fails catch only real hard fails?
- Are publication gate failures separated from draft quality?
- Does the Actor still do real table-work/rhythm, or only rationalize after writing?

## Latest Live Run State

Card:

```text
01KS6QJNEGFYP6X048V8Y900DM
```

Fresh run:

```text
attempt 4
warmup mode: scene_rehearsal
options: 5 per channel
channels: web, x
```

Current DB counts for this card:

```text
actor_attempts: 4
candidates: 16
director_audits: 15
actor_run_events: 62
```

Attempt 4 results:

```text
web: 5 Actor options
  4 regex/script pass
  1 regex/script fail
  2 draft pass
  primary reads among audited web mostly Commanding

x: 5 Actor options
  5 regex/script pass
  5 draft pass
  primary reads: Commanding, Sociable, Self-contained

run completed with 2/2 channel picks
```

Important: the direct `tsx` invocation persisted the run, then failed after persistence because `revalidatePath()` requires a Next static-generation store. That is a tooling issue from calling a server action outside Next, not a generation failure.

Error seen after persistence:

```text
Invariant: static generation store missing in revalidatePath /cards/01KS6QJNEGFYP6X048V8Y900DM
```

Avoid that by clicking in the harness UI, or add a CLI-safe runner that calls the underlying actor/orchestrator persistence without `revalidatePath()`.

Review HTML regenerated:

```text
research/actor-run-review-01KS6QJNEGFYP6X048V8Y900DM.html
```

`scripts/build-actor-run-review.mjs` was patched to use a larger `execFileSync` maxBuffer because Director audits now include large prompt/raw-response JSON.

## Main Quality Finding From Attempt 4

The plumbing works. The quality is not done.

The Director is passing many candidates as `commanding`.

This is not a pure code bug. Current Director memory explicitly says:

```text
Primary allowed tempi are legal by definition.
Do not mark commanding, practical, sombre, irradiant, or sociable illegal solely because of their factor shape.
```

So if Commanding is one of the five allowed Infinex tempi, the Director can read a line as Commanding and still pass it.

This means the next question is not "why did routing fail?" It is:

```text
What should selection prefer when several allowed tempi pass?
```

Possible answers:

1. Commanding is genuinely allowed and often right for this product card.
2. Commanding is allowed but should not dominate; ranking should prefer better fit against the intended beat/through-action.
3. Commanding is being over-read because many sentences are Strong + Direct, and the Actor is not producing enough non-Commanding rhythm.
4. Director legality is too permissive because "allowed tempo" became "pass," rather than "allowed but maybe not best."

Likely fix:

- Keep allowed tempi legal.
- Add a ranking layer or Director score that separates:
  - legal
  - good
  - best for this card/channel
- Do not make every non-ideal allowed tempo a hard fail.

## Known Current Anti-Patterns

From operator review and latest runs:

- Over-reliance on rails/account nouns:
  - wire
  - bank transfer
  - routing number
  - IBAN
  - fiat
  - USDC
  - on-chain
- Repetitive metaphors:
  - wall
  - map
  - territory
  - account holds it
- Some lines feel translated/awkward.
- Some Director explanations still rationalize too much.
- The Actor can write decent lines, but also a lot of mid/slop options.
- The Director can fit circles into squares if the prompt lets it.

## Regex Status

Regex/script validation is still useful for hard fails:

- em dash
- length
- unsupported numerics/facts
- illegal movement labels
- missing movement score/receipt
- movement receipt mismatches

Regex should not decide Mirodan quality.

Current stance:

```text
Regex = hard mechanical/script supervisor.
Director = Mirodan/audience/character judge.
Verifier/eval = broader gold-standard classifier when running corpus.
```

Do not sunset regex entirely yet. Sunset or demote only rules that block plausible passes. Keep hard mechanical failures.

## Commands Already Verified

These passed after the latest code changes:

```bash
pnpm test -- src/__tests__/actor-director.test.ts
pnpm typecheck
```

Note: because of the current Vitest config/worktrees, the focused test command still ran the full discovered suite:

```text
34 test files
549 tests
all passed
```

## How To Reproduce The Latest Review

Regenerate the actor run review HTML:

```bash
node scripts/build-actor-run-review.mjs 01KS6QJNEGFYP6X048V8Y900DM
```

Inspect the latest attempt from SQLite:

```bash
sqlite3 -header -column harness/harness.db "
select
  c.attempt,
  c.channel,
  c.validation_passed as regex,
  d.passed as draft,
  json_extract(d.director_audit_json,'$.copy_voice_passed') as copy,
  json_extract(d.director_audit_json,'$.factual_passed') as facts,
  json_extract(d.director_audit_json,'$.publication_gate_passed') as pub,
  json_extract(d.director_audit_json,'$.primary_tempo') as tempo,
  json_extract(d.director_audit_json,'$.infinex_fit.legal') as legal,
  substr(replace(c.text, char(10), ' / '),1,100) as text
from candidates c
left join director_audits d on d.candidate_id=c.id
where c.card_id='01KS6QJNEGFYP6X048V8Y900DM'
  and c.attempt=(select max(attempt) from candidates where card_id='01KS6QJNEGFYP6X048V8Y900DM')
order by c.channel, c.created_at;
"
```

Run the harness path through UI rather than `tsx` server-action import:

```text
Open http://localhost:3210/cards/01KS6QJNEGFYP6X048V8Y900DM
Reset generator phase if desired
Run generator
Watch live actor/director events
```

If using shell env for local experiments:

```bash
set -a
source .env
source harness/.env.local
set +a
HARNESS_GENERATOR_ARCH=actor
HARNESS_ACTOR_WARMUP=scene_rehearsal
```

Do not print secrets.

## Files Touched In This Slice

Primary new/changed files for Actor/Director path:

```text
src/actor-director.ts
src/actor-orchestrator.ts
src/actor-memory.ts
src/__tests__/actor-director.test.ts
harness/app/actions/generate.ts
harness/components/CandidateCard.tsx
scripts/build-actor-run-review.mjs
```

Other harness/live visibility work already exists in this working tree:

```text
harness/app/api/cards/[id]/actor-events/route.ts
harness/components/ActorRunEventsPanel.tsx
harness/lib/schema.sql
```

The worktree is dirty and contains many unrelated/in-flight files. Do not reset or revert broad changes.

## Recommended Next Session Plan

Start here:

1. Read this handover.
2. Open the review HTML:

```text
research/actor-run-review-01KS6QJNEGFYP6X048V8Y900DM.html
```

3. Inspect attempt 4, especially:

- all web options
- all x options
- Director pass reasons for Commanding
- the one regex movement-receipt failure
- final picks

4. Decide movement receipt policy:

```text
load-bearing with Director truth check
or
debug-only / softer regex
```

5. Implement retry-note preservation:

```text
preserve table-work/motor unless specifically failed
```

6. Change final selection:

```text
from "first passing by channel"
to "best passing by channel"
```

7. Run small corpus and regenerate review HTML.

## Suggested Goal Prompt For A Fresh Session

```text
/goal In /Users/opaque/.superset/projects/comms-factory, continue the Infinex Actor/Director pipeline from HANDOVER-CODEX-actor-director-next-2026-05-27.md. First inspect the latest review HTML and attempt-4 DB state for card 01KS6QJNEGFYP6X048V8Y900DM. Then implement the remaining items: define/fix movement_receipt policy, make Director retry notes preserve table-work/motor unless explicitly failed, change channel selection from first pass to best pass, and run a small corpus/report to evaluate quality. Use canonical local Mirodan docs for any Mirodan claims. Do not expose API keys, do not reset unrelated work, and verify with typecheck/tests.
```

