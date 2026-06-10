# Implementation spec — Phase 3 (Codex)

This document is the contract for the Phase 3 implementation. Phase 1 (scaffold) is complete; the visual treatment pass will be handled separately by Claude Code Design. Your job (Codex) is to make the harness actually work end-to-end: persistence, diff capture, agreement metrics, and the Server Actions that wrap the existing TS pipeline.

**Hard rule:** do not change the data model defined here without flagging it back to Claude (the original spec author). The schema and Server Action shapes are interface contracts other agents depend on.

**Hard rule:** do not change `harness/lib/types.ts` field names or `harness/lib/schema.sql` table/column names without flagging. Visual components (Claude Code Design's pass) bind to these names.

---

## 0. Context — what this app is and isn't

`harness/` is a temporary training-and-validation tool. Its job: bring each pipeline stage to ≥80% operator agreement, then retire. It wraps the existing pipeline in `comms-factory/src/`:

- `src/fact-grounder-llm.ts` — Sonnet agent that verifies claims
- `src/card.ts` — ReleaseCard Zod schema
- `src/generator.ts` — Opus generator with beat-sequence prompt
- `src/validator.ts` + `src/validator-llm.ts` — regex + classifier + LLM judge
- `src/orchestrator.ts` — per-channel picker with retry loop
- `src/voice/{infinex,cream,projectjin,nigel}.ts` — character specs
- `scripts/classify-corpus.ts` — v2 classifier (gold-standard judge)

The harness is a UI on top of those. It does NOT reimplement the pipeline. Every stage Server Action calls the existing pipeline function and persists the result + the operator's decision.

The deliverable: the operator can walk a release event through 4 stages, see input + output + decision at each, and the system captures every approve / edit / reject as structured training signal.

---

## 1. Persistence layer

### 1.1 Schema

Authoritative schema lives at `harness/lib/schema.sql`. It defines: `cards`, `facts`, `fact_edits`, `release_cards`, `release_card_edits`, `candidates`, `candidate_decisions`, `final_picks`, `agreement_snapshots`, `stage_durations`. Read it first.

### 1.2 Database access

Use `better-sqlite3` (synchronous, fast, simple). The skeleton `getDb()` in `harness/lib/db.ts` is the entry point — extend it.

- Database file path: `harness/harness.db` by default, overridable via `HARNESS_DB_PATH`.
- WAL mode + foreign-keys enabled.
- All Server Actions take `db: Database.Database` as their first parameter (or use a request-scoped helper). Don't open a new connection per call.

### 1.3 ID generation

Use **ULID** for all primary keys (string, 26 chars, lexicographically sortable, time-prefixed). Import the `ulid` package. Reasons: human-debuggable, sort-by-insertion-time without an index, no central counter.

### 1.4 Migration handling

For Phase 3, schema is single-file. If schema evolves, add `migrations/NNN-description.sql` files and a `lib/migrations.ts` that applies them in order, tracking applied migrations in a `_migrations` table.

---

## 2. Diff capture algorithm

This is the heart of the harness — capturing what the operator changes, structured enough that aggregation can identify patterns.

### 2.1 Three diff modes

**Mode A — Field-level diff** (for `HarnessFact` edits, `ReleaseCard` field edits):

When the operator edits a field, capture:
```ts
{ field_path: 'fact.value' | 'release_card.headline' | 'release_card.deployed_facts[2]',
  before_value: string,
  after_value: string,
  edited_at: ISO }
```

Path for arrays uses bracket notation: `deployed_facts[2]`. Path for nested objects uses dots: `tier_reason`. Store one row per edited field. If the operator edits multiple fields in a single save, write multiple rows in a single transaction.

**Mode B — Text diff** (for `HarnessCandidate.text` edits):

Use the `diff` npm package, specifically `diffWords` for caption-level edits. Persist:
```ts
{ candidate_id, before_text, after_text, word_diff_json: string, edited_at: ISO }
```

`word_diff_json` is the serialised output of `diffWords(before, after)` — an array of `{ value, added?, removed? }` chunks. Useful for reconstructing the edit later AND for aggregating which kinds of words get added/removed often.

**Mode C — Semantic diff** (optional but high-value):

After the operator edits a candidate's text, **re-classify the edited text through the v2 classifier** (call `scripts/classify-corpus.ts`'s underlying functions — extract them to a reusable module if needed). Persist:
```ts
{ candidate_id,
  before_beat_audit_json: string,
  after_beat_audit_json: string,
  shifted_beats: Array<{ beat_index, before_tempo, after_tempo }>,
  edited_at: ISO }
```

