import { deployedFactClaim, type DeployedFact, type ReleaseCard } from "./card.js";
import { cpus } from "node:os";
import type { Candidate, Channel } from "./generator.js";
import { rejectOutwardVersionTag, structureIssues, validate, type RuleFailure, type ValidationResult } from "./validator.js";
import { INFINEX_VOICE } from "./voice/infinex.js";
import { PREPARATION_PAIRS } from "./voice/types.js";
import { checkPrepHierarchy } from "./voice/laban.js";
import type { CharacterSpec, QuickAction, WorkingAction } from "./voice/types.js";
import {
  auditCandidateWithDirector,
  generateActorAttempt,
  isThesisCard,
  prewarmDirectorCache,
  type ActorAttemptResult,
  type ActorTranscriptMessage,
  type ActorWarmupMode,
  type AuditCandidateWithDirectorOptions,
  type DirectorAuditResult,
  type DirectorNotes,
  type FactRequest,
  type FeedbackWaveRegime,
  type FeedbackWaveSection,
  type FeedbackWaveSummary,
  type GenerateActorAttemptOptions,
  type VerticalFlowDirection,
} from "./actor-director.js";

/** An answer to a fact_request, ready to merge into the card's deployed_facts. */
export interface GroundedFactAnswer {
  /** The original question this answers. */
  question: string;
  /** The fact to add to deployed_facts (object form carries provenance/basis). */
  fact: DeployedFact;
  /** Provenance string for the run event (source_ref / confidence). */
  provenance?: string;
}

/**
 * Resolves a batch of Actor/Director fact_requests via the grounder. Injected so
 * tests can stub it; defaults to undefined (back-edge disabled unless supplied).
 */
export type FactRequestGrounderFn = (
  requests: FactRequest[],
  card: ReleaseCard,
) => Promise<GroundedFactAnswer[]>;

/**
 * Production adapter: turn fact_requests into a grounder call. Callers (the
 * harness / scripts) supply the bound `groundFacts` plus run scoping (ref,
 * approved hosts, trace sink), keeping the grounder's deps out of consumers that
 * never run the back-edge. The grounder's VerifiedFacts become deployed_facts
 * with provenance in source_ref/confidence; live-class numbers keep their basis.
 */
export interface FactRequestGrounderConfig {
  groundFacts: (
    sourceCopy: string,
    opts: { surface?: string; job?: string; ref?: string; approvedHosts?: string[] },
  ) => Promise<{
    facts: Array<{ claim: string; value: string; source_ref: string; confidence: number; category: string }>;
  }>;
  ref?: string;
  approvedHosts?: string[];
}

export function buildFactRequestGrounder(config: FactRequestGrounderConfig): FactRequestGrounderFn {
  return async (requests) => {
    // One grounder pass over all questions — the grounder discovers across them.
    const sourceCopy = requests.map((r) => `- ${r.question}${r.reason ? ` (needed for: ${r.reason})` : ""}`).join("\n");
    const result = await config.groundFacts(sourceCopy, {
      surface: "actor-director-back-edge",
      job: "answer-fact-requests",
      ...(config.ref ? { ref: config.ref } : {}),
      ...(config.approvedHosts ? { approvedHosts: config.approvedHosts } : {}),
    });
    return result.facts.map((fact) => {
      const liveClass = fact.category === "number";
      return {
        question: fact.claim,
        fact: {
          claim: `${fact.claim}: ${fact.value}`,
          ...(liveClass ? { basis: `grounded value; verify before ship (confidence ${fact.confidence.toFixed(2)})` } : {}),
        },
        provenance: `${fact.source_ref} (confidence ${fact.confidence.toFixed(2)})`,
      };
    });
  };
}

export interface ActorDirectorCandidateRecord {
  candidate: Candidate;
  script_validation: ValidationResult;
  director_audit?: DirectorAuditResult;
  selection?: CandidateSelectionScore;
}

export interface CandidateSelectionScore {
  score: number;
  image_cluster: string;
  reasons: string[];
  warnings: string[];
}

export interface FinalPickRationale {
  channel: Channel;
  candidate_id: string;
  score: number;
  image_cluster: string;
  rationale: string;
  warnings: string[];
}

export interface OperatorSelectionPreference {
  channel?: Channel;
  prefer?: string;
  avoid?: string;
  weight?: number;
  reason?: string;
}

export interface ActorDirectorAttempt {
  attempt: number;
  director_notes_in?: DirectorNotes;
  actor: ActorAttemptResult;
  records: ActorDirectorCandidateRecord[];
  picks: Candidate[];
  selection_rationales: Partial<Record<Channel, FinalPickRationale>>;
  director_notes: DirectorNotes;
}

export interface ActorDirectorResult {
  attempts: ActorDirectorAttempt[];
  picks: Candidate[];
  selection_rationales: Partial<Record<Channel, FinalPickRationale>>;
  exhausted: boolean;
}

export type ActorAttemptFn = (
  card: ReleaseCard,
  opts: GenerateActorAttemptOptions,
) => Promise<ActorAttemptResult>;

export type DirectorAuditFn = (
  opts: AuditCandidateWithDirectorOptions,
) => Promise<DirectorAuditResult>;

export interface ActorDirectorRunEvent {
  attempt?: number;
  channel?: Channel;
  event_type: string;
  message: string;
  payload?: Record<string, unknown>;
}

export type ActorDirectorEventSink = (
  event: ActorDirectorRunEvent,
) => void | Promise<void>;

export type ActorDirectorAttemptSink = (
  attempt: ActorDirectorAttempt,
) => void | Promise<void>;

// Em-dashes are a zero-tolerance banned character (validator `ai-slop` rule).
// A pure character ban is trivially fixable, so strip it deterministically at
// source rather than looping the Actor — the LLM reliably re-introduces em-dashes
// across regenerations, so a feedback round can never converge on it.
const EM_DASH_RE = /\s*—\s*/g;
function stripEmDashesFromText(text: string): string {
  return text.replace(EM_DASH_RE, ", ").replace(/,\s*,/g, ",");
}
/** Strip em-dashes from a candidate's readable text and its structured segments.
 *  Returns true if anything changed. Mutates the candidate in place. */
function stripEmDashesFromCandidate(candidate: Candidate): boolean {
  const newText = stripEmDashesFromText(candidate.text);
  let changed = newText !== candidate.text;
  if (candidate.structured) {
    const json = JSON.stringify(candidate.structured);
    if (json.includes("—")) {
      candidate.structured = JSON.parse(json.replace(/\s*—\s*/g, ", ")) as typeof candidate.structured;
      changed = true;
    }
  }
  candidate.text = newText;
  return changed;
}

