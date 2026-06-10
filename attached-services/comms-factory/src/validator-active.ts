import Anthropic from "@anthropic-ai/sdk";
import type { ReleaseCard } from "./card.js";
import type { Channel, NotSaidFact } from "./generator.js";
import {
  validate,
  type ValidationResult,
} from "./validator.js";
import {
  buildLLMAuditTools,
  buildLLMValidatorSystemPrompt,
  parseLLMAuditToolUse,
  DEFAULT_LLM_VALIDATOR_MODEL,
  type ClassificationScope,
  type LLMVoiceAuditVerdict,
} from "./validator-llm.js";
import {
  buildResearchTools,
  executeResearchToolCall,
  isResearchToolName,
  type ResearchToolResult,
} from "./research-tools.js";
import { INFINEX_VOICE } from "./voice/infinex.js";
import type { BeatSequence, CharacterSpec } from "./voice/types.js";

type AnthropicContentBlock = Anthropic.Message["content"][number];
type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];

interface AnthropicMessagesClient {
  messages: {
    create: (params: AnthropicCreateParams) => Promise<{ content: Anthropic.Message["content"] }>;
  };
}

export type ActiveValidatorTraceEvent =
  | { type: "turn"; turn: number; model: string; tool_names: string[]; text_preview?: string }
  | { type: "tool_call"; turn: number; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; turn: number; name: string; content_preview: string }
  | { type: "verdict"; turn: number; passed: boolean }
  | { type: "silent"; turn: number; text_preview?: string }
  | { type: "truncated"; turn: number; reason: string };

export type ActiveValidatorToolExecutor = (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolUseId: string,
) => Promise<ResearchToolResult>;

export interface ActiveValidationOptions {
  voice?: CharacterSpec;
  beats?: BeatSequence;
  card: ReleaseCard;
  channel?: Channel;
  deployed_facts_used?: string[];
  not_said?: NotSaidFact[];
  surface?: string;
  job?: string;
  model?: string;
  max_tokens?: number;
  max_tool_turns?: number;
  classification_scope?: ClassificationScope;
  client?: AnthropicMessagesClient;
  tool_executor?: ActiveValidatorToolExecutor;
}

export interface ActiveValidationVerdict {
  passed: boolean;
  deterministic: ValidationResult;
  llm?: LLMVoiceAuditVerdict;
  research_trace: ActiveValidatorTraceEvent[];
  active_turns: number;
  truncated?: boolean;
  reason: string | null;
}

const DEFAULT_ACTIVE_MAX_TURNS = 6;
const DEFAULT_ACTIVE_MAX_TOKENS = 4096;

/**
 * Nigel-style active validator for comms-factory candidates.
 *
 * The validator may use research tools to check contradiction or freshness, but
 * it may not expand the candidate's fact allowance. If a true fact is missing
 * from card.deployed_facts, it must fail as card_missing_fact.
 */
export async function auditTextActive(
  text: string,
  opts: ActiveValidationOptions,
): Promise<ActiveValidationVerdict> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const deterministic = await deterministicFirst(text, opts);
  if (!deterministic.passed) {
    return {
      passed: false,
      deterministic: deterministic.deterministic,
      research_trace: [],
      active_turns: 0,
      reason: deterministic.reason,
    };
  }

  const model = opts.model ?? process.env.COMMS_ACTIVE_VALIDATOR_MODEL ?? DEFAULT_LLM_VALIDATOR_MODEL;
  const client = opts.client ?? new Anthropic();
  const maxTurns = opts.max_tool_turns ?? intFromEnv("COMMS_ACTIVE_VALIDATOR_MAX_TOOL_TURNS", DEFAULT_ACTIVE_MAX_TURNS);
  const executor = opts.tool_executor ?? executeResearchToolCall;
  const scope = opts.classification_scope ?? "primary";
  const messages: AnthropicCreateParams["messages"] = [
    {
      role: "user",
      content: buildActiveValidatorUserMessage(text, opts),
    },
  ];
  const tools = [
    ...buildResearchTools(),
    ...buildLLMAuditTools(voice, { classification_scope: scope }),
  ];
  const trace: ActiveValidatorTraceEvent[] = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: opts.max_tokens ?? intFromEnv("COMMS_ACTIVE_VALIDATOR_MAX_TOKENS", DEFAULT_ACTIVE_MAX_TOKENS),
      system: buildActiveValidatorSystemPrompt(voice, { classification_scope: scope }),
      tools,
      messages,
    });

    const toolNamesForTurn = toolNames(response.content);
    const preview = textPreview(response.content);
    trace.push({
      type: "turn",
      turn,
      model,
      tool_names: toolNamesForTurn,
      ...(preview ? { text_preview: preview } : {}),
    });

    const verdict = parseLLMAuditToolUse(response.content, model);
    if (verdict) {
      trace.push({ type: "verdict", turn, passed: verdict.passed });
      return {
        passed: verdict.passed,
        deterministic: deterministic.deterministic,
        llm: verdict,
        research_trace: trace,
        active_turns: turn,
        reason: verdict.passed ? null : reasonFromLLM(verdict),
      };
    }

    const researchCalls = researchToolCalls(response.content);
    if (researchCalls.length === 0) {
      trace.push({
        type: "silent",
        turn,
        ...(preview ? { text_preview: preview } : {}),
      });
      return {
        passed: false,
        deterministic: deterministic.deterministic,
        research_trace: trace,
        active_turns: turn,
        reason: "active-validator-silent",
      };
    }

    for (const call of researchCalls) {
      trace.push({ type: "tool_call", turn, name: call.name, input: call.input });
    }
    const toolResults = await Promise.all(
      researchCalls.map((call) => executor(call.name, call.input, call.id)),
    );
    for (let i = 0; i < toolResults.length; i++) {
      const result = toolResults[i];
      const call = researchCalls[i];
      if (!result || !call) continue;
      trace.push({
        type: "tool_result",
        turn,
        name: call.name,
        content_preview: result.content.slice(0, 1000),
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: toolResults.map((result) => ({
        type: "tool_result" as const,
        tool_use_id: result.tool_use_id,
        content: result.content,
      })),
    });
  }

  trace.push({
    type: "truncated",
    turn: maxTurns,
    reason: "max_tool_turns reached before audit_pass/audit_fail",
  });
  return {
    passed: false,
    deterministic: deterministic.deterministic,
    research_trace: trace,
    active_turns: maxTurns,
    truncated: true,
    reason: "active-validator-max-tool-turns",
  };
}