This is the killer feature: it tells you not just *what changed* but *what changed about the tempo classification*. If operator edits push beat 2 from Self-Contained → Practical 80% of the time, that's data the bundle and the spec should incorporate.

### 2.2 When diff capture fires

- On every fact edit (status changes from `pending`/`approved` to `edited` with new field values)
- On every release-card field edit
- On every candidate-text edit (action='edit' in `candidate_decisions`)

Do NOT fire diffs on status changes that don't involve content change (e.g. `pending → approved`).

---

## 3. Server Actions

These wrap the pipeline. All are Next.js Server Actions (in `harness/app/actions/`), all return typed results, all persist before returning.

### 3.1 Stage 1 — Research

```ts
async function createCard(brief: string, voice: VoiceName): Promise<{ card_id: string }>;
async function runGrounder(card_id: string, opts?: { stream?: boolean }): Promise<{ facts: HarnessFact[]; unverifiable: { claim: string; reason: string }[] }>;
async function decideFact(fact_id: string, action: FactDecision, edits?: Partial<HarnessFact>): Promise<{ status: HarnessFact['status'] }>;
async function addManualFact(card_id: string, fact: Omit<HarnessFact, 'id' | 'card_id' | 'status' | 'created_by' | 'verified_at'>): Promise<{ fact_id: string }>;
async function approveResearch(card_id: string): Promise<{ research_approved_at: string }>;
```

