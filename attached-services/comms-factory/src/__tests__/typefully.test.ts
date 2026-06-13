import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTypefullyDraft } from "../typefully.js";

let mock: ReturnType<typeof createServer>;
let requests: Array<{ url: string | undefined; method: string | undefined; body: unknown }>;
let base = "";
// Tests may set this to intercept requests before default handler runs.
// Return true = request fully handled; return false = fall through to default.
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

describe("createTypefullyDraft", () => {
  it("creates a solo draft with share + scratchpad and never sets publish_at", async () => {
    const result = await createTypefullyDraft(["One post."], {
      title: "Launch X",
      scratchpad: "run run_1 · Launch X",
    });
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect(draft?.method).toBe("POST");
    expect(draft?.body).toMatchObject({
      platforms: { x: { enabled: true, posts: [{ text: "One post." }] } },
      share: true,
      draft_title: "Launch X",
      scratchpad_text: "run run_1 · Launch X",
    });
    expect(JSON.stringify(draft?.body)).not.toContain("publish_at");
    expect(result).toMatchObject({
      draftId: 42,
      socialSetId: 7,
      count: 1,
      shareUrl: "https://typefully.com/t/abc",
      draftUrl: "https://typefully.com/?a=7&d=42",
    });
  });

  it("maps a thread 1:1 — one posts[] entry per tweet, order preserved", async () => {
    await createTypefullyDraft(["t1", "t2", "t3"], {});
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect((draft?.body as { platforms: { x: { posts: { text: string }[] } } }).platforms.x.posts)
      .toEqual([{ text: "t1" }, { text: "t2" }, { text: "t3" }]);
  });

  it("resolves TYPEFULLY_SOCIAL_SET by name", async () => {
    process.env.TYPEFULLY_SOCIAL_SET = "Test Set";
    const result = await createTypefullyDraft(["x"], {});
    expect(result.socialSetId).toBe(9);
  });

  it("sends the key as a Bearer header only — never in the URL", async () => {
    await createTypefullyDraft(["x"], {});
    for (const r of requests) expect(r.url).not.toContain("tf-test-key");
  });

  it("throws a typed not-configured error when the key is absent", async () => {
    delete process.env.TYPEFULLY_API_KEY;
    await expect(createTypefullyDraft(["x"], {})).rejects.toThrow("typefully_not_configured");
  });

  it("filters empty/whitespace tweets and rejects if all are empty", async () => {
    // Non-empty tweets survive — whitespace trimmed but non-empty pass
    await createTypefullyDraft(["  hello  ", "", "  "], {});
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect((draft?.body as { platforms: { x: { posts: { text: string }[] } } }).platforms.x.posts)
      .toEqual([{ text: "hello" }]);

    // All-empty input rejects with typefully_no_posts
    await expect(createTypefullyDraft(["", "   "], {})).rejects.toThrow("typefully_no_posts");
  });

  it("throws typefully_social_set_not_found when social set name has no match", async () => {
    process.env.TYPEFULLY_SOCIAL_SET = "NonExistentSet";
    await expect(createTypefullyDraft(["x"], {})).rejects.toThrow("typefully_social_set_not_found");
  });

  it("sanitizes the API key from a 401 error body before throwing", async () => {
    const key = "tf-test-key";
    // Use the respondWith hook to serve a 401 with the key in the body for the
    // drafts POST only; social-sets falls through to the default handler.
    respondWith = (req, res) => {
      if (req.url?.startsWith("/v2/social-sets/") && req.method === "POST") {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: `Invalid key: ${key}` }));
        return true;
      }
      return false;
    };

    let caughtMessage = "";
    try {
      await createTypefullyDraft(["x"], {});
    } catch (error) {
      caughtMessage = error instanceof Error ? error.message : String(error);
    }

    expect(caughtMessage).not.toContain(key);
    expect(caughtMessage).toContain("[redacted]");
    expect(caughtMessage).toContain("typefully_http_401");
  });
});
