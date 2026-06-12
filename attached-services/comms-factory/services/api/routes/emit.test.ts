import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BLOG_DIR, FEATURES_DATA_PATH } from "../../../src/emit-platform-pr.js";
import { HttpError } from "../http.js";
import { handleEmit } from "./emit.js";

// Fake RequestContext for direct handler invocation (Task 3 pattern).
function ctx(body: unknown) {
  return {
    request: {} as never,
    method: "POST",
    url: new URL("http://x/emit"),
    body,
    requestId: "t",
  };
}

const BLOG_TEXT = "# Perps launch\n\nPerps are live on Base.\n";
const BLOG_PATH = `${BLOG_DIR}/perps-launch.md`;

function emitBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    release_card: { title: "Perps launch" },
    final_by_channel: { blog: { text: BLOG_TEXT } },
    candidates: [],
    run_id: "run_1",
    ...overrides,
  };
}

// --- Mock GitHub server (same pattern as src/__tests__/github-emit.test.ts) ---
interface RecordedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: Record<string, unknown> | undefined;
}

let mock: ReturnType<typeof createServer>;
let requests: RecordedRequest[];
let base = "";
// Tests may set this to intercept requests before the default GitHub handler.
let respondWith: ((req: IncomingMessage, res: ServerResponse) => boolean) | null = null;

const FEATURES_FIXTURE = [
  "type FeatureCopyOptions = { title: string; description?: string };",
  "export const FEATURES_COPY: FeatureCopyOptions[] = [",
  "  {",
  "    title: 'Homepage',",
  "    description: 'A command center view.',",
  "  },",
  "];",
  "",
].join("\n");

function reply(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

beforeEach(async () => {
  requests = [];
  respondWith = null;
  mock = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    const body = chunks.length
      ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>)
      : undefined;
    requests.push({
      method: req.method ?? "",
      url: req.url ?? "",
      authorization: req.headers.authorization,
      body,
    });
    if (respondWith?.(req, res)) return;
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://mock").pathname);
    if (req.method === "GET" && path === "/repos/o/r/pulls") {
      return reply(res, 200, []);
    }
    if (req.method === "GET" && path === "/repos/o/r/git/ref/heads/main") {
      return reply(res, 200, { object: { sha: "base123" } });
    }
    if (req.method === "POST" && path === "/repos/o/r/git/refs") {
      return reply(res, 201, { ref: body?.ref });
    }
    if (req.method === "GET" && path === `/repos/o/r/contents/${FEATURES_DATA_PATH}`) {
      return reply(res, 200, { content: b64(FEATURES_FIXTURE), sha: "feat1" });
    }
    if (req.method === "GET" && path.startsWith("/repos/o/r/contents/")) {
      return reply(res, 404, { message: "Not Found" });
    }
    if (req.method === "PUT" && path.startsWith("/repos/o/r/contents/")) {
      return reply(res, 200, { content: { path } });
    }
    if (req.method === "POST" && path === "/repos/o/r/pulls") {
      return reply(res, 201, { html_url: "https://github.com/o/r/pull/7" });
    }
    return reply(res, 500, { message: `unhandled ${req.method} ${path}` });
  });
  base = await new Promise<string>((resolve) => {
    mock.listen(0, "127.0.0.1", () => {
      const a = mock.address();
      if (!a || typeof a === "string") throw new Error("no addr");
      resolve(`http://127.0.0.1:${a.port}`);
    });
  });
  process.env.GITHUB_API_BASE_URL = base;
  process.env.GITHUB_TOKEN = "test-token";
  process.env.COMMS_PLATFORM_REPO = "o/r";
});

afterEach(async () => {
  delete process.env.GITHUB_API_BASE_URL;
  delete process.env.GITHUB_TOKEN;
  delete process.env.COMMS_PLATFORM_REPO;
  // Resolve regardless: tests may already have torn the server down.
  await new Promise<void>((resolve) => mock.close(() => resolve()));
});

