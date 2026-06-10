# Architecture

This document is the ground-zero orientation for engineers taking over
`comms-factory`.

## Product Shape

`comms-factory` is an automated comms pipeline and local operator workbench for
Infinex release copy.

The core invariant:

```text
the machine may write only after it has earned context
the judge must stay separate from the writer
the human owns final publication
```

Pipeline 3 is the current working architecture:

```text
brief
  -> grounder
  -> ReleaseCard
  -> Actor
  -> deterministic validator
  -> blind Director
  -> operator decision
  -> ship gate
```

The app on `http://localhost:3210` is the local operator workbench around that
pipeline. It is not intended to be the permanent production UI.

## Main Components

### 1. Grounder

Entry point: `src/fact-grounder-llm.ts`

The grounder receives a release brief and produces verified facts. The LLM
reasoning loop and logical Anthropic tool names live in `src/fact-grounder-llm.ts`
and `src/research-tools.ts`.

Production execution goes through `src/capability-plane.ts`, which maps each
logical tool to a native `{tool, method}` and calls Centaur's tool plane
(`POST /tools/{tool}/{method}`, via the local client in `src/centaur-tools.ts`).
Job/thread/stage/trace ride `X-Centaur-*` headers plus an `Idempotency-Key`; the
request body is the raw method input. Centaur owns repo search/read, ref
discovery, web fetch, browser render, search/X access, network policy, and typed
tool errors (a non-ok `tool_result.v1` envelope becomes model-visible
`UNAVAILABLE:`/`ERROR:` text — never evidence). Returned `EvidenceItem` records
stay separate from concise model-visible tool text and flow into fact receipts.

Explicit local-dev fallback sources remain under `src/fact-grounder/sources/`:

- `branch-discovery.ts`
- `platform-code.ts`
- `partner-registry.ts`
- `infinex-pages.ts`
- `public-page.ts`
- `rendered-page.ts`
- `projectjin-research.ts`

Those local modules are not production service dependencies. The attached service
must not require a mounted platform checkout, `gh`, ProjectJin, agent-browser, or
service-local JSON API allowlists. This follows the execution-boundary learning in
`docs/solutions/best-practices/guard-the-primitive-and-execution-boundary-2026-06-01.md`.

### 2. Release Card

Entry point: `src/card.ts`

`ReleaseCard` is the fact and framing contract for every downstream stage. The
important field is:

```ts
deployed_facts: string[]
```

Generated copy may assert only facts contained in that array. The inner-work
fields such as `through_action`, `obstacle`, `lining`, `reader_prior`, and
`not_the_point` guide interpretation; they are not publishable claims.

### 3. Actor

Entry point: `src/actor-director.ts`

The Actor receives the release card and all requested channels in one call. It
produces:

- warm-up / rehearsal
- shared table work
- channel beat plans
- performance candidates per channel
- fact receipts
- movement receipts
- selected-performance recommendations

The Actor must not choose or declare tempo. It plays objective verbs and Working
Actions; tempo is read later by the Director.

Actor/Director memory reads its canonical Mirodan source bundle from
`third_party/mirodan/`. That bundle includes chapters 1-4, the summarized
Laban/Mirodan reference, the primary Vol. 2 PDF, and the original source-location
note. `src/actor-memory.ts` records existence, byte size, and SHA-256 hashes for
each source in every memory pack.

### 4. Deterministic Validator

Entry point: `src/validator.ts`

This is the instant front door before LLM judgment. It rejects:

- cliches and listicle voice
- AI-slop phrases and em-dashes
- antagonism toward named competitors
- off-spec drive language
- claimed competitor palettes
- unsupported numeric / URL / readiness claims
- invalid movement-score wiring from Actor candidates

Add a validator rule only with tests.

### 5. Director

Entry point: `src/actor-director.ts`

The Director audits final prose blind. It does not receive the Actor's table
work. It returns separate gates for:

