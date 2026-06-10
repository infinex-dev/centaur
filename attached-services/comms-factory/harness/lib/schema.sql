-- comms-factory harness — SQLite schema
--
-- This is the canonical schema for Codex's Phase 3 implementation.
-- Run via `pnpm db:init` (see lib/db.ts).
--
-- Conventions:
--   • All IDs are TEXT (UUIDv7 or ULID strings — Codex chooses; just be consistent).
--   • All timestamps are TEXT ISO-8601. SQLite does not have a native datetime type
--     and we want lexicographic sort to equal chronological sort.
--   • All JSON-typed fields are stored as TEXT containing JSON. Read with JSON.parse.
--   • No ON DELETE CASCADE on facts/candidates — we want to retain history even if
--     a card is abandoned (training signal).
--   • Indexes are non-exhaustive; add more as query patterns surface.

-- ─── cards ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  voice TEXT NOT NULL CHECK (voice IN ('infinex','cream','projectjin','nigel')),
  brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in-progress'
    CHECK (status IN ('in-progress','shipped','abandoned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  research_approved_at TEXT,
  card_approved_at TEXT,
  ship_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cards_status_created ON cards(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_voice ON cards(voice);

-- ─── facts ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  category TEXT NOT NULL,
  claim TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  confidence REAL NOT NULL,
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','edited','manual')),
  rejection_reason TEXT,
  created_by TEXT NOT NULL DEFAULT 'grounder'
    CHECK (created_by IN ('grounder','operator'))
);

CREATE INDEX IF NOT EXISTS idx_facts_card ON facts(card_id);
CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status);
CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source);

-- ─── grounder_runs ──────────────────────────────────────────────────────────
-- Debug trace for long-running fact-grounder calls. This is harness telemetry,
-- not training signal.

CREATE TABLE IF NOT EXISTS grounder_runs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  model TEXT,
  ground_turns INTEGER,
  facts_count INTEGER NOT NULL DEFAULT 0,
  unverifiable_count INTEGER NOT NULL DEFAULT 0,
  truncated INTEGER NOT NULL DEFAULT 0 CHECK (truncated IN (0,1)),
  events_json TEXT NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_grounder_runs_card ON grounder_runs(card_id, started_at DESC);

-- ─── fact_edits ──────────────────────────────────────────────────────────────
-- Append-only log of every field-level edit. Training signal.

