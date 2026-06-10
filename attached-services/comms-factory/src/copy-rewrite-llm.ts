/**
 * Copy-rewrite engine — three-subagent loop for testing whether the locked
 * Infinex character spec alone is strong enough to *regenerate* shipped copy
 * from underlying intent.
 *
 * The loop:
 *
 *   1. Intent extractor (Sonnet) — reads (surface, job, current_text), emits
 *      {intent, constraints}. Must NOT recommend phrasing; must NOT echo the
 *      shipped wording; must NOT include taste rules.
 *
 *   2. In-character generator (Opus) — reads (surface, job, intent, constraints)
 *      + the full character spec. NEVER sees current_text. Emits
 *      {selected_tempo, tempo_reason, replacement_text, preserved_intent}.
 *
 *   3. Blind validator (Sonnet) — reuses auditTextLLM() from validator-llm.ts.
 *      Validates replacement_text against the declared tempo. Already wired for
 *      blind classification.
 *
 * If validator's independent_classification.tempo != generator.selected_tempo,
 * OR verdict.passed === false, the orchestrator retries (max 3 attempts),
 * passing the validator's feedback back into the generator. current_text is
 * NEVER threaded into the generator, even on retry — the whole point is to
 * check whether the character spec alone can re-derive plausible copy.
 *
 * Similarity metric: token Jaccard over lowercased word-tokens (3+ chars,
 * minus standard English stopwords). Threshold for "possible context
 * poisoning" flag: >= 0.6. Documented below in tokenJaccard().
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  auditTextLLM,
  DEFAULT_LLM_VALIDATOR_MODEL,
  type LLMVoiceAuditVerdict,
} from "./validator-llm.js";
import {
  groundFacts,
  buildFactContext,
  buildDeployedFacts,
  checkEntityPresence,
  type VerifiedFact,
  type FactGroundingOptions,
  type FactGroundingResult,
} from "./fact-grounder-llm.js";
import { INFINEX_VOICE } from "./voice/infinex.js";
import type { CharacterSpec, TempoName } from "./voice/types.js";

export type { VerifiedFact, FactGroundingResult };

export const DEFAULT_INTENT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_GENERATOR_MODEL = "claude-opus-4-7";

const DEFAULT_MAX_ATTEMPTS = 3;
const INTENT_MAX_TOKENS = 1024;
const GENERATOR_MAX_TOKENS = 1024;
const POISONING_FLAG_THRESHOLD = 0.6;

type AnthropicTool = NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>[number];
type AnthropicContentBlock = Anthropic.Message["content"][number];
type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];

export interface AnthropicMessagesClient {
  messages: {
    create: (params: AnthropicCreateParams) => Promise<{ content: Anthropic.Message["content"] }>;
  };
}

// -- Intent extraction --------------------------------------------------------

export interface IntentExtractionInput {
  id: string;
  surface: string;
  job: string;
  current_text: string;
}

export interface IntentExtractionResult {
  id: string;
  intent: string;
  constraints: string[];
  model: string;
}

export interface IntentExtractionOptions {
  model?: string;
  max_tokens?: number;
  client?: AnthropicMessagesClient;
}

const INTENT_TOOL_NAME = "emit_intent";

export function buildIntentExtractionTools(): AnthropicTool[] {
  return [
    {
      name: INTENT_TOOL_NAME,
      description:
        "Emit the job-to-be-done intent and hard structural constraints for this UI surface. Do not recommend phrasing. Do not echo shipped wording. Do not include taste rules — taste belongs in the character spec, not in constraints.",
      input_schema: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            description:
              "What the user needs to understand at this surface, in one sentence. Describe the job, not the wording. NEVER paraphrase the current_text — abstract over its specific noun/verb choices.",
          },
          constraints: {
            type: "array",
            items: { type: "string" },
            description:
              "Hard structural requirements derived from the surface and job (e.g. 'homepage hero', 'fits a single line', 'names a product mechanic, not a feeling', 'imperative verb'). NEVER include taste rules ('avoid hype', 'no clichés') — those belong in the character spec.",
          },
        },
        required: ["intent", "constraints"],
      },
    },
  ];
}

export function buildIntentExtractionSystemPrompt(): string {
  return [
    "You extract job-to-be-done intent and hard structural constraints from shipped UI copy.",
    "",
    "Your output feeds a downstream generator that has NEVER seen the original wording. The downstream generator will rewrite the copy from intent alone, using a separate locked character spec for voice.",
    "",
    "# Hard rules",
    "",
    "1. The `intent` field describes what the USER NEEDS TO UNDERSTAND at this surface. Not what the brand wants to say. Not how the line should feel.",
    "2. The `intent` MUST NOT echo or paraphrase the current_text. Abstract over its specific noun choices, verb choices, and rhetorical figures. If the shipped text says \"Change the way you crypto.\", your intent must NOT contain \"change\", \"way\", or \"crypto\". It must describe the JOB (e.g. \"Tell a first-time visitor what Infinex is in a single decisive line that names the product position, not how to feel about it\").",
    "3. `constraints` lists HARD STRUCTURAL requirements only: length bounds, grammar shape, what must be named (mechanic vs feeling vs partner), surface placement.",
    "4. `constraints` MUST NOT include taste rules: no \"avoid hype\", no \"no clichés\", no \"avoid marketing-speak\", no \"keep it terse\". Those belong in the character spec the downstream generator already has.",
    "5. Do NOT suggest replacement copy. Do NOT recommend a tempo. Do NOT mention the brand voice.",
    "",
    "Emit exactly one tool call using the provided tool. No prose outside the tool call.",
  ].join("\n");
}

export function buildIntentExtractionUserMessage(input: IntentExtractionInput): string {
  return JSON.stringify(
    {
      id: input.id,
      surface: input.surface,
      job: input.job,
      current_text: input.current_text,
      instruction:
        "Extract the job-to-be-done intent and the hard structural constraints. Do not echo the current_text vocabulary. Do not include taste rules.",
    },
    null,
    2,
  );
}

export function parseIntentExtractionToolUse(
  content: AnthropicContentBlock[],
  id: string,
  model: string,
): IntentExtractionResult | null {
  for (const block of content) {
    if (block.type !== "tool_use") continue;
    if (block.name !== INTENT_TOOL_NAME) continue;
    const payload = isRecord(block.input) ? block.input : {};
    const intent = stringOrEmpty(payload.intent);
    const constraints = Array.isArray(payload.constraints)
      ? payload.constraints.filter((c): c is string => typeof c === "string")
      : [];
    return { id, intent, constraints, model };
  }
  return null;
}

export async function extractIntent(
  input: IntentExtractionInput,
  opts: IntentExtractionOptions = {},
): Promise<IntentExtractionResult> {
  const model =
    opts.model ?? process.env.COMMS_INTENT_MODEL ?? DEFAULT_INTENT_MODEL;
  const client = opts.client ?? new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? INTENT_MAX_TOKENS,
    system: buildIntentExtractionSystemPrompt(),
    tools: buildIntentExtractionTools(),
    tool_choice: { type: "tool", name: INTENT_TOOL_NAME, disable_parallel_tool_use: true },
    messages: [
      { role: "user", content: buildIntentExtractionUserMessage(input) },
    ],
  });
  const result = parseIntentExtractionToolUse(response.content, input.id, model);
  if (!result) {
    throw new Error("Intent extractor did not emit emit_intent tool call");
  }
  return result;
}

// -- In-character generator (current_text-blind) ------------------------------

export interface CopyGenerationInput {
  id: string;
  surface: string;
  job: string;
  intent: string;
  constraints: string[];
  /** Verified facts from the fact-grounder. Generator must honour these as immutable. */
  verified_facts?: VerifiedFact[];
  // NOTE: no current_text field. This is the load-bearing isolation.
}

