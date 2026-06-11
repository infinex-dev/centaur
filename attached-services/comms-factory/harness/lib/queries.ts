import type Database from 'better-sqlite3';
import { safeParseReleaseCard } from '@pipeline/card';
import type {
  AgreementSnapshot,
  CardDetailView,
  CardPositioning,
  Channel,
  FinalPick,
  HarnessActorAttempt,
  HarnessActorRun,
  HarnessActorRunEvent,
  HarnessCandidate,
  HarnessCard,
  HarnessFact,
  HarnessGeneratorAttempt,
  HandbackPrompt,
  HarnessOperatorFeedback,
  HarnessPipelineRun,
  PendingApiRequest,
  ApprovedApiHost,
  Stage,
  StageState,
  StageStatus,
  TableWork,
  VoiceName,
} from './types';
import { getDb } from './db';

export const CHANNELS: Channel[] = ['x', 'x-thread', 'web', 'in-product', 'modal', 'blog', 'carousel', 'image-brief'];

const CANDIDATE_SELECT = `
  SELECT c.*,
    (
      SELECT active_validation_passed
      FROM candidate_audits a
      WHERE a.candidate_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS active_validation_passed,
    (
      SELECT active_audit_json
      FROM candidate_audits a
      WHERE a.candidate_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS active_audit_json,
    (
      SELECT history_guard_passed
      FROM candidate_audits a
      WHERE a.candidate_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS history_guard_passed,
    (
      SELECT history_guard_json
      FROM candidate_audits a
      WHERE a.candidate_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS history_guard_json,
    (
      SELECT id
      FROM director_audits d
      WHERE d.candidate_id = c.id
      ORDER BY d.created_at DESC
      LIMIT 1
    ) AS director_audit_id,
    (
      SELECT passed
      FROM director_audits d
      WHERE d.candidate_id = c.id
      ORDER BY d.created_at DESC
      LIMIT 1
    ) AS director_passed,
    (
      SELECT director_audit_json
      FROM director_audits d
      WHERE d.candidate_id = c.id
      ORDER BY d.created_at DESC
      LIMIT 1
    ) AS director_audit_json
  FROM candidates c
`;

export interface GrounderRun {
  id: string;
  card_id: string;
  started_at: string;
  completed_at: string | null;
  model: string | null;
  ground_turns: number | null;
  facts_count: number;
  unverifiable_count: number;
  truncated: boolean;
  events_json: string;
  error: string | null;
}

export function listCards(db: Database.Database = getDb()): HarnessCard[] {
  return db
    .prepare('SELECT * FROM cards ORDER BY created_at DESC')
    .all()
    .map(rowToCard);
}

export function getCard(cardId: string, db: Database.Database = getDb()): HarnessCard | null {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  return row ? rowToCard(row) : null;
}

export function requireCard(cardId: string, db: Database.Database = getDb()): HarnessCard {
  const card = getCard(cardId, db);
  if (!card) throw new Error(`Card not found: ${cardId}`);
  return card;
}

export function listFacts(cardId: string, db: Database.Database = getDb()): HarnessFact[] {
  return db
    .prepare('SELECT * FROM facts WHERE card_id = ? ORDER BY verified_at ASC, id ASC')
    .all(cardId)
    .map(rowToFact);
}

export function getLatestGrounderRun(cardId: string, db: Database.Database = getDb()): GrounderRun | null {
  const row = db
    .prepare('SELECT * FROM grounder_runs WHERE card_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(cardId);
  return row ? rowToGrounderRun(row) : null;
}

export function listApprovedFacts(cardId: string, db: Database.Database = getDb()): HarnessFact[] {
  return db
    .prepare(
      "SELECT * FROM facts WHERE card_id = ? AND status IN ('approved','edited','manual') ORDER BY verified_at ASC, id ASC",
    )
    .all(cardId)
    .map(rowToFact);
}

export function listPendingApiRequests(cardId: string, db: Database.Database = getDb()): PendingApiRequest[] {
  return db
    .prepare("SELECT * FROM pending_api_requests WHERE card_id = ? AND status = 'pending' ORDER BY created_at DESC")
    .all(cardId)
    .map(rowToPendingApiRequest);
}

export function listApprovedApiHosts(db: Database.Database = getDb()): ApprovedApiHost[] {
  return db
    .prepare('SELECT * FROM approved_api_hosts ORDER BY approved_at ASC')
    .all()
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        host: stringField(r, 'host'),
        approved_at: stringField(r, 'approved_at'),
        approved_by: nullableStringField(r, 'approved_by'),
      };
    });
}

