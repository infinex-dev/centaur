/**
 * Training shifts — the insight surface (Claude Code Design v3, decision §6).
 * Aggregates operator edits that re-classified a beat's tempo into a
 * declared→classified flow. This is where spec-update decisions happen.
 *
 * Data dependency: candidate_semantic_edits (Mode-C diffs). The capture path
 * is not yet wired in this branch, so the screen renders an explicit
 * empty-state until edits accumulate — never fabricated counts.
 */

import Link from 'next/link';
import { aggregateTempoShifts, latestAgreement } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ShiftsPage() {
  const { shifts, sampleSize } = aggregateTempoShifts(7);
  const agreement = latestAgreement({ voice: 'infinex', stage: 'generate', window_days: 7 });
  const maxCount = shifts.reduce((m, s) => Math.max(m, s.count), 0) || 1;

  return (
    <div className="space-y-6">
      <div className="crumb">
        <Link href="/">queue</Link> / training shifts
      </div>

      <div className="rel-section-head">
        <div>
          <h1 className="title-lg">Training shifts</h1>
          <p className="muted mt-1" style={{ maxWidth: 640 }}>
            Operator edits that re-classified a beat — declared tempo → tempo-after-edit.
            The pattern across many edits is the spec-change signal; a thick arrow means
            the spec is mislabelling that tempo.
          </p>
        </div>
        <span className="eyebrow">{sampleSize} edits · 7-day window</span>
      </div>

      {shifts.length === 0 ? (
        <div className="surface empty">
          <div className="icon">⇄</div>
          <div className="title-md">No tempo shifts captured yet.</div>
          <p className="muted mt-2" style={{ maxWidth: 520, marginInline: 'auto' }}>
            This view aggregates <code className="mono">candidate_semantic_edits</code> — the
            Mode-C diff written when an operator&apos;s text edit changes a beat&apos;s
            classified tempo. Once edit-capture is wired into the generate-stage decision
            flow, declared→classified shifts will accumulate here as a flow diagram.
          </p>
        </div>
      ) : (
        <div className="surface" style={{ padding: '20px 22px' }}>
          <div className="lane-incidence">
            {shifts.map((s) => (
              <div key={`${s.from_tempo}-${s.to_tempo}`} className="li-row" style={{ gridTemplateColumns: '200px 1fr 40px' }}>
                <span className="li-name mono">
                  {s.from_tempo} <span className="muted-2">→</span> {s.to_tempo}
                </span>
                <span className="li-track">
                  <span
                    className="li-fill judgment"
                    style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }}
                  />
                </span>
                <span className="li-n">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {agreement.length > 0 && (
        <div className="surface" style={{ padding: '18px 22px' }}>
          <h2 className="title-md">Per-beat agreement (generate stage)</h2>
          <div className="beats-row mt-4">
            {agreement
              .filter((a) => a.beat_name)
              .map((a) => {
                const pct = Math.round(a.agreement_rate * 100);
                const attention = a.agreement_rate < 0.8;
                return (
                  <div key={a.beat_name} className={`beat ${attention ? 'attention' : ''}`}>
                    <div className="beat-name">
                      <span>{a.beat_name}</span>
                      <span>{a.sample_size}</span>
                    </div>
                    <div className="beat-rate">{pct}%</div>
                    <div className="beat-bar">
                      <span className="seg-approve" style={{ flex: a.approved_as_is }} />
                      <span className="seg-edit" style={{ flex: a.edited }} />
                      <span className="seg-reject" style={{ flex: a.rejected }} />
                    </div>
                    <div className="beat-meta">
                      <span>✓{a.approved_as_is}</span>
                      <span>✎{a.edited}</span>
                      <span>✕{a.rejected}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
