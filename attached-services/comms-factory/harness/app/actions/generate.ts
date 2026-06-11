'use server';

import { revalidatePath } from 'next/cache';
import { generate, type Candidate, type GenerationPromptCapture } from '@pipeline/generator';
import {
  type ActorDirectorAttempt,
  orchestrateActorDirectorWithRetries,
  type ActorDirectorResult,
  type ActorDirectorRunEvent,
  type FactRequestGrounderFn,
  type GroundedFactAnswer,
} from '@pipeline/actor-orchestrator';
import {
  buildActorAssignmentMessage,
  buildDirectorNotesMessage,
  parseActorWarmupMode,
  type ActorTranscriptMessage,
  type DirectorNotes,
  type FeedbackWaveRegime,
  type VerticalFlowDirection,
} from '@pipeline/actor-director';
import { groundFacts } from '@pipeline/fact-grounder-llm';
import { buildPipeline3Proof, PIPELINE_3_ENTRYPOINT, type PipelineIdentityReport } from '@pipeline/pipeline-identity';
import {
  orchestrateActiveWithRetries,
  orchestrateWithRetries,
  type ActiveRetryOrchestrationResult,
} from '@pipeline/orchestrator';
import { parseReleaseCard } from '@pipeline/card';
import { validate } from '@pipeline/validator';
import type { BeatSequence } from '@pipeline/voice/types';
import type { HistoryGuardResult, ShippedCopyRecord } from '@pipeline/history-guards';
import type { ActiveValidationVerdict } from '@pipeline/validator-active';
import { classifyText } from '@/lib/classifier-wrapper';
import { spliceToggles, hasToggle } from '@/lib/markdown-splice';
import { regroundCard, grounderEventMessage } from '@/lib/reground';
import { getDb, newId, nowIso, writeTx } from '@/lib/db';
import { makeSemanticShifts, makeTextDiff } from '@/lib/diff';
import {
  CHANNELS,
  expectedChannelsForCard,
  getReleaseCardJson,
  getRunningActorRun,
  listApprovedApiHosts,
  requireCard,
  requireCandidate,
} from '@/lib/queries';
import { defaultBeatsForVoice, voiceSpecFor } from '@/lib/voice';
import type { CandidateDecision, Channel, HarnessActorRun, HarnessCandidate } from '@/lib/types';

const EFFECTIVE_ACTOR_MODEL = process.env.COMMS_ACTOR_MODEL ?? 'claude-opus-4-7';
const EFFECTIVE_DIRECTOR_MODEL =
  process.env.COMMS_DIRECTOR_MODEL ?? process.env.COMMS_ACTIVE_VALIDATOR_MODEL ?? 'claude-sonnet-4-6';

/** Seed for a manual "regenerate with notes": the prior draft (as a transcript)
 * plus the notes — operator-authored, or forwarded from the Director — that steer
 * the Actor's revision on attempt 1. */
interface ActorRegenSeed {
  seed_transcript: ActorTranscriptMessage[];
  seed_notes?: DirectorNotes;
}

/** Operator-handback finalize context (see app/actions/handback.ts). After the
 * run, the best regenerated candidate for `channel` is auto-picked so the operator
 * sees the result on the surface card; `baseText` (the operator's edited copy)
 * triggers a toggle-stub splice so their surrounding copy stays byte-for-byte. */
interface HandbackContext {
  channel: Channel;
  baseText?: string;
}

interface CandidateAuditPersistence {
  active_validation_passed: boolean;
  active_audit_json: string;
  history_guard_passed: boolean | null;
  history_guard_json: string | null;
}

interface AttemptPersistence {
  /** Orchestrator-level attempt number (1-indexed within this run). */
  orchestratorAttempt: number;
  /** Auto-feedback fed INTO this attempt (undefined for first attempt). */
  feedbackIn: string | undefined;
  /** Prompts the generator built for this attempt. Empty in stub mode. */
  capture: GenerationPromptCapture;
}