function rowToPendingApiRequest(row: unknown): PendingApiRequest {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    host: stringField(r, 'host'),
    url: stringField(r, 'url'),
    reason: stringField(r, 'reason'),
    status: stringField(r, 'status') as PendingApiRequest['status'],
    created_at: stringField(r, 'created_at'),
    resolved_at: nullableStringField(r, 'resolved_at'),
  };
}

export function requireFact(factId: string, db: Database.Database = getDb()): HarnessFact {
  const row = db.prepare('SELECT * FROM facts WHERE id = ?').get(factId);
  if (!row) throw new Error(`Fact not found: ${factId}`);
  return rowToFact(row);
}

export function getReleaseCardJson(cardId: string, db: Database.Database = getDb()): string | null {
  const row = db.prepare('SELECT release_card_json FROM release_cards WHERE card_id = ?').get(cardId) as
    | { release_card_json: string }
    | undefined;
  return row?.release_card_json ?? null;
}

export function listCandidates(cardId: string, db: Database.Database = getDb()): HarnessCandidate[] {
  return db
    .prepare(`${CANDIDATE_SELECT} WHERE c.card_id = ? ORDER BY c.channel ASC, c.attempt DESC, c.created_at ASC`)
    .all(cardId)
    .map(rowToCandidate);
}

export function requireCandidate(candidateId: string, db: Database.Database = getDb()): HarnessCandidate {
  const row = db.prepare(`${CANDIDATE_SELECT} WHERE c.id = ?`).get(candidateId);
  if (!row) throw new Error(`Candidate not found: ${candidateId}`);
  return rowToCandidate(row);
}

export interface StratifiedCandidate {
  candidate: HarnessCandidate;
  signal: number;
  prompt_variant: string | null;
  stratum: 'top' | 'median' | 'bottom';
}

export interface StratifiedCellSummary {
  prompt_variant: string | null;
  channel: Channel;
  total: number;
  validator_pass_rate: number;
  active_pass_rate: number | null;
  signal_min: number;
  signal_median: number;
  signal_max: number;
}

export interface StratifiedResult {
  candidates: StratifiedCandidate[];
  cells: StratifiedCellSummary[];
  available_variants: Array<string | null>;
}

