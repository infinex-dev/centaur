'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  checkCopy,
  groundForDirector,
  generateWithActor,
  loadCardFacts,
  type DirectorRegen,
  type DirectorCheckResult,
  type DirectorLight,
  type GroundedCardRef,
  type Surface,
} from '@/app/actions/director';

const SURFACES: { id: Surface; label: string }[] = [
  { id: 'tweet', label: 'tweet' },
  { id: 'web', label: 'web' },
  { id: 'in-product', label: 'in-product' },
  { id: 'modal', label: 'modal' },
  { id: 'email', label: 'email' },
];

const LIGHT_TONE: Record<DirectorLight, string> = {
  green: 'bg-state-approved',
  amber: 'bg-state-awaiting',
  red: 'bg-state-rejected',
};
const LIGHT_TEXT: Record<DirectorLight, string> = {
  green: 'text-state-approved',
  amber: 'text-state-awaiting',
  red: 'text-state-rejected',
};
const LIGHT_WORD: Record<DirectorLight, string> = { green: 'GREEN', amber: 'AMBER', red: 'RED' };

export function DirectorConsole({
  history = [],
  regens = [],
  groundedCards = [],
}: {
  history?: DirectorCheckResult[];
  regens?: DirectorRegen[];
  groundedCards?: GroundedCardRef[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [surface, setSurface] = useState<Surface>('modal');
  const [facts, setFacts] = useState('');
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<DirectorCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [brief, setBrief] = useState('');
  const [groundInfo, setGroundInfo] = useState<{ cardId: string; count: number; unverifiable: number } | null>(null);
  const [groundError, setGroundError] = useState<string | null>(null);
  const [grounding, startGrounding] = useTransition();

  const runningOnMount = regens.find((r) => r.status === 'running') ?? null;
  const [activeRegen, setActiveRegen] = useState<DirectorRegen | null>(runningOnMount);
  const [regenId, setRegenId] = useState<string | null>(runningOnMount?.id ?? null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [, startRegen] = useTransition();
  const regenInFlight = activeRegen?.status === 'running';

  // Poll the active regen while it runs. Survives navigation: if a still-running
  // row was passed in on mount, we resume polling it automatically.
  useEffect(() => {
    if (!regenId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/director/regens/${regenId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!stop && data.regen) {
          setActiveRegen(data.regen);
          if (data.regen.status !== 'running') {
            stop = true;
            router.refresh();
            return;
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (!stop) setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 1000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [regenId, router]);

  function handoff() {
    setRegenError(null);
    const id = crypto.randomUUID();
    setRegenId(id);
    setActiveRegen({
      id,
      cardId: null,
      surface,
      draft: text,
      status: 'running',
      phase: 'grounding',
      factCount: null,
      events: [],
      candidates: [],
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    startRegen(async () => {
      try {
        await generateWithActor({ text, surface, title, facts, regenId: id });
      } catch (err) {
        setRegenError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function ground() {
    setGroundError(null);
    startGrounding(async () => {
      try {
        const r = await groundForDirector(brief);
        setFacts(r.facts.join('\n'));
        setGroundInfo({ cardId: r.cardId, count: r.facts.length, unverifiable: r.unverifiable.length });
      } catch (err) {
        setGroundInfo(null);
        setGroundError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function reuseGrounding(cardId: string) {
    if (!cardId) return;
    setGroundError(null);
    startGrounding(async () => {
      try {
        const loaded = await loadCardFacts(cardId);
        setFacts(loaded.join('\n'));
        setGroundInfo({ cardId, count: loaded.length, unverifiable: 0 });
      } catch (err) {
        setGroundError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await checkCopy({ text, surface, facts, title });
        setResult(r);
        router.refresh(); // re-render the server page so the history list picks up the new check
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function load(check: DirectorCheckResult) {
    setResult(check);
    setText(check.text);
    setSurface(check.surface);
    setTitle(check.title ?? '');
    setError(null);
  }

  return (
    <div className="space-y-8">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── inputs ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* ground first → builds the fact source */}
        <div className="space-y-1 rounded border border-rule bg-canvas p-3">
          <label className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
            ground first <span className="text-ink-4">(optional — builds the fact source)</span>
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="Tell the grounder what you're building — e.g. 'Hyperliquid spot launch, deposit-incentive modal'"
            className="w-full resize-y rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={ground}
              disabled={grounding || !brief.trim()}
              className="text-xs font-mono text-state-running hover:underline disabled:text-ink-4"
            >
              {grounding ? 'grounding… (full research loop, ~30–60s)' : 'ground a card'}
            </button>
            {groundInfo && (
              <span className="text-[11px] text-ink-3">
                grounded {groundInfo.count} facts → card{' '}
                <a href={`/cards/${groundInfo.cardId}`} className="underline hover:text-ink" target="_blank" rel="noreferrer">
                  {groundInfo.cardId.slice(0, 8)}
                </a>
                {groundInfo.unverifiable > 0 && <span className="text-ink-4"> · {groundInfo.unverifiable} unverifiable</span>}
              </span>
            )}
          </div>
          {groundedCards.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-ink-4">or reuse a previous grounding:</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) reuseGrounding(e.target.value);
                }}
                disabled={grounding}
                className="max-w-[20rem] rounded border border-rule bg-paper px-2 py-1 text-[11px] text-ink focus:border-ink focus:outline-none"
              >
                <option value="">a card you already grounded…</option>
                {groundedCards.map((g) => (
                  <option key={g.cardId} value={g.cardId}>
                    {g.brief.slice(0, 48)} ({g.factCount} facts)
                  </option>
                ))}
              </select>
            </div>
          )}
          {groundError && <p className="whitespace-pre-wrap text-xs text-state-rejected">{groundError}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-ink-3">surface</label>
          <div className="flex flex-wrap gap-1.5">
            {SURFACES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSurface(s.id)}
                className={`rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                  surface === s.id
                    ? 'border-ink bg-ink text-paper'
                    : 'border-rule text-ink-3 hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
            what is this? <span className="text-ink-4">(optional context label)</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. deposit incentive modal"
            className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-ink-3">copy to judge</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste the tweet / modal / email copy here…"
            className="w-full resize-y rounded border border-rule bg-paper px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
            fact source <span className="text-ink-4">(optional — one fact per line)</span>
          </label>
          <textarea
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            rows={4}
            placeholder={'Leave blank for a voice-only read.\nThe grounder will build this card for you in the next build.'}
            className="w-full resize-y rounded border border-rule bg-paper px-3 py-2 font-mono text-xs leading-relaxed text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
          />
          <p className="text-[11px] text-ink-4">
            No facts → the fact axis can&apos;t be verified (amber). The Director still judges voice blind.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={pending || regenInFlight || !text.trim()}
            className="rounded bg-ink px-4 py-2 text-sm font-mono text-paper hover:bg-ink-2 disabled:bg-ink-4 disabled:text-paper/70"
          >
            {pending ? 'director reading…' : 'check with director'}
          </button>
          <button
            onClick={handoff}
            disabled={regenInFlight || pending || !text.trim()}
            title="Too complicated to hand-fix? Hand it to the Actor: your draft seeds the grounder, it grounds against the branch, and rebuilds on-spec, Director-passed copy. Runs in the background — you can navigate away and come back."
            className="rounded border border-ink px-4 py-2 text-sm font-mono text-ink hover:bg-canvas disabled:border-ink-4 disabled:text-ink-4"
          >
            {regenInFlight ? 'rebuilding… (runs in background)' : 'generate with actor'}
          </button>
        </div>
        {error && <p className="whitespace-pre-wrap text-xs text-state-rejected">{error}</p>}
        {regenError && <p className="whitespace-pre-wrap text-xs text-state-rejected">{regenError}</p>}
      </div>

      {/* ── verdict ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {activeRegen && <RegenPanel regen={activeRegen} onLoad={(t) => { setText(t); setResult(null); }} />}
        {!result && !activeRegen && !pending && (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded border border-dashed border-rule">
            <p className="max-w-xs text-center text-sm text-ink-4">
              The Director judges whether copy fits the Infinex voice — placement, tempo, drive — and flags claims it
              can&apos;t verify. It never rewrites; it tells you why.
            </p>
          </div>
        )}
        {result && <Verdict result={result} />}
      </div>
    </div>

      {regens.length > 0 && (
        <RebuildsStrip
          regens={regens}
          activeId={activeRegen?.id}
          onView={(r) => {
            setActiveRegen(r);
            setRegenId(r.status === 'running' ? r.id : null);
          }}
        />
      )}
      {history.length > 0 && <HistoryStrip history={history} onLoad={load} activeId={result?.id} />}
    </div>
  );
}

function RegenPanel({ regen, onLoad }: { regen: DirectorRegen; onLoad: (text: string) => void }) {
  const running = regen.status === 'running';
  return (
    <div className="space-y-2 rounded border border-ink/30 bg-canvas p-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
        {running ? (
          <span className="text-state-running">● actor rebuilding — {regen.phase ?? 'working'}…</span>
        ) : regen.status === 'error' ? (
          <span className="text-state-rejected">rebuild failed</span>
        ) : (
          <span>actor rebuilt it</span>
        )}
        {regen.factCount != null && <span className="text-ink-4"> · {regen.factCount} grounded facts</span>}
        {regen.cardId && (
          <a href={`/cards/${regen.cardId}`} target="_blank" rel="noreferrer" className="text-ink-4 underline hover:text-ink">
            {' '}
            · card {regen.cardId.slice(0, 8)}
          </a>
        )}
      </p>

      {running && (
        <ul className="space-y-0.5 font-mono text-[11px] text-ink-3">
          {regen.events.slice(-8).map((e, i) => (
            <li key={i}>
              <span className="text-ink-4">
                {e.attempt ? `a${e.attempt} ` : ''}
                {e.event_type}
              </span>{' '}
              — {e.message}
            </li>
          ))}
          <li className="text-ink-4">…runs in the background (~1–3 min) — you can leave this page and come back.</li>
        </ul>
      )}

      {regen.status === 'error' && <p className="whitespace-pre-wrap text-xs text-state-rejected">{regen.error}</p>}

      {!running &&
        regen.status !== 'error' &&
        (regen.candidates.length === 0 ? (
          <p className="text-xs text-state-rejected">
            The Actor couldn&apos;t land a Director-passing version in 2 attempts. Try rewriting, or rephrase so the
            grounder can find the feature on the branch.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {regen.candidates.map((c, i) => (
                <li key={i}>
                  <button
                    onClick={() => onLoad(c.text)}
                    className="w-full rounded border border-rule bg-paper p-3 text-left hover:border-ink"
                    title="Load into the copy box → check with director"
                  >
                    <p className="text-sm text-ink">{c.text}</p>
                    {c.rationale && <p className="mt-1 text-[11px] italic text-ink-3">{c.rationale}</p>}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-4">Click one to load it into the copy box, then check it.</p>
          </>
        ))}
    </div>
  );
}

function RebuildsStrip({
  regens,
  onView,
  activeId,
}: {
  regens: DirectorRegen[];
  onView: (r: DirectorRegen) => void;
  activeId?: string;
}) {
  const tone: Record<DirectorRegen['status'], string> = {
    running: 'bg-state-running',
    done: 'bg-state-approved',
    exhausted: 'bg-state-awaiting',
    error: 'bg-state-rejected',
  };
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
        actor rebuilds <span className="text-ink-4">({regens.length})</span>
      </p>
      <ul className="divide-y divide-rule overflow-hidden rounded border border-rule">
        {regens.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onView(r)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas ${activeId === r.id ? 'bg-canvas' : ''}`}
            >
              <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone[r.status]}`} />
              <span className="w-20 shrink-0 font-mono text-[11px] text-ink-4">{r.surface}</span>
              <span className="truncate text-xs text-ink-2">{r.draft}</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-4">
                {r.status === 'running' ? 'running…' : r.status === 'done' ? `${r.candidates.length} option(s)` : r.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryStrip({
  history,
  onLoad,
  activeId,
}: {
  history: DirectorCheckResult[];
  onLoad: (c: DirectorCheckResult) => void;
  activeId?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
        recent checks <span className="text-ink-4">({history.length})</span>
      </p>
      <ul className="divide-y divide-rule overflow-hidden rounded border border-rule">
        {history.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onLoad(c)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas ${
                activeId === c.id ? 'bg-canvas' : ''
              }`}
            >
              <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${LIGHT_TONE[c.light]}`} />
              <span className="w-20 shrink-0 font-mono text-[11px] text-ink-4">{c.surface}</span>
              <span className="truncate text-xs text-ink-2">
                {c.title ? <span className="text-ink">{c.title} — </span> : null}
                {c.text}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-4">{relTime(c.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function relTime(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Verdict({ result }: { result: DirectorCheckResult }) {
  return (
    <div className="space-y-4">
      {/* headline light */}
      <div className="flex items-center gap-3 rounded border border-rule p-4">
        <span className={`inline-block h-4 w-4 rounded-full ${LIGHT_TONE[result.light]}`} />
        <span className={`text-2xl font-semibold tracking-tight ${LIGHT_TEXT[result.light]}`}>
          {LIGHT_WORD[result.light]}
        </span>
        <span className="ml-auto text-[11px] font-mono text-ink-4">
          {result.surface} · {result.model}
        </span>
      </div>

      {/* voice axis */}
      <AxisCard title="voice / character" light={result.voice.light}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Row k="tempo" v={`${result.voice.primary_tempo} · ${(result.voice.confidence * 100).toFixed(0)}%`} />
          <Row k="drive" v={result.voice.drive_read} />
          <Row k="placement" v={result.voice.legal ? 'legal' : 'OFF-SPEC'} tone={result.voice.legal ? undefined : 'text-state-rejected'} />
          {result.voice.nearest_allowed_read && <Row k="nearest legal" v={result.voice.nearest_allowed_read} />}
        </dl>
        {result.voice.placement_read && (
          <p className="mt-2 text-xs italic text-ink-2">{result.voice.placement_read}</p>
        )}
        <IssueList items={result.voice.issues} />
      </AxisCard>

      {/* fact axis */}
      <AxisCard title={`fact / claims — ${result.fact.status.replace('_', ' ')}`} light={result.fact.light}>
        <IssueList items={result.fact.issues} empty="All claims supported by the attached facts." />
      </AxisCard>

      {/* regex front door */}
      {!result.regex.passed && (
        <AxisCard title="regex front door" light="red">
          <IssueList items={result.regex.failures.map((f) => `${f.rule}: ${f.reason}`)} />
        </AxisCard>
      )}

      {/* publication gate (informational) */}
      {result.publication.issues.length > 0 && (
        <div className="rounded border border-rule p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
            publication gate <span className="text-ink-4">(human ship-gate concern, not in the light)</span>
          </p>
          <IssueList items={result.publication.issues} />
        </div>
      )}

      {/* notes — the "why" / what to fix */}
      {result.notes.length > 0 && (
        <div className="rounded border border-rule bg-canvas p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-3">notes</p>
          <ul className="mt-1 space-y-1">
            {result.notes.map((n, i) => (
              <li key={i} className="text-xs leading-relaxed text-ink-2">
                — {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AxisCard({
  title,
  light,
  children,
}: {
  title: string;
  light: DirectorLight;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-rule p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${LIGHT_TONE[light]}`} />
        <p className="text-[10px] font-mono uppercase tracking-wider text-ink-3">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <>
      <dt className="font-mono text-ink-4">{k}</dt>
      <dd className={tone ?? 'text-ink'}>{v}</dd>
    </>
  );
}

function IssueList({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) {
    return empty ? <p className="text-xs text-ink-4">{empty}</p> : null;
  }
  return (
    <ul className="mt-1 space-y-1">
      {items.map((it, i) => (
        <li key={i} className="text-xs leading-relaxed text-ink-2">
          — {it}
        </li>
      ))}
    </ul>
  );
}
