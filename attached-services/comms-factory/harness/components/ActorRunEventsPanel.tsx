'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { HarnessActorRun, HarnessActorRunEvent } from '@/lib/types';

export function ActorRunEventsPanel({
  cardId,
  initialRun,
}: {
  cardId: string;
  initialRun: HarnessActorRun | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState<HarnessActorRun | null>(initialRun);
  const [events, setEvents] = useState<HarnessActorRunEvent[]>([]);

  useEffect(() => {
    setRun(initialRun);
  }, [initialRun]);

  useEffect(() => {
    let cancelled = false;
    let lastEventCount = -1;
    let lastStatus = run?.status ?? null;
    async function load() {
      try {
        const query = run?.id ? `?run_id=${encodeURIComponent(run.id)}` : '';
        const response = await fetch(`/api/cards/${cardId}/actor-events${query}`, { cache: 'no-store' });
        if (!response.ok) return;
        const body = await response.json() as { run?: HarnessActorRun | null; events?: HarnessActorRunEvent[] };
        if (cancelled) return;
        const nextRun = body.run ?? null;
        const nextEvents = body.events ?? [];
        setRun(nextRun);
        setEvents(nextEvents);
        const nextStatus = nextRun?.status ?? null;
        if (nextEvents.length !== lastEventCount || nextStatus !== lastStatus) {
          lastEventCount = nextEvents.length;
          lastStatus = nextStatus;
          router.refresh();
        }
      } catch {
        // Polling must not break the generate screen.
      }
    }
    void load();
    const shouldPoll = run?.status === 'running';
    const timer = shouldPoll ? window.setInterval(load, 2000) : null;
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [cardId, router, run?.id, run?.status]);

  if (!run && events.length === 0) return null;
  const chronological = [...events].reverse();

  return (
    <details className="border border-rule rounded-md bg-paper" open>
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-mono text-ink-3 hover:text-ink">
        live actor/director trace
        {run && (
          <span className={run.status === 'failed' ? 'text-state-rejected' : 'text-state-running'}>
            {' '}· {run.status} · {shortRunId(run.id)}
          </span>
        )}
        {' '}· {events.length} event{events.length === 1 ? '' : 's'}
      </summary>
      <div className="border-t border-rule divide-y divide-rule max-h-[360px] overflow-auto">
        {run?.error && (
          <div className="px-4 py-3 text-xs font-mono text-state-rejected">{run.error}</div>
        )}
        {chronological.length === 0 && (
          <div className="px-4 py-3 text-xs font-mono text-ink-4">waiting for first checkpoint…</div>
        )}
        {chronological.map((event) => (
          <div key={event.id} className="px-4 py-3 text-xs font-mono space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-4">{new Date(event.created_at).toLocaleTimeString()}</span>
              {event.attempt !== null && <span className="text-ink-3">attempt {event.attempt}</span>}
              {event.channel && <span className="text-ink-3">{event.channel}</span>}
              <span className={isErrorEvent(event.event_type) ? 'text-state-rejected' : 'text-state-running'}>
                {event.event_type}
              </span>
            </div>
            <p className="text-ink">{event.message}</p>
            <Payload payloadJson={event.payload_json} />
          </div>
        ))}
      </div>
    </details>
  );
}

function Payload({ payloadJson }: { payloadJson: string }) {
  if (!payloadJson || payloadJson === '{}') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return <pre className="mt-2 whitespace-pre-wrap text-ink-3 max-h-[220px] overflow-auto">{payloadJson}</pre>;
  }
  return (
    <details>
      <summary className="cursor-pointer text-ink-4 hover:text-ink-3">payload</summary>
      <pre className="mt-2 whitespace-pre-wrap text-ink-3 max-h-[220px] overflow-auto">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </details>
  );
}

function isErrorEvent(eventType: string): boolean {
  return eventType === 'run_error' || eventType === 'run_failed';
}

function shortRunId(id: string): string {
  return id.length <= 8 ? id : id.slice(-8);
}