export interface CopyGenerationResult {
  id: string;
  selected_tempo: TempoName;
  tempo_reason: string;
  replacement_text: string;
  preserved_intent: string;
  model: string;
}

export interface CopyGenerationOptions {
  voice?: CharacterSpec;
  model?: string;
  max_tokens?: number;
  client?: AnthropicMessagesClient;
  feedback?: string;
}

const GENERATOR_TOOL_NAME = "emit_replacement_copy";

export function buildCopyGenerationTools(voice: CharacterSpec = INFINEX_VOICE): AnthropicTool[] {
  return [
    {
      name: GENERATOR_TOOL_NAME,
      description:
        "Emit replacement copy for the surface, the tempo you chose for it, and a short reason for the tempo selection.",
      input_schema: {
        type: "object",
        properties: {
          selected_tempo: {
            type: "string",
            enum: [...voice.main_tempi],
            description:
              "Which main tempo this surface should speak in. Must be one of the five main tempi.",
          },
          tempo_reason: {
            type: "string",
            description:
              "One sentence: why this tempo fits the surface + job. Anchor on motor pair (e.g. 'Pressing → Punching landing for a hero label'), not on vague feel words.",
          },
          replacement_text: {
            type: "string",
            description:
              "The replacement copy itself. Honor the constraints and the selected tempo. Do not pad. Do not over-write.",
          },
          preserved_intent: {
            type: "string",
            description:
              "Restate, in your own words, the job-to-be-done your copy is delivering. This is the receipt that the generator understood the brief.",
          },
        },
        required: ["selected_tempo", "tempo_reason", "replacement_text", "preserved_intent"],
      },
    },
  ];
}

