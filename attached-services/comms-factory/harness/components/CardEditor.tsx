'use client';

/**
 * CardEditor — release-card-stage JSON form.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { approveCard, buildReleaseCard, editReleaseCard } from '@/app/actions/card';

/**
 * The four release-card kinds ("tiers") and what each one needs. The grounder
 * (card-builder) already picks one; this surfaces that pick and lets the operator
 * change it before approve. `why` is the field that carries the kind's rationale.
 */
const KIND_META = {
  'data-card-official': { label: 'Data card', required: ['metric', 'value'], why: 'metric' },
  'data-card-wry': { label: 'Data card · wry', required: ['metric', 'value', 'joke_angle'], why: 'joke_angle' },
  'launch-tier': { label: 'Launch tier', required: ['headline', 'tier_reason'], why: 'tier_reason' },
  split: { label: 'Split', required: ['from', 'to', 'split_semantics'], why: 'split_semantics' },
} as const;
type Kind = keyof typeof KIND_META;
const KINDS = Object.keys(KIND_META) as Kind[];

/**
 * Editorial genus, orthogonal to kind. "changelog" (or absent) = release
 * behavior; "thesis" = positioning essay — no CTA, essay-length blog,
 * ships to X as an article.
 */
const CATEGORY_META = [
  { value: 'changelog', label: 'Release / changelog', hint: 'changelog scaffold + format gate' },
  { value: 'thesis', label: 'Thesis piece', hint: 'positioning essay · no CTA · X article' },
] as const;
type Category = (typeof CATEGORY_META)[number]['value'];

function currentCategoryOf(parsed: Record<string, unknown> | null): Category {
  const raw = parsed?.category;
  return raw === 'thesis' ? 'thesis' : 'changelog';
}

