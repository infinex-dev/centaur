import type { ReleaseCard } from "./card.js";
import type { Candidate, Channel } from "./generator.js";
import {
  runHistoryGuards,
  type HistoryGuardResult,
  type ShippedCopyRecord,
} from "./history-guards.js";
import {
  auditTextActive,
  type ActiveValidationOptions,
  type ActiveValidationVerdict,
} from "./validator-active.js";
import {
  auditTextHybrid,
  structureIssues,
  validate,
  type HybridValidationVerdict,
  type ValidationResult,
} from "./validator.js";
import type { LLMVoiceAuditOptions } from "./validator-llm.js";
import type { BeatSequence, CharacterSpec } from "./voice/types.js";

/**
 * Orchestrator. Per-channel best-candidate picker.
 *
 * Pipeline contract:
 *   generator -> orchestrator.pick() -> renderer -> ship gate
 *
 * Pick policy:
 *   1. Drop any candidate that fails the validator.
 *   2. Rank surviving candidates (TODO: ranking model — for now first-passes-wins).
 *   3. Return one pick per requested channel, or null when nothing survives.
 *
 * Channel-specific length/format constraints live HERE, not in the generator —
 * the generator produces text, the orchestrator shapes the channel cut.
 */

export interface Pick {
  channel: Channel;
  candidate: Candidate;
  validation: ValidationResult;
}

export interface OrchestrationResult {
  picks: Pick[];
  rejected: Array<{ candidate: Candidate; validation: ValidationResult }>;
}

export const MAX_ATTEMPTS = 3;

const CHANNEL_MAX_LEN: Record<Channel, number> = {
  x: 280,
  web: 140,
  "in-product": 80,
  modal: 250,
  blog: 3600,
  // Structured channels: per-segment limits are enforced by validator.structureIssues;
  // these caps bound the readable rendering as a backstop.
  "x-thread": 1800,
  carousel: 1600,
};

export interface OrchestrateOptions {
  voice?: CharacterSpec;
  beats?: BeatSequence;
}

export interface RetryGenerateContext {
  attempt: number;
  feedback?: string;
}

export interface RetryAttempt {
  attempt: number;
  candidates: Candidate[];
  result: OrchestrationResult;
  feedback: string;
}

export interface RetryOrchestrationResult extends OrchestrationResult {
  attempts: RetryAttempt[];
  exhausted: boolean;
}

export type GenerateAttempt = (ctx: RetryGenerateContext) => Promise<Candidate[]>;

/**
 * Hybrid orchestration: regex first, then LLM judge for survivors.
 * Mirror of `orchestrate()` but async because the LLM is async.
 */
export interface HybridPick {
  channel: Pick["channel"];
  candidate: Candidate;
  verdict: HybridValidationVerdict;
}

export interface HybridOrchestrationResult {
  picks: HybridPick[];
  rejected: Array<{ candidate: Candidate; verdict: HybridValidationVerdict }>;
}

export interface ActivePick {
  channel: Pick["channel"];
  candidate: Candidate;
  verdict: ActiveValidationVerdict;
  history: HistoryGuardResult;
}

export interface ActiveOrchestrationResult {
  picks: ActivePick[];
  rejected: Array<{
    candidate: Candidate;
    verdict: ActiveValidationVerdict;
    history?: HistoryGuardResult;
  }>;
}

export interface ActiveOrchestrateOptions extends OrchestrateOptions {
  active_opts?: Omit<
    ActiveValidationOptions,
    "card" | "voice" | "beats" | "channel" | "deployed_facts_used" | "not_said"
  >;
  recentCopy?: ShippedCopyRecord[];
  recentCopyByChannel?: Partial<Record<Pick["channel"], ShippedCopyRecord[]>>;
  protagonist?: string;
}

export interface ActiveRetryAttempt {
  attempt: number;
  candidates: Candidate[];
  result: ActiveOrchestrationResult;
  feedback: string;
}

export interface ActiveRetryOrchestrationResult extends ActiveOrchestrationResult {
  attempts: ActiveRetryAttempt[];
  exhausted: boolean;
}