export function listCandidatesStratified(
  opts: {
    prompt_variants?: Array<string | null>;
    channels?: Channel[];
    per_stratum?: number;
  } = {},
  db: Database.Database = getDb(),
): StratifiedResult {
  const perStratum = opts.per_stratum ?? 5;
  const channels = opts.channels ?? CHANNELS;

  const where: string[] = [`c.channel IN (${channels.map(() => '?').join(',')})`];
  const params: unknown[] = [...channels];
  if (opts.prompt_variants && opts.prompt_variants.length > 0) {
    const nullRequested = opts.prompt_variants.some((v) => v === null);
    const nonNull = opts.prompt_variants.filter((v): v is string => v !== null);
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      clauses.push(`c.prompt_variant IN (${nonNull.map(() => '?').join(',')})`);
      params.push(...nonNull);
    }
    if (nullRequested) clauses.push('c.prompt_variant IS NULL');
    if (clauses.length > 0) where.push(`(${clauses.join(' OR ')})`);
  }

  const rows = db
    .prepare(`${CANDIDATE_SELECT} WHERE ${where.join(' AND ')}`)
    .all(...params)
    .map(rowToCandidate);

  const groups = new Map<string, HarnessCandidate[]>();
  const variantSet = new Set<string | null>();
  for (const c of rows) {
    variantSet.add(c.prompt_variant);
    const key = `${c.prompt_variant ?? '__null__'}|${c.channel}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(c);
    groups.set(key, bucket);
  }

  const out: StratifiedCandidate[] = [];
  const cells: StratifiedCellSummary[] = [];
  for (const [key, candidates] of groups) {
    const [variantKey, channel] = key.split('|');
    const variant = variantKey === '__null__' ? null : variantKey;
    const scored = candidates
      .map((c) => ({ candidate: c, signal: candidateSignal(c) }))
      .sort((a, b) => b.signal - a.signal);
    if (scored.length === 0) continue;

    const signals = scored.map((s) => s.signal);
    const validatorPass = candidates.filter((c) => c.validation_passed).length / candidates.length;
    const withActive = candidates.filter((c) => c.active_validation_passed !== null);
    const activePass = withActive.length > 0
      ? withActive.filter((c) => c.active_validation_passed).length / withActive.length
      : null;
    cells.push({
      prompt_variant: variant,
      channel: channel as Channel,
      total: candidates.length,
      validator_pass_rate: validatorPass,
      active_pass_rate: activePass,
      signal_min: signals[signals.length - 1] ?? 0,
      signal_median: signals[Math.floor(signals.length / 2)] ?? 0,
      signal_max: signals[0] ?? 0,
    });

    const seen = new Set<string>();
    const take = (slice: typeof scored, stratum: StratifiedCandidate['stratum']) => {
      for (const item of slice) {
        if (seen.has(item.candidate.id)) continue;
        seen.add(item.candidate.id);
        out.push({ candidate: item.candidate, signal: item.signal, prompt_variant: variant, stratum });
      }
    };
    take(scored.slice(0, perStratum), 'top');
    const midStart = Math.max(0, Math.floor((scored.length - perStratum) / 2));
    take(scored.slice(midStart, midStart + perStratum), 'median');
    take(scored.slice(-perStratum).slice().reverse(), 'bottom');
  }

  cells.sort((a, b) => {
    const av = a.prompt_variant ?? '';
    const bv = b.prompt_variant ?? '';
    if (av !== bv) return av.localeCompare(bv);
    return a.channel.localeCompare(b.channel);
  });

  return {
    candidates: out,
    cells,
    available_variants: Array.from(variantSet).sort((a, b) => (a ?? '').localeCompare(b ?? '')),
  };
}

export function listPromptVariants(db: Database.Database = getDb()): Array<string | null> {
  const rows = db
    .prepare('SELECT DISTINCT prompt_variant FROM candidates ORDER BY prompt_variant ASC')
    .all() as Array<{ prompt_variant: string | null }>;
  return rows.map((r) => r.prompt_variant);
}

function candidateSignal(c: HarnessCandidate): number {
  const regex = c.validation_passed ? 1 : 0;
  const active = c.active_validation_passed === null ? regex : c.active_validation_passed ? 1 : 0;
  let beatPassRate = 1;
  try {
    const beats = JSON.parse(c.beat_audit_json) as Array<{ passed?: boolean }>;
    if (Array.isArray(beats) && beats.length > 0) {
      beatPassRate = beats.filter((b) => b?.passed).length / beats.length;
    }
  } catch {
    beatPassRate = 0;
  }
  return regex * 0.4 + active * 0.4 + beatPassRate * 0.2;
}

export function listGeneratorAttempts(
  cardId: string,
  db: Database.Database = getDb(),
): HarnessGeneratorAttempt[] {
  return db
    .prepare(
      'SELECT * FROM generator_attempts WHERE card_id = ? ORDER BY channel ASC, attempt ASC',
    )
    .all(cardId)
    .map(rowToGeneratorAttempt);
}

export function listActorAttempts(
  cardId: string,
  db: Database.Database = getDb(),
): HarnessActorAttempt[] {
  return db
    .prepare(
      `SELECT a.*,
        (
          SELECT daily_pages_json
          FROM actor_warmups w
          WHERE w.actor_attempt_id = a.id
          ORDER BY w.created_at DESC
          LIMIT 1
        ) AS daily_pages_json
       FROM actor_attempts a
       WHERE a.card_id = ?
       ORDER BY a.attempt ASC`,
    )
    .all(cardId)
    .map(rowToActorAttempt);
}

/**
 * Cross-card positioning rollup: the latest actor attempt per card, parsed
 * into its derived table-work, joined to the card. Only cards that have been
 * run through the actor (and thus have derived positioning) appear. This is
 * the evidence layer for the positioning surface — each row ladders up to the
 * locked super-objective. Newest-derived first.
 */
export function listCardPositioning(db: Database.Database = getDb()): CardPositioning[] {
  const rows = db
    .prepare(
      `SELECT a.card_id, a.attempt, a.created_at, a.generator_source, a.table_work_json,
              c.brief, c.status, c.ship_at
         FROM actor_attempts a
         JOIN (
           SELECT card_id, MAX(attempt) AS max_attempt
           FROM actor_attempts
           GROUP BY card_id
         ) latest ON latest.card_id = a.card_id AND latest.max_attempt = a.attempt
         JOIN cards c ON c.id = a.card_id
        ORDER BY a.created_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    card_id: stringField(row, 'card_id'),
    brief: stringField(row, 'brief'),
    status: stringField(row, 'status') as CardPositioning['status'],
    ship_at: nullableStringField(row, 'ship_at'),
    attempt: numberField(row, 'attempt'),
    created_at: stringField(row, 'created_at'),
    generator_source: stringField(row, 'generator_source') as 'anthropic' | 'stub',
    table_work: parseTableWork(row.table_work_json),
  }));
}