export interface ActorDirectorRetryOptions {
  voice?: CharacterSpec;
  n?: number;
  warmup_mode?: ActorWarmupMode;
  flow_direction?: VerticalFlowDirection;
  feedback_wave_regime?: FeedbackWaveRegime;
  x_thread_target_tweets?: number;
  maxAttempts?: number;
  actor?: ActorAttemptFn;
  director?: DirectorAuditFn;
  actor_model?: string;
  director_model?: string;
  mode?: "live" | "stub" | "auto";
  actor_client?: GenerateActorAttemptOptions["client"];
  director_client?: AuditCandidateWithDirectorOptions["client"];
  onEvent?: ActorDirectorEventSink;
  onAttemptCompleted?: ActorDirectorAttemptSink;
  operator_preferences?: OperatorSelectionPreference[];
  /**
   * Resolves Actor/Director fact_requests via the grounder. When supplied and a
   * round emits fact_requests, the orchestrator runs ONE back-edge round: batch +
   * dedupe the questions, ground them, merge answers into card.deployed_facts with
   * provenance, then regenerate. Omit to disable the back-edge.
   */
  grounder?: FactRequestGrounderFn;
  /**
   * OPTIONAL seed for a manual "regenerate with notes" action. When supplied,
   * attempt 1 starts from this prior transcript + notes instead of blank — so the
   * Actor revises the chosen copy against the (operator- or Director-authored)
   * feedback rather than generating from scratch. seed_notes requires
   * seed_transcript (buildActorTranscript only injects notes when a prior
   * transcript exists).
   */
  seed_transcript?: ActorTranscriptMessage[];
  seed_notes?: DirectorNotes;
}

const CHANNEL_MAX_LEN: Record<Channel, number> = {
  x: 280,
  web: 140,
  "in-product": 80,
  modal: 250,
  blog: 3600,
  // Structured channels: per-segment limits enforced by validator.structureIssues;
  // these bound the readable rendering as a backstop.
  "x-thread": 1800,
  carousel: 1600,
  "image-brief": 4000,
};

// Thesis pieces are essays (~900-1400 words); the changelog-sized blog cap
// would reject them at the gate.
const THESIS_BLOG_MAX_LEN = 12000;

export function channelMaxLen(channel: Channel, card: ReleaseCard): number {
  if (channel === "blog" && isThesisCard(card)) return THESIS_BLOG_MAX_LEN;
  return CHANNEL_MAX_LEN[channel];
}

const OUTWARD_CHANNELS: Channel[] = ["x", "x-thread", "web", "carousel"];

