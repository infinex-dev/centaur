/**
 * Operator-reground: ground a focused question, record the facts (pending, for the
 * research tab), and append them to the card's deployed_facts so the actor may
 * assert them. Used by the surface-handback job (app/actions/generate.ts). Plain
 * lib (not a server action) so the detached job can call it without a circular
 * import through the action layer.
 *
 * Deliberately does NOT clear downstream (cf. editReleaseCard) — the operator's
 * pick is the regen seed and must survive.
 */

import { groundFacts, type GrounderTraceEvent, type VerifiedFact } from '@pipeline/fact-grounder-llm';
import { parseReleaseCard, type DeployedFact } from '@pipeline/card';
import { getDb, newId, nowIso, writeTx } from '@/lib/db';
import { getReleaseCardJson, listApprovedApiHosts } from '@/lib/queries';

export interface RegroundResult {
  verified: number;
  unverifiable: { claim: string; reason: string }[];
}

export async function regroundCard(
  cardId: string,
  prompt: string,
  onEvent?: (event: GrounderTraceEvent) => void,
): Promise<RegroundResult> {
  const db = getDb();
  const approvedHosts = listApprovedApiHosts(db).map((h) => h.host);
  const grounded = await groundFacts(prompt, {
    surface: 'handback-reground',
    job: 'operator-reground',
    approvedHosts,
    ...(onEvent ? { on_event: onEvent } : {}),
  });

  const unverifiable = (grounded.unverifiable ?? []).map((u) => ({ claim: u.claim, reason: u.reason }));

  if (grounded.facts.length > 0) {
    const releaseCardJson = getReleaseCardJson(cardId, db);
    if (!releaseCardJson) throw new Error('No release card exists for this card.');
    writeTx(db, () => {
      for (const fact of grounded.facts) insertGroundedFact(db, cardId, fact);
      persistApprovalRequests(db, cardId, grounded.approval_requests ?? []);

      const rc = JSON.parse(releaseCardJson) as { deployed_facts?: DeployedFact[] };
      rc.deployed_facts = [...(rc.deployed_facts ?? []), ...grounded.facts.map(toDeployedFact)];
      const parsed = parseReleaseCard(rc);
      db.prepare('UPDATE release_cards SET release_card_json = ?, updated_at = ? WHERE card_id = ?').run(
        JSON.stringify(parsed, null, 2),
        nowIso(),
        cardId,
      );
    });
  }

  return { verified: grounded.facts.length, unverifiable };
}

export interface AskGrounderResult extends RegroundResult {
  run_id: string;
}

/** Operator "ask the grounder" from the card page: ground a focused question,
 * record a grounder_run row (so the existing trace UI shows live progress),
 * insert verified facts as pending rows for review, and — when a release card
 * already exists — append them to deployed_facts like the handback reground. */
export async function askGrounder(
  cardId: string,
  prompt: string,
  onEvent?: (event: GrounderTraceEvent) => void,
): Promise<AskGrounderResult> {
  const db = getDb();
  const runId = newId();
  const events: Array<GrounderTraceEvent & { at: string }> = [];
  db.prepare(
    `INSERT INTO grounder_runs (id, card_id, started_at, facts_count, unverifiable_count, truncated, events_json)
     VALUES (?, ?, ?, 0, 0, 0, '[]')`,
  ).run(runId, cardId, nowIso());
  const persistEvents = () => {
    db.prepare('UPDATE grounder_runs SET events_json = ? WHERE id = ?').run(JSON.stringify(events), runId);
  };

  const approvedHosts = listApprovedApiHosts(db).map((h) => h.host);
  let grounded: Awaited<ReturnType<typeof groundFacts>>;
  try {
    grounded = await groundFacts(prompt, {
      surface: 'training-harness',
      job: 'operator-ask',
      approvedHosts,
      on_event: (event) => {
        events.push({ ...event, at: nowIso() });
        persistEvents();
        onEvent?.(event);
      },
    });
  } catch (err) {
    db.prepare('UPDATE grounder_runs SET completed_at = ?, events_json = ?, error = ? WHERE id = ?').run(
      nowIso(),
      JSON.stringify(events),
      err instanceof Error ? err.message : String(err),
      runId,
    );
    throw err;
  }

  const unverifiable = (grounded.unverifiable ?? []).map((u) => ({ claim: u.claim, reason: u.reason }));
  const releaseCardJson = getReleaseCardJson(cardId, db);
  writeTx(db, () => {
    for (const fact of grounded.facts) insertGroundedFact(db, cardId, fact);
    persistApprovalRequests(db, cardId, grounded.approval_requests ?? []);
    if (releaseCardJson && grounded.facts.length > 0) {
      const rc = JSON.parse(releaseCardJson) as { deployed_facts?: DeployedFact[] };
      rc.deployed_facts = [...(rc.deployed_facts ?? []), ...grounded.facts.map(toDeployedFact)];
      const parsed = parseReleaseCard(rc);
      db.prepare('UPDATE release_cards SET release_card_json = ?, updated_at = ? WHERE card_id = ?').run(
        JSON.stringify(parsed, null, 2),
        nowIso(),
        cardId,
      );
    }
    db.prepare(
      `UPDATE grounder_runs
       SET completed_at = ?, model = ?, ground_turns = ?, facts_count = ?,
           unverifiable_count = ?, truncated = ?, events_json = ?, error = NULL
       WHERE id = ?`,
    ).run(
      nowIso(),
      grounded.model,
      grounded.ground_turns,
      grounded.facts.length,
      unverifiable.length,
      grounded.truncated ? 1 : 0,
      JSON.stringify(events),
      runId,
    );
  });

  return { verified: grounded.facts.length, unverifiable, run_id: runId };
}

