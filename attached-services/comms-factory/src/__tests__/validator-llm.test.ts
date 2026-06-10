import { describe, expect, it } from "vitest";
import {
  auditBeatsLLM,
  auditCopySetLLM,
  auditTextLLM,
  buildLLMAuditTools,
  buildLLMCopySetAuditTools,
  buildLLMValidatorSystemPrompt,
  parseLLMCopySetToolUse,
  parseLLMAuditToolUse,
} from "../validator-llm.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

function toolUse(name: "audit_pass" | "audit_fail", input: Record<string, unknown>) {
  return {
    type: "tool_use",
    id: `toolu_${name}`,
    name,
    input,
  } as never;
}

describe("LLM validator tools", () => {
  it("requires independent_classification on both verdict tools", () => {
    const tools = buildLLMAuditTools(INFINEX_VOICE);
    const pass = tools.find((tool) => tool.name === "audit_pass");
    const fail = tools.find((tool) => tool.name === "audit_fail");
    expect(pass?.input_schema).toMatchObject({
      required: ["notes", "independent_classification"],
    });
    expect(fail?.input_schema).toMatchObject({
      required: ["feedback", "independent_classification"],
    });
  });

  it("defines a batched copy-set audit tool", () => {
    const tool = buildLLMCopySetAuditTools(INFINEX_VOICE)[0];
    expect(tool?.name).toBe("audit_copy_set");
    expect(tool?.input_schema).toMatchObject({ required: ["items"] });
  });

  it("keeps the blind-classification instruction explicit in the prompt", () => {
    const prompt = buildLLMValidatorSystemPrompt(INFINEX_VOICE);
    expect(prompt).toContain("BLIND to any `declared_tempo`");
    expect(prompt).toContain("Set declared_tempo aside");
    expect(prompt).toContain("unknown");
  });

  it("loads the same Mirodan substrate the generator uses", () => {
    const prompt = buildLLMValidatorSystemPrompt(INFINEX_VOICE);
    expect(prompt).toContain("stable|penetrating|flow");
    expect(prompt).toContain("primary = bottom-left");
    expect(prompt).toContain("introvert = top-left");
    expect(prompt).toContain("primary=spell");
  });

  it("requires detected_drive on both single and batched verdict tools", () => {
    const tools = buildLLMAuditTools(INFINEX_VOICE);
    for (const tool of tools) {
      const cls = (tool.input_schema as { properties: Record<string, { required?: string[]; properties?: Record<string, unknown> }> }).properties.independent_classification;
      expect(cls?.required).toContain("detected_drive");
      const driveSchema = cls?.properties?.detected_drive as { enum?: string[] } | undefined;
      expect(driveSchema?.enum).toContain("passion");
      expect(driveSchema?.enum).toContain("spell-vision");
    }
    const batched = buildLLMCopySetAuditTools(INFINEX_VOICE)[0];
    const itemsSchema = (batched?.input_schema as { properties: { items: { items: { properties: { independent_classification: { required?: string[]; properties?: { detected_drive?: { enum?: string[] } } } } } } } }).properties.items.items.properties.independent_classification;
    expect(itemsSchema?.required).toContain("detected_drive");
    expect(itemsSchema?.properties?.detected_drive?.enum).toContain("passion");
  });

  it("restricts primary-scope tempo enum to main_tempi + unknown", () => {
    const tools = buildLLMAuditTools(INFINEX_VOICE, { classification_scope: "primary" });
    const cls = (tools[0]?.input_schema as { properties: { independent_classification: { properties: { tempo: { enum?: string[] } } } } }).properties.independent_classification.properties.tempo;
    const allowed = new Set(cls.enum ?? []);
    expect(allowed.has("commanding")).toBe(true);
    expect(allowed.has("practical")).toBe(true);
    expect(allowed.has("sombre")).toBe(true);
    expect(allowed.has("irradiant")).toBe(true);
    expect(allowed.has("sociable")).toBe(true);
    expect(allowed.has("unknown")).toBe(true);
    // reserve tempi must be absent
    expect(allowed.has("self-contained")).toBe(false);
    expect(allowed.has("diffused")).toBe(false);
    expect(allowed.has("overpowering")).toBe(false);
  });

  it("widens beat-scope tempo enum to include reserve tempi", () => {
    const tools = buildLLMAuditTools(INFINEX_VOICE, { classification_scope: "beat" });
    const cls = (tools[0]?.input_schema as { properties: { independent_classification: { properties: { tempo: { enum?: string[] } } } } }).properties.independent_classification.properties.tempo;
    const allowed = new Set(cls.enum ?? []);
    expect(allowed.has("commanding")).toBe(true);
    expect(allowed.has("self-contained")).toBe(true);
    expect(allowed.has("diffused")).toBe(true);
    expect(allowed.has("overpowering")).toBe(true);
    expect(allowed.has("unknown")).toBe(true);
  });

  it("beat-scope prompt names reserve tempi as classifiable", () => {
    const primaryPrompt = buildLLMValidatorSystemPrompt(INFINEX_VOICE, { classification_scope: "primary" });
    const beatPrompt = buildLLMValidatorSystemPrompt(INFINEX_VOICE, { classification_scope: "beat" });
    expect(primaryPrompt).toContain("ONLY valid primary classifications");
    expect(primaryPrompt).toContain("DO NOT classify as primary");
    expect(beatPrompt).toContain("BEAT-scope audit");
    expect(beatPrompt).toContain("also classifiable in beat-scope");
    expect(beatPrompt).not.toContain("DO NOT classify as primary");
  });

  it("parses detected_drive on independent_classification and defaults to unknown when missing", () => {
    const withDrive = parseLLMAuditToolUse([
      toolUse("audit_fail", {
        feedback: "off-spec drive",
        independent_classification: {
          tempo: "unknown",
          motifs: ["pressing"],
          detected_drive: "passion",
          confidence: 0.8,
          rationale: "rallying-cry shape",
        },
      }),
    ]);
    expect(withDrive?.independent_classification.detected_drive).toBe("passion");

    const withoutDrive = parseLLMAuditToolUse([
      toolUse("audit_pass", {
        notes: "fits",
        independent_classification: {
          tempo: "commanding",
          motifs: ["pressing", "punching"],
          confidence: 0.9,
          rationale: "decisive",
          // detected_drive intentionally omitted
        },
      }),
    ]);
    expect(withoutDrive?.independent_classification.detected_drive).toBe("unknown");
  });

  it("parses audit_pass independent classification", () => {
    const verdict = parseLLMAuditToolUse([
      toolUse("audit_pass", {
        notes: "fits",
        independent_classification: {
          tempo: "commanding",
          motifs: ["pressing", "punching"],
          confidence: 0.91,
          rationale: "decisive launch line",
        },
      }),
    ]);
    expect(verdict?.passed).toBe(true);
    expect(verdict?.independent_classification.tempo).toBe("commanding");
    expect(verdict?.independent_classification.motifs).toEqual(["pressing", "punching"]);
  });

  it("parses audit_fail issue lists", () => {
    const verdict = parseLLMAuditToolUse([
      toolUse("audit_fail", {
        feedback: "remove marketing copy",
        voice_issues: [{ line: "Enjoy the seamless experience", rule: "marketing_in_utility", fix: "Name the action." }],
        factual_issues: [{ claim: "100 markets", evidence: "not in context", severity: "hard_fail" }],
        independent_classification: {
          tempo: "unknown",
          motifs: ["floating"],
          confidence: 0.7,
          rationale: "generic marketing",
        },
      }),
    ]);
    expect(verdict?.passed).toBe(false);
    expect(verdict?.voice_issues[0]?.rule).toBe("marketing_in_utility");
    expect(verdict?.factual_issues[0]?.severity).toBe("hard_fail");
    expect(verdict?.independent_classification.tempo).toBe("unknown");
  });

  it("parses batched copy-set verdicts", () => {
    const result = parseLLMCopySetToolUse([
      {
        type: "tool_use",
        id: "toolu_batch",
        name: "audit_copy_set",
        input: {
          items: [
            {
              id: "H01",
              passed: false,
              feedback: "generic marketing",
              voice_issues: [{ line: "Change the way you crypto.", rule: "allergen", fix: "Replace." }],
              independent_classification: {
                tempo: "unknown",
                motifs: ["floating"],
                confidence: 0.9,
                rationale: "generic slogan",
              },
            },
          ],
        },
      } as never,
    ]);
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.id).toBe("H01");
    expect(result?.items[0]?.passed).toBe(false);
  });
});

