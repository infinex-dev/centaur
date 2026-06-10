'use server';

import { revalidatePath } from 'next/cache';
import { getDb, nowIso, writeTx } from '@/lib/db';

interface PendingRow {
  id: string;
  card_id: string;
  host: string;
}

function requirePendingRequest(requestId: string, db: ReturnType<typeof getDb>): PendingRow {
  const row = db
    .prepare('SELECT id, card_id, host FROM pending_api_requests WHERE id = ?')
    .get(requestId) as PendingRow | undefined;
  if (!row) throw new Error(`API approval request not found: ${requestId}`);
  return row;
}

/**
 * Approve the HOST behind a pending request. The host is trusted from now on
 * (persisted in approved_api_hosts), and every open request for that host is
 * marked approved. The grounder picks it up on the next run via approvedHosts.
 */
export async function approveApiRequest(request_id: string): Promise<{ host: string }> {
  const db = getDb();
  const req = requirePendingRequest(request_id, db);
  const at = nowIso();
  writeTx(db, () => {
    db.prepare(
      'INSERT OR IGNORE INTO approved_api_hosts (host, approved_at, approved_by) VALUES (?, ?, ?)',
    ).run(req.host, at, 'operator');
    db.prepare(
      "UPDATE pending_api_requests SET status = 'approved', resolved_at = ? WHERE host = ? AND status = 'pending'",
    ).run(at, req.host);
  });
  revalidatePath(`/cards/${req.card_id}`);
  revalidatePath('/');
  return { host: req.host };
}

/** Reject a single pending request. Does not block the host permanently — a future run may re-raise it. */
export async function rejectApiRequest(request_id: string): Promise<{ status: 'rejected' }> {
  const db = getDb();
  const req = requirePendingRequest(request_id, db);
  const at = nowIso();
  writeTx(db, () => {
    db.prepare("UPDATE pending_api_requests SET status = 'rejected', resolved_at = ? WHERE id = ?").run(at, request_id);
  });
  revalidatePath(`/cards/${req.card_id}`);
  revalidatePath('/');
  return { status: 'rejected' };
}