describe("handleEmit", () => {
  it("not configured: returns ok:false github_not_configured with zero GitHub requests", async () => {
    delete process.env.GITHUB_TOKEN;
    const result = await handleEmit(ctx(emitBody()));
    expect(result.body).toMatchObject({ ok: false, error: "github_not_configured" });
    expect(requests).toHaveLength(0);
  });

  it("derives the deterministic default branch cf-emit/<slug>-<run_id>", async () => {
    const result = await handleEmit(ctx(emitBody({ dry_run: false })));

    const refsPost = requests.find((r) => r.method === "POST" && r.url === "/repos/o/r/git/refs");
    expect(refsPost?.body).toMatchObject({ ref: "refs/heads/cf-emit/perps-launch-run_1" });
    expect(result.body).toMatchObject({
      ok: true,
      pr_url: "https://github.com/o/r/pull/7",
      branch: "cf-emit/perps-launch-run_1",
      slug: "perps-launch",
    });
  });

  it("defaults to dry-run: only GET requests, planned_diff present, pr_url null", async () => {
    const result = await handleEmit(ctx(emitBody()));

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
    const body = result.body as { ok: boolean; pr_url: unknown; planned_diff: unknown };
    expect(body.ok).toBe(true);
    expect(body.pr_url).toBeNull();
    expect(String(body.planned_diff)).toContain(BLOG_PATH);
  });

  it("returns nothing_to_emit when only x is approved", async () => {
    const result = await handleEmit(
      ctx(emitBody({ final_by_channel: { x: { text: "We shipped perps." } } })),
    );
    expect(result.body).toMatchObject({ ok: false, error: "nothing_to_emit" });
    expect(requests).toHaveLength(0);
  });

  it("threads typefully_url into the blog frontmatter PUT", async () => {
    await handleEmit(
      ctx(emitBody({ dry_run: false, typefully_url: "https://typefully.com/t/abc" })),
    );

    const blogPut = requests.find(
      (r) => r.method === "PUT" && decodeURIComponent(r.url).includes(BLOG_PATH),
    );
    expect(blogPut).toBeDefined();
    const content = Buffer.from(String(blogPut?.body?.content), "base64").toString("utf8");
    expect(content).toContain("typefullyUrl: https://typefully.com/t/abc");
  });

  it("uses an explicit cf-emit/ branch verbatim and rejects unsafe branches with 400", async () => {
    await handleEmit(ctx(emitBody({ dry_run: false, branch: "cf-emit/custom-run_1" })));
    const refsPost = requests.find((r) => r.method === "POST" && r.url === "/repos/o/r/git/refs");
    expect(refsPost?.body).toMatchObject({ ref: "refs/heads/cf-emit/custom-run_1" });

    for (const branch of ["main", "content/x"]) {
      try {
        await handleEmit(ctx(emitBody({ dry_run: false, branch })));
        expect.unreachable(`branch ${branch} should have thrown`);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpError);
        expect(e).toMatchObject({ status: 400, code: "invalid_branch" });
      }
    }
  });

  it("merges emit skips into notes: features file absent at ref => note, PR still opens", async () => {
    respondWith = (req, res) => {
      const path = decodeURIComponent(new URL(req.url ?? "/", "http://mock").pathname);
      if (req.method === "GET" && path === `/repos/o/r/contents/${FEATURES_DATA_PATH}`) {
        reply(res, 404, { message: "Not Found" });
        return true;
      }
      return false;
    };
    const result = await handleEmit(
      ctx(
        emitBody({
          dry_run: false,
          final_by_channel: {
            blog: { text: BLOG_TEXT },
            web: { text: "Perps launch / Trade perps.", candidate_id: "c1" },
          },
          candidates: [
            {
              id: "c1",
              channel: "web",
              structured: {
                kind: "web-card",
                subheading: "Trading",
                title: "Perps launch",
                caption: "Trade perps on Base.",
              },
            },
          ],
        }),
      ),
    );

    const body = result.body as { ok: boolean; pr_url: unknown; notes: string[] };
    expect(body.ok).toBe(true);
    expect(body.pr_url).toBe("https://github.com/o/r/pull/7");
    expect(body.notes).toContain(
      `${FEATURES_DATA_PATH} not found at cf-emit/perps-launch-run_1 — change skipped`,
    );
    // The skip must not vanish the rest of the PR: blog PUT happened.
    const puts = requests.filter((r) => r.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(decodeURIComponent(puts[0]?.url ?? "")).toContain(BLOG_PATH);
  });

  it("returns the typed 502 envelope when GitHub is unreachable (transport rejection)", async () => {
    await new Promise<void>((resolve) => mock.close(() => resolve()));

    const result = await handleEmit(ctx(emitBody()));
    expect(result.body).toMatchObject({
      ok: false,
      error: "github_emit_failed",
      status: 502,
      detail: "github_unreachable",
      pr_url: null,
    });
    expect(JSON.stringify(result.body)).not.toContain("test-token");
  });
});
