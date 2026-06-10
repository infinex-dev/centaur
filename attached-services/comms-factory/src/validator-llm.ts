import Anthropic from "@anthropic-ai/sdk";
import { INFINEX_VOICE } from "./voice/infinex.js";
import type { BeatSequence, CharacterSpec, TempoName, WorkingAction } from "./voice/types.js";

export const DEFAULT_LLM_VALIDATOR_MODEL = "claude-sonnet-4-6";

export type LLMAuditToolName = "audit_pass" | "audit_fail";
export type LLMFactualSeverity = "hard_fail" | "soft_warn";

export type DetectedDrive =
  | "doing"
  | "spell"
  | "passion"
  | "vision"
  | "doing-passion"
  | "spell-vision"
  | "unknown";

export const DETECTED_DRIVES: DetectedDrive[] = [
  "doing",
  "spell",
  "passion",
  "vision",
  "doing-passion",
  "spell-vision",
  "unknown",
];

export interface LLMIndependentClassification {
  tempo: TempoName | "unknown";
  motifs: WorkingAction[];
  detected_drive: DetectedDrive;
  confidence: number;
  rationale: string;
}

export interface LLMVoiceIssue {
  line: string;
  rule: string;
  fix: string;
}

export interface LLMFactualIssue {
  claim: string;
  evidence: string;
  severity: LLMFactualSeverity;
}

export interface LLMVoiceAuditVerdict {
  passed: boolean;
  tool: LLMAuditToolName;
  model: string;
  feedback: string;
  notes?: string;
  voice_issues: LLMVoiceIssue[];
  factual_issues: LLMFactualIssue[];
  independent_classification: LLMIndependentClassification;
}

export type ClassificationScope = "primary" | "beat";

export interface LLMValidationContext {
  surface?: string;
  job?: string;
  declared_tempo?: TempoName;
  deployed_facts?: string[];
  fact_context?: string;
  /**
   * `"primary"` (default) restricts blind-classification to the voice's `main_tempi`
   * + `unknown`. Reserve / beat-only tempi are NOT valid primary classifications —
   * standalone copy that reads as a reserve tempo must classify `unknown` and fail
   * the audit. `"beat"` widens the classification enum to include `beat_only_tempi`,
   * because within a declared multi-beat sequence a single beat MAY occupy a reserve
   * tempo (e.g. a Self-contained interlude between Commanding beats).
   * `auditBeatsLLM` passes `"beat"` automatically; everything else defaults `"primary"`.
   */
  classification_scope?: ClassificationScope;
}

export interface LLMVoiceAuditOptions extends LLMValidationContext {
  voice?: CharacterSpec;
  model?: string;
  max_tokens?: number;
  client?: AnthropicMessagesClient;
}

export interface LLMBeatAuditResult {
  beat_index: number;
  declared_tempo?: TempoName;
  classified_tempo: TempoName | "unknown";
  classified_confidence: number;
  passed: boolean;
  reason?: string;
  verdict: LLMVoiceAuditVerdict;
}

export interface LLMCopyAuditSample {
  id: string;
  text: string;
  surface?: string;
  job?: string;
  declared_tempo?: TempoName | "off-spec";
}

export interface LLMCopyAuditItem {
  id: string;
  passed: boolean;
  feedback: string;
  notes?: string;
  voice_issues: LLMVoiceIssue[];
  factual_issues: LLMFactualIssue[];
  independent_classification: LLMIndependentClassification;
}

export interface LLMCopySetAuditResult {
  model: string;
  items: LLMCopyAuditItem[];
}

type AnthropicTool = NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>[number];
type AnthropicContentBlock = Anthropic.Message["content"][number];
type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];

interface AnthropicMessagesClient {
  messages: {
    create: (params: AnthropicCreateParams) => Promise<{ content: Anthropic.Message["content"] }>;
  };
}

const MAX_TOKENS = 2048;

const WORKING_ACTIONS: WorkingAction[] = [
  "pressing",
  "wringing",
  "gliding",
  "floating",
  "punching",
  "slashing",
  "dabbing",
  "flicking",
];