export function CardEditor({
  cardId,
  releaseCardJson,
  cardApprovedAt,
}: {
  cardId: string;
  releaseCardJson: string | null;
  cardApprovedAt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(releaseCardJson ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setText(releaseCardJson ?? ''), [releaseCardJson]);

  const parsed = safeParse(text);
  const currentKind = parsed?.kind as Kind | undefined;
  const recommendedKind = (safeParse(releaseCardJson ?? '')?.kind as Kind | undefined) ?? undefined;

  function selectKind(kind: Kind) {
    if (!parsed) return;
    setText(JSON.stringify({ ...parsed, kind }, null, 2));
  }

  function selectCategory(category: Category) {
    if (!parsed) return;
    setText(JSON.stringify({ ...parsed, category }, null, 2));
  }

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

  function save() {
    if (!releaseCardJson) return;
    if (
      cardApprovedAt &&
      !window.confirm('Saving release-card edits clears generated candidates and final picks for this card. Continue?')
    ) {
      return;
    }
    const before = JSON.parse(releaseCardJson);
    const after = JSON.parse(text);
    const edits = collectLeafDiffs(before, after).map((diff) => ({
      field_path: diff.path,
      new_value: typeof diff.value === 'string' ? diff.value : JSON.stringify(diff.value),
    }));
    run(() => editReleaseCard(cardId, edits));
  }

  function buildReleaseCardAction() {
    if (
      cardApprovedAt &&
      !window.confirm('Rebuilding the release card clears card approval, generated candidates, and final picks. Continue?')
    ) {
      return;
    }
    run(() => buildReleaseCard(cardId));
  }

  function approveCardAction() {
    if (
      cardApprovedAt &&
      !window.confirm('Re-approving the release card clears generated candidates and final picks for this card. Continue?')
    ) {
      return;
    }
    run(() => approveCard(cardId));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          Release card derived from approved facts. Edit anything; every change is captured.
        </p>
        <div className="space-x-2 font-mono text-xs">
          <button
            disabled={pending}
            onClick={buildReleaseCardAction}
            className="text-state-running disabled:text-ink-4 hover:underline"
          >
            build
          </button>
          <span className="text-ink-4">·</span>
          <button
            disabled={pending || !releaseCardJson}
            onClick={approveCardAction}
            className="text-state-approved disabled:text-ink-4 hover:underline"
          >
            {cardApprovedAt ? 're-approve' : 'approve as-is'}
          </button>
          <span className="text-ink-4">·</span>
          <button
            disabled={pending || !releaseCardJson}
            onClick={save}
            className="text-state-edited disabled:text-ink-4 hover:underline"
          >
            save edits
          </button>
        </div>
      </div>
      {parsed && currentKind && (
        <div className="border border-rule rounded-md bg-paper px-4 py-3 space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-3">
            tier (card kind){' '}
            <span className="text-ink-4 normal-case">· grounder&apos;s pick, change before approve</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((kind) => {
              const on = currentKind === kind;
              const recommended = recommendedKind === kind;
              return (
                <button
                  key={kind}
                  disabled={pending}
                  onClick={() => selectKind(kind)}
                  className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
                    on
                      ? 'border-state-running text-state-running bg-state-running/10'
                      : 'border-rule text-ink-4 hover:text-ink-3'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {KIND_META[kind].label}
                  {recommended && (
                    <span className="text-state-approved"> · grounder</span>
                  )}
                </button>
              );
            })}
          </div>
          <TierDetail kind={currentKind} parsed={parsed} />
          <p className="text-xs font-mono uppercase tracking-wider text-ink-3 pt-2">
            category (editorial genus){' '}
            <span className="text-ink-4 normal-case">· save edits to apply</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_META.map((cat) => {
              const on = currentCategoryOf(parsed) === cat.value;
              return (
                <button
                  key={cat.value}
                  disabled={pending}
                  onClick={() => selectCategory(cat.value)}
                  title={cat.hint}
                  className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
                    on
                      ? 'border-state-running text-state-running bg-state-running/10'
                      : 'border-rule text-ink-4 hover:text-ink-3'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {cat.label}
                  <span className="text-ink-4"> · {cat.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {releaseCardJson ? (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={18}
          className="w-full bg-paper border border-rule rounded p-4 text-xs font-mono overflow-x-auto whitespace-pre"
        />
      ) : (
        <p className="text-ink-3 text-sm">No release card yet. Build one after approving research.</p>
      )}
      {pending && <p className="text-xs text-ink-3">Working…</p>}
      {error && <p className="text-xs text-state-rejected">{error}</p>}
    </div>
  );
}

/**
 * Shows the chosen kind's rationale (its `why` field) and flags any required
 * field that's missing — so switching tier surfaces what still needs filling
 * before the card will validate on save/approve.
 */
function TierDetail({ kind, parsed }: { kind: Kind; parsed: Record<string, unknown> }) {
  const meta = KIND_META[kind];
  const why = parsed[meta.why];
  const missing = meta.required.filter((field) => {
    const value = parsed[field];
    return value === undefined || value === null || value === '';
  });
  return (
    <div className="space-y-1 text-xs font-mono">
      {typeof why === 'string' && why.length > 0 && (
        <p className="text-ink-3">
          <span className="text-ink-4">why: </span>
          {why}
        </p>
      )}
      <p className="text-ink-4">
        needs: {meta.required.join(', ')}
        {missing.length > 0 && (
          <span className="text-state-rejected"> · missing: {missing.join(', ')}</span>
        )}
      </p>
    </div>
  );
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function collectLeafDiffs(before: unknown, after: unknown, prefix = ''): Array<{ path: string; value: unknown }> {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!isObjectLike(before) || !isObjectLike(after)) return [{ path: prefix, value: after }];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).flatMap((key) =>
    collectLeafDiffs(before[key], after[key], appendPath(prefix, key)),
  );
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function appendPath(prefix: string, key: string): string {
  if (/^\d+$/.test(key)) return `${prefix}[${key}]`;
  return prefix ? `${prefix}.${key}` : key;
}
