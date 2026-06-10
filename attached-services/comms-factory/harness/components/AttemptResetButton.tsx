'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { resetAttempt } from '@/app/actions/generate';
import type { Channel } from '@/lib/types';

export function AttemptResetButton({
  cardId,
  channel,
  attempt,
}: {
  cardId: string;
  channel: Channel;
  attempt: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function click() {
    if (!confirm) {
      setConfirm(true);
      setError(null);
      setTimeout(() => setConfirm(false), 3000);
      return;
    }
    setConfirm(false);
    startTransition(async () => {
      try {
        await resetAttempt(cardId, channel, attempt);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <span className="font-mono text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={click}
        className={`hover:underline disabled:text-ink-4 ${
          confirm ? 'text-state-rejected' : 'text-ink-4'
        }`}
        title={`Wipes attempt ${attempt} (${channel}) — candidates, audits, decisions, edits, final pick.`}
      >
        {pending
          ? 'resetting…'
          : confirm
            ? 'click again to confirm'
            : 'reset this attempt'}
      </button>
      {error && <span className="ml-2 text-state-rejected">{error}</span>}
    </span>
  );
}
