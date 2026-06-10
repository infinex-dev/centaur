/**
 * Panel — collapsible stage container with header (title + status badge) and body.
 * Visual treatment is placeholder. Claude Code Design will redo this.
 */

'use client';

import { useState, type ReactNode } from 'react';
import type { Stage, StageStatus } from '@/lib/types';
import { StageBadge } from './StageBadge';

interface PanelProps {
  stageNumber: number;
  stage: Stage;
  title: string;
  status: StageStatus;
  defaultOpen?: boolean;
  children: ReactNode;
}

const STAGE_SUBTITLE: Record<Stage, string> = {
  research: 'Fact-grounder verifies every claim the caption could assert.',
  card: 'Release card is assembled. Edit before locking.',
  generate: 'Caption candidates per channel. Approve, edit, or retry.',
  ship: 'Final picks. Copy to clipboard or push to surface.',
};

export function Panel({
  stageNumber,
  stage,
  title,
  status,
  defaultOpen = false,
  children,
}: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border border-rule rounded-md bg-paper">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-ink-3 text-xs">{String(stageNumber).padStart(2, '0')}</span>
          <div>
            <h2 className="font-medium text-ink">{title}</h2>
            <p className="text-sm text-ink-3 mt-0.5">{STAGE_SUBTITLE[stage]}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StageBadge status={status} />
          <span className="text-ink-4 text-xs font-mono">{open ? '▾' : '▸'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-rule px-5 py-5 bg-canvas">{children}</div>
      )}
    </section>
  );
}
