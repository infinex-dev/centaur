import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../card.js";
import type { Candidate } from "../generator.js";
import { runVoiceEvalCase } from "../eval.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

const CARD: ReleaseCard = {
  id: "eval-test",
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
    declared_beats: [{ tempo: "commanding" }],
    deployed_facts_used: ["Fact A is live"],
    not_said: [],
    source: "stub",
    ...overrides,
  };
}

describe("voice eval harness", () => {
  it("runs generation through retry orchestration and returns receipt data", async () => {
    const result = await runVoiceEvalCase({
      name: "infinex-smoke",
      card: CARD,
      voice: INFINEX_VOICE,
      defaultBeats: () => [{ tempo: "commanding" }],
      channels: ["x"],
      generateAttempt: async () => [candidate({})],
    });

    expect(result.passed).toBe(true);
    expect(result.picks).toBe(1);
    expect(result.receipt.final_picks).toEqual([{ channel: "x", candidate_id: "candidate" }]);
  });

  it("summarizes validator failure counts across attempts", async () => {
    const result = await runVoiceEvalCase({
      name: "infinex-failing-smoke",
      card: CARD,
      voice: INFINEX_VOICE,
      defaultBeats: () => [{ tempo: "commanding" }],
      channels: ["x"],
      maxAttempts: 2,
      generateAttempt: async () => [
        candidate({
          text: "A game-changing launch.",
        }),
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.exhausted).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.failure_counts.cliches).toBe(2);
  });

  it("can persist the eval receipt when receiptDir is supplied", async () => {
    const receiptDir = mkdtempSync(join(tmpdir(), "comms-eval-"));
    const result = await runVoiceEvalCase({
      name: "infinex-receipt-smoke",
      card: CARD,
      voice: INFINEX_VOICE,
      defaultBeats: () => [{ tempo: "commanding" }],
      channels: ["x"],
      receiptDir,
      generateAttempt: async () => [candidate({})],
    });

    expect(result.receipt_path).toContain("eval-test-voice-receipt.json");
    const parsed = JSON.parse(readFileSync(result.receipt_path ?? "", "utf8")) as {
      final_picks: Array<{ candidate_id: string }>;
    };
    expect(parsed.final_picks[0]?.candidate_id).toBe("candidate");
  });
});
