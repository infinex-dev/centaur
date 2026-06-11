/**
 * Tests for the self-derived routing manifest (route-before-grep).
 *
 * All tests inject a fake ToolCall — no live tool plane, no repo cache.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolResult } from "../centaur-tools.js";
import {
  _resetManifestCache,
  buildManifest,
  classifyRepo,
  extractCodeManifest,
  extractKnowledgeManifest,
  getRoutingManifest,
  refreshRoutingManifest,
  selectEntries,
  type ManifestEntry,
  type RoutingManifest,
  type ToolCall,
} from "../fact-grounder/sources/repo-manifest.js";

afterEach(() => {
  _resetManifestCache();
  vi.restoreAllMocks();
});

// ─── Fake tool plane ──────────────────────────────────────────────────────────

function okSearch(matches: Array<{ path: string; line: number; preview: string }>): ToolResult {
  return { ok: true, evidence: [], output: { ok: true, matches } };
}

function okRead(): ToolResult {
  return { ok: true, evidence: [], output: { ok: true, content: "packages:\n  - apps/*\n" } };
}

function errResult(code = "file_not_found"): ToolResult {
  return { ok: false, retryable: false, error: { code, message: code, retryable: false } };
}

interface FakePlaneSpec {
  repos?: Array<{ repo: string; available?: boolean }>;
  hasWorkspace?: (repo: string) => boolean;
  searches?: (repo: string, query: string, glob: string) => ToolResult;
}

function fakePlane(spec: FakePlaneSpec): ToolCall {
  return async (tool, method, input) => {
    expect(tool).toBe("repo_context");
    if (method === "list_repos") {
      return { ok: true, evidence: [], output: { ok: true, repositories: spec.repos ?? [] } };
    }
    const repo = String(input.repo ?? "");
    if (method === "read_file") {
      return spec.hasWorkspace?.(repo) ? okRead() : errResult();
    }
    if (method === "search") {
      return (
        spec.searches?.(repo, String(input.query ?? ""), String(input.path_glob ?? "")) ??
        okSearch([])
      );
    }
    throw new Error(`unexpected method ${method}`);
  };
}

const PLATFORM_SEARCHES = (repo: string, query: string, glob: string): ToolResult => {
  if (glob === ":(glob)apps/*/package.json" && query === '"name":') {
    return okSearch([
      { path: "apps/perps-app/package.json", line: 2, preview: '  "name": "@infinex-private/perps-app",' },
      { path: "apps/cli/package.json", line: 2, preview: '  "name": "@infinex/cli",' },
      // With :(glob) the server no longer returns nested paths; keep one in the
      // fixture to assert the client-side NOISE_PATH filter as defense-in-depth.
      { path: "apps/perps-app/public/charting_library/package.json", line: 2, preview: '  "name": "tradingview",' },
    ]);
  }
  if (glob === ":(glob)packages/*/package.json" && query === '"name":') {
    return okSearch([
      { path: "packages/perps/package.json", line: 2, preview: '  "name": "@infinex-private/perps",' },
      { path: "packages/db/package.json", line: 2, preview: '  "name": "@infinex/db",' },
    ]);
  }
  if (glob === ":(glob)packages/*/package.json" && query === '"description":') {
    return okSearch([
      {
        path: "packages/perps/package.json",
        line: 4,
        preview: '  "description": "Perpetuals trading shared logic `rm -rf` <script>alert(1)</script>",',
      },
    ]);
  }
  return okSearch([]);
};

const CONTEXT_SEARCHES = (repo: string, query: string, glob: string): ToolResult => {
  if (glob !== ":(glob)*.md") return okSearch([]);
  if (query === "description:") {
    return okSearch([
      { path: "ARCHITECTURE.md", line: 2, preview: 'description: "Product architecture (features, user flows)"' },
      { path: "CHANGELOG.md", line: 2, preview: 'description: "Log of critical org and product decisions"' },
      // prose mention deep in a file — not frontmatter, must be ignored
      { path: "ROADMAP.md", line: 88, preview: "see the description: section above" },
    ]);
  }
  if (query === "type:") {
    return okSearch([
      { path: "ARCHITECTURE.md", line: 4, preview: "type: canon" },
      { path: "CHANGELOG.md", line: 4, preview: "type: log" },
      { path: "SOUL.md", line: 4, preview: "type: persona" },
      // IDENTITY.md has no frontmatter at all → no type match → excluded
    ]);
  }
  return okSearch([]);
};

// ─── classifyRepo ─────────────────────────────────────────────────────────────

describe("classifyRepo", () => {
  it("classifies a pnpm workspace as code-monorepo", async () => {
    const call = fakePlane({ hasWorkspace: () => true });
    expect(await classifyRepo(call, "infinex-xyz/platform")).toBe("code-monorepo");
  });

  it("classifies a frontmatter markdown repo as knowledge", async () => {
    const call = fakePlane({ hasWorkspace: () => false, searches: CONTEXT_SEARCHES });
    expect(await classifyRepo(call, "infinex-xyz/context")).toBe("knowledge");
  });

  it("returns unknown when neither shape matches", async () => {
    const call = fakePlane({ hasWorkspace: () => false });
    expect(await classifyRepo(call, "infinex-xyz/mystery")).toBe("unknown");
  });
});

