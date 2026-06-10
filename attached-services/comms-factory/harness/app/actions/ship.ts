'use server';

import { revalidatePath } from 'next/cache';
import { getDb, newId, nowIso } from '@/lib/db';
import {
  expectedChannelsForCard,
  listPicks,
  requireCandidate,
  requireCard,
} from '@/lib/queries';

export async function approvePick(
  candidate_id: string,
  final_text?: string,
): Promise<{ pick_id: string }> {
  const db = getDb();
  const candidate = requireCandidate(candidate_id, db);
  requireCard(candidate.card_id, db);
  const existing = db
    .prepare('SELECT id FROM final_picks WHERE card_id = ? AND channel = ?')
    .get(candidate.card_id, candidate.channel) as { id: string } | undefined;
  const pickId = existing?.id ?? newId();
  const text = final_text?.trim() || candidate.text;

  if (existing) {
    db.prepare(
      `UPDATE final_picks
       SET candidate_id = ?, final_text = ?, shipped_at = NULL, shipped_to = NULL
       WHERE id = ?`,
    ).run(candidate_id, text, pickId);
  } else {
    db.prepare(
      `INSERT INTO final_picks (id, card_id, channel, candidate_id, final_text)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(pickId, candidate.card_id, candidate.channel, candidate_id, text);
  }

  revalidatePath(`/cards/${candidate.card_id}`);
  revalidatePath('/');
  return { pick_id: pickId };
}

export async function shipPick(
  pick_id: string,
  destination: 'clipboard' | 'slack' | 'x' | 'in-product',
): Promise<{ shipped_at: string; text?: string }> {
  const db = getDb();
  const pick = db.prepare('SELECT * FROM final_picks WHERE id = ?').get(pick_id) as
    | {
        id: string;
        card_id: string;
        channel: string;
        final_text: string;
      }
    | undefined;
  if (!pick) throw new Error(`Pick not found: ${pick_id}`);

  if (destination === 'slack') {
    const webhook = process.env.HARNESS_SLACK_WEBHOOK;
    if (!webhook) throw new Error('HARNESS_SLACK_WEBHOOK is required to ship to Slack.');
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `*Channel ${pick.channel}:* ${pick.final_text}` }),
    });
    if (!response.ok) throw new Error(`Slack webhook failed with HTTP ${response.status}.`);
  } else if (destination === 'x' || destination === 'in-product') {
    console.log(`[harness] ${destination} ready to ship`, {
      pick_id,
      channel: pick.channel,
      text: pick.final_text,
    });
  }

  const shippedAt = nowIso();
  db.prepare('UPDATE final_picks SET shipped_at = ?, shipped_to = ? WHERE id = ?').run(
    shippedAt,
    destination,
    pick_id,
  );
  revalidatePath(`/cards/${pick.card_id}`);
  revalidatePath('/');
  return destination === 'clipboard'
    ? { shipped_at: shippedAt, text: pick.final_text }
    : { shipped_at: shippedAt };
}

export async function abandonCard(
  card_id: string,
  reason: string,
): Promise<{ status: 'abandoned' }> {
  const db = getDb();
  requireCard(card_id, db);
  const completedAt = nowIso();
  console.log(`[harness] card abandoned: ${card_id}`, { reason });
  db.prepare(
    `UPDATE cards
     SET status = 'abandoned', completed_at = ?
     WHERE id = ?`,
  ).run(completedAt, card_id);
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { status: 'abandoned' };
}

export async function completeCard(
  card_id: string,
): Promise<{ status: 'shipped'; ship_at: string }> {
  const db = getDb();
  requireCard(card_id, db);
  const expectedChannels = expectedChannelsForCard(card_id, db);
  const picks = listPicks(card_id, db);
  const pickedChannels = new Set(picks.map((pick) => pick.channel));
  const missing = expectedChannels.filter((channel) => !pickedChannels.has(channel));
  if (missing.length > 0) {
    throw new Error(`Cannot complete card; missing final picks for: ${missing.join(', ')}`);
  }

  const shipAt = nowIso();
  db.prepare(
    `UPDATE cards
     SET status = 'shipped', ship_at = ?, completed_at = ?
     WHERE id = ?`,
  ).run(shipAt, shipAt, card_id);
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { status: 'shipped', ship_at: shipAt };
}
