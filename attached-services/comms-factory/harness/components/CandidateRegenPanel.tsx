'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { regenerateWithNotes } from '@/app/actions/generate';
import { CandidateCard } from './CandidateCard';
import type { Channel, HarnessCandidate, HarnessOperatorFeedback } from '@/lib/types';

/**
 * Per-attempt candidate list with multi-select + "regenerate with notes". The
 * operator ticks the candidates to redo and optionally types notes; an empty box
 * forwards the Director's own stored notes. Regeneration runs the actor/director
 * pipeline on this channel only — the other channels are untouched.
 */
export function CandidateRegenPanel({
  cardId,
  channel,
  candidates,
  operatorFeedback,
}: {
  cardId: string;
  channel: Channel;
  candidates: HarnessCandidate[];
  operatorFeedback: HarnessOperatorFeedback[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function regenerate() {
    if (selected.size === 0) return;
    setError(null);
    setStarted(null);
    const count = selected.size;
    startTransition(async () => {
      try {
        const res = await regenerateWithNotes(cardId, channel, [...selected], notes.trim() || undefined);
        setSelected(new Set());
        setNotes('');
        setStarted(
          res.existing
            ? 'A generator run is already in progress for this card — wait for it to finish, then regenerate.'
            : `Regenerating ${channel} from ${count} draft${count === 1 ? '' : 's'} — running in the background (~a few minutes). Watch the run status above; the new attempt appears here on refresh.`,
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {candidates.map((c) => {
          const checked = selected.has(c.id);
          return (
            <div key={c.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(c.id)}
                aria-label="select this candidate to regenerate"
                className="mt-3 h-4 w-4 shrink-0"
              />
              <div className={`min-w-0 flex-1 ${checked ? 'ring-1 ring-state-running rounded-md' : ''}`}>
                <CandidateCard candidate={c} operatorFeedback={operatorFeedback} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border border-rule rounded bg-canvas p-3 space-y-2">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-4">
          regenerate selected — notes optional (empty forwards the Director&apos;s own notes)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. keep this voice, restructure into our changelog format, drop the metaphor"
          className="w-full resize-y rounded border border-rule bg-paper px-2 py-1 text-xs font-mono text-ink"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending || selected.size === 0}
            onClick={regenerate}
            className="text-xs font-mono text-state-running disabled:text-ink-4 hover:underline"
          >
            {pending ? 'regenerating…' : `regenerate selected (${selected.size})`}
          </button>
          {error && <span className="text-xs text-state-rejected">{error}</span>}
        </div>
        {started && <p className="text-xs text-state-running">{started}</p>}
      </div>
    </div>
  );
}