export function buildCopyGenerationSystemPrompt(voice: CharacterSpec = INFINEX_VOICE): string {
  const lines: string[] = [
    `You write UI surface copy for ${voice.name}.`,
    "",
    "You have NEVER seen the current shipped copy for this surface. You are working purely from the upstream intent extractor's brief plus the locked character spec below. Do not imagine the shipped copy. Do not anchor on any phrasing you assume might be there. Derive the line from the job and the character.",
    "",
    "# Character placement",
    `- Inner Attitude: ${voice.inner_attitude}`,
    `- Stress: ${voice.stress}${voice.stress_pole ? ` (${voice.stress_pole} pole)` : ""}`,
    `- Aspect: ${voice.aspect}`,
    `- Drive: ${voice.drive_primary} + ${voice.drive_secondary}${voice.drive_axis ? ` (${voice.drive_axis})` : ""}`,
    `- Off-spec visible/extravert drive surfaces (must NOT foreground): ${voice.off_spec_drives.join(", ") || "none"}`,
    "",
    "# Tempi available (pick exactly one)",
  ];

  for (const name of voice.main_tempi) {
    const tempo = voice.tempi[name];
    if (!tempo) continue;
    const innerCombo = tempo.inner_combo ?? (tempo.factor_shape ? `${tempo.attitude} · ${tempo.factor_shape}` : tempo.attitude);
    const motorArrow = tempo.motor_relation === "co_exist" ? "/" : "→";
    const motorNote = tempo.motor_relation === "co_exist" ? "(co-existing, same Time pole)" : "(preparation → release)";
    lines.push(`## ${name} (${innerCombo})`);
    lines.push(`Motor: ${tempo.motor[0]} ${motorArrow} ${tempo.motor[1]} ${motorNote}`);
    if (tempo.canonical_shorthand) lines.push(`Canon: ${tempo.canonical_shorthand}`);
    if (tempo.feel) lines.push(`Feel: ${tempo.feel}`);
    if (tempo.opening_shapes?.length) lines.push(`Opening shapes: ${tempo.opening_shapes.slice(0, 3).join(" | ")}`);
    if (tempo.vocab_anchor?.length) lines.push(`Vocab anchor: ${tempo.vocab_anchor.slice(0, 6).join(", ")}`);
    if (tempo.example_lines?.length) {
      lines.push(`Example lines:`);
      for (const ex of tempo.example_lines.slice(0, 2)) lines.push(`  > ${ex}`);
    }
    lines.push("");
  }

  lines.push(
    "# Output contract",
    "",
    "Emit exactly one tool call to `emit_replacement_copy`. No prose outside the tool call.",
    "",
    "- `selected_tempo` MUST be one of the five main tempi listed above.",
    "- `replacement_text` MUST honor the constraints from the brief AND read as the selected tempo's motor pair.",
    "- Do not ornament. Short labels are fine — a two-word Commanding (Pressing → Punching) line is correct for hero labels.",
    "- Do not foreground off-spec drive surfaces (urgency, scarcity, hype theatre, time-pressure).",
    "- Do not claim partner palettes or competitor positioning.",
  );

  return lines.join("\n");
}

