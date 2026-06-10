import { describe, expect, it } from "vitest";
import {
  buildCopyGenerationTools,
  buildCopyGenerationSystemPrompt,
  buildCopyGenerationUserMessage,
  buildIntentExtractionTools,
  buildIntentExtractionUserMessage,
  extractIntent,
  generateInCharacter,
  parseCopyGenerationToolUse,
  parseIntentExtractionToolUse,
  rewriteCopyLoop,
  tokenJaccard,
} from "../copy-rewrite-llm.js";
import { INFINEX_VOICE } from "../voice/infinex.js";
import type { Anthropic } from "@anthropic-ai/sdk";

type Content = Anthropic.Message["content"];

function toolUse(name: string, input: Record<string, unknown>) {
  return {
    type: "tool_use",
    id: `toolu_${name}`,
    name,
    input,
  } as never;
}

function intentPayload(input: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    intent:
      "Tell a first-time visitor what the product is in a single decisive line that names the position.",
    constraints: ["homepage hero", "single line", "imperative or copular shape"],
    ...input,
  };
}

function generationPayload(input: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    selected_tempo: "commanding",
    tempo_reason: "Hero label — Pressing → Punching landing.",
    replacement_text: "Spot Hyperliquid is live in Infinex.",
    preserved_intent: "Name the product position in a single decisive line.",
    ...input,
  };
}

function passVerdict(tempo: string = "commanding") {
  return toolUse("audit_pass", {
    notes: "fits",
    independent_classification: {
      tempo,
      motifs: ["pressing", "punching"],
      confidence: 0.9,
      rationale: "decisive landing on the fact",
    },
  });
}

function failVerdict(opts: {
  tempo: string;
  feedback: string;
  rule?: string;
  fix?: string;
}) {
  return toolUse("audit_fail", {
    feedback: opts.feedback,
    voice_issues: opts.rule
      ? [{ line: "x", rule: opts.rule, fix: opts.fix ?? "rewrite" }]
      : [],
    independent_classification: {
      tempo: opts.tempo,
      motifs: ["floating"],
      confidence: 0.7,
      rationale: "off-character read",
    },
  });
}

// -- Tool schemas -------------------------------------------------------------

describe("intent extractor tool schema", () => {
  it("emits a single emit_intent tool with intent + constraints required", () => {
    const tools = buildIntentExtractionTools();
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    expect(tool?.name).toBe("emit_intent");
    expect(tool?.input_schema).toMatchObject({ required: ["intent", "constraints"] });
  });

  it("user message carries surface, job, current_text, id", () => {
    const message = buildIntentExtractionUserMessage({
      id: "H01",
      surface: "Infinex homepage hero",
      job: "hero",
      current_text: "Change the way you crypto.",
    });
    const parsed = JSON.parse(message) as Record<string, unknown>;
    expect(parsed.id).toBe("H01");
    expect(parsed.surface).toBe("Infinex homepage hero");
    expect(parsed.job).toBe("hero");
    expect(parsed.current_text).toBe("Change the way you crypto.");
  });

  it("parses emit_intent tool output", () => {
    const result = parseIntentExtractionToolUse(
      [toolUse("emit_intent", intentPayload()) as never] as Content,
      "H01",
      "claude-sonnet-4-6",
    );
    expect(result?.id).toBe("H01");
    expect(result?.constraints.length).toBeGreaterThan(0);
    expect(result?.intent).toContain("first-time visitor");
  });
});

describe("generator tool schema", () => {
  it("restricts selected_tempo to the voice's main tempi", () => {
    const tool = buildCopyGenerationTools(INFINEX_VOICE)[0];
    const schema = tool?.input_schema as { properties: { selected_tempo: { enum: string[] } } };
    expect(schema.properties.selected_tempo.enum).toEqual([...INFINEX_VOICE.main_tempi]);
  });

  it("rejects an unknown tempo in the generator output", () => {
    const result = parseCopyGenerationToolUse(
      [toolUse("emit_replacement_copy", generationPayload({ selected_tempo: "not-a-tempo" })) as never] as Content,
      "H01",
      "claude-opus-4-7",
    );
    expect(result).toBeNull();
  });

  it("user message excludes current_text and includes intent + constraints", () => {
    const message = buildCopyGenerationUserMessage({
      id: "H01",
      surface: "Infinex homepage hero",
      job: "hero",
      intent: "Name the product position.",
      constraints: ["single line"],
    });
    expect(message).not.toMatch(/current_text/);
    expect(message).toContain("Name the product position.");
    expect(message).toContain("single line");
  });

  it("retry payload threads feedback but never current_text", () => {
    const message = buildCopyGenerationUserMessage(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        intent: "Name the product position.",
        constraints: ["single line"],
      },
      "Validator read this as sociable, not commanding. Land on the fact, not on partner credit.",
    );
    expect(message).toContain("previous_attempt_feedback");
    expect(message).not.toMatch(/current_text/);
  });

  it("generator system prompt does NOT contain the words 'current_text' or shipped wording cues", () => {
    const prompt = buildCopyGenerationSystemPrompt(INFINEX_VOICE);
    expect(prompt.toLowerCase()).toContain("never seen the current shipped copy");
    expect(prompt).not.toContain("current_text");
  });
});

