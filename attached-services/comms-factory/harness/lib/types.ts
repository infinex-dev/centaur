/**
 * Training-harness domain types.
 *
 * These are the data shapes the harness tracks across the 4-stage workflow.
 * Pipeline types (ReleaseCard, Candidate, VerifiedFact) come from ../src
 * — DON'T duplicate them here. Re-export where needed.
 */

export type VoiceName = 'infinex' | 'cream' | 'projectjin' | 'nigel';
export type Channel = 'x' | 'web' | 'in-product' | 'modal' | 'blog' | 'x-thread' | 'carousel';
export type Stage = 'research' | 'card' | 'generate' | 'ship';
export type StageStatus =
  | 'pending'
  | 'running'
  | 'awaiting'
  | 'approved'
  | 'edited'
  | 'rejected';

export type FactDecision = 'approve' | 'reject' | 'edit';
export type CandidateDecision = 'approve' | 'reject' | 'edit' | 'retry';

// ─── Harness-level records ───────────────────────────────────────────────────

export interface HarnessCard {
  id: string; // UUID
  voice: VoiceName;
  brief: string; // operator's initial seed text
  status: 'in-progress' | 'shipped' | 'abandoned';
  created_at: string; // ISO
  completed_at: string | null;
  /** Stage progression. Each value is when the operator approved that stage. */
  research_approved_at: string | null;
  card_approved_at: string | null;
  // generate_approved_at is implicit — when ALL channels have an approved pick
  ship_at: string | null;
}

/** One verified fact in the research stage. Wraps VerifiedFact from pipeline. */
export interface HarnessFact {
  id: string; // UUID
  card_id: string;
  // Mirror of pipeline VerifiedFact, persisted
  category: string;
  claim: string;
  value: string;
  source: string;
  source_ref: string;
  confidence: number;
  verified_at: string;
  // Harness-only fields
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'manual';
  rejection_reason: string | null;
  created_by: 'grounder' | 'operator'; // operator can add facts manually
}

/** One field-level edit on a HarnessFact. Captured for training-signal. */
export interface FactEdit {
  id: string;
  fact_id: string;
  field: 'claim' | 'value' | 'source_ref' | 'confidence' | 'category';
  before_value: string;
  after_value: string;
  edited_at: string;
}

/** One generator candidate. */
export interface HarnessCandidate {
  id: string; // UUID
  card_id: string;
  channel: Channel;
  attempt: number; // 1-indexed; reflects retry count
  text: string; // canonical readable rendering (slop rules + display run on this)
  /** JSON-serialised StructuredOutput for structured channels (web/carousel/x-thread); NULL otherwise. */
  structured_json: string | null;
  declared_beats_json: string; // JSON-serialised TempoBeat[]
  beat_audit_json: string; // JSON-serialised beat_audit from validator
  validation_passed: boolean;
  validation_failures_json: string; // JSON-serialised failures array
  active_validation_passed: boolean | null;
  active_audit_json: string | null;
  history_guard_passed: boolean | null;
  history_guard_json: string | null;
  director_audit_id: string | null;
  director_passed: boolean | null;
  director_audit_json: string | null;
  rationale: string | null;
  source: 'anthropic' | 'stub';
  /** Prompt-architecture variant tag for eval runs. NULL for default production runs. */
  prompt_variant: string | null;
  created_at: string;
}

/** Per-attempt prompt + auto-feedback capture. One row per (card, channel, attempt). */
export interface HarnessGeneratorAttempt {
  id: string;
  card_id: string;
  channel: Channel;
  attempt: number;
  /** Auto-feedback string fed INTO this attempt (built from prior attempt's failures). */
  auto_feedback_in: string | null;
  /** Stage A {system, user} prompt. JSON string. NULL in stub mode or legacy path. */
  inner_work_prompt_json: string | null;
  /** Stage B {system, user} prompt. JSON string. NULL in stub mode. */
  drafting_prompt_json: string | null;
  /** Single-call legacy prompt. JSON string. NULL under the two-call path. */
  legacy_prompt_json: string | null;
  generator_source: 'anthropic' | 'stub';
  /** Prompt-architecture variant tag for eval runs. NULL for default production runs. */
  prompt_variant: string | null;
  created_at: string;
}

/** Card-level actor/director attempt. One attempt can produce multiple channels. */
export interface HarnessActorAttempt {
  id: string;
  card_id: string;
  attempt: number;
  channels_json: string;
  source_index_json: string;
  prompt_version: string;
  prompt_hash: string;
  model: string | null;
  director_notes_in_json: string | null;
  actor_prompt_json: string;
  actor_transcript_json: string;
  actor_response_json: string;
  daily_pages_json: string | null;
  table_work_json: string;
  generator_source: 'anthropic' | 'stub';
  created_at: string;
}

/**
 * Parsed shape of actor_attempts.table_work_json — the positioning the actor
 * DERIVED for one launch (not authored). All fields optional: older attempts
 * or stub runs may omit some.
 */
export interface TableWork {
  thesis?: string;
  through_action?: string;
  obstacle?: string;
  reader_prior?: string;
  lining?: string;
  not_the_point?: string;
  channel_beat_plans?: unknown;
}

/**
 * One launch's derived positioning, rolled up for the positioning surface:
 * the latest actor attempt's table-work joined to its card. This is the
 * evidence that ladders up to the super-objective.
 */
