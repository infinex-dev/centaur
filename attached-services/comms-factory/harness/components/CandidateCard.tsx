'use client';

/**
 * CandidateCard — one generator candidate.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { decideCandidate, retryChannel } from '@/app/actions/generate';
import { approvePick } from '@/app/actions/ship';
import { OperatorFeedbackForm } from './OperatorFeedbackForm';
import { SurfacePreview } from './design/SurfacePreview';
import { surfaceOfCandidate } from '@/lib/surfaces';
import type { HarnessCandidate, HarnessOperatorFeedback } from '@/lib/types';

interface BeatAudit {
  beat_index: number;
  declared_tempo: string;
  classified_tempo?: string;
  classified_confidence?: number;
  passed: boolean;
  reason?: string;
}

interface IndependentClassification {
  tempo: string;
  motifs?: string[];
  detected_drive?: string;
  confidence: number;
  rationale: string;
}

interface ActiveAuditLLM {
  passed: boolean;
  feedback?: string;
  notes?: string;
  voice_issues?: Array<{ line: string; rule: string; fix: string }>;
  factual_issues?: Array<{ claim: string; evidence: string; severity: string }>;
  independent_classification?: IndependentClassification;
  model?: string;
  tool?: string;
}

interface ActiveAuditTraceEvent {
  type: string;
  turn?: number;
  name?: string;
  content_preview?: string;
  input?: Record<string, unknown>;
  passed?: boolean;
  text_preview?: string;
  reason?: string;
  model?: string;
  tool_names?: string[];
}

interface ActiveAudit {
  passed: boolean;
  reason: string | null;
  active_turns: number;
  truncated?: boolean;
  llm?: ActiveAuditLLM;
  research_trace?: ActiveAuditTraceEvent[];
  deterministic?: {
    passed: boolean;
    failures: Array<{ rule: string; reason: string }>;
  };
}

interface HistoryGuardAudit {
  passed: boolean;
  failures: Array<{ rule: string; reason: string; compared_against: string[] }>;
  compared_against: string[];
}

interface DirectorAudit {
  passed: boolean;
  copy_voice_passed?: boolean;
  factual_passed?: boolean;
  publication_gate_passed?: boolean;
  primary_tempo: string;
  primary_confidence: number;
  tempo_basis?: {
    attitude_or_state?: string;
    variation_factors?: string[];
    variation_poles?: string[];
    excluded_present_poles?: string[];
    rival_two_factor_reads_considered?: Array<{
      tempo?: string;
      factor_shape?: string;
      reason_kept_or_rejected?: string;
    }>;
  };
  drive_read: string;
  placement_read: string;
  motion_evidence?: Record<string, { pole?: string; evidence?: string[]; source_refs?: string[]; reason?: string }>;
  working_actions?: Array<{ action: string; evidence: string; source_refs?: string[] }>;
  movement_receipt_fit?: { passed: boolean; issues: string[] };
  infinex_fit: {
    legal: boolean;
    reason: string;
    nearest_allowed_read?: string;
  };
  factual_issues: string[];
  publication_gate_issues?: string[];
  voice_issues: string[];
  notes_for_actor: string[];
}

export function CandidateCard({
  candidate,
  operatorFeedback = [],
}: {
  candidate: HarnessCandidate;
  operatorFeedback?: HarnessOperatorFeedback[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const beatAudit = parseJson<BeatAudit[]>(candidate.beat_audit_json, []);
  const failures = parseJson<Array<{ rule: string; reason: string }>>(
    candidate.validation_failures_json,
    [],
  );
  const activeAudit = candidate.active_audit_json
    ? parseJson<ActiveAudit | null>(candidate.active_audit_json, null)
    : null;
  const historyAudit = candidate.history_guard_json
    ? parseJson<HistoryGuardAudit | null>(candidate.history_guard_json, null)
    : null;
  const directorAudit = candidate.director_audit_json
    ? parseJson<DirectorAudit | null>(candidate.director_audit_json, null)
    : null;
  const directorFeedback = candidate.director_audit_id
    ? operatorFeedback.filter((item) =>
        item.target_type === 'director_audit' && item.target_id === candidate.director_audit_id)
    : [];
  const activeToolCalls = activeAudit?.research_trace?.filter((event) => event.type === 'tool_call') ?? [];
  const independentClassification = activeAudit?.llm?.independent_classification;
  const blindTempoFromBeats = beatAudit[0]?.classified_tempo;

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function approve() {
    run(async () => {
      await decideCandidate(candidate.id, 'approve');
      await approvePick(candidate.id);
    });
  }

  function edit() {
    const edited = window.prompt('Edit candidate text', candidate.text);
    if (!edited) return;
    run(async () => {
      await decideCandidate(candidate.id, 'edit', { edited_text: edited });
      await approvePick(candidate.id, edited);
    });
  }

  function retry() {
    const feedback = window.prompt('Retry feedback') ?? '';
    run(async () => {
      await decideCandidate(candidate.id, 'retry', { retry_feedback: feedback });
      await retryChannel(candidate.card_id, candidate.channel, feedback);
    });
  }

  function reject() {
    const reason = window.prompt('Rejection reason') ?? '';
    run(() => decideCandidate(candidate.id, 'reject', { rejection_reason: reason }));
  }

  return (
    <article className="border border-rule rounded-md bg-paper">
      <header className="flex items-center justify-between px-4 py-3 border-b border-rule">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-ink-3">attempt {candidate.attempt}</span>
          {candidate.prompt_variant && (
            <>
              <span className="text-ink-4">·</span>
              <span className="text-ink px-1.5 py-0.5 rounded bg-canvas border border-rule">
                {candidate.prompt_variant}
              </span>
            </>
          )}
          <span className="text-ink-4">·</span>
          <span className={candidate.validation_passed ? 'text-state-approved' : 'text-state-rejected'}>
            regex {candidate.validation_passed ? 'pass' : 'fail'}
          </span>
          <span className="text-ink-4">·</span>
          <span className="text-ink-3">{candidate.text.length} chars</span>
          {candidate.active_validation_passed !== null && (
            <>
              <span className="text-ink-4">·</span>
              <span className={candidate.active_validation_passed ? 'text-state-approved' : 'text-state-rejected'}>
                LLM {candidate.active_validation_passed ? 'pass' : 'fail'}
              </span>
            </>
          )}
          {candidate.history_guard_passed !== null && (
            <>
              <span className="text-ink-4">·</span>
              <span className={candidate.history_guard_passed ? 'text-state-approved' : 'text-state-rejected'}>
                history {candidate.history_guard_passed ? 'pass' : 'fail'}
              </span>
            </>
          )}
          {candidate.director_passed !== null && (
            <>
              <span className="text-ink-4">·</span>
              <span className={candidate.director_passed ? 'text-state-approved' : 'text-state-rejected'}>
                director {candidate.director_passed ? 'pass' : 'fail'}
              </span>
            </>
          )}
        </div>
        <div className="space-x-3 font-mono text-xs">
          <button disabled={pending} onClick={approve} className="text-state-approved disabled:text-ink-4 hover:underline">
            approve
          </button>
          <button disabled={pending} onClick={edit} className="text-state-edited disabled:text-ink-4 hover:underline">
            edit
          </button>
          <button disabled={pending} onClick={retry} className="text-state-running disabled:text-ink-4 hover:underline">
            retry
          </button>
          <button disabled={pending} onClick={reject} className="text-state-rejected disabled:text-ink-4 hover:underline">
            reject
          </button>
          {candidate.channel === 'blog' && (
            <a
              href={`/cards/${candidate.card_id}/news-preview/${candidate.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-ink-3 hover:text-ink hover:underline"
            >
              view as page ↗
            </a>
          )}
        </div>
      </header>
      <div className="px-4 py-4">
        <SurfacePreview
          surface={surfaceOfCandidate(candidate)}
          data={{ text: candidate.text, structuredJson: candidate.structured_json }}
        />
      </div>
      <footer className="border-t border-rule bg-canvas px-4 py-3">
        <details className="group">
          <summary className="cursor-pointer select-none text-xs font-mono text-ink-4 hover:text-ink flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90">▸</span>
            <span>rationale · beats · validator detail</span>
            {candidate.rationale && (
              <span className="text-ink-4 normal-case not-italic truncate max-w-[40ch]">
                — {candidate.rationale.split('\n')[0]}
              </span>
            )}
          </summary>
          <div className="space-y-2 pt-3">
            <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
              {beatAudit.map((b) => (
                <span
                  key={b.beat_index}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                    b.passed
                      ? 'bg-state-approved/15 text-state-approved'
                      : 'bg-state-rejected/15 text-state-rejected'
                  }`}
                  title={
                    b.passed
                      ? `${b.declared_tempo} classified ${b.classified_tempo ?? '?'} (conf ${(b.classified_confidence ?? 0).toFixed(2)})`
                      : `${b.declared_tempo} ≠ ${b.classified_tempo ?? '?'}: ${b.reason ?? ''}`
                  }
                >
                  {b.passed ? '✓' : '✗'} {b.declared_tempo}
                  {!b.passed && <span className="opacity-70">→ {b.classified_tempo ?? '?'}</span>}
                </span>
              ))}
            </div>
            <ValidatorDetail
              activeAudit={activeAudit}
              independentClassification={independentClassification}
              blindTempoFromBeats={blindTempoFromBeats}
              regexFailures={failures}
              regexPassed={candidate.validation_passed}
              historyAudit={historyAudit}
              directorAudit={directorAudit}
              directorPassed={candidate.director_passed}
              directorAuditId={candidate.director_audit_id}
              directorFeedback={directorFeedback}
              cardId={candidate.card_id}
              rawDirectorJson={candidate.director_audit_json}
              rawJson={candidate.active_audit_json}
            />
            {candidate.rationale && (
              <p className="text-xs text-ink-3 italic whitespace-pre-wrap">{candidate.rationale}</p>
            )}
          </div>
        </details>
        {pending && <p className="text-xs text-ink-3 pt-2">Working…</p>}
        {error && <p className="text-xs text-state-rejected pt-2">{error}</p>}
      </footer>
    </article>
  );
}

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}


function ValidatorDetail({
  activeAudit,
  independentClassification,
  blindTempoFromBeats,
  regexFailures,
  regexPassed,
  historyAudit,
  directorAudit,
  directorPassed,
  directorAuditId,
  directorFeedback,
  cardId,
  rawDirectorJson,
  rawJson,
}: {
  activeAudit: ActiveAudit | null;
  independentClassification: IndependentClassification | undefined;
  blindTempoFromBeats: string | undefined;
  regexFailures: Array<{ rule: string; reason: string }>;
  regexPassed: boolean;
  historyAudit: HistoryGuardAudit | null;
  directorAudit: DirectorAudit | null;
  directorPassed: boolean | null;
  directorAuditId: string | null;
  directorFeedback: HarnessOperatorFeedback[];
  cardId: string;
  rawDirectorJson: string | null;
  rawJson: string | null;
}) {
  const tempo = independentClassification?.tempo ?? blindTempoFromBeats;
  const tempoSource = independentClassification ? 'LLM' : blindTempoFromBeats ? 'regex' : null;
  const isUnknown = tempo === 'unknown';
  const directorMotionEvidence = directorAudit?.motion_evidence
    ? Object.entries(directorAudit.motion_evidence)
    : [];
  const directorWorkingActions = directorAudit?.working_actions ?? [];
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-mono text-ink-3 hover:text-ink select-none">
        validator reasoning ↓
      </summary>
      <div className="mt-2 space-y-3 border-l-2 border-rule pl-3">
        <section>
          <h4 className="font-mono uppercase tracking-wider text-ink-4 mb-1">regex layer</h4>
          <p className="text-ink-3">
            {regexPassed ? (
              <span className="text-state-approved">passed</span>
            ) : (
              <span className="text-state-rejected">failed</span>
            )}
            {' · pattern pre-filter (AI-slop, claimed palettes, em-dash, listicle voice, antagonism, fact contract)'}
          </p>
          {regexFailures.length > 0 && (
            <ul className="mt-1 text-state-rejected space-y-0.5">
              {regexFailures.map((f, i) => (
                <li key={i}>
                  <span className="font-mono">{f.rule}</span> — {f.reason}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="font-mono uppercase tracking-wider text-ink-4 mb-1">director read</h4>
          {directorAudit ? (
            <div className="space-y-2">
              <p className="text-ink-3">
                {directorPassed ? (
                  <span className="text-state-approved">passed</span>
                ) : (
                  <span className="text-state-rejected">failed</span>
                )}
                {' · draft gate · primary '}
                <span className="font-mono text-ink">{directorAudit.primary_tempo}</span>
                {' · confidence '}
                {directorAudit.primary_confidence.toFixed(2)}
              </p>
              <p className="text-ink-3">
                copy/voice{' '}
                <Gate passed={directorAudit.copy_voice_passed ?? directorAudit.passed} />
                {' · factual '}
                <Gate passed={directorAudit.factual_passed ?? directorAudit.factual_issues.length === 0} />
                {' · publish '}
                <Gate passed={directorAudit.publication_gate_passed ?? !(directorAudit.publication_gate_issues?.length)} mutedLabel="warning" />
              </p>
              <p className="text-ink-3">
                drive <span className="font-mono text-ink">{directorAudit.drive_read}</span>
                {' · placement '}
                <span className="font-mono text-ink">{directorAudit.placement_read}</span>
              </p>
              {directorAudit.tempo_basis && (
                <p className="text-ink-3">
                  basis <span className="font-mono text-ink">{directorAudit.tempo_basis.attitude_or_state ?? 'unknown'}</span>
                  {' · '}
                  <span className="font-mono text-ink">
                    {(directorAudit.tempo_basis.variation_poles ?? []).join(' + ') || 'unknown poles'}
                  </span>
                  {directorAudit.tempo_basis.excluded_present_poles && directorAudit.tempo_basis.excluded_present_poles.length > 0
                    ? ` · excluded: ${directorAudit.tempo_basis.excluded_present_poles.join(', ')}`
                    : ''}
                </p>
              )}
              <p className={directorAudit.infinex_fit.legal ? 'text-state-approved' : 'text-state-rejected'}>
                infinex fit {directorAudit.infinex_fit.legal ? 'legal' : 'off-script'} · {directorAudit.infinex_fit.reason}
                {directorAudit.infinex_fit.nearest_allowed_read
                  ? ` · nearest: ${directorAudit.infinex_fit.nearest_allowed_read}`
                  : ''}
              </p>
              {directorAudit.notes_for_actor.length > 0 && (
                <ul className="text-ink-3 space-y-0.5">
                  {directorAudit.notes_for_actor.map((note, i) => (
                    <li key={i}>note: {note}</li>
                  ))}
                </ul>
              )}
              {directorAudit.movement_receipt_fit && (
                <p className={directorAudit.movement_receipt_fit.passed ? 'text-state-approved' : 'text-state-rejected'}>
                  movement receipt {directorAudit.movement_receipt_fit.passed ? 'claim present' : 'claim disputed'}
                  {directorAudit.movement_receipt_fit.issues.length > 0
                    ? ` · ${directorAudit.movement_receipt_fit.issues.join('; ')}`
                    : ''}
                </p>
              )}
              {directorAudit.publication_gate_issues && directorAudit.publication_gate_issues.length > 0 && (
                <div className="space-y-1 text-ink-3">
                  {directorAudit.publication_gate_issues.map((issue, i) => (
                    <p key={`publication-${i}`}>publish gate: {issue}</p>
                  ))}
                </div>
              )}
              {(directorAudit.voice_issues.length > 0 || directorAudit.factual_issues.length > 0) && (
                <div className="space-y-1 text-state-rejected">
                  {directorAudit.voice_issues.map((issue, i) => (
                    <p key={`voice-${i}`}>voice: {issue}</p>
                  ))}
                  {directorAudit.factual_issues.map((issue, i) => (
                    <p key={`fact-${i}`}>fact: {issue}</p>
                  ))}
                </div>
              )}
              {directorMotionEvidence.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-ink-3">
                    motion evidence ({directorMotionEvidence.length})
                  </summary>
                  <dl className="mt-1 space-y-1">
                    {directorMotionEvidence.map(([factor, evidence]) => (
                      <div key={factor}>
                        <dt className="font-mono text-ink">{factor}: {evidence.pole ?? 'unknown'}</dt>
                        <dd className="text-ink-3">
                          {evidence.reason ?? evidence.evidence?.join(' · ') ?? 'no evidence supplied'}
                          {evidence.source_refs && evidence.source_refs.length > 0
                            ? ` · refs: ${evidence.source_refs.join(', ')}`
                            : ''}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              {directorWorkingActions.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-ink-3">
                    working actions ({directorWorkingActions.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {directorWorkingActions.map((action, i) => (
                      <li key={i}>
                        <span className="font-mono text-ink">{action.action}</span>
                        {' · '}
                        <span className="text-ink-3">{action.evidence}</span>
                        {action.source_refs && action.source_refs.length > 0 && (
                          <span className="text-ink-4"> · refs: {action.source_refs.join(', ')}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {rawDirectorJson && (
                <details>
                  <summary className="cursor-pointer font-mono text-ink-4">show raw director JSON</summary>
                  <pre className="mt-1 text-ink-4 whitespace-pre-wrap break-all text-[10px] leading-tight">
                    {prettyJson(rawDirectorJson)}
                  </pre>
                </details>
              )}
              {directorAuditId && (
                <OperatorFeedbackForm
                  cardId={cardId}
                  targetType="director_audit"
                  targetId={directorAuditId}
                  feedback={directorFeedback}
                />
              )}
            </div>
          ) : (
            <p className="text-ink-4 italic">
              Director did not run for this candidate. Legacy candidates use regex and optional LLM auditor only.
            </p>
          )}
        </section>

        <section>
          <h4 className="font-mono uppercase tracking-wider text-ink-4 mb-1">LLM auditor</h4>
          {activeAudit ? (
            <div className="space-y-1">
              <p className="text-ink-3">
                {activeAudit.passed ? (
                  <span className="text-state-approved">passed</span>
                ) : (
                  <span className="text-state-rejected">failed</span>
                )}
                {' · '}
                {activeAudit.active_turns} turn{activeAudit.active_turns === 1 ? '' : 's'}
                {activeAudit.truncated ? ' · TRUNCATED (hit max turns)' : ''}
                {activeAudit.reason ? ` · ${activeAudit.reason}` : ''}
              </p>
              {activeAudit.llm?.feedback && (
                <p className="text-ink whitespace-pre-wrap">{activeAudit.llm.feedback}</p>
              )}
              {activeAudit.llm?.notes && (
                <p className="text-ink-3 italic">{activeAudit.llm.notes}</p>
              )}
              {activeAudit.llm?.voice_issues && activeAudit.llm.voice_issues.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-ink-3">
                    voice issues ({activeAudit.llm.voice_issues.length})
                  </summary>
                  <ul className="mt-1 ml-3 space-y-1">
                    {activeAudit.llm.voice_issues.map((v, i) => (
                      <li key={i} className="space-y-0.5">
                        <div className="font-mono text-state-rejected">{v.rule}</div>
                        <div className="text-ink-3">on: {v.line}</div>
                        <div className="text-ink">fix: {v.fix}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {activeAudit.llm?.factual_issues && activeAudit.llm.factual_issues.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-ink-3">
                    factual issues ({activeAudit.llm.factual_issues.length})
                  </summary>
                  <ul className="mt-1 ml-3 space-y-1">
                    {activeAudit.llm.factual_issues.map((f, i) => (
                      <li key={i} className="space-y-0.5">
                        <div className="font-mono text-state-rejected">
                          {f.severity} · {f.claim}
                        </div>
                        <div className="text-ink-3">evidence: {f.evidence}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {activeAudit.research_trace && activeAudit.research_trace.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-ink-3">
                    research trace ({activeAudit.research_trace.length} events)
                  </summary>
                  <ol className="mt-1 ml-3 space-y-1 font-mono">
                    {activeAudit.research_trace.map((event, i) => (
                      <li key={i} className="text-ink-3">
                        <span className="text-ink-4">[{event.type}]</span>
                        {event.name ? ` ${event.name}` : ''}
                        {event.type === 'tool_call' && event.input ? (
                          <pre className="ml-3 text-ink-4 whitespace-pre-wrap break-all">
                            {JSON.stringify(event.input)}
                          </pre>
                        ) : null}
                        {event.type === 'tool_result' && event.content_preview ? (
                          <pre className="ml-3 text-ink-4 whitespace-pre-wrap break-all">
                            {event.content_preview.slice(0, 400)}
                          </pre>
                        ) : null}
                        {event.text_preview ? (
                          <pre className="ml-3 text-ink-4 whitespace-pre-wrap break-all">
                            {event.text_preview.slice(0, 400)}
                          </pre>
                        ) : null}
                        {event.type === 'verdict' ? ` · ${event.passed ? 'pass' : 'fail'}` : ''}
                        {event.type === 'truncated' && event.reason ? ` · ${event.reason}` : ''}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          ) : (
            <p className="text-ink-4 italic">
              LLM auditor did not run for this candidate. Enable with HARNESS_ACTIVE_VALIDATOR=1 and ANTHROPIC_API_KEY.
            </p>
          )}
        </section>

        <section>
          <h4 className="font-mono uppercase tracking-wider text-ink-4 mb-1">tempo classification</h4>
          {tempo ? (
            isUnknown ? (
              <p className="text-state-rejected">
                <span className="font-mono">unknown</span> — prose didn{`’`}t match any of the voice{`’`}s locked tempi
                {tempoSource ? ` (${tempoSource})` : ''}
                {independentClassification?.rationale ? ` · ${independentClassification.rationale}` : ''}
              </p>
            ) : (
              <p className="text-ink">
                <span className="font-mono">{tempo}</span>
                {tempoSource ? ` (${tempoSource})` : ''}
                {independentClassification ? ` · confidence ${independentClassification.confidence.toFixed(2)}` : ''}
              </p>
            )
          ) : (
            <p className="text-ink-4 italic">no classification available</p>
          )}
          {independentClassification?.rationale && !isUnknown && (
            <p className="text-ink-3 mt-1">{independentClassification.rationale}</p>
          )}
          {independentClassification?.motifs && independentClassification.motifs.length > 0 && (
            <p className="text-ink-4 font-mono mt-1">
              motifs: {independentClassification.motifs.join(', ')}
            </p>
          )}
        </section>

        {historyAudit && historyAudit.failures.length > 0 && (
          <section>
            <h4 className="font-mono uppercase tracking-wider text-ink-4 mb-1">history guard</h4>
            <ul className="text-state-rejected space-y-0.5">
              {historyAudit.failures.map((f, i) => (
                <li key={i}>
                  <span className="font-mono">{f.rule}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {rawJson && (
          <details>
            <summary className="cursor-pointer font-mono text-ink-4">show raw JSON</summary>
            <pre className="mt-1 text-ink-4 whitespace-pre-wrap break-all text-[10px] leading-tight">
              {prettyJson(rawJson)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function Gate({
  passed,
  mutedLabel = 'warn',
}: {
  passed: boolean;
  mutedLabel?: string;
}) {
  return passed ? (
    <span className="text-state-approved">pass</span>
  ) : (
    <span className="text-state-rejected">{mutedLabel}</span>
  );
}
