/**
 * Shared design atoms (ported from harness-shared.jsx + styles.css).
 * Presentational only; safe in server or client components.
 */
import type { Stage, StageStatus } from '@/lib/types';
import { SURFACE_META, type SurfaceKind } from '@/lib/surfaces';

const STATUS_LABEL: Record<StageStatus, string> = {
  pending: 'pending',
  running: 'running',
  awaiting: 'awaiting',
  approved: 'approved',
  edited: 'approved · edited',
  rejected: 'rejected',
};

export function Badge({ status, label }: { status: StageStatus; label?: string }) {
  return <span className={`badge ${status}`}>{label ?? STATUS_LABEL[status] ?? status}</span>;
}

export function StageDots({
  stages,
  statuses,
}: {
  stages: Stage[];
  statuses: Partial<Record<Stage, StageStatus>>;
}) {
  return (
    <div
      className="stage-dots"
      title={stages.map((s, i) => `${i + 1}. ${s}: ${statuses[s] ?? 'pending'}`).join('\n')}
    >
      {stages.map((s) => (
        <span key={s} className={`d ${statuses[s] ?? 'pending'}`} />
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function SurfaceGlyph({ surface }: { surface: SurfaceKind }) {
  return <span className="surf-glyph mono">{SURFACE_META[surface].glyph}</span>;
}

/** Pass / fail gate pill. `register` picks the deterministic (squared) vs
 *  judgment (rounded) visual register from the design system. */
export function Gate({
  register,
  passed,
  label,
}: {
  register: 'regex' | 'director';
  passed: boolean;
  label: string;
}) {
  return (
    <span className={`gate ${register} ${passed ? 'pass' : 'fail'}`}>
      <span className="gate-icon">{passed ? '◆' : '✕'}</span>
      <span className="gate-lab">{label}</span>
      <span className="gate-val">{passed ? 'pass' : 'fail'}</span>
    </span>
  );
}

export function LaneTag({ register }: { register: 'deterministic' | 'judgment' }) {
  return <span className={`lane-tag ${register}`}>{register === 'deterministic' ? 'DET' : 'JUDG'}</span>;
}
