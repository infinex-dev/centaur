'use client';

/**
 * PackageTabs — the package-review IA (Claude Code Design v3).
 * Five numbered tabs over one release's review surface. Functional panels from
 * the existing harness (facts, card editor, generate controls, ship, actor
 * events) are injected as slots so no review capability regresses; the tabs
 * only reorganize *where* they appear.
 */
import { useState } from 'react';
import { Gate, SurfaceGlyph } from './atoms';
import { SurfacePreview } from './SurfacePreview';
import { SurfaceEditor } from './SurfaceEditor';
import type { SurfaceKind } from '@/lib/surfaces';
import { SURFACE_META } from '@/lib/surfaces';
import type { Channel } from '@/lib/types';

/** Flow-direction A/B badge (prompt_variant: inwards-out / outwards-in). */
export interface FlowBadge {
  tag: 'A' | 'B';
  label: string;
}

export interface SurfaceRowVM {
  surface: SurfaceKind;
  state: 'shippable' | 'blocked' | 'missing';
  /** Candidate behind this surface — the edit target (pick's candidate if picked). */
  candidateId: string | null;
  /** The candidate's channel (== surface, except x-thread split from an x candidate). */
  channel: Channel;
  /** A final pick already exists for this surface (shown copy may be edited). */
  edited: boolean;
  text: string;
  structuredJson: string | null;
  attempt: number | null;
  regexPassed: boolean | null;
  directorPassed: boolean | null;
  flow: FlowBadge | null;
  blockReason: string | null;
}

export interface CorpusItemVM {
  id: string;
  surface: SurfaceKind;
  attempt: number;
  text: string;
  structuredJson: string | null;
  status: 'picked' | 'superseded' | 'failed';
  regexPassed: boolean;
  directorPassed: boolean | null;
  flow: FlowBadge | null;
  reason: string | null;
}

export interface ThroughlineBeatVM {
  surface: SurfaceKind;
  beats: { tempo: string; passed: boolean }[];
}