export function buildCopyGenerationUserMessage(
  input: CopyGenerationInput,
  feedback?: string,
): string {
  const payload: Record<string, unknown> = {
    id: input.id,
    surface: input.surface,
    job: input.job,
    intent: input.intent,
    constraints: input.constraints,
    instruction:
      "Write the replacement copy from the intent + constraints + character spec. Pick the main tempo that fits the surface, then write the line in that tempo's motor pair.",
  };
  if (input.verified_facts && input.verified_facts.length > 0) {
    payload.immutable_facts = input.verified_facts.map((f) => ({
      claim: f.claim,
      value: f.value,
      source: f.source_ref,
    }));
    payload.fact_instruction =
      "The above facts are IMMUTABLE — you must include every partner name, number, and capability listed. Do not substitute or omit. If a fact contradicts a constraint, honour the fact and relax the constraint.";
  }
  if (feedback && feedback.trim()) {
    payload.previous_attempt_feedback = feedback.trim();
    payload.retry_instruction =
      "Your previous attempt failed the blind validator. Address the feedback above directly. Do not explain. Re-emit corrected output. You still have NOT seen the current shipped copy and must not infer it.";
  }
  return JSON.stringify(payload, null, 2);
}

export function parseCopyGenerationToolUse(
  content: AnthropicContentBlock[],
  id: string,
  model: string,
  voice: CharacterSpec = INFINEX_VOICE,
): CopyGenerationResult | null {
  for (const block of content) {
    if (block.type !== "tool_use") continue;
    if (block.name !== GENERATOR_TOOL_NAME) continue;
    const payload = isRecord(block.input) ? block.input : {};
    const tempoRaw = stringOrEmpty(payload.selected_tempo);
    if (!isMainTempo(tempoRaw, voice)) return null;
    return {
      id,
      selected_tempo: tempoRaw,
      tempo_reason: stringOrEmpty(payload.tempo_reason),
      replacement_text: stringOrEmpty(payload.replacement_text),
      preserved_intent: stringOrEmpty(payload.preserved_intent),
      model,
    };
  }
  return null;
}

export async function generateInCharacter(
  input: CopyGenerationInput,
  opts: CopyGenerationOptions = {},
): Promise<CopyGenerationResult> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const model =
    opts.model ?? process.env.COMMS_GENERATOR_MODEL ?? DEFAULT_GENERATOR_MODEL;
  const client = opts.client ?? new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? GENERATOR_MAX_TOKENS,
    system: buildCopyGenerationSystemPrompt(voice),
    tools: buildCopyGenerationTools(voice),
    tool_choice: { type: "tool", name: GENERATOR_TOOL_NAME, disable_parallel_tool_use: true },
    messages: [
      { role: "user", content: buildCopyGenerationUserMessage(input, opts.feedback) },
    ],
  });
  const result = parseCopyGenerationToolUse(response.content, input.id, model, voice);
  if (!result) {
    throw new Error("Generator did not emit emit_replacement_copy with a valid main tempo");
  }
  return result;
}

// -- Orchestrator -------------------------------------------------------------

export interface CopyRewriteInput {
  id: string;
  surface: string;
  job: string;
  current_text: string;
  /** Optional pre-seeded operator facts — merged with grounder output. */
  operator_facts?: VerifiedFact[];
}

export interface CopyRewriteAttempt {
  attempt: number;
  selected_tempo: TempoName;
  tempo_reason: string;
  replacement_text: string;
  preserved_intent: string;
  verifier_tempo: TempoName | "unknown";
  verifier_pass: boolean;
  verifier_rationale: string;
  verifier_feedback: string;
  verdict: LLMVoiceAuditVerdict;
}

export interface CopyRewriteFinal {
  selected_tempo: TempoName;
  replacement_text: string;
  verifier_tempo: TempoName | "unknown";
  verifier_pass: boolean;
  verifier_rationale: string;
}