export async function orchestrateLLM(
  card: ReleaseCard,
  candidates: Candidate[],
  channels: Array<Pick["channel"]>,
  opts: OrchestrateOptions & { llm_opts?: Omit<LLMVoiceAuditOptions, "voice"> } = {},
): Promise<HybridOrchestrationResult> {
  const rejected: HybridOrchestrationResult["rejected"] = [];
  const picks: HybridPick[] = [];
  const baseAuditOpts: Parameters<typeof auditTextHybrid>[1] = { card };
  if (opts.voice) baseAuditOpts.voice = opts.voice;
  if (opts.beats) baseAuditOpts.beats = opts.beats;
  if (opts.llm_opts) baseAuditOpts.llm_opts = opts.llm_opts;

  for (const channel of channels) {
    const channelCandidates = candidates.filter((c) => c.channel === channel);
    const pool = channelCandidates.length > 0 ? channelCandidates : candidates;

    let chosen: HybridPick | null = null;
    for (const c of pool) {
      const auditOpts: Parameters<typeof auditTextHybrid>[1] = { ...baseAuditOpts, channel };
      if (c.deployed_facts_used !== undefined) auditOpts.deployed_facts_used = c.deployed_facts_used;
      if (c.not_said !== undefined) auditOpts.not_said = c.not_said;
      const verdict = await auditTextHybrid(c.text, auditOpts);
      if (!verdict.passed) {
        rejected.push({ candidate: c, verdict });
        continue;
      }
      if (c.text.length > CHANNEL_MAX_LEN[channel]) {
        rejected.push({
          candidate: c,
          verdict: {
            ...verdict,
            passed: false,
            reason: `length: ${c.text.length} > ${CHANNEL_MAX_LEN[channel]} for channel ${channel}`,
          },
        });
        continue;
      }
      if (c.structured) {
        const shape = structureIssues(c.structured);
        if (shape.length > 0) {
          rejected.push({
            candidate: c,
            verdict: {
              ...verdict,
              passed: false,
              reason: shape.map((reason) => `structure: ${reason}`).join("; "),
            },
          });
          continue;
        }
      }
      chosen = { channel, candidate: c, verdict };
      break;
    }
    if (chosen) picks.push(chosen);
  }

  return { picks, rejected };
}

export async function orchestrateActive(
  card: ReleaseCard,
  candidates: Candidate[],
  channels: Array<Pick["channel"]>,
  opts: ActiveOrchestrateOptions = {},
): Promise<ActiveOrchestrationResult> {
  const rejected: ActiveOrchestrationResult["rejected"] = [];
  const picks: ActivePick[] = [];

  for (const channel of channels) {
    const channelCandidates = candidates.filter((c) => c.channel === channel);
    const pool = channelCandidates.length > 0 ? channelCandidates : candidates;

    let chosen: ActivePick | null = null;
    for (const c of pool) {
      const verdict = await auditTextActive(c.text, {
        ...(opts.active_opts ?? {}),
        card,
        channel,
        ...(opts.voice !== undefined ? { voice: opts.voice } : {}),
        ...(opts.beats !== undefined ? { beats: opts.beats } : {}),
        ...(c.deployed_facts_used !== undefined ? { deployed_facts_used: c.deployed_facts_used } : {}),
        ...(c.not_said !== undefined ? { not_said: c.not_said } : {}),
      });

      if (!verdict.passed) {
        rejected.push({ candidate: c, verdict });
        continue;
      }

      if (c.text.length > CHANNEL_MAX_LEN[channel]) {
        rejected.push({
          candidate: c,
          verdict: {
            ...verdict,
            passed: false,
            reason: `length: ${c.text.length} > ${CHANNEL_MAX_LEN[channel]} for channel ${channel}`,
          },
        });
        continue;
      }
      if (c.structured) {
        const shape = structureIssues(c.structured);
        if (shape.length > 0) {
          rejected.push({
            candidate: c,
            verdict: {
              ...verdict,
              passed: false,
              reason: shape.map((reason) => `structure: ${reason}`).join("; "),
            },
          });
          continue;
        }
      }

      const recentCopy = opts.recentCopyByChannel?.[channel] ?? opts.recentCopy ?? [];
      const history = runHistoryGuards(c, {
        channel,
        ...(opts.voice !== undefined ? { voice: opts.voice } : {}),
        recentCopy,
        ...(opts.protagonist !== undefined ? { protagonist: opts.protagonist } : {}),
      });
      if (!history.passed) {
        rejected.push({ candidate: c, verdict, history });
        continue;
      }

      chosen = { channel, candidate: c, verdict, history };
      break;
    }
    if (chosen) picks.push(chosen);
  }

  return { picks, rejected };
}

