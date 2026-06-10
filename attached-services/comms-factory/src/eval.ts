import type { ReleaseCard } from "./card.js";
import { generateForChannels } from "./generator.js";
import {
  MAX_ATTEMPTS,
  orchestrateWithRetries,
  type GenerateAttempt,
  type Pick,
} from "./orchestrator.js";
import {
  buildValidationReceipt,
  writeValidationReceipt,
  type VoiceValidationReceipt,
} from "./receipts.js";
import type { BeatSequence, CharacterSpec, TempoBeat } from "./voice/types.js";

export interface VoiceEvalCase {
  name: string;
  card: ReleaseCard;
  voice: CharacterSpec;
  defaultBeats: (kind: string) => TempoBeat[];
  beats?: BeatSequence;
  channels?: Pick["channel"][];
  mode?: "live" | "stub" | "auto";
  n?: number;
  maxAttempts?: number;
  generateAttempt?: GenerateAttempt;
  receiptDir?: string;
}

export interface VoiceEvalResult {
  name: string;
  passed: boolean;
  picks: number;
  channels: Pick["channel"][];
  attempts: number;
  exhausted: boolean;
  failure_counts: Record<string, number>;
  receipt: VoiceValidationReceipt;
  receipt_path?: string;
}

export async function runVoiceEval(cases: VoiceEvalCase[]): Promise<VoiceEvalResult[]> {
  const results: VoiceEvalResult[] = [];
  for (const testCase of cases) {
    results.push(await runVoiceEvalCase(testCase));
  }
  return results;
}

export async function runVoiceEvalCase(testCase: VoiceEvalCase): Promise<VoiceEvalResult> {
  const channels = testCase.channels ?? testCase.card.audience.filter(isPickChannel);
  const beats: BeatSequence = testCase.beats ?? { beats: testCase.defaultBeats(testCase.card.kind) };
  const generateAttempt =
    testCase.generateAttempt ??
    (({ feedback }) =>
      generateForChannels(testCase.card, channels, {
        beats,
        voice: testCase.voice,
        defaultBeats: testCase.defaultBeats,
        mode: testCase.mode ?? "auto",
        ...(testCase.n !== undefined ? { n: testCase.n } : {}),
        ...(feedback !== undefined ? { feedback } : {}),
      }));

  const result = await orchestrateWithRetries(testCase.card, channels, generateAttempt, {
    voice: testCase.voice,
    beats,
    maxAttempts: testCase.maxAttempts ?? MAX_ATTEMPTS,
  });
  const receipt = buildValidationReceipt({
    card: testCase.card,
    voice: testCase.voice,
    beats,
    channels,
    result,
  });
  const receiptPath = testCase.receiptDir
    ? writeValidationReceipt(receipt, testCase.receiptDir)
    : undefined;

  const evalResult: VoiceEvalResult = {
    name: testCase.name,
    passed: !result.exhausted && result.picks.length >= channels.length,
    picks: result.picks.length,
    channels,
    attempts: result.attempts.length,
    exhausted: result.exhausted,
    failure_counts: countFailures(result),
    receipt,
  };
  if (receiptPath !== undefined) evalResult.receipt_path = receiptPath;
  return evalResult;
}

function countFailures(result: Awaited<ReturnType<typeof orchestrateWithRetries>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const attempt of result.attempts) {
    for (const rejected of attempt.result.rejected) {
      for (const failure of rejected.validation.failures) {
        counts[failure.rule] = (counts[failure.rule] ?? 0) + 1;
      }
    }
  }
  return counts;
}

function isPickChannel(s: string): s is Pick["channel"] {
  return (
    s === "web" ||
    s === "x" ||
    s === "x-thread" ||
    s === "in-product" ||
    s === "modal" ||
    s === "blog" ||
    s === "carousel"
  );
}
