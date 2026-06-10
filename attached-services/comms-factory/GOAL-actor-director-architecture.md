# Goal: Actor/Director Generation Architecture

Implement the actor/director generation architecture end to end in `comms-factory`, locally only. Build it to be Centaur-ready, but do not move anything into Centaur yet.

## Safety And Rollback

- Inspect current git status before editing.
- Create a local rollback checkpoint of the current worktree state. Do not run destructive git commands. Do not reset or revert user/Claude changes.
- Keep the existing two-call generator path intact as legacy rollback.
- Add a feature flag, for example `HARNESS_GENERATOR_ARCH=legacy|actor`, so we can switch back without reverting code.
- Default should remain `legacy` unless the actor path is fully verified.
- Do not collapse actor and director.
- Do not remove the legacy generator.
- Do not introduce destructive database migrations.

## Canonical Mirodan Source Rule

Before building `ActorMemoryPack` or `DirectorMemoryPack`, read the canonical Mirodan source files:

- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch1-basic-concepts.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch2-attitudes.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch3-drives.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch4-applications.md`
- `/Users/opaque/Downloads/nigel-session-2026-04-28/laban-mirodan-reference-2026-04-28.md`
- `/Users/opaque/Downloads/Mirodan-PhD-1997-Vol2.pdf`
- `/Users/opaque/.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/mirodan-source-files-location.md`

Treat `skills/laban-voice-for-ai-agents/references/*.md` and `src/voice/infinex.ts` as derived operational references, not primary truth. Every movement-system claim in actor/director memory must trace back to the canonical chapter files, combined reference, or PDF. Do not rely on model training data for Laban/Mirodan/Carpenter claims.

Add a source index or source-map artifact that records canonical paths and hashes used for actor/director memory packs.

## Target Architecture

Replace the production concept of "Stage A / Stage B" with:

- Actor Memory
- Table Work
- Performance
- Director Notes

The actor is one persistent character session per release card attempt. It must produce all requested channels together in one actor call per retry attempt, not one generator flow per channel.

"Persistent" should be implemented by persisted/replayed transcript, not hidden provider memory:

```text
system: Actor Memory
user: assignment
assistant: attempt 1 table_work + performances
user: director notes
assistant: attempt 2 table_work + performances
...
```

The actor never declares or targets tempo. It plays transitive verbs. Tempo is audience/director-read after the fact.

## Actor Memory Requirements

Build an explicit `ActorMemoryPack`, preferably from versioned prompt assets or clearly separated builders. It must include:

- full Laban/Mirodan/Carpenter movement corpus
- motion factors and poles: Strong/Light, Direct/Flexible, Quick/Sustained, Bound/Free
- working actions: punching, pressing, slashing, wringing, dabbing, gliding, flicking, floating
- inner attitudes: Stable, Near, Adream, Mobile, Remote, Awake
- which inner attitudes can be baseline characters and which are Action Attitudes only
- aspects: Penetrating, Enclosing, Advancing/Circumscribing, Retreating/Radiating, with canonical source handling if terminology varies
- stresses and how stress adds the third Motion Factor
- drives: Doing, Spell, Passion, Vision
- Mirodan drive derivation rules and the drive table needed for placement classification
- all 24 tempi as the surrounding world/corpus
- tempo as emergent/audience-read, not consciously selected by the actor
- transitive verbs as the playable unit
- Working Action preparation hierarchy
- Shadow Moves, Outer Action, Lining, and table-work method
- Infinex placement: Stable + Penetrating + Flow, `stable|penetrating|flow`, Spell to Vision
- Infinex allowed primary tempi and beat-only/reserve tempi
- Infinex anti-patterns, especially Passion/time-pressure drift
- product/world knowledge needed to write Infinex correctly
- channel grammar for X, web, in-product/modal/microcopy

The actor should know the whole movement world first, then its specific Infinex role inside that world.

## Actor Output Contract

Add a structured output type, for example `ActorOutput`:

```ts
interface ActorOutput {
  table_work: {
    thesis: string;
    through_action: string;
    obstacle: string;
    reader_prior: string;
    lining: string;
    not_the_point: string;
    channel_beat_plans: Record<Channel, ActorBeatPlan[]>;
  };
  performances: Record<Channel, ActorPerformanceCandidate[]>;
}
```

Each performance candidate must include:

- `text`
- `rationale`
- `deployed_facts_used`
- `not_said`

Beat plans contain verbs, micro-objectives, obstacles, and optional shadow moves. They contain no tempo field. Preserve the fact contract: only assert claims from `card.deployed_facts`.

## Director Requirements

Implement a Director separate from the Actor. Engineering name can be validator, but product/concept name should be Director.

The Director receives the candidate/performance blind. It should not see actor table work before classifying the prose.

The Director must receive the full 24-tempo taxonomy and full motion-factor vocabulary. It classifies by mechanical evidence, not vibe:

- sentence pressure
- syntax shape
- direct vs flexible pathing
- strong vs light weight
- bound vs free flow
- quick vs sustained timing
- working actions present
- relation to reader
- claim posture

Director output must include structured evidence:

- `primary_tempo` from all 24, or `unknown`
- confidence
- motion evidence by factor
- working action evidence
- drive/placement read
- Infinex legality
- factual issues
- voice issues
- notes for actor

Director notes should be movement-corrective, for example: "keep Directness but remove quick attack; convert punch to press."

Use a fresh/blind Director pass per retry attempt so the validator is not merely agreeing with its own previous note.

## Orchestration

Add an actor/director retry orchestrator:

- max 3 actor attempts
- one actor call handles all channels for that attempt
- deterministic regex/fact checks remain as script-supervisor prefilter where useful
- Director audits candidates that survive deterministic checks
- if no pass, synthesize Director Notes and append to the actor transcript
- stop after 3 attempts and surface failure clearly

Expected call shape for web+X should become max 3 actor calls plus director calls, not 12 generator calls.

## Persistence

Add additive schema only:

- `actor_attempts`
- `director_audits`
- optionally `actor_attempt_id` on `candidates` if safe and idempotent

Store:

- `source_index_json`
- prompt version
- prompt hash
- model
- channels JSON
- actor prompt/messages/transcript
- actor raw response
- parsed table work JSON
- director notes in JSON
- per-candidate director audit JSON

Existing `generator_attempts` remain for legacy runs. Existing cards/candidates should still render.

## Harness UI

Update attempt display to distinguish:

- legacy two-call attempt
- actor/director attempt

Show:

- actor memory/prompt version and hash
- source index / canonical source hashes
- actor transcript
- table work
- performances by channel
- deterministic/script-supervisor failures
- Director read
- Director notes fed into next attempt

Make old attempts visibly historical/legacy so old prompts do not look like current truth.

## Tests

Add tests for:

- actor memory/source-map composition
- memory claims assembled from canonical source artifacts, not only derived references
- `ActorOutput` parsing
- director prompt includes 24 tempi and motion-factor evidence requirements
- all channels generated in one actor call per attempt
- retries append director notes to the same actor transcript
- director does not see table work during blind classification
- max attempts is 3
- legacy path still works
- fake-client harness integration proving web+X no longer does 12 generator calls

Run:

```bash
pnpm test
pnpm typecheck
```

## Verification

Render or persist prompt examples for inspection.

Re-run the linked card or a fake-client equivalent and report:

- number of actor calls
- number of director calls
- prompt sizes
- source-map hashes
- whether table work, performance, and director notes persisted

Re-run W9/W10 evals if available:

- W9 Mirodan-specific pass rate target >=85%
- W10 placement-hit >=40%, locked-tempi >=60%, Passion <=15%

If evals cannot run, say exactly why.

## Constraints

- Do not move to Centaur yet.
- Do not collapse actor and director.
- Do not make actor choose tempo.
- Do not shrink context aggressively. Prefer over-complete memory first; optimize later.
- Do not hard-code claims outside `deployed_facts`.
- Do not revert existing unrelated worktree changes.
- Use `apply_patch` for manual edits.

## Final Deliverable

- Code implemented.
- Tests/typecheck run.
- Clear summary of files changed.
- Clear rollback instructions:
  - feature flag to return to legacy
  - commits/files to revert if needed
  - DB additions and why they are non-destructive
