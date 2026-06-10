import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../card.js";
import type { Candidate } from "../generator.js";
import type { RetryOrchestrationResult } from "../orchestrator.js";
import { buildValidationReceipt, writeValidationReceipt } from "../receipts.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

const CARD: ReleaseCard = {
  id: "receipt-test",
  kind: "launch-tier",
  title: "Fact A Launch",
  ship_date: "2026-05-13",
  audience: ["x"],
  deployed_facts: ["Fact A is live"],
  headline: "Fact A",
  tier_reason: "test card",
};

const CANDIDATE: Candidate = {
  id: "candidate-1",
  text: "Fact A is live.",
  channel: "x",
  declared_beats: [{ tempo: "commanding" }],
  deployed_facts_used: ["Fact A is live"],
  not_said: [],
  source: "stub",
};

describe("validation receipts", () => {
  it("captures attempts, facts, beat declarations, and final picks", () => {
    const result: RetryOrchestrationResult = {
      picks: [{ channel: "x", candidate: CANDIDATE, validation: { passed: true, failures: [] } }],
      rejected: [],
      exhausted: false,
      attempts: [
        {
          attempt: 1,
          candidates: [CANDIDATE],
          feedback: "",
          result: {
            picks: [{ channel: "x", candidate: CANDIDATE, validation: { passed: true, failures: [] } }],
            rejected: [],
          },
        },
      ],
    };

    const receipt = buildValidationReceipt({
      card: CARD,
      voice: INFINEX_VOICE,
      beats: { beats: [{ tempo: "commanding" }] },
      channels: ["x"],
      result,
      generatedAt: "2026-05-13T00:00:00.000Z",
    });

    expect(receipt.schema_version).toBe(1);
    expect(receipt.card.id).toBe("receipt-test");
    expect(receipt.voice.name).toBe("infinex");
    expect(receipt.attempts[0]?.candidates[0]?.deployed_facts_used).toEqual(["Fact A is live"]);
    expect(receipt.final_picks).toEqual([{ channel: "x", candidate_id: "candidate-1" }]);
  });

  it("writes receipt JSON to disk", () => {
    const outDir = mkdtempSync(join(tmpdir(), "comms-receipt-"));
    const receipt = buildValidationReceipt({
      card: CARD,
      voice: INFINEX_VOICE,
      beats: { beats: [{ tempo: "commanding" }] },
      channels: ["x"],
      result: {
        picks: [{ channel: "x", candidate: CANDIDATE, validation: { passed: true, failures: [] } }],
        rejected: [],
      },
      generatedAt: "2026-05-13T00:00:00.000Z",
    });

    const path = writeValidationReceipt(receipt, outDir);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { card: { id: string } };
    expect(parsed.card.id).toBe("receipt-test");
  });
});
