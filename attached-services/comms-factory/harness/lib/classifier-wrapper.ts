import { auditBeats, classifyTempoBlind } from '@pipeline/validator';
import type { BeatAuditResult, BeatSequence } from '@pipeline/voice/types';
import type { VoiceName } from './types';
import { voiceSpecFor } from './voice';

export interface ClassifyTextOptions {
  voice?: VoiceName;
  beats?: BeatSequence;
}

export async function classifyText(
  text: string,
  opts: ClassifyTextOptions = {},
): Promise<BeatAuditResult[]> {
  const voice = voiceSpecFor(opts.voice ?? 'infinex');
  if (opts.beats) return auditBeats(text, opts.beats, voice);

  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, beatIndex) => {
      const classification = classifyTempoBlind(paragraph, voice);
      return {
        beat_index: beatIndex,
        declared_tempo: classification.tempo === 'unknown' ? voice.main_tempi[0]! : classification.tempo,
        classified_tempo: classification.tempo,
        classified_confidence: classification.confidence,
        passed: classification.tempo !== 'unknown',
        ...(classification.tempo === 'unknown'
          ? { reason: 'deterministic classifier could not identify a tempo' }
          : {}),
      };
    });
}