// ─── extractCodeManifest ──────────────────────────────────────────────────────

describe("extractCodeManifest", () => {
  it("harvests package names per directory and excludes vendored noise", async () => {
    const call = fakePlane({ hasWorkspace: () => true, searches: PLATFORM_SEARCHES });
    const entries = await extractCodeManifest(call, "infinex-xyz/platform");
    const paths = entries.map((entry) => entry.path);
    expect(paths).toContain("apps/perps-app");
    expect(paths).toContain("packages/perps");
    expect(paths.some((path) => path.includes("charting_library"))).toBe(false);
    const perpsApp = entries.find((entry) => entry.path === "apps/perps-app");
    expect(perpsApp?.label).toBe("@infinex-private/perps-app");
    expect(perpsApp?.kind).toBe("code");
    expect(perpsApp?.blurb).toBeUndefined(); // no description in source
  });

  it("sanitizes blurbs: strips structural characters and caps length (R7)", async () => {
    const call = fakePlane({ hasWorkspace: () => true, searches: PLATFORM_SEARCHES });
    const entries = await extractCodeManifest(call, "infinex-xyz/platform");
    const perps = entries.find((entry) => entry.path === "packages/perps");
    expect(perps?.blurb).toBeDefined();
    expect(perps?.blurb).not.toMatch(/[`<>{}]/);
    expect(perps!.blurb!.length).toBeLessThanOrEqual(120);
    expect(perps?.blurb).toContain("Perpetuals trading shared logic");
  });
});

// ─── extractKnowledgeManifest ─────────────────────────────────────────────────

describe("extractKnowledgeManifest", () => {
  it("includes only frontmatter-typed canon/log docs (positive allowlist)", async () => {
    const call = fakePlane({ hasWorkspace: () => false, searches: CONTEXT_SEARCHES });
    const entries = await extractKnowledgeManifest(call, "infinex-xyz/context");
    const paths = entries.map((entry) => entry.path);
    expect(paths).toEqual(["ARCHITECTURE.md", "CHANGELOG.md"]);
    expect(paths).not.toContain("SOUL.md"); // type: persona — not allowlisted
    expect(paths).not.toContain("IDENTITY.md"); // no frontmatter type at all
    const architecture = entries.find((entry) => entry.path === "ARCHITECTURE.md");
    expect(architecture?.blurb).toBe("Product architecture (features, user flows)");
    expect(architecture?.kind).toBe("knowledge");
  });

  it("ignores description-like prose outside the frontmatter region", async () => {
    const call = fakePlane({ hasWorkspace: () => false, searches: CONTEXT_SEARCHES });
    const entries = await extractKnowledgeManifest(call, "infinex-xyz/context");
    expect(entries.map((entry) => entry.path)).not.toContain("ROADMAP.md");
  });
});

// ─── buildManifest ────────────────────────────────────────────────────────────

describe("buildManifest", () => {
  it("classifies each allowlisted repo and merges extractor output", async () => {
    const call = fakePlane({
      repos: [
        { repo: "infinex-xyz/platform" },
        { repo: "infinex-xyz/context" },
        { repo: "infinex-xyz/offline", available: false },
      ],
      hasWorkspace: (repo) => repo === "infinex-xyz/platform",
      searches: (repo, query, glob) =>
        repo === "infinex-xyz/platform"
          ? PLATFORM_SEARCHES(repo, query, glob)
          : CONTEXT_SEARCHES(repo, query, glob),
    });
    const manifest = await buildManifest(call);
    const repos = new Set(manifest.entries.map((entry) => entry.repo));
    expect(repos).toEqual(new Set(["infinex-xyz/platform", "infinex-xyz/context"]));
    expect(manifest.entries.some((entry) => entry.kind === "code")).toBe(true);
    expect(manifest.entries.some((entry) => entry.kind === "knowledge")).toBe(true);
  });

  it("survives a single repo failing without dropping the others", async () => {
    const call: ToolCall = async (tool, method, input) => {
      if (method === "list_repos") {
        return {
          ok: true,
          evidence: [],
          output: {
            ok: true,
            repositories: [{ repo: "infinex-xyz/broken" }, { repo: "infinex-xyz/context" }],
          },
        };
      }
      if (String(input.repo) === "infinex-xyz/broken") throw new Error("boom");
      if (method === "read_file") return errResult();
      return CONTEXT_SEARCHES(String(input.repo), String(input.query), String(input.path_glob));
    };
    const manifest = await buildManifest(call);
    expect(manifest.entries.length).toBeGreaterThan(0);
    expect(manifest.entries.every((entry) => entry.repo === "infinex-xyz/context")).toBe(true);
    expect(manifest.failed_repos).toEqual(["infinex-xyz/broken"]);
  });

  it("treats a retryable transport failure as a repo failure, not as not-found", async () => {
    const transportError: ToolResult = {
      ok: false,
      retryable: true,
      error: { code: "transport_error", message: "timeout", retryable: true },
    };
    const call: ToolCall = async (tool, method, input) => {
      if (method === "list_repos") {
        return {
          ok: true,
          evidence: [],
          output: { ok: true, repositories: [{ repo: "infinex-xyz/platform" }] },
        };
      }
      return transportError;
    };
    const manifest = await buildManifest(call);
    expect(manifest.entries).toHaveLength(0);
    expect(manifest.failed_repos).toEqual(["infinex-xyz/platform"]);
  });
});

// ─── selectEntries (rule-capped render) ──────────────────────────────────────

describe("selectEntries", () => {
  function entry(overrides: Partial<ManifestEntry>): ManifestEntry {
    return { repo: "r", kind: "code", label: "l", path: "packages/x", ...overrides };
  }

  it("orders knowledge → blurbed code → apps → rest, capped at 60", () => {
    const manifest: RoutingManifest = {
      built_at: "2026-06-10T00:00:00Z",
      entries: [
        ...Array.from({ length: 70 }, (_, i) => entry({ path: `packages/p${i}` })),
        entry({ path: "apps/perps-app" }),
        entry({ path: "packages/perps", blurb: "Perpetuals trading shared logic" }),
        entry({ kind: "knowledge", path: "ARCHITECTURE.md", blurb: "Product architecture" }),
      ],
    };
    const selected = selectEntries(manifest);
    expect(selected.length).toBe(60);
    expect(selected[0]?.path).toBe("ARCHITECTURE.md");
    expect(selected[1]?.path).toBe("packages/perps");
    expect(selected[2]?.path).toBe("apps/perps-app");
  });
});

// ─── refresh cache behavior ───────────────────────────────────────────────────

describe("refreshRoutingManifest / getRoutingManifest", () => {
  const workingPlane = fakePlane({
    repos: [{ repo: "infinex-xyz/context" }],
    hasWorkspace: () => false,
    searches: CONTEXT_SEARCHES,
  });

  it("is undefined before the first successful build (degrade to unrouted)", () => {
    expect(getRoutingManifest()).toBeUndefined();
  });

  it("serves the built manifest after refresh", async () => {
    await refreshRoutingManifest(workingPlane);
    const entries = getRoutingManifest();
    expect(entries?.map((item) => item.path)).toContain("ARCHITECTURE.md");
  });

  it("keeps the previous manifest when a refresh fails (stale-while-revalidate)", async () => {
    await refreshRoutingManifest(workingPlane);
    const before = getRoutingManifest();
    const failingPlane: ToolCall = async () => {
      throw new Error("plane down");
    };
    await refreshRoutingManifest(failingPlane);
    expect(getRoutingManifest()).toEqual(before);
  });

  it("keeps the previous manifest when a refresh comes back empty", async () => {
    await refreshRoutingManifest(workingPlane);
    const before = getRoutingManifest();
    await refreshRoutingManifest(fakePlane({ repos: [] }));
    expect(getRoutingManifest()).toEqual(before);
  });

  it("carries forward previous entries for repos that failed transiently", async () => {
    await refreshRoutingManifest(workingPlane);
    const before = getRoutingManifest();
    expect(before?.length).toBeGreaterThan(0);
    // Next refresh: context now times out — its previous entries must survive.
    const timeoutPlane: ToolCall = async (tool, method) => {
      if (method === "list_repos") {
        return {
          ok: true,
          evidence: [],
          output: { ok: true, repositories: [{ repo: "infinex-xyz/context" }] },
        };
      }
      return {
        ok: false,
        retryable: true,
        error: { code: "transport_error", message: "timeout", retryable: true },
      };
    };
    await refreshRoutingManifest(timeoutPlane);
    expect(getRoutingManifest()).toEqual(before);
  });

  it("logs a structured event when a blurb changes between refreshes (R7 audit)", async () => {
    await refreshRoutingManifest(workingPlane);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const mutatedSearches = (repo: string, query: string, glob: string): ToolResult => {
      const result = CONTEXT_SEARCHES(repo, query, glob);
      if (query === "description:" && result.ok) {
        const output = result.output as { matches: Array<{ path: string; preview: string }> };
        for (const match of output.matches) {
          if (match.path === "ARCHITECTURE.md") {
            match.preview = 'description: "POISONED description"';
          }
        }
      }
      return result;
    };
    await refreshRoutingManifest(
      fakePlane({
        repos: [{ repo: "infinex-xyz/context" }],
        hasWorkspace: () => false,
        searches: mutatedSearches,
      }),
    );
    const events = log.mock.calls
      .map((call) => JSON.parse(String(call[0])) as { event?: string; path?: string })
      .filter((parsed) => parsed.event === "manifest_blurb_changed");
    expect(events.some((event) => event.path === "ARCHITECTURE.md")).toBe(true);
  });
});