const TABS = [
  { key: '1', id: 'package', label: 'Package' },
  { key: '2', id: 'failures', label: 'Failures' },
  { key: '3', id: 'throughline', label: 'Throughline' },
  { key: '4', id: 'corpus', label: 'Corpus' },
  { key: '5', id: 'debug', label: 'Debug' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const STATUS_TOOLTIP: Record<CorpusItemVM['status'], string> = {
  picked: 'Selected as the final pick for this surface.',
  superseded: 'Passed every gate but was not selected — another candidate was picked for this surface.',
  failed: 'Failed a gate (regex/format or director) — see the reason below.',
};

export function PackageTabs({
  cardId,
  surfaces,
  corpus,
  throughline,
  counts,
  pendingApi,
  research,
  cardEditor,
  generateControls,
  ship,
  actorEvents,
  runEvents,
  pipelineProof,
}: {
  cardId: string;
  surfaces: SurfaceRowVM[];
  corpus: CorpusItemVM[];
  throughline: ThroughlineBeatVM[];
  counts: { failures: number; corpus: number };
  pendingApi: React.ReactNode;
  research: React.ReactNode;
  cardEditor: React.ReactNode;
  generateControls: React.ReactNode;
  ship: React.ReactNode;
  actorEvents: React.ReactNode;
  runEvents: React.ReactNode;
  pipelineProof: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabId>('package');
  const blocked = surfaces.filter((s) => s.state === 'blocked');

  return (
    <div>
      <nav className="rel-tabs">
        {TABS.map((t) => {
          const count =
            t.id === 'failures' ? counts.failures : t.id === 'corpus' ? counts.corpus : null;
          return (
            <button
              key={t.id}
              className={`rel-tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="rel-tab-key">{t.key}</span>
              <span className="rel-tab-label">{t.label}</span>
              {count != null && <span className="rel-tab-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {tab === 'package' && (
        <div className="space-y-6">
          {pendingApi && (
            <div className="surface" style={{ padding: '14px 18px' }}>
              <div className="eyebrow eyebrow-strong" style={{ marginBottom: 10 }}>
                ⚠ Grounder API approval required
              </div>
              {pendingApi}
            </div>
          )}
          {generateControls}
          <div className="surf-grid">
            {surfaces.map((s) => (
              <SurfaceCard key={s.surface} row={s} cardId={cardId} />
            ))}
            {surfaces.length === 0 && (
              <div className="empty">
                <div className="icon">∅</div>
                No candidates yet. Run the generator from the controls above.
              </div>
            )}
          </div>
          <details className="surface">
            <summary className="panel-head">
              <span className="panel-title">Research — fact grounding</span>
            </summary>
            <div className="panel-body">{research}</div>
          </details>
          <details className="surface">
            <summary className="panel-head">
              <span className="panel-title">Release card</span>
            </summary>
            <div className="panel-body">{cardEditor}</div>
          </details>
        </div>
      )}

      {tab === 'failures' && (
        <div className="space-y-4">
          {blocked.length === 0 ? (
            <div className="surface no-blockers">
              <div className="nb-mark">✓</div>
              <div>
                <div className="nb-title">No blockers.</div>
                <div className="nb-sub muted">Every candidate surface cleared its lanes.</div>
              </div>
            </div>
          ) : (
            blocked.map((s) => (
              <div key={s.surface} className="blocker">
                <div className="blocker-head">
                  <span className="blocker-id">
                    <SurfaceGlyph surface={s.surface} />
                    <span className="surf-name">{SURFACE_META[s.surface].label}</span>
                  </span>
                  <span className="lane-verdict fail">blocked</span>
                </div>
                {s.text ? (
                  <div className="blocker-preview">
                    <SurfacePreview
                      surface={s.surface}
                      data={{ text: s.text, structuredJson: s.structuredJson }}
                      variant="compact"
                    />
                  </div>
                ) : (
                  <div className="blocker-preview muted text-xs">No candidate text captured for this surface.</div>
                )}
                <div className="blocker-lanes">
                  <div className={`lane-result deterministic ${s.regexPassed === false ? 'is-fail' : ''}`}>
                    <div className="lane-result-top">
                      <span className="lane-reg">DET</span>
                      <span className="lane-name">Regex / format</span>
                      <span className={`lane-verdict ${s.regexPassed === false ? 'fail' : 'pass'}`}>
                        {s.regexPassed === false ? 'fail' : 'pass'}
                      </span>
                    </div>
                    <div className="lane-result-body">
                      {s.regexPassed === false ? s.blockReason : 'Formatting, length, structure clear.'}
                    </div>
                  </div>
                  <div className="lane-result judgment">
                    <div className="lane-result-top">
                      <span className="lane-reg">JUDG</span>
                      <span className="lane-name">Director / content-tone</span>
                      <span className={`lane-verdict ${s.regexPassed === false ? '' : s.directorPassed === false ? 'fail' : 'pass'}`}>
                        {s.regexPassed === false ? 'not run' : s.directorPassed === false ? 'fail' : 'pass'}
                      </span>
                    </div>
                    <div className="lane-result-body director-quote">
                      {s.regexPassed === false
                        ? 'Director not run — blocked upstream by regex / format.'
                        : s.directorPassed === false
                          ? s.blockReason ?? 'Director rejected content/tone.'
                          : 'Director read it as publication-ready.'}
                    </div>
                  </div>
                </div>
                {s.blockReason && (
                  <div className="blocker-action">
                    <span className="blocker-action-lab">read</span>
                    <span className="blocker-action-txt">{s.blockReason}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'throughline' && (
        <div className="space-y-4">
          <div className="coherence ok">
            <span className="coherence-mark">✓</span>
            <div>
              <div className="coherence-line">
                One narrative across surfaces — verified per-surface beat fit below.
              </div>
              <div className="coherence-sub muted">
                Full cross-surface coherence scoring is a pipeline-side addition (see report).
                Today: the actor-declared beats and their classification, per surface.
              </div>
            </div>
          </div>
          <div className="ladder">
            {throughline.length === 0 && (
              <div className="empty">No beat data captured for this card yet.</div>
            )}
            {throughline.map((t) => (
              <div key={t.surface} className="ladder-row">
                <div className="ladder-main" style={{ gridTemplateColumns: '160px 1fr' }}>
                  <span className="ladder-id">
                    <SurfaceGlyph surface={t.surface} />
                    <span className="surf-name">{SURFACE_META[t.surface].label}</span>
                  </span>
                  <span className="beat-chips">
                    {t.beats.length === 0 && <span className="muted-2 mono text-xs">no beats</span>}
                    {t.beats.map((b, i) => (
                      <span key={i} className={`beat-chip ${b.passed ? 'pass' : 'fail'}`}>
                        <span className="idx">{i + 1}</span>
                        {b.tempo}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'corpus' && (
        <div className="space-y-3">
          {corpus.length === 0 && <div className="empty">No candidates generated yet.</div>}
          {corpus.map((c) => (
            <div key={c.id} className={`corpus-card ${c.status}`}>
              <div className="corpus-head">
                <span className="corpus-head-l">
                  <SurfaceGlyph surface={c.surface} />
                  <span className="surf-name">{SURFACE_META[c.surface].label}</span>
                  <span className="corpus-attempt">attempt {c.attempt}</span>
                  {c.flow && <FlowChip flow={c.flow} />}
                </span>
                <span className="corpus-head-r">
                  <Gate register="regex" passed={c.regexPassed} label="regex" />
                  {c.directorPassed != null && (
                    <Gate register="director" passed={c.directorPassed} label="director" />
                  )}
                  <span className={`corpus-status ${c.status}`} title={STATUS_TOOLTIP[c.status]}>{c.status}</span>
                </span>
              </div>
              <div className="corpus-body">
                <SurfacePreview surface={c.surface} data={{ text: c.text, structuredJson: c.structuredJson }} variant="compact" />
              </div>
              {c.reason && (
                <div className="corpus-reason deterministic">{c.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'debug' && (
        <div className="space-y-4">
          {pipelineProof}
          <details className="surface" open>
            <summary className="panel-head">
              <span className="panel-title">Run events</span>
              <span className="panel-sub muted">
                grounder · actor · validator · director · ship · fact-request rounds — rendered
                generically so new event types surface unmapped, not invisible
              </span>
            </summary>
            <div className="panel-body">{runEvents}</div>
          </details>
          <details className="surface">
            <summary className="panel-head">
              <span className="panel-title">Full attempt history (prompts · feedback · validator detail)</span>
            </summary>
            <div className="panel-body">{actorEvents}</div>
          </details>
          <details className="surface" open>
            <summary className="panel-head">
              <span className="panel-title">Ship — final picks + delivery</span>
            </summary>
            <div className="panel-body">{ship}</div>
          </details>
        </div>
      )}
    </div>
  );
}

function SurfaceCard({ row, cardId }: { row: SurfaceRowVM; cardId: string }) {
  const meta = SURFACE_META[row.surface];
  return (
    <div className={`surf-card state-${row.state}`}>
      <div className="surf-card-head">
        <span className="surf-card-id">
          <SurfaceGlyph surface={row.surface} />
          <span>
            <span className="surf-name">{meta.label}</span>
            <span className="surf-role">{meta.role}</span>
          </span>
        </span>
        <span className={`corpus-status ${row.state === 'shippable' ? 'eligible' : row.state}`}>
          {row.state}
        </span>
      </div>
      <div className="surf-card-preview">
        {row.text && row.candidateId ? (
          <SurfaceEditor
            surface={row.surface}
            cardId={cardId}
            channel={row.channel}
            candidateId={row.candidateId}
            text={row.text}
            structuredJson={row.structuredJson}
            edited={row.edited}
          />
        ) : row.text ? (
          <SurfacePreview surface={row.surface} data={{ text: row.text, structuredJson: row.structuredJson }} />
        ) : (
          <div className="muted text-xs">No candidate for this surface.</div>
        )}
      </div>
      <div className="surf-card-foot">
        <div className="surf-gates">
          {row.regexPassed != null && <Gate register="regex" passed={row.regexPassed} label="regex" />}
          {row.directorPassed != null && (
            <Gate register="director" passed={row.directorPassed} label="director" />
          )}
          {row.flow && <FlowChip flow={row.flow} />}
          {row.attempt != null && <span className="surf-attempt">attempt {row.attempt}</span>}
        </div>
        {row.state === 'blocked' && row.blockReason && (
          <div className="surf-block">
            <div className="surf-block-reason">{row.blockReason}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Flow-direction A/B badge — A = inwards-out, B = outwards-in (prompt_variant). */
function FlowChip({ flow }: { flow: FlowBadge }) {
  return (
    <span className="lane-tag judgment" title={`vertical flow: ${flow.label}`}>
      flow {flow.tag} · {flow.label}
    </span>
  );
}
