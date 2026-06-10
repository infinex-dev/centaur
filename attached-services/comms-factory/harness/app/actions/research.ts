'use server';

import { revalidatePath } from 'next/cache';
import { groundFacts, discoverSources, fetchRef, extractFeatureSubject, type GrounderTraceEvent, type VerifiedFact } from '@pipeline/fact-grounder-llm';
import { centaurResearchExecutorFromEnv, hasCentaurResearchEnv } from '@pipeline/centaur-research';
import { getDb, newId, nowIso, writeTx } from '@/lib/db';
import { listApprovedApiHosts, listApprovedFacts, requireCard, requireFact } from '@/lib/queries';
import { makeFieldDiff } from '@/lib/diff';
import { clearResearchDownstream } from '@/lib/stage-reset';
import type { FactDecision, HarnessFact, VoiceName } from '@/lib/types';

const FACT_EDIT_FIELDS = ['claim', 'value', 'source_ref', 'confidence', 'category'] as const;
type FactEditField = (typeof FACT_EDIT_FIELDS)[number];

export async function createCard(brief: string, voice: VoiceName): Promise<{ card_id: string }> {
  const trimmedBrief = brief.trim();
  if (!trimmedBrief) throw new Error('Brief is required.');
  const db = getDb();
  const id = newId();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO cards (id, voice, brief, status, created_at)
     VALUES (?, ?, ?, 'in-progress', ?)`,
  ).run(id, voice, trimmedBrief, createdAt);
  revalidatePath('/');
  return { card_id: id };
}

export async function runGrounder(
  card_id: string,
  opts?: { stream?: boolean },
): Promise<{ facts: HarnessFact[]; unverifiable: { claim: string; reason: string }[] }> {
  if (opts?.stream) {
    throw new Error('Grounder streaming is not implemented in Phase 3 MVP; call runGrounder without stream.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required to run the fact grounder in the harness.');
  }

  const db = getDb();
  const card = requireCard(card_id, db);
  const runId = newId();
  const startedAt = nowIso();
  const events: Array<GrounderTraceEvent & { at: string }> = [];
  db.prepare(
    `INSERT INTO grounder_runs
       (id, card_id, started_at, facts_count, unverifiable_count, truncated, events_json)
     VALUES (?, ?, ?, 0, 0, 0, '[]')`,
  ).run(runId, card_id, startedAt);

  const persistEvents = () => {
    db.prepare('UPDATE grounder_runs SET events_json = ? WHERE id = ?').run(
      JSON.stringify(events),
      runId,
    );
  };

  const useCentaurResearch = hasCentaurResearchEnv();
  if (process.env.NODE_ENV === 'production' && !useCentaurResearch) {
    throw new Error('CENTAUR_BASE_URL and CENTAUR_TOKEN are required for production grounding. Local branch discovery is dev-only.');
  }

  // Source-of-truth discovery is dev-only fallback. In capability mode, Centaur
  // owns repo/ref discovery and execution; the harness must not shell out to gh/git.
  let ref: string | undefined;
  if (!useCentaurResearch) {
    const query = await extractFeatureSubject(card.brief);
    if (query) {
      try {
        const discovery = await discoverSources(query);
        events.push({ type: 'tool_call', turn: 0, name: 'discover_sources', input: { query }, at: nowIso() });
        const primary = discovery.primary;
        if (primary && primary.number) {
          try {
            ref = await fetchRef(primary.branch, { repo: discovery.repo });
            events.push({
              type: 'tool_result', turn: 0, name: 'discover_sources',
              content_preview: `grounding against ${ref} — #${primary.number} "${primary.title}" (${primary.status}, score ${primary.score})`,
              at: nowIso(),
            });
          } catch (fetchErr) {
            // Merged PRs often have their head branch deleted, so the fetch fails.
            // Fall through to the fresh-main fetch below, never the stale local tree.
            events.push({
              type: 'tool_result', turn: 0, name: 'discover_sources',
              content_preview: `branch "${primary.branch}" unavailable (${errorMessage(fetchErr)}) — likely merged + deleted; grounding fresh origin/main`,
              at: nowIso(),
            });
          }
        } else {
          events.push({
            type: 'tool_result', turn: 0, name: 'discover_sources',
            content_preview: `no open ship-bound branch for "${query}" (may be merged); grounding fresh origin/main`,
            at: nowIso(),
          });
        }
        persistEvents();
      } catch (err) {
        events.push({
          type: 'tool_result', turn: 0, name: 'discover_sources',
          content_preview: `discovery skipped (${errorMessage(err)}); grounding fresh origin/main`,
          at: nowIso(),
        });
        persistEvents();
      }
    }

    // Always ground against a FRESHLY FETCHED ref, never the local working tree.
    // When no feature branch resolved (no PR, or a merged PR's head branch was
    // deleted), fetch origin/main so code merged to main is current regardless of
    // the local clone's checkout/dirty state. Only a fetch failure falls back to local.
    if (!ref) {
      try {
        ref = await fetchRef('main');
        events.push({
          type: 'tool_result', turn: 0, name: 'discover_sources',
          content_preview: `grounding against freshly fetched origin/main (${ref})`,
          at: nowIso(),
        });
      } catch (err) {
        events.push({
          type: 'tool_result', turn: 0, name: 'discover_sources',
          content_preview: `could not fetch origin/main (${errorMessage(err)}); grounding local working tree`,
          at: nowIso(),
        });
      }
      persistEvents();
    }
  }

  let result: Awaited<ReturnType<typeof groundFacts>>;
  const approvedHosts = listApprovedApiHosts(db).map((h) => h.host);
  try {
    const researchExecutor = useCentaurResearch
      ? centaurResearchExecutorFromEnv({ job_id: runId, stage: 'harness-research' })
      : undefined;
    result = await groundFacts(card.brief, {
      surface: 'training-harness',
      job: 'research-stage',
      ...(ref ? { ref } : {}),
      approvedHosts,
      ...(researchExecutor ? { tool_executor: (name, input, id, scopedRef) => researchExecutor.execute(name, input, id, { ref: scopedRef }) } : {}),
      on_event: (event) => {
        events.push({ ...event, at: nowIso() });
        persistEvents();
      },
    });
  } catch (err) {
    const completedAt = nowIso();
    db.prepare(
      `UPDATE grounder_runs
       SET completed_at = ?, events_json = ?, error = ?
       WHERE id = ?`,
    ).run(completedAt, JSON.stringify(events), errorMessage(err), runId);
    throw err;
  }

  const completedAt = nowIso();
  if (result.facts.length === 0 && result.unverifiable.length === 0) {
    db.prepare(
      `UPDATE grounder_runs
       SET completed_at = ?, model = ?, ground_turns = ?, facts_count = 0,
           unverifiable_count = 0, truncated = ?, events_json = ?, error = ?
       WHERE id = ?`,
    ).run(
      completedAt,
      result.model,
      result.ground_turns,
      result.truncated ? 1 : 0,
      JSON.stringify(events),
      'Grounder completed without recording any facts or unverifiable claims.',
      runId,
    );
    throw new Error('Grounder completed without recording any facts or unverifiable claims. Check the grounder trace.');
  }

  const inserted = writeTx(db, () => {
    const facts = result.facts.map((fact) => insertFact(db, card_id, fact, 'pending', 'grounder'));
    persistApprovalRequests(db, card_id, result.approval_requests ?? []);
    db.prepare(
      `UPDATE grounder_runs
       SET completed_at = ?, model = ?, ground_turns = ?, facts_count = ?,
           unverifiable_count = ?, truncated = ?, events_json = ?, error = NULL
       WHERE id = ?`,
    ).run(
      completedAt,
      result.model,
      result.ground_turns,
      result.facts.length,
      result.unverifiable.length,
      result.truncated ? 1 : 0,
      JSON.stringify(events),
      runId,
    );
    return facts;
  });

  revalidatePath('/');
  revalidatePath(`/cards/${card_id}`);
  return { facts: inserted, unverifiable: result.unverifiable };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Persist the grounder's blocked API calls as pending approvals. One open row per
