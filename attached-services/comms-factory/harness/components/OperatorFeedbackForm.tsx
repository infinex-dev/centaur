'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { recordOperatorFeedback } from '@/app/actions/feedback';
import type { HarnessOperatorFeedback, OperatorFeedbackTargetType } from '@/lib/types';

export function OperatorFeedbackForm({
  cardId,
  targetType,
  targetId,
  feedback,
}: {
  cardId: string;
  targetType: OperatorFeedbackTargetType;
  targetId: string;
  feedback: HarnessOperatorFeedback[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await recordOperatorFeedback(cardId, targetType, targetId, text);
        setText('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="border border-rule rounded bg-paper px-3 py-3 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-4">
        operator feedback
      </div>
      {feedback.length > 0 && (
        <ul className="space-y-1 text-xs">
          {feedback.map((item) => (
            <li key={item.id} className="border-l-2 border-rule pl-2">
              <div className="text-ink whitespace-pre-wrap">{item.feedback_text}</div>
              <div className="font-mono text-[10px] text-ink-4">{item.created_at}</div>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={targetType === 'director_audit'
          ? "e.g. I don't agree this is Acute; I read it as Commanding because..."
          : 'e.g. This actor note still feels like product strategy, not character rehearsal...'}
        className="w-full min-h-20 resize-y rounded border border-rule bg-canvas px-2 py-2 text-xs text-ink outline-none focus:border-ink-3"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || text.trim().length === 0}
          onClick={submit}
          className="font-mono text-xs text-state-running disabled:text-ink-4 hover:underline"
        >
          add feedback
        </button>
        {pending && <span className="text-xs text-ink-4">saving...</span>}
        {error && <span className="text-xs text-state-rejected">{error}</span>}
      </div>
    </div>
  );
}
