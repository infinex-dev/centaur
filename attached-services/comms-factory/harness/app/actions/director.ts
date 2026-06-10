'use server';

/**
 * Director-as-service — standalone brand-fit check.
 *
 * Strips the Director out of the generate pipeline and runs it on ANY copy
 * (human- or machine-written). Two axes — voice (blind, needs nothing) and
 * fact (needs a fact source) — rolled up into one green/amber/red light.
 * The Director never grounds and never generates here; it only judges.
 *
 * Spec: docs/SPEC-director-as-service.md
 */

import { auditCandidateWithDirector, parseActorWarmupMode } from '@pipeline/actor-director';
import { orchestrateActorDirectorWithRetries } from '@pipeline/actor-orchestrator';
import { validate } from '@pipeline/validator';
import type { Candidate, Channel } from '@pipeline/generator';
import type { ReleaseCard } from '@pipeline/card';
import { revalidatePath } from 'next/cache';
import { voiceSpecFor } from '@/lib/voice';
import type { VoiceName } from '@/lib/types';
import { getDb, newId, nowIso } from '@/lib/db';
import { createCard, runGrounder } from './research';

export type Surface = 'tweet' | 'web' | 'in-product' | 'modal' | 'email';

/**
 * Surface → Channel. The Director reads channel as grammar context only
 * (it does not enforce length — that's the orchestrator's job, which we
 * don't run here). modal/email are new surfaces; until they get their own
 * channel grammar they borrow the closest existing one.
 */
const SURFACE_TO_CHANNEL: Record<Surface, Channel> = {
  tweet: 'x',
  web: 'web',
  'in-product': 'in-product',
  modal: 'in-product',
  email: 'web',
};

export type DirectorLight = 'green' | 'amber' | 'red';

export interface VoiceAxis {
  light: DirectorLight;
  primary_tempo: string;
  confidence: number;
  drive_read: string;
  placement_read: string;
  legal: boolean;
  nearest_allowed_read?: string;
  issues: string[];
}

export interface FactAxis {
  light: DirectorLight;
  status: 'grounded' | 'needs_confirmation' | 'violated';
  issues: string[];
}

export interface DirectorCheckResult {
  id: string;
  created_at: string;
  light: DirectorLight;
  voice: VoiceAxis;
  fact: FactAxis;
  regex: { passed: boolean; failures: { rule: string; reason: string }[] };
  publication: { passed: boolean; issues: string[] };
  notes: string[];
  surface: Surface;
  title: string | null;
  text: string;
  model: string;
}

export interface CheckCopyInput {
  text: string;
  surface: Surface;
  facts?: string; // newline-separated fact source (optional)
  title?: string;
  voiceId?: VoiceName;
}

const RANK: Record<DirectorLight, number> = { green: 0, amber: 1, red: 2 };
function worst(a: DirectorLight, b: DirectorLight): DirectorLight {
  return RANK[a] >= RANK[b] ? a : b;
}

