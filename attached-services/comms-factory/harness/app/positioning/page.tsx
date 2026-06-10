/**
 * Positioning surface — the layer ABOVE individual cards.
 *
 * Top-down spine (the super-objective) + the cross-launch through-line + each
 * launch's DERIVED positioning laddering up to it + a coherence read. The
 * cards are evidence; this view shows whether they tell one story.
 *
 * Data: latest actor attempt per card from harness.db (listCardPositioning).
 * Only cards that have been run through the actor appear — honest by
 * construction. Run a card through the harness and it shows up here.
 */

import Link from 'next/link';
import { PositioningSpine } from '@/components/PositioningSpine';
import {
  COHERENCE_READ,
  THROUGH_LINE,
  THROUGH_LINE_HIGHLIGHTS,
} from '@/lib/positioning';
import { listCardPositioning } from '@/lib/queries';
import type { CardPositioning } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<CardPositioning['status'], string> = {
  'in-progress': 'in pipeline',
  shipped: 'shipped',
  abandoned: 'abandoned',
};

const STATUS_TONE: Record<CardPositioning['status'], string> = {
  'in-progress': 'text-state-running',
  shipped: 'text-state-approved',
  abandoned: 'text-state-rejected',
};

export default async function PositioningPage() {
  const launches = listCardPositioning();

  return (
    <div className="max-w-3xl space-y-16">
      <PositioningSpine variant="full" />

      <ThroughLine />

      <section>
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-3">
          How each launch expresses it
        </h3>
        <p className="mt-1 text-xs font-mono text-ink-4">
          {launches.length} launch{launches.length === 1 ? '' : 'es'} with derived positioning ·
          latest attempt per card
        </p>
        <div className="mt-2">
          {launches.length === 0 ? (
            <p className="border border-rule rounded-md bg-paper px-5 py-4 text-sm text-ink-3">
              No launches have been run through the actor yet. Generate on a card and its derived
              positioning appears here.
            </p>
          ) : (
            launches.map((launch, i) => (
              <LaunchItem key={launch.card_id} launch={launch} index={i + 1} />
            ))
          )}
        </div>
      </section>

      <Coherence launches={launches} />

      <ReadingNotes />
    </div>
  );
}

function ThroughLine() {
  return (
    <section className="border border-rule border-l-2 border-l-state-running rounded-md bg-paper px-6 py-6">
      <p className="text-xs font-mono uppercase tracking-wider text-state-running">
        The through-line · emerges across the launches
      </p>
      <p className="mt-3 text-xl font-medium tracking-tight text-ink leading-snug">
        {highlight(THROUGH_LINE, THROUGH_LINE_HIGHLIGHTS)}
      </p>
    </section>
  );
}

function LaunchItem({ launch, index }: { launch: CardPositioning; index: number }) {
  const tw = launch.table_work;
  const num = String(index).padStart(2, '0');
  const extras: Array<[string, string | undefined]> = [
    ['Reader prior', tw.reader_prior],
    ['Obstacle', tw.obstacle],
    ['Not the point', tw.not_the_point],
  ];
  const hasExtras = extras.some(([, v]) => v);

  return (
    <article className="border-t border-rule pt-10 mt-10 first:border-t-0 first:pt-0 first:mt-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-mono uppercase tracking-wider text-ink-4">Launch {num}</p>
        <span className={`text-xs font-mono ${STATUS_TONE[launch.status]} whitespace-nowrap`}>
          {STATUS_LABEL[launch.status]}
        </span>
      </div>

      <Link
        href={`/cards/${launch.card_id}`}
        className="group mt-3 block"
      >
        <h4 className="text-xl font-medium tracking-tight text-ink leading-snug group-hover:text-ink-2">
          {launch.brief}
        </h4>
      </Link>

      {tw.through_action && (
        <p className="mt-3 text-sm text-ink-3">
          <span className="font-mono text-state-running">↳ </span>
          <span className="text-ink-2 font-medium">Through-action:</span> {tw.through_action}{' '}
          <span className="text-ink-4">— ladders to the super-objective</span>
        </p>
      )}

      {tw.thesis && (
        <p className="mt-4 text-base text-ink leading-relaxed">{tw.thesis}</p>
      )}

      {tw.lining && (
        <p className="mt-3 text-sm text-ink-3 leading-relaxed">
          <span className="font-mono uppercase tracking-wider text-ink-4 text-xs">Lining </span>
          {tw.lining}
        </p>
      )}

      {hasExtras && (
        <details className="mt-4 border border-rule rounded bg-canvas">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-ink-3 hover:text-ink">
            Table-work — what the generator derived
          </summary>
          <dl className="border-t border-rule px-4 py-3 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3">
            {extras.map(([label, value]) =>
              value ? (
                <div key={label} className="contents">
                  <dt className="text-xs font-mono uppercase tracking-wider text-ink-4 pt-0.5">
                    {label}
                  </dt>
                  <dd className="text-sm text-ink-2 leading-relaxed">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </details>
      )}

      <p className="mt-3 text-xs font-mono text-ink-4">
        attempt {launch.attempt} · {launch.generator_source} · {launch.created_at.slice(0, 10)}
      </p>
    </article>
  );
}

function Coherence({ launches }: { launches: CardPositioning[] }) {
  if (launches.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs font-mono uppercase tracking-wider text-ink-3">Coherence read</h3>
      <p className="mt-3 text-base text-ink leading-relaxed max-w-2xl">{COHERENCE_READ}</p>
      <ul className="mt-4 space-y-2">
        {launches.map((launch) =>
          launch.table_work.through_action ? (
            <li key={launch.card_id} className="flex gap-3 text-sm text-ink-3">
              <span className="font-mono text-state-running shrink-0">↳</span>
              <span>
                {launch.table_work.through_action}
                <span className="text-ink-4"> → the account absorbs the work</span>
              </span>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}

function ReadingNotes() {
  return (
    <section className="border-t border-rule pt-6 text-sm text-ink-3 space-y-3 max-w-2xl">
      <h3 className="text-xs font-mono uppercase tracking-wider text-ink">Reading notes</h3>
      <p>
        <span className="text-ink-2 font-medium">Positioning is derived, not authored.</span> Each
        launch&apos;s thesis and through-action above came from the actor working the facts with
        empty inner-work — they were not written to a brand brief. That they all resolve to the
        super-objective is the result, not the input.
      </p>
      <p>
        <span className="text-ink-2 font-medium">Status is pipeline state, not liveness.</span> The
        chips report where each card sits in the harness, not whether the launch is live in
        production. This view never asserts a launch is live.
      </p>
      <p className="text-ink-4">
        The through-line and coherence read are curated for v1. Per-launch positioning is read live
        from the latest actor attempt per card.
      </p>
    </section>
  );
}

/** Render text with the given phrases wrapped in the lone accent highlight. */
function highlight(text: string, phrases: string[]) {
  if (phrases.length === 0) return text;
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'g'));
  return parts.map((part, i) =>
    phrases.includes(part) ? (
      <span key={i} className="bg-state-running/10 text-ink rounded px-1">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
