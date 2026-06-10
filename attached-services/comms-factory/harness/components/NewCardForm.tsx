'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCard } from '@/app/actions/research';
import type { VoiceName } from '@/lib/types';

const VOICES: VoiceName[] = ['infinex', 'cream', 'projectjin', 'nigel'];

export function NewCardForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [voice, setVoice] = useState<VoiceName>('infinex');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createCard(brief, voice);
        setBrief('');
        setOpen(false);
        router.push(`/cards/${result.card_id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (!open) {
    return (
      <button
        className="text-xs font-mono text-ink-2 hover:text-ink"
        onClick={() => setOpen(true)}
      >
        + new card
      </button>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <textarea
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        rows={3}
        className="w-full border border-rule bg-paper rounded p-2"
        placeholder="Release brief"
      />
      <div className="flex items-center gap-2">
        <select
          value={voice}
          onChange={(event) => setVoice(event.target.value as VoiceName)}
          className="border border-rule bg-paper rounded px-2 py-1 text-xs font-mono"
        >
          {VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          disabled={pending || brief.trim().length === 0}
          onClick={submit}
          className="text-xs font-mono text-state-approved disabled:text-ink-4 hover:underline"
        >
          {pending ? 'creating…' : 'create'}
        </button>
        <button
          disabled={pending}
          onClick={() => setOpen(false)}
          className="text-xs font-mono text-ink-3 hover:underline"
        >
          cancel
        </button>
      </div>
      {error && <p className="text-xs text-state-rejected">{error}</p>}
    </div>
  );
}
