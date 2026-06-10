import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../card.js";
import type { Candidate } from "../generator.js";
import { orchestrateActiveWithRetries, orchestrateLLM, orchestrateWithRetries } from "../orchestrator.js";
import type { LLMVoiceAuditOptions } from "../validator-llm.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

const CARD: ReleaseCard = {
  id: "retry-test",
  kind: "launch-tier",
  title: "Fact A Launch",
  ship_date: "2026-05-13",
  audience: ["x"],
  deployed_facts: ["Fact A is live"],
  headline: "Fact A",
  tier_reason: "test card",
};

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    id: "candidate",
    text: "Fact A is live.",
    channel: "x",
    declared_beats: [],
    deployed_facts_used: ["Fact A is live"],
    not_said: [],
    source: "stub",
    ...overrides,
  };
}

describe("orchestrateWithRetries", () => {
  it("feeds validation feedback into the next generation attempt", async () => {
    const feedbackSeen: Array<string | undefined> = [];
    const result = await orchestrateWithRetries(
      CARD,
      ["x"],
      async ({ feedback }) => {
        feedbackSeen.push(feedback);
        if (feedbackSeen.length === 1) {
          return [candidate({ id: "bad", text: "A game-changing launch." })];
        }
        return [candidate({ id: "good" })];
      },
    );

    expect(result.exhausted).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(result.picks[0]?.candidate.id).toBe("good");
    expect(feedbackSeen[0]).toBeUndefined();
    expect(feedbackSeen[1]).toContain("cliches");
  });

  it("stops after maxAttempts when no candidate passes", async () => {
    let calls = 0;
    const result = await orchestrateWithRetries(
      CARD,
      ["x"],
      async () => {
        calls += 1;
        return [candidate({ id: `bad-${calls}`, text: "A game-changing launch." })];
      },
      { maxAttempts: 2 },
    );

    expect(calls).toBe(2);
    expect(result.exhausted).toBe(true);
    expect(result.picks).toEqual([]);
    expect(result.attempts).toHaveLength(2);
  });
});

describe("orchestrateLLM (hybrid: regex pre-filter + LLM judge)", () => {
  function makeStubClient(passResponses = true): NonNullable<LLMVoiceAuditOptions["client"]> {
    return {
      messages: {
        create: async () =>
          ({
            content: [
              {
                type: "tool_use",
                id: "toolu_orch",
                name: passResponses ? "audit_pass" : "audit_fail",
                input: passResponses
                  ? {
                      notes: "fits",
                      independent_classification: {
                        tempo: "commanding",
                        motifs: ["pressing", "punching"],
                        detected_drive: "spell-vision",
                        confidence: 0.85,
                        rationale: "decisive landing",
                      },
                    }
                  : {
                      feedback: "drift",
                      independent_classification: {
                        tempo: "unknown",
                        motifs: ["pressing"],
                        detected_drive: "passion",
                        confidence: 0.7,
                        rationale: "Passion-pulled",
                      },
                    },
              } as never,
            ],
          }),
      },
    } as unknown as NonNullable<LLMVoiceAuditOptions["client"]>;
  }

  it("picks a candidate that survives regex AND the LLM judge", async () => {
    const result = await orchestrateLLM(
      CARD,
      [candidate({ id: "clean", text: "Fact A is live." })],
      ["x"],
      { voice: INFINEX_VOICE, llm_opts: { client: makeStubClient(true) } },
    );
    expect(result.picks).toHaveLength(1);
    expect(result.picks[0]?.candidate.id).toBe("clean");
    expect(result.picks[0]?.verdict.passed).toBe(true);
  });

  it("rejects a candidate that fails regex without making an LLM call", async () => {
    let llmCalls = 0;
    const client = {
      messages: {
        create: async () => {
          llmCalls += 1;
          return { content: [] };
        },
      },
    } as unknown as NonNullable<LLMVoiceAuditOptions["client"]>;
    const result = await orchestrateLLM(
      CARD,
      [candidate({ id: "slop", text: "Game-changing, next-gen, seamless experience." })],
      ["x"],
      { voice: INFINEX_VOICE, llm_opts: { client } },
    );
    expect(result.picks).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(llmCalls).toBe(0);
  });
});

describe("orchestrateActiveWithRetries", () => {
  function makeActiveClient(): NonNullable<LLMVoiceAuditOptions["client"]> {
    return {
      messages: {
        create: async () =>
          ({
            content: [
              {
                type: "tool_use",
                id: "toolu_active",
                name: "audit_pass",
                input: {
                  notes: "fits",
                  independent_classification: {
                    tempo: "commanding",
                    motifs: ["pressing", "punching"],
                    detected_drive: "spell-vision",
                    confidence: 0.86,
                    rationale: "decisive product line",
                  },
                },
              } as never,
            ],
          }),
      },
    } as unknown as NonNullable<LLMVoiceAuditOptions["client"]>;
  }

  it("feeds active-validator and history-guard failures into retry feedback", async () => {
    const feedbackSeen: Array<string | undefined> = [];
    const result = await orchestrateActiveWithRetries(
      CARD,
      ["x"],
      async ({ feedback }) => {
        feedbackSeen.push(feedback);
        if (feedbackSeen.length === 1) {
          return [candidate({ id: "repeated", text: "Fact A is live." })];
        }
        return [candidate({ id: "fresh", text: "For web, Fact A is live." })];
      },
      {
        voice: INFINEX_VOICE,
        active_opts: { client: makeActiveClient() },
        recentCopyByChannel: {
          x: [
            { id: "prior-1", channel: "x", text: "Fact A is live.", primary_tempo: "practical" },
          ],
        },
        maxAttempts: 2,
      },
    );

    expect(result.exhausted).toBe(false);
    expect(result.picks[0]?.candidate.id).toBe("fresh");
    expect(feedbackSeen[1]).toContain("history:repeated-opener");
  });
});