// (card, host): skip if this host is already approved or already pending for the card.
function persistApprovalRequests(
  db: ReturnType<typeof getDb>,
  cardId: string,
  requests: { host: string; url: string; reason: string }[],
): void {
  for (const req of requests) {
    const approved = db.prepare('SELECT 1 FROM approved_api_hosts WHERE host = ?').get(req.host);
    if (approved) continue;
    const open = db
      .prepare("SELECT 1 FROM pending_api_requests WHERE card_id = ? AND host = ? AND status = 'pending'")
      .get(cardId, req.host);
    if (open) continue;
    db.prepare(
      `INSERT INTO pending_api_requests (id, card_id, host, url, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(newId(), cardId, req.host, req.url, req.reason, nowIso());
  }
}

export async function decideFact(
  fact_id: string,
  action: FactDecision,
  edits?: Partial<HarnessFact>,
): Promise<{ status: HarnessFact['status'] }> {
  const db = getDb();
  const fact = requireFact(fact_id, db);
  const editedAt = nowIso();

  const status = writeTx(db, () => {
    if (action === 'approve') {
      db.prepare("UPDATE facts SET status = 'approved', rejection_reason = NULL WHERE id = ?").run(fact_id);
      return 'approved' as const;
    }

    if (action === 'reject') {
      db.prepare(
        "UPDATE facts SET status = 'rejected', rejection_reason = ? WHERE id = ?",
      ).run(edits?.rejection_reason ?? null, fact_id);
      return 'rejected' as const;
    }

    const next = { ...fact, ...edits };
    const changed: FactEditField[] = [];
    for (const field of FACT_EDIT_FIELDS) {
      const diff = makeFieldDiff(field, fact[field], next[field], editedAt);
      if (!diff) continue;
      changed.push(field);
      db.prepare(
        `INSERT INTO fact_edits (id, fact_id, field, before_value, after_value, edited_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(newId(), fact_id, field, diff.before_value, diff.after_value, diff.edited_at);
    }

    if (changed.length === 0) return fact.status;

    db.prepare(
      `UPDATE facts
       SET category = ?, claim = ?, value = ?, source_ref = ?, confidence = ?,
           status = 'edited', rejection_reason = NULL
       WHERE id = ?`,
    ).run(next.category, next.claim, next.value, next.source_ref, next.confidence, fact_id);
    return 'edited' as const;
  });

  revalidatePath(`/cards/${fact.card_id}`);
  revalidatePath('/');
  return { status };
}