export interface CardPositioning {
  card_id: string;
  brief: string;
  status: HarnessCard['status'];
  ship_at: string | null;
  attempt: number;
  created_at: string;
  generator_source: 'anthropic' | 'stub';
  table_work: TableWork;
}

/** Live checkpoint emitted while an Actor/Director run is in progress. */
export interface HarnessActorRunEvent {
  id: string;
  card_id: string;
  run_id: string;
  attempt: number | null;
  channel: Channel | null;
  event_type: string;
  message: string;
  payload_json: string;
  created_at: string;
}

export interface HarnessActorRun {
  id: string;
  card_id: string;
  status: 'running' | 'completed' | 'failed';
  channels_json: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface HarnessPipelineRun {
  id: string;
  card_id: string;
  pipeline_id: 'pipeline-1' | 'pipeline-2' | 'pipeline-3';
  pipeline_label: string;
  entrypoint: string;
  proof_json: string;
  proof_passed: boolean;
  created_at: string;
}

/** Blind Director audit for actor/director candidates. */
export interface HarnessDirectorAudit {
  id: string;
  actor_attempt_id: string;
  candidate_id: string;
  card_id: string;
  channel: Channel;
  attempt: number;
  director_model: string | null;
  director_prompt_json: string;
  director_audit_json: string;
  passed: boolean;
  created_at: string;
}

export type OperatorFeedbackTargetType = 'actor_attempt' | 'director_audit';

export interface HarnessOperatorFeedback {
  id: string;
  card_id: string;
  target_type: OperatorFeedbackTargetType;
  target_id: string;
  feedback_text: string;
  created_at: string;
}

/** Operator's decision on a candidate (approve / edit / retry / reject). */
export interface CandidateDecisionRecord {
  id: string;
  candidate_id: string;
  action: CandidateDecision;
  /** If action='edit', the edited text. */
  edited_text: string | null;
  /** If action='retry', operator-provided feedback to the generator. */
  retry_feedback: string | null;
  /** If action='reject', why. */
  rejection_reason: string | null;
  decided_at: string;
}

/** Final pick per channel — what actually ships. */
export interface FinalPick {
  id: string;
  card_id: string;
  channel: Channel;
  candidate_id: string;
  final_text: string; // may differ from candidate.text if operator edited
  shipped_at: string | null;
  shipped_to: 'clipboard' | 'slack' | 'x' | 'in-product' | null;
}

// ─── Agreement metrics ───────────────────────────────────────────────────────

/**
 * An agreement snapshot — denormalised for fast dashboard queries.
 * Computed daily (or on demand) over a rolling window of recent decisions.
 */
export interface AgreementSnapshot {
  id: string;
  snapshot_at: string;
  window_days: number; // rolling window size
  voice: VoiceName | 'all';
  stage: Stage | 'all';
  beat_name: string | null; // for per-beat metrics in the generate stage
  fact_source: string | null; // for per-fact-source metrics in research
  /** approved_as_is / (approved_as_is + edited + rejected). 0..1 */
  agreement_rate: number;
  sample_size: number;
  approved_as_is: number;
  edited: number;
  rejected: number;
}

// ─── Stage payloads — what each stage hands off ──────────────────────────────

/** What the research stage emits. Becomes input to the card stage. */
export interface ResearchStagePayload {
  card_id: string;
  facts: HarnessFact[]; // approved or edited facts only
  unverifiable: { claim: string; reason: string }[];
}

/** What the card stage emits. Becomes input to the generate stage. */
export interface CardStagePayload {
  card_id: string;
  release_card_json: string; // serialised ReleaseCard
}

/** What the generate stage emits per channel. Becomes input to the ship stage. */
export interface GenerateStagePayload {
  card_id: string;
  picks: FinalPick[];
}

// ─── UI state convenience types ─────────────────────────────────────────────

export interface StageState {
  stage: Stage;
  status: StageStatus;
  started_at: string | null;
  completed_at: string | null;
  /** Operator-set notes on the stage (e.g. "research seemed thin", "card had to be edited heavily"). */
  notes: string | null;
}

export interface CardDetailView {
  card: HarnessCard;
  stages: Record<Stage, StageState>;
  facts: HarnessFact[];
  candidates_by_channel: Record<Channel, HarnessCandidate[]>;
  /** Per-channel generator attempts (auto-feedback + prompts) keyed by channel. */
  attempts_by_channel: Record<Channel, HarnessGeneratorAttempt[]>;
  /** Card-level actor/director attempts. Empty for legacy-only cards. */
  actor_attempts: HarnessActorAttempt[];
  /** Human notes/disagreements attached to Actor attempts or Director audits. */
  operator_feedback: HarnessOperatorFeedback[];
  /** Latest explicit pipeline identity/proof record for generated artifacts. */
  pipeline_run: HarnessPipelineRun | null;
  picks: FinalPick[];
  /** Partner-API calls the grounder wanted to make but couldn't auto-approve (host not in our code). */
  pending_api_requests: PendingApiRequest[];
}

/** A partner-API call the grounder queued for operator approval (host not referenced in our branch code). */
export interface PendingApiRequest {
  id: string;
  card_id: string;
  host: string;
  url: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
}

/** A partner-API host the operator has approved for the grounder to call. */
export interface ApprovedApiHost {
  host: string;
  approved_at: string;
  approved_by: string | null;
}
