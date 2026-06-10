import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deployedFactClaims, type ReleaseCard } from "./card.js";
import type { Candidate } from "./generator.js";
import type {
  OrchestrationResult,
  Pick,
  RetryOrchestrationResult,
} from "./orchestrator.js";
import type { ValidationResult } from "./validator.js";
import type { BeatSequence, CharacterSpec, TempoBeat } from "./voice/types.js";

export interface CandidateValidationReceipt {
  candidate_id: string;
  channel: Pick["channel"];
  source: Candidate["source"];
  text: string;
  declared_beats: Candidate["declared_beats"];
  deployed_facts_used: string[];
  not_said: Array<{ fact: string; reason: string }>;
  validation: ValidationResult;
}

export interface AttemptValidationReceipt {
  attempt: number;
  feedback: string;
  candidates: CandidateValidationReceipt[];
  picks: Array<{ channel: Pick["channel"]; candidate_id: string }>;
}

export interface VoiceValidationReceipt {
  schema_version: 1;
  generated_at: string;
  card: {
    id: string;
    kind: ReleaseCard["kind"];
    title: string;
    deployed_facts: string[];
  };
  voice: {
    name: string;
    inner_attitude: CharacterSpec["inner_attitude"];
    stress: CharacterSpec["stress"];
    aspect: CharacterSpec["aspect"];
    drive_primary: CharacterSpec["drive_primary"];
    drive_secondary: CharacterSpec["drive_secondary"];
  };
  beats: TempoBeat[];
  channels: Pick["channel"][];
  exhausted: boolean;
  attempts: AttemptValidationReceipt[];
  final_picks: Array<{ channel: Pick["channel"]; candidate_id: string }>;
}

export function buildValidationReceipt(opts: {
  card: ReleaseCard;
  voice: CharacterSpec;
  beats: BeatSequence;
  channels: Pick["channel"][];
  result: OrchestrationResult | RetryOrchestrationResult;
  generatedAt?: string;
}): VoiceValidationReceipt {
  const retryAttempts = "attempts" in opts.result ? opts.result.attempts : [];
  const attempts: AttemptValidationReceipt[] =
    retryAttempts.length > 0
      ? retryAttempts.map((attempt) => ({
          attempt: attempt.attempt,
          feedback: attempt.feedback,
          candidates: receiptCandidates(attempt.candidates, attempt.result),
          picks: pickRefs(attempt.result.picks),
        }))
      : [
          {
            attempt: 1,
            feedback: "",
            candidates: receiptCandidates(
              [
                ...opts.result.picks.map((pick) => pick.candidate),
                ...opts.result.rejected.map((rejected) => rejected.candidate),
              ],
              opts.result,
            ),
            picks: pickRefs(opts.result.picks),
          },
        ];

  return {
    schema_version: 1,
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    card: {
      id: opts.card.id,
      kind: opts.card.kind,
      title: opts.card.title,
      deployed_facts: deployedFactClaims(opts.card),
    },
    voice: {
      name: opts.voice.name,
      inner_attitude: opts.voice.inner_attitude,
      stress: opts.voice.stress,
      aspect: opts.voice.aspect,
      drive_primary: opts.voice.drive_primary,
      drive_secondary: opts.voice.drive_secondary,
    },
    beats: opts.beats.beats,
    channels: opts.channels,
    exhausted: "exhausted" in opts.result ? opts.result.exhausted : opts.result.picks.length < opts.channels.length,
    attempts,
    final_picks: pickRefs(opts.result.picks),
  };
}

export function writeValidationReceipt(receipt: VoiceValidationReceipt, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${receipt.card.id}-voice-receipt.json`);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return path;
}

function receiptCandidates(
  candidates: Candidate[],
  result: OrchestrationResult,
): CandidateValidationReceipt[] {
  const validations = new Map<string, ValidationResult>();
  for (const pick of result.picks) validations.set(pick.candidate.id, pick.validation);
  for (const rejected of result.rejected) {
    validations.set(rejected.candidate.id, rejected.validation);
  }

  return candidates.map((candidate) => ({
    candidate_id: candidate.id,
    channel: candidate.channel,
    source: candidate.source,
    text: candidate.text,
    declared_beats: candidate.declared_beats,
    deployed_facts_used: candidate.deployed_facts_used ?? [],
    not_said: candidate.not_said ?? [],
    validation: validations.get(candidate.id) ?? { passed: false, failures: [] },
  }));
}

function pickRefs(picks: Pick[]): Array<{ channel: Pick["channel"]; candidate_id: string }> {
  return picks.map((pick) => ({ channel: pick.channel, candidate_id: pick.candidate.id }));
}
