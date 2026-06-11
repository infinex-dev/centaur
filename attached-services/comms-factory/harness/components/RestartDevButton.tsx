'use client';

import { useState } from 'react';
import { restartDevServer } from '@/app/actions/restart';

type Phase = 'idle' | 'restarting' | 'failed';

export function RestartDevButton() {
  const [phase, setPhase] = useState<Phase>('idle');

  async function onClick() {
    if (phase === 'restarting') return;
    setPhase('restarting');
    const res = await restartDevServer().catch(() => ({ ok: false as const }));
    if (!res.ok) {
      setPhase('failed');
      return;
    }
    // Server is going down; poll until it answers again, then hard-reload so
    // the page runs against the freshly bundled pipeline.
    const startedAt = Date.now();
    const poll = async () => {
      if (Date.now() - startedAt > 60_000) {
        setPhase('failed');
        return;
      }
      try {
        // Give the restart a beat to actually begin before declaring victory.
        if (Date.now() - startedAt > 2_000) {
          const ping = await fetch('/', { cache: 'no-store' });
          if (ping.ok) {
            window.location.reload();
            return;
          }
        }
      } catch {
        // server mid-restart — keep polling
      }
      setTimeout(poll, 800);
    };
    setTimeout(poll, 1_500);
  }

  return (
    <button
      type="button"
      className="restart-dev"
      onClick={onClick}
      disabled={phase === 'restarting'}
      title="Restart the dev server (re-bundles ../src: voice spec, actor memory, generator)"
    >
      {phase === 'restarting' ? 'restarting…' : phase === 'failed' ? 'retry restart' : '⟳ restart'}
    </button>
  );
}