describe("auditTextLLM", () => {
  it("uses Anthropic tool output as the verdict", async () => {
    const client = {
      messages: {
        create: async () => ({
          content: [
            toolUse("audit_pass", {
              notes: "clean task label",
              independent_classification: {
                tempo: "commanding",
                motifs: ["pressing", "punching"],
                confidence: 0.82,
                rationale: "short decisive command",
              },
            }),
          ],
        }),
      },
    };
    const verdict = await auditTextLLM("Import an external wallet.", {
      client,
      voice: INFINEX_VOICE,
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.independent_classification.tempo).toBe("commanding");
  });
});

describe("auditCopySetLLM", () => {
  it("audits multiple copy samples in one model call", async () => {
    let calls = 0;
    const client = {
      messages: {
        create: async () => {
          calls += 1;
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_batch",
                name: "audit_copy_set",
                input: {
                  items: [
                    {
                      id: "S01",
                      passed: false,
                      feedback: "generic marketing",
                      independent_classification: {
                        tempo: "unknown",
                        motifs: ["floating"],
                        confidence: 0.9,
                        rationale: "generic slogan",
                      },
                    },
                    {
                      id: "S02",
                      passed: true,
                      feedback: "clean label",
                      independent_classification: {
                        tempo: "commanding",
                        motifs: ["pressing", "punching"],
                        confidence: 0.82,
                        rationale: "dry command",
                      },
                    },
                  ],
                },
              } as never,
            ],
          };
        },
      },
    };
    const result = await auditCopySetLLM([
      { id: "S01", text: "Change the way you crypto." },
      { id: "S02", text: "Import an external wallet." },
    ], { client, voice: INFINEX_VOICE });
    expect(calls).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(["S01", "S02"]);
  });
});