export async function orchestrateActorDirectorWithRetries(
  card: ReleaseCard,
  channels: Channel[],
  opts: ActorDirectorRetryOptions = {},
): Promise<ActorDirectorResult> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const maxAttempts = opts.maxAttempts ?? 3;
  const actor = opts.actor ?? generateActorAttempt;
  const director = opts.director ?? auditCandidateWithDirector;
  const attempts: ActorDirectorAttempt[] = [];
  let transcript: ActorTranscriptMessage[] | undefined = opts.seed_transcript;
  let notes: DirectorNotes | undefined = opts.seed_notes;
  let finalPicks: Candidate[] = [];
  let finalSelectionRationales: Partial<Record<Channel, FinalPickRationale>> = {};
  // The card can be augmented by the fact-request back-edge. Two rounds max per
  // run: one EAGER (table-work requests, before any audit) and one AUDIT-TRIGGERED
  // (holes the Director found). Questions are deduped across both rounds.
  let currentCard = card;
  let grounderRounds = 0;
  let eagerDone = false;
  let auditBackEdgeDone = false;
  const askedQuestions = new Set<string>();
  const MAX_GROUNDER_ROUNDS = 2;
  const targetedRetriedChannels = new Set<Channel>();
  // Every failed candidate is taken to its logical conclusion: retry waves
  // continue while ANY candidate in the latest wave failed (up to maxAttempts),
  // not merely until each channel has one passing pick. Waves narrow to the
  // channels that still have failures; channels whose candidates all passed are
  // never regenerated. Final picks are drawn from the POOLED records of all
  // waves, so a wave-1 passer is never churned by a later wave.
  let waveChannels: Channel[] = channels;
  const pooledRecords: ActorDirectorCandidateRecord[] = [];

  await emitRunEvent(opts.onEvent, {
    event_type: "run_started",
    message: `Actor/Director run started for ${channels.join(", ")}`,
    payload: { channels, max_attempts: maxAttempts, candidates_per_channel: opts.n ?? null },
  });

  try {
    for (let attemptNo = 1; attemptNo <= maxAttempts; attemptNo++) {
      const notesIn = notes;
      await emitRunEvent(opts.onEvent, {
        attempt: attemptNo,
        event_type: "actor_started",
        message: `Actor attempt ${attemptNo} started`,
        payload: { channels: waveChannels, has_director_notes: notesIn !== undefined },
      });
      const runActor = (): Promise<ActorAttemptResult> => actor(currentCard, {
        channels: waveChannels,
        ...(opts.n !== undefined ? { n: opts.n } : {}),
        ...(opts.warmup_mode !== undefined ? { warmup_mode: opts.warmup_mode } : {}),
        ...(opts.flow_direction !== undefined ? { flow_direction: opts.flow_direction } : {}),
        ...(opts.feedback_wave_regime !== undefined ? { feedback_wave_regime: opts.feedback_wave_regime } : {}),
        ...(opts.x_thread_target_tweets !== undefined ? { x_thread_target_tweets: opts.x_thread_target_tweets } : {}),
        voice,
        ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
        ...(opts.actor_model !== undefined ? { model: opts.actor_model } : {}),
        ...(opts.actor_client !== undefined ? { client: opts.actor_client } : {}),
        ...(transcript !== undefined ? { previous_transcript: transcript } : {}),
        ...(notesIn !== undefined ? { director_notes: notesIn } : {}),
      });
      let actorResult = await runActor();
      transcript = actorResult.transcript_messages;
      await emitRunEvent(opts.onEvent, {
        attempt: attemptNo,
        event_type: "actor_completed",
        message: `Actor attempt ${attemptNo} returned ${actorResult.candidates.length} candidate option(s)`,
        payload: {
          candidate_count: actorResult.candidates.length,
          prompt_version: actorResult.memory.version,
          prompt_hash: actorResult.memory.prompt_hash,
        },
      });

      // ── Phase 0: EAGER back-edge ──────────────────────────────────────────────
      // The operator wants the Actor to be able to call the grounder the moment a
      // hole appears — after it writes the first draft, BEFORE that draft is
      // submitted to regex/Director. So if this fresh draft's table work emitted
      // fact_requests, ground them now, merge into the card, and re-run the Actor
      // against the augmented card before any audit happens. No regex/Director
      // round is spent on copy already known to have holes.
      if (
        opts.grounder &&
        !eagerDone &&
        grounderRounds < MAX_GROUNDER_ROUNDS &&
        actorResult.output.table_work.fact_requests.length > 0
      ) {
        eagerDone = true;
        const requests = dedupeNewRequests(
          collectFactRequests(actorResult.output.table_work.fact_requests, []),
          askedQuestions,
        );
        if (requests.length > 0) {
          const merged = await runFactRequestRound(opts, "eager", attemptNo, requests, currentCard);
          grounderRounds += 1;
          if (merged) {
            currentCard = merged;
            // Re-do table work + drafts against the augmented card before auditing.
            transcript = undefined;
            actorResult = await runActor();
            transcript = actorResult.transcript_messages;
            await emitRunEvent(opts.onEvent, {
              attempt: attemptNo,
              event_type: "actor_completed",
              message: `Actor re-ran after eager grounding with ${actorResult.candidates.length} candidate option(s)`,
              payload: {
                candidate_count: actorResult.candidates.length,
                after: "eager_grounding",
              },
            });
          }
        }
      }

      // Persist the vertical flow direction on every candidate at generation time —
      // it is otherwise only recoverable by grepping the actor prompt.
      const flowDirection = actorResult.emission_plan.flow_direction;
      for (const candidate of actorResult.candidates) {
        candidate.prompt_variant = flowDirection;
        // Strip em-dashes before validation/ship — banned, zero-tolerance, and the
        // Actor won't reliably remove them on its own across feedback rounds.
        if (stripEmDashesFromCandidate(candidate)) {
          await emitRunEvent(opts.onEvent, {
            attempt: attemptNo,
            channel: candidate.channel,
            event_type: "candidate_sanitized",
            message: `${candidate.channel} em-dash stripped before validation`,
            payload: { text: candidate.text },
          });
        }
      }

      // Phase 1: validate every candidate cheaply and preserve original order.
      const records: ActorDirectorCandidateRecord[] = [];
      for (const candidate of actorResult.candidates) {
        const script = validateCandidate(candidate, currentCard, voice);
        const record: ActorDirectorCandidateRecord = {
          candidate,
          script_validation: script,
        };
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "script_validation_completed",
          message: `${candidate.channel} script validation ${script.passed ? "passed" : "failed"}`,
          payload: {
            passed: script.passed,
            failure_rules: script.failures.map((failure) => failure.rule),
            text: candidate.text,
          },
        });
        records.push(record);
      }

      const auditable = records.filter((record) =>
        record.script_validation.passed && record.candidate.channel !== "image-brief"
      );
      const usingRealDirector =
        opts.director === undefined &&
        opts.director_client === undefined &&
        opts.mode !== "stub";
      if (auditable.length > 0 && usingRealDirector) {
        await prewarmDirectorCache({
          voice,
          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
          ...(opts.director_model !== undefined ? { model: opts.director_model } : {}),
        });
      }

      const concurrency = Math.max(1, Math.min(8, cpus().length));
      const auditOne = async (record: ActorDirectorCandidateRecord): Promise<void> => {
        const candidate = record.candidate;
        const script = record.script_validation;
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "director_started",
          message: `${candidate.channel} sent to blind Director`,
          payload: { text: candidate.text, regex_passed: script.passed },
        });
        const audit = await director({
          card: currentCard,
          candidate,
          channel: candidate.channel,
          voice,
          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
          ...(opts.director_model !== undefined ? { model: opts.director_model } : {}),
          ...(opts.director_client !== undefined ? { client: opts.director_client } : {}),
        });
        record.director_audit = audit;
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          channel: candidate.channel,
          event_type: "director_completed",
          message: `${candidate.channel} Director ${directorDraftPassed(audit) ? "passed" : "rejected"} as ${audit.primary_tempo}`,
          payload: {
            passed: directorDraftPassed(audit),
            regex_passed: script.passed,
            copy_voice_passed: audit.copy_voice_passed,
            factual_passed: audit.factual_passed,
            publication_gate_passed: audit.publication_gate_passed,
            legal: audit.infinex_fit.legal,
            primary_tempo: audit.primary_tempo,
            primary_confidence: audit.primary_confidence,
            notes_for_actor: audit.notes_for_actor,
            factual_issues: audit.factual_issues,
            publication_gate_issues: audit.publication_gate_issues,
            voice_issues: audit.voice_issues,
          },
        });
      };

      let auditCursor = 0;
      const runWorker = async (): Promise<void> => {
        for (;;) {
          const index = auditCursor++;
          if (index >= auditable.length) return;
          const record = auditable[index];
          if (!record) return;
          await auditOne(record);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(concurrency, auditable.length) }, () => runWorker()),
      );

      pooledRecords.push(...records);
      // Picks come from the POOL across all waves — a later, narrower wave
      // cannot displace an earlier channel's passing winner by omission.
      const { picks, rationales } = pickRankedPassingByChannel(pooledRecords, channels, opts.operator_preferences ?? []);
      // A candidate is settled when it passed regex AND the Director. Channels
      // with any unsettled candidate in THIS wave get another wave.
      const recordSettled = (record: ActorDirectorCandidateRecord): boolean =>
        record.candidate.channel === "image-brief"
          ? record.script_validation.passed
          : record.script_validation.passed &&
        record.director_audit !== undefined &&
        directorDraftPassed(record.director_audit);
      const failedChannels = waveChannels.filter((channel) =>
        records.some((record) => record.candidate.channel === channel && !recordSettled(record)),
      );
      notes = summarizeDirectorNotes(
        attemptNo,
        failedChannels.length > 0 ? failedChannels : waveChannels,
        records,
        picks,
        opts.feedback_wave_regime ?? "two-tier",
      );
      const completedAttempt: ActorDirectorAttempt = {
        attempt: attemptNo,
        ...(notesIn !== undefined ? { director_notes_in: notesIn } : {}),
        actor: actorResult,
        records,
        picks,
        selection_rationales: rationales,
        director_notes: notes,
      };
      attempts.push(completedAttempt);
      finalPicks = picks;
      finalSelectionRationales = rationales;
      await opts.onAttemptCompleted?.(completedAttempt);
      await emitRunEvent(opts.onEvent, {
        attempt: attemptNo,
        event_type: "attempt_completed",
        message: `Attempt ${attemptNo} completed with ${picks.length}/${channels.length} channel pick(s)`,
          payload: {
            picks: picks.map((pick) => ({ channel: pick.channel, text: pick.text })),
            selection_rationales: rationales,
            notes,
          },
      });
      // Done only when EVERY candidate of the latest wave settled (passed both
      // gates) — not when each channel merely has one passing pick. Failed
      // candidates are taken to their logical conclusion (pass or maxAttempts).
      if (failedChannels.length === 0) {
        await emitRunEvent(opts.onEvent, {
          event_type: "run_completed",
          message: "Actor/Director run completed — all candidates settled",
          payload: { exhausted: false, pick_count: picks.length },
        });
        return { attempts, picks, selection_rationales: rationales, exhausted: false };
      }

      if (attemptNo < maxAttempts) {
        // Next wave regenerates ONLY the channels that still carry failures.
        waveChannels = failedChannels;
        await emitRunEvent(opts.onEvent, {
          attempt: attemptNo,
          event_type: "failure_wave_targeted",
          message: `Retry wave ${attemptNo + 1} targets channel(s) with unsettled candidates: ${failedChannels.join(", ")}`,
          payload: { channels: failedChannels },
        });
      }

      // ── Targeted regeneration for zero-pick channels ─────────────────────────
      // Failure reasons are already carried to the next attempt by
      // summarizeDirectorNotes. This pass only makes the bounded regeneration
      // observable and caps it to once per channel per run.
      if (attemptNo < maxAttempts) {
        const pickedChannels = new Set(picks.map((pick) => pick.channel));
        const zeroPickChannels = channels.filter(
          (channel) => !pickedChannels.has(channel) && !targetedRetriedChannels.has(channel),
        );
        const feedback = collectChannelFailureFeedback(zeroPickChannels, records);
        const retryChannels = zeroPickChannels.filter((channel) => (feedback[channel]?.length ?? 0) > 0);
        if (retryChannels.length > 0) {
          for (const channel of retryChannels) targetedRetriedChannels.add(channel);
          await emitRunEvent(opts.onEvent, {
            attempt: attemptNo,
            event_type: "channel_regeneration_targeted",
            message: `Targeting bounded regeneration for zero-pick channel(s): ${retryChannels.join(", ")}`,
            payload: {
              channels: retryChannels,
              feedback: retryChannels.map((channel) => ({ channel, reasons: feedback[channel] ?? [] })),
            },
          });
        }
      }

      // ── Phase 1: AUDIT-TRIGGERED back-edge (backstop) ─────────────────────────
      // The eager round only sees holes the Actor itself declared. This round is
      // the backstop for holes the Director found at audit time. It collects any
      // residual table-work requests plus every Director audit's fact_requests,
      // dedupes against what was already asked, grounds, merges, and lets the next
      // attempt regenerate. Bounded by the shared ≤2-rounds-per-run budget.
      if (opts.grounder && !auditBackEdgeDone && grounderRounds < MAX_GROUNDER_ROUNDS && attemptNo < maxAttempts) {
        const requests = dedupeNewRequests(
          collectFactRequests(actorResult.output.table_work.fact_requests, records),
          askedQuestions,
        );
        if (requests.length > 0) {
          auditBackEdgeDone = true;
          const merged = await runFactRequestRound(opts, "audit", attemptNo, requests, currentCard);
          grounderRounds += 1;
          if (merged) {
            currentCard = merged;
            // Clear the transcript so the next attempt re-does table work against
            // the augmented card rather than patching the prior draft. KEEP the
            // notes — the regex/Director failure feedback rides into the fresh
            // assignment; dropping it made retry waves repeat the same failures.
            transcript = undefined;
          }
        }
      }
    }

    await emitRunEvent(opts.onEvent, {
      event_type: "run_exhausted",
      message: "Actor/Director run exhausted retries",
      payload: { exhausted: true, pick_count: finalPicks.length },
    });
    return {
      attempts,
      picks: finalPicks,
      selection_rationales: finalSelectionRationales,
      exhausted: true,
    };
  } catch (err) {
    await emitRunEvent(opts.onEvent, {
      event_type: "run_error",
      message: errorMessage(err),
      payload: errorPayload(err),
    });
    throw err;
  }
}

