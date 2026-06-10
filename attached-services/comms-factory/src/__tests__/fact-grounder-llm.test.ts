/**
 * Tests for the fact-grounder layer (Phase 1).
 *
 * All tests use mocked clients and a fixture platform directory —
 * no live API calls, no live platform repo required.
 *
 * PLATFORM_ROOT is set to a fixture path via env-override so platform-code
 * source tests work in CI without the full monorepo checked out.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { VerifiedFact } from "../fact-grounder-llm.js";

// --- Types & direct imports (no client calls for unit tests) ------

import {
  buildGrounderSystemPrompt,
  checkEntityPresence,
  buildFactContext,
  buildDeployedFacts,
  compactJsonForModel,
  groundFacts,
} from "../fact-grounder-llm.js";
import {
  lookupFeature,
  searchFeatures,
  _resetRegistryCache,
} from "../fact-grounder/sources/partner-registry.js";
import {
  grepPlatform,
  readPlatformFile,
} from "../fact-grounder/sources/platform-code.js";
import { fetchInfinexPage } from "../fact-grounder/sources/infinex-pages.js";
import { fetchPublicPage } from "../fact-grounder/sources/public-page.js";
import { buildResearchTools } from "../research-tools.js";

// ─── Fixture setup ────────────────────────────────────────────────────────────

let fixturePlatformDir: string;
const origPlatformRoot = process.env.PLATFORM_ROOT;

function makeFixtureFact(overrides: Partial<VerifiedFact> = {}): VerifiedFact {
  return {
    category: "partner",
    claim: "perps venue provider",
    value: "Hyperliquid",
    source: "partner-registry",
    source_ref: "apps/perps-app/src/app/api/og/lib/hyperliquid.ts",
    confidence: 0.95,
    verified_at: "2026-05-15",
    ...overrides,
  };
}

beforeAll(() => {
  // Create a temporary platform fixture directory that grepPlatform can scan
  fixturePlatformDir = mkdtempSync(resolve(tmpdir(), "comms-factory-fixture-"));
  process.env.PLATFORM_ROOT = fixturePlatformDir;

  // Write a couple of fixture files
  const appDir = resolve(fixturePlatformDir, "apps/perps-app/src/app");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(
    resolve(appDir, "page.tsx"),
    'const maxLeverage = marketData?.maxLeverage ?? 50;\nconsole.log("perps page");\n',
    "utf8",
  );

  const libDir = resolve(fixturePlatformDir, "apps/perps-app/src/lib");
  mkdirSync(libDir, { recursive: true });
  writeFileSync(
    resolve(libDir, "hyperliquid.ts"),
    'export const HYPERLIQUID_API = "https://api.hyperliquid.xyz";\n',
    "utf8",
  );
});

afterAll(() => {
  // Restore env
  if (origPlatformRoot !== undefined) {
    process.env.PLATFORM_ROOT = origPlatformRoot;
  } else {
    delete process.env.PLATFORM_ROOT;
  }
  _resetRegistryCache();
});

// ─── Partner registry ─────────────────────────────────────────────────────────

describe("partner-registry", () => {
  it("lookupFeature returns a registry entry for known features", () => {
    const entry = lookupFeature("perps_trading");
    expect(entry).not.toBeNull();
    expect(entry?.provider).toBe("Hyperliquid");
    expect(entry?.evidence.source_ref).toBeTruthy();
  });

  it("lookupFeature returns null for unknown features", () => {
    expect(lookupFeature("not_a_feature_xyz")).toBeNull();
  });

  it("searchFeatures finds entries by partial name", () => {
    const results = searchFeatures("prediction");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e) => e.provider === "Polymarket")).toBe(true);
  });
});

// ─── Platform code (uses fixture directory) ───────────────────────────────────

describe("platform-code", () => {
  it("grepPlatform finds a constant in a fixture file", async () => {
    const matches = await grepPlatform("maxLeverage");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.preview.includes("50"))).toBe(true);
    expect(matches[0]?.file).toContain("page.tsx");
  });

  it("grepPlatform returns empty array when no matches found", async () => {
    const matches = await grepPlatform("ZZZNOMATCH_IMPOSSIBLE_STRING_xyz");
    expect(matches).toEqual([]);
  });

  it("grepPlatform can narrow to a sub-path", async () => {
    const matches = await grepPlatform("HYPERLIQUID_API", { path: "apps/perps-app/src/lib" });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.file).toContain("hyperliquid.ts");
  });

  it("readPlatformFile reads a file by relative path", async () => {
    const content = await readPlatformFile("apps/perps-app/src/app/page.tsx");
    expect(content).toContain("maxLeverage");
    expect(content).toContain("50");
  });

  it("readPlatformFile respects line range", async () => {
    const content = await readPlatformFile("apps/perps-app/src/app/page.tsx", {
      startLine: 1,
      endLine: 1,
    });
    expect(content).toContain("maxLeverage");
    expect(content).not.toContain("console.log");
  });

  it("readPlatformFile throws for non-existent file", async () => {
    await expect(readPlatformFile("does/not/exist.ts")).rejects.toThrow();
  });

  it("rejects grep paths that escape PLATFORM_ROOT", async () => {
    await expect(grepPlatform("anything", { path: "../" })).rejects.toThrow(/escapes PLATFORM_ROOT/);
  });

  it("rejects read paths that escape PLATFORM_ROOT", async () => {
    writeFileSync(resolve(fixturePlatformDir, "..", "outside-platform-file.ts"), "secret", "utf8");
    await expect(readPlatformFile("../outside-platform-file.ts")).rejects.toThrow(/escapes PLATFORM_ROOT/);
  });
});

describe("infinex page fetcher", () => {
  it("rejects absolute URLs outside infinex.xyz before fetching", async () => {
    await expect(fetchInfinexPage("https://example.com/")).rejects.toThrow(/only supports/);
  });

  it("rejects non-https infinex URLs before fetching", async () => {
    await expect(fetchInfinexPage("http://infinex.xyz/")).rejects.toThrow(/only supports/);
    await expect(fetchInfinexPage("ftp://evil.example/file")).rejects.toThrow(/only supports/);
  });
});

describe("public page fetcher", () => {
  it("rejects non-https URLs before fetching", async () => {
    await expect(fetchPublicPage("http://apidocs.bridge.xyz/")).rejects.toThrow(/https/);
  });

  it("rejects local/private hosts before fetching", async () => {
    await expect(fetchPublicPage("https://localhost/docs")).rejects.toThrow(/local\/private/);
    await expect(fetchPublicPage("https://127.0.0.1/docs")).rejects.toThrow(/local\/private/);
  });
});

describe("grounder prompt", () => {
  it("requires provider mechanics discovery for bridge/onramp flows", () => {
    const prompt = buildGrounderSystemPrompt({ surface: "test" });
    expect(prompt).toContain("minimum product/protocol mechanics");
    expect(prompt).toContain("fetch_public_page");
    expect(prompt).toContain("Fiat deposit / onramp / offramp / stablecoin orchestration rule");
    expect(prompt).toContain("Bridge virtual accounts convert incoming fiat into crypto");
    expect(prompt).toContain("Weak facts: 'Bridge is a stablecoin infrastructure company' by itself");
  });

  it("exposes fetch_public_page as a research tool", () => {
    const toolNames = buildResearchTools().map((tool) => (tool as { name?: string }).name);
    expect(toolNames).toContain("fetch_public_page");
  });

  it("scopes to a default-branch ref without mislabeling it a feature branch, and mandates the sweep", () => {
    const prompt = buildGrounderSystemPrompt({ ref: "main" });
    expect(prompt).toContain("scoped to git ref `main`");
    // old wording asserted the ref was always a feature branch superset of main
    expect(prompt).not.toContain("the launch's feature branch, a SUPERSET of main.");
    // the salient-attribute sweep is now unconditional, not gated on a feature branch
    expect(prompt).toContain("This sweep is NOT optional");
  });

  it("still scopes to a feature-branch ref when one is provided", () => {
    const prompt = buildGrounderSystemPrompt({ ref: "origin/launch-x" });
    expect(prompt).toContain("scoped to git ref `origin/launch-x`");
  });
});

// ─── Entity-presence post-check ──────────────────────────────────────────────

describe("checkEntityPresence", () => {
  it("passes when all partner facts appear in the text", () => {
    const facts: VerifiedFact[] = [
      makeFixtureFact({ category: "partner", value: "Hyperliquid" }),
    ];
    const { missing, contradicted } = checkEntityPresence(
      "Perps are live in Infinex. Powered by Hyperliquid.",
      facts,
    );
    expect(missing).toHaveLength(0);
    expect(contradicted).toHaveLength(0);
  });

  it("flags missing partner when replacement omits it", () => {
    const facts: VerifiedFact[] = [
      makeFixtureFact({ category: "partner", value: "Polymarket" }),
    ];
    const { missing } = checkEntityPresence(
      "Prediction markets are live in Infinex.",
      facts,
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]?.value).toBe("Polymarket");
  });

  it("passes when missing fact is in intentionallyOmitted list", () => {
    const facts: VerifiedFact[] = [
      makeFixtureFact({ category: "partner", value: "Polymarket", claim: "prediction markets provider" }),
    ];
    const { missing } = checkEntityPresence(
      "Prediction markets are live.",
      facts,
      ["prediction markets provider"],
    );
    expect(missing).toHaveLength(0);
  });

  it("passes for number facts that appear in the text", () => {
    const facts: VerifiedFact[] = [
      makeFixtureFact({ category: "number", claim: "max leverage", value: "50" }),
    ];
    const { missing } = checkEntityPresence("Up to 50x leverage, same account.", facts);
    expect(missing).toHaveLength(0);
  });

  it("flags missing number when omitted", () => {
    const facts: VerifiedFact[] = [
      makeFixtureFact({ category: "number", claim: "max leverage", value: "50" }),
    ];
    const { missing } = checkEntityPresence("Leverage trading is live.", facts);
    expect(missing).toHaveLength(1);
  });

  it("handles multiple facts mixed", () => {
    const facts: VerifiedFact[] = [
      makeFixtureFact({ category: "partner", value: "Hyperliquid" }),
      makeFixtureFact({ category: "number", claim: "max leverage", value: "50" }),
    ];
    const { missing } = checkEntityPresence(
      "Perps in Infinex, powered by Hyperliquid. Up to 50x.",
      facts,
    );
    expect(missing).toHaveLength(0);
  });
});

// ─── buildFactContext / buildDeployedFacts ────────────────────────────────────

describe("buildFactContext", () => {
  it("returns empty string for empty facts", () => {
    expect(buildFactContext([])).toBe("");
  });

  it("formats facts as a readable constraint block", () => {
    const facts: VerifiedFact[] = [makeFixtureFact()];
    const ctx = buildFactContext(facts);
    expect(ctx).toContain("Immutable facts");
    expect(ctx).toContain("Hyperliquid");
    expect(ctx).toContain("perps venue provider");
  });
});

describe("buildDeployedFacts", () => {
  it("formats facts as claim: value strings", () => {
    const facts: VerifiedFact[] = [makeFixtureFact()];
    const deployed = buildDeployedFacts(facts);
    expect(deployed).toHaveLength(1);
    expect(deployed[0]).toBe("perps venue provider: Hyperliquid");
  });
});

// ─── compactJsonForModel — Hyperliquid spotMetaAndAssetCtxs join ──────────────

describe("compactJsonForModel — Hyperliquid spotMetaAndAssetCtxs", () => {
  // Regression for the bug that produced "WOW/USDC: $98M" instead of "HYPE/USDC: $98M".
  //
  // spotMetaAndAssetCtxs returns [meta, ctxs] where meta.universe.length !== ctxs.length —
  // ctxs has extra entries (HIP-3 markets, etc) and IS NOT positionally aligned with universe.
  // The compactor must join by ctxs[].coin → universe[].name, never by array position.
  it("joins universe[].name to ctxs[].coin (not positionally) even when arrays are misaligned", () => {
    const fixture = [
      {
        universe: [
          // Canonical PURR/USDC — pair.name is "PURR/USDC", not "@N"
          { name: "PURR/USDC", tokens: [1, 0], index: 0, isCanonical: true },
          // Non-canonical HYPE/USDC — pair.name is "@107", base token idx 150
          { name: "@107", tokens: [150, 0], index: 107, isCanonical: false },
          // Long-tail WOW/USDC at index 109 — base token idx 98, $0 volume
          { name: "@109", tokens: [98, 0], index: 109, isCanonical: false },
        ],
        tokens: [
          { name: "USDC", index: 0 },
          { name: "PURR", index: 1 },
          { name: "WOW", index: 98 },
          { name: "HYPE", index: 150, fullName: "Hyperliquid" },
        ],
      },
      // ctxs deliberately misaligned: PURR is positionally correct, but @107 and @109
      // are NOT at positions 1 and 2 — they're interleaved with extras like @71.
      // Positional zip would assign HYPE's volume to WOW (the original bug).
      [
        { coin: "PURR/USDC", dayNtlVlm: "2320000" },
        { coin: "@71", dayNtlVlm: "0" }, // extra entry not in universe
        { coin: "@107", dayNtlVlm: "98600000" }, // HYPE/USDC
        { coin: "@109", dayNtlVlm: "0" }, // WOW/USDC
      ],
    ];

    const out = compactJsonForModel(fixture);

    // The top market by volume must be HYPE/USDC (correctly joined), not WOW/USDC (the bug).
    const lines = out.split("\n");
    const topMarketLine = lines.find((l) => l.includes("$98.60M") || l.includes("$98M"));
    expect(topMarketLine).toBeDefined();
    expect(topMarketLine).toContain("HYPE/USDC");
    expect(topMarketLine).not.toContain("WOW");

    // WOW has $0 volume → must be filtered out (below the $100K threshold).
    expect(out).not.toMatch(/WOW\/USDC.*\$/);
  });

  it("handles canonical pair.name (e.g. PURR/USDC) correctly", () => {
    const fixture = [
      {
        universe: [{ name: "PURR/USDC", tokens: [1, 0], index: 0, isCanonical: true }],
        tokens: [
          { name: "USDC", index: 0 },
          { name: "PURR", index: 1 },
        ],
      },
      [{ coin: "PURR/USDC", dayNtlVlm: "2320000" }],
    ];
    const out = compactJsonForModel(fixture);
    expect(out).toContain("PURR/USDC: 24h vol $2.32M");
  });

  it("filters out non-USDC quote pairs", () => {
    const fixture = [
      {
        universe: [
          { name: "@232", tokens: [150, 360], index: 232, isCanonical: false }, // HYPE/USDH
          { name: "@107", tokens: [150, 0], index: 107, isCanonical: false }, // HYPE/USDC
        ],
        tokens: [
          { name: "USDC", index: 0 },
          { name: "HYPE", index: 150 },
          { name: "USDH", index: 360 },
        ],
      },
      [
        { coin: "@232", dayNtlVlm: "1660000" },
        { coin: "@107", dayNtlVlm: "98600000" },
      ],
    ];
    const out = compactJsonForModel(fixture);
    // USDH quote pair is skipped; USDC quote pair survives.
    expect(out).toContain("HYPE/USDC: 24h vol $98.60M");
    expect(out).not.toContain("$1.66M");
  });
});

// ─── groundFacts orchestrator (mocked client) ─────────────────────────────────

describe("groundFacts", () => {
  type ContentBlock = {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  type Turn = ContentBlock[];

  function makeGrounderClient(turns: Turn[]) {
    let idx = 0;
    return {
      messages: {
        create: async () => {
          const content = turns[idx] ?? turns[turns.length - 1] ?? [];
          idx += 1;
          return { content: content as never };
        },
      },
    };
  }

  function toolUse(name: string, input: Record<string, unknown>, id?: string): ContentBlock {
    return {
      type: "tool_use",
      id: id ?? `toolu_${name}`,
      name,
      input,
    };
  }

  it("records facts and terminates on done_grounding", async () => {
    const client = makeGrounderClient([
      // Turn 1: record a fact + call done_grounding
      [
        toolUse("record_fact", {
          category: "partner",
          claim: "perps provider",
          value: "Hyperliquid",
          source: "partner-registry",
          source_ref: "config/partner-registry.json",
          confidence: 0.95,
        }),
        toolUse("done_grounding", { summary: "one partner found" }),
      ],
    ]);

    const result = await groundFacts("Perps powered by Hyperliquid.", {
      client: client as never,
      max_turns: 3,
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]?.value).toBe("Hyperliquid");
    expect(result.facts[0]?.category).toBe("partner");
    expect(result.ground_turns).toBe(1);
    expect(result.truncated).toBeUndefined();
  });

  it("executes research tools in parallel and threads results back before verdict", async () => {
    const callLog: string[] = [];

    // Turn 1: research calls (lookup + grep)
    // Turn 2: record + done
    const turns: Turn[] = [
      [
        toolUse("lookup_partner", { feature: "perps_trading" }, "toolu_1"),
        toolUse("grep_platform_code", { pattern: "maxLeverage" }, "toolu_2"),
      ],
      [
        toolUse("record_fact", {
          category: "partner",
          claim: "perps provider",
          value: "Hyperliquid",
          source: "partner-registry",
          source_ref: "config/partner-registry.json",
          confidence: 0.95,
        }, "toolu_3"),
        toolUse("record_fact", {
          category: "number",
          claim: "max leverage",
          value: "50",
          source: "platform-code",
          source_ref: "apps/perps-app/src/app/page.tsx:1",
          confidence: 0.9,
        }, "toolu_4"),
        toolUse("done_grounding", { summary: "grounded" }, "toolu_5"),
      ],
    ];

    let createCalls = 0;
    let lastMessages: unknown = null;
    const client = {
      messages: {
        create: async (params: { messages: unknown }) => {
          createCalls += 1;
          lastMessages = params.messages;
          const content = turns[createCalls - 1] ?? [];
          return { content: content as never };
        },
      },
    };

    const result = await groundFacts("Perps in Infinex, up to 40x leverage.", {
      client: client as never,
      max_turns: 6,
    });

    // Two facts recorded
    expect(result.facts).toHaveLength(2);
    expect(result.ground_turns).toBe(2);

    // Second API call should have tool_result messages for both research tools
    const msgs = lastMessages as Array<{ role: string; content: unknown[] }>;
    const userTurns = msgs.filter((m) => m.role === "user");
    const lastUserTurn = userTurns[userTurns.length - 1];
    const toolResults = Array.isArray(lastUserTurn?.content)
      ? lastUserTurn.content.filter((b: unknown) => (b as { type: string }).type === "tool_result")
      : [];
    expect(toolResults.length).toBeGreaterThanOrEqual(2);
  });

  it("uses injected research executor and carries tool evidence into receipts", async () => {
    const turns: Turn[] = [
      [toolUse("grep_platform_code", { pattern: "maxLeverage" }, "toolu_cap")],
      [
        toolUse("record_fact", {
          category: "number",
          claim: "max leverage",
          value: "50",
          source: "platform-code",
          source_ref: "ev_repo_1",
          confidence: 0.9,
        }, "toolu_fact"),
        toolUse("done_grounding", { summary: "grounded" }, "toolu_done"),
      ],
    ];
    let createCalls = 0;
    const client = {
      messages: {
        create: async () => {
          createCalls += 1;
          return { content: (turns[createCalls - 1] ?? []) as never };
        },
      },
    };
    const calls: string[] = [];
    const toolExecutor = async (name: string, _input: Record<string, unknown>, id: string) => {
      calls.push(name);
      return {
        tool_use_id: id,
        content: "src/file.ts:1: maxLeverage = 50\n\nEvidence IDs: ev_repo_1",
        tool: "repo.search",
        evidence: [{ id: "ev_repo_1", source: "repo.search", source_ref: "src/file.ts:1" }],
      };
    };

    const result = await groundFacts("Perps up to 50x.", {
      client: client as never,
      tool_executor: toolExecutor,
      max_turns: 3,
    });

    expect(calls).toEqual(["grep_platform_code"]);
    expect(result.evidence?.map((item) => item.id)).toEqual(["ev_repo_1"]);
    expect(result.facts[0]?.evidence_ids).toEqual(["ev_repo_1"]);
    expect(result.fact_receipts).toEqual([{ claim: "max leverage", value: "50", evidence_ids: ["ev_repo_1"] }]);
  });

  it("does not over-attribute multiple tool evidence items to unrelated facts", async () => {
    const turns: Turn[] = [
      [
        toolUse("grep_platform_code", { pattern: "Fact A" }, "toolu_a"),
        toolUse("grep_platform_code", { pattern: "Fact B" }, "toolu_b"),
      ],
      [
        toolUse("record_fact", {
          category: "capability",
          claim: "Fact A",
          value: "live",
          source: "platform-code",
          source_ref: "ev_a",
        }, "toolu_fact_a"),
        toolUse("record_fact", {
          category: "capability",
          claim: "Fact B",
          value: "ready",
          source: "platform-code",
          source_ref: "src/b.ts:2",
        }, "toolu_fact_b"),
        toolUse("record_fact", {
          category: "capability",
          claim: "Fact C",
          value: "unknown-source",
          source: "platform-code",
          source_ref: "src/c.ts:3",
        }, "toolu_fact_c"),
        toolUse("done_grounding", { summary: "grounded" }, "toolu_done"),
      ],
    ];
    let createCalls = 0;
    const client = {
      messages: {
        create: async () => {
          createCalls += 1;
          return { content: (turns[createCalls - 1] ?? []) as never };
        },
      },
    };
    const toolExecutor = async (name: string, _input: Record<string, unknown>, id: string) => ({
      tool_use_id: id,
      content: name,
      evidence: id === "toolu_a"
        ? [{ id: "ev_a", source: "repo.search", source_ref: "src/a.ts:1" }]
        : [{ id: "ev_b", source: "repo.search", source_ref: "src/b.ts:2" }],
    });

    const result = await groundFacts("Fact A and Fact B.", {
      client: client as never,
      tool_executor: toolExecutor,
      max_turns: 3,
    });

    expect(result.facts.find((fact) => fact.claim === "Fact A")?.evidence_ids).toEqual(["ev_a"]);
    expect(result.facts.find((fact) => fact.claim === "Fact B")?.evidence_ids).toEqual(["ev_b"]);
    expect(result.facts.find((fact) => fact.claim === "Fact C")?.evidence_ids).toBeUndefined();
  });

  it("filters explicit evidence_ids that do not match the fact source_ref", async () => {
    const turns: Turn[] = [
      [toolUse("grep_platform_code", { pattern: "Fact A" }, "toolu_a")],
      [
        toolUse("record_fact", {
          category: "capability",
          claim: "Fact B",
          value: "ready",
          source: "platform-code",
          source_ref: "src/b.ts:2",
          evidence_ids: ["ev_a"],
        }, "toolu_fact_b"),
        toolUse("done_grounding", { summary: "grounded" }, "toolu_done"),
      ],
    ];
    let createCalls = 0;
    const client = {
      messages: {
        create: async () => {
          createCalls += 1;
          return { content: (turns[createCalls - 1] ?? []) as never };
        },
      },
    };
    const result = await groundFacts("Fact B.", {
      client: client as never,
      tool_executor: async (_name, _input, id) => ({
        tool_use_id: id,
        content: "src/a.ts:1: Fact A",
        evidence: [{ id: "ev_a", source: "repo.search", source_ref: "src/a.ts:1" }],
      }),
      max_turns: 3,
    });

    expect(result.facts[0]?.evidence_ids).toBeUndefined();
    expect(result.fact_receipts).toBeUndefined();
  });

  it("does not attach a singleton evidence item when source_ref does not match", async () => {
    const turns: Turn[] = [
      [toolUse("grep_platform_code", { pattern: "Fact A" }, "toolu_a")],
      [
        toolUse("record_fact", {
          category: "capability",
          claim: "Fact B",
          value: "ready",
          source: "platform-code",
          source_ref: "src/b.ts:2",
        }, "toolu_fact_b"),
        toolUse("done_grounding", { summary: "grounded" }, "toolu_done"),
      ],
    ];
    let createCalls = 0;
    const client = {
      messages: {
        create: async () => {
          createCalls += 1;
          return { content: (turns[createCalls - 1] ?? []) as never };
        },
      },
    };
    const result = await groundFacts("Fact B.", {
      client: client as never,
      tool_executor: async (_name, _input, id) => ({
        tool_use_id: id,
        content: "src/a.ts:1: Fact A",
        evidence: [{ id: "ev_a", source: "repo.search", source_ref: "src/a.ts:1" }],
      }),
      max_turns: 3,
    });

    expect(result.facts[0]?.evidence_ids).toBeUndefined();
    expect(result.fact_receipts).toBeUndefined();
  });

  it("marks unverifiable claims", async () => {
    const client = makeGrounderClient([
      [
        toolUse("mark_unverifiable", {
          claim: "market count",
          reason: "no platform constant found, web search inconclusive",
        }),
        toolUse("done_grounding", { summary: "one claim unverifiable" }),
      ],
    ]);

    const result = await groundFacts("Over 1000 markets.", {
      client: client as never,
      max_turns: 3,
    });

    expect(result.facts).toHaveLength(0);
    expect(result.unverifiable).toHaveLength(1);
    expect(result.unverifiable[0]?.claim).toBe("market count");
  });

  it("truncates when max_turns reached without done_grounding", async () => {
    // Always returns a research call, never done_grounding
    const client = makeGrounderClient([
      [toolUse("lookup_partner", { feature: "perps_trading" }, "toolu_x")],
      [toolUse("lookup_partner", { feature: "perps_trading" }, "toolu_y")],
    ]);

    const result = await groundFacts("Perps.", {
      client: client as never,
      max_turns: 2,
    });

    expect(result.truncated).toBe(true);
    expect(result.ground_turns).toBe(2);
  });

  it("hard-rejects private/metadata fetch_json_api hosts before fetching (SSRF guard)", async () => {
    let lastMessages: unknown = null;
    let createCalls = 0;
    const turns: Turn[] = [
      [toolUse("fetch_json_api", { url: "https://169.254.169.254/latest/meta-data" }, "toolu_api")],
      [
        toolUse("mark_unverifiable", {
          claim: "metadata endpoint",
          reason: "fetch_json_api rejected host",
        }, "toolu_unverifiable"),
        toolUse("done_grounding", { summary: "blocked" }, "toolu_done"),
      ],
    ];
    const client = {
      messages: {
        create: async (params: { messages: unknown }) => {
          createCalls += 1;
          lastMessages = params.messages;
          return { content: (turns[createCalls - 1] ?? []) as never };
        },
      },
    };

    const result = await groundFacts("Check metadata.", {
      client: client as never,
      max_turns: 2,
    });

    const msgs = lastMessages as Array<{ role: string; content: unknown[] }>;
    const userTurns = msgs.filter((m) => m.role === "user");
    const lastUserTurn = userTurns[userTurns.length - 1];
    const toolResults = Array.isArray(lastUserTurn?.content)
      ? lastUserTurn.content.filter((b: unknown) => (b as { type: string }).type === "tool_result")
      : [];
    expect(JSON.stringify(toolResults)).toContain("private/internal address");
    expect(result.unverifiable).toHaveLength(1);
    // SSRF host is hard-blocked, NOT queued for operator approval
    expect(result.approval_requests).toHaveLength(0);
  });

  it("queues an unknown public host for operator approval instead of calling it", async () => {
    let createCalls = 0;
    const turns: Turn[] = [
      [toolUse("fetch_json_api", { url: "https://api.some-new-partner.com/categories", reason: "list categories" }, "toolu_api")],
      [
        toolUse("mark_unverifiable", { claim: "categories", reason: "awaiting API approval" }, "toolu_unverifiable"),
        toolUse("done_grounding", { summary: "queued" }, "toolu_done"),
      ],
    ];
    const client = {
      messages: {
        create: async () => {
          createCalls += 1;
          return { content: (turns[createCalls - 1] ?? []) as never };
        },
      },
    };

    const result = await groundFacts("New partner launch.", { client: client as never, max_turns: 2 });

    // Not auto-called (host not in our code, not approved) → surfaced for approval
    expect(result.approval_requests).toHaveLength(1);
    expect(result.approval_requests[0]!.host).toBe("api.some-new-partner.com");
    expect(result.approval_requests[0]!.reason).toBe("list categories");
  });

  it("auto-allows an operator-approved host (passed via approvedHosts)", async () => {
    let createCalls = 0;
    const turns: Turn[] = [
      [toolUse("done_grounding", { summary: "done" }, "toolu_done")],
    ];
    const client = {
      messages: { create: async () => { createCalls += 1; return { content: (turns[createCalls - 1] ?? []) as never }; } },
    };
    const result = await groundFacts("x", { client: client as never, max_turns: 2, approvedHosts: ["api.some-new-partner.com"] });
    expect(result.approval_requests).toHaveLength(0);
  });

  it("merges operator_facts into result without overwriting them", async () => {
    const operatorFact = makeFixtureFact({
      source: "operator-input",
      claim: "chain count",
      value: "20",
      category: "number",
    });

    const client = makeGrounderClient([
      [toolUse("done_grounding", { summary: "nothing else to ground" })],
    ]);

    const result = await groundFacts("Supports 20+ chains.", {
      client: client as never,
      operator_facts: [operatorFact],
      max_turns: 3,
    });

    expect(result.facts.some((f) => f.value === "20")).toBe(true);
  });
});

// ─── Integration: copy-rewrite-llm uses groundFacts ──────────────────────────

describe("rewriteCopyLoop integration (fact-grounding)", () => {
  it("groundFacts is called before extractIntent when enable_grounding is true", async () => {
    // Import lazily to avoid circular issues at module-load time
    const { rewriteCopyLoop } = await import("../copy-rewrite-llm.js");

    const callOrder: string[] = [];
    let groundCalledWithText = "";

    // Grounder client: records partner, done
    const grounderClient = {
      messages: {
        create: async () => {
          callOrder.push("grounder");
          groundCalledWithText = "captured";
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_g",
                name: "record_fact",
                input: {
                  category: "partner",
                  claim: "perps provider",
                  value: "Hyperliquid",
                  source: "partner-registry",
                  source_ref: "config/partner-registry.json",
                  confidence: 0.95,
                },
              },
              {
                type: "tool_use",
                id: "toolu_done",
                name: "done_grounding",
                input: { summary: "found" },
              },
            ] as never,
          };
        },
      },
    };

    // Intent extractor client
    const intentClient = {
      messages: {
        create: async () => {
          callOrder.push("extractor");
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_i",
                name: "emit_intent",
                input: {
                  intent: "Tell visitor about perps.",
                  constraints: ["hero"],
                  available_facts: [],
                },
              },
            ] as never,
          };
        },
      },
    };

    // Generator client
    const generatorClient = {
      messages: {
        create: async (params: { messages: unknown }) => {
          callOrder.push("generator");
          // Assert no current_text in generator payload
          const msgs = params.messages as Array<{ role: string; content: string }>;
          const userMsg = msgs.find((m) => m.role === "user");
          if (userMsg && typeof userMsg.content === "string") {
            expect(userMsg.content).not.toContain("current_text");
          }
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_g2",
                name: "emit_replacement_copy",
                input: {
                  selected_tempo: "commanding",
                  tempo_reason: "decisive label",
                  replacement_text: "Perps are live. Powered by Hyperliquid.",
                  preserved_intent: "perps live",
                },
              },
            ] as never,
          };
        },
      },
    };

    // Validator client
    const validatorClient = {
      messages: {
        create: async () => {
          callOrder.push("validator");
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_v",
                name: "audit_pass",
                input: {
                  notes: "fits",
                  independent_classification: {
                    tempo: "commanding",
                    motifs: ["pressing", "punching"],
                    detected_drive: "spell-vision",
                    confidence: 0.85,
                    rationale: "decisive",
                  },
                },
              },
            ] as never,
          };
        },
      },
    };

    const result = await rewriteCopyLoop(
      { id: "T01", surface: "hero", job: "hero", current_text: "Trade perps, powered by Hyperliquid. Up to 40x." },
      {
        grounder_client: grounderClient as never,
        intent_client: intentClient as never,
        generator_client: generatorClient as never,
        validator_client: validatorClient as never,
        enable_grounding: true,
      },
    );

    // Order: grounder first, then extractor, generator, validator
    expect(callOrder[0]).toBe("grounder");
    expect(callOrder[1]).toBe("extractor");
    expect(callOrder[2]).toBe("generator");

    // Verified facts should be in the result
    expect(result.verified_facts.some((f) => f.value === "Hyperliquid")).toBe(true);
    expect(result.grounding).toBeDefined();
    expect(groundCalledWithText).toBe("captured");
  });

  it("skips grounding when enable_grounding is false", async () => {
    const { rewriteCopyLoop } = await import("../copy-rewrite-llm.js");
    let grounderCalled = false;

    const grounderClient = {
      messages: {
        create: async () => {
          grounderCalled = true;
          return { content: [] as never };
        },
      },
    };

    const intentClient = {
      messages: {
        create: async () => ({
          content: [
            {
              type: "tool_use",
              id: "t",
              name: "emit_intent",
              input: { intent: "perps.", constraints: [] },
            },
          ] as never,
        }),
      },
    };

    const generatorClient = {
      messages: {
        create: async () => ({
          content: [
            {
              type: "tool_use",
              id: "t2",
              name: "emit_replacement_copy",
              input: {
                selected_tempo: "commanding",
                tempo_reason: "decisive",
                replacement_text: "Perps live.",
                preserved_intent: "perps",
              },
            },
          ] as never,
        }),
      },
    };

    const validatorClient = {
      messages: {
        create: async () => ({
          content: [
            {
              type: "tool_use",
              id: "tv",
              name: "audit_pass",
              input: {
                notes: "ok",
                independent_classification: {
                  tempo: "commanding",
                  motifs: ["punching"],
                  detected_drive: "spell-vision",
                  confidence: 0.8,
                  rationale: "label",
                },
              },
            },
          ] as never,
        }),
      },
    };

    const result = await rewriteCopyLoop(
      { id: "T02", surface: "hero", job: "hero", current_text: "Perps live." },
      {
        grounder_client: grounderClient as never,
        intent_client: intentClient as never,
        generator_client: generatorClient as never,
        validator_client: validatorClient as never,
        enable_grounding: false,
      },
    );

    expect(grounderCalled).toBe(false);
    expect(result.verified_facts).toHaveLength(0);
    expect(result.grounding).toBeUndefined();
  });
});