export function buildLLMAuditTools(
  voice: CharacterSpec = INFINEX_VOICE,
  opts: { classification_scope?: ClassificationScope } = {},
): AnthropicTool[] {
  const tempoNames = availableTempoNames(voice, opts.classification_scope ?? "primary");
  const independentClassificationSchema = {
    type: "object",
    description:
      "Validator's blind read of the prose. Classify what is actually on the page, not what the generator or caller declared.",
    properties: {
      tempo: {
        type: "string",
        enum: [...tempoNames, "unknown"],
        description:
          "`unknown` is correct when the line reads as generic marketing, neutral taxonomy, or otherwise outside the Infinex character.",
      },
      motifs: {
        type: "array",
        items: { type: "string", enum: WORKING_ACTIONS },
        minItems: 1,
        maxItems: 4,
      },
      detected_drive: {
        type: "string",
        enum: DETECTED_DRIVES,
        description:
          "Which Mirodan drive does the prose actually carry? `doing` = direct action/getting-things-done. `spell` = timeless craft, slow charm. `passion` = urgency/time-pressure/hype/FOMO. `vision` = future-pull, agentic-becoming. Hyphenated pairs (e.g. `spell-vision`) are the canonical sub-axis combinations. Use `unknown` only when no drive reading is defensible. Surface this STRUCTURALLY — do not bury drive in rationale prose.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      rationale: {
        type: "string",
        description: "Short reason for the blind classification. Reference the motor and drive in your reasoning.",
      },
    },
    required: ["tempo", "motifs", "detected_drive", "confidence", "rationale"],
  };

  return [
    {
      name: "audit_pass",
      description:
        "Emit when the text fits the Infinex voice and has no hard factual issue. Always include independent_classification.",
      input_schema: {
        type: "object",
        properties: {
          notes: {
            type: "string",
            description: "One-line audit summary.",
          },
          independent_classification: independentClassificationSchema,
        },
        required: ["notes", "independent_classification"],
      },
    },
    {
      name: "audit_fail",
      description:
        "Emit when the text fails on voice fit, unsupported facts, or hard product-copy mismatch. Always include independent_classification.",
      input_schema: {
        type: "object",
        properties: {
          voice_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                line: { type: "string" },
                rule: { type: "string" },
                fix: { type: "string" },
              },
              required: ["line", "rule", "fix"],
            },
          },
          factual_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                claim: { type: "string" },
                evidence: { type: "string" },
                severity: { type: "string", enum: ["hard_fail", "soft_warn"] },
              },
              required: ["claim", "evidence", "severity"],
            },
          },
          feedback: {
            type: "string",
            description: "Plain-text feedback that a generator or editor can use to rewrite the line.",
          },
          independent_classification: independentClassificationSchema,
        },
        required: ["feedback", "independent_classification"],
      },
    },
  ];
}

export function buildLLMCopySetAuditTools(
  voice: CharacterSpec = INFINEX_VOICE,
  opts: { classification_scope?: ClassificationScope } = {},
): AnthropicTool[] {
  const tempoNames = availableTempoNames(voice, opts.classification_scope ?? "primary");
  const independentClassificationSchema = {
    type: "object",
    properties: {
      tempo: {
        type: "string",
        enum: [...tempoNames, "unknown"],
      },
      motifs: {
        type: "array",
        items: { type: "string", enum: WORKING_ACTIONS },
        minItems: 1,
        maxItems: 4,
      },
      detected_drive: {
        type: "string",
        enum: DETECTED_DRIVES,
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string" },
    },
    required: ["tempo", "motifs", "detected_drive", "confidence", "rationale"],
  };

  return [
    {
      name: "audit_copy_set",
      description:
        "Emit one audit item per input copy sample. Classify every sample blind to declared_tempo and report pass/fail.",
      input_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                passed: { type: "boolean" },
                notes: { type: "string" },
                feedback: { type: "string" },
                voice_issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      line: { type: "string" },
                      rule: { type: "string" },
                      fix: { type: "string" },
                    },
                    required: ["line", "rule", "fix"],
                  },
                },
                factual_issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string" },
                      evidence: { type: "string" },
                      severity: { type: "string", enum: ["hard_fail", "soft_warn"] },
                    },
                    required: ["claim", "evidence", "severity"],
                  },
                },
                independent_classification: independentClassificationSchema,
              },
              required: ["id", "passed", "feedback", "independent_classification"],
            },
          },
        },
        required: ["items"],
      },
    },
  ];
}