async function emitRunEvent(
  sink: ActorDirectorEventSink | undefined,
  event: ActorDirectorRunEvent,
): Promise<void> {
  if (!sink) return;
  await sink(event);
}

function validateCandidate(candidate: Candidate, card: ReleaseCard, voice: CharacterSpec): ValidationResult {
  if (candidate.channel === "image-brief") {
    return { passed: true, failures: [] };
  }
  const result = validate(candidate.text, {
    card,
    channel: candidate.channel,
    voice,
    ...(candidate.deployed_facts_used !== undefined ? { deployed_facts_used: candidate.deployed_facts_used } : {}),
    ...(candidate.not_said !== undefined ? { not_said: candidate.not_said } : {}),
  });
  const max = channelMaxLen(candidate.channel, card);
  if (candidate.text.length > max) {
    result.failures.push({
      rule: "length",
      reason: `length: ${candidate.text.length} > ${max} for channel ${candidate.channel}`,
    });
    result.passed = false;
  }
  if (candidate.structured) {
    for (const reason of structureIssues(candidate.structured)) {
      result.failures.push({ rule: "structure", reason });
      result.passed = false;
    }
  }
  // Outward channels must not carry internal version tags (changelog register).
  if (OUTWARD_CHANNELS.includes(candidate.channel)) {
    const versionTag = rejectOutwardVersionTag(candidate.text);
    if (!versionTag.passed) {
      result.failures.push({ rule: "outward-version-tag", reason: versionTag.reason ?? "version tag in outward channel" });
      result.passed = false;
    }
  }
  const movementFailures = validateActorMovement(candidate);
  if (movementFailures.length > 0) {
    result.failures.push(...movementFailures);
    result.passed = false;
  }
  return result;
}