CREATE TABLE IF NOT EXISTS fact_edits (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL REFERENCES facts(id),
  field TEXT NOT NULL CHECK (field IN ('claim','value','source_ref','confidence','category')),
  before_value TEXT NOT NULL,
  after_value TEXT NOT NULL,
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fact_edits_fact ON fact_edits(fact_id);

-- ─── release_cards ───────────────────────────────────────────────────────────
-- Serialised ReleaseCard JSON. Mutable while in-progress, frozen on approval.

CREATE TABLE IF NOT EXISTS release_cards (
  card_id TEXT PRIMARY KEY REFERENCES cards(id),
  release_card_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── release_card_edits ──────────────────────────────────────────────────────
-- Append-only log of edits to the ReleaseCard JSON. Field-level diffs.

CREATE TABLE IF NOT EXISTS release_card_edits (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  /** Dotted path into the JSON, e.g. 'deployed_facts[2]' or 'headline'. */
  field_path TEXT NOT NULL,
  before_value TEXT NOT NULL,
  after_value TEXT NOT NULL,
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_release_card_edits_card ON release_card_edits(card_id);

-- ─── generator_attempts ──────────────────────────────────────────────────────
-- One row per (card, channel, attempt). Captures the auto-feedback string that
-- was passed INTO this attempt's generator and the full prompts the generator
-- sent to the model. The point is full visibility: the operator must be able to
-- see what feedback was synthesised from the prior attempt's failures, what
-- prompt the generator built from that feedback, and what candidates came out.
-- Separate from candidates because candidates are per-pick and attempts are
-- per-retry — many candidates can share one attempt row.

CREATE TABLE IF NOT EXISTS generator_attempts (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  channel TEXT NOT NULL, -- channel validated app-side (lib/types Channel); no CHECK so adding a channel needs no migration
  attempt INTEGER NOT NULL,
  /** Auto-feedback string fed INTO this attempt (NULL for attempt 1 or when there was nothing to summarise). */
  auto_feedback_in TEXT,
  /** JSON {system, user} for Stage A (inner-work step). NULL when stub or single-call path. */
  inner_work_prompt_json TEXT,
  /** JSON {system, user} for Stage B (drafting step). NULL when stub. */
  drafting_prompt_json TEXT,
  /** JSON {system, user} for the legacy single-call path. NULL under the two-call path. */
  legacy_prompt_json TEXT,
  generator_source TEXT NOT NULL CHECK (generator_source IN ('anthropic','stub')),
  /** Prompt-architecture variant tag for eval runs (current|kernel|placement|examples|full). NULL for default production runs. */
  prompt_variant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(card_id, channel, attempt)
);

CREATE INDEX IF NOT EXISTS idx_generator_attempts_card_channel ON generator_attempts(card_id, channel, attempt);
CREATE INDEX IF NOT EXISTS idx_generator_attempts_prompt_variant ON generator_attempts(prompt_variant);

-- ─── actor_attempts ─────────────────────────────────────────────────────────
-- New actor/director architecture. One row per card-level performance attempt,
-- spanning all requested channels. Legacy generator_attempts remains intact.

CREATE TABLE IF NOT EXISTS actor_attempts (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  attempt INTEGER NOT NULL,
  channels_json TEXT NOT NULL,
  source_index_json TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  model TEXT,
  director_notes_in_json TEXT,
  actor_prompt_json TEXT NOT NULL,
  actor_transcript_json TEXT NOT NULL,
  actor_response_json TEXT NOT NULL,
  table_work_json TEXT NOT NULL,
  generator_source TEXT NOT NULL CHECK (generator_source IN ('anthropic','stub')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(card_id, attempt)
);

CREATE INDEX IF NOT EXISTS idx_actor_attempts_card ON actor_attempts(card_id, attempt);
CREATE INDEX IF NOT EXISTS idx_actor_attempts_prompt_hash ON actor_attempts(prompt_hash);

-- ─── actor_warmups ─────────────────────────────────────────────────────────
-- Visible Actor warm-up produced before table work (mode can be none,
-- daily_pages, or scene_rehearsal). Stored separately so the blind Director
-- never receives it, but the operator can inspect and critique it. The
-- daily_pages_json column name is kept for old local DB compatibility.

CREATE TABLE IF NOT EXISTS actor_warmups (
  id TEXT PRIMARY KEY,
  actor_attempt_id TEXT NOT NULL REFERENCES actor_attempts(id),
  card_id TEXT NOT NULL REFERENCES cards(id),
  attempt INTEGER NOT NULL,
  daily_pages_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(actor_attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_actor_warmups_card_attempt ON actor_warmups(card_id, attempt);

-- ─── actor_run_events ──────────────────────────────────────────────────────
-- Live checkpoint trace for long Actor/Director runs. The normal persisted
-- rows are still actor_attempts/candidates/director_audits; this table exists
-- so the operator can see the loop moving while the server action is still
-- running.

CREATE TABLE IF NOT EXISTS actor_runs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  channels_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_actor_runs_card_started ON actor_runs(card_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_actor_runs_one_running_per_card ON actor_runs(card_id) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS actor_run_events (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  run_id TEXT NOT NULL,
  attempt INTEGER,
  channel TEXT, -- channel validated app-side (lib/types Channel); nullable, no CHECK
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_actor_run_events_card_created ON actor_run_events(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actor_run_events_run ON actor_run_events(run_id, created_at ASC);

-- ─── pipeline_runs ──────────────────────────────────────────────────────────
-- Explicit identity/proof record for each generator run. Reports must show this
-- before claiming Actor/Director quality.

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  pipeline_id TEXT NOT NULL CHECK (pipeline_id IN ('pipeline-1','pipeline-2','pipeline-3')),
  pipeline_label TEXT NOT NULL,
  entrypoint TEXT NOT NULL,
  proof_json TEXT NOT NULL,
  proof_passed INTEGER NOT NULL CHECK (proof_passed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_card_created ON pipeline_runs(card_id, created_at DESC);

-- ─── candidates ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  channel TEXT NOT NULL, -- channel validated app-side (lib/types Channel); no CHECK so adding a channel needs no migration
  attempt INTEGER NOT NULL,
  text TEXT NOT NULL, -- canonical readable rendering; slop rules + display run on this
  structured_json TEXT, -- JSON StructuredOutput for structured channels (web/carousel/x-thread); NULL otherwise
  declared_beats_json TEXT NOT NULL,
  beat_audit_json TEXT NOT NULL,
  validation_passed INTEGER NOT NULL CHECK (validation_passed IN (0,1)),
  validation_failures_json TEXT NOT NULL,
  rationale TEXT,
  source TEXT NOT NULL CHECK (source IN ('anthropic','stub')),
  /** Prompt-architecture variant tag for eval runs (current|kernel|placement|examples|full). NULL for default production runs. */
  prompt_variant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_card_channel ON candidates(card_id, channel);
CREATE INDEX IF NOT EXISTS idx_candidates_attempt ON candidates(card_id, channel, attempt);
CREATE INDEX IF NOT EXISTS idx_candidates_prompt_variant ON candidates(prompt_variant);

-- ─── candidate_audits ────────────────────────────────────────────────────────
-- Optional active-validator and history-guard trace. Separate table keeps the
-- original candidate row stable and lets older DBs pick up the table via schema
-- init without ALTER TABLE migrations.

CREATE TABLE IF NOT EXISTS candidate_audits (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  active_validation_passed INTEGER CHECK (active_validation_passed IN (0,1)),
  active_audit_json TEXT,
  history_guard_passed INTEGER CHECK (history_guard_passed IN (0,1)),
  history_guard_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_audits_candidate ON candidate_audits(candidate_id, created_at DESC);

-- ─── director_audits ────────────────────────────────────────────────────────
-- Blind Director reads for actor/director attempts. Separate from
-- candidate_audits so legacy active-validator traces remain untouched.

CREATE TABLE IF NOT EXISTS director_audits (
  id TEXT PRIMARY KEY,
  actor_attempt_id TEXT NOT NULL REFERENCES actor_attempts(id),
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  card_id TEXT NOT NULL REFERENCES cards(id),
  channel TEXT NOT NULL, -- channel validated app-side (lib/types Channel); no CHECK so adding a channel needs no migration
  attempt INTEGER NOT NULL,
  director_model TEXT,
  director_prompt_json TEXT NOT NULL,
  director_audit_json TEXT NOT NULL,
  passed INTEGER NOT NULL CHECK (passed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_director_audits_candidate ON director_audits(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_director_audits_card_attempt ON director_audits(card_id, attempt);

-- ─── operator_feedback ──────────────────────────────────────────────────────
-- Human disagreement/notes attached to Actor attempts or Director audits.
-- This is training/debug signal, not an automated verdict.

CREATE TABLE IF NOT EXISTS operator_feedback (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('actor_attempt','director_audit')),
  target_id TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operator_feedback_card ON operator_feedback(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_feedback_target ON operator_feedback(target_type, target_id, created_at DESC);

-- ─── candidate_decisions ─────────────────────────────────────────────────────
-- Operator's decision on each candidate. Append-only.

CREATE TABLE IF NOT EXISTS candidate_decisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  action TEXT NOT NULL CHECK (action IN ('approve','reject','edit','retry')),
  edited_text TEXT,
  retry_feedback TEXT,
  rejection_reason TEXT,
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_decisions_candidate ON candidate_decisions(candidate_id);

-- ─── candidate_text_edits ───────────────────────────────────────────────────
-- Append-only Mode B text diffs for edited generator candidates.

CREATE TABLE IF NOT EXISTS candidate_text_edits (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  before_text TEXT NOT NULL,
  after_text TEXT NOT NULL,
  word_diff_json TEXT NOT NULL,
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_text_edits_candidate ON candidate_text_edits(candidate_id);

-- ─── candidate_semantic_edits ───────────────────────────────────────────────
-- Append-only Mode C semantic re-classification diffs for edited candidates.

CREATE TABLE IF NOT EXISTS candidate_semantic_edits (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  before_beat_audit_json TEXT NOT NULL,
  after_beat_audit_json TEXT NOT NULL,
  shifted_beats_json TEXT NOT NULL,
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_semantic_edits_candidate ON candidate_semantic_edits(candidate_id);

-- ─── final_picks ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS final_picks (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  channel TEXT NOT NULL, -- channel validated app-side (lib/types Channel); no CHECK so adding a channel needs no migration
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  final_text TEXT NOT NULL,
  shipped_at TEXT,
  shipped_to TEXT CHECK (shipped_to IN ('clipboard','slack','x','in-product')),
  UNIQUE(card_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_final_picks_card ON final_picks(card_id);

-- ─── agreement_snapshots ─────────────────────────────────────────────────────
-- Denormalised metrics for fast dashboard queries. Recomputed daily.

CREATE TABLE IF NOT EXISTS agreement_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_at TEXT NOT NULL DEFAULT (datetime('now')),
  window_days INTEGER NOT NULL,
  voice TEXT NOT NULL,
  stage TEXT NOT NULL,
  beat_name TEXT,
  fact_source TEXT,
  agreement_rate REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  approved_as_is INTEGER NOT NULL,
  edited INTEGER NOT NULL,
  rejected INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agreement_snapshots_at ON agreement_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_agreement_snapshots_voice_stage ON agreement_snapshots(voice, stage, snapshot_at DESC);

-- ─── stage_durations ─────────────────────────────────────────────────────────
-- Optional but useful: how long each stage takes (operator wall-clock).

CREATE TABLE IF NOT EXISTS stage_durations (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  stage TEXT NOT NULL CHECK (stage IN ('research','card','generate','ship')),
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stage_durations_card ON stage_durations(card_id);

-- ─── director_checks ─────────────────────────────────────────────────────────
-- Standalone Director-as-service checks. Each row is one piece of copy judged
-- against the voice (+ optional grounded fact source). Persisted so checks
-- survive navigation and build a reviewable history. card_id is nullable: a
-- check may be ungrounded (no card) or tied to a grounded card.

CREATE TABLE IF NOT EXISTS director_checks (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  voice TEXT NOT NULL,
  surface TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  light TEXT NOT NULL CHECK (light IN ('green','amber','red')),
  verdict_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_director_checks_created ON director_checks(created_at DESC);

-- ─── director_regens ─────────────────────────────────────────────────────────
-- "Generate with actor" runs from the Director surface: a draft seeds the
-- grounder, then the Actor↔Director loop rebuilds it. Persisted + progressively
-- updated (events_json streams; candidates_json fills on completion) so the
-- operator can watch progress, navigate away, and still find the rebuilt copy.

CREATE TABLE IF NOT EXISTS director_regens (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  voice TEXT NOT NULL,
  surface TEXT NOT NULL,
  draft TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','done','exhausted','error')),
  phase TEXT,
  fact_count INTEGER,
  events_json TEXT NOT NULL DEFAULT '[]',
  candidates_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_director_regens_created ON director_regens(created_at DESC);

-- ─── partner-API approvals ───────────────────────────────────────────────────
-- The grounder auto-calls partner APIs whose host appears in our branch code.
-- For a host NOT in our code it emits an approval request instead of calling.
-- The operator approves a host here (localhost harness is the first "asker";
-- Slack is a future second asker on the same seam); approved hosts persist and
-- unblock the call on the next grounder run.

CREATE TABLE IF NOT EXISTS approved_api_hosts (
  host TEXT PRIMARY KEY,
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_by TEXT
);

CREATE TABLE IF NOT EXISTS pending_api_requests (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  host TEXT NOT NULL,
  url TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_api_requests_card ON pending_api_requests(card_id, status);