function parseTableWork(json: unknown): TableWork {
  if (typeof json !== 'string') return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as TableWork) : {};
  } catch {
    return {};
  }
}

export function listActorRunEvents(
  cardId: string,
  db: Database.Database = getDb(),
  limit = 80,
  runId?: string,
): HarnessActorRunEvent[] {
  const where = runId ? 'card_id = ? AND run_id = ?' : 'card_id = ?';
  const params = runId ? [cardId, runId, limit] : [cardId, limit];
  return db
    .prepare(
      `SELECT * FROM actor_run_events
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(...params)
    .map(rowToActorRunEvent);
}

export function getActorRun(
  runId: string,
  db: Database.Database = getDb(),
): HarnessActorRun | null {
  try {
    const row = db.prepare('SELECT * FROM actor_runs WHERE id = ?').get(runId);
    return row ? rowToActorRun(row) : null;
  } catch {
    return null;
  }
}

export function getLatestActorRun(
  cardId: string,
  db: Database.Database = getDb(),
): HarnessActorRun | null {
  try {
    const row = db
      .prepare('SELECT * FROM actor_runs WHERE card_id = ? ORDER BY started_at DESC LIMIT 1')
      .get(cardId);
    return row ? rowToActorRun(row) : null;
  } catch {
    return null;
  }
}

export function getRunningActorRun(
  cardId: string,
  db: Database.Database = getDb(),
): HarnessActorRun | null {
  try {
    const row = db
      .prepare("SELECT * FROM actor_runs WHERE card_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1")
      .get(cardId);
    return row ? rowToActorRun(row) : null;
  } catch {
    return null;
  }
}

export function getLatestPipelineRun(
  cardId: string,
  db: Database.Database = getDb(),
): HarnessPipelineRun | null {
  try {
    const row = db
      .prepare('SELECT * FROM pipeline_runs WHERE card_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(cardId);
    return row ? rowToPipelineRun(row) : null;
  } catch {
    return null;
  }
}

export function listOperatorFeedback(
  cardId: string,
  db: Database.Database = getDb(),
): HarnessOperatorFeedback[] {
  return db
    .prepare('SELECT * FROM operator_feedback WHERE card_id = ? ORDER BY created_at ASC, id ASC')
    .all(cardId)
    .map(rowToOperatorFeedback);
}

export function getLatestHandbackPrompt(
  cardId: string,
  channel: Channel,
  db: Database.Database = getDb(),
): HandbackPrompt | null {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='handback_prompts'")
    .get();
  if (!exists) return null;
  const row = db
    .prepare(
      'SELECT * FROM handback_prompts WHERE card_id = ? AND channel = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    )
    .get(cardId, channel);
  return row ? rowToHandbackPrompt(row) : null;
}

function rowToHandbackPrompt(row: unknown): HandbackPrompt {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    channel: stringField(r, 'channel') as Channel,
    reground_prompt: nullableStringField(r, 'reground_prompt'),
    regenerate_prompt: nullableStringField(r, 'regenerate_prompt'),
    scope: nullableStringField(r, 'scope'),
    run_id: nullableStringField(r, 'run_id'),
    status: stringField(r, 'status'),
    created_at: stringField(r, 'created_at'),
  };
}

export function listPicks(cardId: string, db: Database.Database = getDb()): FinalPick[] {
  return db
    .prepare('SELECT * FROM final_picks WHERE card_id = ? ORDER BY channel ASC')
    .all(cardId)
    .map(rowToPick);
}

export function latestAgreement(opts: {
  voice?: VoiceName | 'all';
  stage?: Stage | 'all';
  window_days?: number;
} = {}, db: Database.Database = getDb()): AgreementSnapshot[] {
  const windowDays = opts.window_days ?? 7;
  const latest = db
    .prepare('SELECT MAX(snapshot_at) AS snapshot_at FROM agreement_snapshots WHERE window_days = ?')
    .get(windowDays) as { snapshot_at: string | null };
  if (!latest.snapshot_at) return [];

  const where = ['snapshot_at = ?', 'window_days = ?'];
  const params: unknown[] = [latest.snapshot_at, windowDays];
  if (opts.voice) {
    where.push('voice = ?');
    params.push(opts.voice);
  }
  if (opts.stage) {
    where.push('stage = ?');
    params.push(opts.stage);
  }

  return db
    .prepare(
      `SELECT * FROM agreement_snapshots WHERE ${where.join(' AND ')}
       ORDER BY voice ASC, stage ASC, beat_name ASC, fact_source ASC`,
    )
    .all(...params)
    .map(rowToAgreement);
}

/** One declared→classified tempo shift, aggregated across captured semantic edits. */
export interface TempoShift {
  from_tempo: string;
  to_tempo: string;
  count: number;
}

/**
 * Aggregate Mode-C semantic edits into declared→classified tempo shifts.
 * Reads candidate_semantic_edits (populated when an operator's text edit
 * re-classifies a beat). Empty until edit-capture is wired — the shifts
 * screen shows an explicit empty-state rather than fabricated counts.
 */
export function aggregateTempoShifts(
  windowDays = 7,
  db: Database.Database = getDb(),
): { shifts: TempoShift[]; sampleSize: number } {
  let rows: Array<{ shifted_beats_json: string }>;
  try {
    rows = db
      .prepare(
        `SELECT shifted_beats_json FROM candidate_semantic_edits
         WHERE edited_at >= datetime('now', ?)`,
      )
      .all(`-${windowDays} days`) as Array<{ shifted_beats_json: string }>;
  } catch {
    return { shifts: [], sampleSize: 0 };
  }
  const counts = new Map<string, number>();
  let sampleSize = 0;
  for (const row of rows) {
    let shifted: Array<{ from?: string; to?: string }>;
    try {
      shifted = JSON.parse(row.shifted_beats_json);
    } catch {
      continue;
    }
    for (const s of shifted) {
      if (!s.from || !s.to) continue;
      sampleSize += 1;
      const key = `${s.from}→${s.to}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const shifts: TempoShift[] = [...counts.entries()].map(([key, count]) => {
    const [from_tempo, to_tempo] = key.split('→');
    return { from_tempo, to_tempo, count };
  });
  shifts.sort((a, b) => b.count - a.count);
  return { shifts, sampleSize };
}

export function getCardDetail(cardId: string, db: Database.Database = getDb()): CardDetailView | null {
  const card = getCard(cardId, db);
  if (!card) return null;
  const facts = listFacts(cardId, db);
  const candidates = listCandidates(cardId, db);
  const picks = listPicks(cardId, db);
  const attempts = listGeneratorAttempts(cardId, db);
  const actorAttempts = listActorAttempts(cardId, db);
  const operatorFeedback = listOperatorFeedback(cardId, db);
  const pipelineRun = getLatestPipelineRun(cardId, db);
  const releaseCardJson = getReleaseCardJson(cardId, db);
  const expectedChannels = expectedChannelsForCard(cardId, db);
  return {
    card,
    stages: buildStageStates(card, facts, releaseCardJson, candidates, picks, db),
    facts,
    expected_channels: expectedChannels,
    candidates_by_channel: Object.fromEntries(
      CHANNELS.map((ch) => [ch, candidates.filter((c) => c.channel === ch)]),
    ) as Record<Channel, HarnessCandidate[]>,
    attempts_by_channel: Object.fromEntries(
      CHANNELS.map((ch) => [ch, attempts.filter((a) => a.channel === ch)]),
    ) as Record<Channel, HarnessGeneratorAttempt[]>,
    actor_attempts: actorAttempts,
    operator_feedback: operatorFeedback,
    pipeline_run: pipelineRun,
    picks,
    pending_api_requests: listPendingApiRequests(cardId, db),
  };
}

export function expectedChannelsForCard(cardId: string, db: Database.Database = getDb()): Channel[] {
  const json = getReleaseCardJson(cardId, db);
  if (!json) return CHANNELS;
  try {
    const parsed = safeParseReleaseCard(JSON.parse(json));
    if (!parsed.success) return CHANNELS;
    const channels = parsed.data.audience.filter(isAudienceChannel);
    const base = channels.length > 0 ? channels : CHANNELS.filter((channel) => channel !== 'image-brief');
    return [...new Set<Channel>([...base, 'image-brief'])];
  } catch {
    return CHANNELS;
  }
}

function isAudienceChannel(value: string): value is Exclude<Channel, 'image-brief'> {
  return value === 'x' ||
    value === 'x-thread' ||
    value === 'web' ||
    value === 'in-product' ||
    value === 'modal' ||
    value === 'blog' ||
    value === 'carousel';
}

function buildStageStates(
  card: HarnessCard,
  facts: HarnessFact[],
  releaseCardJson: string | null,
  candidates: HarnessCandidate[],
  picks: FinalPick[],
  db: Database.Database,
): Record<Stage, StageState> {
  const abandoned = card.status === 'abandoned';
  const shipped = card.status === 'shipped';
  const cardEdited = releaseCardEditCount(card.id, db) > 0;
  const expectedChannels = expectedChannelsForCard(card.id, db);
  const pickedChannels = new Set(picks.map((p) => p.channel));
  const allChannelsPicked = expectedChannels.every((channel) => pickedChannels.has(channel));
  const candidateEdited = candidateEditCount(card.id, db) > 0;

  return {
    research: {
      stage: 'research',
      status: abandoned ? 'rejected' : card.research_approved_at ? factApprovedStatus(facts) : facts.length > 0 ? 'awaiting' : 'pending',
      started_at: card.created_at,
      completed_at: card.research_approved_at,
      notes: null,
    },
    card: {
      stage: 'card',
      status: abandoned
        ? 'rejected'
        : card.card_approved_at
          ? cardEdited
            ? 'edited'
            : 'approved'
          : releaseCardJson
            ? 'awaiting'
            : 'pending',
      started_at: card.research_approved_at,
      completed_at: card.card_approved_at,
      notes: null,
    },
    generate: {
      stage: 'generate',
      status: abandoned
        ? 'rejected'
        : allChannelsPicked
          ? candidateEdited
            ? 'edited'
            : 'approved'
          : candidates.length > 0
            ? 'awaiting'
            : 'pending',
      started_at: card.card_approved_at,
      completed_at: allChannelsPicked ? latestPickCreatedAt(picks) : null,
      notes: null,
    },
    ship: {
      stage: 'ship',
      status: abandoned ? 'rejected' : shipped ? 'approved' : picks.length > 0 ? 'awaiting' : 'pending',
      started_at: allChannelsPicked ? latestPickCreatedAt(picks) : null,
      completed_at: card.ship_at,
      notes: null,
    },
  };
}

function factApprovedStatus(facts: HarnessFact[]): StageStatus {
  return facts.some((f) => f.status === 'edited' || f.status === 'manual') ? 'edited' : 'approved';
}

function releaseCardEditCount(cardId: string, db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM release_card_edits WHERE card_id = ?').get(cardId) as {
    count: number;
  };
  return row.count;
}