function getOrCreateActorRun(
  db: ReturnType<typeof getDb>,
  cardId: string,
  channels: Channel[],
): { run: HarnessActorRun; created: boolean } {
  ensureActorRunsTable(db);
  return writeTx(db, () => {
    const existing = getRunningActorRun(cardId, db);
    if (existing) return { run: existing, created: false };
    const run: HarnessActorRun = {
      id: newId(),
      card_id: cardId,
      status: 'running',
      channels_json: JSON.stringify(channels),
      started_at: nowIso(),
      completed_at: null,
      error: null,
    };
    try {
      db.prepare(
        `INSERT INTO actor_runs
           (id, card_id, status, channels_json, started_at, completed_at, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        run.id,
        run.card_id,
        run.status,
        run.channels_json,
        run.started_at,
        run.completed_at,
        run.error,
      );
      return { run, created: true };
    } catch (err) {
      const raced = getRunningActorRun(cardId, db);
      if (raced) return { run: raced, created: false };
      throw err;
    }
  });
}

function startActorGeneratorTask(opts: {
  cardId: string;
  channels: Channel[];
  n?: number;
  runId: string;
  seed?: ActorRegenSeed;
  handback?: HandbackContext;
}): void {
  void runActorGeneratorJob(opts);
}

async function runActorGeneratorJob(opts: {
  cardId: string;
  channels: Channel[];
  n?: number;
  runId: string;
  seed?: ActorRegenSeed;
  handback?: HandbackContext;
}): Promise<void> {
  try {
    const result = await runActorGenerator(opts.cardId, opts.channels, opts.n, opts.runId, opts.seed);
    const counts = countCandidatesByChannel(result.candidates_by_channel);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const db = getDb();
    persistActorRunEvent(db, opts.cardId, opts.runId, {
      event_type: 'run_persisted',
      message: `Persisted ${total} candidate${total === 1 ? '' : 's'} to the harness`,
      payload: { candidate_count: total, candidates_by_channel: counts },
    });
    markActorRunCompleted(db, opts.runId);
    if (opts.handback) {
      try {
        finalizeHandback(db, opts.cardId, opts.handback);
      } catch (finalizeErr) {
        persistActorRunEvent(db, opts.cardId, opts.runId, {
          event_type: 'handback_finalize_error',
          message: errorMessage(finalizeErr),
          payload: { channel: opts.handback.channel },
        });
      }
    }
    // No revalidatePath here: this runs in a DETACHED background task (the request
    // that started it already returned), where revalidatePath throws "used during
    // render" and was wrongly marking completed runs as failed. The client
    // ActorRunEventsPanel polls /api/.../actor-events and calls router.refresh()
    // on status change, which re-renders the new candidates.
  } catch (err) {
    const db = getDb();
    const message = errorMessage(err);
    try {
      persistActorRunEvent(db, opts.cardId, opts.runId, {
        event_type: 'run_failed',
        message,
        payload: { error: message },
      });
      markActorRunFailed(db, opts.runId, message);
    } catch (persistErr) {
      console.error('Failed to persist actor run failure', persistErr);
    }
  }
}

function countCandidatesByChannel(candidatesByChannel: Record<Channel, HarnessCandidate[]>): Record<Channel, number> {
  return Object.fromEntries(
    Object.entries(candidatesByChannel).map(([channel, candidates]) => [channel, candidates.length]),
  ) as Record<Channel, number>;
}

function emptyCandidateGroups(): Record<Channel, HarnessCandidate[]> {
  const groups = {} as Record<Channel, HarnessCandidate[]>;
  for (const channel of CHANNELS) groups[channel] = [];
  return groups;
}

function copyChannels(channels: Channel[]): Channel[] {
  return channels.filter((channel) => channel !== 'image-brief');
}

export async function runGenerator(
  card_id: string,
  channels?: Channel[],
  opts?: { n?: number; retry?: boolean; seed?: ActorRegenSeed; handback?: HandbackContext },
): Promise<{ run: HarnessActorRun; existing: boolean }> {
  const db = getDb();
  const card = requireCard(card_id, db);
  if (!card.card_approved_at) {
    throw new Error('Card stage must be approved before running the generator.');
  }
  // Default to channels derived from the release card's audience, not all three
  const activeChannels = channels ?? expectedChannelsForCard(card_id, db);
  if (process.env.HARNESS_GENERATOR_ARCH !== 'legacy') {
    process.env.HARNESS_GENERATOR_ARCH = 'actor';
    const actorChannels = copyChannels(activeChannels);
    if (actorChannels.length > 0 && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY is required to run the actor/director generator in the harness. Actor/director stub generation has been removed; use the legacy generator if you need explicit stub output.',
      );
    }
    if (actorChannels.length === 0 && !process.env.ANTHROPIC_API_KEY && process.env.HARNESS_ALLOW_STUB_GENERATOR !== '1') {
      throw new Error(
        'ANTHROPIC_API_KEY is required to run image brief generation. Set HARNESS_ALLOW_STUB_GENERATOR=1 to explicitly allow stub generation.',
      );
    }
    const { run, created } = getOrCreateActorRun(db, card_id, activeChannels);
    if (created)
      startActorGeneratorTask({
        cardId: card_id,
        channels: activeChannels,
        n: opts?.n,
        runId: run.id,
        ...(opts?.seed ? { seed: opts.seed } : {}),
        ...(opts?.handback ? { handback: opts.handback } : {}),
      });
    revalidatePath(`/cards/${card_id}`);
    revalidatePath('/');
    return { run, existing: !created };
  }
  const batches = await Promise.all(
    activeChannels.map((channel) => generateForChannel(card_id, channel, opts?.n, undefined)),
  );
  const result = emptyCandidateGroups();
  for (const batch of batches) result[batch.channel] = batch.candidates;
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return {
    run: {
      id: `legacy-${newId()}`,
      card_id,
      status: 'completed',
      channels_json: JSON.stringify(activeChannels),
      started_at: nowIso(),
      completed_at: nowIso(),
      error: null,
    },
    existing: false,
  };
}

/**
 * Operator surface-handback: reground (optional) + regenerate (optional) run as a
 * SINGLE detached job that streams grounder → actor → director events to the run-
 * events panel. Returns the run immediately so the modal can switch to a live
 * progress view; nothing blocks the request on the (slow) grounder.
 */
export async function startSurfaceHandback(opts: {
  cardId: string;
  channel: Channel;
  candidateAttempt: number;
  priorDraft: string;
  regroundPrompt?: string;
  regeneratePrompt?: string;
  scope: 'block' | 'whole';
}): Promise<{ run: HarnessActorRun; existing: boolean }> {
  const db = getDb();
  const card = requireCard(opts.cardId, db);
  if (!card.card_approved_at) throw new Error('Card stage must be approved before regenerating.');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required to reground / regenerate.');

  const { run, created } = getOrCreateActorRun(db, opts.cardId, [opts.channel]);
  if (created) void runHandbackJob({ ...opts, runId: run.id });
  revalidatePath(`/cards/${opts.cardId}`);
  revalidatePath('/');
  return { run, existing: !created };
}

async function runHandbackJob(opts: {
  cardId: string;
  channel: Channel;
  candidateAttempt: number;
  priorDraft: string;
  regroundPrompt?: string;
  regeneratePrompt?: string;
  scope: 'block' | 'whole';
  runId: string;
}): Promise<void> {
  const db = getDb();
  try {
    if (opts.regroundPrompt?.trim()) {
      const prompt = opts.regroundPrompt.trim();
      persistActorRunEvent(db, opts.cardId, opts.runId, {
        event_type: 'reground_started',
        message: `Grounder researching: ${prompt}`,
        channel: opts.channel,
      });
      const { verified, unverifiable } = await regroundCard(opts.cardId, prompt, (event) =>
        persistActorRunEvent(db, opts.cardId, opts.runId, {
          event_type: `grounder_${(event as { type: string }).type}`,
          message: grounderEventMessage(event),
          channel: opts.channel,
          payload: event as unknown as Record<string, unknown>,
        }),
      );
      persistActorRunEvent(db, opts.cardId, opts.runId, {
        event_type: 'reground_complete',
        message: `Grounded ${verified} fact${verified === 1 ? '' : 's'} into the card`,
        channel: opts.channel,
        payload: { facts: verified },
      });

      // GATE: if the reground couldn't verify what was asked, STOP — do NOT hand a
      // half-grounded card to the actor. Surface the gaps and let the operator vouch
      // a fact, supply a source, or proceed without it.
      if (opts.regeneratePrompt?.trim() && unverifiable.length > 0) {
        persistActorRunEvent(db, opts.cardId, opts.runId, {
          event_type: 'reground_halted',
          message: `Halted — grounder could not verify ${unverifiable.length} claim${unverifiable.length === 1 ? '' : 's'}. Did NOT hand off to the actor.`,
          channel: opts.channel,
          payload: { unverifiable },
        });
        markActorRunCompleted(db, opts.runId);
        return;
      }
    }

    if (opts.regeneratePrompt?.trim()) {
      const seed = buildHandbackSeed(
        db,
        opts.cardId,
        opts.channel,
        opts.priorDraft,
        opts.candidateAttempt,
        opts.regeneratePrompt.trim(),
      );
      const result = await runActorGenerator(opts.cardId, [opts.channel], undefined, opts.runId, seed);
      const total = Object.values(countCandidatesByChannel(result.candidates_by_channel)).reduce((s, c) => s + c, 0);
      persistActorRunEvent(db, opts.cardId, opts.runId, {
        event_type: 'run_persisted',
        message: `Persisted ${total} candidate${total === 1 ? '' : 's'} to the harness`,
        payload: { candidate_count: total },
      });
      const baseText = opts.scope === 'block' && hasToggle(opts.priorDraft) ? opts.priorDraft : undefined;
      finalizeHandback(db, opts.cardId, { channel: opts.channel, baseText });
      persistActorRunEvent(db, opts.cardId, opts.runId, {
        event_type: 'handback_picked',
        message: `Best ${opts.channel} draft auto-picked${baseText ? ' (spliced into your copy)' : ''} — review and ship`,
        channel: opts.channel,
      });
    }

    markActorRunCompleted(db, opts.runId);
  } catch (err) {
    const message = errorMessage(err);
    try {
      persistActorRunEvent(db, opts.cardId, opts.runId, {
        event_type: 'run_failed',
        message,
        payload: { error: message },
      });
      markActorRunFailed(db, opts.runId, message);
    } catch (persistErr) {
      console.error('Failed to persist handback failure', persistErr);
    }
  }
}

/** Build the actor seed AFTER reground so its assignment carries the new facts. */
function buildHandbackSeed(
  db: ReturnType<typeof getDb>,
  cardId: string,
  channel: Channel,
  priorDraft: string,
  attempt: number,
  prompt: string,
): ActorRegenSeed {
  const releaseCardJson = getReleaseCardJson(cardId, db);
  if (!releaseCardJson) throw new Error('No release card exists for this card.');
  const releaseCard = parseReleaseCard(JSON.parse(releaseCardJson));

  // Give the actor BOTH its last generation AND the operator's edit, plus the
  // captured word-diff, so it can SEE what the operator changed and preserve it —
  // not just receive the final text. priorDraft is the operator's edited copy
  // (the pick's final_text); the candidate behind the pick holds the original
  // machine generation (immutable); candidate_text_edits holds the word diff.
  const pickRow = db
    .prepare('SELECT candidate_id FROM final_picks WHERE card_id = ? AND channel = ?')
    .get(cardId, channel) as { candidate_id: string } | undefined;
  let generation: string | null = null;
  let wordDiff: string | null = null;
  if (pickRow) {
    const cand = db.prepare('SELECT text FROM candidates WHERE id = ?').get(pickRow.candidate_id) as
      | { text: string }
      | undefined;
    generation = cand?.text ?? null;
    const edit = db
      .prepare('SELECT word_diff_json FROM candidate_text_edits WHERE candidate_id = ? ORDER BY edited_at DESC LIMIT 1')
      .get(pickRow.candidate_id) as { word_diff_json: string } | undefined;
    wordDiff = edit?.word_diff_json ?? null;
  }

  const showDiff = generation !== null && generation.trim() !== priorDraft.trim();
  const parts = [buildActorAssignmentMessage(releaseCard, [channel], 5), ''];
  if (showDiff) {
    parts.push(
      '## Your last generation',
      generation!,
      '',
      "## The operator's edit of it — honour these changes",
      priorDraft,
      '',
      'The operator deliberately changed your draft above. Preserve their edits and intent; apply the revision notes; do NOT revert to your original wording. Return the full JSON envelope as usual.',
    );
    const rendered = wordDiff ? renderWordDiff(wordDiff) : null;
    if (rendered) parts.push('', '## What changed (− your wording, + operator)', rendered);
  } else {
    parts.push(
      '## Prior draft to revise',
      'This is the operator-edited copy. Preserve their voice and intent; change only what the revision notes call out. Return the full JSON envelope as usual.',
      '',
      priorDraft,
    );
  }
  parts.push('', buildDirectorNotesMessage({ attempt, summary: 'Operator handback.', notes: [prompt] }));
  return { seed_transcript: [{ role: 'user', content: parts.join('\n') }] };
}

/** Render a stored diffWords() result as inline [-removed][+added] markers, capped. */
function renderWordDiff(json: string): string | null {
  try {
    const parts = JSON.parse(json) as Array<{ value: string; added?: boolean; removed?: boolean }>;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const out = parts
      .map((p) => (p.added ? `[+${p.value}]` : p.removed ? `[-${p.value}]` : p.value))
      .join('');
    return out.length > 4000 ? out.slice(0, 4000) + ' …' : out;
  } catch {
    return null;
  }
}

export async function decideCandidate(
  candidate_id: string,
  action: CandidateDecision,
  payload?: { edited_text?: string; retry_feedback?: string; rejection_reason?: string },
): Promise<{ next_action: 'approved' | 'retry-queued' | 'rejected' }> {
  const db = getDb();
  const candidate = requireCandidate(candidate_id, db);
  const card = requireCard(candidate.card_id, db);
  const decidedAt = nowIso();
  const editedText = action === 'edit' ? payload?.edited_text?.trim() : undefined;
  const textDiff = editedText ? makeTextDiff(candidate.text, editedText, decidedAt) : null;
  const beforeAudit = action === 'edit' ? parseJson(candidate.beat_audit_json, []) : [];
  const afterAudit =
    action === 'edit' && editedText
      ? await classifyText(editedText, {
          voice: card.voice,
          beats: parseBeatSequence(candidate.declared_beats_json),
        })
      : [];
  const shifts = action === 'edit' ? makeSemanticShifts(beforeAudit, afterAudit) : [];

  const nextAction = writeTx(db, () => {
    db.prepare(
      `INSERT INTO candidate_decisions
         (id, candidate_id, action, edited_text, retry_feedback, rejection_reason, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      candidate_id,
      action,
      payload?.edited_text ?? null,
      payload?.retry_feedback ?? null,
      payload?.rejection_reason ?? null,
      decidedAt,
    );

    if (action === 'edit') {
      if (!editedText) throw new Error('edited_text is required for candidate edit decisions.');
      if (textDiff) {
        db.prepare(
          `INSERT INTO candidate_text_edits
             (id, candidate_id, before_text, after_text, word_diff_json, edited_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          newId(),
          candidate_id,
          textDiff.before_text,
          textDiff.after_text,
          textDiff.word_diff_json,
          textDiff.edited_at,
        );
      }

      db.prepare(
        `INSERT INTO candidate_semantic_edits
           (id, candidate_id, before_beat_audit_json, after_beat_audit_json, shifted_beats_json, edited_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        candidate_id,
        JSON.stringify(beforeAudit),
        JSON.stringify(afterAudit),
        JSON.stringify(shifts),
        decidedAt,
      );
      return 'approved' as const;
    }

    if (action === 'retry') return 'retry-queued' as const;
    if (action === 'reject') return 'rejected' as const;
    return 'approved' as const;
  });

  revalidatePath(`/cards/${candidate.card_id}`);
  revalidatePath('/');
  return { next_action: nextAction };
}

export async function retryChannel(
  card_id: string,
  channel: Channel,
  feedback?: string,
): Promise<{ candidates: HarnessCandidate[] }> {
  const batch = await generateForChannel(card_id, channel, undefined, feedback);
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { candidates: batch.candidates };
}

/**
 * Manual "regenerate with notes": the operator ticks one or more candidates of a
 * single channel and (optionally) types notes. The Actor regenerates that channel
 * via the actor/director pipeline, seeded with the chosen draft(s) + notes — the
 * operator's if given, otherwise the Director's own stored notes for those
 * candidates. This is the human-in-the-loop completion of the Director->Actor
 * handback. Runs async (returns the run); the other channels stay untouched.
 */
export async function regenerateWithNotes(
  card_id: string,
  channel: Channel,
  selected_candidate_ids: string[],
  operator_notes?: string,
): Promise<{ run: HarnessActorRun; existing: boolean }> {
  const db = getDb();
  const card = requireCard(card_id, db);
  if (!card.card_approved_at) {
    throw new Error('Card stage must be approved before regenerating.');
  }
  if (selected_candidate_ids.length === 0) {
    throw new Error('Select at least one candidate to regenerate.');
  }
  const releaseCardJson = getReleaseCardJson(card_id, db);
  if (!releaseCardJson) throw new Error('No release card exists for this card.');
  const releaseCard = parseReleaseCard(JSON.parse(releaseCardJson));

  const placeholders = selected_candidate_ids.map(() => '?').join(',');
  const selected = db
    .prepare(
      `SELECT id, channel, attempt, text FROM candidates
        WHERE id IN (${placeholders}) AND card_id = ?`,
    )
    .all(...selected_candidate_ids, card_id) as Array<{
    id: string;
    channel: Channel;
    attempt: number;
    text: string;
  }>;
  if (selected.length === 0) throw new Error('No matching candidates found to regenerate.');
  if (selected.some((c) => c.channel !== channel)) {
    throw new Error(`All selected candidates must belong to channel "${channel}".`);
  }

  const auditRows = db
    .prepare(
      `SELECT director_audit_json FROM director_audits
        WHERE candidate_id IN (${placeholders})
        ORDER BY created_at DESC`,
    )
    .all(...selected_candidate_ids) as Array<{ director_audit_json: string | null }>;

  const priorAttempt = Math.max(...selected.map((c) => c.attempt));
  const priorDraftText =
    selected.length === 1
      ? selected[0]!.text
      : selected.map((c, i) => `Prior option ${i + 1}:\n${c.text}`).join('\n\n');

  // Single clean USER turn: the assignment (with the format scaffold) plus the
  // prior draft and notes folded in. Deliberately no fake assistant turn — a
  // plain-text "prior output" makes the Actor mimic prose and drop the JSON
  // envelope (table_work etc.), which fails parsing.
  const notesMessage = buildDirectorNotesMessage(buildRegenSeedNotes(priorAttempt, operator_notes, auditRows));
  const userMessage = [
    buildActorAssignmentMessage(releaseCard, [channel], 5),
    '',
    '## Prior draft to revise',
    'Preserve the voice and intent of this draft; change only what the revision notes call out. Do not start from scratch, and return the full JSON envelope as usual.',
    '',
    priorDraftText,
    '',
    notesMessage,
  ].join('\n');
  const seed_transcript: ActorTranscriptMessage[] = [{ role: 'user', content: userMessage }];

  return runGenerator(card_id, [channel], { seed: { seed_transcript } });
}

/** Operator notes win if present; otherwise forward the Director's own stored
 * notes for the selected candidates. Falls back to a generic "revise to comply"
 * instruction so the Actor always gets a notes turn (a draft with no feedback
 * would just be reproduced). */
function buildRegenSeedNotes(
  attempt: number,
  operatorNotes: string | undefined,
  auditRows: Array<{ director_audit_json: string | null }>,
): DirectorNotes {
  const trimmed = operatorNotes?.trim();
  if (trimmed) {
    return { attempt, summary: trimmed, notes: [trimmed] };
  }
  const notes: string[] = [];
  let change: NonNullable<DirectorNotes['change']> | undefined;
  let preserve: NonNullable<DirectorNotes['preserve']> | undefined;
  for (const row of auditRows) {
    if (!row.director_audit_json) continue;
    let audit: Record<string, unknown>;
    try {
      audit = JSON.parse(row.director_audit_json) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const key of ['notes_for_actor', 'voice_issues', 'factual_issues', 'publication_gate_issues']) {
      const arr = audit[key];
      if (Array.isArray(arr)) notes.push(...arr.filter((x): x is string => typeof x === 'string'));
    }
    if (audit.change && typeof audit.change === 'object') {
      change = { ...(change ?? {}), ...(audit.change as NonNullable<DirectorNotes['change']>) };
    }
    if (audit.preserve && typeof audit.preserve === 'object') {
      preserve = { ...(preserve ?? {}), ...(audit.preserve as NonNullable<DirectorNotes['preserve']>) };
    }
  }
  const deduped = [...new Set(notes)];
  const fallback = 'Revise the prior draft to fully satisfy the format scaffold and voice constraints in the assignment.';
  return {
    attempt,
    summary: deduped.length ? 'Director feedback forwarded by the operator.' : 'Operator requested regeneration.',
    notes: deduped.length ? deduped : [fallback],
    ...(change ? { change } : {}),
    ...(preserve ? { preserve } : {}),
  };
}

/**
 * Wipes the generator phase for a card: candidates and everything downstream
 * (audits, decisions, edits, final picks). Preserves the release card, facts,
 * grounder runs, and historical metrics. Lets the operator re-run the
 * generator from scratch after a retry-cap or after iterating on the pipeline.
 */
export async function resetGenerator(
  card_id: string,
): Promise<{
  deleted: {
    candidates: number;
    candidate_audits: number;
    candidate_decisions: number;
    candidate_text_edits: number;
    candidate_semantic_edits: number;
    final_picks: number;
    generator_attempts: number;
    actor_attempts: number;
    actor_runs: number;
    actor_run_events: number;
    director_audits: number;
  };
}> {
  const db = getDb();
  ensureActorRunsTable(db);
  ensureActorRunEventsTable(db);
  const running = getRunningActorRun(card_id, db);
  if (running) {
    throw new Error(`Generator run ${running.id} is still running; wait for completion or failure before resetting.`);
  }
  const counts = writeTx(db, () => {
    const candidateIdsRow = db
      .prepare('SELECT id FROM candidates WHERE card_id = ?')
      .all(card_id) as Array<{ id: string }>;
    const candidateIds = candidateIdsRow.map((r) => r.id);

    let candidate_audits = 0;
    let candidate_decisions = 0;
    let candidate_text_edits = 0;
    let candidate_semantic_edits = 0;
    let director_audits = 0;
    if (candidateIds.length > 0) {
      const placeholders = candidateIds.map(() => '?').join(',');
      director_audits = db
        .prepare(`DELETE FROM director_audits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_audits = db
        .prepare(`DELETE FROM candidate_audits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_decisions = db
        .prepare(`DELETE FROM candidate_decisions WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_text_edits = db
        .prepare(`DELETE FROM candidate_text_edits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_semantic_edits = db
        .prepare(`DELETE FROM candidate_semantic_edits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
    }

    const final_picks = db
      .prepare('DELETE FROM final_picks WHERE card_id = ?')
      .run(card_id).changes;
    const candidates = db
      .prepare('DELETE FROM candidates WHERE card_id = ?')
      .run(card_id).changes;
    const generator_attempts = db
      .prepare('DELETE FROM generator_attempts WHERE card_id = ?')
      .run(card_id).changes;
    const actor_run_events = db
      .prepare('DELETE FROM actor_run_events WHERE card_id = ?')
      .run(card_id).changes;
    db.prepare('DELETE FROM actor_warmups WHERE card_id = ?')
      .run(card_id);
    const actor_attempts = db
      .prepare('DELETE FROM actor_attempts WHERE card_id = ?')
      .run(card_id).changes;
    const actor_runs = db
      .prepare('DELETE FROM actor_runs WHERE card_id = ?')
      .run(card_id).changes;

    return {
      candidates,
      candidate_audits,
      candidate_decisions,
      candidate_text_edits,
      candidate_semantic_edits,
      final_picks,
      generator_attempts,
      actor_attempts,
      actor_runs,
      actor_run_events,
      director_audits,
    };
  });

  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { deleted: counts };
}

/**
 * Wipes one attempt for one channel of a card: the generator_attempts row plus
 * that attempt's candidates and their downstream rows (audits, decisions,
 * edits, final_picks). Leaves other attempts and other channels untouched.
 * Useful when you want to retry one bad attempt without nuking the history.
 */
export async function resetAttempt(
  card_id: string,
  channel: Channel,
  attempt: number,
): Promise<{
  deleted: {
    candidates: number;
    candidate_audits: number;
    candidate_decisions: number;
    candidate_text_edits: number;
    candidate_semantic_edits: number;
    final_picks: number;
    generator_attempts: number;
    actor_attempts: number;
    director_audits: number;
  };
}> {
  const db = getDb();
  const counts = writeTx(db, () => {
    const candidateIdsRow = db
      .prepare('SELECT id FROM candidates WHERE card_id = ? AND channel = ? AND attempt = ?')
      .all(card_id, channel, attempt) as Array<{ id: string }>;
    const candidateIds = candidateIdsRow.map((r) => r.id);

    let candidate_audits = 0;
    let candidate_decisions = 0;
    let candidate_text_edits = 0;
    let candidate_semantic_edits = 0;
    let final_picks = 0;
    let director_audits = 0;
    if (candidateIds.length > 0) {
      const placeholders = candidateIds.map(() => '?').join(',');
      director_audits = db
        .prepare(`DELETE FROM director_audits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_audits = db
        .prepare(`DELETE FROM candidate_audits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_decisions = db
        .prepare(`DELETE FROM candidate_decisions WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_text_edits = db
        .prepare(`DELETE FROM candidate_text_edits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      candidate_semantic_edits = db
        .prepare(`DELETE FROM candidate_semantic_edits WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
      final_picks = db
        .prepare(`DELETE FROM final_picks WHERE candidate_id IN (${placeholders})`)
        .run(...candidateIds).changes;
    }

    const candidates = db
      .prepare('DELETE FROM candidates WHERE card_id = ? AND channel = ? AND attempt = ?')
      .run(card_id, channel, attempt).changes;
    const generator_attempts = db
      .prepare('DELETE FROM generator_attempts WHERE card_id = ? AND channel = ? AND attempt = ?')
      .run(card_id, channel, attempt).changes;
    const actor_attempts = 0;

    return {
      candidates,
      candidate_audits,
      candidate_decisions,
      candidate_text_edits,
      candidate_semantic_edits,
      final_picks,
      generator_attempts,
      actor_attempts,
      director_audits,
    };
  });

  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { deleted: counts };
}

async function generateForChannel(
  cardId: string,
  channel: Channel,
  n?: number,
  operatorFeedback?: string,
): Promise<{ channel: Channel; candidates: HarnessCandidate[] }> {
  if (channel !== 'image-brief' && !process.env.ANTHROPIC_API_KEY && process.env.HARNESS_ALLOW_STUB_GENERATOR !== '1') {
    throw new Error(
      'ANTHROPIC_API_KEY is required to run the generator in the harness. Set HARNESS_ALLOW_STUB_GENERATOR=1 to explicitly allow stub generation.',
    );
  }

  const db = getDb();
  process.env.HARNESS_GENERATOR_ARCH = 'actor';
  const card = requireCard(cardId, db);
  const releaseCardJson = getReleaseCardJson(cardId, db);
  if (!releaseCardJson) throw new Error('No release card exists for this card.');
  const releaseCard = parseReleaseCard(JSON.parse(releaseCardJson));
  if (channel === 'image-brief') {
    const inserted = await generateAndPersistImageBriefCandidate(cardId, releaseCard);
    return { channel, candidates: [inserted] };
  }
  const attemptBase = nextAttempt(db, cardId, channel);
  if (attemptBase > 3) throw new Error(`Retry cap reached for ${channel}; manual intervention required.`);

  const voice = voiceSpecFor(card.voice);
  const defaultBeats = defaultBeatsForVoice(card.voice);
  const mode = process.env.HARNESS_ALLOW_STUB_GENERATOR === '1' ? 'stub' : 'live';
  // The LLM validator (active validator) is the gating voice; regex is the
  // pre-filter only. Default ON unless explicitly disabled. If disabled while
  // there's no API key, fail loudly — silent fallback to regex-only would
  // mean validation is just pattern matching, which catches AI-slop but
  // cannot reason about claim validity or paraphrased facts.
  const activeDisabled = process.env.HARNESS_ACTIVE_VALIDATOR === '0';
  const useActiveValidator = !activeDisabled;
  if (useActiveValidator && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'The LLM validator (active validator) is the gating voice and requires ANTHROPIC_API_KEY. ' +
        'Either set the key or explicitly disable the active validator with HARNESS_ACTIVE_VALIDATOR=0 ' +
        '(NOT recommended — regex-only mode catches AI-slop but cannot reason about claim validity).',
    );
  }
  const auditByGeneratedCandidateId = new Map<string, CandidateAuditPersistence>();
  const attemptCaptures = new Map<number, AttemptPersistence>();

  // The orchestrator drives generateAttempt with a fresh {attempt, feedback}
  // per retry. We capture both inputs (feedback IN) and the prompt object the
  // generator wrote into (capture OUT). Persistence happens after the loop.
  const generateAttempt = ({
    attempt,
    feedback,
  }: {
    attempt: number;
    feedback?: string;
  }) => {
    const capture: GenerationPromptCapture = {};
    attemptCaptures.set(attempt, {
      orchestratorAttempt: attempt,
      feedbackIn: operatorFeedback ?? feedback,
      capture,
    });
    return generate(releaseCard, {
      channel,
      n,
      voice,
      defaultBeats,
      feedback: operatorFeedback ?? feedback,
      mode,
      capturePrompts: capture,
    });
  };

  const attempts = useActiveValidator
    ? await runActiveOrchestrationForHarness(
        releaseCard,
        channel,
        cardId,
        db,
        generateAttempt,
        voice,
        auditByGeneratedCandidateId,
      )
    : (await orchestrateWithRetries(
        releaseCard,
        [channel],
        generateAttempt,
        { maxAttempts: 3 },
      )).attempts;

  const inserted = writeTx(db, () => {
    const insertedCandidates: HarnessCandidate[] = [];
    for (const attempt of attempts) {
      const dbAttemptNum = attemptBase + (attempt.attempt - 1);
      const channelCandidates = attempt.candidates.filter((c) => c.channel === channel);
      const persistence = attemptCaptures.get(attempt.attempt);
      const generatorSource: 'anthropic' | 'stub' =
        channelCandidates[0]?.source ?? (mode === 'stub' ? 'stub' : 'anthropic');
      const createdAtForAttempt = nowIso();

      db.prepare(
        `INSERT INTO generator_attempts
           (id, card_id, channel, attempt, auto_feedback_in,
            inner_work_prompt_json, drafting_prompt_json, legacy_prompt_json,
            generator_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        cardId,
        channel,
        dbAttemptNum,
        persistence?.feedbackIn ?? null,
        persistence?.capture.inner_work ? JSON.stringify(persistence.capture.inner_work) : null,
        persistence?.capture.drafting ? JSON.stringify(persistence.capture.drafting) : null,
        persistence?.capture.legacy ? JSON.stringify(persistence.capture.legacy) : null,
        generatorSource,
        createdAtForAttempt,
      );

      for (const candidate of channelCandidates) {
        const beats: BeatSequence = { beats: candidate.declared_beats };
        const validation = validate(candidate.text, {
          beats,
          voice,
          card: releaseCard,
          channel,
          deployed_facts_used: candidate.deployed_facts_used,
          not_said: candidate.not_said,
        });
        const id = newId();
        const createdAt = nowIso();
        db.prepare(
          `INSERT INTO candidates
             (id, card_id, channel, attempt, text, structured_json, declared_beats_json, beat_audit_json,
              validation_passed, validation_failures_json, rationale, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          cardId,
          channel,
          dbAttemptNum,
          candidate.text,
          candidate.structured ? JSON.stringify(candidate.structured) : null,
          JSON.stringify(candidate.declared_beats),
          JSON.stringify(validation.beat_audit ?? []),
          validation.passed ? 1 : 0,
          JSON.stringify(validation.failures),
          candidate.rationale ?? null,
          candidate.source,
          createdAt,
        );
        const activeAudit = auditByGeneratedCandidateId.get(candidate.id);
        if (activeAudit) {
          db.prepare(
            `INSERT INTO candidate_audits
               (id, candidate_id, active_validation_passed, active_audit_json,
                history_guard_passed, history_guard_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            newId(),
            id,
            activeAudit.active_validation_passed ? 1 : 0,
            activeAudit.active_audit_json,
            activeAudit.history_guard_passed === null ? null : activeAudit.history_guard_passed ? 1 : 0,
            activeAudit.history_guard_json,
            createdAt,
          );
        }
        insertedCandidates.push({
          id,
          card_id: cardId,
          channel,
          attempt: dbAttemptNum,
          text: candidate.text,
          structured_json: candidate.structured ? JSON.stringify(candidate.structured) : null,
          declared_beats_json: JSON.stringify(candidate.declared_beats),
          beat_audit_json: JSON.stringify(validation.beat_audit ?? []),
          validation_passed: validation.passed,
          validation_failures_json: JSON.stringify(validation.failures),
          active_validation_passed: activeAudit?.active_validation_passed ?? null,
          active_audit_json: activeAudit?.active_audit_json ?? null,
          history_guard_passed: activeAudit?.history_guard_passed ?? null,
          history_guard_json: activeAudit?.history_guard_json ?? null,
          director_audit_id: null,
          director_passed: null,
          director_audit_json: null,
          rationale: candidate.rationale ?? null,
          source: candidate.source,
          prompt_variant: null,
          created_at: createdAt,
        });
      }
    }
    return insertedCandidates;
  });

  return { channel, candidates: inserted };
}

async function runActorGenerator(
  cardId: string,
  channels: Channel[],
  n?: number,
  runId?: string,
  seed?: ActorRegenSeed,
): Promise<{ candidates_by_channel: Record<Channel, HarnessCandidate[]> }> {
  const actorChannels = copyChannels(channels);
  if (actorChannels.length > 0 && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is required to run the actor/director generator in the harness. Actor/director stub generation has been removed; use the legacy generator if you need explicit stub output.',
    );
  }

  const db = getDb();
  const card = requireCard(cardId, db);
  const releaseCardJson = getReleaseCardJson(cardId, db);
  if (!releaseCardJson) throw new Error('No release card exists for this card.');
  const releaseCard = parseReleaseCard(JSON.parse(releaseCardJson));
  const voice = voiceSpecFor(card.voice);
  const mode = 'live';
  const warmupMode = parseActorWarmupMode(process.env.HARNESS_ACTOR_WARMUP);
  const optionCount = n ?? 5;
  const flowDirections = parseHarnessFlowDirections(process.env.HARNESS_FLOW_DIRECTION ?? process.env.COMMS_FLOW_DIRECTION);
  const feedbackWaveRegime = parseHarnessFeedbackWaveRegime(process.env.HARNESS_FEEDBACK_WAVE_REGIME ?? process.env.COMMS_FEEDBACK_WAVE_REGIME);
  ensureActorRunEventsTable(db);

  const grouped = emptyCandidateGroups();

  const approvedHosts = listApprovedApiHosts(db).map((h) => h.host);
  const factRequestGrounder: FactRequestGrounderFn = async (requests) => {
    const sourceCopy = requests
      .map((r) => `- ${r.question}${r.reason ? ` (needed for: ${r.reason})` : ''}`)
      .join('\n');
    // The grounder's fetchRef step can fail when a shipped branch was deleted
    // after merge. Keep the harness run alive and record the root cause here.
    let grounded: Awaited<ReturnType<typeof groundFacts>>;
    try {
      grounded = await groundFacts(sourceCopy, {
        surface: 'actor-director-back-edge',
        job: 'answer-fact-requests',
        approvedHosts,
      });
    } catch (err) {
      persistActorRunEvent(db, cardId, runId ?? cardId, {
        event_type: 'fact_request_grounding_error',
        message: errorMessage(err),
        payload: { surface: 'actor-director-back-edge', trigger: 'harness-grounder', error: errorMessage(err) },
      });
      return [];
    }
    // Respect the harness API approval gate: any host the grounder couldn't call
    // is queued for the operator, exactly like the research stage. Keep DB write
    // failures from masquerading as grounding failures.
    try {
      persistApprovalRequests(db, cardId, grounded.approval_requests ?? []);
    } catch (persistErr) {
      console.error('Failed to persist grounder approval requests', persistErr);
    }
    return grounded.facts.map((fact): GroundedFactAnswer => ({
      question: fact.claim,
      fact: {
        claim: `${fact.claim}: ${fact.value}`,
        ...(fact.category === 'number'
          ? { basis: `grounded value; verify before ship (confidence ${fact.confidence.toFixed(2)})` }
          : {}),
      },
      provenance: `${fact.source_ref} (confidence ${fact.confidence.toFixed(2)})`,
    }));
  };

  // The image brief is independent of the copy actor. Kick it off concurrently
  // so a slow or hung actor run never blocks it from appearing, and so a brief
  // failure never kills copy generation (briefs are additive).
  const imageBriefTask = channels.includes('image-brief')
    ? generateAndPersistImageBriefCandidate(cardId, releaseCard, runId).catch(() => null)
    : null;

  for (const flowDirection of flowDirections) {
    const attemptBase = nextActorAttempt(db, cardId);
    const eventRunId = runId ?? newId();
    if (actorChannels.length === 0) {
      continue;
    }
    const result = await orchestrateActorDirectorWithRetries(releaseCard, actorChannels, {
      n: optionCount,
      warmup_mode: warmupMode,
      flow_direction: flowDirection,
      feedback_wave_regime: feedbackWaveRegime,
      voice,
      mode,
      maxAttempts: 3,
      // Manual regenerate-with-notes (seeded) skips the auto grounder back-edge:
      // the operator is steering, the card already carries deployed_facts, and the
      // back-edge re-run is an extra failure surface (plus the bridge-branch blind
      // spot). Normal runs keep the grounder.
      ...(seed ? {} : { grounder: factRequestGrounder }),
      ...(seed
        ? {
            seed_transcript: seed.seed_transcript,
            ...(seed.seed_notes ? { seed_notes: seed.seed_notes } : {}),
          }
        : {}),
      onEvent: (event) => persistActorRunEvent(db, cardId, eventRunId, event),
      onAttemptCompleted: (attempt) => {
        const inserted = persistActorDirectorAttempt(db, {
          cardId,
          releaseCard,
          attempt,
          attemptBase,
        });
        for (const candidate of inserted) grouped[candidate.channel].push(candidate);
        // Detached background task — no revalidatePath (the client polls + refreshes).
      },
    });
    const proof = buildPipeline3Proof({
      env_arch: process.env.HARNESS_GENERATOR_ARCH,
      entrypoint: PIPELINE_3_ENTRYPOINT,
      actor_attempt_rows: countRows(db, 'actor_attempts', cardId),
      actor_run_event_rows: countRows(db, 'actor_run_events', cardId),
      candidate_rationale_has_actor_option: hasActorOptionRationale(result),
      director_audit_has_split_gates: hasDirectorSplitGates(result),
    });
    persistPipelineRun(db, cardId, flowDirections.length === 1 ? eventRunId : newId(), proof);
  }

  if (imageBriefTask) {
    const inserted = await imageBriefTask;
    if (inserted) grouped['image-brief'].push(inserted);
  }

  // Detached background task — no revalidatePath (the client polls + refreshes).
  return { candidates_by_channel: grouped };
}

async function generateAndPersistImageBriefCandidate(
  cardId: string,
  releaseCard: ReturnType<typeof parseReleaseCard>,
  runId?: string,
): Promise<HarnessCandidate> {
  const db = getDb();
  if (runId) {
    persistActorRunEvent(db, cardId, runId, {
      event_type: 'image_brief_started',
      channel: 'image-brief',
      message: 'Image brief generation started',
    });
  }
  const mode = process.env.HARNESS_ALLOW_STUB_GENERATOR === '1' && !process.env.ANTHROPIC_API_KEY ? 'stub' : 'live';
  const [candidate] = await generate(releaseCard, { channel: 'image-brief', mode });
  if (!candidate) throw new Error('Image brief generator returned no candidate.');
  const attempt = nextAttempt(db, cardId, 'image-brief');
  const createdAt = nowIso();
  const id = newId();
  const inserted = writeTx(db, () => {
    db.prepare(
      `INSERT INTO generator_attempts
         (id, card_id, channel, attempt, auto_feedback_in,
          inner_work_prompt_json, drafting_prompt_json, legacy_prompt_json,
          generator_source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      cardId,
      'image-brief',
      attempt,
      null,
      null,
      null,
      null,
      candidate.source,
      createdAt,
    );

    db.prepare(
      `INSERT INTO candidates
         (id, card_id, channel, attempt, text, structured_json, declared_beats_json, beat_audit_json,
          validation_passed, validation_failures_json, rationale, source, prompt_variant, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      cardId,
      'image-brief',
      attempt,
      candidate.text,
      null,
      JSON.stringify([]),
      JSON.stringify([]),
      1,
      JSON.stringify([]),
      candidate.rationale ?? null,
      candidate.source,
      null,
      createdAt,
    );

    return {
      id,
      card_id: cardId,
      channel: 'image-brief' as const,
      attempt,
      text: candidate.text,
      structured_json: null,
      declared_beats_json: JSON.stringify([]),
      beat_audit_json: JSON.stringify([]),
      validation_passed: true,
      validation_failures_json: JSON.stringify([]),
      active_validation_passed: null,
      active_audit_json: null,
      history_guard_passed: null,
      history_guard_json: null,
      director_audit_id: null,
      director_passed: null,
      director_audit_json: null,
      rationale: candidate.rationale ?? null,
      source: candidate.source,
      prompt_variant: null,
      created_at: createdAt,
    } satisfies HarnessCandidate;
  });
  if (runId) {
    persistActorRunEvent(db, cardId, runId, {
      event_type: 'image_brief_completed',
      channel: 'image-brief',
      message: 'Image brief candidate persisted',
      payload: { candidate_id: id, source: candidate.source },
    });
  }
  return inserted;
}

function hasActorOptionRationale(result: ActorDirectorResult): boolean {
  return result.attempts.some((attempt) =>
    attempt.records.some((record) => record.candidate.rationale?.includes('Actor option ')),
  );
}

function hasDirectorSplitGates(result: ActorDirectorResult): boolean {
  return result.attempts.some((attempt) =>
    attempt.records.some((record) =>
      record.director_audit !== undefined &&
      typeof record.director_audit.copy_voice_passed === 'boolean' &&
      typeof record.director_audit.factual_passed === 'boolean' &&
      typeof record.director_audit.publication_gate_passed === 'boolean'),
  );
}

function parseHarnessFlowDirections(value: string | undefined): VerticalFlowDirection[] {
  if (value === 'outwards-in') return ['outwards-in'];
  if (value === 'both' || value === 'ab' || value === 'a/b') return ['inwards-out', 'outwards-in'];
  return ['inwards-out'];
}

function parseHarnessFeedbackWaveRegime(value: string | undefined): FeedbackWaveRegime {
  return value === 'section-autonomous' ? 'section-autonomous' : 'two-tier';
}

function countRows(db: ReturnType<typeof getDb>, table: string, cardId: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE card_id = ?`).get(cardId) as { count: number };
  return row.count;
}

function persistPipelineRun(
  db: ReturnType<typeof getDb>,
  cardId: string,
  runId: string,
  proof: PipelineIdentityReport,
): void {
  ensurePipelineRunsTable(db);
  db.prepare(
    `INSERT INTO pipeline_runs
       (id, card_id, pipeline_id, pipeline_label, entrypoint, proof_json, proof_passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    cardId,
    proof.pipeline_id,
    proof.pipeline_label,
    proof.entrypoint,
    JSON.stringify(proof),
    proof.proof_passed ? 1 : 0,
    proof.generated_at,
  );
}

function persistActorDirectorAttempt(
  db: ReturnType<typeof getDb>,
  opts: {
    cardId: string;
    releaseCard: ReturnType<typeof parseReleaseCard>;
    attempt: ActorDirectorAttempt;
    attemptBase: number;
  },
): HarnessCandidate[] {
  return persistActorDirectorResult(db, {
    cardId: opts.cardId,
    releaseCard: opts.releaseCard,
    result: {
      attempts: [opts.attempt],
      picks: opts.attempt.picks,
      selection_rationales: opts.attempt.selection_rationales,
      exhausted: false,
    },
    attemptBase: opts.attemptBase,
  });
}

function persistActorDirectorResult(
  db: ReturnType<typeof getDb>,
  opts: {
    cardId: string;
    releaseCard: ReturnType<typeof parseReleaseCard>;
    result: ActorDirectorResult;
    attemptBase: number;
  },
): HarnessCandidate[] {
  return writeTx(db, () => {
    const insertedCandidates: HarnessCandidate[] = [];
    for (const attempt of opts.result.attempts) {
      const dbAttemptNum = opts.attemptBase + (attempt.attempt - 1);
      const actorAttemptId = newId();
      const createdAtForAttempt = nowIso();
      db.prepare(
        `INSERT INTO actor_attempts
           (id, card_id, attempt, channels_json, source_index_json, prompt_version,
            prompt_hash, model, director_notes_in_json, actor_prompt_json,
            actor_transcript_json, actor_response_json, table_work_json,
            generator_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        actorAttemptId,
        opts.cardId,
        dbAttemptNum,
        JSON.stringify([...new Set(attempt.records.map((r) => r.candidate.channel))]),
        JSON.stringify(attempt.actor.memory.source_index),
        attempt.actor.memory.version,
        attempt.actor.memory.prompt_hash,
        EFFECTIVE_ACTOR_MODEL,
        attempt.director_notes_in ? JSON.stringify(attempt.director_notes_in) : null,
        JSON.stringify(attempt.actor.prompt),
        JSON.stringify(attempt.actor.transcript_messages),
        attempt.actor.raw_response,
        JSON.stringify(attempt.actor.output.table_work),
        attempt.actor.source,
        createdAtForAttempt,
      );
      db.prepare(
        `INSERT INTO actor_warmups
           (id, actor_attempt_id, card_id, attempt, daily_pages_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        actorAttemptId,
        opts.cardId,
        dbAttemptNum,
        JSON.stringify(attempt.actor.output.warmup),
        createdAtForAttempt,
      );

      for (const record of attempt.records) {
        const candidate = record.candidate;
        const id = newId();
        const createdAt = nowIso();
        let directorAuditId: string | null = null;
        const directorPassed = record.director_audit
          ? record.director_audit.copy_voice_passed &&
            record.director_audit.factual_passed &&
            record.director_audit.infinex_fit.legal
          : null;
        db.prepare(
          `INSERT INTO candidates
             (id, card_id, channel, attempt, text, structured_json, declared_beats_json, beat_audit_json,
              validation_passed, validation_failures_json, rationale, source, prompt_variant, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          opts.cardId,
          candidate.channel,
          dbAttemptNum,
          candidate.text,
          candidate.structured ? JSON.stringify(candidate.structured) : null,
          JSON.stringify(candidate.declared_beats),
          JSON.stringify(record.script_validation.beat_audit ?? []),
          record.script_validation.passed ? 1 : 0,
          JSON.stringify(record.script_validation.failures),
          candidate.rationale ?? null,
          candidate.source,
          candidate.prompt_variant ?? null,
          createdAt,
        );

        if (record.director_audit) {
          directorAuditId = newId();
          db.prepare(
            `INSERT INTO director_audits
               (id, actor_attempt_id, candidate_id, card_id, channel, attempt,
                director_model, director_prompt_json, director_audit_json, passed, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            directorAuditId,
            actorAttemptId,
            id,
            opts.cardId,
            candidate.channel,
            dbAttemptNum,
            EFFECTIVE_DIRECTOR_MODEL,
            JSON.stringify(record.director_audit.prompt),
            JSON.stringify(record.director_audit),
            directorPassed ? 1 : 0,
            createdAt,
          );
        }

        insertedCandidates.push({
          id,
          card_id: opts.cardId,
          channel: candidate.channel,
          attempt: dbAttemptNum,
          text: candidate.text,
          structured_json: candidate.structured ? JSON.stringify(candidate.structured) : null,
          declared_beats_json: JSON.stringify(candidate.declared_beats),
          beat_audit_json: JSON.stringify(record.script_validation.beat_audit ?? []),
          validation_passed: record.script_validation.passed,
          validation_failures_json: JSON.stringify(record.script_validation.failures),
          active_validation_passed: null,
          active_audit_json: null,
          history_guard_passed: null,
          history_guard_json: null,
          director_audit_id: directorAuditId,
          director_passed: directorPassed,
          director_audit_json: record.director_audit ? JSON.stringify(record.director_audit) : null,
          rationale: candidate.rationale ?? null,
          source: candidate.source,
          prompt_variant: candidate.prompt_variant ?? null,
          created_at: createdAt,
        });
      }
    }
    return insertedCandidates;
  });
}

// Mirror of research.ts: queue grounder-blocked API hosts for operator approval.
function persistApprovalRequests(
  db: ReturnType<typeof getDb>,
  cardId: string,
  requests: { host: string; url: string; reason: string }[],
): void {
  for (const req of requests) {
    const approved = db.prepare('SELECT 1 FROM approved_api_hosts WHERE host = ?').get(req.host);
    if (approved) continue;
    const open = db
      .prepare("SELECT 1 FROM pending_api_requests WHERE card_id = ? AND host = ? AND status = 'pending'")
      .get(cardId, req.host);
    if (open) continue;
    db.prepare(
      `INSERT INTO pending_api_requests (id, card_id, host, url, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(newId(), cardId, req.host, req.url, req.reason, nowIso());
  }
}

function persistActorRunEvent(
  db: ReturnType<typeof getDb>,
  cardId: string,
  runId: string,
  event: ActorDirectorRunEvent,
): void {
  ensureActorRunEventsTable(db);
  db.prepare(
    `INSERT INTO actor_run_events
       (id, card_id, run_id, attempt, channel, event_type, message, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    cardId,
    runId,
    event.attempt ?? null,
    event.channel ?? null,
    event.event_type,
    event.message,
    JSON.stringify(event.payload ?? {}),
    nowIso(),
  );
}

function markActorRunCompleted(db: ReturnType<typeof getDb>, runId: string): void {
  ensureActorRunsTable(db);
  db.prepare(
    `UPDATE actor_runs
        SET status = 'completed', completed_at = ?, error = NULL
      WHERE id = ?`,
  ).run(nowIso(), runId);
}

function markActorRunFailed(db: ReturnType<typeof getDb>, runId: string, message: string): void {
  ensureActorRunsTable(db);
  db.prepare(
    `UPDATE actor_runs
        SET status = 'failed', completed_at = ?, error = ?
      WHERE id = ?`,
  ).run(nowIso(), message, runId);
}

/**
 * After an operator handback run, auto-pick the best regenerated candidate for the
 * channel so the result shows on the surface card. When `baseText` is present
 * (block scope), splice the actor's filled toggle into the operator's edited copy
 * so their surrounding text stays byte-for-byte. The operator reviews/re-picks;
 * their prior edit survives as the captured diff + the seeding candidate.
 */
function finalizeHandback(db: ReturnType<typeof getDb>, cardId: string, handback: HandbackContext): void {
  const { channel, baseText } = handback;
  const maxRow = db
    .prepare('SELECT MAX(attempt) AS a FROM candidates WHERE card_id = ? AND channel = ?')
    .get(cardId, channel) as { a: number | null };
  if (maxRow.a == null) return;

  const cands = db
    .prepare(
      `SELECT c.id, c.text, c.structured_json, c.validation_passed,
              (SELECT passed FROM director_audits WHERE candidate_id = c.id ORDER BY created_at DESC LIMIT 1) AS director_passed
         FROM candidates c
        WHERE c.card_id = ? AND c.channel = ? AND c.attempt = ?
        ORDER BY c.created_at ASC`,
    )
    .all(cardId, channel, maxRow.a) as Array<{
    id: string;
    text: string;
    structured_json: string | null;
    validation_passed: number;
    director_passed: number | null;
  }>;
  if (cands.length === 0) return;

  const best = cands.find((c) => c.validation_passed === 1 && c.director_passed !== 0) ?? cands[0]!;
  const finalText = baseText ? spliceToggles(baseText, best.text) : best.text;
  if (finalText !== best.text) {
    db.prepare('UPDATE candidates SET text = ? WHERE id = ?').run(finalText, best.id);
  }

  const existing = db
    .prepare('SELECT id FROM final_picks WHERE card_id = ? AND channel = ?')
    .get(cardId, channel) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE final_picks
          SET candidate_id = ?, final_text = ?, final_structured_json = ?, shipped_at = NULL, shipped_to = NULL
        WHERE id = ?`,
    ).run(best.id, finalText, best.structured_json, existing.id);
  } else {
    db.prepare(
      `INSERT INTO final_picks (id, card_id, channel, candidate_id, final_text, final_structured_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId(), cardId, channel, best.id, finalText, best.structured_json);
  }
}

function ensureActorRunsTable(db: ReturnType<typeof getDb>): void {
  db.exec(`
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
  `);
}

function ensureActorRunEventsTable(db: ReturnType<typeof getDb>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS actor_run_events (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id),
      run_id TEXT NOT NULL,
      attempt INTEGER,
      channel TEXT,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_actor_run_events_card_created ON actor_run_events(card_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_actor_run_events_run ON actor_run_events(run_id, created_at ASC);
  `);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function ensurePipelineRunsTable(db: ReturnType<typeof getDb>): void {
  db.exec(`
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
  `);
}

async function runActiveOrchestrationForHarness(
  releaseCard: ReturnType<typeof parseReleaseCard>,
  channel: Channel,
  cardId: string,
  db: ReturnType<typeof getDb>,
  generateAttempt: (ctx: { attempt: number; feedback?: string }) => Promise<Candidate[]>,
  voice: ReturnType<typeof voiceSpecFor>,
  auditByGeneratedCandidateId: Map<string, CandidateAuditPersistence>,
) {
  const result = await orchestrateActiveWithRetries(
    releaseCard,
    [channel],
    generateAttempt,
    {
      voice,
      recentCopyByChannel: {
        [channel]: recentCopyForChannel(db, channel, cardId),
      },
      maxAttempts: 3,
    },
  );
  captureActiveAudits(result, auditByGeneratedCandidateId);
  return result.attempts;
}

function captureActiveAudits(
  result: ActiveRetryOrchestrationResult,
  auditByGeneratedCandidateId: Map<string, CandidateAuditPersistence>,
): void {
  for (const attempt of result.attempts) {
    for (const pick of attempt.result.picks) {
      auditByGeneratedCandidateId.set(
        pick.candidate.id,
        serializeCandidateAudit(pick.verdict, pick.history),
      );
    }
    for (const rejected of attempt.result.rejected) {
      auditByGeneratedCandidateId.set(
        rejected.candidate.id,
        serializeCandidateAudit(rejected.verdict, rejected.history ?? null),
      );
    }
  }
}

function serializeCandidateAudit(
  verdict: ActiveValidationVerdict,
  history: HistoryGuardResult | null,
): CandidateAuditPersistence {
  return {
    active_validation_passed: verdict.passed,
    active_audit_json: JSON.stringify(verdict),
    history_guard_passed: history ? history.passed : null,
    history_guard_json: history ? JSON.stringify(history) : null,
  };
}

function recentCopyForChannel(
  db: ReturnType<typeof getDb>,
  channel: Channel,
  excludeCardId: string,
): ShippedCopyRecord[] {
  const rows = db.prepare(
    `SELECT fp.id, fp.channel, fp.final_text AS text, fp.shipped_at,
            c.declared_beats_json
       FROM final_picks fp
       JOIN candidates c ON c.id = fp.candidate_id
      WHERE fp.channel = ?
        AND fp.card_id != ?
      ORDER BY COALESCE(fp.shipped_at, '') DESC, fp.id DESC
      LIMIT 24`,
  ).all(channel, excludeCardId) as Array<{
    id: string;
    channel: Channel;
    text: string;
    shipped_at: string | null;
    declared_beats_json: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    channel: row.channel,
    text: row.text,
    shipped_at: row.shipped_at,
    primary_tempo: parseJson<Array<{ tempo?: string }>>(row.declared_beats_json, [])[0]?.tempo ?? null,
  }));
}

function nextAttempt(db: ReturnType<typeof getDb>, cardId: string, channel: Channel): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt FROM candidates WHERE card_id = ? AND channel = ?')
    .get(cardId, channel) as { attempt: number };
  return row.attempt;
}

function nextActorAttempt(db: ReturnType<typeof getDb>, cardId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt
       FROM (
         SELECT attempt FROM candidates WHERE card_id = ?
         UNION ALL
         SELECT attempt FROM actor_attempts WHERE card_id = ?
       )`,
    )
    .get(cardId, cardId) as { attempt: number };
  return row.attempt;
}

function parseBeatSequence(json: string): BeatSequence {
  return { beats: parseJson(json, []) };
}

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
