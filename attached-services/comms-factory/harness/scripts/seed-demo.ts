/**
 * Seed the harness DB with the Phase-1 mock fixtures via the real DB layer.
 * Used to render the redesigned surfaces against real query paths (not mocks)
 * for screenshot verification. Idempotent: clears + reinserts the demo cards.
 *
 *   pnpm tsx scripts/seed-demo.ts
 */
import { getDb, nowIso } from '../lib/db';
import {
  MOCK_CARDS,
  MOCK_FACTS,
  MOCK_CANDIDATES,
  MOCK_RELEASE_CARD_JSON,
  MOCK_AGREEMENT,
} from '../lib/mock-data';

const db = getDb();

const insertCard = db.prepare(
  `INSERT OR REPLACE INTO cards
   (id, voice, brief, status, created_at, completed_at, research_approved_at, card_approved_at, ship_at)
   VALUES (@id,@voice,@brief,@status,@created_at,@completed_at,@research_approved_at,@card_approved_at,@ship_at)`,
);
const insertFact = db.prepare(
  `INSERT OR REPLACE INTO facts
   (id, card_id, category, claim, value, source, source_ref, confidence, verified_at, status, rejection_reason, created_by)
   VALUES (@id,@card_id,@category,@claim,@value,@source,@source_ref,@confidence,@verified_at,@status,@rejection_reason,@created_by)`,
);
const insertReleaseCard = db.prepare(
  `INSERT OR REPLACE INTO release_cards (card_id, release_card_json, updated_at) VALUES (?,?,?)`,
);
const insertCandidate = db.prepare(
  `INSERT OR REPLACE INTO candidates
   (id, card_id, channel, attempt, text, structured_json, declared_beats_json, beat_audit_json,
    validation_passed, validation_failures_json, rationale, source, prompt_variant, created_at)
   VALUES (@id,@card_id,@channel,@attempt,@text,@structured_json,@declared_beats_json,@beat_audit_json,
    @validation_passed,@validation_failures_json,@rationale,@source,@prompt_variant,@created_at)`,
);
const insertAgreement = db.prepare(
  `INSERT OR REPLACE INTO agreement_snapshots
   (id, snapshot_at, window_days, voice, stage, beat_name, fact_source, agreement_rate, sample_size, approved_as_is, edited, rejected)
   VALUES (@id,@snapshot_at,@window_days,@voice,@stage,@beat_name,@fact_source,@agreement_rate,@sample_size,@approved_as_is,@edited,@rejected)`,
);
const insertPipelineRun = db.prepare(
  `INSERT OR REPLACE INTO pipeline_runs (id, card_id, pipeline_id, pipeline_label, entrypoint, proof_json, proof_passed, created_at)
   VALUES (?,?,?,?,?,?,?,?)`,
);
const insertRunEvent = db.prepare(
  `INSERT OR REPLACE INTO actor_run_events (id, card_id, run_id, attempt, channel, event_type, message, payload_json, created_at)
   VALUES (@id,@card_id,@run_id,@attempt,@channel,@event_type,@message,@payload_json,@created_at)`,
);

// Demonstrate the flow-direction A/B variant (prompt_variant) on the X-thread candidate.
const FLOW_VARIANT: Record<string, string> = {
  'cand-x-1': 'inwards-out',
  'cand-x-2': 'outwards-in',
};

db.transaction(() => {
  for (const c of MOCK_CARDS) insertCard.run(c);
  for (const f of MOCK_FACTS) insertFact.run({ ...f, confidence: f.confidence });
  insertReleaseCard.run(MOCK_CARDS[0].id, MOCK_RELEASE_CARD_JSON, nowIso());
  for (const cand of MOCK_CANDIDATES) {
    insertCandidate.run({
      ...cand,
      prompt_variant: FLOW_VARIANT[cand.id] ?? cand.prompt_variant,
      validation_passed: cand.validation_passed ? 1 : 0,
    });
  }

  // Demo run-event trace including the new fact-request back-edge event types,
  // so the Debug surface shows them (rendered generically).
  const runId = 'run-demo-events-1';
  const events: Array<[string, string, string, Record<string, unknown>]> = [
    ['run_started', 'actor', 'Actor/Director run started', { channels: ['x-thread', 'web', 'in-product'] }],
    ['actor_started', 'actor', 'Actor table-work + draft (inwards-out)', { flow_direction: 'inwards-out' }],
    ['fact_requests_collected', 'actor', 'Actor emitted 2 fact_requests', { fact_requests: ['24h spot volume', 'market count'] }],
    ['fact_requests_answered', 'grounder', 'Grounder answered 2/2 fact_requests', { answered: 2 }],
    ['fact_request_grounding_error', 'grounder', 'One source timed out (retried)', { source: 'partner-registry' }],
    ['fact_requests_unanswered', 'actor', '0 fact_requests left unanswered', { unanswered: 0 }],
    ['director_started', 'director', 'Director blind audit', {}],
    ['director_completed', 'director', 'Director passed 42/42', { passed: true }],
    ['run_completed', 'ship', 'Run completed — awaiting human ship gate', {}],
  ];
  events.forEach(([event_type, channel, message, payload], i) => {
    insertRunEvent.run({
      id: `evt-${i}`,
      card_id: MOCK_CARDS[0].id,
      run_id: runId,
      attempt: 1,
      channel: ['x-thread', 'web', 'in-product'].includes(channel) ? channel : null,
      event_type,
      message,
      payload_json: JSON.stringify(payload),
      created_at: new Date(Date.now() - (events.length - i) * 1500).toISOString(),
    });
  });
  for (const a of MOCK_AGREEMENT) insertAgreement.run({ ...a });
  insertPipelineRun.run(
    'run-demo-1',
    MOCK_CARDS[0].id,
    'pipeline-3',
    'Actor/Director split, Director blind to format, human ship gate',
    'scripts/run-actor-director-card.ts',
    JSON.stringify({
      proof_fields: [
        { key: 'flow.order', label: 'Pipeline order', passed: true, evidence: 'brief → grounder → card → Actor → validator → Director → ship' },
        { key: 'actor.director.split', label: 'Actor/Director distinct', passed: true, evidence: 'separate stages (not collapsed)' },
        { key: 'director.blind', label: 'Director blind', passed: true, evidence: 'ran blind to formatting/regex results' },
        { key: 'validator.det', label: 'Deterministic validator', passed: true, evidence: 'owns format/length/structure/slop' },
        { key: 'ship.human', label: 'Human ship gate', passed: true, evidence: 'requires human approval — no auto-post' },
      ],
    }),
    1,
    nowIso(),
  );
})();

console.log('Seeded', MOCK_CARDS.length, 'cards,', MOCK_CANDIDATES.length, 'candidates,', MOCK_AGREEMENT.length, 'agreement snapshots.');
