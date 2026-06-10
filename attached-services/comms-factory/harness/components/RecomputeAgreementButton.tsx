'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { recomputeAgreement } from '@/app/actions/agreement';

export function RecomputeAgreementButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const result = await recomputeAgreement(7);
        setMessage(`${result.snapshots_written} snapshot${result.snapshots_written === 1 ? '' : 's'} written`);
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="space-y-1">
      <button
        disabled={pending}
        onClick={run}
        className="text-xs font-mono text-ink-2 disabled:text-ink-4 hover:text-ink"
      >
        {pending ? 'recomputing…' : 'recompute agreement'}
      </button>
      {message && <p className="text-xs text-ink-3">{message}</p>}
    </div>
  );
}