export function orchestrate(
  card: ReleaseCard,
  candidates: Candidate[],
  channels: Array<Pick["channel"]>,
  opts: OrchestrateOptions = {},
): OrchestrationResult {
  const rejected: OrchestrationResult["rejected"] = [];
  const picks: Pick[] = [];
  const validateOpts: Parameters<typeof validate>[1] = {};
  if (opts.voice) validateOpts.voice = opts.voice;
  if (opts.beats) validateOpts.beats = opts.beats;
  validateOpts.card = card;

  for (const channel of channels) {
    const channelCandidates = candidates.filter((c) => c.channel === channel);
    const pool = channelCandidates.length > 0 ? channelCandidates : candidates;

    let chosen: Pick | null = null;
    for (const c of pool) {
      const candidateValidateOpts: Parameters<typeof validate>[1] = { ...validateOpts, channel };
      if (c.deployed_facts_used !== undefined) {
        candidateValidateOpts.deployed_facts_used = c.deployed_facts_used;
      }
      if (c.not_said !== undefined) {
        candidateValidateOpts.not_said = c.not_said;
      }
      const v = validate(c.text, candidateValidateOpts);
      if (!v.passed) {
        rejected.push({ candidate: c, validation: v });
        continue;
      }
      if (c.text.length > CHANNEL_MAX_LEN[channel]) {
        rejected.push({
          candidate: c,
          validation: {
            passed: false,
            failures: [
              {
                rule: "length",
                reason: `${c.text.length} > ${CHANNEL_MAX_LEN[channel]} for channel ${channel}`,
              },
            ],
          },
        });
        continue;
      }
      if (c.structured) {
        const shape = structureIssues(c.structured);
        if (shape.length > 0) {
          rejected.push({
            candidate: c,
            validation: {
              passed: false,
              failures: shape.map((reason) => ({ rule: "structure", reason })),
            },
          });
          continue;
        }
      }
      chosen = { channel, candidate: c, validation: v };
      break; // TODO: real ranking model — for now first-passes-wins
    }
    if (chosen) picks.push(chosen);
  }

  return { picks, rejected };
}

export async function orchestrateWithRetries(
  card: ReleaseCard,
  channels: Array<Pick["channel"]>,
  generateAttempt: GenerateAttempt,
  opts: OrchestrateOptions & { maxAttempts?: number } = {},
): Promise<RetryOrchestrationResult> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const attempts: RetryAttempt[] = [];
  let feedback: string | undefined;
  let lastResult: OrchestrationResult = { picks: [], rejected: [] };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidates = await generateAttempt({ attempt, ...(feedback ? { feedback } : {}) });
    const result = orchestrate(card, candidates, channels, opts);
    feedback = summarizeFailures(result, channels);
    attempts.push({ attempt, candidates, result, feedback });
    lastResult = result;
    if (result.picks.length >= channels.length) {
      return { ...result, attempts, exhausted: false };
    }
  }

  return { ...lastResult, attempts, exhausted: true };
}

export async function orchestrateActiveWithRetries(
  card: ReleaseCard,
  channels: Array<Pick["channel"]>,
  generateAttempt: GenerateAttempt,
  opts: ActiveOrchestrateOptions & { maxAttempts?: number } = {},
): Promise<ActiveRetryOrchestrationResult> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const attempts: ActiveRetryAttempt[] = [];
  let feedback: string | undefined;
  let lastResult: ActiveOrchestrationResult = { picks: [], rejected: [] };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidates = await generateAttempt({ attempt, ...(feedback ? { feedback } : {}) });
    const result = await orchestrateActive(card, candidates, channels, opts);
    feedback = summarizeActiveFailures(result, channels);
    attempts.push({ attempt, candidates, result, feedback });
    lastResult = result;
    if (result.picks.length >= channels.length) {
      return { ...result, attempts, exhausted: false };
    }
  }

  return { ...lastResult, attempts, exhausted: true };
}

function summarizeFailures(result: OrchestrationResult, channels: Array<Pick["channel"]>): string {
  const pickedChannels = new Set(result.picks.map((p) => p.channel));
  const missing = channels.filter((channel) => !pickedChannels.has(channel));
  const lines: string[] = [];
  if (missing.length > 0) lines.push(`Missing valid picks for channels: ${missing.join(", ")}`);

  const seen = new Set<string>();
  for (const rejected of result.rejected) {
    const firstFailure = rejected.validation.failures[0];
    if (!firstFailure) continue;
    const key = `${rejected.candidate.id}:${firstFailure.rule}:${firstFailure.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${rejected.candidate.id}: ${firstFailure.rule} — ${firstFailure.reason}`);
    if (lines.length >= 8) break;
  }

  return lines.join("\n") || "No candidate survived validation.";
}

function summarizeActiveFailures(result: ActiveOrchestrationResult, channels: Array<Pick["channel"]>): string {
  const pickedChannels = new Set(result.picks.map((p) => p.channel));
  const missing = channels.filter((channel) => !pickedChannels.has(channel));
  const lines: string[] = [];
  if (missing.length > 0) lines.push(`Missing valid active picks for channels: ${missing.join(", ")}`);

  const seen = new Set<string>();
  for (const rejected of result.rejected) {
    const historyFailure = rejected.history?.failures[0];
    const reason = historyFailure
      ? `${historyFailure.rule}: ${historyFailure.reason}`
      : rejected.verdict.reason ?? "active-validator-fail";
    const key = `${rejected.candidate.id}:${reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${rejected.candidate.id}: ${reason}`);
    if (lines.length >= 8) break;
  }

  return lines.join("\n") || "No candidate survived active validation.";
}
