/**
 * StageBadge — small status indicator for a workflow stage.
 * Visual treatment is placeholder. Claude Code Design will redo this.
 */

import type { StageStatus } from '@/lib/types';

const STATUS_LABEL: Record<StageStatus, string> = {
  pending: 'pending',
  running: 'running…',
  awaiting: 'awaiting approval',
  approved: 'approved',
  edited: 'approved (edited)',
  rejected: 'rejected',
};

const STATUS_DOT: Record<StageStatus, string> = {
  pending: 'bg-state-pending',
  running: 'bg-state-running animate-pulse',
  awaiting: 'bg-state-awaiting',
  approved: 'bg-state-approved',
  edited: 'bg-state-edited',
  rejected: 'bg-state-rejected',
};

export function StageBadge({ status }: { status: StageStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      <span className="text-ink-2">{STATUS_LABEL[status]}</span>
    </span>
  );
}