describe("auditBeatsLLM", () => {
  it("passes with in-placement drift when Sonnet's blind read differs from declared but stays inside voice.tempi", async () => {
    // Mirodan: tempo is what the audience reads, not what the actor declares.
    // Sonnet reads "commanding" while generator declared "irradiant" — both in
    // Infinex's locked tempi → pass with drift reason.
    const client = {
      messages: {
        create: async () => ({
          content: [
            toolUse("audit_pass", {
              notes: "voice fits, audience reads a different in-placement tempo",
              independent_classification: {
                tempo: "commanding",
                motifs: ["pressing", "punching"],
                confidence: 0.86,
                rationale: "decisive launch line",
              },
            }),
          ],
        }),
      },
    };
    const result = await auditBeatsLLM("Today: spot Hyperliquid is live.", {
      beats: [{ tempo: "irradiant" }],
    }, {
      client,
      voice: INFINEX_VOICE,
    });
    expect(result[0]?.passed).toBe(true);
    expect(result[0]?.classified_tempo).toBe("commanding");
    expect(result[0]?.reason).toContain("audience read commanding");
  });

  it("fails when Sonnet's blind read is outside the voice's locked tempi", async () => {
    // Off-placement: Sonnet reads "human" (a Near-attitude tempo), but Infinex
    // is Stable-attitude — "human" is not in INFINEX_VOICE.tempi → fail.
    const client = {
      messages: {
        create: async () => ({
          content: [
            toolUse("audit_pass", {
              notes: "voice fits, but classified tempo is off-placement",
              independent_classification: {
                tempo: "human",
                motifs: ["floating", "gliding"],
                confidence: 0.74,
                rationale: "slow tenderness reads as Near-Human",
              },
            }),
          ],
        }),
      },
    };
    const result = await auditBeatsLLM("Today: spot Hyperliquid is live.", {
      beats: [{ tempo: "irradiant" }],
    }, {
      client,
      voice: INFINEX_VOICE,
    });
    expect(result[0]?.passed).toBe(false);
    expect(result[0]?.classified_tempo).toBe("human");
    expect(result[0]?.reason).toContain("outside the voice's locked tempi");
  });
});
