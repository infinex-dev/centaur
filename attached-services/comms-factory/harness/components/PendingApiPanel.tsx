'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approveApiRequest, rejectApiRequest } from '@/app/actions/api-approvals';
import type { PendingApiRequest } from '@/lib/types';

export function PendingApiPanel({
  cardId: _cardId,
  requests,
}: {
  cardId: string;
  requests: PendingApiRequest[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="border border-state-running/40 bg-state-running/5 rounded-md p-4 space-y-3">
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wider text-state-running">
          partner API — approval needed
        </p>
        <p className="text-xs text-ink-3">
          The grounder wanted to call {requests.length} live API{requests.length === 1 ? '' : 's'} not referenced in our
          branch code. Approve a host to trust it, then re-run the grounder — it will call it and record what it exposes.
        </p>
      </div>

      <ul className="space-y-2">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex items-start justify-between gap-3 border border-rule rounded-md bg-paper px-3 py-2"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-mono text-sm text-ink truncate">{req.host}</p>
              <p className="text-xs text-ink-3 truncate" title={req.url}>
                {req.url}
              </p>
              <p className="text-xs text-ink-3">{req.reason}</p>
            </div>
            <div className="shrink-0 space-x-3 font-mono text-xs pt-0.5">
              <button
                disabled={pending}
                onClick={() => run(() => approveApiRequest(req.id))}
                className="text-state-approved disabled:text-ink-4 hover:underline"
              >
                approve host
              </button>
              <button
                disabled={pending}
                onClick={() => run(() => rejectApiRequest(req.id))}
                className="text-state-rejected disabled:text-ink-4 hover:underline"
              >
                reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-state-rejected">{error}</p>}
    </div>
  );
}