export interface CopyRewriteResult {
  id: string;
  surface: string;
  current_text: string;
  intent: string;
  constraints: string[];
  /** Facts grounded before generation. Empty array when grounder was skipped. */
  verified_facts: VerifiedFact[];
  grounding?: FactGroundingResult;
  attempts: CopyRewriteAttempt[];
  final: CopyRewriteFinal;
  retry_count: number;
  similarity_to_current: number;
  similarity_poisoning_flag: boolean;
  ok: boolean;
  intent_model: string;
  generator_model: string;
  validator_model: string;
}

export interface CopyRewriteOptions {
  voice?: CharacterSpec;
  intent_model?: string;
  generator_model?: string;
  validator_model?: string;
  intent_client?: AnthropicMessagesClient;
  generator_client?: AnthropicMessagesClient;
  validator_client?: AnthropicMessagesClient;
  /** Grounder client — defaults to same API key as other clients. */
  grounder_client?: AnthropicMessagesClient;
  /** Set to false to skip the fact-grounder step (faster, but no fact-grounding). Default: true. */
  enable_grounding?: boolean;
  max_attempts?: number;
  // Progress callback — invoked at each pipeline stage; useful for stderr
  // progress lines without coupling the engine to a logger.
  on_progress?: (event: CopyRewriteProgress) => void;
}

export type CopyRewriteProgress =
  | { id: string; stage: "ground_start" }
  | { id: string; stage: "ground_done"; facts: number; unverifiable: number; turns: number }
  | { id: string; stage: "extract_start" }
  | { id: string; stage: "extract_done"; intent: string; constraints: string[] }
  | { id: string; stage: "generate_start"; attempt: number; total: number }
  | { id: string; stage: "generate_done"; attempt: number; tempo: TempoName }
  | { id: string; stage: "validate_start"; attempt: number }
  | {
      id: string;
      stage: "validate_done";
      attempt: number;
      passed: boolean;
      tempo_match: boolean;
      verifier_tempo: TempoName | "unknown";
    }
  | { id: string; stage: "entity_check_fail"; missing: string[]; attempt: number };

