'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { resetGenerator, runGenerator } from '@/app/actions/generate';
import type { Channel, HarnessActorRun } from '@/lib/types';

// carousel retired 2026-06-11: its in-app surface (appAlert / What's-New dialog)
// is formally deprecated platform-side (docs/content-pipeline.md) — nothing
// renders it. Generation/validation code stays for historical cards.
const CHANNEL_OPTIONS: { channel: Channel; label: string }[] = [
  { channel: 'x', label: 'X' },
  { channel: 'x-thread', label: 'X thread' },
  { channel: 'web', label: 'web' },
  { channel: 'in-product', label: 'in-product' },
  { channel: 'modal', label: 'modal' },
  { channel: 'blog', label: 'blog' },
  { channel: 'image-brief', label: 'image brief' },
];

export function GenerateControls({
  cardId,
  defaultChannels,
  initialRun,
}: {
  cardId: string;
  defaultChannels: Channel[];
  initialRun: HarnessActorRun | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<HarnessActorRun | null>(initialRun);
  const [pending, startTransition] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const offerable = useMemo(
    () => defaultChannels.filter((c) => CHANNEL_OPTIONS.some((o) => o.channel === c)),
    [defaultChannels],
  );
  const [selected, setSelected] = useState<Channel[]>(offerable.length ? offerable : ['x']);
  const storageKey = useMemo(() => `comms-factory:generate-channels:${cardId}`, [cardId]);
  const defaultChannelsKey = defaultChannels.join('|');

  useEffect(() => {
    setActiveRun(initialRun);
  }, [initialRun]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? parseStoredChannels(stored) : [];
      setSelected(parsed.length > 0 ? parsed : offerable.length ? offerable : ['x']);
    } catch {
      setSelected(offerable.length ? offerable : ['x']);
    }
  }, [storageKey, defaultChannelsKey, offerable]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch {
      // Channel persistence is a harness convenience; never block generation on storage.
    }
  }, [storageKey, selected]);

  useEffect(() => {
    if (activeRun?.status !== 'running') return;
    const activeRunId = activeRun.id;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/cards/${cardId}/actor-events?run_id=${encodeURIComponent(activeRunId)}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const body = await response.json() as { run?: HarnessActorRun | null };
        if (cancelled || !body.run) return;
        setActiveRun(body.run);
        router.refresh();
      } catch {
        // Polling must not break the generate controls.
      }
    }
    void load();
    const timer = window.setInterval(load, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRun?.id, activeRun?.status, cardId, router]);

  function toggle(channel: Channel) {
    setSelected((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  function run() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const result = await runGenerator(cardId, selected);
        setActiveRun(result.run);
        setInfo(
          result.existing
            ? `run already active · ${shortRunId(result.run.id)}`
            : `run started · ${shortRunId(result.run.id)}`,
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setError(null);
      setInfo('click again within 3s to confirm — wipes candidates + audits + decisions + edits + final picks');
      setTimeout(() => {
        setConfirmReset(false);
        setInfo(null);
      }, 3000);
      return;
    }
    setConfirmReset(false);
    setError(null);
    setInfo(null);
    startReset(async () => {
      try {
        const { deleted } = await resetGenerator(cardId);
        const total =
          deleted.candidates +
          deleted.candidate_audits +
          deleted.candidate_decisions +
          deleted.candidate_text_edits +
          deleted.candidate_semantic_edits +
          deleted.final_picks +
          deleted.actor_runs +
          deleted.actor_run_events;
        setInfo(
          `reset · wiped ${deleted.candidates} candidates, ${deleted.candidate_audits} audits, ${deleted.candidate_decisions} decisions, ${deleted.final_picks} final picks, ${deleted.actor_runs} run rows, ${deleted.actor_run_events} live events (${total} rows total)`,
        );
        setActiveRun(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const runRunning = activeRun?.status === 'running';
  const anyPending = pending || resetPending || runRunning;
  const defaultSet = new Set(defaultChannels);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-ink-3">
          channels{' '}
          <span className="text-ink-4 normal-case">
            · defaults from card audience — toggle before generating
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map(({ channel, label }) => {
            const on = selected.includes(channel);
            return (
              <button
                key={channel}
                disabled={anyPending}
                onClick={() => toggle(channel)}
                title={defaultSet.has(channel) ? 'in card audience' : 'not in card audience'}
                className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
                  on
                    ? 'border-state-running text-state-running bg-state-running/10'
                    : 'border-rule text-ink-4 hover:text-ink-3'
                }`}
              >
                {on ? '✓ ' : ''}
                {label}
                {defaultSet.has(channel) && <span className="text-ink-4"> ·</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          disabled={anyPending || selected.length === 0}
          onClick={run}
          className="text-xs font-mono text-state-running disabled:text-ink-4 hover:underline"
        >
          {pending
            ? 'starting…'
            : runRunning
              ? `generator running · ${shortRunId(activeRun.id)}`
            : `run generator (${selected.length} channel${selected.length === 1 ? '' : 's'})`}
        </button>
        <button
          disabled={anyPending}
          onClick={reset}
          className={`text-xs font-mono disabled:text-ink-4 hover:underline ${
            confirmReset ? 'text-state-rejected' : 'text-ink-3'
          }`}
          title="Wipes candidates + audits + decisions + edits + final picks for this card. Preserves facts, grounder runs, release card. Resets the retry counter so you can run the generator again."
        >
          {resetPending ? 'resetting…' : confirmReset ? 'click again to confirm reset' : 'reset generator phase'}
        </button>
      </div>
      {activeRun && (
        <p className={`text-xs font-mono ${activeRun.status === 'failed' ? 'text-state-rejected' : 'text-ink-3'}`}>
          run {shortRunId(activeRun.id)} · {activeRun.status}
          {activeRun.error ? ` · ${activeRun.error}` : ''}
        </p>
      )}
      {info && <p className="text-xs text-ink-3 font-mono">{info}</p>}
      {error && <p className="text-xs text-state-rejected">{error}</p>}
    </div>
  );
}

const CHANNEL_SET = new Set(CHANNEL_OPTIONS.map((option) => option.channel));

function parseStoredChannels(raw: string): Channel[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is Channel => typeof item === 'string' && CHANNEL_SET.has(item as Channel));
}

function shortRunId(id: string): string {
  return id.length <= 8 ? id : id.slice(-8);
}
