/**
 * AgreementSummary — top-of-queue dashboard.
 * Per-stage agreement rate per voice. Drill-down to per-beat for the generate stage.
 * Phase 1: simple bars; Phase 3 (Codex): real query + charts.
 */

import type { AgreementSnapshot } from '@/lib/types';

const THRESHOLD = 0.8;

function Bar({ rate, sampleSize, label }: { rate: number; sampleSize: number; label: string }) {
  const pct = Math.round(rate * 100);
  const passing = rate >= THRESHOLD;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}</span>
        <span className={`font-mono text-sm ${passing ? 'text-state-approved' : 'text-ink-2'}`}>
          {pct}% <span className="text-ink-4">n={sampleSize}</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-rule/60 rounded">
        <div
          className={`h-1.5 rounded ${passing ? 'bg-state-approved' : 'bg-state-edited'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AgreementSummary({ snapshots }: { snapshots: AgreementSnapshot[] }) {
  const topLevel = snapshots.filter((s) => !s.beat_name && !s.fact_source);
  const perBeat = snapshots.filter((s) => s.beat_name);

  return (
    <div className="border border-rule rounded-md bg-paper p-5 space-y-5">
      <div>
        <h2 className="text-sm font-mono uppercase text-ink-3 tracking-wider">
          Agreement · 7-day rolling · Infinex voice
        </h2>
        <p className="text-xs text-ink-3 mt-1">
          Operator approve-as-is rate per stage. Stages above {Math.round(THRESHOLD * 100)}% may run autonomously.
        </p>
      </div>
      {snapshots.length === 0 && (
        <p className="text-sm text-ink-3">
          No agreement snapshots yet. Recompute after decisions have been captured.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {topLevel.map((s) => (
          <Bar key={s.id} rate={s.agreement_rate} sampleSize={s.sample_size} label={s.stage} />
        ))}
      </div>
      {perBeat.length > 0 && (
        <div className="pt-3 border-t border-rule space-y-2">
          <h3 className="text-xs font-mono uppercase text-ink-3 tracking-wider">
            Per-beat drill-down · generate stage
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {perBeat.map((s) => (
              <Bar
                key={s.id}
                rate={s.agreement_rate}
                sampleSize={s.sample_size}
                label={s.beat_name ?? '?'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