export async function rewriteCopyLoop(
  input: CopyRewriteInput,
  opts: CopyRewriteOptions = {},
): Promise<CopyRewriteResult> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const maxAttempts = opts.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const validatorModel =
    opts.validator_model ?? process.env.COMMS_VOICE_VALIDATOR_MODEL ?? DEFAULT_LLM_VALIDATOR_MODEL;
  const progress = opts.on_progress ?? (() => {});
  const enableGrounding = opts.enable_grounding ?? true;

  // Phase 1: Fact-grounding (before intent extraction, while we still have current_text)
  let verifiedFacts: VerifiedFact[] = [...(input.operator_facts ?? [])];
  let groundingResult: FactGroundingResult | undefined;

  // Grounding requires either an explicit grounder_client or a live ANTHROPIC_API_KEY.
  // When neither is available (e.g. unit tests), skip grounding gracefully.
  const canGround = enableGrounding &&
    (opts.grounder_client !== undefined || Boolean(process.env.ANTHROPIC_API_KEY));

  if (canGround) {
    progress({ id: input.id, stage: "ground_start" });
    const grounderOpts: FactGroundingOptions = {
      surface: input.surface,
      job: input.job,
      ...(input.operator_facts !== undefined ? { operator_facts: input.operator_facts } : {}),
      ...(opts.grounder_client !== undefined ? { client: opts.grounder_client } : {}),
    };
    groundingResult = await groundFacts(input.current_text, grounderOpts);
    verifiedFacts = groundingResult.facts;
    progress({
      id: input.id,
      stage: "ground_done",
      facts: verifiedFacts.length,
      unverifiable: groundingResult.unverifiable.length,
      turns: groundingResult.ground_turns,
    });
  }

  // Phase 2: Intent extraction (current_text used here — extractor must NOT echo phrasing)
  progress({ id: input.id, stage: "extract_start" });
  const intentResult = await extractIntent(
    {
      id: input.id,
      surface: input.surface,
      job: input.job,
      current_text: input.current_text,
    },
    {
      ...(opts.intent_model !== undefined ? { model: opts.intent_model } : {}),
      ...(opts.intent_client !== undefined ? { client: opts.intent_client } : {}),
    },
  );
  progress({
    id: input.id,
    stage: "extract_done",
    intent: intentResult.intent,
    constraints: intentResult.constraints,
  });

  const attempts: CopyRewriteAttempt[] = [];
  let feedback: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    progress({ id: input.id, stage: "generate_start", attempt, total: maxAttempts });
    // CRITICAL: this payload deliberately omits current_text. Even on retry,
    // feedback is the validator's narrative — never the shipped wording.
    const generation = await generateInCharacter(
      {
        id: input.id,
        surface: input.surface,
        job: input.job,
        intent: intentResult.intent,
        constraints: intentResult.constraints,
        ...(verifiedFacts.length > 0 ? { verified_facts: verifiedFacts } : {}),
      },
      {
        voice,
        ...(opts.generator_model !== undefined ? { model: opts.generator_model } : {}),
        ...(opts.generator_client !== undefined ? { client: opts.generator_client } : {}),
        ...(feedback !== undefined ? { feedback } : {}),
      },
    );
    progress({
      id: input.id,
      stage: "generate_done",
      attempt,
      tempo: generation.selected_tempo,
    });

    progress({ id: input.id, stage: "validate_start", attempt });
    const verdict = await auditTextLLM(generation.replacement_text, {
      voice,
      surface: input.surface,
      job: input.job,
      declared_tempo: generation.selected_tempo,
      model: validatorModel,
      ...(verifiedFacts.length > 0
        ? {
            fact_context: buildFactContext(verifiedFacts),
            deployed_facts: buildDeployedFacts(verifiedFacts),
          }
        : {}),
      ...(opts.validator_client !== undefined ? { client: opts.validator_client } : {}),
    });
    const verifierTempo = verdict.independent_classification.tempo;
    const tempoMatch = verifierTempo === generation.selected_tempo;
    let verifierPass = verdict.passed && tempoMatch;

    // Entity-presence post-check: deterministic check that verified facts
    // appear in the replacement text. Runs after the LLM validator passes.
    if (verifierPass && verifiedFacts.length > 0) {
      const entityCheck = checkEntityPresence(generation.replacement_text, verifiedFacts);
      if (entityCheck.missing.length > 0) {
        const missingNames = entityCheck.missing.map((f) => `${f.claim} (${f.value})`);
        progress({ id: input.id, stage: "entity_check_fail", missing: missingNames, attempt });
        verifierPass = false;
        // Add entity-presence failure to feedback
        const entityFeedback = `Entity check failed. The following verified facts are missing from your replacement: ${missingNames.join(", ")}. These are immutable — include them.`;
        feedback = entityFeedback;
        attempts.push({
          attempt,
          selected_tempo: generation.selected_tempo,
          tempo_reason: generation.tempo_reason,
          replacement_text: generation.replacement_text,
          preserved_intent: generation.preserved_intent,
          verifier_tempo: verifierTempo,
          verifier_pass: false,
          verifier_rationale: verdict.independent_classification.rationale,
          verifier_feedback: entityFeedback,
          verdict,
        });
        progress({
          id: input.id,
          stage: "validate_done",
          attempt,
          passed: false,
          tempo_match: tempoMatch,
          verifier_tempo: verifierTempo,
        });
        continue;
      }
    }

    progress({
      id: input.id,
      stage: "validate_done",
      attempt,
      passed: verifierPass,
      tempo_match: tempoMatch,
      verifier_tempo: verifierTempo,
    });

    attempts.push({
      attempt,
      selected_tempo: generation.selected_tempo,
      tempo_reason: generation.tempo_reason,
      replacement_text: generation.replacement_text,
      preserved_intent: generation.preserved_intent,
      verifier_tempo: verifierTempo,
      verifier_pass: verifierPass,
      verifier_rationale: verdict.independent_classification.rationale,
      verifier_feedback: verdict.feedback,
      verdict,
    });

    if (verifierPass) break;

    // Build retry feedback. Combine the tempo mismatch (if any) with the
    // validator's own feedback. Never include current_text.
    const feedbackParts: string[] = [];
    if (!tempoMatch) {
      feedbackParts.push(
        `Your declared tempo was "${generation.selected_tempo}" but the blind validator read the line as "${verifierTempo}" (confidence ${verdict.independent_classification.confidence.toFixed(2)}): ${verdict.independent_classification.rationale}`,
      );
    }
    if (!verdict.passed) {
      if (verdict.feedback) feedbackParts.push(`Validator feedback: ${verdict.feedback}`);
      for (const issue of verdict.voice_issues) {
        feedbackParts.push(`Voice issue [${issue.rule}]: ${issue.fix}`);
      }
    }
    feedback = feedbackParts.join("\n");
  }

  const finalAttempt = attempts[attempts.length - 1];
  if (!finalAttempt) {
    throw new Error("rewriteCopyLoop produced zero attempts — should be unreachable");
  }
  const similarity = tokenJaccard(input.current_text, finalAttempt.replacement_text);

  return {
    id: input.id,
    surface: input.surface,
    current_text: input.current_text,
    intent: intentResult.intent,
    constraints: intentResult.constraints,
    verified_facts: verifiedFacts,
    ...(groundingResult !== undefined ? { grounding: groundingResult } : {}),
    attempts,
    final: {
      selected_tempo: finalAttempt.selected_tempo,
      replacement_text: finalAttempt.replacement_text,
      verifier_tempo: finalAttempt.verifier_tempo,
      verifier_pass: finalAttempt.verifier_pass,
      verifier_rationale: finalAttempt.verifier_rationale,
    },
    retry_count: attempts.length - 1,
    similarity_to_current: similarity,
    similarity_poisoning_flag: similarity >= POISONING_FLAG_THRESHOLD,
    ok: finalAttempt.verifier_pass,
    intent_model: intentResult.model,
    generator_model: opts.generator_model ?? process.env.COMMS_GENERATOR_MODEL ?? DEFAULT_GENERATOR_MODEL,
    validator_model: validatorModel,
  };
}