- copy / voice fit
- factual fit against the release card
- publication readiness
- movement evidence and Mirodan classification
- notes for the next Actor attempt

The Director's output is currently coupled to generation. The standalone service
shape is specified in `docs/SPEC-director-as-service.md`.

### 6. Actor/Director Orchestrator

Entry point: `src/actor-orchestrator.ts`

The orchestrator runs up to three Actor attempts. Each attempt:

1. calls the Actor once for all requested channels;
2. validates each candidate deterministically;
3. sends script-passing candidates to the blind Director;
4. ranks passing candidates by channel;
5. converts failures into Director notes and appends them to the Actor transcript
   for the next retry.

The transcript is persisted/replayed. There is no hidden provider memory.

### 7. Harness

Entry point: `harness/`

The harness is a local Next.js app on port `3210`. It stores state in local
SQLite (`harness/harness.db`, ignored by git).

Primary pages:

- `/`: card queue, agreement summary, positioning spine
- `/cards/[id]`: four-stage workflow for one release
- `/director`: standalone Director console for human-written copy checks
- `/eval`: candidate triage
- `/positioning`: cross-launch table-work rollup

Primary server actions:

- `harness/app/actions/research.ts`: create cards, run grounder, decide facts
- `harness/app/actions/card.ts`: build/edit/approve release cards
- `harness/app/actions/generate.ts`: run Pipeline 3, persist attempts/audits
- `harness/app/actions/ship.ts`: approve final picks and mark destinations
- `harness/app/actions/agreement.ts`: recompute agreement metrics

The schema in `harness/lib/schema.sql` is the canonical local persistence model.

## Data Flow In The Harness

1. Operator creates a card from a brief.
2. Grounder verifies candidate facts and records a trace in `grounder_runs`.
3. Operator approves, edits, rejects, or manually adds facts.
4. Harness builds a `ReleaseCard` and persists it in `release_cards`.
5. Operator approves the card stage.
6. Harness runs Pipeline 3 by default:
   - `actor_attempts`
   - `actor_warmups`
   - `actor_run_events`
   - `candidates`
   - `director_audits`
   - `pipeline_runs`
7. Operator approves, edits, rejects, or retries candidates.
8. Approved copy is stored in `final_picks`.
9. Ship gate records destination readiness. It does not auto-post to X.

## Pipeline Identity

Pipeline 3 runs are explicitly proven through `src/pipeline-identity.ts` and
persisted to `pipeline_runs`.

A run should not be reported as Pipeline 3 unless the proof shows:

- `HARNESS_GENERATOR_ARCH=actor`
- entrypoint is `orchestrateActorDirectorWithRetries()`
- `actor_attempts` rows exist
- live `actor_run_events` rows exist
- candidate rationale contains Actor option markers
- Director audit JSON contains split gates

The harness displays this proof before candidate review.

## Legacy Paths

Legacy generator/orchestrator code still exists in:

- `src/generator.ts`
- `src/orchestrator.ts`
- legacy branches inside `harness/app/actions/generate.ts`

Keep it as rollback until production migration is complete, but do not route new
handoff work through it. New work should preserve the feature flag:

```bash
HARNESS_GENERATOR_ARCH=actor|legacy
```

## Production Boundary

The local harness remains a local process + `.env` + SQLite workbench.

The production service boundary is the HTTP API in `services/api/`:

- `POST /audit`: standalone blind Director; never self-grounds.
- `POST /ground`: accepts `comms_factory.ground_from_capabilities.v1` and routes
  research execution through Centaur's native tool plane (`/tools/{tool}/{method}`).
- `POST /build-card`: converts approved facts into a ReleaseCard.
- `POST /generate`: grounded Actor pipeline; returns `no_external_posting: true`.

Centaur owns workflow durability, Slack/ship overlays, tool authorization, and
backing tool/network permissions. See `docs/ROADMAP.md` for phasing.