// -- Single-call functions ----------------------------------------------------

describe("extractIntent", () => {
  it("returns intent + constraints from the tool call", async () => {
    let lastCall: Parameters<NonNullable<Anthropic["messages"]["create"]>>[0] | null = null;
    const client = {
      messages: {
        create: async (params: Parameters<Anthropic["messages"]["create"]>[0]) => {
          lastCall = params;
          return {
            content: [toolUse("emit_intent", intentPayload()) as never] as Content,
          };
        },
      },
    };
    const result = await extractIntent(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        current_text: "Change the way you crypto.",
      },
      { client },
    );
    expect(result.intent).toContain("first-time visitor");
    expect(result.constraints).toContain("homepage hero");
    expect(lastCall).not.toBeNull();
    // Sanity: the call DID include current_text — extractor is allowed to see it.
    expect(JSON.stringify(lastCall)).toContain("Change the way you crypto.");
  });
});

describe("generateInCharacter", () => {
  it("never sends current_text in the user message", async () => {
    let messagePayload = "";
    const client = {
      messages: {
        create: async (params: Parameters<Anthropic["messages"]["create"]>[0]) => {
          const content = params.messages[0]?.content;
          messagePayload = typeof content === "string" ? content : JSON.stringify(content);
          return {
            content: [toolUse("emit_replacement_copy", generationPayload()) as never] as Content,
          };
        },
      },
    };
    const result = await generateInCharacter(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        intent: "Name the product position.",
        constraints: ["single line"],
      },
      { client },
    );
    expect(result.selected_tempo).toBe("commanding");
    expect(messagePayload).not.toMatch(/Change the way you crypto/);
    expect(messagePayload).not.toMatch(/current_text/);
  });

  it("throws when the generator emits an off-spec tempo", async () => {
    const client = {
      messages: {
        create: async () => ({
          content: [
            toolUse("emit_replacement_copy", generationPayload({ selected_tempo: "egocentric" })) as never,
          ] as Content,
        }),
      },
    };
    await expect(
      generateInCharacter(
        {
          id: "H01",
          surface: "Infinex homepage hero",
          job: "hero",
          intent: "Name the product position.",
          constraints: ["single line"],
        },
        { client },
      ),
    ).rejects.toThrow(/emit_replacement_copy/);
  });
});

// -- Orchestrator -------------------------------------------------------------

