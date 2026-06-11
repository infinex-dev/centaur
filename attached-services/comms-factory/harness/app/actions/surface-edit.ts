'use server';

import { revalidatePath } from 'next/cache';
import { getDb, newId, nowIso, writeTx } from '@/lib/db';
import { makeTextDiff } from '@/lib/diff';
import { freshenDates, type DateChange } from '@/lib/freshen';
import { requireCandidate, requireCard } from '@/lib/queries';
import { approvePick } from './ship';

/**
 * Save an inline operator edit of one surface from the package review, and make
 * it the channel's final pick (the ship artifact). This is the lightweight
 * "polish to ship" path the operator drives from the Package tab — distinct from
 * the formal CandidateCard `edit` decision, which also re-runs the classifier to
 * capture semantic-tempo shifts. Here we keep the save snappy: capture the text
 * diff (the harness's core diff-capture deliverable) and persist the pick,
 * including the edited StructuredOutput so structured surfaces (web/carousel/
 * thread) render their edits everywhere the pick is read.
 *
 * The candidate row stays immutable — the edit is recorded as a diff against it
 * and the edited copy lives on the final pick, exactly like the existing edit
 * flow. `structuredJson` is `null` for flat-text surfaces (blog/modal/in-product/X).
 */
export async function saveSurfaceEdit(
  candidate_id: string,
  edited_text: string,
  structuredJson: string | null,
): Promise<{ pick_id: string }> {
  const db = getDb();
  const candidate = requireCandidate(candidate_id, db);
  requireCard(candidate.card_id, db);

  const text = edited_text.trim();
  if (!text) throw new Error('Edited text cannot be empty.');

  const editedAt = nowIso();
  const textDiff = makeTextDiff(candidate.text, text, editedAt);

  writeTx(db, () => {
    db.prepare(
      `INSERT INTO candidate_decisions
         (id, candidate_id, action, edited_text, retry_feedback, rejection_reason, decided_at)
       VALUES (?, ?, 'edit', ?, NULL, NULL, ?)`,
    ).run(newId(), candidate_id, text, editedAt);

    if (textDiff) {
      db.prepare(
        `INSERT INTO candidate_text_edits
           (id, candidate_id, before_text, after_text, word_diff_json, edited_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(newId(), candidate_id, textDiff.before_text, textDiff.after_text, textDiff.word_diff_json, textDiff.edited_at);
    }
  });

  const result = await approvePick(candidate_id, text, structuredJson);
  revalidatePath(`/cards/${candidate.card_id}`);
  revalidatePath('/');
  return result;
}

/**
 * Freshen dates on a surface before publishing — deterministic, so a stale
 * publish date can't sneak through. Anchors on the `date:` front-matter and bumps
 * it (and any verbatim echo) to today; leaves genuine historical dates alone.
 * Saves the result as the pick (capturing the diff) and returns what changed so
 * the operator can see it — nothing happens silently.
 */
export async function freshenSurface(candidate_id: string): Promise<{ changes: DateChange[] }> {
  const db = getDb();
  const candidate = requireCandidate(candidate_id, db);
  requireCard(candidate.card_id, db);

  const pick = db
    .prepare('SELECT final_text, final_structured_json FROM final_picks WHERE card_id = ? AND channel = ?')
    .get(candidate.card_id, candidate.channel) as { final_text: string; final_structured_json: string | null } | undefined;
  const text = pick?.final_text ?? candidate.text;
  const structuredJson = pick?.final_structured_json ?? candidate.structured_json;

  const today = new Date().toISOString().slice(0, 10);
  const { text: fresh, changes } = freshenDates(text, today);
  if (changes.length === 0) return { changes: [] };

  await saveSurfaceEdit(candidate_id, fresh, structuredJson);
  return { changes };
}