`runGrounder`:
- Calls `groundFacts()` from `src/fact-grounder-llm.ts`.
- Source copy = card.brief (operator's seed text).
- Persists each returned `VerifiedFact` as a `HarnessFact` row with status='pending'.
- If `opts.stream` is true, returns a `ReadableStream` of progress events (one per grounder turn) — this lets the UI show "calling lookup_partner...", "calling grep_platform_code...", etc. Implementation: subclass the grounder, or wrap with an event emitter, or just poll the grounder's intermediate state.
- The grounder takes 10-30s; without streaming, the UI shows a single spinner. Streaming is nice-to-have, not required for the MVP.

`decideFact`:
- Validates action transitions (e.g. can't reject an already-approved fact without a `revert` action; should `revert` toggle back to `pending`?).
- If action='edit', writes a `fact_edits` row per changed field.
- Updates the fact's status accordingly.

### 3.2 Stage 2 — Card

```ts
async function buildReleaseCard(card_id: string): Promise<{ release_card_json: string }>;
async function editReleaseCard(card_id: string, edits: { field_path: string; new_value: string }[]): Promise<{ release_card_json: string }>;
async function approveCard(card_id: string): Promise<{ card_approved_at: string }>;
```

`buildReleaseCard`:
- Takes approved+edited facts from research stage.
- Calls `buildDeployedFacts()` from `src/fact-grounder-llm.ts` to convert facts into `deployed_facts[]`.
- Asks Sonnet to fill in the missing `ReleaseCard` fields (kind, headline, tier_reason) based on the brief + the facts. Use a constrained generation prompt — there's no existing function for this in `src/`; you'll need to write one. Suggested location: `harness/lib/card-builder.ts`. Returns a Zod-parsed `ReleaseCard` (via `parseReleaseCard()` from `src/card.ts`).
- Persists to `release_cards` table.

`editReleaseCard`:
- Applies each field-path edit in order.
- Writes one `release_card_edits` row per edit.
- Validates the resulting JSON via `parseReleaseCard()`. If it fails Zod parsing, return an error with the validation failures — don't persist invalid cards.

### 3.3 Stage 3 — Generate

```ts
async function runGenerator(card_id: string, channels: Channel[], opts?: { n?: number; retry?: boolean }): Promise<{ candidates_by_channel: Record<Channel, HarnessCandidate[]> }>;
async function decideCandidate(candidate_id: string, action: CandidateDecision, payload?: { edited_text?: string; retry_feedback?: string; rejection_reason?: string }): Promise<{ next_action: 'approved' | 'retry-queued' | 'rejected' }>;
async function retryChannel(card_id: string, channel: Channel, feedback?: string): Promise<{ candidates: HarnessCandidate[] }>;
```

`runGenerator`:
- For each requested channel, calls `generate()` from `src/generator.ts` with the card, channel, and `defaultBeatsForKind(card.kind)` (imported from the appropriate voice spec).
- Runs each candidate through `validate()` from `src/validator.ts` (the regex + classifier gate). Persist the validation result on the candidate row.
- Optionally runs the hybrid LLM judge (`auditTextHybrid` from validator-llm) for additional voice-fit confidence.
- Persist each candidate as a `HarnessCandidate` row.
- Returns the candidates grouped by channel.

`decideCandidate` with `action='edit'`:
- Writes a `candidate_decisions` row with `edited_text`.
- Triggers a Mode B diff (text diff) and Mode C diff (re-classify the edited text).
- Persists both diffs.

`retryChannel`:
- Calls `generate()` again for the channel with the operator's `feedback` passed as `opts.feedback`.
- Increments the candidate `attempt` counter.
- Caps at 3 attempts per channel; after that, surface the failure and require manual intervention.

### 3.4 Stage 4 — Ship

```ts
async function approvePick(candidate_id: string, final_text?: string): Promise<{ pick_id: string }>;
async function shipPick(pick_id: string, destination: 'clipboard' | 'slack' | 'x' | 'in-product'): Promise<{ shipped_at: string }>;
async function abandonCard(card_id: string, reason: string): Promise<{ status: 'abandoned' }>;
async function completeCard(card_id: string): Promise<{ status: 'shipped'; ship_at: string }>;
```

`approvePick`:
- Inserts a `final_picks` row.
- `final_text` defaults to the candidate's text but can override (operator's final edit).

`shipPick`:
- Updates the pick's `shipped_at` and `shipped_to`.
- If `destination === 'clipboard'`: returns the text in the response (client copies it).
- If `destination === 'slack'`: posts to a Slack webhook (URL from `process.env.HARNESS_SLACK_WEBHOOK`). Format: `*Channel ${channel}:* ${text}`.
- `x` and `in-product` destinations are placeholders for future integrations — for now, just log them as "ready to ship" without actually posting.

`completeCard`:
- Requires all expected channels to have a `final_picks` row.
- Sets `card.status = 'shipped'` and `card.ship_at`.

---

## 4. Agreement metrics

### 4.1 Computation

A nightly (or on-demand) job recomputes `agreement_snapshots`. Default window: 7 days. Run modes:

```ts
async function recomputeAgreement(window_days: number = 7): Promise<{ snapshots_written: number }>;
async function getAgreement(opts: { voice?: VoiceName; stage?: Stage; window_days?: number; }): Promise<AgreementSnapshot[]>;
```

### 4.2 Definitions

For each `(voice, stage, optional beat_name, optional fact_source)`:

```
approved_as_is = COUNT(decisions WHERE action='approve' AND edited_text IS NULL)
edited        = COUNT(decisions WHERE action='edit' OR (action='approve' AND edited_text IS NOT NULL))
rejected      = COUNT(decisions WHERE action='reject')
sample_size   = approved_as_is + edited + rejected
agreement_rate = approved_as_is / sample_size  (0..1; null if sample_size == 0)
```

**Definitions per stage:**
- `research` stage: decisions are on `HarnessFact` rows (action='approve' | 'edit' | 'reject').
- `card` stage: decisions are on `release_card_edits` for the card — if ANY edit exists, treat as 'edit'; if no edits and approved, 'approve'; if abandoned, 'reject'.
- `generate` stage: decisions are on `HarnessCandidate` rows via `candidate_decisions` (action='approve' | 'edit' | 'reject' | 'retry'). Note: `retry` is NOT a final decision — it's an in-flight signal. For agreement purposes, treat retry as deferred (don't count) and use the FINAL action on each candidate as the decision.
- `ship` stage: agreement is implicit (shipped vs abandoned). Less interesting; can be omitted from the dashboard if low value.

