'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { abandonCard, completeCard, shipPick, sendThreadToTypefully } from '@/app/actions/ship';
import {
  emitPlatformPR,
  getPromoteStatus,
  promoteProdPRNow,
  type EmitPlatformResult,
  type PromoteStatus,
  type RoadmapChangeSummary,
} from '@/app/actions/emit';
import { freshenSurface, saveSurfaceEdit } from '@/app/actions/surface-edit';
import { toXArticle, xArticleHtml, xArticlePlain } from '@/lib/x-article';
import { copyRichText } from '@/lib/copy-rich';
import type { FinalPick } from '@/lib/types';

export function ShipPanel({ cardId, picks }: { cardId: string; picks: FinalPick[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [tfDraft, setTfDraft] = useState<{ url: string | null; count: number; mediaCount: number } | null>(null);
  const [datesMsg, setDatesMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [editingPickId, setEditingPickId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [pending, startTransition] = useTransition();
  const [emit, setEmit] = useState<EmitPlatformResult | null>(null);
  const [promoteToProd, setPromoteToProd] = useState(true);
  const [promote, setPromote] = useState<PromoteStatus>({ phase: 'none' });

  // Poll the promotion watcher while it's live (and once on mount, so a page
  // reload mid-watch picks the status back up).
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const status = await getPromoteStatus(cardId);
        if (!cancelled) setPromote(status);
      } catch {
        // status poll is best-effort
      }
    }
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cardId]);

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

  function sendTypefully(pickId: string) {
    setError(null);
    setTfDraft(null);
    startTransition(async () => {
      try {
        const res = await sendThreadToTypefully(pickId);
        setTfDraft({ url: res.url, count: res.count, mediaCount: res.mediaCount });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function refreshDates() {
    setError(null);
    setDatesMsg(null);
    startTransition(async () => {
      try {
        const results = await Promise.all(picks.map((p) => freshenSurface(p.candidate_id)));
        const total = results.reduce((n, r) => n + r.changes.length, 0);
        const touched = results.filter((r) => r.changes.length > 0).length;
        setDatesMsg(total === 0 ? 'dates current ✓' : `🗓 bumped ${total} date${total === 1 ? '' : 's'} across ${touched} pick${touched === 1 ? '' : 's'}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function copyForXArticle(text: string) {
    setError(null);
    setCopyMsg(null);
    const art = toXArticle(text);
    // Copy SYNCHRONOUSLY first (lands before focus shifts), THEN open the composer
    // in the same gesture. X can't be prefilled (closed WYSIWYG) — you paste (⌘V).
    const ok = copyRichText(xArticleHtml(art), xArticlePlain(art));
    window.open('https://x.com/compose/articles', '_blank', 'noopener,noreferrer');
    setCopyMsg(
      ok
        ? `✓ Copied — paste (⌘V) into the X article composer that just opened. Title: “${art.title}”`
        : '⚠ Copy may have been blocked by the browser — click again, or use the Package-tab copy.',
    );
  }

  function beginEdit(pick: FinalPick) {
    setError(null);
    setEditingPickId(pick.id);
    setEditText(pick.final_text);
  }

  function saveEdit(pick: FinalPick) {
    setError(null);
    startTransition(async () => {
      try {
        await saveSurfaceEdit(pick.candidate_id, editText, pick.final_structured_json);
        setEditingPickId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function emitPR(live: boolean) {
    if (live && !window.confirm('Open a REAL platform PR for human review? (it never merges)')) return;
    setError(null);
    setEmit(null);
    startTransition(async () => {
      try {
        const res = await emitPlatformPR(cardId, { live, promoteToProd });
        setEmit(res);
        if (res.promoteWatch) setPromote({ phase: 'watching' });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function promoteNow() {
    const mainPrNumber = promote.mainPrNumber ?? prNumberFromEmit(emit);
    const input = mainPrNumber ?? Number(window.prompt('Platform main PR number to promote (e.g. 14754):') ?? '');
    if (!Number.isInteger(input) || input <= 0) return;
    if (!window.confirm(`Open a prod promotion PR for platform #${input}? (cherry-pick onto prod; sneed merges)`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await promoteProdPRNow(cardId, input);
        setPromote({ phase: 'done', mainPrNumber: input, prodPrUrl: res.prUrl });
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
          {editingPickId === pick.id ? (
            <div className="px-4 py-3">
              <textarea
                className="surf-editor-source"
                value={editText}
                spellCheck={false}
                autoFocus
                rows={pick.channel === 'blog' ? 18 : 6}
                onChange={(e) => setEditText(e.target.value)}
              />
            </div>
          ) : (
            <div className="px-4 py-3 whitespace-pre-wrap text-sm">{pick.final_text}</div>
          )}
          <footer className="px-4 py-3 border-t border-rule space-x-3 text-xs font-mono">
            {editingPickId === pick.id ? (
              <>
                <button
                  disabled={pending}
                  onClick={() => saveEdit(pick)}
                  className="text-state-edited disabled:text-ink-4 hover:underline font-semibold"
                >
                  {pending ? 'saving…' : 'save'}
                </button>
                <button
                  disabled={pending}
                  onClick={() => setEditingPickId(null)}
                  className="text-ink-3 disabled:text-ink-4 hover:underline"
                >
                  cancel
                </button>
              </>
            ) : (
              <>
            <button
              disabled={pending}
              onClick={() => beginEdit(pick)}
              title="Edit this final pick's copy before shipping"
              className="text-state-edited disabled:text-ink-4 hover:underline"
            >
              edit
            </button>
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
            {(pick.channel === 'x-thread' || pick.channel === 'x') && (
              <button
                disabled={pending}
                onClick={() => sendTypefully(pick.id)}
                title="Create a DRAFT thread in Typefully and attach stored images. Needs TYPEFULLY_API_KEY in .env.local."
                className="text-state-approved disabled:text-ink-4 hover:underline"
              >
                → Typefully draft
              </button>
            )}
            {pick.channel === 'blog' && (
              <>
                <button
                  disabled={pending}
                  onClick={() => copyForXArticle(pick.final_text)}
                  title="Copy as a formatted X Article body — paste straight into X's article composer"
                  className="text-state-running disabled:text-ink-4 hover:underline"
                >
                  copy for X article
                </button>
                <a
                  href={`/cards/${cardId}/news-preview/${pick.candidate_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-3 hover:text-ink hover:underline"
                >
                  view as page ↗
                </a>
              </>
            )}
              </>
            )}
          </footer>
        </article>
      ))}
      {copyMsg && <div className="text-xs text-state-running">{copyMsg}</div>}
      {tfDraft && (
        <div className="text-xs text-state-approved">
          ✓ Typefully draft created ({tfDraft.count} tweet{tfDraft.count === 1 ? '' : 's'}
          {tfDraft.mediaCount > 0 ? `, ${tfDraft.mediaCount} media` : ''}, draft-only) —{' '}
          {tfDraft.url ? (
            <a href={tfDraft.url} target="_blank" rel="noreferrer" className="underline hover:text-ink">
              open in Typefully ↗
            </a>
          ) : (
            'open Typefully to review + publish.'
          )}
        </div>
      )}
      <div className="space-x-3 text-xs font-mono">
        <button
          disabled={pending}
          onClick={refreshDates}
          title="Bump any stale publish date in every pick to today (deterministic) — last-minute fix before emit"
          className="text-state-edited disabled:text-ink-4 hover:underline"
        >
          refresh dates
        </button>
        {datesMsg && <span className="text-ink-3">{datesMsg}</span>}
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
        <label
          className="flex items-center gap-1 text-ink-3 cursor-pointer select-none"
          title="After the main PR merges, auto-open a second PR cherry-picking the content onto prod — makes the in-app changelog popout go live without waiting for the next platform release. Platform owner still merges it."
        >
          <input
            type="checkbox"
            checked={promoteToProd}
            onChange={(e) => setPromoteToProd(e.target.checked)}
            disabled={pending}
          />
          promote to prod
        </label>
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
            roadmap: {roadmapSummaryText(emit.roadmapChanges, emit.proposedRoadmap)}
          </div>
          {emit.roadmapChanges.length > 0 && (
            <ul className="space-y-1 text-ink-2">
              {emit.roadmapChanges.map((change) => (
                <li key={`${change.reason}:${change.path}`}>
                  <span className="font-mono">{change.path}</span>: {formatRoadmapStatus(change.from)} → {change.to}
                  {change.reason === 'parent-rollup' ? ' (auto parent roll-up)' : ''}
                </li>
              ))}
            </ul>
          )}
          {emit.prUrl ? (
            <>
              <a
                href={emit.prUrl}
                target="_blank"
                rel="noreferrer"
                className="text-state-approved hover:underline font-mono"
              >
                PR opened → {emit.prUrl}
              </a>
              <div className="font-mono text-ink-3">
                go-live: website + test app on merge; PROD in-app popout needs the prod promotion below.
              </div>
            </>
          ) : (
            <>
              {emit.prDescription && (
                <>
                  <div className="font-mono text-ink-3">dry-run — GitHub PR description:</div>
                  <pre className="whitespace-pre-wrap overflow-x-auto max-h-48 text-ink-2">{emit.prDescription}</pre>
                </>
              )}
              <div className="font-mono text-ink-3">
                dry-run — planned platform diff (changelog + roadmap; no PR opened, nothing pushed):
              </div>
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-80 text-ink-2">{emit.plannedDiff}</pre>
            </>
          )}
        </div>
      )}
      {promote.phase !== 'none' && (
        <div className="border border-rule rounded bg-paper p-3 text-xs font-mono space-y-1">
          {promote.phase === 'watching' && (
            <span className="text-state-running">
              promote to prod: watching platform PR{promote.mainPrNumber ? ` #${promote.mainPrNumber}` : ''} for merge
              {promote.mainPrState ? ` (currently ${promote.mainPrState})` : ''}… prod PR opens automatically on merge.
            </span>
          )}
          {promote.phase === 'promoting' && (
            <span className="text-state-running">promote to prod: main PR merged — opening the prod promotion PR…</span>
          )}
          {promote.phase === 'done' &&
            (promote.prodPrUrl ? (
              <a href={promote.prodPrUrl} target="_blank" rel="noreferrer" className="text-state-approved hover:underline">
                prod promotion PR opened → {promote.prodPrUrl} (platform owner merges; deploy is automatic)
              </a>
            ) : (
              <span className="text-state-approved">prod promotion PR opened.</span>
            ))}
          {promote.phase === 'error' && (
            <span className="text-state-rejected">promote to prod failed: {promote.error ?? 'unknown error'}</span>
          )}
        </div>
      )}
      {(promote.phase === 'error' || promote.phase === 'none') && emit?.prUrl && (
        <button
          disabled={pending}
          onClick={promoteNow}
          className="text-xs font-mono text-state-running disabled:text-ink-4 hover:underline"
          title="Manual fallback: cherry-pick the merged main PR onto prod and open the promotion PR (main PR must be merged first)"
        >
          promote to prod now
        </button>
      )}
      {pending && <p className="text-xs text-ink-3">Working…</p>}
      {error && <p className="text-xs text-state-rejected">{error}</p>}
    </div>
  );
}

function prNumberFromEmit(emit: EmitPlatformResult | null): number | null {
  const match = emit?.prUrl?.match(/\/pull\/(\d+)(?:\D|$)/);
  const n = match ? Number(match[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function roadmapSummaryText(
  changes: RoadmapChangeSummary[],
  proposedRoadmap: EmitPlatformResult['proposedRoadmap'],
): string {
  if (changes.length > 0) {
    const parentCount = changes.filter((change) => change.reason === 'parent-rollup').length;
    const suffix = parentCount > 0 ? ` (${parentCount} parent auto-roll-up${parentCount === 1 ? '' : 's'})` : '';
    return `${changes.length} status change${changes.length === 1 ? '' : 's'}${suffix}`;
  }
  if (proposedRoadmap) {
    return `proposed "${proposedRoadmap.nodeName}" but no status change needed`;
  }
  return 'no node proposed — changelog only';
}

function formatRoadmapStatus(status: string | null): string {
  return status ?? 'unset';
}