export function buildLLMValidatorSystemPrompt(
  voice: CharacterSpec = INFINEX_VOICE,
  opts: { classification_scope?: ClassificationScope } = {},
): string {
  const scope = opts.classification_scope ?? "primary";
  const lines: string[] = [
    `You are the independent LLM validator for ${voice.name}.`,
    "",
    "You are NOT the generator. You do not improve the copy unless a verdict tool asks for a fix. Your job is to audit voice fit and classify the prose blind.",
    "",
    "# Character placement",
    `- Inner Attitude: ${voice.inner_attitude}`,
    `- Stress: ${voice.stress}${voice.stress_pole ? ` (${voice.stress_pole} pole)` : ""}`,
    `- Aspect: ${voice.aspect}`,
    `- Drive: ${voice.drive_primary} + ${voice.drive_secondary}${voice.drive_axis ? ` (${voice.drive_axis})` : ""}`,
    ...(voice.drive_table_cell ? [`- Drive table cell: ${voice.drive_table_cell}`] : []),
    ...(voice.drive_introvert ? [`- Drive introvert: ${voice.drive_introvert} (hidden Lining, not visible Outer)`] : []),
    ...(voice.drive_extravert ? [`- Drive extravert: ${voice.drive_extravert} (visible Outer)`] : []),
    `- Off-spec visible/extravert drive surfaces: ${voice.off_spec_drives.join(", ") || "none"}`,
    "",
    ...(voice.mirodan_kernel
      ? [
          "# Mirodan framework",
          "",
          "Use these derivation rules when judging voice fit. The audit is only as good as this spec.",
          "",
          voice.mirodan_kernel,
          "",
        ]
      : []),
    ...(voice.drive_table
      ? [
          "# The 12-cell drive table",
          "",
          voice.drive_table,
          "",
        ]
      : []),
    scope === "beat"
      ? "# Available tempi (BEAT-scope audit — reserve tempi are valid for individual beats within a declared multi-beat sequence)"
      : "# Main tempi (the ONLY valid primary classifications)",
    "",
    scope === "beat"
      ? "You are auditing a single beat within a multi-beat post that the generator declared. Either a main tempo or a reserve tempo is a valid classification for this beat — the generator may have intentionally placed a Self-contained / Diffused / Receptive beat inside the sequence. Judge by whether the prose matches the declared beat's tempo, not whether the tempo is in the standalone-rotation."
      : "These five tempi are the character's locked rotation. Primary classification of a standalone string MUST be one of these five, or `unknown`. Beat-only / reserve tempi exist in the broader Mirodan toolkit but are explicitly out of rotation for this character right now.",
    "",
  ];

  for (const tempoName of voice.main_tempi) {
    const tempo = voice.tempi[tempoName];
    if (!tempo) continue;
    const innerCombo = tempo.inner_combo ?? (tempo.factor_shape ? `${tempo.attitude} · ${tempo.factor_shape}` : tempo.attitude);
    const motorArrow = tempo.motor_relation === "co_exist" ? "/" : "->";
    lines.push(`## ${tempoName}`);
    lines.push(`Inner combo: ${innerCombo}`);
    lines.push(`Motor: ${tempo.motor[0]} ${motorArrow} ${tempo.motor[1]}`);
    if (tempo.canonical_shorthand) lines.push(`Canon: ${tempo.canonical_shorthand}`);
    if (tempo.feel) lines.push(`Feel: ${tempo.feel}`);
    if (tempo.opening_shapes?.length) lines.push(`Opening shapes: ${tempo.opening_shapes.slice(0, 4).join(" | ")}`);
    if (tempo.vocab_anchor?.length) lines.push(`Vocab anchors: ${tempo.vocab_anchor.slice(0, 8).join(", ")}`);
    if (tempo.example_lines?.length) lines.push(`Example lines: ${tempo.example_lines.slice(0, 2).join(" / ")}`);
    lines.push("");
  }

  if (voice.beat_only_tempi.length > 0) {
    if (scope === "beat") {
      lines.push("# Reserve tempi (also classifiable in beat-scope)");
      lines.push("");
      lines.push("In beat-scope you may classify a beat as any of these reserve tempi if its prose actually carries that motor and inner combo. Do not force a main tempo if the beat reads as a reserve tempo.");
      lines.push("");
      for (const tempoName of voice.beat_only_tempi) {
        const tempo = voice.tempi[tempoName];
        if (!tempo) continue;
        const innerCombo = tempo.inner_combo ?? (tempo.factor_shape ? `${tempo.attitude} · ${tempo.factor_shape}` : tempo.attitude);
        const motorArrow = tempo.motor_relation === "co_exist" ? "/" : "->";
        lines.push(`## ${tempoName}`);
        lines.push(`Inner combo: ${innerCombo}`);
        lines.push(`Motor: ${tempo.motor[0]} ${motorArrow} ${tempo.motor[1]}`);
        if (tempo.canonical_shorthand) lines.push(`Canon: ${tempo.canonical_shorthand}`);
        if (tempo.feel) lines.push(`Feel: ${tempo.feel}`);
        if (tempo.example_lines?.length) lines.push(`Example lines: ${tempo.example_lines.slice(0, 1).join(" / ")}`);
        lines.push("");
      }
    } else {
      lines.push("# Reserve tempi (out of rotation — DO NOT classify as primary)");
      lines.push("");
      lines.push("The following tempi exist in the character's broader Mirodan toolkit but are explicitly NOT in the current rotation. If the prose reads as one of these, that is itself a finding — name the reserve tempo in your rationale, then classify as `unknown` and fail the audit with feedback that the prose has slipped into an off-rotation register.");
      lines.push("");
      for (const tempoName of voice.beat_only_tempi) {
        const tempo = voice.tempi[tempoName];
        if (!tempo) continue;
        const innerCombo = tempo.inner_combo ?? (tempo.factor_shape ? `${tempo.attitude} · ${tempo.factor_shape}` : tempo.attitude);
        const motorArrow = tempo.motor_relation === "co_exist" ? "/" : "→";
        const description = tempo.canonical_shorthand ?? tempo.feel ?? "";
        lines.push(`- **${tempoName}** (${innerCombo}, ${tempo.motor[0]} ${motorArrow} ${tempo.motor[1]}): ${description}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "# Voice judgment",
    "",
    "Judge voice fit purely by character coherence. Reason from the character placement above, the available tempi, and the motor vocabulary listed for each tempo. Do NOT apply a hardcoded ban list of words or phrases. A phrase that reads as in-character despite seeming generic is a valid finding — and a phrase you would personally find tacky may still fit the character. Conversely, a phrase that is in your operator's preferred vocabulary but pulls the prose off the character's drive/aspect/stress placement still fails.",
    "",
    "A line fails voice when, and only when, one of these is true:",
    "- It foregrounds an off-spec drive as the visible/extravert surface. For this character those surfaces are listed above. Read the prose for what drive it actually projects (e.g. Passion surfaces through urgency framing, time-pressure, FOMO, hype theatre, scarcity-of-attention). If the prose foregrounds an off-spec drive, fail it and name the drive.",
    scope === "beat"
      ? "- It cannot be reconciled with any of the available tempi for this beat (main + reserve), even charitably. The motor vocabulary (Pressing/Wringing/Gliding/Floating → Punching/Slashing/Dabbing/Flicking) is the load-bearing test."
      : "- It reads as a reserve / out-of-rotation tempo (Self-contained, Receptive, Overpowering, Diffused, Egocentric, Altruistic, Unsociable). These tempi exist in the toolkit but are explicitly off-rotation for the current character — even though motor-wise they may fit, the operator has decided they are not part of the spec right now. Name the reserve tempo in your rationale and classify as `unknown`.",
    scope === "beat"
      ? ""
      : "- It cannot be reconciled with any of the FIVE main tempi (Commanding, Practical, Sombre, Irradiant, Sociable), even charitably. The motor vocabulary (Pressing/Wringing/Gliding/Floating → Punching/Slashing/Dabbing/Flicking) is the load-bearing test. If no Sustained → Quick motor pair from a main tempo fits the shape of the prose, classify as `unknown`.",
    "- It makes claims not present in `deployed_facts` or `fact_context`.",
    "",
    "A line does NOT fail merely because it is short, dry, or unexciting. The character should often be dry. A two- or three-word label can be fully Commanding (Pressing → Punching) without ornament. Equally, a longer line can fail even if every word is on the operator's allow-list, if the cumulative drive pulls off the character.",
    "",
    "# Independent classification — blind to declared_tempo",
    "",
    "After the voice and factual audit, classify the prose yourself, BLIND to any `declared_tempo` in the user payload.",
    "Set declared_tempo aside for this step. Do not anchor on it. Anchor on what is actually on the page, read through the motor vocabulary.",
    "",
    "Output:",
    scope === "beat"
      ? "- tempo: any available tempo (main OR reserve) OR `unknown`. Beat-scope audit — declared multi-beat sequences may legitimately place reserve tempi as individual beats."
      : "- tempo: MUST be one of the five main tempi (Commanding, Practical, Sombre, Irradiant, Sociable) OR `unknown`. Reserve tempi are NOT valid primary classifications.",
    "- motifs: 1-4 working actions that the prose actually carries.",
    "- detected_drive: structured drive reading — `doing` (direct action), `spell` (timeless craft), `passion` (urgency/hype/FOMO), `vision` (future-pull), or hyphenated combos (`doing-passion`, `spell-vision`). `unknown` only when no drive is defensible. This is the SAME drive analysis you do in rationale, just emitted as a structured field. Even when you classify the tempo as `unknown` for off-spec drive activation, name the drive here — that is the whole point of the field.",
    "- confidence: 0..1.",
    "- rationale: short explanation grounded in the tempo's motor and inner combo, not just surface vocabulary. If you classify `unknown`, name which character trait the line fails to embody (e.g. 'reads as Passion-pulled — urgency framing inconsistent with Spell-Vision drive', 'no Sustained → Quick motor pair from the main rotation fits — closest read would be Self-contained which is out-of-rotation', or 'reads as Diffused — quiet post-launch reflection — but Diffused is reserve only').",
    "",
    "`unknown` is a valid, important classification. Use it when the copy reads outside the five main tempi — including when it reads as a reserve tempo.",
    "",
    "If your classification disagrees with `declared_tempo`, that is a feature, not a bug. The caller will compare them.",
    "",
    "# Output contract",
    "",
    "Emit exactly ONE verdict tool call. No prose outside tool calls.",
    "Use `audit_pass` only when the line fits the voice and has no hard factual issue.",
    "Use `audit_fail` when there is any hard voice issue or hard factual issue.",
    "Both tools require `independent_classification`.",
  );

  return lines.join("\n");
}

export function buildLLMValidatorUserMessage(
  text: string,
  opts: LLMValidationContext = {},
): string {
  return JSON.stringify(
    {
      text,
      surface: opts.surface ?? "",
      job: opts.job ?? "",
      declared_tempo: opts.declared_tempo ?? "",
      deployed_facts: opts.deployed_facts ?? [],
      fact_context: opts.fact_context ?? "",
    },
    null,
    2,
  );
}

export function buildLLMCopySetUserMessage(samples: LLMCopyAuditSample[]): string {
  return JSON.stringify(
    {
      instruction:
        "Audit each copy sample independently. Do not let one sample's declared_tempo or result influence another. Return exactly one item per id.",
      samples,
    },
    null,
    2,
  );
}

export function parseLLMAuditToolUse(
  content: AnthropicContentBlock[],
  model: string = DEFAULT_LLM_VALIDATOR_MODEL,
): LLMVoiceAuditVerdict | null {
  for (const block of content) {
    if (block.type !== "tool_use") continue;
    if (block.name !== "audit_pass" && block.name !== "audit_fail") continue;
    const payload = isRecord(block.input) ? block.input : {};
    return block.name === "audit_pass"
      ? parsePass(payload, model)
      : parseFail(payload, model);
  }
  return null;
}

export function parseLLMCopySetToolUse(
  content: AnthropicContentBlock[],
  model: string = DEFAULT_LLM_VALIDATOR_MODEL,
): LLMCopySetAuditResult | null {
  for (const block of content) {
    if (block.type !== "tool_use") continue;
    if (block.name !== "audit_copy_set") continue;
    const payload = isRecord(block.input) ? block.input : {};
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    return {
      model,
      items: rawItems.flatMap((item) => {
        if (!isRecord(item)) return [];
        const id = stringOrEmpty(item.id);
        if (!id) return [];
        const notes = stringOrEmpty(item.notes);
        return [{
          id,
          passed: item.passed === true,
          feedback: stringOrEmpty(item.feedback),
          ...(notes ? { notes } : {}),
          voice_issues: parseVoiceIssues(item.voice_issues),
          factual_issues: parseFactualIssues(item.factual_issues),
          independent_classification: parseIndependentClassification(item.independent_classification),
        }];
      }),
    };
  }
  return null;
}

export async function auditTextLLM(
  text: string,
  opts: LLMVoiceAuditOptions = {},
): Promise<LLMVoiceAuditVerdict> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const model = opts.model ?? process.env.COMMS_VOICE_VALIDATOR_MODEL ?? DEFAULT_LLM_VALIDATOR_MODEL;
  const client = opts.client ?? new Anthropic();
  const scope = opts.classification_scope ?? "primary";
  const response = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? MAX_TOKENS,
    system: buildLLMValidatorSystemPrompt(voice, { classification_scope: scope }),
    tools: buildLLMAuditTools(voice, { classification_scope: scope }),
    tool_choice: { type: "any", disable_parallel_tool_use: true },
    messages: [
      {
        role: "user",
        content: buildLLMValidatorUserMessage(text, opts),
      },
    ],
  });
  const verdict = parseLLMAuditToolUse(response.content, model);
  if (!verdict) {
    throw new Error("LLM validator did not emit audit_pass or audit_fail");
  }
  return verdict;
}

export async function auditCopySetLLM(
  samples: LLMCopyAuditSample[],
  opts: Omit<LLMVoiceAuditOptions, keyof LLMValidationContext> & { classification_scope?: ClassificationScope } = {},
): Promise<LLMCopySetAuditResult> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const model = opts.model ?? process.env.COMMS_VOICE_VALIDATOR_MODEL ?? DEFAULT_LLM_VALIDATOR_MODEL;
  const client = opts.client ?? new Anthropic();
  const scope = opts.classification_scope ?? "primary";
  const response = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? Math.max(MAX_TOKENS, samples.length * 450),
    system: buildLLMValidatorSystemPrompt(voice, { classification_scope: scope }),
    tools: buildLLMCopySetAuditTools(voice, { classification_scope: scope }),
    tool_choice: { type: "tool", name: "audit_copy_set", disable_parallel_tool_use: true },
    messages: [
      {
        role: "user",
        content: buildLLMCopySetUserMessage(samples),
      },
    ],
  });
  const result = parseLLMCopySetToolUse(response.content, model);
  if (!result) {
    throw new Error("LLM copy-set validator did not emit audit_copy_set");
  }
  const received = new Set(result.items.map((item) => item.id));
  const missing = samples.map((sample) => sample.id).filter((id) => !received.has(id));
  if (missing.length > 0) {
    throw new Error(`LLM copy-set validator omitted item(s): ${missing.join(", ")}`);
  }
  return result;
}

export async function auditBeatsLLM(
  text: string,
  beats: BeatSequence,
  opts: Omit<LLMVoiceAuditOptions, "declared_tempo"> = {},
): Promise<LLMBeatAuditResult[]> {
  const paragraphs = splitIntoBeats(text);
  const results: LLMBeatAuditResult[] = [];

  for (let i = 0; i < beats.beats.length; i++) {
    const declared = beats.beats[i];
    if (!declared) continue;
    const paragraph = paragraphs[i];
    if (!paragraph) {
      results.push({
        beat_index: i,
        ...(declared.tempo !== undefined ? { declared_tempo: declared.tempo } : {}),
        classified_tempo: "unknown",
        classified_confidence: 0,
        passed: false,
        reason: "missing paragraph for declared beat",
        verdict: missingParagraphVerdict(opts.model ?? DEFAULT_LLM_VALIDATOR_MODEL),
      });
      continue;
    }

    const verdict = await auditTextLLM(paragraph, {
      ...opts,
      ...(declared.tempo !== undefined ? { declared_tempo: declared.tempo } : {}),
      // Beat audits ALWAYS use beat-scope classification — within a declared
      // multi-beat sequence, reserve tempi (Self-contained, Receptive, etc.)
      // are valid for individual beats even though they are invalid as the
      // primary register of standalone copy. Caller can override but the
      // default for beat audits must be "beat".
      classification_scope: opts.classification_scope ?? "beat",
    });
    const classification = verdict.independent_classification;
    // Mirodan: tempo is what the audience reads, not what the actor declares.
    // Pass if the classified tempo is within the voice's locked palette,
    // regardless of whether it matches the generator's declared intent.
    const checkVoice = opts.voice ?? INFINEX_VOICE;
    const inPlacement =
      classification.tempo !== "unknown" &&
      checkVoice.tempi[classification.tempo as TempoName] !== undefined;
    const passed = verdict.passed && inPlacement;
    const result: LLMBeatAuditResult = {
      beat_index: i,
      ...(declared.tempo !== undefined ? { declared_tempo: declared.tempo } : {}),
      classified_tempo: classification.tempo,
      classified_confidence: classification.confidence,
      passed,
      verdict,
    };
    if (!inPlacement) {
      result.reason = `LLM validator read ${classification.tempo} (confidence ${classification.confidence.toFixed(2)}) — outside the voice's locked tempi: ${classification.rationale}`;
    } else if (!verdict.passed) {
      result.reason = `LLM validator failed voice audit: ${verdict.feedback || summarizeVoiceIssues(verdict.voice_issues)}`;
    } else if (declared.tempo && classification.tempo !== declared.tempo) {
      // Only surfaces under the legacy single-call path (which still
      // passes a declared tempo). Two-call path has no declared tempo so
      // this branch never fires.
      result.reason = `audience read ${classification.tempo} (legacy path declared ${declared.tempo})`;
    }
    results.push(result);
  }

  return results;
}

function parsePass(payload: Record<string, unknown>, model: string): LLMVoiceAuditVerdict {
  const notes = stringOrEmpty(payload.notes);
  return {
    passed: true,
    tool: "audit_pass",
    model,
    feedback: notes,
    ...(notes ? { notes } : {}),
    voice_issues: [],
    factual_issues: [],
    independent_classification: parseIndependentClassification(payload.independent_classification),
  };
}

function parseFail(payload: Record<string, unknown>, model: string): LLMVoiceAuditVerdict {
  return {
    passed: false,
    tool: "audit_fail",
    model,
    feedback: stringOrEmpty(payload.feedback),
    voice_issues: parseVoiceIssues(payload.voice_issues),
    factual_issues: parseFactualIssues(payload.factual_issues),
    independent_classification: parseIndependentClassification(payload.independent_classification),
  };
}

function parseIndependentClassification(payload: unknown): LLMIndependentClassification {
  if (!isRecord(payload)) {
    return {
      tempo: "unknown",
      motifs: [],
      detected_drive: "unknown",
      confidence: 0,
      rationale: "missing independent_classification",
    };
  }
  const tempo = typeof payload.tempo === "string" ? payload.tempo : "unknown";
  const drive = typeof payload.detected_drive === "string" ? payload.detected_drive : "unknown";
  return {
    tempo: isTempoNameOrUnknown(tempo) ? tempo : "unknown",
    motifs: Array.isArray(payload.motifs)
      ? payload.motifs.filter((motif): motif is WorkingAction => isWorkingAction(motif))
      : [],
    detected_drive: isDetectedDrive(drive) ? drive : "unknown",
    confidence: typeof payload.confidence === "number" ? clamp01(payload.confidence) : 0,
    rationale: stringOrEmpty(payload.rationale),
  };
}

function isDetectedDrive(value: string): value is DetectedDrive {
  return (DETECTED_DRIVES as string[]).includes(value);
}

function parseVoiceIssues(payload: unknown): LLMVoiceIssue[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      line: stringOrEmpty(item.line),
      rule: stringOrEmpty(item.rule),
      fix: stringOrEmpty(item.fix),
    }];
  });
}