export async function checkCopy(input: CheckCopyInput): Promise<DirectorCheckResult> {
  const text = input.text.trim();
  if (!text) throw new Error('Nothing to check — paste some copy first.');
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is required — the Director is a live LLM judge with no stub fallback.',
    );
  }

  const surface = input.surface;
  const channel = SURFACE_TO_CHANNEL[surface];
  const voice = voiceSpecFor(input.voiceId ?? 'infinex');

  const facts = (input.facts ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const hasFactSource = facts.length > 0;

  // Ad-hoc card. The Director only serializes the card as its fact contract;
  // it is NOT Zod-validated inside the audit. deployed_facts is the only
  // load-bearing field for the fact axis.
  const card = {
    kind: 'launch-tier',
    id: 'adhoc-director-check',
    title: input.title?.trim() || 'ad-hoc copy check',
    headline: input.title?.trim() || text.slice(0, 80),
    tier_reason: 'standalone Director check (not a release)',
    deployed_facts: facts,
  } as unknown as ReleaseCard;

  const candidate: Candidate = {
    id: 'adhoc-candidate',
    text,
    channel,
    declared_beats: [],
    source: 'anthropic',
  };

  // Layer 1 — regex front door (instant, deterministic). fact_contract off:
  // we never enforce the actor receipt contract on hand-written copy.
  const regex = validate(text, { voice, fact_contract: 'off' });

  // Layer 2 — the Director (blind LLM judge).
  const audit = await auditCandidateWithDirector({ card, candidate, channel, voice, mode: 'live' });

  // --- roll up the two axes into one light -----------------------------------
  let voiceLight: DirectorLight;
  if (!regex.passed || !audit.copy_voice_passed || !audit.infinex_fit.legal) {
    voiceLight = 'red';
  } else if (audit.voice_issues.length > 0) {
    voiceLight = 'amber';
  } else {
    voiceLight = 'green';
  }

  let factLight: DirectorLight;
  let factStatus: FactAxis['status'];
  let factIssues: string[];
  if (!hasFactSource) {
    factLight = 'amber';
    factStatus = 'needs_confirmation';
    factIssues = [
      'No fact source attached — factual claims are unverified. Ground first (next build) or paste known facts to anchor the fact axis.',
    ];
  } else if (!audit.factual_passed || audit.factual_issues.length > 0) {
    factLight = 'red';
    factStatus = 'violated';
    factIssues = audit.factual_issues.length > 0 ? audit.factual_issues : ['Claims not supported by the attached facts.'];
  } else {
    factLight = 'green';
    factStatus = 'grounded';
    factIssues = [];
  }

  const voiceIssues = [...audit.voice_issues];
  if (!audit.infinex_fit.legal && audit.infinex_fit.reason) {
    voiceIssues.unshift(`placement: ${audit.infinex_fit.reason}`);
  }

  const id = newId();
  const created_at = nowIso();
  const title = input.title?.trim() || null;

  const result: DirectorCheckResult = {
    id,
    created_at,
    light: worst(voiceLight, factLight),
    voice: {
      light: voiceLight,
      primary_tempo: audit.primary_tempo,
      confidence: audit.primary_confidence,
      drive_read: audit.drive_read,
      placement_read: audit.placement_read,
      legal: audit.infinex_fit.legal,
      ...(audit.infinex_fit.nearest_allowed_read
        ? { nearest_allowed_read: audit.infinex_fit.nearest_allowed_read }
        : {}),
      issues: voiceIssues,
    },
    fact: { light: factLight, status: factStatus, issues: factIssues },
    regex: { passed: regex.passed, failures: regex.failures },
    publication: { passed: audit.publication_gate_passed, issues: audit.publication_gate_issues },
    notes: audit.notes_for_actor ?? [],
    surface,
    title,
    text,
    model: process.env.COMMS_DIRECTOR_MODEL ?? 'claude-sonnet-4-6',
  };

  // Persist so the check survives navigation and builds a reviewable history.
  getDb()
    .prepare(
      `INSERT INTO director_checks
         (id, card_id, voice, surface, title, text, light, verdict_json, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, null, input.voiceId ?? 'infinex', surface, title, text, result.light, JSON.stringify(result), result.model, created_at);
  revalidatePath('/director');

  return result;
}

export interface RegenEvent {
  at: string;
  event_type: string;
  message: string;
  attempt?: number;
  channel?: string;
}

export interface DirectorRegen {
  id: string;
  cardId: string | null;
  surface: string;
  draft: string;
  status: 'running' | 'done' | 'exhausted' | 'error';
  phase: string | null;
  factCount: number | null;
  events: RegenEvent[];
  candidates: { channel: string; text: string; rationale: string | null }[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Phase 3 — "fuck this, hand it to the Actor."
 *
 * The escape hatch when the Director's notes are more than you want to hand-fix.
 * Your draft seeds the grounder (subject extraction + branch discovery), the
 * grounder builds a card, and the full Actor↔Director loop regenerates on-spec,
 * grounded copy. This is the one path allowed to generate, so it runs the whole
 * grounded pipeline; there is no cheap ungrounded rewrite.
 *
 * Persisted + streamed: the row updates as it goes (events stream, candidates
 * fill on completion), so the operator can watch progress, navigate away, and
 * still find the rebuilt copy. The CLIENT supplies regenId up front so it can
 * poll /api/director/regens/<id> live while this awaits.
 *
 * NOTE: the internal Director regenerates its own notes each attempt (same
 * judge, same voice) — so your verdict's guidance is effectively applied.
 */
export async function generateWithActor(input: {
  text: string;
  surface: Surface;
  title?: string;
  facts?: string;
  voiceId?: VoiceName;
  regenId?: string;
}): Promise<{ regenId: string; cardId: string | null }> {
  const text = input.text.trim();
  if (!text) throw new Error('Nothing to regenerate — write a draft first.');
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required to run the grounder + Actor.');
  }
  const channel = SURFACE_TO_CHANNEL[input.surface];
  const voiceId = input.voiceId ?? 'infinex';
  const voice = voiceSpecFor(voiceId);
  const titled = input.title?.trim();
  const regenId = input.regenId ?? newId();
  const db = getDb();

  const events: RegenEvent[] = [];
  const flush = () =>
    db.prepare('UPDATE director_regens SET events_json = ? WHERE id = ?').run(JSON.stringify(events), regenId);
  const push = (event_type: string, message: string, extra?: Partial<RegenEvent>) => {
    events.push({ at: nowIso(), event_type, message, ...extra });
    flush();
  };

  db.prepare(
    `INSERT INTO director_regens (id, card_id, voice, surface, draft, status, phase, events_json, candidates_json, created_at)
     VALUES (?, NULL, ?, ?, ?, 'running', 'grounding', '[]', '[]', ?)`,
  ).run(regenId, voiceId, input.surface, text, nowIso());

  const providedFacts = (input.facts ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let cardId: string | null = null;
  try {
    let factStrings: string[];

    if (providedFacts.length > 0) {
      // Reuse already-grounded / operator-curated facts — DON'T re-ground off the
      // copy. This is the path that keeps the PR the proper grounder caught.
      push('facts', `Using ${providedFacts.length} provided facts (skipping re-grounding).`);
      factStrings = providedFacts;
      db.prepare('UPDATE director_regens SET phase = ?, fact_count = ? WHERE id = ?').run('rebuilding', factStrings.length, regenId);
    } else {
      // No facts on hand — must ground. Seed discovery off the SUBJECT (the title),
      // never the marketing copy, or subject-extraction misfires and misses the PR.
      const seed = titled || text;
      if (!titled) {
        push(
          'warning',
          'No facts or title given — seeding the grounder off the draft copy. This may miss the launch PR. Tip: ground first, or set the title to the launch subject (e.g. "Collect Crypt launch").',
        );
      }
      push('grounding', `Creating card + researching the branch for: "${seed.slice(0, 80)}"…`);
      const created = await createCard(seed, voiceId);
      cardId = created.card_id;
      db.prepare('UPDATE director_regens SET card_id = ? WHERE id = ?').run(cardId, regenId);

      const { facts } = await runGrounder(cardId);
      factStrings = facts.map((f) => (f.value ? `${f.claim}: ${f.value}` : f.claim));
      db.prepare('UPDATE director_regens SET phase = ?, fact_count = ? WHERE id = ?').run('rebuilding', factStrings.length, regenId);
      push('grounded', `Grounded ${factStrings.length} facts. Handing to the Actor…`);
    }

    const releaseCard = {
      kind: 'launch-tier',
      id: cardId ?? regenId,
      title: titled || text.slice(0, 80),
      headline: titled || text.slice(0, 80),
      tier_reason: 'director-surface actor regeneration',
      deployed_facts: factStrings,
    } as unknown as ReleaseCard;

    const result = await orchestrateActorDirectorWithRetries(releaseCard, [channel], {
      n: 5,
      warmup_mode: parseActorWarmupMode(process.env.HARNESS_ACTOR_WARMUP),
      voice,
      mode: 'live',
      maxAttempts: 2,
      onEvent: (e) => push(e.event_type, e.message, { attempt: e.attempt, channel: e.channel }),
    });

    const candidates = result.picks.map((p) => ({ channel: p.channel, text: p.text, rationale: p.rationale ?? null }));
    db.prepare('UPDATE director_regens SET status = ?, candidates_json = ?, completed_at = ? WHERE id = ?').run(
      candidates.length === 0 ? 'exhausted' : 'done',
      JSON.stringify(candidates),
      nowIso(),
      regenId,
    );
    push(
      'done',
      candidates.length === 0
        ? 'Actor could not land a Director-passing version in 2 attempts.'
        : `Done — ${candidates.length} rebuilt option(s) passed the Director.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE director_regens SET status = ?, error = ?, completed_at = ? WHERE id = ?').run('error', msg, nowIso(), regenId);
    push('error', msg);
  }

  return { regenId, cardId };
}