### 4.3 Per-beat metrics (generate stage)

For each beat in each candidate's `declared_beats_json`, if the candidate was edited, check whether the corresponding beat shifted in `Mode C semantic diff`. If yes → count as `edited` for that beat. Else (approve as-is) → count as `approved_as_is` for that beat. Reject → `rejected`.

This surfaces drift like "Practical beat got edited 67% of the time" — the operator can then look at the edits and update the spec/bundle accordingly.

### 4.4 Per-fact-source metrics (research stage)

Per `HarnessFact.source` value: rejection rate. Surfaces which sources are unreliable (e.g. `web-search` may reject more often than `partner-registry`).

---

## 5. Stage state machine

Each card progresses through stages. Constraints:

```
Stage 1 (research) → must have ≥1 approved fact before approvable
Stage 2 (card)     → requires Stage 1 approved
Stage 3 (generate) → requires Stage 2 approved
Stage 4 (ship)     → requires ≥1 approved pick per requested channel

Skip-ahead: NOT supported. Each stage gates the next.
Revert: supported. Operator can re-open an earlier stage and re-approve, which clears the downstream stage's approvals.
Abandon: supported at any time. Sets card.status='abandoned'.
```

State stored implicitly via the timestamp fields on `cards` (`research_approved_at`, `card_approved_at`, `ship_at`) + the candidates / picks.

---

## 6. Streaming for long-running stages

Two operations take >5s and should stream progress to the UI:

1. **`runGrounder`** (~10-30s, ~6 turns of LLM with tool calls):
   - Stream one event per turn: `{ turn: number, tool_call?: string, fact_recorded?: HarnessFact, unverifiable?: { claim, reason } }`
   - Implementation: Server-Sent Events from a route handler (the App Router supports this) OR a Server Action returning a ReadableStream.
   - Phase 3 priority: medium. The UI should work without it; streaming is a UX upgrade.

2. **`runGenerator`** (~20s per channel, up to 3 retries):
   - Stream events: `{ channel: Channel, attempt: number, status: 'requesting' | 'validating' | 'classifying' | 'done', candidates_so_far?: HarnessCandidate[] }`
   - Lower priority — most users will tolerate a spinner here.

If streaming is too much for the timebox, ship the non-streaming version first.

---

## 7. Edge cases + open questions

- **Multiple cards from same brief**: not supported in v1; each card is unique.
- **Concurrent edits by multiple operators**: not supported (harness is local-first single-user); no locking needed.
- **Voice switching mid-card**: not supported; voice is set at `createCard` and locked.
- **Pipeline failures** (e.g. ANTHROPIC_API_KEY missing): bubble up to the UI with a clear error toast. Don't silently fall back to stub mode in the harness — the operator needs to know when grounding is fake.
- **Re-running an approved stage**: allowed but resets downstream approvals. Show a confirm dialog.

---

## 8. Phase 1 scaffolding (already done)

These files are in place — you'll be extending them, not creating from scratch:

```
harness/
├── package.json                          ← deps declared
├── tsconfig.json                         ← TS config with @pipeline/* alias
├── next.config.js                        ← imports from ../src allowed
├── tailwind.config.ts                    ← placeholder palette (Claude Code Design will redo)
├── postcss.config.js
├── next-env.d.ts
├── app/
│   ├── globals.css                       ← Tailwind imports
│   ├── layout.tsx                        ← root layout, max-width container
│   ├── page.tsx                          ← card queue list
│   └── cards/[id]/page.tsx               ← 4-panel card detail
├── components/
│   ├── Panel.tsx                         ← collapsible stage container
│   ├── StageBadge.tsx                    ← status indicator
│   ├── FactsTable.tsx                    ← research-stage facts list (mock-data wired)
│   ├── CardEditor.tsx                    ← stub release-card JSON view
│   ├── CandidateCard.tsx                 ← generator candidate display (mock-data wired)
│   └── AgreementSummary.tsx              ← top-of-queue dashboard
├── lib/
│   ├── types.ts                          ← domain types (DON'T rename fields)
│   ├── schema.sql                        ← SQLite schema (authoritative)
│   ├── db.ts                             ← skeleton; extend
│   └── mock-data.ts                      ← Phase 1 fixtures; KEEP as test fixture
└── HANDOFF-SPEC.md                       ← this file
```