export function validateActorMovement(candidate: Candidate): RuleFailure[] {
  const failures: RuleFailure[] = [];

  if (candidate.declared_beats.some((beat) => beat.tempo !== undefined)) {
    failures.push({
      rule: "actor-tempo-leak",
      reason: "Actor candidate declared a tempo; actor must score objective verbs and Working Actions only.",
    });
  }

  const score = candidate.movement_score ?? candidate.declared_beats.flatMap((beat) => {
    if (!beat.working_action || !beat.objective_verb || !beat.physical_score) return [];
    return [{
      objective_verb: beat.objective_verb,
      working_action: beat.working_action,
      physical_score: beat.physical_score,
      ...(beat.preparation_from ? { preparation_from: beat.preparation_from } : {}),
    }];
  });

  if (score.length === 0) {
    failures.push({
      rule: "movement-score",
      reason: "Actor candidate is missing movement_score; rhythm must be scored as Working Actions before prose is judged.",
    });
  }

  for (const [i, beat] of score.entries()) {
    if (!isWorkingAction(beat.working_action)) {
      failures.push({
        rule: "movement-score",
        reason: `movement_score.${i}.working_action is not a Mirodan Working Action: ${String(beat.working_action)}`,
      });
    }
    if (beat.preparation_from !== undefined && !isWorkingAction(beat.preparation_from)) {
      failures.push({
        rule: "movement-score",
        reason: `movement_score.${i}.preparation_from is not a Mirodan Working Action: ${String(beat.preparation_from)}`,
      });
    }
  }

  const validMotors = score
    .map((beat) => beat.working_action)
    .filter(isWorkingAction);
  for (const failingIndex of checkPrepHierarchy(validMotors)) {
    const quick = validMotors[failingIndex];
    if (!quick) continue;
    failures.push({
      rule: "movement-prep",
      reason: `${quick} requires prior ${PREPARATION_PAIRS[quick as QuickAction]} in the same movement score.`,
    });
  }

  const receipts = candidate.movement_receipt ?? [];
  if (receipts.length === 0) {
    failures.push({
      rule: "movement-receipt",
      reason: "Actor candidate is missing movement_receipt; selected prose must map text spans to Working Actions.",
    });
  }

  const scoreActions = new Set(validMotors);
  for (const [i, receipt] of receipts.entries()) {
    if (!isWorkingAction(receipt.working_action)) {
      failures.push({
        rule: "movement-receipt",
        reason: `movement_receipt.${i}.working_action is not a Mirodan Working Action: ${String(receipt.working_action)}`,
      });
      continue;
    }
    if (!scoreActions.has(receipt.working_action)) {
      failures.push({
        rule: "movement-receipt",
        reason: `movement_receipt.${i} uses ${receipt.working_action}, which is absent from the channel movement score.`,
      });
    }
    if (!receipt.text_span || !candidate.text.includes(receipt.text_span)) {
      failures.push({
        rule: "movement-receipt",
        reason: `movement_receipt.${i}.text_span does not appear exactly in candidate text.`,
      });
    }
  }

  return failures;
}

function isWorkingAction(value: unknown): value is WorkingAction {
  return (
    value === "pressing" ||
    value === "wringing" ||
    value === "gliding" ||
    value === "floating" ||
    value === "punching" ||
    value === "slashing" ||
    value === "dabbing" ||
    value === "flicking"
  );
}

function pickRankedPassingByChannel(
  records: ActorDirectorCandidateRecord[],
  channels: Channel[],
  operatorPreferences: OperatorSelectionPreference[],
): {
  picks: Candidate[];
  rationales: Partial<Record<Channel, FinalPickRationale>>;
} {
  const picks: Candidate[] = [];
  const rationales: Partial<Record<Channel, FinalPickRationale>> = {};
  for (const channel of channels) {
    const passing = records.filter((candidateRecord) =>
      candidateRecord.candidate.channel === channel &&
      candidateRecord.script_validation.passed &&
      (channel === "image-brief" ||
        (candidateRecord.director_audit !== undefined &&
          directorDraftPassed(candidateRecord.director_audit))),
    );
    if (passing.length === 0) continue;
    const clusterCounts = clusterCountsFor(passing);
    const warnings = clusterCounts.size === 1 && passing.length > 1
      ? [`All ${passing.length} passing ${channel} candidates share image-system cluster "${[...clusterCounts.keys()][0]}".`]
      : [];
    const ranked = passing
      .map((record) => {
        const selection = scoreCandidateForSelection(record, channel, clusterCounts, warnings, operatorPreferences);
        record.selection = selection;
        return { record, selection };
      })
      .sort((a, b) => b.selection.score - a.selection.score);
    const winner = ranked[0];
    if (!winner) continue;
    const rationale = formatSelectionRationale(winner.selection);
    winner.record.candidate.rationale = [
      winner.record.candidate.rationale,
      `Final pick rationale: ${rationale}`,
    ].filter(Boolean).join("\n\n");
    picks.push(winner.record.candidate);
    rationales[channel] = {
      channel,
      candidate_id: winner.record.candidate.id,
      score: winner.selection.score,
      image_cluster: winner.selection.image_cluster,
      rationale,
      warnings: winner.selection.warnings,
    };
  }
  return { picks, rationales };
}

function scoreCandidateForSelection(
  record: ActorDirectorCandidateRecord,
  channel: Channel,
  clusterCounts: Map<string, number>,
  sharedWarnings: string[],
  operatorPreferences: OperatorSelectionPreference[],
): CandidateSelectionScore {
  const audit = record.director_audit;
  const reasons: string[] = [];
  const warnings: string[] = [...sharedWarnings];
  let score = 0;
  if (record.script_validation.passed) {
    score += 100;
    reasons.push("script pass");
  }
  if (audit?.factual_passed) {
    score += 100;
    reasons.push("factual pass");
  }
  if (audit?.copy_voice_passed) {
    score += 100;
    reasons.push("copy/voice pass");
  }
  if (audit?.infinex_fit.legal) {
    score += 100;
    reasons.push("Infinex legal fit");
  }
  if (audit?.publication_gate_passed) {
    score += 8;
    reasons.push("publication gate clear");
  }
  if (record.candidate.rationale?.includes("(Actor recommended)")) {
    score += 6;
    reasons.push("Actor recommended");
  }

  const imageCluster = imageSystemCluster(record.candidate.text);
  const clusterSize = clusterCounts.get(imageCluster) ?? 1;
  if (clusterSize > 1) {
    score -= Math.min(10, clusterSize * 2);
    reasons.push(`image cluster repetition penalty ${imageCluster}`);
  } else {
    score += 4;
    reasons.push(`distinct image cluster ${imageCluster}`);
  }

  const repetition = repetitionPenalty(record.candidate.text);
  if (repetition > 0) {
    score -= repetition;
    reasons.push(`lower repetition preferred (-${repetition})`);
  }
  const railPenalty = railTokenPenalty(record.candidate.text);
  if (railPenalty > 0) {
    score -= railPenalty;
    reasons.push(`rail/token excess penalty (-${railPenalty})`);
  }
  const channelPenalty = channelFitPenalty(record.candidate.text, channel);
  if (channelPenalty > 0) {
    score -= channelPenalty;
    reasons.push(`channel fit penalty (-${channelPenalty})`);
  } else {
    score += 4;
    reasons.push("channel fit");
  }
  const voicePenalty = (audit?.voice_issues.length ?? 0) * 12 + (audit?.factual_issues.length ?? 0) * 20;
  if (voicePenalty > 0) {
    score -= voicePenalty;
    reasons.push(`issue penalty (-${voicePenalty})`);
  }
  const preferenceScore = operatorPreferenceScore(record.candidate, channel, operatorPreferences);
  if (preferenceScore.delta !== 0) {
    score += preferenceScore.delta;
    reasons.push(...preferenceScore.reasons);
    warnings.push(...preferenceScore.warnings);
  }
  return {
    score,
    image_cluster: imageCluster,
    reasons,
    warnings,
  };
}

