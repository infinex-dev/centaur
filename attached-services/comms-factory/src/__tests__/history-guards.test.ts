import { describe, expect, it } from "vitest";
import type { Candidate } from "../generator.js";
import { runHistoryGuards, type ShippedCopyRecord } from "../history-guards.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "candidate",
    text: "Perps provider: Hyperliquid.",
    channel: "x",
    declared_beats: [{ tempo: "commanding" }],
    deployed_facts_used: ["perps provider: Hyperliquid"],
    not_said: [],
    source: "stub",
    ...overrides,
  };
}

function shipped(overrides: Partial<ShippedCopyRecord>): ShippedCopyRecord {
  return {
    id: "recent",
    channel: "x",
    text: "Spot markets are live.",
    primary_tempo: "commanding",
    ...overrides,
  };
}

describe("history guards", () => {
  it("fails repeated openers against recent same-channel copy", () => {
    const result = runHistoryGuards(candidate({ text: "Spot markets are live on Infinex." }), {
      channel: "x",
      voice: INFINEX_VOICE,
      recentCopy: [
        shipped({ id: "r1", text: "Spot markets are live with HYPE." }),
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.rule === "history:repeated-opener")).toBe(true);
    expect(result.failures[0]?.compared_against).toContain("r1");
  });

  it("enforces phrase budgets more tightly for X", () => {
    const result = runHistoryGuards(candidate({ text: "Perps are now live." }), {
      channel: "x",
      recentCopy: [
        shipped({ id: "r1", text: "Spot is now live." }),
        shipped({ id: "r2", text: "Prediction markets now live." }),
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.rule === "history:phrase-budget")).toBe(true);
  });

  it("blocks three identical primary tempi in a row on X", () => {
    const result = runHistoryGuards(candidate({ declared_beats: [{ tempo: "commanding" }] }), {
      channel: "x",
      recentCopy: [
        shipped({ id: "r1", primary_tempo: "commanding" }),
        shipped({ id: "r2", primary_tempo: "commanding" }),
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.rule === "history:tempo-cadence")).toBe(true);
  });

  it("allows clean candidates with unrelated history", () => {
    const result = runHistoryGuards(candidate({ text: "Hyperliquid perps, inside Infinex." }), {
      channel: "x",
      recentCopy: [
        shipped({ id: "r1", text: "Prediction markets settle in one account.", primary_tempo: "practical" }),
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.compared_against).toEqual(["r1"]);
  });
});
