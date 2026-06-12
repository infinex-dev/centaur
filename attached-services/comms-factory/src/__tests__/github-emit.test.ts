import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendFeatureCopyEntry, BLOG_DIR, FEATURES_DATA_PATH } from "../emit-platform-pr.js";
import { emitViaRest, type GithubEmitOptions } from "../github-emit.js";
import type { EmitPackage } from "../launch-package.js";

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
// Return true = request fully handled; return false = fall through.
let respondWith: ((req: IncomingMessage, res: ServerResponse) => boolean) | null = null;
// Queue of responses for GET /repos/o/r/pulls?head=... — one entry consumed per
// call (pre-flight, then the 422-fallback re-fetch). Empty queue => [].
let pullsQueue: unknown[];
// Content served for the features data.ts contents GET.
let featuresContent: string;

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

const CHANGELOG_MD = [
  "---",
  'title: "Launch X"',
  "date: 2026-06-12",
  "published: true",
  "category: changelogs",
  "---",
  "",
  "Launch X is live.",
  "",
].join("\n");

const FEATURE_ENTRY = '{\n  title: "Launch X",\n  description: "Launch X is live.",\n},';

const BLOG_PATH = `${BLOG_DIR}/launch-x.md`;

function fixturePkg(): EmitPackage {
  return {
    changelogSlug: "launch-x",
    changelogMd: CHANGELOG_MD,
    featureCard: { dataTsEntry: FEATURE_ENTRY },
  };
}

function emitOpts(overrides: Partial<GithubEmitOptions> = {}): GithubEmitOptions {
  return {
    token: "test-token",
    repo: "o/r",
    branch: "cf-emit/launch-x-run1",
    dryRun: false,
    baseUrl: base,
    ...overrides,
  };
}

function reply(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

beforeEach(async () => {
  requests = [];
  respondWith = null;
  pullsQueue = [];
  featuresContent = FEATURES_FIXTURE;
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
      return reply(res, 200, pullsQueue.shift() ?? []);
    }
    if (req.method === "GET" && path === "/repos/o/r/git/ref/heads/main") {
      return reply(res, 200, { object: { sha: "base123" } });
    }
    if (req.method === "POST" && path === "/repos/o/r/git/refs") {
      return reply(res, 201, { ref: body?.ref });
    }
    if (req.method === "GET" && path === `/repos/o/r/contents/${FEATURES_DATA_PATH}`) {
      return reply(res, 200, { content: b64(featuresContent), sha: "feat1" });
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
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => mock.close((e) => (e ? reject(e) : resolve())));
});

