import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "./server.js";

let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing test server address");
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("comms-factory service API", () => {
  it("serves unauthenticated health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: "comms-factory-api" });
  });

  it("fails closed for POST routes in production when auth token is missing", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllow = process.env.COMMS_FACTORY_ALLOW_UNAUTHENTICATED;
    delete process.env.COMMS_FACTORY_SERVICE_TOKEN;
    process.env.NODE_ENV = "production";
    try {
      const response = await post("/validate", { text: "Fact A is live." });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, error: "service_auth_not_configured" });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousAllow === undefined) delete process.env.COMMS_FACTORY_ALLOW_UNAUTHENTICATED;
      else process.env.COMMS_FACTORY_ALLOW_UNAUTHENTICATED = previousAllow;
    }
  });

  it("requires bearer auth for POST routes when configured", async () => {
    process.env.COMMS_FACTORY_SERVICE_TOKEN = "test-token";
    try {
      const denied = await post("/validate", { text: "Fact A is live." });
      expect(denied.status).toBe(401);

      const allowed = await post("/validate", { text: "Fact A is live." }, "test-token");
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toMatchObject({ ok: true, operation: "validate", passed: true });
    } finally {
      delete process.env.COMMS_FACTORY_SERVICE_TOKEN;
    }
  });

  it("rejects invalid ReleaseCards instead of dropping the fact contract", async () => {
    const response = await post("/validate", {
      text: "Fact A is live.",
      release_card: { deployed_facts: ["Fact A is live"] },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: "invalid_release_card" });
  });

  it("audits without self-grounding when no fact source is supplied", async () => {
    const response = await post("/audit", { text: "Fact A is live.", surface: "tweet" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, operation: "audit", light: "amber", no_self_grounding: true });
    expect(body.questions.length).toBeGreaterThan(0);
  });

  it("accepts supplied audit fact sources without self-grounding", async () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const response = await post("/audit", {
        text: "Fact A is live.",
        fact_source: { deployed_facts: ["Fact A is live"] },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ ok: true, operation: "audit", light: "amber", no_self_grounding: true });
      expect(body.questions).toEqual([]);
      expect(body.axes.fact.status).toBe("grounded");
    } finally {
      if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previous;
    }
  });

  it("builds a valid ReleaseCard from approved facts", async () => {
    const response = await post("/build-card", {
      brief: "Launch Fact A",
      facts: ["Fact A is live"],
      channels: ["x", "web"],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.release_card).toMatchObject({
      kind: "launch-tier",
      deployed_facts: ["Fact A is live"],
      audience: ["x", "web"],
    });
  });

  it("rejects out-of-range grounding turn budgets before calling the grounder", async () => {
    const response = await post("/ground", { brief: "Launch Fact A", max_turns: 99 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: "invalid_max_turns" });
  });

  it("allows a deeper grounding turn budget now that the ceiling is raised", async () => {
    // 17 is above the new cap (16) -> still rejected at the bound check.
    const tooHigh = await post("/ground", { brief: "Launch Fact A", max_turns: 17 });
    expect((await tooHigh.json()).error).toBe("invalid_max_turns");
    // 12 was above the OLD cap (6); it must now clear the bound check (and fail later
    // on the contract instead), proving the ceiling moved up.
    const within = await post("/ground", { brief: "Launch Fact A", max_turns: 12 });
    expect((await within.json()).error).not.toBe("invalid_max_turns");
  });

  it("blocks tool grounding when Centaur tool-plane config is missing", async () => {
    const response = await post("/ground", {
      schema_version: "comms_factory.ground_from_tools.v1",
      mode: "ground_from_tools",
      brief: "Launch Fact A",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: "tool_plane_not_configured" });
    expect(JSON.stringify(body)).not.toContain("CENTAUR_TOKEN");
  });

  it("rejects request-supplied tool-plane endpoints that do not match server config", async () => {
    const previousBase = process.env.CENTAUR_BASE_URL;
    const previousToken = process.env.CENTAUR_TOKEN;
    process.env.CENTAUR_BASE_URL = "http://127.0.0.1:65535";
    process.env.CENTAUR_TOKEN = "test-cap-token";
    try {
      const response = await post("/ground", {
        schema_version: "comms_factory.ground_from_tools.v1",
        mode: "ground_from_tools",
        brief: "Launch Fact A",
        tool_plane: { base_url: "https://attacker.example", auth: { type: "bearer_env", env: "CENTAUR_TOKEN" } },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ ok: false, error: "tool_plane_endpoint_mismatch" });
    } finally {
      restoreEnv("CENTAUR_BASE_URL", previousBase);
      restoreEnv("CENTAUR_TOKEN", previousToken);
    }
  });

  it("rejects unsupported tool-plane token env names", async () => {
    const previousBase = process.env.CENTAUR_BASE_URL;
    const previousToken = process.env.CENTAUR_TOKEN;
    process.env.CENTAUR_BASE_URL = "http://127.0.0.1:65535";
    process.env.CENTAUR_TOKEN = "test-cap-token";
    try {
      const response = await post("/ground", {
        schema_version: "comms_factory.ground_from_tools.v1",
        mode: "ground_from_tools",
        brief: "Launch Fact A",
        tool_plane: { auth: { type: "bearer_env", env: "AWS_SECRET_ACCESS_KEY" } },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ ok: false, error: "unsupported_tool_token_env" });
    } finally {
      restoreEnv("CENTAUR_BASE_URL", previousBase);
      restoreEnv("CENTAUR_TOKEN", previousToken);
    }
  });

  it("runs /ground through mocked Centaur native tools and returns evidence", async () => {
    const centaurRequests: Array<{ url: string | undefined; authorization?: string; jobId?: string; threadKey?: string; body: Record<string, unknown> }> = [];
    const centaurServer = createServer(async (req, res) => {
      const body = await readJson(req) as Record<string, unknown>;
      centaurRequests.push({
        url: req.url,
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        ...(typeof req.headers["x-centaur-job-id"] === "string" ? { jobId: req.headers["x-centaur-job-id"] } : {}),
        ...(typeof req.headers["x-centaur-thread-key"] === "string" ? { threadKey: req.headers["x-centaur-thread-key"] } : {}),
        body,
      });
      writeJson(res, 200, {
        schema_version: "centaur.tool_result.v1",
        ok: true,
        content: "src/file.ts:1: Fact A is live",
        evidence: [{ schema_version: "centaur.evidence_item.v1", id: "ev_ground_1", source: "repo.search_match", source_ref: "src/file.ts:1", quote: "Fact A is live" }],
      });
    });
    const centaurBase = await listen(centaurServer);
    let anthropicCalls = 0;
    const anthropicServer = createServer((_req, res) => {
      anthropicCalls += 1;
      const content = anthropicCalls === 1
        ? [{ type: "tool_use", id: "toolu_grep", name: "grep_platform_code", input: { pattern: "Fact A" } }]
        : [
            { type: "tool_use", id: "toolu_fact", name: "record_fact", input: { category: "capability", claim: "Fact A", value: "live", source: "platform-code", source_ref: "ev_ground_1" } },
            { type: "tool_use", id: "toolu_done", name: "done_grounding", input: { summary: "grounded" } },
          ];
      writeJson(res, 200, { id: "msg_test", type: "message", role: "assistant", model: "claude-test", content, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } });
    });
    const anthropicBase = await listen(anthropicServer);

    const previousApiKey = process.env.ANTHROPIC_API_KEY;
    const previousAnthropicBase = process.env.ANTHROPIC_BASE_URL;
    const previousBase = process.env.CENTAUR_BASE_URL;
    const previousToken = process.env.CENTAUR_TOKEN;
    process.env.ANTHROPIC_API_KEY = "test-anthropic";
    process.env.ANTHROPIC_BASE_URL = anthropicBase;
    process.env.CENTAUR_BASE_URL = centaurBase;
    process.env.CENTAUR_TOKEN = "test-cap-token";
    try {
      const response = await post("/ground", {
        schema_version: "comms_factory.ground_from_tools.v1",
        mode: "ground_from_tools",
        brief: "Launch Fact A",
        job_id: "job-ground-test",
        thread_key: "thread-ground-test",
        tool_plane: { base_url: centaurBase, auth: { type: "bearer_env", env: "CENTAUR_TOKEN" } },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        operation: "ground",
        deployed_facts: ["Fact A: live"],
        evidence: [{ id: "ev_ground_1" }],
        progress: { mode: "ground_from_tools", schema_version: "comms_factory.ground_from_tools.v1" },
      });
      expect(body.facts[0].evidence_ids).toEqual(["ev_ground_1"]);
      expect(body.progress.fact_receipts).toEqual([{ claim: "Fact A", value: "live", evidence_ids: ["ev_ground_1"] }]);
      // grep first discovers repos via list_repos; this mock returns no `repositories`,
      // so the grounder falls back to the single platform repo (one search).
      expect(centaurRequests[0]?.url).toBe("/tools/repo_context/list_repos");
      const groundSearch = centaurRequests.find((r) => r.url === "/tools/repo_context/search");
      expect(groundSearch).toMatchObject({
        authorization: "Bearer test-cap-token",
        jobId: "job-ground-test",
        threadKey: "thread-ground-test",
        // /ground now defaults the grounder ref to the repo default branch, which
        // propagates through to repo_context.search so the deep-sweep prompt fires.
        body: { repo: "infinex-platform", query: "Fact A", ref: "main" },
      });
    } finally {
      restoreEnv("ANTHROPIC_API_KEY", previousApiKey);
      restoreEnv("ANTHROPIC_BASE_URL", previousAnthropicBase);
      restoreEnv("CENTAUR_BASE_URL", previousBase);
      restoreEnv("CENTAUR_TOKEN", previousToken);
      await closeServer(centaurServer);
      await closeServer(anthropicServer);
    }
  });

  it("accepts operator facts in tool-plane contract without local infra", async () => {
    const response = await post("/ground", {
      schema_version: "comms_factory.ground_from_tools.v1",
      mode: "ground_from_tools",
      brief: "Launch Fact A",
      operator_facts: [
        { category: "capability", claim: "Fact A", value: "live", source: "operator-input", source_ref: "operator" },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      operation: "ground",
      deployed_facts: ["Fact A: live"],
      progress: { mode: "operator_facts_only", ground_turns: 0 },
    });
  });

  it("transitionally accepts the legacy capability-plane contract", async () => {
    const response = await post("/ground", {
      schema_version: "comms_factory.ground_from_capabilities.v1",
      mode: "ground_from_capabilities",
      brief: "Launch Fact A",
      operator_facts: [
        { category: "capability", claim: "Fact A", value: "live", source: "operator-input", source_ref: "operator" },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      operation: "ground",
      deployed_facts: ["Fact A: live"],
      progress: { mode: "operator_facts_only", ground_turns: 0 },
    });
  });

  it("rejects generation without an approved ReleaseCard gate", async () => {
    const cardResponse = await post("/build-card", { brief: "Launch Fact A", facts: ["Fact A is live"] });
    const { release_card } = await cardResponse.json();

    const response = await post("/generate", { release_card });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: "release_card_not_approved" });
  });

  it("rejects empty approved_facts and unsupported generation channels", async () => {
    const cardResponse = await post("/build-card", { brief: "Launch Fact A", facts: ["Fact A is live"] });
    const { release_card } = await cardResponse.json();

    const unapproved = await post("/generate", { release_card, approved_facts: [] });
    expect(unapproved.status).toBe(400);
    expect(await unapproved.json()).toMatchObject({ ok: false, error: "release_card_not_approved" });

    const unsupported = await post("/generate", { release_card: { ...release_card, audience: ["telegram"] }, approved: true });
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toMatchObject({ ok: false, error: "unsupported_channels" });
  });

  it("reports delivery capabilities from env without leaking values", async () => {
    const prevGh = process.env.GITHUB_TOKEN;
    const prevTf = process.env.TYPEFULLY_API_KEY;
    const prevDsp = process.env.DISPLAYDEV_API_KEY;
    process.env.GITHUB_TOKEN = "github_pat_secret_value";
    delete process.env.TYPEFULLY_API_KEY;
    process.env.DISPLAYDEV_API_KEY = "sk_live_secret";
    try {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.capabilities).toEqual({ platform_pr: true, typefully: false, display: true });
      expect(JSON.stringify(body)).not.toContain("github_pat_secret_value");
      expect(JSON.stringify(body)).not.toContain("sk_live_secret");
    } finally {
      restoreEnv("GITHUB_TOKEN", prevGh);
      restoreEnv("TYPEFULLY_API_KEY", prevTf);
      restoreEnv("DISPLAYDEV_API_KEY", prevDsp);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function listen(serverToListen: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    serverToListen.listen(0, "127.0.0.1", () => {
      const address = serverToListen.address();
      if (!address || typeof address === "string") throw new Error("missing server address");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(serverToClose: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => serverToClose.close((err) => (err ? reject(err) : resolve())));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function post(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
