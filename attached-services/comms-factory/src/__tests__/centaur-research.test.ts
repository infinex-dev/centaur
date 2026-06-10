import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CentaurResearchExecutor, mapLogicalToolToTool } from "../centaur-research.js";

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      resolve(raw.trim() ? (JSON.parse(raw) as unknown) : undefined);
    });
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

describe("CentaurResearchExecutor", () => {
  let server: ReturnType<typeof createServer> | undefined;
  let baseUrl = "";
  const requests: Array<{ url: string | undefined; authorization?: string; headers: IncomingMessage["headers"]; body: unknown }> = [];

  beforeEach(async () => {
    requests.length = 0;
    server = createServer(async (req, res) => {
      const body = await readBody(req);
      requests.push({ url: req.url, ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}), headers: req.headers, body });
      const path = req.url ?? "";
      if (path === "/tools/repo_context/list_repos") {
        writeJson(res, 200, {
          schema_version: "centaur.tool_result.v1",
          ok: true,
          output: {
            ok: true,
            repositories: [
              { repo: "infinex-xyz/platform", available: true },
              { repo: "infinex-xyz/agent-platform", available: true },
              { repo: "infinex-xyz/context", available: true },
            ],
            aliases: {},
          },
          evidence: [],
        });
        return;
      }
      if (path === "/tools/repo_context/search") {
        const repo = typeof (body as { repo?: unknown })?.repo === "string" ? (body as { repo: string }).repo : "unknown";
        const short = repo.split("/").pop() ?? repo;
        writeJson(res, 200, {
          schema_version: "centaur.tool_result.v1",
          ok: true,
          content: `${short}:src/file.ts:1: const maxLeverage = 50`,
          evidence: [{ schema_version: "centaur.evidence_item.v1", id: `ev_${short}`, source: "repo.search_match", source_ref: "src/file.ts:1", quote: "maxLeverage = 50" }],
        });
        return;
      }
      if (path === "/tools/repo_context/read_file") {
        // 200 response carrying a retryable ok:false envelope (distinct from the 503 status path below).
        writeJson(res, 200, { schema_version: "centaur.tool_result.v1", ok: false, retryable: true, error: { code: "tool_unavailable", message: "repo cache warming", retryable: true } });
        return;
      }
      if (path === "/tools/websearch/search") {
        writeJson(res, 503, { schema_version: "centaur.tool_result.v1", ok: false, error: { code: "search_rate_limited", message: "slow down", retryable: true } });
        return;
      }
      if (path === "/tools/twitter/search_tweets") {
        writeJson(res, 200, { unexpected: true });
        return;
      }
      writeJson(res, 200, { schema_version: "centaur.tool_result.v1", ok: true, output: { ok: true }, evidence: [] });
    });
    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", () => {
        const address = server!.address();
        if (!address || typeof address === "string") throw new Error("missing address");
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server!.close((err) => (err ? reject(err) : resolve())));
    server = undefined;
  });

  it("maps repo logical tools to repo_context tool methods", () => {
    // repo_context.search(repo, query, ref, path_glob, limit) — emit exactly those names.
    expect(mapLogicalToolToTool("grep_platform_code", { pattern: "maxLeverage", glob: "src/**", maxResults: 5 }, "origin/feature")).toEqual({
      tool: "repo_context",
      method: "search",
      input: {
        repo: "infinex-platform",
        query: "maxLeverage",
        path_glob: "src/**",
        limit: 5,
        ref: "origin/feature",
      },
    });
    expect(mapLogicalToolToTool("read_platform_file", { path: "src/file.ts", startLine: 10, endLine: 20 })).toEqual({
      tool: "repo_context",
      method: "read_range",
      input: { repo: "infinex-platform", path: "src/file.ts", start_line: 10, end_line: 20 },
    });
    expect(mapLogicalToolToTool("read_platform_file", { path: "src/file.ts" })?.method).toBe("read_file");
  });

  it("routes the repo arg to repo_context, defaulting to the platform repo", () => {
    expect(mapLogicalToolToTool("grep_platform_code", { pattern: "x" }, undefined, "infinex-xyz/context")?.input.repo).toBe("infinex-xyz/context");
    expect(mapLogicalToolToTool("grep_platform_code", { pattern: "x" })?.input.repo).toBe("infinex-platform");
    expect(mapLogicalToolToTool("read_platform_file", { path: "a.ts" }, undefined, "agent-platform")?.input.repo).toBe("agent-platform");
  });

  it("maps non-repo research tools to native tool methods", () => {
    // Web/page fetching has no dedicated tool — it runs through the Exa-backed websearch.search.
    expect(mapLogicalToolToTool("fetch_public_page", { url: "https://example.com" })).toEqual({
      tool: "websearch",
      method: "search",
      input: { query: "https://example.com/" },
    });
    expect(mapLogicalToolToTool("fetch_infinex_page", { path: "/docs" })).toEqual({
      tool: "websearch",
      method: "search",
      input: { query: "https://infinex.xyz/docs", include_domains: ["infinex.xyz"] },
    });
    expect(mapLogicalToolToTool("fetch_rendered_page", { url: "https://infinex.xyz" })).toEqual({
      tool: "websearch",
      method: "search",
      input: { query: "https://infinex.xyz/" },
    });
    // infinex_web_search → websearch.search(query, num_results) — drop the grounder-only `context`.
    expect(mapLogicalToolToTool("infinex_web_search", { context: "verify", query: "Infinex" })).toEqual({
      tool: "websearch",
      method: "search",
      input: { query: "Infinex" },
    });
    // infinex_search_recent_posts → twitter.search_tweets(query, limit) — max_results→limit, drop the rest.
    expect(mapLogicalToolToTool("infinex_search_recent_posts", { context: "verify", query: "from:infinex", maxResults: 15 })).toEqual({
      tool: "twitter",
      method: "search_tweets",
      input: { query: "from:infinex", limit: 15 },
    });
    // fetch_json_api has no native Centaur tool (Exa search does not fetch JSON endpoints).
    expect(mapLogicalToolToTool("fetch_json_api", { url: "https://api.hyperliquid.xyz/info" })).toBeUndefined();
  });

  it("calls /tools/{tool}/{method} with bearer auth, raw body, idempotency + trace headers, and stores evidence", async () => {
    const executor = new CentaurResearchExecutor({
      base_url: baseUrl,
      bearer_token: "secret-token",
      job_id: "job-1",
      thread_key: "thread-1",
      workflow_run_id: "wf-1",
      requester_user_id: "user-1",
      stage: "ground",
      gate_version: "v1",
    });

    const result = await executor.execute("grep_platform_code", { pattern: "maxLeverage" }, "toolu_1", { ref: "origin/feature" });

    // grep fans out across every configured repo and merges the labelled blocks.
    expect(result.content).toContain("=== repo: infinex-xyz/platform ===");
    expect(result.content).toContain("=== repo: infinex-xyz/agent-platform ===");
    expect(result.content).toContain("=== repo: infinex-xyz/context ===");
    expect(result.content).toContain("Evidence IDs: ev_platform, ev_agent-platform, ev_context");
    expect(executor.evidence.map((item) => item.id)).toEqual(["ev_platform", "ev_agent-platform", "ev_context"]);

    // Repo list is discovered once via list_repos, then one search per repo.
    expect(requests[0]?.url).toBe("/tools/repo_context/list_repos");
    const searches = requests.filter((r) => r.url === "/tools/repo_context/search");
    expect(searches).toHaveLength(3);
    expect(searches.map((r) => (r.body as { repo: string }).repo)).toEqual([
      "infinex-xyz/platform",
      "infinex-xyz/agent-platform",
      "infinex-xyz/context",
    ]);
    // Body is the raw method input, NOT a tool envelope; no tool-rejected kwargs leak in.
    expect(searches[0]?.body).toEqual({ repo: "infinex-xyz/platform", query: "maxLeverage", ref: "origin/feature" });
    // Per-repo idempotency key; deterministicRequestId keeps ':' and rewrites '/' to '_'.
    expect(searches[0]?.headers["idempotency-key"]).toBe("job-1:ground:grep_platform_code:infinex-xyz_platform:toolu_1");
    expect(searches[0]?.headers["x-centaur-job-id"]).toBe("job-1");
    expect(searches[0]?.headers["x-centaur-stage"]).toBe("ground");
    expect(searches[0]?.headers["x-centaur-thread-key"]).toBe("thread-1");
  });

  it("rejects non-HTTPS page URLs before calling Centaur", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("fetch_public_page", { url: "http://example.com/page" }, "toolu_page");

    expect(result.content).toContain("fetch_public_page rejected: only https:// URLs are allowed");
    expect(requests).toHaveLength(0);
  });

  it("returns UNAVAILABLE for fetch_json_api (no native Centaur tool)", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("fetch_json_api", { url: "https://api.hyperliquid.xyz/info" }, "toolu_json");

    expect(result.content).toContain("UNAVAILABLE: no Centaur tool mapping for fetch_json_api");
    expect(requests).toHaveLength(0);
  });

  it("rejects non-Infinex URLs for fetch_infinex_page before calling Centaur", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("fetch_infinex_page", { path: "https://evil.example" }, "toolu_infinex");
    const httpResult = await executor.execute("fetch_infinex_page", { path: "http://infinex.xyz" }, "toolu_infinex_http");
    const coercedResult = await executor.execute("fetch_infinex_page", { path: "http://evil.example" }, "toolu_infinex_evil_http");

    expect(result.content).toContain("fetch_infinex_page rejected: fetch_infinex_page only supports infinex.xyz hosts");
    expect(httpResult.content).toContain("fetch_infinex_page rejected: fetch_infinex_page only supports https:// URLs");
    expect(coercedResult.content).toContain("fetch_infinex_page rejected: fetch_infinex_page only supports https:// URLs");
    expect(requests).toHaveLength(0);
  });

  it("turns retryable tool errors into UNAVAILABLE without evidence", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("read_platform_file", { path: "src/file.ts" }, "toolu_read");

    expect(result.content).toContain("UNAVAILABLE: tool_unavailable");
    expect(result.evidence).toBeUndefined();
    expect(executor.evidence).toHaveLength(0);
  });

  it("preserves typed tool errors on non-2xx responses", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("infinex_web_search", { context: "verify", query: "Infinex" }, "toolu_search");

    expect(result.content).toContain("UNAVAILABLE: search_rate_limited: slow down");
    expect(result.evidence).toBeUndefined();
  });

  it("treats malformed tool responses as ERROR", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("infinex_search_recent_posts", { context: "verify", query: "from:infinex" }, "toolu_x");

    expect(result.content).toContain("ERROR: invalid_tool_result");
  });

  it("does local static partner lookup without calling Centaur", async () => {
    const executor = new CentaurResearchExecutor({ base_url: baseUrl, bearer_token: "secret-token", job_id: "job-1" });
    const result = await executor.execute("lookup_partner", { feature: "perps_trading" }, "toolu_lookup");

    expect(result.content).toContain("Hyperliquid");
    expect(requests).toHaveLength(0);
  });
});