describe("emitViaRest", () => {
  it("dry-run returns a plannedDiff naming both target paths and performs ZERO mutations", async () => {
    const result = await emitViaRest(fixturePkg(), emitOpts({ dryRun: true }));

    expect(result.ok).toBe(true);
    expect(result.prUrl).toBeNull();
    expect(result.plannedDiff).toContain(BLOG_PATH);
    expect(result.plannedDiff).toContain(FEATURES_DATA_PATH);
    expect(result.plannedDiff).toContain('+title: "Launch X"');

    const mutations = requests.filter((r) => r.method !== "GET");
    expect(mutations).toEqual([]);
    // Dry-run reads from main, never from the branch.
    for (const r of requests.filter((r) => r.url.includes("/contents/"))) {
      expect(r.url).toContain("ref=main");
    }
  });

  it("happy path: reads-then-writes request order, blob shas, header-only token", async () => {
    const result = await emitViaRest(fixturePkg(), emitOpts());

    const seq = requests.map((r) => `${r.method} ${decodeURIComponent(r.url)}`);
    expect(seq).toEqual([
      "GET /repos/o/r/pulls?head=o:cf-emit/launch-x-run1&state=open",
      "GET /repos/o/r/git/ref/heads/main",
      "POST /repos/o/r/git/refs",
      `GET /repos/o/r/contents/${BLOG_PATH}?ref=cf-emit/launch-x-run1`,
      `GET /repos/o/r/contents/${FEATURES_DATA_PATH}?ref=cf-emit/launch-x-run1`,
      `PUT /repos/o/r/contents/${BLOG_PATH}`,
      `PUT /repos/o/r/contents/${FEATURES_DATA_PATH}`,
      "POST /repos/o/r/pulls",
    ]);

    const refsPost = requests.find((r) => r.url === "/repos/o/r/git/refs");
    expect(refsPost?.body).toEqual({ ref: "refs/heads/cf-emit/launch-x-run1", sha: "base123" });

    const blogPut = requests.find(
      (r) => r.method === "PUT" && decodeURIComponent(r.url).includes(BLOG_PATH),
    );
    expect(blogPut?.body).toMatchObject({
      branch: "cf-emit/launch-x-run1",
      content: b64(CHANGELOG_MD),
      message: `Emit launch-x launch comms: ${BLOG_PATH}`,
    });
    expect(blogPut?.body && "sha" in blogPut.body).toBe(false); // new file => NO sha

    const featuresPut = requests.find(
      (r) => r.method === "PUT" && decodeURIComponent(r.url).includes(FEATURES_DATA_PATH),
    );
    expect(featuresPut?.body).toMatchObject({ branch: "cf-emit/launch-x-run1", sha: "feat1" });
    const putContent = Buffer.from(String(featuresPut?.body?.content), "base64").toString("utf8");
    expect(putContent).toContain('title: "Launch X"');

    const prPost = requests.find((r) => r.method === "POST" && r.url === "/repos/o/r/pulls");
    expect(prPost?.body).toMatchObject({
      title: "Launch X",
      head: "cf-emit/launch-x-run1",
      base: "main",
    });
    expect(String(prPost?.body?.body)).toContain("human-approve, DO NOT merge");

    expect(result).toMatchObject({ ok: true, prUrl: "https://github.com/o/r/pull/7" });
    expect(result.existing).toBeUndefined();

    for (const r of requests) {
      expect(r.authorization).toBe("Bearer test-token");
      expect(r.url).not.toContain("test-token");
    }
  });

  it("pre-flight short-circuits on an existing open PR with exactly ONE request", async () => {
    pullsQueue = [[{ html_url: "https://github.com/o/r/pull/5" }]];

    const result = await emitViaRest(fixturePkg(), emitOpts());

    expect(result).toMatchObject({
      ok: true,
      prUrl: "https://github.com/o/r/pull/5",
      existing: true,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
  });

  it("tolerates 422 'Reference already exists' on ref create and continues", async () => {
    respondWith = (req, res) => {
      if (req.method === "POST" && req.url === "/repos/o/r/git/refs") {
        reply(res, 422, { message: "Reference already exists" });
        return true;
      }
      return false;
    };

    const result = await emitViaRest(fixturePkg(), emitOpts());

    expect(result).toMatchObject({ ok: true, prUrl: "https://github.com/o/r/pull/7" });
    expect(requests.filter((r) => r.method === "PUT")).toHaveLength(2);
    expect(
      requests.filter((r) => r.method === "POST" && r.url === "/repos/o/r/pulls"),
    ).toHaveLength(1);
  });

  it("falls back to GET pulls?head when PR create 422s with 'already exists'", async () => {
    pullsQueue = [[], [{ html_url: "https://github.com/o/r/pull/9" }]];
    respondWith = (req, res) => {
      if (req.method === "POST" && req.url === "/repos/o/r/pulls") {
        reply(res, 422, {
          message: "Validation Failed",
          errors: [{ message: "A pull request already exists for o:cf-emit/launch-x-run1." }],
        });
        return true;
      }
      return false;
    };

    const result = await emitViaRest(fixturePkg(), emitOpts());

    expect(result).toMatchObject({
      ok: true,
      prUrl: "https://github.com/o/r/pull/9",
      existing: true,
    });
    const pullsGets = requests.filter((r) => r.method === "GET" && r.url.includes("/pulls?head="));
    expect(pullsGets).toHaveLength(2);
  });

  it("maps a 403 PUT to github_permission_denied and never leaks the token", async () => {
    respondWith = (req, res) => {
      if (req.method === "PUT") {
        reply(res, 403, { message: "Resource not accessible by integration" });
        return true;
      }
      return false;
    };

    const result = await emitViaRest(fixturePkg(), emitOpts());

    expect(result).toMatchObject({
      ok: false,
      error: "github_permission_denied",
      status: 403,
      prUrl: null,
    });
    expect(JSON.stringify(result)).not.toContain("test-token");
    // No PR is opened after a failed PUT.
    expect(
      requests.filter((r) => r.method === "POST" && r.url === "/repos/o/r/pulls"),
    ).toHaveLength(0);
  });

  it("skips the features PUT when the branch content already carries the entry (replay)", async () => {
    // The branch fixture must be the entry AS appendFeatureCopyEntry WOULD HAVE
    // written it — the real splice re-indents every line, so a raw-pasted entry
    // would not exercise the replay path the way a crash-retry actually sees it.
    featuresContent = appendFeatureCopyEntry(FEATURES_FIXTURE, FEATURE_ENTRY);

    const result = await emitViaRest(fixturePkg(), emitOpts());

    expect(result.ok).toBe(true);
    const puts = requests.filter((r) => r.method === "PUT");
    expect(puts).toHaveLength(1); // blog only — features PUT absent
    expect(decodeURIComponent(puts[0]?.url ?? "")).toContain(BLOG_PATH);
    expect(
      requests.filter((r) => r.method === "POST" && r.url === "/repos/o/r/pulls"),
    ).toHaveLength(1);
  });

  it("writes the features PUT when the branch content lacks the entry's title marker", async () => {
    // Negative: an unrelated entry on the branch must NOT trip the replay skip.
    featuresContent = appendFeatureCopyEntry(
      FEATURES_FIXTURE,
      '{\n  title: "Something Else",\n  description: "Not our launch.",\n},',
    );

    const result = await emitViaRest(fixturePkg(), emitOpts());

    expect(result.ok).toBe(true);
    const puts = requests.filter((r) => r.method === "PUT");
    expect(puts).toHaveLength(2); // blog AND features
    const featuresPut = puts.find(
      (r) => decodeURIComponent(r.url).includes(FEATURES_DATA_PATH),
    );
    expect(featuresPut).toBeDefined();
    const putContent = Buffer.from(String(featuresPut?.body?.content), "base64").toString("utf8");
    expect(putContent).toContain('title: "Launch X"');
    expect(putContent).toContain('title: "Something Else"');
  });

  it("encodes paths per segment: '(site)' stays raw, spaces/specials escape", async () => {
    const pkg = fixturePkg();
    pkg.changelogSlug = "launch x+plus";

    const result = await emitViaRest(pkg, emitOpts({ dryRun: true }));
    expect(result.ok).toBe(true);

    const featuresGet = requests.find((r) => r.url.includes("features/data.ts"));
    expect(featuresGet?.url).toContain(
      "/repos/o/r/contents/apps/public-website/src/app/(site)/features/data.ts",
    );
    expect(featuresGet?.url).not.toContain("%28"); // parens not double-encoded

    const blogGet = requests.find((r) => r.url.includes(`/contents/${BLOG_DIR}/`));
    expect(blogGet?.url).toContain("launch%20x%2Bplus.md"); // space + plus escaped
  });
});
