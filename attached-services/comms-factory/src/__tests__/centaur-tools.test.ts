import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CentaurToolsClient } from "../centaur-tools.js";

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

describe("CentaurToolsClient.callTool", () => {
  let server: ReturnType<typeof createServer> | undefined;
  let baseUrl = "";
  const requests: Array<{ url: string | undefined; method: string | undefined; headers: IncomingMessage["headers"]; body: unknown }> = [];
  let handler: (req: IncomingMessage, res: ServerResponse, body: unknown) => void = (_req, res) =>
    writeJson(res, 200, { schema_version: "centaur.tool_result.v1", ok: true, content: "OK", evidence: [] });

  beforeEach(async () => {
    requests.length = 0;
    server = createServer(async (req, res) => {
      const body = await readBody(req);
      requests.push({ url: req.url, method: req.method, headers: req.headers, body });
      handler(req, res, body);
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
    handler = (_req, res) => writeJson(res, 200, { schema_version: "centaur.tool_result.v1", ok: true, content: "OK", evidence: [] });
  });

  it("POSTs to /tools/{tool}/{method} with bearer auth and the raw input body, returning the parsed envelope", async () => {
    handler = (_req, res) =>
      writeJson(res, 200, {
        schema_version: "centaur.tool_result.v1",
        ok: true,
        content: "src/file.ts:1: const maxLeverage = 50",
        evidence: [{ schema_version: "centaur.evidence_item.v1", id: "ev_repo_1", source: "repo.search_match", source_ref: "src/file.ts:1", quote: "maxLeverage = 50" }],
        retryable: false,
      });
    const client = new CentaurToolsClient({ base_url: baseUrl, token: "secret-token" });

    const result = await client.callTool("repo_context", "search", { repo: "infinex-platform", query: "maxLeverage" });

    expect(requests[0]?.method).toBe("POST");
    expect(requests[0]?.url).toBe("/tools/repo_context/search");
    expect(requests[0]?.headers.authorization).toBe("Bearer secret-token");
    expect(requests[0]?.body).toEqual({ repo: "infinex-platform", query: "maxLeverage" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe("src/file.ts:1: const maxLeverage = 50");
      expect(result.evidence[0]?.id).toBe("ev_repo_1");
    }
  });

  it("sends Idempotency-Key and X-Centaur-* trace headers when provided, and omits them otherwise", async () => {
    const client = new CentaurToolsClient({ base_url: baseUrl, token: "t" });

    await client.callTool("websearch", "search", { query: "x" }, {
      idempotencyKey: "job-1:ground:infinex_web_search:toolu_1",
      trace: { jobId: "job-1", stage: "ground", threadKey: "thread-1", trace: "trace-1" },
    });
    expect(requests[0]?.headers["idempotency-key"]).toBe("job-1:ground:infinex_web_search:toolu_1");
    expect(requests[0]?.headers["x-centaur-job-id"]).toBe("job-1");
    expect(requests[0]?.headers["x-centaur-stage"]).toBe("ground");
    expect(requests[0]?.headers["x-centaur-thread-key"]).toBe("thread-1");
    expect(requests[0]?.headers["x-centaur-trace"]).toBe("trace-1");

    await client.callTool("websearch", "search", { query: "y" });
    expect(requests[1]?.headers["idempotency-key"]).toBeUndefined();
    expect(requests[1]?.headers["x-centaur-job-id"]).toBeUndefined();
  });

  it("maps HTTP 500 to a retryable typed error", async () => {
    handler = (_req, res) => writeJson(res, 500, { schema_version: "centaur.tool_result.v1", ok: false, error: { code: "boom", message: "kaboom" } });
    const client = new CentaurToolsClient({ base_url: baseUrl, token: "t" });

    const result = await client.callTool("browser", "render", { url: "https://x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.error.code).toBe("boom");
    }
  });

  it("maps HTTP 403 to a non-retryable forbidden error", async () => {
    handler = (_req, res) => writeJson(res, 403, { detail: "nope" });
    const client = new CentaurToolsClient({ base_url: baseUrl, token: "t" });

    const result = await client.callTool("repo_context", "search", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("maps a non-JSON body to an invalid_json typed error", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("<html>not json</html>");
    };
    const client = new CentaurToolsClient({ base_url: baseUrl, token: "t" });

    const result = await client.callTool("websearch", "search", {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_json");
  });

  it("redacts the bearer token from thrown transport errors", async () => {
    const client = new CentaurToolsClient({ base_url: "http://127.0.0.1:1/", token: "super-secret-token", timeout_ms: 50 });

    await expect(
      client.callTool("websearch", "search", {}).then((r) => {
        if (r.ok) throw new Error("expected failure");
        return r;
      }),
    ).resolves.toMatchObject({ ok: false });
    const result = await client.callTool("websearch", "search", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(JSON.stringify(result.error)).not.toContain("super-secret-token");
    }
  });

  it("aborts on timeout and surfaces a retryable error", async () => {
    handler = (_req, res) => {
      // never respond within the timeout window
      setTimeout(() => writeJson(res, 200, { ok: true, evidence: [] }), 1000);
    };
    const client = new CentaurToolsClient({ base_url: baseUrl, token: "t", timeout_ms: 30 });

    const result = await client.callTool("websearch", "search", {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });
});