// -- Similarity metric --------------------------------------------------------

/**
 * Token Jaccard over lowercased word-tokens.
 *
 * Tokenization: /[a-z0-9]+/gi after lowercasing.
 * Filtering: drop tokens shorter than 3 chars; drop standard English stopwords
 * (the, and, or, of, a, to, in, on, for, with, your, you, we, is, are).
 * Result: |A ∩ B| / |A ∪ B|, in [0, 1].
 *
 * Threshold for "possible context poisoning" flag: similarity >= 0.6 means the
 * regenerated copy converged dangerously close to the shipped wording. Since
 * the generator never saw the shipped wording, similarity >= 0.6 is evidence
 * that either (a) the intent extractor leaked phrasing into the intent or
 * constraints, or (b) the job description itself is verbose enough that it
 * encodes the answer, or (c) the surface is so narrow that the character has
 * essentially one viable phrasing — which is also useful information.
 */
export const POISONING_THRESHOLD = POISONING_FLAG_THRESHOLD;

// Canonical stopword list from the spec. Items <3 chars never reach the set
// because the length filter in tokenize() drops them first; listed here for
// completeness so the source-of-truth is unambiguous.
const SPEC_STOPWORDS = [
  "the", "and", "or", "of", "a", "to", "in", "on", "for", "with",
  "your", "you", "we", "is", "are",
];
const STOPWORDS = new Set(SPEC_STOPWORDS.filter((word) => word.length >= 3));

export function tokenJaccard(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersect = 0;
  for (const token of setA) {
    if (setB.has(token)) intersect += 1;
  }
  const union = setA.size + setB.size - intersect;
  if (union === 0) return 0;
  return intersect / union;
}

function tokenize(input: string): Set<string> {
  const tokens = input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (const token of tokens) {
    if (token.length < 3) continue;
    if (STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return out;
}

// -- Internal helpers ---------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isMainTempo(value: string, voice: CharacterSpec): value is TempoName {
  return (voice.main_tempi as string[]).includes(value);
}
