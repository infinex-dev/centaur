import Link from 'next/link';
import { POSITIONING_SPINE } from '@/lib/positioning';

/**
 * The super-objective rendered as the spine of the tool. `banner` is the
 * compact persistent header for the card queue; `full` is the manifesto block
 * at the top of the positioning surface.
 */
export function PositioningSpine({ variant = 'full' }: { variant?: 'banner' | 'full' }) {
  const { super_objective, validation_criterion } = POSITIONING_SPINE;
  const super_objective_examples = POSITIONING_SPINE.super_objective_examples ?? [];

  if (variant === 'banner') {
    return (
      <Link
        href="/positioning"
        className="block border border-rule rounded-md bg-paper px-5 py-4 hover:bg-canvas transition-colors group"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-3">Positioning</p>
          <span className="text-xs font-mono text-ink-4 group-hover:text-ink">view ladder →</span>
        </div>
        <p className="mt-1.5 text-base font-medium tracking-tight text-ink leading-snug">
          {super_objective}
        </p>
      </Link>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-ink-3">
          Positioning · the spine above every card
        </p>
        <h2 className="mt-4 text-3xl font-medium tracking-tight text-ink leading-tight max-w-2xl">
          {super_objective}
        </h2>
        <p className="mt-4 text-sm text-ink-3 max-w-2xl leading-relaxed">
          This is the locked super-objective — simultaneously the company position and the voice
          spine. Each launch below is evidence: its positioning was{' '}
          <em>derived from the facts, not authored</em>, and ladders back up to this line.
        </p>
      </div>

      <div className="grid gap-px bg-rule border border-rule rounded-md overflow-hidden sm:grid-cols-2">
        <div className="bg-paper px-5 py-4">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-4">Held to</p>
          <p className="mt-2 text-sm text-ink-2 leading-relaxed">{validation_criterion}</p>
        </div>
        <div className="bg-paper px-5 py-4">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-4">The shape, in past launches</p>
          <ul className="mt-2 space-y-1.5">
            {super_objective_examples.map((ex) => (
              <li key={ex} className="text-sm text-ink-3 leading-relaxed">
                {ex}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