function candidateEditCount(cardId: string, db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM candidate_decisions d
       JOIN candidates c ON c.id = d.candidate_id
       WHERE c.card_id = ? AND d.action = 'edit'`,
    )
    .get(cardId) as { count: number };
  return row.count;
}

function latestPickCreatedAt(picks: FinalPick[]): string | null {
  if (picks.length === 0) return null;
  return picks.reduce<string | null>((latest, pick) => {
    if (!pick.shipped_at) return latest;
    return latest && latest > pick.shipped_at ? latest : pick.shipped_at;
  }, null);
}

function rowToCard(row: unknown): HarnessCard {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    voice: stringField(r, 'voice') as VoiceName,
    brief: stringField(r, 'brief'),
    status: stringField(r, 'status') as HarnessCard['status'],
    created_at: stringField(r, 'created_at'),
    completed_at: nullableStringField(r, 'completed_at'),
    research_approved_at: nullableStringField(r, 'research_approved_at'),
    card_approved_at: nullableStringField(r, 'card_approved_at'),
    ship_at: nullableStringField(r, 'ship_at'),
  };
}

function rowToFact(row: unknown): HarnessFact {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    category: stringField(r, 'category'),
    claim: stringField(r, 'claim'),
    value: stringField(r, 'value'),
    source: stringField(r, 'source'),
    source_ref: stringField(r, 'source_ref'),
    confidence: numberField(r, 'confidence'),
    verified_at: stringField(r, 'verified_at'),
    status: stringField(r, 'status') as HarnessFact['status'],
    rejection_reason: nullableStringField(r, 'rejection_reason'),
    created_by: stringField(r, 'created_by') as HarnessFact['created_by'],
  };
}

function rowToGrounderRun(row: unknown): GrounderRun {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    started_at: stringField(r, 'started_at'),
    completed_at: nullableStringField(r, 'completed_at'),
    model: nullableStringField(r, 'model'),
    ground_turns: nullableNumberField(r, 'ground_turns'),
    facts_count: numberField(r, 'facts_count'),
    unverifiable_count: numberField(r, 'unverifiable_count'),
    truncated: Boolean(numberField(r, 'truncated')),
    events_json: stringField(r, 'events_json'),
    error: nullableStringField(r, 'error'),
  };
}

function rowToCandidate(row: unknown): HarnessCandidate {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    channel: stringField(r, 'channel') as Channel,
    attempt: numberField(r, 'attempt'),
    text: stringField(r, 'text'),
    structured_json: nullableStringField(r, 'structured_json'),
    declared_beats_json: stringField(r, 'declared_beats_json'),
    beat_audit_json: stringField(r, 'beat_audit_json'),
    validation_passed: Boolean(numberField(r, 'validation_passed')),
    validation_failures_json: stringField(r, 'validation_failures_json'),
    active_validation_passed: nullableBooleanField(r, 'active_validation_passed'),
    active_audit_json: nullableStringField(r, 'active_audit_json'),
    history_guard_passed: nullableBooleanField(r, 'history_guard_passed'),
    history_guard_json: nullableStringField(r, 'history_guard_json'),
    director_audit_id: nullableStringField(r, 'director_audit_id'),
    director_passed: nullableBooleanField(r, 'director_passed'),
    director_audit_json: nullableStringField(r, 'director_audit_json'),
    rationale: nullableStringField(r, 'rationale'),
    source: stringField(r, 'source') as HarnessCandidate['source'],
    prompt_variant: nullableStringField(r, 'prompt_variant'),
    created_at: stringField(r, 'created_at'),
  };
}

function rowToGeneratorAttempt(row: unknown): HarnessGeneratorAttempt {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    channel: stringField(r, 'channel') as Channel,
    attempt: numberField(r, 'attempt'),
    auto_feedback_in: nullableStringField(r, 'auto_feedback_in'),
    inner_work_prompt_json: nullableStringField(r, 'inner_work_prompt_json'),
    drafting_prompt_json: nullableStringField(r, 'drafting_prompt_json'),
    legacy_prompt_json: nullableStringField(r, 'legacy_prompt_json'),
    generator_source: stringField(r, 'generator_source') as HarnessGeneratorAttempt['generator_source'],
    prompt_variant: nullableStringField(r, 'prompt_variant'),
    created_at: stringField(r, 'created_at'),
  };
}

function rowToActorAttempt(row: unknown): HarnessActorAttempt {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    attempt: numberField(r, 'attempt'),
    channels_json: stringField(r, 'channels_json'),
    source_index_json: stringField(r, 'source_index_json'),
    prompt_version: stringField(r, 'prompt_version'),
    prompt_hash: stringField(r, 'prompt_hash'),
    model: nullableStringField(r, 'model'),
    director_notes_in_json: nullableStringField(r, 'director_notes_in_json'),
    actor_prompt_json: stringField(r, 'actor_prompt_json'),
    actor_transcript_json: stringField(r, 'actor_transcript_json'),
    actor_response_json: stringField(r, 'actor_response_json'),
    daily_pages_json: nullableStringField(r, 'daily_pages_json'),
    table_work_json: stringField(r, 'table_work_json'),
    generator_source: stringField(r, 'generator_source') as HarnessActorAttempt['generator_source'],
    created_at: stringField(r, 'created_at'),
  };
}

function rowToActorRunEvent(row: unknown): HarnessActorRunEvent {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    run_id: stringField(r, 'run_id'),
    attempt: nullableNumberField(r, 'attempt'),
    channel: nullableStringField(r, 'channel') as HarnessActorRunEvent['channel'],
    event_type: stringField(r, 'event_type'),
    message: stringField(r, 'message'),
    payload_json: stringField(r, 'payload_json'),
    created_at: stringField(r, 'created_at'),
  };
}

function rowToActorRun(row: unknown): HarnessActorRun {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    status: stringField(r, 'status') as HarnessActorRun['status'],
    channels_json: stringField(r, 'channels_json'),
    started_at: stringField(r, 'started_at'),
    completed_at: nullableStringField(r, 'completed_at'),
    error: nullableStringField(r, 'error'),
  };
}

function rowToPipelineRun(row: unknown): HarnessPipelineRun {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    pipeline_id: stringField(r, 'pipeline_id') as HarnessPipelineRun['pipeline_id'],
    pipeline_label: stringField(r, 'pipeline_label'),
    entrypoint: stringField(r, 'entrypoint'),
    proof_json: stringField(r, 'proof_json'),
    proof_passed: Boolean(numberField(r, 'proof_passed')),
    created_at: stringField(r, 'created_at'),
  };
}

function rowToOperatorFeedback(row: unknown): HarnessOperatorFeedback {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    target_type: stringField(r, 'target_type') as HarnessOperatorFeedback['target_type'],
    target_id: stringField(r, 'target_id'),
    feedback_text: stringField(r, 'feedback_text'),
    created_at: stringField(r, 'created_at'),
  };
}

function rowToPick(row: unknown): FinalPick {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    card_id: stringField(r, 'card_id'),
    channel: stringField(r, 'channel') as Channel,
    candidate_id: stringField(r, 'candidate_id'),
    final_text: stringField(r, 'final_text'),
    final_structured_json: nullableStringField(r, 'final_structured_json'),
    shipped_at: nullableStringField(r, 'shipped_at'),
    shipped_to: nullableStringField(r, 'shipped_to') as FinalPick['shipped_to'],
  };
}

function rowToAgreement(row: unknown): AgreementSnapshot {
  const r = row as Record<string, unknown>;
  return {
    id: stringField(r, 'id'),
    snapshot_at: stringField(r, 'snapshot_at'),
    window_days: numberField(r, 'window_days'),
    voice: stringField(r, 'voice') as AgreementSnapshot['voice'],
    stage: stringField(r, 'stage') as AgreementSnapshot['stage'],
    beat_name: nullableStringField(r, 'beat_name'),
    fact_source: nullableStringField(r, 'fact_source'),
    agreement_rate: numberField(r, 'agreement_rate'),
    sample_size: numberField(r, 'sample_size'),
    approved_as_is: numberField(r, 'approved_as_is'),
    edited: numberField(r, 'edited'),
    rejected: numberField(r, 'rejected'),
  };
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  return typeof value === 'string' ? value : String(value ?? '');
}

function nullableStringField(row: Record<string, unknown>, field: string): string | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : String(value);
}

function numberField(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberField(row: Record<string, unknown>, field: string): number | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableBooleanField(row: Record<string, unknown>, field: string): boolean | null {
  const value = nullableNumberField(row, field);
  return value === null ? null : Boolean(value);
}
