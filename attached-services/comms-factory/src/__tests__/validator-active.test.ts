import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../card.js";
import {
  auditTextActive,
  buildActiveValidatorSystemPrompt,
} from "../validator-active.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

const CARD: ReleaseCard = {
  id: "active-test",
  kind: "launch-tier",
  title: "Perps Launch",
  ship_date: "2026-05-21",
  audience: ["x"],
  deployed_facts: ["perps provider: Hyperliquid"],
  headline: "Perps",
  tier_reason: "test card",
};

function toolUse(name: string, input: Record<string, unknown>, id = `toolu_${name}`) {
  return {
    type: "tool_use",
    id,
    name,
    input,
  } as never;
}

describe("active validator", () => {
  it("keeps the card allowance boundary explicit in the prompt", () => {
    const prompt = buildActiveValidatorSystemPrompt(INFINEX_VOICE);
    expect(prompt).toContain("ReleaseCard is the allowance boundary");
    expect(prompt).toContain("card_missing_fact");
    expect(prompt).toContain("research_contradiction");
  });

  it("short-circuits deterministic failures before spending on active validation", async () => {
    let calls = 0;
    const client = {
      messages: {
        create: async () => {
          calls += 1;
          return { content: [] as never };
        },
      },
    };

    const verdict = await auditTextActive("Game-changing, next-gen, seamless experience.", {
      card: CARD,
      voice: INFINEX_VOICE,
      deployed_facts_used: ["perps provider: Hyperliquid"],
      not_said: [],
      client,
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.reason).toContain("cliches");
    expect(calls).toBe(0);
    expect(verdict.research_trace).toEqual([]);
  });

  it("executes research tools and threads tool results back before verdict", async () => {
    const messagesSeen: unknown[] = [];
    let calls = 0;
    const client = {
      messages: {
        create: async (params: { messages: unknown }) => {
          calls += 1;
          messagesSeen.push(params.messages);
          if (calls === 1) {
            return {
              content: [
                toolUse("lookup_partner", { feature: "perps_trading" }, "toolu_lookup"),
              ] as never,
            };
          }
          return {
            content: [
              toolUse("audit_pass", {
                notes: "card fact confirmed",
                independent_classification: {
                  tempo: "commanding",
                  motifs: ["pressing", "punching"],
                  detected_drive: "spell-vision",
                  confidence: 0.84,
                  rationale: "dry decisive launch line",
                },
              }, "toolu_pass"),
            ] as never,
          };
        },
      },
    };
    const toolCalls: string[] = [];
    const toolExecutor = async (name: string, _input: Record<string, unknown>, id: string) => {
      toolCalls.push(name);
      return { tool_use_id: id, content: "provider: Hyperliquid" };
    };

    const verdict = await auditTextActive("Perps provider: Hyperliquid.", {
      card: CARD,
      voice: INFINEX_VOICE,
      deployed_facts_used: ["perps provider: Hyperliquid"],
      not_said: [],
      client,
      tool_executor: toolExecutor,
    });

    expect(verdict.passed).toBe(true);
    expect(toolCalls).toEqual(["lookup_partner"]);
    expect(verdict.research_trace.some((event) => event.type === "tool_call")).toBe(true);
    expect(verdict.research_trace.some((event) => event.type === "tool_result")).toBe(true);
    expect(JSON.stringify(messagesSeen[1])).toContain("tool_result");
  });

  it("surfaces card_missing_fact as an active-validator failure", async () => {
    const client = {
      messages: {
        create: async () => ({
          content: [
            toolUse("audit_fail", {
              feedback: "card_missing_fact: true but absent from card.deployed_facts",
              voice_issues: [
                {
                  line: "Perps provider: Hyperliquid.",
                  rule: "card_missing_fact",
                  fix: "Add the fact to the ReleaseCard or remove the claim.",
                },
              ],
              factual_issues: [],
              independent_classification: {
                tempo: "commanding",
                motifs: ["pressing", "punching"],
                detected_drive: "spell-vision",
                confidence: 0.83,
                rationale: "decisive product statement",
              },
            }),
          ] as never,
        }),
      },
    };

    const verdict = await auditTextActive("Perps provider: Hyperliquid.", {
      card: CARD,
      voice: INFINEX_VOICE,
      deployed_facts_used: ["perps provider: Hyperliquid"],
      not_said: [],
      client,
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.reason).toContain("card_missing_fact");
    expect(verdict.llm?.voice_issues[0]?.rule).toBe("card_missing_fact");
  });
});
