'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function FinalPickRefresh({
  cardId,
  initialRevision,
}: {
  cardId: string;
  initialRevision: string;
}) {
  const router = useRouter();
  const seenRevision = useRef(initialRevision);

  useEffect(() => {
    seenRevision.current = initialRevision;
  }, [initialRevision]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/cards/${cardId}/pick-revision`, { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json()) as { revision?: string };
        if (cancelled || !body.revision) return;
        if (body.revision !== seenRevision.current) {
          seenRevision.current = body.revision;
          router.refresh();
        }
      } catch {
        // Polling must not break the operator page.
      }
    }

    const timer = window.setInterval(load, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cardId, router]);

  return null;
}
