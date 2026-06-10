'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { abandonCard, completeCard, shipPick } from '@/app/actions/ship';
import { emitPlatformPR } from '@/app/actions/emit';
import type { FinalPick } from '@/lib/types';

export function ShipPanel({ cardId, picks }: { cardId: string; picks: FinalPick[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [emit, setEmit] = useState<{
    prUrl: string | null;
    plannedDiff: string;
    proposedRoadmap: { nodeName: string; status: string; reason: string; confidence: number } | null;
  } | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && typeof result === 'object' && 'text' in result && typeof result.text === 'string') {
          await navigator.clipboard.writeText(result.text);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function abandon() {
    const reason = window.prompt('Abandon reason') ?? '';
    run(() => abandonCard(cardId, reason));
  }

  function emitPR(live: boolean) {
    if (live && !window.confirm('Open a REAL platform PR for human review? (it never merges)')) return;
    setError(null);
    setEmit(null);
    startTransition(async () => {
      try {
        const res = await emitPlatformPR(cardId, { live });
        setEmit(res);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (picks.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-ink-3 text-sm">
          No picks yet. Approve a candidate in Stage 3 to populate per-channel ship copy.
        </p>
        <button
          disabled={pending}
          onClick={abandon}
          className="text-xs font-mono text-state-rejected disabled:text-ink-4 hover:underline"
        >
          abandon card
        </button>
        {error && <p className="text-xs text-state-rejected">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {picks.map((pick) => (
        <article key={pick.id} className="border border-rule rounded bg-paper">
          <header className="px-4 py-3 border-b border-rule flex items-center justify-between">
            <span className="text-xs font-mono text-ink-3">{pick.channel}</span>
            <span className="text-xs font-mono text-ink-4">
              {pick.shipped_at ? `shipped ${pick.shipped_to}` : 'ready'}
            </span>
          </header>
          <div className="px-4 py-3 whitespace-pre-wrap text-sm">{pick.final_text}</div>
          <footer className="px-4 py-3 border-t border-rule space-x-3 text-xs font-mono">
            <button
              disabled={pending}
              onClick={() => run(() => shipPick(pick.id, 'clipboard'))}
              title="Copy the text — e.g. paste into Typefully for the X thread"
              className="text-state-running disabled:text-ink-4 hover:underline"
            >
              copy
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => shipPick(pick.id, 'slack'))}
              title="Post to the Slack webhook (HARNESS_SLACK_WEBHOOK)"
              className="text-state-running disabled:text-ink-4 hover:underline"
            >
              slack
            </button>
            {pick.channel === 'blog' && (
              <a
                href={`/cards/${cardId}/news-preview/${pick.candidate_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-ink-3 hover:text-ink hover:underline"
              >
                view as page ↗
              </a>
            )}
          </footer>
        </article>
      ))}
      <div className="space-x-3 text-xs font-mono">
        <button
          disabled={pending}
          onClick={() => emitPR(false)}
          className="text-state-running disabled:text-ink-4 hover:underline"
        >
          preview PR
        </button>
        <button
          disabled={pending}
          onClick={() => emitPR(true)}
          className="text-state-approved disabled:text-ink-4 hover:underline"
        >
          emit PR (live)
        </button>
        <button
          disabled={pending}
          onClick={() => run(() => completeCard(cardId))}
          className="text-state-approved disabled:text-ink-4 hover:underline"
        >
          complete card
        </button>
        <button
          disabled={pending}
          onClick={abandon}
          className="text-state-rejected disabled:text-ink-4 hover:underline"
        >
          abandon card
        </button>
      </div>
      {emit && (
        <div className="border border-rule rounded bg-paper p-3 text-xs space-y-2">
          <div className="font-mono text-ink-3">
            roadmap:{' '}
            {emit.proposedRoadmap ? (
              <span className="text-ink">
                proposed → tick &ldquo;{emit.proposedRoadmap.nodeName}&rdquo; to done (
                {Math.round(emit.proposedRoadmap.confidence * 100)}% · {emit.proposedRoadmap.reason})
              </span>
            ) : (
              'no node proposed — changelog only'
            )}
          </div>
          {emit.prUrl ? (
            <a
              href={emit.prUrl}
              target="_blank"
              rel="noreferrer"
              className="text-state-approved hover:underline font-mono"
            >
              PR opened → {emit.prUrl}
            </a>
          ) : (
            <>
              <div className="font-mono text-ink-3">
                dry-run — planned platform diff (changelog + roadmap; no PR opened, nothing pushed):
              </div>
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-80 text-ink-2">{emit.plannedDiff}</pre>
            </>
          )}
        </div>
      )}
      {pending && <p className="text-xs text-ink-3">Working…</p>}
      {error && <p className="text-xs text-state-rejected">{error}</p>}
    </div>
  );
}