function operatorPreferenceScore(
  candidate: Candidate,
  channel: Channel,
  preferences: OperatorSelectionPreference[],
): { delta: number; reasons: string[]; warnings: string[] } {
  const haystack = `${candidate.text}\n${candidate.rationale ?? ""}`.toLowerCase();
  let delta = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  for (const preference of preferences) {
    if (preference.channel !== undefined && preference.channel !== channel) continue;
    const weight = Math.max(1, preference.weight ?? 12);
    const reason = preference.reason ? ` (${preference.reason})` : "";
    if (preference.prefer && haystack.includes(preference.prefer.toLowerCase())) {
      delta += weight;
      reasons.push(`operator preference matched "${preference.prefer}" +${weight}${reason}`);
    }
    if (preference.avoid && haystack.includes(preference.avoid.toLowerCase())) {
      delta -= weight;
      reasons.push(`operator avoidance matched "${preference.avoid}" -${weight}${reason}`);
      warnings.push(`Operator avoidance matched "${preference.avoid}".`);
    }
  }
  return { delta, reasons, warnings };
}

function formatSelectionRationale(selection: CandidateSelectionScore): string {
  const warningText = selection.warnings.length > 0
    ? ` Warnings: ${selection.warnings.join(" ")}`
    : "";
  return `score ${selection.score}; image cluster ${selection.image_cluster}; ${selection.reasons.join(", ")}.${warningText}`;
}

function clusterCountsFor(records: ActorDirectorCandidateRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const cluster = imageSystemCluster(record.candidate.text);
    counts.set(cluster, (counts.get(cluster) ?? 0) + 1);
  }
  return counts;
}

function imageSystemCluster(text: string): string {
  const lower = text.toLowerCase();
  const families: Array<[string, RegExp]> = [
    ["wall-boundary", /\b(wall|boundary|border|territory|map|frontier|door|gate)\b/],
    ["rail-plumbing", /\b(rail|route|pipe|plumbing|wire|sepa|iban|ach|routing|account number)\b/],
    ["account-surface", /\b(account|passkey|wallet|portfolio|surface)\b/],
    ["market-object", /\b(market|orderbook|perp|spot|liquidity|asset)\b/],
    ["spark-object", /\b(spark|dial|filament|vault|signal|ignition)\b/],
  ];
  return families.find(([, re]) => re.test(lower))?.[0] ?? "fact-literal";
}

function repetitionPenalty(text: string): number {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.length < 4) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.values()].reduce((penalty, count) => penalty + Math.max(0, count - 1) * 4, 0);
}

function railTokenPenalty(text: string): number {
  const matches = text.match(/\b(wire|sepa|iban|ach|routing|pix|spei|fps|brl|eur|usd|mxn|cop|rail|rails)\b/gi) ?? [];
  return Math.max(0, matches.length - 2) * 5;
}

function channelFitPenalty(text: string, channel: Channel): number {
  const limit = CHANNEL_MAX_LEN[channel];
  // "ideal" lengths are starting guesses — calibrate from real output (the per-20-char
  // granularity is tuned for short channels; revisit for blog once we see candidates).
  const ideal =
    channel === "x" ? 180
      : channel === "x-thread" ? 720
        : channel === "web" ? 120
          : channel === "carousel" ? 900
            : channel === "modal" ? 180
              : channel === "blog" ? 2400
                : 60;
  const lengthPenalty = text.length > ideal ? Math.ceil((text.length - ideal) / 20) * 3 : 0;
  // Structured readable renderings use line breaks by design.
  const allowsParagraphs = channel === "x" || channel === "x-thread" || channel === "web" || channel === "carousel" || channel === "blog" || channel === "modal";
  const paragraphPenalty = !allowsParagraphs && text.includes("\n") ? 10 : 0;
  const overLimitPenalty = text.length > limit ? 100 : 0;
  return lengthPenalty + paragraphPenalty + overLimitPenalty;
}

function summarizeDirectorNotes(
  attempt: number,
  channels: Channel[],
  records: ActorDirectorCandidateRecord[],
  picks: Candidate[],
  feedbackWaveRegime: FeedbackWaveRegime,
): DirectorNotes {
  const pickedChannels = new Set(picks.map((candidate) => candidate.channel));
  const missing = channels.filter((channel) => !pickedChannels.has(channel));
  const notes: string[] = [];
  const regexFormatNotes: string[] = [];
  const directorContentNotes: string[] = [];
  const change: NonNullable<DirectorNotes["change"]> = {};
  const preserve: NonNullable<DirectorNotes["preserve"]> = {
    through_action: true,
    beat_plan: true,
    working_actions: true,
    objective_verbs: true,
  };

  if (missing.length > 0) {
    notes.push(`Missing valid performances for channels: ${missing.join(", ")}.`);
    change.copy = [...(change.copy ?? []), `produce legal candidates for ${missing.join(", ")}`];
  }

  for (const record of records) {
    if (!record.script_validation.passed) {
      for (const failure of record.script_validation.failures) {
        const line = `${record.candidate.channel}: regex/format rejected "${preview(record.candidate.text)}" because ${failure.rule} — ${failure.reason}.`;
        notes.push(line);
        regexFormatNotes.push(line);
        if (failure.rule?.startsWith("movement")) {
          preserve.working_actions = false;
          change.movement = [...(change.movement ?? []), `${record.candidate.channel}: ${failure.reason}`];
        } else if (failure.rule === "fact-contract") {
          change.facts = [...(change.facts ?? []), `${record.candidate.channel}: ${failure.reason}`];
        } else {
          change.format = [...(change.format ?? []), `${record.candidate.channel}: ${failure.reason}`];
        }
        if (notes.length >= 10) break;
      }
    }
    const audit = record.director_audit;
    if (!audit) continue;
    if (!directorDraftPassed(audit)) {
      const line = `${record.candidate.channel}: Director read ${audit.primary_tempo} (${audit.primary_confidence.toFixed(2)}). ${directorFailureReason(audit)}.`;
      notes.push(line);
      directorContentNotes.push(line);
      const actorNotes = audit.notes_for_actor.map((note) => `${record.candidate.channel}: ${note}`);
      notes.push(...actorNotes);
      directorContentNotes.push(...actorNotes);
      if (!audit.factual_passed) {
        change.facts = [...(change.facts ?? []), ...audit.factual_issues.map((issue) => `${record.candidate.channel}: ${issue}`)];
      }
      if (!audit.copy_voice_passed || !audit.infinex_fit.legal) {
        change.voice = [...(change.voice ?? []), ...audit.voice_issues.map((issue) => `${record.candidate.channel}: ${issue}`)];
      }
      if (!audit.movement_receipt_fit.passed) {
        preserve.working_actions = false;
        change.movement = [...(change.movement ?? []), ...audit.movement_receipt_fit.issues.map((issue) => `${record.candidate.channel}: ${issue}`)];
      }
    }
    const selectionWarnings = record.selection?.warnings ?? [];
    if (selectionWarnings.length > 0) {
      change.metaphor_image_system = [
        ...(change.metaphor_image_system ?? []),
        ...selectionWarnings.map((warning) => `${record.candidate.channel}: ${warning}`),
      ];
    }
    if (notes.length >= 10) break;
  }

  const feedbackWave = buildFeedbackWaveSummary(
    feedbackWaveRegime,
    channels,
    records,
    picks,
    regexFormatNotes,
    directorContentNotes,
  );

  return {
    attempt,
    summary: notes.length > 0 ? notes.slice(0, 10).join("\n") : "All requested channels have a passing performance.",
    notes: notes.slice(0, 10),
    feedback_wave: feedbackWave,
    preserve,
    change,
  };
}

