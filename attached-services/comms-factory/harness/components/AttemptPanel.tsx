import { AttemptResetButton } from './AttemptResetButton';
import { CandidateRegenPanel } from './CandidateRegenPanel';
import { OperatorFeedbackForm } from './OperatorFeedbackForm';
import type {
  Channel,
  HarnessActorAttempt,
  HarnessCandidate,
  HarnessGeneratorAttempt,
  HarnessOperatorFeedback,
} from '@/lib/types';

interface PromptPair {
  system: string;
  user: string;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  x: 'X',
  'x-thread': 'X thread',
  web: 'web',
  'in-product': 'in-product',
  modal: 'modal',
  blog: 'blog',
  carousel: 'carousel',
};

export function AttemptPanel({
  cardId,
  channel,
  attempt,
  attemptRow,
  actorAttempt,
  candidates,
  operatorFeedback,
}: {
  cardId: string;
  channel: Channel;
  attempt: number;
  attemptRow: HarnessGeneratorAttempt | null;
  actorAttempt: HarnessActorAttempt | null;
  candidates: HarnessCandidate[];
  operatorFeedback: HarnessOperatorFeedback[];
}) {
  const passCount = candidates.filter(
    (c) => c.validation_passed && c.active_validation_passed !== false,
  ).length;
  const failCount = candidates.length - passCount;

  const innerWork = parsePromptPair(attemptRow?.inner_work_prompt_json);
  const drafting = parsePromptPair(attemptRow?.drafting_prompt_json);
  const legacy = parsePromptPair(attemptRow?.legacy_prompt_json);
  const hasAnyPrompt = innerWork || drafting || legacy;
  const actorPrompt = parseJsonBlock(actorAttempt?.actor_prompt_json);
  const actorTranscript = parseJsonBlock(actorAttempt?.actor_transcript_json);
  const actorWarmup = parseJsonBlock(actorAttempt?.daily_pages_json);
  const actorTableWork = parseJsonBlock(actorAttempt?.table_work_json);
  const actorSourceIndex = parseJsonBlock(actorAttempt?.source_index_json);
  const actorNotesIn = parseJsonBlock(actorAttempt?.director_notes_in_json);
  const actorFeedback = actorAttempt
    ? operatorFeedback.filter((item) => item.target_type === 'actor_attempt' && item.target_id === actorAttempt.id)
    : [];
  const feedbackIn = attemptRow?.auto_feedback_in?.trim() ?? '';
  const generatorSource = actorAttempt?.generator_source ?? attemptRow?.generator_source ?? candidates[0]?.source ?? null;
  const architecture = actorAttempt ? 'actor/director' : attemptRow ? 'legacy two-call' : 'historical';
  const actorWarmupMode = warmupModeLabel(actorWarmup);

  return (
    <details
      className="border border-rule rounded-md bg-paper"
      open={candidates.some((c) => !c.validation_passed) || candidates.length === 0}
    >
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-ink uppercase tracking-wider">
            attempt {attempt} · {CHANNEL_LABEL[channel]}
          </span>
          <span className="text-ink-4">·</span>
          <span className="text-ink-3">
            {candidates.length} candidate{candidates.length === 1 ? '' : 's'}
          </span>
          <span className="text-ink-4">·</span>
          <span className={failCount === 0 ? 'text-state-approved' : 'text-state-rejected'}>
            {passCount}/{candidates.length} pass
          </span>
          {generatorSource && (
            <>
              <span className="text-ink-4">·</span>
              <span className="text-ink-4">{generatorSource}</span>
            </>
          )}
          <span className="text-ink-4">·</span>
          <span className="text-ink-4">{architecture}</span>
        </div>
        <AttemptResetButton cardId={cardId} channel={channel} attempt={attempt} />
      </summary>

      <div className="border-t border-rule px-4 py-4 space-y-4">
        {actorAttempt ? (
          <section className="space-y-2">
            <h4 className="font-mono uppercase tracking-wider text-ink-4 text-xs">
              actor/director attempt
            </h4>
            <div className="text-xs font-mono text-ink-3">
              prompt {actorAttempt.prompt_version} · {actorAttempt.prompt_hash.slice(0, 12)} · channels {actorAttempt.channels_json}
              {actorWarmupMode ? ` · warm-up ${actorWarmupMode}` : ''}
            </div>
            {actorNotesIn !== null && <JsonBlock label="director notes fed INTO this attempt" value={actorNotesIn} />}
            {actorWarmup !== null && <JsonBlock label="actor warm-up / rehearsal" value={actorWarmup} />}
            {actorTableWork !== null && <JsonBlock label="table work" value={actorTableWork} />}
            {actorPrompt !== null && <JsonBlock label="actor prompt + source map" value={actorPrompt} />}
            {actorSourceIndex !== null && <JsonBlock label="canonical source index" value={actorSourceIndex} />}
            {actorTranscript !== null && <JsonBlock label="actor transcript" value={actorTranscript} />}
            <OperatorFeedbackForm
              cardId={cardId}
              targetType="actor_attempt"
              targetId={actorAttempt.id}
              feedback={actorFeedback}
            />
          </section>
        ) : (
          <section className="space-y-1">
            <h4 className="font-mono uppercase tracking-wider text-ink-4 text-xs">
              auto-feedback fed INTO this attempt
            </h4>
            {feedbackIn ? (
              <pre className="bg-canvas border border-rule rounded p-3 text-xs text-ink whitespace-pre-wrap font-mono leading-relaxed">
                {feedbackIn}
              </pre>
            ) : (
              <p className="text-xs text-ink-4 italic">
                {attempt === 1
                  ? 'first attempt — no prior failures to feed back'
                  : 'no auto-feedback synthesised'}
              </p>
            )}
          </section>
        )}

        {hasAnyPrompt ? (
          <section className="space-y-2">
            <h4 className="font-mono uppercase tracking-wider text-ink-4 text-xs">
              generator prompts
            </h4>
            {innerWork && <PromptBlock label="inner-work prompt" pair={innerWork} />}
            {drafting && <PromptBlock label="drafting prompt" pair={drafting} />}
            {legacy && <PromptBlock label="single-call prompt" pair={legacy} />}
          </section>
        ) : generatorSource === 'stub' ? (
          <section>
            <h4 className="font-mono uppercase tracking-wider text-ink-4 text-xs mb-1">
              generator prompts
            </h4>
            <p className="text-xs text-ink-4 italic">
              stub generator — no prompts were sent to the model
            </p>
          </section>
        ) : attemptRow ? null : (
          <section>
            <h4 className="font-mono uppercase tracking-wider text-ink-4 text-xs mb-1">
              generator prompts
            </h4>
            <p className="text-xs text-ink-4 italic">
              no prompts captured — this attempt predates the prompt-capture instrumentation
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h4 className="font-mono uppercase tracking-wider text-ink-4 text-xs">
            candidates · {candidates.length}
          </h4>
          {candidates.length === 0 ? (
            <p className="text-xs text-ink-4 italic">no candidates persisted for this attempt</p>
          ) : (
            <CandidateRegenPanel
              cardId={cardId}
              channel={channel}
              candidates={candidates}
              operatorFeedback={operatorFeedback}
            />
          )}
        </section>
      </div>
    </details>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <details className="border border-rule rounded bg-canvas">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-mono text-ink-3 hover:text-ink">
        {label} ({text.length} chars)
      </summary>
      <div className="border-t border-rule px-3 py-2">
        <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink-3 max-h-[480px] overflow-auto">
          {text}
        </pre>
      </div>
    </details>
  );
}

function PromptBlock({ label, pair }: { label: string; pair: PromptPair }) {
  return (
    <details className="border border-rule rounded bg-canvas">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-mono text-ink-3 hover:text-ink">
        {label} ({pair.system.length + pair.user.length} chars)
      </summary>
      <div className="border-t border-rule px-3 py-2 space-y-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-4 mb-1">
            system
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink-3 max-h-[480px] overflow-auto">
            {pair.system}
          </pre>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-4 mb-1">
            user
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink-3 max-h-[480px] overflow-auto">
            {pair.user}
          </pre>
        </div>
      </div>
    </details>
  );
}

function parsePromptPair(json: string | null | undefined): PromptPair | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.system === 'string' &&
      typeof parsed.user === 'string'
    ) {
      return { system: parsed.system, user: parsed.user };
    }
    return null;
  } catch {
    return null;
  }
}

function parseJsonBlock(json: string | null | undefined): unknown | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function warmupModeLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mode = (value as { mode?: unknown }).mode;
  return typeof mode === 'string' ? mode : null;
}
