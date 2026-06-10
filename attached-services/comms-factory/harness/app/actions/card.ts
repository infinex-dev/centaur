'use server';

import { revalidatePath } from 'next/cache';
import { parseReleaseCard } from '@pipeline/card';
import { buildReleaseCardFromFacts } from '@/lib/card-builder';
import { getDb, newId, nowIso, writeTx } from '@/lib/db';
import { getPathValue, setPathValue } from '@/lib/diff';
import { getReleaseCardJson, listApprovedFacts, requireCard } from '@/lib/queries';
import { clearCardDownstream } from '@/lib/stage-reset';

export async function buildReleaseCard(card_id: string): Promise<{ release_card_json: string }> {
  const db = getDb();
  const card = requireCard(card_id, db);
  if (!card.research_approved_at) {
    throw new Error('Research must be approved before building the release card.');
  }
  const facts = listApprovedFacts(card_id, db);
  const releaseCard = await buildReleaseCardFromFacts(card, facts);
  const releaseCardJson = JSON.stringify(releaseCard, null, 2);
  const updatedAt = nowIso();

  writeTx(db, () => {
    clearCardDownstream(db, card_id);
    db.prepare('DELETE FROM release_card_edits WHERE card_id = ?').run(card_id);
    db.prepare(
      `INSERT INTO release_cards (card_id, release_card_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(card_id) DO UPDATE SET
         release_card_json = excluded.release_card_json,
         updated_at = excluded.updated_at`,
    ).run(card_id, releaseCardJson, updatedAt);
    db.prepare(
      `UPDATE cards
       SET card_approved_at = NULL, ship_at = NULL, status = 'in-progress'
       WHERE id = ?`,
    ).run(card_id);
  });

  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { release_card_json: releaseCardJson };
}

export async function editReleaseCard(
  card_id: string,
  edits: { field_path: string; new_value: string }[],
): Promise<{ release_card_json: string }> {
  const db = getDb();
  requireCard(card_id, db);
  const currentJson = getReleaseCardJson(card_id, db);
  if (!currentJson) throw new Error('No release card exists for this card yet.');

  const current = JSON.parse(currentJson);
  const next = structuredClone(current);
  const editedAt = nowIso();
  const rows: Array<{
    field_path: string;
    before_value: string;
    after_value: string;
  }> = [];

  for (const edit of edits) {
    const fieldPath = normalizeReleaseCardPath(edit.field_path);
    const beforeValue = getPathValue(next, fieldPath);
    const afterValue = coerceNewValue(edit.new_value, beforeValue);
    if (stringify(beforeValue) === stringify(afterValue)) continue;
    setPathValue(next, fieldPath, afterValue);
    rows.push({
      field_path: fieldPath,
      before_value: stringify(beforeValue),
      after_value: stringify(afterValue),
    });
  }

  const parsed = parseReleaseCard(next);
  const nextJson = JSON.stringify(parsed, null, 2);
  if (rows.length > 0) {
    writeTx(db, () => {
      clearCardDownstream(db, card_id);
      for (const row of rows) {
        db.prepare(
          `INSERT INTO release_card_edits
             (id, card_id, field_path, before_value, after_value, edited_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(newId(), card_id, row.field_path, row.before_value, row.after_value, editedAt);
      }
      db.prepare('UPDATE release_cards SET release_card_json = ?, updated_at = ? WHERE card_id = ?').run(
        nextJson,
        editedAt,
        card_id,
      );
      db.prepare(
        `UPDATE cards
         SET card_approved_at = NULL, ship_at = NULL, status = 'in-progress'
         WHERE id = ?`,
      ).run(card_id);
    });
  }

  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { release_card_json: nextJson };
}

export async function approveCard(card_id: string): Promise<{ card_approved_at: string }> {
  const db = getDb();
  const card = requireCard(card_id, db);
  if (!card.research_approved_at) {
    throw new Error('Research must be approved before the release card can be approved.');
  }
  const releaseCardJson = getReleaseCardJson(card_id, db);
  if (!releaseCardJson) throw new Error('Build a release card before approving the card stage.');
  parseReleaseCard(JSON.parse(releaseCardJson));

  const approvedAt = nowIso();
  writeTx(db, () => {
    clearCardDownstream(db, card_id);
    db.prepare(
      `UPDATE cards
       SET card_approved_at = ?, ship_at = NULL, status = 'in-progress'
       WHERE id = ?`,
    ).run(approvedAt, card_id);
  });
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { card_approved_at: approvedAt };
}

function normalizeReleaseCardPath(path: string): string {
  return path.startsWith('release_card.') ? path.slice('release_card.'.length) : path;
}

function coerceNewValue(raw: string, beforeValue: unknown): unknown {
  if (typeof beforeValue === 'number') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new Error(`Expected numeric value, got "${raw}"`);
    return parsed;
  }
  if (typeof beforeValue === 'boolean') return raw === 'true';
  if (Array.isArray(beforeValue) || (typeof beforeValue === 'object' && beforeValue !== null)) {
    return JSON.parse(raw);
  }
  return raw;
}

function stringify(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
