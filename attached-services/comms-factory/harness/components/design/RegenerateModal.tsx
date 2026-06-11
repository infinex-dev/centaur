'use client';

/**
 * RegenerateModal — operator handback for one surface. Two independently-tickable
 * steps, each with its own prompt, mapping straight onto the pipeline:
 *   ☑ Reground   → grounder researches the prompt → facts into deployed_facts
 *   ☑ Regenerate → actor rewrites (seeded from the edited pick + prompt)
 *   (Director always judges the regenerated result.)
 *
 * Reground-only just refreshes the facts. Regenerate runs async; the best result
 * is auto-picked and shows on the surface card when the run completes (the run-
 * events poller refreshes the page).
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { regenerateSurface, continueHandback, saveHandbackPromptDraft } from '@/app/actions/handback';
import { ActorRunEventsPanel } from '../ActorRunEventsPanel';
import type { Channel, HarnessActorRun } from '@/lib/types';
import type { SurfaceKind } from '@/lib/surfaces';

export function RegenerateModal({
  cardId,
  channel,
  candidateId,
  surface,
  canSplice,
  onClose,
}: {
  cardId: string;
  channel: Channel;
  candidateId: string;
  surface: SurfaceKind;
  /** The edited copy has a toggle stub to fill — enables block scope. */
  canSplice: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reground, setReground] = useState(false);
  const [regroundPrompt, setRegroundPrompt] = useState('');
  const [regenerate, setRegenerate] = useState(true);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [scope, setScope] = useState<'block' | 'whole'>(canSplice ? 'block' : 'whole');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<HarnessActorRun | null>(null);
  const [restored, setRestored] = useState(false);
  const [halt, setHalt] = useState<{ claim: string; reason: string }[] | null>(null);
  const [vouchText, setVouchText] = useState('');

  // ── Prompt persistence ───────────────────────────────────────────────────
  // localStorage autosaves every keystroke (survives reload, hot-reload, crash —
  // restored instantly on reopen). The server gets a durable record on blur and on
  // submit. A prompt is never lost again.
  const lsKey = `cf-handback:${cardId}:${channel}`;
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<{
        reground: boolean; regroundPrompt: string; regenerate: boolean; regeneratePrompt: string; scope: 'block' | 'whole';
      }>;
      if (typeof d.regroundPrompt === 'string') setRegroundPrompt(d.regroundPrompt);
      if (typeof d.regeneratePrompt === 'string') setRegeneratePrompt(d.regeneratePrompt);
      if (typeof d.reground === 'boolean') setReground(d.reground);
      if (typeof d.regenerate === 'boolean') setRegenerate(d.regenerate);
      if (d.scope) setScope(d.scope);
      if ((d.regroundPrompt ?? '').trim() || (d.regeneratePrompt ?? '').trim()) setRestored(true);
    } catch {
      // ignore corrupt drafts
    }
  }, [lsKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify({ reground, regroundPrompt, regenerate, regeneratePrompt, scope }));
    } catch {
      // storage full / unavailable — server record still covers submit + blur
    }
  }, [lsKey, reground, regroundPrompt, regenerate, regeneratePrompt, scope]);

  function saveDraft() {
    void saveHandbackPromptDraft(cardId, channel, regroundPrompt, regeneratePrompt, scope).catch(() => {});
  }

  function run() {
    if (!reground && !regenerate) {
      setError('Tick reground, regenerate, or both.');
      return;
    }
    if (reground && !regroundPrompt.trim()) {
      setError('Give the grounder something to research.');
      return;
    }
    if (regenerate && !regeneratePrompt.trim()) {
      setError('Tell the actor what to change.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await regenerateSurface(cardId, channel, candidateId, {
          ...(reground ? { reground: { prompt: regroundPrompt } } : {}),
          ...(regenerate ? { regenerate: { prompt: regeneratePrompt } } : {}),
          scope,
        });
        setActiveRun(res.run); // switch to the live progress view
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  // Detect the reground gate halting the run before hand-off, and surface it.
  useEffect(() => {
    if (!activeRun || halt) return;
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`/api/cards/${cardId}/actor-events?run_id=${encodeURIComponent(activeRun.id)}`, { cache: 'no-store' });
        if (!r.ok) return;
        const body = (await r.json()) as { events?: { event_type: string; payload_json: string }[] };
        const ev = (body.events ?? []).find((e) => e.event_type === 'reground_halted');
        if (ev && !cancelled) {
          let claims: { claim: string; reason: string }[] = [];
          try {
            claims = (JSON.parse(ev.payload_json).unverifiable ?? []) as { claim: string; reason: string }[];
          } catch {
            // payload unparseable — show an empty list, still halt
          }
          setHalt(claims);
          setVouchText(claims.map((c) => c.claim).join('\n'));
        }
      } catch {
        // polling must not break the modal
      }
    };
    void check();
    const t = window.setInterval(check, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeRun, halt, cardId]);

  function continueWith(vouchedFacts: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await continueHandback(cardId, channel, candidateId, { vouchedFacts, regeneratePrompt, scope });
        setHalt(null);
        setActiveRun(res.run);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  // ── Decision view: reground gate halted — vouch / proceed / cancel ───────
  if (halt) {
    return (
      <div className="rg-scrim" onClick={onClose}>
        <div className="rg-modal" onClick={(e) => e.stopPropagation()}>
          <div className="rg-head">
            <span className="rg-title">⚠ Grounder couldn&apos;t verify · {surface}</span>
            <button type="button" className="rg-x" onClick={onClose} aria-label="close">×</button>
          </div>
          <p className="rg-halt-note">
            Run <strong>stopped</strong> — nothing was handed to the actor. The grounder couldn&apos;t cite these from
            our code, the UI, or accessible docs:
          </p>
          <ul className="rg-halt-list">
            {halt.map((c, i) => (
              <li key={i}>
                <span className="rg-halt-claim">{c.claim}</span>
                <span className="rg-halt-reason">{c.reason}</span>
              </li>
            ))}
            {halt.length === 0 && <li className="rg-halt-reason">(see the trace for details)</li>}
          </ul>
          <label className="rg-step">
            <span className="rg-step-name">Vouch these yourself</span>
            <span className="rg-step-sub">
              edit to the true values, one per line — these become operator-confirmed facts the actor may assert.
            </span>
            <textarea
              className="rg-prompt"
              rows={Math.min(7, Math.max(3, halt.length + 1))}
              value={vouchText}
              onChange={(e) => setVouchText(e.target.value)}
            />
          </label>
          {error && <div className="rg-error">{error}</div>}
          <div className="rg-bar">
            <button type="button" className="rg-cancel" disabled={pending} onClick={onClose}>cancel</button>
            <button type="button" className="rg-cancel" disabled={pending} onClick={() => continueWith([])}>
              regenerate without it
            </button>
            <button
              type="button"
              className="rg-run"
              disabled={pending}
              onClick={() => continueWith(vouchText.split('\n').map((s) => s.trim()).filter(Boolean))}
            >
              {pending ? '…' : 'vouch & continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Progress view: live grounder → actor → director trace ────────────────
  if (activeRun) {
    return (
      <div className="rg-scrim" onClick={onClose}>
        <div className="rg-modal" onClick={(e) => e.stopPropagation()}>
          <div className="rg-head">
            <span className="rg-title">Regenerating · {surface}</span>
            <button type="button" className="rg-x" onClick={onClose} aria-label="close">×</button>
          </div>
          <p className="rg-running-note">
            {reground && 'Grounder researching, then '}
            actor rewriting, director judging. The best draft is auto-picked here when it finishes —
            you can close this and keep working; the surface updates on its own.
          </p>
          <div className="rg-trace">
            <ActorRunEventsPanel cardId={cardId} initialRun={activeRun} />
          </div>
          <div className="rg-bar">
            <button type="button" className="rg-run" onClick={onClose}>done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rg-scrim" onClick={onClose}>
      <div className="rg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rg-head">
          <span className="rg-title">Regenerate · {surface}</span>
          <button type="button" className="rg-x" onClick={onClose} aria-label="close">×</button>
        </div>

        {restored && <div className="rg-restored">↺ restored your last prompt (autosaved)</div>}

        <label className="rg-step">
          <span className="rg-step-top">
            <input type="checkbox" checked={reground} onChange={(e) => setReground(e.target.checked)} />
            <span className="rg-step-name">Reground</span>
            <span className="rg-step-sub">research before rewriting</span>
          </span>
          <textarea
            className="rg-prompt"
            rows={2}
            placeholder="e.g. avg ACH + wire settlement times for Bridge.xyz"
            value={regroundPrompt}
            disabled={!reground}
            onChange={(e) => setRegroundPrompt(e.target.value)}
            onBlur={saveDraft}
          />
        </label>

        <label className="rg-step">
          <span className="rg-step-top">
            <input type="checkbox" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
            <span className="rg-step-name">Regenerate</span>
            <span className="rg-step-sub">rewrite with the actor</span>
          </span>
          <textarea
            className="rg-prompt"
            rows={3}
            placeholder={'e.g. fill the "How long does it take?" toggle with the grounded times; leave the rest exactly as I edited it'}
            value={regeneratePrompt}
            disabled={!regenerate}
            onChange={(e) => setRegeneratePrompt(e.target.value)}
            onBlur={saveDraft}
          />
          {regenerate && canSplice && (
            <span className="rg-scope">
              <span className="rg-scope-lab">scope</span>
              <label className={scope === 'block' ? 'is-active' : ''}>
                <input type="radio" name="scope" checked={scope === 'block'} onChange={() => setScope('block')} />
                just my edit / this block
              </label>
              <label className={scope === 'whole' ? 'is-active' : ''}>
                <input type="radio" name="scope" checked={scope === 'whole'} onChange={() => setScope('whole')} />
                whole post
              </label>
            </span>
          )}
        </label>

        <div className="rg-director">— Director judges the result (always) —</div>

        {error && <div className="rg-error">{error}</div>}

        <div className="rg-bar">
          <button type="button" className="rg-cancel" onClick={onClose} disabled={pending}>cancel</button>
          <button type="button" className="rg-run" onClick={run} disabled={pending}>
            {pending ? 'running…' : 'run →'}
          </button>
        </div>
      </div>
    </div>
  );
}
