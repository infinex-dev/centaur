/**
 * Eval triage — stratified-sample view for prompt-architecture permutations.
 * Operator triages top/median/bottom-N candidates per (prompt_variant, channel)
 * to feed the agreement metrics that compare permutations head-to-head.
 */

import Link from 'next/link';
import { CandidateCard } from '@/components/CandidateCard';
import {
  CHANNELS,
  listCandidatesStratified,
  listPromptVariants,
  type StratifiedCellSummary,
} from '@/lib/queries';
import type { Channel } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    variant?: string | string[];
    channel?: string | string[];
    per?: string;
  }>;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseVariantParam(values: string[]): Array<string | null> {
  return values.map((v) => (v === '__null__' ? null : v));
}

export default async function EvalTriagePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedVariants = parseVariantParam(toArray(params.variant));
  const requestedChannels = toArray(params.channel).filter((c): c is Channel =>
    CHANNELS.includes(c as Channel),
  );
  const perStratum = Math.max(1, Math.min(20, Number(params.per ?? 5)));

  const allVariants = listPromptVariants();
  const channels = requestedChannels.length > 0 ? requestedChannels : CHANNELS;
  const result = listCandidatesStratified({
    prompt_variants: requestedVariants.length > 0 ? requestedVariants : undefined,
    channels,
    per_stratum: perStratum,
  });

  const byCell = new Map<string, typeof result.candidates>();
  for (const item of result.candidates) {
    const key = `${item.prompt_variant ?? '__null__'}|${item.candidate.channel}`;
    const list = byCell.get(key) ?? [];
    list.push(item);
    byCell.set(key, list);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-mono">Eval triage</h1>
          <Link href="/" className="text-xs font-mono text-ink-3 hover:text-ink">
            ← cards
          </Link>
        </div>
        <p className="text-xs text-ink-3">
          Stratified sample per (prompt_variant × channel): top {perStratum} + median {perStratum} +
          bottom {perStratum} by composite signal (regex 0.4 + LLM auditor 0.4 + beat-audit pass 0.2).
        </p>
      </header>

      <FilterStrip
        allVariants={allVariants}
        selectedVariants={requestedVariants}
        selectedChannels={channels}
        perStratum={perStratum}
      />

      <CellSummary cells={result.cells} />

      {result.cells.length === 0 && (
        <p className="text-sm text-ink-3 italic">
          No candidates match the current filter. Run an eval batch first.
        </p>
      )}

      <div className="space-y-12">
        {result.cells.map((cell) => {
          const key = `${cell.prompt_variant ?? '__null__'}|${cell.channel}`;
          const items = byCell.get(key) ?? [];
          const byStratum: Record<'top' | 'median' | 'bottom', typeof items> = {
            top: items.filter((i) => i.stratum === 'top'),
            median: items.filter((i) => i.stratum === 'median'),
            bottom: items.filter((i) => i.stratum === 'bottom'),
          };
          return (
            <section key={key} className="space-y-4">
              <h2 className="text-sm font-mono text-ink-3 border-b border-rule pb-1">
                <span className="text-ink">{cell.prompt_variant ?? '(no variant)'}</span>
                <span className="text-ink-4"> · </span>
                <span className="text-ink-3">{cell.channel}</span>
                <span className="text-ink-4"> · </span>
                <span className="text-ink-3">n={cell.total}</span>
                <span className="text-ink-4"> · </span>
                <span className="text-ink-3">
                  signal {cell.signal_min.toFixed(2)}…{cell.signal_median.toFixed(2)}…
                  {cell.signal_max.toFixed(2)}
                </span>
              </h2>
              {(['top', 'median', 'bottom'] as const).map((stratum) => (
                <div key={stratum} className="space-y-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-4">
                    {stratum} ({byStratum[stratum].length})
                  </h3>
                  <div className="space-y-3">
                    {byStratum[stratum].map((item) => (
                      <CandidateCard key={item.candidate.id} candidate={item.candidate} />
                    ))}
                    {byStratum[stratum].length === 0 && (
                      <p className="text-xs text-ink-4 italic pl-1">no candidates in stratum</p>
                    )}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FilterStrip({
  allVariants,
  selectedVariants,
  selectedChannels,
  perStratum,
}: {
  allVariants: Array<string | null>;
  selectedVariants: Array<string | null>;
  selectedChannels: Channel[];
  perStratum: number;
}) {
  const variantKey = (v: string | null): string => v ?? '__null__';
  const variantLabel = (v: string | null): string => v ?? '(no variant)';
  return (
    <form
      method="get"
      action="/eval"
      className="border border-rule rounded-md bg-paper px-4 py-3 space-y-3 text-xs"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono uppercase tracking-wider text-ink-4">variant</span>
        {allVariants.length === 0 && (
          <span className="text-ink-3 italic">no variants in DB yet</span>
        )}
        {allVariants.map((v) => {
          const k = variantKey(v);
          const checked = selectedVariants.length === 0
            ? true
            : selectedVariants.some((sv) => variantKey(sv) === k);
          return (
            <label key={k} className="inline-flex items-center gap-1 font-mono cursor-pointer">
              <input type="checkbox" name="variant" value={k} defaultChecked={checked} />
              {variantLabel(v)}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono uppercase tracking-wider text-ink-4">channel</span>
        {CHANNELS.map((c) => {
          const checked = selectedChannels.includes(c);
          return (
            <label key={c} className="inline-flex items-center gap-1 font-mono cursor-pointer">
              <input type="checkbox" name="channel" value={c} defaultChecked={checked} />
              {c}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 font-mono">
          per stratum
          <input
            type="number"
            name="per"
            min={1}
            max={20}
            defaultValue={perStratum}
            className="bg-canvas border border-rule px-2 py-0.5 w-14 font-mono"
          />
        </label>
        <button
          type="submit"
          className="font-mono px-3 py-1 border border-rule rounded hover:bg-canvas"
        >
          apply
        </button>
        <Link href="/eval" className="font-mono text-ink-3 hover:text-ink">
          reset
        </Link>
      </div>
    </form>
  );
}

function CellSummary({ cells }: { cells: StratifiedCellSummary[] }) {
  if (cells.length === 0) return null;
  return (
    <div className="border border-rule rounded-md bg-paper overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead className="bg-canvas border-b border-rule">
          <tr className="text-ink-4 uppercase tracking-wider">
            <th className="text-left px-3 py-2">variant</th>
            <th className="text-left px-3 py-2">channel</th>
            <th className="text-right px-3 py-2">n</th>
            <th className="text-right px-3 py-2">regex pass</th>
            <th className="text-right px-3 py-2">LLM pass</th>
            <th className="text-right px-3 py-2">signal min</th>
            <th className="text-right px-3 py-2">median</th>
            <th className="text-right px-3 py-2">max</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {cells.map((cell) => (
            <tr key={`${cell.prompt_variant ?? '__null__'}|${cell.channel}`}>
              <td className="px-3 py-2">{cell.prompt_variant ?? '(no variant)'}</td>
              <td className="px-3 py-2 text-ink-3">{cell.channel}</td>
              <td className="px-3 py-2 text-right text-ink-3">{cell.total}</td>
              <td className="px-3 py-2 text-right">
                {(cell.validator_pass_rate * 100).toFixed(0)}%
              </td>
              <td className="px-3 py-2 text-right">
                {cell.active_pass_rate === null
                  ? '—'
                  : `${(cell.active_pass_rate * 100).toFixed(0)}%`}
              </td>
              <td className="px-3 py-2 text-right text-ink-3">{cell.signal_min.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-ink-3">{cell.signal_median.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-ink-3">{cell.signal_max.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