export function buildActiveValidatorSystemPrompt(
  voice: CharacterSpec = INFINEX_VOICE,
  opts: { classification_scope?: ClassificationScope } = {},
): string {
  return [
    buildLLMValidatorSystemPrompt(voice, opts),
    "",
    "# Active factual audit",
    "",
    "You have research tools. Use them only when a factual, numeric, partner, product, URL, market, date, or recent-announcement claim needs verification.",
    "The ReleaseCard is the allowance boundary. A candidate may assert only claims that are present in card.deployed_facts.",
    "If research proves the candidate true but the fact is not in card.deployed_facts, fail with voice/factual rule `card_missing_fact`; do not pass it.",
    "If research contradicts the card or candidate, fail with factual rule `research_contradiction` and cite the tool result.",
    "If the candidate makes a claim that cannot be supported from card.deployed_facts or fact_context, fail with `unsupported_claim`.",
    "Do not rewrite the copy. Emit one audit_pass or audit_fail verdict after any needed research.",
  ].join("\n");
}

export function buildActiveValidatorUserMessage(
  text: string,
  opts: ActiveValidationOptions,
): string {
  return JSON.stringify(
    {
      text,
      channel: opts.channel ?? "",
      surface: opts.surface ?? "",
      job: opts.job ?? "",
      declared_beats: opts.beats?.beats ?? [],
      deployed_facts_used: opts.deployed_facts_used ?? [],
      not_said: opts.not_said ?? [],
      card: {
        id: opts.card.id,
        kind: opts.card.kind,
        title: opts.card.title,
        audience: opts.card.audience,
        deployed_facts: opts.card.deployed_facts,
      },
      instruction:
        "Audit the candidate. Research may detect contradiction or staleness, but it must not expand the fact allowance beyond card.deployed_facts.",
    },
    null,
    2,
  );
}

function deterministicFirst(
  text: string,
  opts: ActiveValidationOptions,
): { passed: boolean; deterministic: ValidationResult; reason: string | null } {
  const deterministic = validate(text, {
    ...(opts.voice !== undefined ? { voice: opts.voice } : {}),
    ...(opts.beats !== undefined ? { beats: opts.beats } : {}),
    ...(opts.channel !== undefined ? { channel: opts.channel } : {}),
    card: opts.card,
    ...(opts.deployed_facts_used !== undefined ? { deployed_facts_used: opts.deployed_facts_used } : {}),
    ...(opts.not_said !== undefined ? { not_said: opts.not_said } : {}),
  });
  const first = deterministic.failures[0];
  return {
    passed: deterministic.passed,
    deterministic,
    reason: first ? `${first.rule}: ${first.reason}` : deterministic.passed ? null : "deterministic-fail",
  };
}

function researchToolCalls(blocks: AnthropicContentBlock[]): Array<{
  id: string;
  name: string;
  input: Record<string, unknown>;
}> {
  const calls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    if (!isResearchToolName(block.name)) continue;
    calls.push({
      id: block.id,
      name: block.name,
      input: isRecord(block.input) ? block.input : {},
    });
  }
  return calls;
}

function reasonFromLLM(verdict: LLMVoiceAuditVerdict): string {
  if (verdict.feedback) return verdict.feedback;
  const factual = verdict.factual_issues[0];
  if (factual) return `${factual.claim}: ${factual.evidence}`;
  const voice = verdict.voice_issues[0];
  if (voice) return `${voice.rule}: ${voice.fix}`;
  return "active-validator-fail";
}

function textPreview(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<AnthropicContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .slice(0, 1000)
    .trim();
}

function toolNames(blocks: AnthropicContentBlock[]): string[] {
  return blocks
    .filter((block): block is Extract<AnthropicContentBlock, { type: "tool_use" }> => block.type === "tool_use")
    .map((block) => block.name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