function buildFeedbackWaveSummary(
  regime: FeedbackWaveRegime,
  channels: Channel[],
  records: ActorDirectorCandidateRecord[],
  picks: Candidate[],
  regexFormatNotes: string[],
  directorContentNotes: string[],
): FeedbackWaveSummary {
  const pickedChannels = new Set(picks.map((candidate) => candidate.channel));
  const directorGreenChannels = new Set(
    records
      .filter((record) => record.director_audit && directorDraftPassed(record.director_audit))
      .map((record) => record.candidate.channel),
  );
  const holisticGreenChannels = channels.filter((channel) => directorGreenChannels.has(channel));
  const holisticRevisionChannels = channels.filter((channel) => !directorGreenChannels.has(channel));
  const missingOnlyForFormat = channels.some((channel) => !pickedChannels.has(channel)) &&
    holisticRevisionChannels.length === 0 &&
    regexFormatNotes.length > 0;
  const tier: FeedbackWaveSummary["tier"] = regime === "two-tier" && missingOnlyForFormat
    ? "tier-2-section-polish"
    : "tier-1-holistic";

  const reviseSections = records
    .flatMap((record) => sectionsToRevise(record, tier))
    .slice(0, 24);
  const reviseKeys = new Set(reviseSections.map(sectionKey));
  const lockedSections = tier === "tier-2-section-polish"
    ? records
      .filter((record) => record.director_audit && directorDraftPassed(record.director_audit))
      .flatMap((record) => candidateSections(record.candidate)
        .filter((section) => !reviseKeys.has(sectionKey(section)))
        .map((section) => ({ ...section, reason: "Director holistic read is green; preserve while fixing neighboring mechanical issues." })))
      .slice(0, 24)
    : [];

  return {
    regime,
    tier,
    holistic_green_channels: holisticGreenChannels,
    holistic_revision_channels: holisticRevisionChannels,
    locked_sections: lockedSections,
    revise_sections: reviseSections,
    regex_format_notes: regexFormatNotes.slice(0, 12),
    director_content_notes: directorContentNotes.slice(0, 12),
  };
}

function sectionsToRevise(
  record: ActorDirectorCandidateRecord,
  tier: FeedbackWaveSummary["tier"],
): FeedbackWaveSection[] {
  const sections = candidateSections(record.candidate);
  if (!record.director_audit || !directorDraftPassed(record.director_audit)) {
    return tier === "tier-1-holistic"
      ? [{
        channel: record.candidate.channel,
        section: "whole",
        text_span: preview(record.candidate.text),
        reason: "Director holistic tone/content read is not green; no sections are locked.",
      }]
      : [];
  }
  if (record.script_validation.passed) return [];
  const out: FeedbackWaveSection[] = [];
  for (const failure of record.script_validation.failures) {
    const labels = labelsMentionedByFailure(failure.reason);
    if (labels.length === 0) {
      out.push({
        channel: record.candidate.channel,
        section: "whole",
        text_span: preview(record.candidate.text),
        reason: `${failure.rule}: ${failure.reason}`,
      });
      continue;
    }
    for (const label of labels) {
      const section = sections.find((candidateSection) => candidateSection.section === label);
      out.push({
        channel: record.candidate.channel,
        section: label,
        ...(section?.text_span !== undefined ? { text_span: section.text_span } : {}),
        reason: `${failure.rule}: ${failure.reason}`,
      });
    }
  }
  return dedupeSections(out);
}

function candidateSections(candidate: Candidate): FeedbackWaveSection[] {
  if (candidate.structured?.kind === "thread") {
    return candidate.structured.tweets.map((tweet, i) => ({
      channel: candidate.channel,
      section: `tweet ${i + 1}`,
      text_span: preview(tweet),
      reason: "section available for locking",
    }));
  }
  if (candidate.structured?.kind === "carousel") {
    return candidate.structured.slides.map((slide, i) => ({
      channel: candidate.channel,
      section: `slide ${i + 1}`,
      text_span: preview(`${slide.name}: ${slide.body}`),
      reason: "section available for locking",
    }));
  }
  if (candidate.structured?.kind === "web-card") {
    return [
      { channel: candidate.channel, section: "subheading", text_span: candidate.structured.subheading, reason: "section available for locking" },
      { channel: candidate.channel, section: "title", text_span: candidate.structured.title, reason: "section available for locking" },
      { channel: candidate.channel, section: "caption", text_span: candidate.structured.caption, reason: "section available for locking" },
    ];
  }
  const paragraphs = candidate.text.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return [{ channel: candidate.channel, section: "whole", text_span: "", reason: "section available for locking" }];
  }
  return paragraphs.map((paragraph, i) => ({
    channel: candidate.channel,
    section: paragraphs.length === 1 ? "whole" : `paragraph ${i + 1}`,
    text_span: preview(paragraph),
    reason: "section available for locking",
  }));
}

function labelsMentionedByFailure(reason: string): string[] {
  const lower = reason.toLowerCase();
  const labels: string[] = [];
  for (const match of lower.matchAll(/\btweet\s+(\d+)\b/g)) labels.push(`tweet ${match[1]}`);
  for (const match of lower.matchAll(/\bslide\s+(\d+)\b/g)) labels.push(`slide ${match[1]}`);
  for (const label of ["subheading", "title", "caption"]) {
    if (lower.includes(label)) labels.push(label);
  }
  return [...new Set(labels)];
}

function dedupeSections(sections: FeedbackWaveSection[]): FeedbackWaveSection[] {
  const seen = new Set<string>();
  const out: FeedbackWaveSection[] = [];
  for (const section of sections) {
    const key = sectionKey(section);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(section);
  }
  return out;
}

function sectionKey(section: FeedbackWaveSection): string {
  return `${section.channel}:${section.section}`;
}

function directorDraftPassed(audit: DirectorAuditResult): boolean {
  return audit.copy_voice_passed && audit.factual_passed && audit.infinex_fit.legal;
}

