'use server';

import { getDb, newId, nowIso } from '@/lib/db';
import { requireCandidate, requireCard } from '@/lib/queries';
import { appendOperatorFacts } from '@/lib/reground';
import { startSurfaceHandback } from './generate';
import type { Channel, HarnessActorRun } from '@/lib/types';

function ensureHandbackPromptsTable(db: ReturnType<typeof getDb>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS handback_prompts (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      reground_prompt TEXT,
      regenerate_prompt TEXT,
      scope TEXT,
      run_id TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_handback_prompts_card_channel ON handback_prompts(card_id, channel, created_at DESC);
  `);
}

function recordHandbackPrompt(
  db: ReturnType<typeof getDb>,
  cardId: string,
  channel: Channel,
  reground: string | null,
  regenerate: string | null,
  scope: string,
  status: 'saved' | 'submitted',
  runId: string | null,
): string {
  ensureHandbackPromptsTable(db);
  const id = newId();
  db.prepare(
    `INSERT INTO handback_prompts (id, card_id, channel, reground_prompt, regenerate_prompt, scope, run_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, cardId, channel, reground, regenerate, scope, runId, status, nowIso());
  return id;
}

/**
 * Save the operator's in-progress handback prompts as a durable draft, independent
 * of any run. Called on blur so a prompt is recorded server-side even if it's never
 * submitted (and the modal is later lost to a reload/hot-reload). No-op for empty input.
 */
export async function saveHandbackPromptDraft(
  card_id: string,
  channel: Channel,
  reground_prompt: string,
  regenerate_prompt: string,
  scope: string,
): Promise<void> {
  if (!reground_prompt.trim() && !regenerate_prompt.trim()) return;
  const db = getDb();
  recordHandbackPrompt(
    db,
    card_id,
    channel,
    reground_prompt.trim() || null,
    regenerate_prompt.trim() || null,
    scope,
    'saved',
    null,
  );
}

export interface RegenerateSurfaceOpts {
  /** Research before rewriting — the operator's question(s) for the grounder. */
  reground?: { prompt: string };
  /** Rewrite with the actor — the operator's steering notes. */
  regenerate?: { prompt: string };
  /** 'block' splices the actor's fill into the operator's copy (toggle stubs);
   *  'whole' replaces the surface. */
  scope: 'block' | 'whole';
}

/**
 * Operator handback for one surface. Resolves the seed (the operator's EDITED pick)
 * and hands off to the streaming handback job (grounder → actor → director), which
 * returns the run immediately so the UI can show live progress. The regenerated
 * candidate is a new attempt the operator reviews/picks — it never overwrites the
 * hand-edit (preserved as the captured diff + the seed). Grounded facts are tagged
 * "verify before ship"; the operator vouches at ship.
 */
export async function regenerateSurface(
  card_id: string,
  channel: Channel,
  candidate_id: string,
  opts: RegenerateSurfaceOpts,
): Promise<{ run: HarnessActorRun; existing: boolean }> {
  if (!opts.reground && !opts.regenerate) {
    throw new Error('Tick reground, regenerate, or both.');
  }
  const db = getDb();
  requireCard(card_id, db);
  const candidate = requireCandidate(candidate_id, db);

  // Seed from the operator's EDITED pick (the markdown they polished, incl. any
  // stubbed toggle), not the original candidate.
  const pick = db
    .prepare('SELECT final_text FROM final_picks WHERE card_id = ? AND channel = ?')
    .get(card_id, channel) as { final_text: string } | undefined;
  const priorDraft = pick?.final_text ?? candidate.text;

  // Record the prompt BEFORE kicking the run, so it survives even if the run fails
  // to start. This is the durable record — the prompt is never lost to a bad run.
  const promptId = recordHandbackPrompt(
    db,
    card_id,
    channel,
    opts.reground?.prompt.trim() || null,
    opts.regenerate?.prompt.trim() || null,
    opts.scope,
    'submitted',
    null,
  );

  const result = await startSurfaceHandback({
    cardId: card_id,
    channel,
    candidateAttempt: candidate.attempt,
    priorDraft,
    ...(opts.reground?.prompt.trim() ? { regroundPrompt: opts.reground.prompt } : {}),
    ...(opts.regenerate?.prompt.trim() ? { regeneratePrompt: opts.regenerate.prompt } : {}),
    scope: opts.scope,
  });

  db.prepare('UPDATE handback_prompts SET run_id = ? WHERE id = ?').run(result.run.id, promptId);
  return result;
}

/**
 * Resume a handback that the reground gate halted. The operator either vouches the
 * facts the grounder couldn't verify (the "I know this is true" path → they enter
 * deployed_facts as operator-sourced) or proceeds without them. Then the actor runs
 * (no reground — the facts question is already resolved).
 */
export async function continueHandback(
  card_id: string,
  channel: Channel,
  candidate_id: string,
  opts: { vouchedFacts: string[]; regeneratePrompt: string; scope: 'block' | 'whole' },
): Promise<{ run: HarnessActorRun; existing: boolean; vouched: number }> {
  const db = getDb();
  requireCard(card_id, db);
  const candidate = requireCandidate(candidate_id, db);

  const vouched = appendOperatorFacts(card_id, opts.vouchedFacts);

  const pick = db
    .prepare('SELECT final_text FROM final_picks WHERE card_id = ? AND channel = ?')
    .get(card_id, channel) as { final_text: string } | undefined;
  const priorDraft = pick?.final_text ?? candidate.text;

  recordHandbackPrompt(db, card_id, channel, null, opts.regeneratePrompt.trim() || null, opts.scope, 'submitted', null);

  const result = await startSurfaceHandback({
    cardId: card_id,
    channel,
    candidateAttempt: candidate.attempt,
    priorDraft,
    regeneratePrompt: opts.regeneratePrompt,
    scope: opts.scope,
  });
  return { ...result, vouched };
}