function parseRegenRow(row: Record<string, unknown>): DirectorRegen {
  return {
    id: row.id as string,
    cardId: (row.card_id as string | null) ?? null,
    surface: row.surface as string,
    draft: row.draft as string,
    status: row.status as DirectorRegen['status'],
    phase: (row.phase as string | null) ?? null,
    factCount: (row.fact_count as number | null) ?? null,
    events: JSON.parse((row.events_json as string) || '[]'),
    candidates: JSON.parse((row.candidates_json as string) || '[]'),
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

/** Single regen — polled live by the client during a rebuild. */
export async function getRegen(id: string): Promise<DirectorRegen | null> {
  const row = getDb().prepare('SELECT * FROM director_regens WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? parseRegenRow(row) : null;
}

/** Recent regens, newest first — drives the rebuilds history + auto-resume. */
export async function listRegens(limit = 8): Promise<DirectorRegen[]> {
  const rows = getDb().prepare('SELECT * FROM director_regens ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(parseRegenRow);
}

export interface GroundedCardRef {
  cardId: string;
  brief: string;
  factCount: number;
  createdAt: string;
}

/**
 * Previously-grounded cards (from ANY harness work — the /cards flow included),
 * so the Director surface can reuse research you already did instead of
 * re-grounding off the copy. This is how the Collect Crypt grounding that
 * caught the PR becomes reusable here.
 */
export async function listGroundedCards(limit = 20): Promise<GroundedCardRef[]> {
  const rows = getDb()
    .prepare(
      `SELECT c.id AS id, c.brief AS brief, c.created_at AS created_at, count(f.id) AS fc
       FROM cards c JOIN facts f ON f.card_id = c.id AND f.status != 'rejected'
       GROUP BY c.id ORDER BY c.created_at DESC LIMIT ?`,
    )
    .all(limit) as { id: string; brief: string; created_at: string; fc: number }[];
  return rows.map((r) => ({ cardId: r.id, brief: r.brief, factCount: r.fc, createdAt: r.created_at }));
}

/** The deployed-fact strings for a grounded card — loaded into the fact box for reuse. */
export async function loadCardFacts(cardId: string): Promise<string[]> {
  const rows = getDb()
    .prepare(`SELECT claim, value FROM facts WHERE card_id = ? AND status != 'rejected'`)
    .all(cardId) as { claim: string; value: string }[];
  return rows.map((r) => (r.value ? `${r.claim}: ${r.value}` : r.claim));
}

/** Recent Director checks, newest first — drives the history list on /director. */
export async function listRecentChecks(limit = 30): Promise<DirectorCheckResult[]> {
  const rows = getDb()
    .prepare('SELECT verdict_json FROM director_checks ORDER BY created_at DESC LIMIT ?')
    .all(limit) as { verdict_json: string }[];
  return rows.map((r) => JSON.parse(r.verdict_json) as DirectorCheckResult);
}

export interface GroundResult {
  cardId: string;
  facts: string[];
  unverifiable: { claim: string; reason: string }[];
}

/**
 * Phase 2 — ground first, then judge.
 *
 * "Speak to the grounder" → it researches the ship-bound branch autonomously
 * and builds a card with deployed_facts. Those facts become the fact source
 * for the Director check, so the fact axis goes live instead of amber. The
 * card persists in the harness (shows in the queue), so you can throw multiple
 * drafts at the same grounded context.
 *
 * NOTE: the grounder here is autonomous (it discovers facts from the branch),
 * not yet interactive. An interactive clarifying-question loop — the grounder
 * asking the human to confirm assumptions and capturing the answers as facts —
 * is the next increment.
 */
export async function groundForDirector(
  brief: string,
  voiceId: VoiceName = 'infinex',
): Promise<GroundResult> {
  const b = brief.trim();
  if (!b) throw new Error('Tell the grounder what you are building first.');
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required to run the grounder.');
  }
  const { card_id } = await createCard(b, voiceId);
  const { facts, unverifiable } = await runGrounder(card_id);
  const factStrings = facts.map((f) => (f.value ? `${f.claim}: ${f.value}` : f.claim));
  return { cardId: card_id, facts: factStrings, unverifiable };
}
