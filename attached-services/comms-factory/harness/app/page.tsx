/**
 * Card queue — list view (Claude Code Design v3).
 * Top: agreement dashboard. Below: list of cards in flight + recent shipped/abandoned,
 * each with a four-segment stage-dots strip for at-a-glance status scanning.
 */

import Link from 'next/link';
import { AgreementSummary } from '@/components/AgreementSummary';
import { NewCardForm } from '@/components/NewCardForm';
import { PositioningSpine } from '@/components/PositioningSpine';
import { RecomputeAgreementButton } from '@/components/RecomputeAgreementButton';
import { StageDots } from '@/components/design/atoms';
import { latestAgreement, listCards } from '@/lib/queries';
import type { HarnessCard, Stage, StageStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STAGES: Stage[] = ['research', 'card', 'generate', 'ship'];

const STATUS_TONE: Record<HarnessCard['status'], string> = {
  'in-progress': 'text-state-running',
  shipped: 'text-state-approved',
  abandoned: 'text-state-rejected',
};

/**
 * Cheap stage-status approximation from the card's own timestamps + status,
 * for the queue dots. Full stage state lives in getCardDetail; here we avoid
 * N detail queries by reading what the card row already carries.
 */
function quickStageStatuses(c: HarnessCard): Partial<Record<Stage, StageStatus>> {
  if (c.status === 'abandoned') {
    return { research: 'rejected', card: 'rejected', generate: 'rejected', ship: 'rejected' };
  }
  const shipped = c.status === 'shipped';
  return {
    research: c.research_approved_at ? 'approved' : 'awaiting',
    card: c.card_approved_at ? 'approved' : c.research_approved_at ? 'awaiting' : 'pending',
    generate: shipped ? 'approved' : c.card_approved_at ? 'awaiting' : 'pending',
    ship: shipped ? 'approved' : c.ship_at ? 'approved' : 'pending',
  };
}

export default async function HomePage() {
  const cards = listCards();
  const agreement = latestAgreement({ voice: 'infinex', window_days: 7 });

  return (
    <div className="space-y-8">
      <PositioningSpine variant="banner" />
      <AgreementSummary snapshots={agreement} />
      <RecomputeAgreementButton />

      <section className="space-y-3">
        <div className="cards-head">
          <div className="flex items-baseline gap-4">
            <h2 className="title-md">Cards</h2>
            <Link href="/eval" className="filter">→ eval triage</Link>
            <Link href="/director" className="filter">→ director</Link>
          </div>
          <NewCardForm />
        </div>
        <div className="surface card-list">
          {cards.length === 0 && (
            <div className="empty">
              <div className="icon">∅</div>
              No cards yet. Create one to start a review session.
            </div>
          )}
          {cards.map((c, i) => (
            <Link key={c.id} href={`/cards/${c.id}`} className="card-row">
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <div className="brief truncate">{c.brief}</div>
                <div className="meta">
                  <span>{c.voice}</span>
                  <span className="sep">·</span>
                  <span className="truncate">{c.id}</span>
                </div>
              </div>
              <StageDots stages={STAGES} statuses={quickStageStatuses(c)} />
              <span className={`mono text-xs ${STATUS_TONE[c.status]}`}>{c.status}</span>
              <span className="touched">{c.created_at.slice(0, 10)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