describe("rewriteCopyLoop", () => {
  it("happy path: extract → generate → validate, pass on attempt 1", async () => {
    const intentClient = {
      messages: {
        create: async () => ({
          content: [toolUse("emit_intent", intentPayload()) as never] as Content,
        }),
      },
    };
    let generatorCalls = 0;
    const generatorPayloads: string[] = [];
    const generatorClient = {
      messages: {
        create: async (params: Parameters<Anthropic["messages"]["create"]>[0]) => {
          generatorCalls += 1;
          const content = params.messages[0]?.content;
          generatorPayloads.push(typeof content === "string" ? content : JSON.stringify(content));
          return {
            content: [toolUse("emit_replacement_copy", generationPayload()) as never] as Content,
          };
        },
      },
    };
    const validatorClient = {
      messages: {
        create: async () => ({
          content: [passVerdict("commanding") as never] as Content,
        }),
      },
    };

    const result = await rewriteCopyLoop(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        current_text: "Change the way you crypto.",
      },
      {
        intent_client: intentClient,
        generator_client: generatorClient,
        validator_client: validatorClient,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.retry_count).toBe(0);
    expect(result.attempts).toHaveLength(1);
    expect(result.final.selected_tempo).toBe("commanding");
    expect(result.final.verifier_pass).toBe(true);
    expect(result.intent).toContain("first-time visitor");
    expect(generatorCalls).toBe(1);
    // No generator payload should ever contain the shipped wording.
    for (const payload of generatorPayloads) {
      expect(payload).not.toMatch(/Change the way you crypto/);
    }
  });

  it("retries on tempo mismatch and threads feedback into the generator", async () => {
    const intentClient = {
      messages: {
        create: async () => ({
          content: [toolUse("emit_intent", intentPayload()) as never] as Content,
        }),
      },
    };
    let generatorCalls = 0;
    const seenFeedback: boolean[] = [];
    const seenCurrentText: boolean[] = [];
    const generatorClient = {
      messages: {
        create: async (params: Parameters<Anthropic["messages"]["create"]>[0]) => {
          generatorCalls += 1;
          const content = params.messages[0]?.content;
          const payload = typeof content === "string" ? content : JSON.stringify(content);
          seenFeedback.push(payload.includes("previous_attempt_feedback"));
          seenCurrentText.push(/Change the way you crypto/.test(payload));
          return {
            content: [toolUse("emit_replacement_copy", generationPayload()) as never] as Content,
          };
        },
      },
    };
    let validatorCalls = 0;
    const validatorClient = {
      messages: {
        create: async () => {
          validatorCalls += 1;
          if (validatorCalls === 1) {
            // First attempt: validator reads it as a different tempo.
            return {
              content: [passVerdict("sociable") as never] as Content,
            };
          }
          return { content: [passVerdict("commanding") as never] as Content };
        },
      },
    };

    const result = await rewriteCopyLoop(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        current_text: "Change the way you crypto.",
      },
      {
        intent_client: intentClient,
        generator_client: generatorClient,
        validator_client: validatorClient,
      },
    );

    expect(generatorCalls).toBe(2);
    expect(seenFeedback).toEqual([false, true]); // feedback threaded on retry only
    expect(seenCurrentText.some(Boolean)).toBe(false); // never current_text
    expect(result.retry_count).toBe(1);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.verifier_pass).toBe(false);
    expect(result.attempts[1]?.verifier_pass).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("exhausts max_attempts when validation never passes", async () => {
    const intentClient = {
      messages: {
        create: async () => ({
          content: [toolUse("emit_intent", intentPayload()) as never] as Content,
        }),
      },
    };
    const generatorClient = {
      messages: {
        create: async () => ({
          content: [toolUse("emit_replacement_copy", generationPayload()) as never] as Content,
        }),
      },
    };
    const validatorClient = {
      messages: {
        create: async () => ({
          content: [
            failVerdict({
              tempo: "unknown",
              feedback: "off-character",
              rule: "marketing_in_utility",
              fix: "name a mechanic",
            }) as never,
          ] as Content,
        }),
      },
    };

    const result = await rewriteCopyLoop(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        current_text: "Change the way you crypto.",
      },
      {
        intent_client: intentClient,
        generator_client: generatorClient,
        validator_client: validatorClient,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.attempts).toHaveLength(3);
    expect(result.retry_count).toBe(2);
    expect(result.final.verifier_pass).toBe(false);
  });

  it("respects a custom max_attempts setting", async () => {
    const intentClient = {
      messages: {
        create: async () => ({
          content: [toolUse("emit_intent", intentPayload()) as never] as Content,
        }),
      },
    };
    const generatorClient = {
      messages: {
        create: async () => ({
          content: [toolUse("emit_replacement_copy", generationPayload()) as never] as Content,
        }),
      },
    };
    const validatorClient = {
      messages: {
        create: async () => ({
          content: [
            failVerdict({ tempo: "unknown", feedback: "off-character" }) as never,
          ] as Content,
        }),
      },
    };

    const result = await rewriteCopyLoop(
      {
        id: "H01",
        surface: "Infinex homepage hero",
        job: "hero",
        current_text: "Change the way you crypto.",
      },
      {
        intent_client: intentClient,
        generator_client: generatorClient,
        validator_client: validatorClient,
        max_attempts: 2,
      },
    );

    expect(result.attempts).toHaveLength(2);
    expect(result.retry_count).toBe(1);
  });
});

// -- Similarity --------------------------------------------------------------

describe("tokenJaccard", () => {
  it("returns 0 for completely disjoint copy", () => {
    expect(tokenJaccard("Change the way you crypto.", "Spot Hyperliquid is live.")).toBe(0);
  });

  it("returns 1 for identical copy (after stopword + length filter)", () => {
    expect(tokenJaccard("Spot Hyperliquid live now.", "Spot Hyperliquid live now.")).toBe(1);
  });

  it("ignores stopwords and short tokens when scoring", () => {
    // 'the', 'is', 'and' are stopwords; 'is' is <3 chars regardless.
    const score = tokenJaccard(
      "Spot Hyperliquid is live and ready.",
      "Spot Hyperliquid live ready.",
    );
    expect(score).toBe(1);
  });

  it("flags high overlap as a poisoning candidate at >= 0.6", () => {
    const a = "Change the way you crypto with Infinex.";
    const b = "Change crypto with Infinex now.";
    const score = tokenJaccard(a, b);
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it("returns 0 when both strings are empty after filtering", () => {
    expect(tokenJaccard("", "")).toBe(0);
    expect(tokenJaccard("a is or", "to in on")).toBe(0);
  });
});
