import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleTypefullyDraft } from "./typefully-draft.js";

// Fake RequestContext for direct handler invocation.
function ctx(body: unknown) {
  return {
    request: {} as never,
    method: "POST",
    url: new URL("http://x/typefully-draft"),
    body,
    requestId: "t",
  };
}

// --- Mock Typefully server (same pattern as src/__tests__/typefully.test.ts) ---
let mock: ReturnType<typeof createServer>;
let requests: Array<{ url: string | undefined; method: string | undefined; body: unknown }>;
let base = "";
// Hook for tests that need non-default responses.
let respondWith: ((req: IncomingMessage, res: ServerResponse) => boolean) | null = null;

beforeEach(async () => {
  requests = [];
  respondWith = null;
  mock = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    requests.push({ url: req.url, method: req.method, body });
    if (respondWith?.(req, res)) return;
    if (req.url === "/v2/social-sets") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ id: 7, name: "Infinex" }, { id: 9, name: "Test Set" }]));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: 42, status: "draft", share_url: "https://typefully.com/t/abc" }));
  });
  base = await new Promise<string>((resolve) => {
    mock.listen(0, "127.0.0.1", () => {
      const a = mock.address();
      if (!a || typeof a === "string") throw new Error("no addr");
      resolve(`http://127.0.0.1:${a.port}`);
    });
  });
  process.env.TYPEFULLY_BASE_URL = base;
  process.env.TYPEFULLY_API_KEY = "tf-test-key";
  delete process.env.TYPEFULLY_SOCIAL_SET;
});

afterEach(async () => {
  delete process.env.TYPEFULLY_BASE_URL;
  delete process.env.TYPEFULLY_API_KEY;
  delete process.env.TYPEFULLY_SOCIAL_SET;
  await new Promise<void>((resolve, reject) => mock.close((e) => (e ? reject(e) : resolve())));
});

describe("handleTypefullyDraft", () => {
  it("not configured: returns ok:false when TYPEFULLY_API_KEY is unset, and no fetch happens", async () => {
    delete process.env.TYPEFULLY_API_KEY;
    const result = await handleTypefullyDraft(ctx({ channel: "x", text: "hi" }));
    expect(result.body).toMatchObject({ ok: false, error: "typefully_not_configured" });
    // No network calls should have been made.
    expect(requests).toHaveLength(0);
  });

  it("solo x: creates a draft and returns channel, draft_id, share_url, draft_url", async () => {
    const result = await handleTypefullyDraft(
      ctx({ channel: "x", text: "One post.", title: "T", scratchpad: "run r1" }),
    );
    // Mock received one posts entry.
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect(draft?.method).toBe("POST");
    expect(
      (draft?.body as { platforms: { x: { posts: { text: string }[] } } }).platforms.x.posts,
    ).toEqual([{ text: "One post." }]);
    expect(result.body).toMatchObject({
      ok: true,
      channel: "x",
      draft_id: 42,
      share_url: "https://typefully.com/t/abc",
      draft_url: "https://typefully.com/?a=7&d=42",
    });
  });

  it("thread: body tweets[] sends two posts entries in order", async () => {
    const result = await handleTypefullyDraft(
      ctx({ channel: "x-thread", tweets: ["t1", "t2"] }),
    );
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect(
      (draft?.body as { platforms: { x: { posts: { text: string }[] } } }).platforms.x.posts,
    ).toEqual([{ text: "t1" }, { text: "t2" }]);
    expect(result.body).toMatchObject({ ok: true, channel: "x-thread", draft_id: 42 });
  });

  it("missing text/tweets: throws HttpError 400 missing_text", async () => {
    const { HttpError } = await import("../http.js");
    await expect(
      handleTypefullyDraft(ctx({ channel: "x" })),
    ).rejects.toMatchObject({ status: 400, code: "missing_text" });
    await expect(handleTypefullyDraft(ctx({ channel: "x" }))).rejects.toBeInstanceOf(HttpError);
  });

  it("social-set resolution failure: returns ok:false error:typefully_not_configured", async () => {
    process.env.TYPEFULLY_SOCIAL_SET = "Nope";
    const result = await handleTypefullyDraft(ctx({ channel: "x", text: "hi" }));
    expect(result.body).toMatchObject({ ok: false, error: "typefully_not_configured" });
  });

  it("upstream 5xx: returns ok:false error:typefully_draft_failed without leaking the API key", async () => {
    const key = "tf-test-key";
    // The social-sets call succeeds; only the drafts POST fails with 500.
    respondWith = (req, res) => {
      if (req.url?.startsWith("/v2/social-sets/") && req.method === "POST") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: `server error, key=${key}` }));
        return true;
      }
      return false;
    };
    const result = await handleTypefullyDraft(ctx({ channel: "x", text: "hi" }));
    expect(result.body).toMatchObject({ ok: false, error: "typefully_draft_failed" });
    // The API key must not appear anywhere in the response body.
    expect(JSON.stringify(result.body)).not.toContain(key);
  });
});