export async function addManualFact(
  card_id: string,
  fact: Omit<HarnessFact, 'id' | 'card_id' | 'status' | 'created_by' | 'verified_at'>,
): Promise<{ fact_id: string }> {
  const db = getDb();
  requireCard(card_id, db);
  const id = newId();
  const verifiedAt = nowIso();
  db.prepare(
    `INSERT INTO facts
       (id, card_id, category, claim, value, source, source_ref, confidence, verified_at, status, rejection_reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, 'operator')`,
  ).run(
    id,
    card_id,
    fact.category,
    fact.claim,
    fact.value,
    fact.source,
    fact.source_ref,
    fact.confidence,
    verifiedAt,
    fact.rejection_reason ?? null,
  );
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { fact_id: id };
}

export async function approveResearch(card_id: string): Promise<{ research_approved_at: string }> {
  const db = getDb();
  requireCard(card_id, db);
  const approvedFacts = listApprovedFacts(card_id, db);
  if (approvedFacts.length === 0) {
    throw new Error('Research stage requires at least one approved, edited, or manual fact.');
  }
  const approvedAt = nowIso();
  writeTx(db, () => {
    clearResearchDownstream(db, card_id);
    db.prepare(
      `UPDATE cards
       SET research_approved_at = ?, card_approved_at = NULL, ship_at = NULL, status = 'in-progress'
       WHERE id = ?`,
    ).run(approvedAt, card_id);
  });
  revalidatePath(`/cards/${card_id}`);
  revalidatePath('/');
  return { research_approved_at: approvedAt };
}

function insertFact(
  db: ReturnType<typeof getDb>,
  cardId: string,
  fact: VerifiedFact,
  status: HarnessFact['status'],
  createdBy: HarnessFact['created_by'],
): HarnessFact {
  const id = newId();
  db.prepare(
    `INSERT INTO facts
       (id, card_id, category, claim, value, source, source_ref, confidence, verified_at, status, rejection_reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    id,
    cardId,
    fact.category,
    fact.claim,
    fact.value,
    fact.source,
    fact.source_ref,
    fact.confidence,
    fact.verified_at,
    status,
    createdBy,
  );
  return {
    id,
    card_id: cardId,
    category: fact.category,
    claim: fact.claim,
    value: fact.value,
    source: fact.source,
    source_ref: fact.source_ref,
    confidence: fact.confidence,
    verified_at: fact.verified_at,
    status,
    rejection_reason: null,
    created_by: createdBy,
  };
}