/**
 * Batch + dedupe fact_requests from the Actor's table work and every Director
 * audit in the attempt. Dedup is by normalized question text; channels are
 * unioned so a question shared across channels is asked once.
 */
export function collectFactRequests(
  actorRequests: FactRequest[],
  records: ActorDirectorCandidateRecord[],
): FactRequest[] {
  const byQuestion = new Map<string, FactRequest>();
  const ingest = (request: FactRequest): void => {
    const question = request.question.trim();
    if (!question) return;
    const key = question.toLowerCase().replace(/\s+/g, " ");
    const existing = byQuestion.get(key);
    const channels = new Set<Channel>([
      ...(existing?.channels ?? []),
      ...(request.channels ?? []),
    ]);
    byQuestion.set(key, {
      question: existing?.question ?? question,
      ...(existing?.reason || request.reason
        ? { reason: existing?.reason ?? request.reason }
        : {}),
      ...(channels.size > 0 ? { channels: [...channels] } : {}),
    });
  };
  for (const request of actorRequests) ingest(request);
  for (const record of records) {
    for (const request of record.director_audit?.fact_requests ?? []) ingest(request);
  }
  return [...byQuestion.values()];
}

/**
 * Build per-channel failure feedback for channels that ended a round with zero
 * passing candidates. summarizeDirectorNotes already feeds these reasons into
 * the next Actor attempt; this helper only gates and reports targeted retries.
 */
export function collectChannelFailureFeedback(
  channels: Channel[],
  records: ActorDirectorCandidateRecord[],
): Partial<Record<Channel, string[]>> {
  const out: Partial<Record<Channel, string[]>> = {};
  for (const channel of channels) {
    const reasons: string[] = [];
    for (const record of records) {
      if (record.candidate.channel !== channel) continue;
      for (const failure of record.script_validation.failures) {
        reasons.push(`script ${failure.rule}: ${failure.reason}`);
      }
      const audit = record.director_audit;
      if (audit && !directorDraftPassed(audit)) {
        for (const issue of audit.voice_issues) reasons.push(`voice: ${issue}`);
        for (const issue of audit.factual_issues) reasons.push(`factual: ${issue}`);
        for (const issue of audit.publication_gate_issues) reasons.push(`publication-gate: ${issue}`);
        for (const note of audit.notes_for_actor) reasons.push(`director: ${note}`);
      }
    }
    if (reasons.length > 0) out[channel] = [...new Set(reasons)].slice(0, 12);
  }
  return out;
}

/** Append grounded answers to the card's deployed_facts, skipping duplicates. */
export function mergeGroundedFacts(card: ReleaseCard, answers: GroundedFactAnswer[]): ReleaseCard {
  const existing = new Set(card.deployed_facts.map((fact) => deployedFactClaim(fact).toLowerCase().trim()));
  const additions: DeployedFact[] = [];
  for (const answer of answers) {
    const claim = deployedFactClaim(answer.fact).toLowerCase().trim();
    if (!claim || existing.has(claim)) continue;
    existing.add(claim);
    additions.push(answer.fact);
  }
  if (additions.length === 0) return card;
  return { ...card, deployed_facts: [...card.deployed_facts, ...additions] };
}

function questionKey(question: string): string {
  return question.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Drop requests whose question was already asked in a prior grounder round, and
 * record the survivors so a later round will not re-ask them. Dedup is run-wide
 * across the eager and audit-triggered rounds.
 */
export function dedupeNewRequests(requests: FactRequest[], asked: Set<string>): FactRequest[] {
  const out: FactRequest[] = [];
  for (const request of requests) {
    const key = questionKey(request.question);
    if (!key || asked.has(key)) continue;
    asked.add(key);
    out.push(request);
  }
  return out;
}

/**
 * Run one grounder round (eager or audit-triggered): emit the collected event,
 * call the grounder, merge any answers, and emit the answered/unanswered/error
 * event. Every event carries `trigger` so the harness timeline can distinguish
 * eager vs audit-triggered grounding. Returns the augmented card, or null if no
 * facts came back (caller leaves currentCard unchanged).
 */
async function runFactRequestRound(
  opts: ActorDirectorRetryOptions,
  trigger: "eager" | "audit",
  attemptNo: number,
  requests: FactRequest[],
  card: ReleaseCard,
): Promise<ReleaseCard | null> {
  await emitRunEvent(opts.onEvent, {
    attempt: attemptNo,
    event_type: "fact_requests_collected",
    message: `[${trigger}] Collected ${requests.length} deduplicated fact request(s) for the grounder`,
    payload: { trigger, fact_requests: requests },
  });
  let answers: GroundedFactAnswer[] = [];
  try {
    answers = await opts.grounder!(requests, card);
  } catch (err) {
    await emitRunEvent(opts.onEvent, {
      attempt: attemptNo,
      event_type: "fact_request_grounding_error",
      message: errorMessage(err),
      payload: { trigger, ...errorPayload(err) },
    });
    return null;
  }
  if (answers.length === 0) {
    await emitRunEvent(opts.onEvent, {
      attempt: attemptNo,
      event_type: "fact_requests_unanswered",
      message: `[${trigger}] Grounder returned no answers; continuing without back-edge`,
      payload: { trigger, fact_requests: requests },
    });
    return null;
  }
  const merged = mergeGroundedFacts(card, answers);
  await emitRunEvent(opts.onEvent, {
    attempt: attemptNo,
    event_type: "fact_requests_answered",
    message: `[${trigger}] Grounder answered ${answers.length} request(s); merged into deployed_facts and ${trigger === "eager" ? "re-running the Actor" : "regenerating"}`,
    payload: {
      trigger,
      answers: answers.map((a) => ({
        question: a.question,
        fact: deployedFactClaim(a.fact),
        provenance: a.provenance ?? null,
      })),
      deployed_facts_count: merged.deployed_facts.length,
    },
  });
  return merged;
}

function directorFailureReason(audit: DirectorAuditResult): string {
  if (!audit.infinex_fit.legal) return audit.infinex_fit.reason || "off-character read";
  if (!audit.copy_voice_passed) return audit.voice_issues.join("; ") || "copy/voice gate failed";
  if (!audit.factual_passed) return audit.factual_issues.join("; ") || "factual gate failed";
  return audit.infinex_fit.reason || "draft gate failed";
}

function preview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown Actor/Director error";
  }
}

function errorPayload(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return {};
  const record = err as Record<string, unknown>;
  return {
    ...(typeof record.status === "number" ? { status: record.status } : {}),
    ...(typeof record.statusCode === "number" ? { statusCode: record.statusCode } : {}),
    ...(typeof record.request_id === "string" ? { request_id: record.request_id } : {}),
    ...(typeof record.message === "string" ? { message: record.message } : {}),
    ...(record.error && typeof record.error === "object" ? { error: record.error } : {}),
  };
}