/** Append operator-vouched facts (the "I know this is true" path) to the card's
 * deployed_facts, so the actor may assert them after the grounder couldn't. */
export function appendOperatorFacts(cardId: string, facts: string[]): number {
  const clean = facts.map((f) => f.trim()).filter(Boolean);
  if (clean.length === 0) return 0;
  const db = getDb();
  const releaseCardJson = getReleaseCardJson(cardId, db);
  if (!releaseCardJson) throw new Error('No release card exists for this card.');
  writeTx(db, () => {
    for (const claim of clean) {
      db.prepare(
        `INSERT INTO facts
           (id, card_id, category, claim, value, source, source_ref, confidence, verified_at, status, rejection_reason, created_by)
         VALUES (?, ?, 'capability', ?, ?, 'operator-vouched', 'operator', 1, ?, 'manual', NULL, 'operator')`,
      ).run(newId(), cardId, claim, claim, nowIso());
    }
    const rc = JSON.parse(releaseCardJson) as { deployed_facts?: DeployedFact[] };
    rc.deployed_facts = [
      ...(rc.deployed_facts ?? []),
      ...clean.map((claim): DeployedFact => ({ claim, basis: 'operator-vouched; confirmed by operator' })),
    ];
    const parsed = parseReleaseCard(rc);
    db.prepare('UPDATE release_cards SET release_card_json = ?, updated_at = ? WHERE card_id = ?').run(
      JSON.stringify(parsed, null, 2),
      nowIso(),
      cardId,
    );
  });
  return clean.length;
}

function toDeployedFact(fact: VerifiedFact): DeployedFact {
  const claim = `${fact.claim}: ${fact.value}`;
  if (fact.category === 'number') {
    return { claim, basis: `grounded value; verify before ship (confidence ${fact.confidence.toFixed(2)})` };
  }
  return claim;
}

function insertGroundedFact(db: ReturnType<typeof getDb>, cardId: string, fact: VerifiedFact): void {
  db.prepare(
    `INSERT INTO facts
       (id, card_id, category, claim, value, source, source_ref, confidence, verified_at, status, rejection_reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, 'grounder')`,
  ).run(
    newId(),
    cardId,
    fact.category,
    fact.claim,
    fact.value,
    fact.source,
    fact.source_ref,
    fact.confidence,
    fact.verified_at,
  );
}

function persistApprovalRequests(
  db: ReturnType<typeof getDb>,
  cardId: string,
  requests: { host: string; url: string; reason: string }[],
): void {
  for (const req of requests) {
    if (db.prepare('SELECT 1 FROM approved_api_hosts WHERE host = ?').get(req.host)) continue;
    if (db.prepare("SELECT 1 FROM pending_api_requests WHERE card_id = ? AND host = ? AND status = 'pending'").get(cardId, req.host))
      continue;
    db.prepare(
      `INSERT INTO pending_api_requests (id, card_id, host, url, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(newId(), cardId, req.host, req.url, req.reason, nowIso());
  }
}

export function grounderEventMessage(event: GrounderTraceEvent): string {
  const e = event as { name?: string; content_preview?: string; type: string };
  return e.name ?? e.content_preview ?? e.type;
}
