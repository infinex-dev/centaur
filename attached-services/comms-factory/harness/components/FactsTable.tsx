'use client';

/**
 * FactsTable — research-stage display of VerifiedFact[].
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  addManualFact,
  approveResearch,
  decideFact,
  runGrounder,
} from '@/app/actions/research';
import type { GrounderRun } from '@/lib/queries';
import type { HarnessFact } from '@/lib/types';

const STATUS_GLYPH: Record<HarnessFact['status'], string> = {
  pending: '◌',
  approved: '✓',
  edited: '✏',
  rejected: '✗',
  manual: '＋',
};

const STATUS_TONE: Record<HarnessFact['status'], string> = {
  pending: 'text-state-pending',
  approved: 'text-state-approved',
  edited: 'text-state-edited',
  rejected: 'text-state-rejected line-through opacity-60',
  manual: 'text-state-running',
};

export function FactsTable({
  cardId,
  facts,
  researchApprovedAt,
  latestGrounderRun,
}: {
  cardId: string;
  facts: HarnessFact[];
  researchApprovedAt: string | null;
  latestGrounderRun: GrounderRun | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [liveGrounderRun, setLiveGrounderRun] = useState<GrounderRun | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function runFactGrounder() {
    setError(null);
    setMessage('Grounder running. This can take 10-30s, sometimes longer.');
    setLiveGrounderRun(null);
    startTransition(async () => {
      try {
        const result = await runGrounder(cardId);
        const unverifiableCount = result.unverifiable.length;
        if (result.facts.length === 0 && unverifiableCount === 0) {
          setMessage('Grounder completed, but returned no facts or unverifiable claims.');
        } else if (result.facts.length === 0) {
          setMessage(
            `Grounder completed with no verified facts. Unverifiable: ${result.unverifiable
              .map((item) => `${item.claim}: ${item.reason}`)
              .join(' | ')}`,
          );
        } else {
          setMessage(
            `Grounder recorded ${result.facts.length} fact${result.facts.length === 1 ? '' : 's'}${
              unverifiableCount > 0 ? ` and ${unverifiableCount} unverifiable claim${unverifiableCount === 1 ? '' : 's'}` : ''
            }.`,
          );
        }
        router.refresh();
      } catch (err) {
        setMessage(null);
        setError(err instanceof Error ? err.message : String(err));
        router.refresh();
      }
    });
  }

  function approveResearchAction() {
    if (
      researchApprovedAt &&
      !window.confirm('Re-approving research clears the release card, generated candidates, and final picks for this card. Continue?')
    ) {
      return;
    }
    run(() => approveResearch(cardId));
  }

  function editFact(fact: HarnessFact) {
    const raw = window.prompt(
      'Edit fact JSON',
      JSON.stringify(
        {
          category: fact.category,
          claim: fact.claim,
          value: fact.value,
          source_ref: fact.source_ref,
          confidence: fact.confidence,
        },
        null,
        2,
      ),
    );
    if (!raw) return;
    run(() => decideFact(fact.id, 'edit', JSON.parse(raw)));
  }

  function rejectFact(fact: HarnessFact) {
    const reason = window.prompt('Rejection reason') ?? '';
    run(() => decideFact(fact.id, 'reject', { rejection_reason: reason }));
  }

  function newFact() {
    const raw = window.prompt(
      'New fact JSON',
      JSON.stringify(
        {
          category: 'capability',
          claim: '',
          value: '',
          source: 'operator-input',
          source_ref: 'operator',
          confidence: 1,
          rejection_reason: null,
        },
        null,
        2,
      ),
    );
    if (!raw) return;
    run(() => addManualFact(cardId, JSON.parse(raw)));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const fact = facts[selected];
      if (event.key === 'j') setSelected((idx) => Math.min(facts.length - 1, idx + 1));
      if (event.key === 'k') setSelected((idx) => Math.max(0, idx - 1));
      if (event.key === 'n') newFact();
      if (!fact) return;
      if (event.key === 'a') run(() => decideFact(fact.id, 'approve'));
      if (event.key === 'e') editFact(fact);
      if (event.key === 'x') rejectFact(fact);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [facts, selected]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/cards/${cardId}/grounder-run`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { run?: GrounderRun | null };
        if (!cancelled && data.run) setLiveGrounderRun(data.run);
      } catch {
        // Polling is a visibility aid; action errors are handled by the action itself.
      }
    }
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cardId, pending]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-x-3 text-xs font-mono">
          <button
            disabled={pending}
            onClick={runFactGrounder}
            className="text-state-running disabled:text-ink-4 hover:underline"
          >
            run grounder
          </button>
          <button
            disabled={pending}
            onClick={newFact}
            className="text-state-edited disabled:text-ink-4 hover:underline"
          >
            add fact
          </button>
        </div>
        <button
          disabled={pending || facts.every((f) => !['approved', 'edited', 'manual'].includes(f.status))}
          onClick={approveResearchAction}
          className="text-xs font-mono text-state-approved disabled:text-ink-4 hover:underline"
        >
          {researchApprovedAt ? 're-approve research' : 'approve research'}
        </button>
      </div>

      {facts.length === 0 ? (
        <p className="text-ink-3 text-sm">
          No facts yet. Run the grounder, or add a fact manually.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-3 text-xs font-mono uppercase">
              <tr className="border-b border-rule">
                <th className="text-left py-2 pr-3 w-8" />
                <th className="text-left py-2 pr-3">Claim</th>
                <th className="text-left py-2 pr-3">Value</th>
                <th className="text-left py-2 pr-3">Source</th>
                <th className="text-right py-2 pr-3 w-16">Conf</th>
                <th className="text-right py-2 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((f, idx) => (
                <tr
                  key={f.id}
                  onClick={() => setSelected(idx)}
                  className={`border-b border-rule/40 ${
                    f.status === 'rejected' ? 'opacity-60' : ''
                  } ${idx === selected ? 'bg-canvas' : ''}`}
                >
                  <td className={`py-2.5 pr-3 ${STATUS_TONE[f.status]} font-mono`}>
                    {STATUS_GLYPH[f.status]}
                  </td>
                  <td className="py-2.5 pr-3">{f.claim}</td>
                  <td className="py-2.5 pr-3 font-medium">{f.value}</td>
                  <td className="py-2.5 pr-3 text-ink-3 text-xs font-mono">
                    {f.source}
                    <span className="text-ink-4"> · {f.source_ref}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-ink-3">
                    {f.confidence.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right space-x-2 font-mono text-xs">
                    <button
                      disabled={pending}
                      onClick={() => run(() => decideFact(f.id, 'approve'))}
                      className="text-state-approved disabled:text-ink-4 hover:underline"
                    >
                      ✓
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => editFact(f)}
                      className="text-state-edited disabled:text-ink-4 hover:underline"
                    >
                      ✏
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => rejectFact(f)}
                      className="text-state-rejected disabled:text-ink-4 hover:underline"
                    >
                      ✗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-3 font-mono">
        Keyboard: <span className="text-ink-2">j/k</span> navigate · <span className="text-ink-2">a</span> approve ·{' '}
        <span className="text-ink-2">e</span> edit · <span className="text-ink-2">x</span> reject ·{' '}
        <span className="text-ink-2">n</span> new fact
      </p>
      {pending && <p className="text-xs text-ink-3">Working…</p>}
      {message && <p className="text-xs text-ink-3">{message}</p>}
      {error && <p className="text-xs text-state-rejected">{error}</p>}
      {(liveGrounderRun ?? latestGrounderRun) && (
        <GrounderTrace run={(liveGrounderRun ?? latestGrounderRun)!} />
      )}
    </div>
  );
}

function GrounderTrace({ run }: { run: GrounderRun }) {
  const events = parseJson<Array<Record<string, unknown>>>(run.events_json, []);
  return (
    <div className="border border-rule rounded bg-paper p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-mono text-ink-3">
          Last grounder run · {run.model ?? 'model unknown'} · {run.ground_turns ?? 0} turn
          {(run.ground_turns ?? 0) === 1 ? '' : 's'} · {run.facts_count} fact
          {run.facts_count === 1 ? '' : 's'} · {run.unverifiable_count} unverifiable
          {run.truncated ? ' · truncated' : ''}
        </p>
        <p className="text-xs font-mono text-ink-4">{run.completed_at ?? run.started_at}</p>
      </div>
      {run.error && <p className="text-xs text-state-rejected">{run.error}</p>}
      <ol className="space-y-1 text-xs font-mono text-ink-3 max-h-72 overflow-auto">
        {events.map((event, index) => (
          <li key={index} className="border-t border-rule/40 pt-1 first:border-t-0 first:pt-0">
            {formatGrounderEvent(event)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatGrounderEvent(event: Record<string, unknown>): string {
  const turn = typeof event.turn === 'number' ? `turn ${event.turn}: ` : '';
  switch (event.type) {
    case 'turn': {
      const toolNames = Array.isArray(event.tool_names) ? event.tool_names.join(', ') : '';
      const preview = typeof event.text_preview === 'string' && event.text_preview ? ` · text: ${event.text_preview}` : '';
      return `${turn}model responded${toolNames ? ` · tools: ${toolNames}` : ' · no tools'}${preview}`;
    }
    case 'tool_call':
      return `${turn}calling ${String(event.name)} ${compactJson(event.input)}`;
    case 'tool_result':
      return `${turn}${String(event.name)} result: ${String(event.content_preview ?? '').slice(0, 300)}`;
    case 'record_fact': {
      const fact = isRecord(event.fact) ? event.fact : {};
      return `${turn}recorded fact · ${String(fact.claim ?? '')}: ${String(fact.value ?? '')} (${String(fact.source ?? '')})`;
    }
    case 'unverifiable':
      return `${turn}unverifiable · ${String(event.claim ?? '')}: ${String(event.reason ?? '')}`;
    case 'done':
      return `${turn}done_grounding`;
    case 'empty_response':
      return `${turn}empty tool response${event.text_preview ? ` · ${String(event.text_preview)}` : ''}`;
    case 'truncated':
      return `${turn}truncated · ${String(event.reason ?? '')}`;
    default:
      return compactJson(event);
  }
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
