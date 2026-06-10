'use server';

import { revalidatePath } from 'next/cache';
import { getDb, newId, nowIso } from '@/lib/db';
import type { OperatorFeedbackTargetType } from '@/lib/types';

export async function recordOperatorFeedback(
  card_id: string,
  target_type: OperatorFeedbackTargetType,
  target_id: string,
  feedback_text: string,
): Promise<{ id: string }> {
  const text = feedback_text.trim();
  if (!text) throw new Error('Feedback is required.');
  if (target_type !== 'actor_attempt' && target_type !== 'director_audit') {
    throw new Error(`Unsupported feedback target: ${target_type}`);
  }

  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO operator_feedback
       (id, card_id, target_type, target_id, feedback_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, card_id, target_type, target_id, text, nowIso());

  revalidatePath(`/cards/${card_id}`);
  return { id };
}
