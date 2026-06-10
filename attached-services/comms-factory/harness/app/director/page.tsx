/**
 * Director — standalone brand-fit check.
 *
 * Paste any copy (tweet / modal / email), get a green/amber/red read on
 * whether it fits the Infinex voice, plus the fact axis. The Director judges;
 * it never rewrites and never grounds. Spec: docs/SPEC-director-as-service.md
 */

import { DirectorConsole } from '@/components/DirectorConsole';
import { listGroundedCards, listRecentChecks, listRegens } from '@/app/actions/director';

export const dynamic = 'force-dynamic';

export default async function DirectorPage() {
  const [history, regens, groundedCards] = await Promise.all([
    listRecentChecks(),
    listRegens(),
    listGroundedCards(),
  ]);
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Director</h1>
        <p className="max-w-2xl text-sm text-ink-3">
          A standalone brand-fit judge. Hand it copy from anywhere — your head or the generator — and it returns
          🟢/🟡/🔴 with notes on why it fits the Infinex voice or doesn&apos;t. Two axes: <span className="text-ink">voice</span>{' '}
          (judged blind, needs no context) and <span className="text-ink">fact</span> (needs a fact source). It judges;
          it does not generate.
        </p>
      </header>
      <DirectorConsole history={history} regens={regens} groundedCards={groundedCards} />
    </div>
  );
}
