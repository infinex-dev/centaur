'use server';

import { getDb, newId, nowIso, writeTx } from '@/lib/db';
import { latestAgreement } from '@/lib/queries';
import type { AgreementSnapshot, Stage, VoiceName } from '@/lib/types';

type Counts = {
  approved_as_is: number;
  edited: number;
  rejected: number;
};

type MetricKey = {
  voice: VoiceName;
  stage: Stage;
  beat_name?: string | null;
  fact_source?: string | null;
};

const ZERO: Counts = { approved_as_is: 0, edited: 0, rejected: 0 };

export async function recomputeAgreement(window_days = 7): Promise<{ snapshots_written: number }> {
  const db = getDb();
  const snapshotAt = nowIso();
  const cutoff = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();
  const metrics = new Map<string, MetricKey & Counts>();

  collectResearchMetrics(db, cutoff, metrics);
  collectCardMetrics(db, cutoff, metrics);
  collectGenerateMetrics(db, cutoff, metrics);

  const rows = Array.from(metrics.values()).filter(sampleSize);
  writeTx(db, () => {
    for (const row of rows) {
      const total = sampleSize(row);
      db.prepare(
        `INSERT INTO agreement_snapshots
           (id, snapshot_at, window_days, voice, stage, beat_name, fact_source,
            agreement_rate, sample_size, approved_as_is, edited, rejected)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        snapshotAt,
        window_days,
        row.voice,
        row.stage,
        row.beat_name ?? null,
        row.fact_source ?? null,
        row.approved_as_is / total,
        total,
        row.approved_as_is,
        row.edited,
        row.rejected,
      );
    }
  });

  return { snapshots_written: rows.length };
}

export async function getAgreement(opts: {
  voice?: VoiceName;
  stage?: Stage;
  window_days?: number;
}): Promise<AgreementSnapshot[]> {
  return latestAgreement(opts);
}

function collectResearchMetrics(
  db: ReturnType<typeof getDb>,
  cutoff: string,
  metrics: Map<string, MetricKey & Counts>,
): void {
  const rows = db
    .prepare(
      `SELECT c.voice, f.source, f.status
       FROM facts f
       JOIN cards c ON c.id = f.card_id
       WHERE c.created_at >= ? AND f.status IN ('approved','edited','manual','rejected')`,
    )
    .all(cutoff) as Array<{ voice: VoiceName; source: string; status: string }>;

  for (const row of rows) {
    const decision = factStatusToDecision(row.status);
    if (!decision) continue;
    bump(metrics, { voice: row.voice, stage: 'research' }, decision);
    bump(metrics, { voice: row.voice, stage: 'research', fact_source: row.source }, decision);
  }
}

function collectCardMetrics(
  db: ReturnType<typeof getDb>,
  cutoff: string,
  metrics: Map<string, MetricKey & Counts>,
): void {
  const rows = db
    .prepare(
      `SELECT c.id, c.voice, c.status, c.card_approved_at,
              COUNT(e.id) AS edits
       FROM cards c
       LEFT JOIN release_card_edits e ON e.card_id = c.id
       WHERE c.created_at >= ?
       GROUP BY c.id`,
    )
    .all(cutoff) as Array<{
      id: string;
      voice: VoiceName;
      status: string;
      card_approved_at: string | null;
      edits: number;
    }>;

  for (const row of rows) {
    if (row.status === 'abandoned') {
      bump(metrics, { voice: row.voice, stage: 'card' }, 'rejected');
      continue;
    }
    if (!row.card_approved_at) continue;
    bump(metrics, { voice: row.voice, stage: 'card' }, row.edits > 0 ? 'edited' : 'approved_as_is');
  }
}

function collectGenerateMetrics(
  db: ReturnType<typeof getDb>,
  cutoff: string,
  metrics: Map<string, MetricKey & Counts>,
): void {
  const rows = db
    .prepare(
      `SELECT c.voice, cand.id AS candidate_id, cand.declared_beats_json, d.action,
              (
                SELECT shifted_beats_json
                FROM candidate_semantic_edits sem
                WHERE sem.candidate_id = cand.id
                ORDER BY sem.edited_at DESC
                LIMIT 1
              ) AS shifted_beats_json
       FROM candidate_decisions d
       JOIN candidates cand ON cand.id = d.candidate_id
       JOIN cards c ON c.id = cand.card_id
       WHERE d.decided_at >= ? AND d.action != 'retry'
       ORDER BY d.candidate_id ASC, d.decided_at ASC`,
    )
    .all(cutoff) as Array<{
      voice: VoiceName;
      candidate_id: string;
      declared_beats_json: string;
      action: 'approve' | 'edit' | 'reject';
      shifted_beats_json: string | null;
    }>;

  const latestByCandidate = new Map<string, (typeof rows)[number]>();
  for (const row of rows) latestByCandidate.set(row.candidate_id, row);

  for (const row of latestByCandidate.values()) {
    const decision =
      row.action === 'approve' ? 'approved_as_is' : row.action === 'edit' ? 'edited' : 'rejected';
    bump(metrics, { voice: row.voice, stage: 'generate' }, decision);

    const beats = parseJson<Array<{ tempo?: string }>>(row.declared_beats_json, []);
    const shifted = new Set(
      parseJson<Array<{ beat_index: number }>>(row.shifted_beats_json ?? '[]', [])
        .map((s) => s.beat_index)
        .filter((idx) => Number.isInteger(idx)),
    );
    beats.forEach((beat, beatIndex) => {
      const beatName = beat.tempo;
      if (!beatName) return;
      if (row.action === 'reject') {
        bump(metrics, { voice: row.voice, stage: 'generate', beat_name: beatName }, 'rejected');
      } else if (row.action === 'edit' && shifted.has(beatIndex)) {
        bump(metrics, { voice: row.voice, stage: 'generate', beat_name: beatName }, 'edited');
      } else {
        bump(metrics, { voice: row.voice, stage: 'generate', beat_name: beatName }, 'approved_as_is');
      }
    });
  }
}

function bump(
  metrics: Map<string, MetricKey & Counts>,
  key: MetricKey,
  bucket: keyof Counts,
): void {
  const id = [
    key.voice,
    key.stage,
    key.beat_name ?? '',
    key.fact_source ?? '',
  ].join('|');
  const existing = metrics.get(id) ?? {
    ...key,
    ...ZERO,
  };
  existing[bucket] += 1;
  metrics.set(id, existing);
}

function factStatusToDecision(status: string): keyof Counts | null {
  if (status === 'approved') return 'approved_as_is';
  if (status === 'edited' || status === 'manual') return 'edited';
  if (status === 'rejected') return 'rejected';
  return null;
}

function sampleSize(counts: Counts): number {
  return counts.approved_as_is + counts.edited + counts.rejected;
}

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