To verify the scaffold runs: `cd harness && pnpm install && pnpm dev` → http://localhost:3210. You should see the card queue + agreement summary + a sample card detail with all 4 panels.

---

## 9. What you (Codex) need to add

1. **`lib/db.ts`** — extend the skeleton: schema init runner, ID generator, helper for write transactions.
2. **`lib/diff.ts`** — new file. Implement the three diff modes from §2.
3. **`lib/card-builder.ts`** — new file. The Sonnet helper that fills `ReleaseCard.headline / tier_reason / kind` from a brief + facts.
4. **`lib/classifier-wrapper.ts`** — new file. Extract the classifier logic from `scripts/classify-corpus.ts` into a reusable async function `classifyText(text, opts)` that returns the per-beat audit. Use this for Mode C semantic diff and inside the generator validator.
5. **`app/actions/research.ts`** — Server Actions from §3.1.
6. **`app/actions/card.ts`** — Server Actions from §3.2.
7. **`app/actions/generate.ts`** — Server Actions from §3.3.
8. **`app/actions/ship.ts`** — Server Actions from §3.4.
9. **`app/actions/agreement.ts`** — `recomputeAgreement` + `getAgreement`.
10. **Wire Server Actions into the existing components** (FactsTable, CardEditor, CandidateCard, AgreementSummary) — replace mock data calls with action calls + `useTransition` for pending states.
11. **Edit flows**: build the inline edit experience for each stage. Keyboard handlers: `j/k` navigate, `a` approve, `e` edit, `x` reject, `r` retry, `n` new fact (research stage only).
12. **Migration system** (defer if time is tight): `lib/migrations.ts` + `migrations/` directory.

---

## 10. What you (Codex) do NOT need to do

- Visual polish — Claude Code Design owns that.
- Authentication — local-first, no auth.
- Hosted deployment — runs on localhost; Vercel later.
- Multi-tenant — single-user local-only.
- Tests beyond smoke (`actions/research.test.ts` + similar for the other actions is enough).
- Export-as-training-data — that's Phase 4 / future work.

---

## 11. Sanity checks before declaring done

- [ ] `pnpm install && pnpm dev` boots cleanly on a fresh machine.
- [ ] `pnpm db:init` creates `harness.db` with all tables.
- [ ] Creating a card via the UI persists it; refreshing the page shows it in the queue.
- [ ] Running the grounder against `ANTHROPIC_API_KEY` populates the facts table.
- [ ] Approving / editing / rejecting a fact captures the decision in the DB.
- [ ] Building the release card produces valid Zod-parsed `ReleaseCard` JSON.
- [ ] Editing the release card captures field-path diffs.
- [ ] Running the generator produces candidates with beat-audit data.
- [ ] Approving a candidate creates a `final_picks` row.
- [ ] Editing a candidate captures the text-diff + (if implemented) the semantic re-classification.
- [ ] Recomputing agreement metrics produces snapshots for at least the top-level (per stage) and per-beat (generate stage) levels.
- [ ] Agreement dashboard displays them.

---

## 12. Coordination notes

- After your pass, ping back so Claude (this assistant) can integrate. Bug fixes + spec refinement happen in the integration step.
- If you find ambiguities, flag them in a `harness/SPEC-QUESTIONS.md` file rather than making your own judgement call — the spec is the contract.
- Claude Code Design's visual pass runs in parallel or after yours. Don't worry about visual treatment; just preserve the data names + component prop shapes.

Good luck.