function parseFactualIssues(payload: unknown): LLMFactualIssue[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => {
    if (!isRecord(item)) return [];
    const severity = item.severity === "soft_warn" ? "soft_warn" : "hard_fail";
    return [{
      claim: stringOrEmpty(item.claim),
      evidence: stringOrEmpty(item.evidence),
      severity,
    }];
  });
}

function availableTempoNames(
  voice: CharacterSpec,
  scope: ClassificationScope = "primary",
): TempoName[] {
  // Primary scope (default): main_tempi only. Reserve / beat-only tempi are
  // not valid primary classifications — operator decision 2026-05-15. The
  // prompt teaches Sonnet to name a reserve tempo in rationale and classify
  // as `unknown` if the prose reads as one.
  //
  // Beat scope: widens the enum to include beat_only_tempi, because within a
  // declared multi-beat sequence one beat MAY occupy a reserve tempo. Used by
  // `auditBeatsLLM` automatically.
  const names = scope === "beat"
    ? [...voice.main_tempi, ...voice.beat_only_tempi]
    : voice.main_tempi;
  return names.filter((name) => Boolean(voice.tempi[name]));
}

function splitIntoBeats(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function missingParagraphVerdict(model: string): LLMVoiceAuditVerdict {
  return {
    passed: false,
    tool: "audit_fail",
    model,
    feedback: "missing paragraph for declared beat",
    voice_issues: [{ line: "", rule: "missing_beat", fix: "Write one paragraph for the declared beat." }],
    factual_issues: [],
    independent_classification: {
      tempo: "unknown",
      motifs: [],
      detected_drive: "unknown",
      confidence: 0,
      rationale: "No text to classify.",
    },
  };
}

function summarizeVoiceIssues(issues: LLMVoiceIssue[]): string {
  return issues.map((issue) => `${issue.rule}: ${issue.fix}`).join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function isWorkingAction(value: unknown): value is WorkingAction {
  return typeof value === "string" && WORKING_ACTIONS.includes(value as WorkingAction);
}

function isTempoNameOrUnknown(value: string): value is TempoName | "unknown" {
  return value === "unknown" || isTempoName(value);
}

function isTempoName(value: string): value is TempoName {
  return [
    "commanding",
    "practical",
    "self-contained",
    "receptive",
    "sombre",
    "overpowering",
    "diffused",
    "irradiant",
    "materialistic",
    "human",
    "warm",
    "cool",
    "unacknowledged",
    "acknowledged",
    "revealed",
    "concealed",
    "egocentric",
    "unsociable",
    "sociable",
    "altruistic",
    "acute",
    "doubting",
    "certain",
    "uncertain",
  ].includes(value);
}
