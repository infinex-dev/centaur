import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deleteArtifact,
  listComments,
  publishArtifact,
  redactDisplayKey,
  resolveThread,
  stripFrontmatter,
  type DspRunner,
} from "../display.js";

// Probed contract (v0.26.0, 2026-06-12): the dsp CLI has NO --json flag on
// publish/comment/thread/delete. publish prints two human lines (url, then
// "Published|Updated <name> (<shortId>) v<n>"); comment list / thread resolve
// natively print pretty JSON ({ data: [...] } wrapper); delete prints
// "Deleted <name> (<shortId>)". `publish -` (stdin) REQUIRES --id, so the
// create path publishes a temp .md file by path instead.

function fakeRunner(stdout: string): {
  runner: DspRunner;
  calls: Array<{ args: readonly string[]; stdin?: string }>;
} {
  const calls: Array<{ args: readonly string[]; stdin?: string }> = [];
  return {
    calls,
    runner: async (args, opts) => {
      calls.push({ args, ...(opts?.stdin !== undefined ? { stdin: opts.stdin } : {}) });
      return { stdout, stderr: "" };
    },
  };
}

const PUBLISH_V1_STDOUT = "https://infinex.dsp.so/a/abc123\nPublished perps-launch-blog (abc123) v1\n";
const PUBLISH_V2_STDOUT = "https://infinex.dsp.so/a/abc123\nUpdated perps-launch-blog (abc123) v2\n";

describe("stripFrontmatter", () => {
  it("removes a leading YAML block (display renders it literally)", () => {
    expect(stripFrontmatter("---\ntitle: x\n---\n\nBody")).toBe("Body");
    expect(stripFrontmatter("No frontmatter")).toBe("No frontmatter");
  });
});

describe("publishArtifact", () => {
  it("publishes v1 private via a temp .md path (stdin requires --id), reviewer allowlist, no key in argv", async () => {
    // `dsp publish -` exits 2 without --id, so the create path must hand the
    // CLI a real file path; capture its content at call time (it is deleted after).
    const calls: Array<{ args: readonly string[]; stdin?: string; fileContent?: string }> = [];
    const runner: DspRunner = async (args, opts) => {
      calls.push({
        args,
        ...(opts?.stdin !== undefined ? { stdin: opts.stdin } : {}),
        fileContent: readFileSync(String(args[1]), "utf8"),
      });
      return { stdout: PUBLISH_V1_STDOUT, stderr: "" };
    };
    const result = await publishArtifact(
      { markdown: "---\ntitle: t\n---\n\nDraft body", name: "perps-launch-blog", share: ["a@x.com", "b@x.com"] },
      runner,
    );
    expect(calls[0]?.args[0]).toBe("publish");
    expect(calls[0]?.args[1]).toMatch(/\.md$/); // temp file path, .md drives format detection
    expect(calls[0]?.args[1]).not.toBe("-");
    expect(calls[0]?.args).toContain("--visibility");
    expect(calls[0]?.args).toContain("private");
    expect(calls[0]?.args.join(" ")).toContain("--theme github");
    expect(calls[0]?.args.join(" ")).toContain("--share a@x.com");
    expect(calls[0]?.args.join(" ")).toContain("--share b@x.com");
    expect(calls[0]?.stdin).toBeUndefined();
    expect(calls[0]?.fileContent).toBe("Draft body"); // frontmatter stripped
    expect(calls[0]?.args.join(" ")).not.toContain("sk_live"); // env-auth only
    expect(result).toEqual({ shortId: "abc123", url: "https://infinex.dsp.so/a/abc123", version: 1 });
  });

  it("updates the same artifact via stdin with --id --base-version --reload", async () => {
    const { runner, calls } = fakeRunner(PUBLISH_V2_STDOUT);
    const result = await publishArtifact({ markdown: "v2", name: "n", id: "abc123", baseVersion: 1 }, runner);
    expect(calls[0]?.args.slice(0, 2)).toEqual(["publish", "-"]);
    expect(calls[0]?.args.join(" ")).toContain("--id abc123");
    expect(calls[0]?.args.join(" ")).toContain("--base-version 1");
    expect(calls[0]?.args).toContain("--reload");
    expect(calls[0]?.stdin).toBe("v2");
    expect(result).toEqual({ shortId: "abc123", url: "https://infinex.dsp.so/a/abc123", version: 2 });
  });

  it("throws (redacted) on output that does not match the publish contract", async () => {
    process.env.DISPLAYDEV_API_KEY = "sk_live_secret";
    try {
      const { runner } = fakeRunner('{"previewUrl":"x sk_live_secret"}\n'); // anonymous-path shape
      await expect(
        publishArtifact({ markdown: "v2", name: "n", id: "abc123", baseVersion: 1 }, runner),
      ).rejects.toThrow(/unexpected dsp publish output(?!.*sk_live_secret)/);
    } finally {
      delete process.env.DISPLAYDEV_API_KEY;
    }
  });
});

describe("listComments", () => {
  it("parses the { data: [...] } wrapper into {id, body, textQuote, createdOnVersion}", async () => {
    // Real shape captured from the 2026-06-11 trial: textQuote is an object
    // ({ exact, prefix, suffix }) and createdOnVersion is a STRING.
    const { runner, calls } = fakeRunner(
      JSON.stringify(
        {
          data: [
            {
              id: "c1",
              parentId: null,
              anchor: { cssPath: "h3", textQuote: { exact: "perps are live", prefix: "", suffix: "" } },
              body: "tighten this",
              createdOnVersion: "1",
              replies: [],
            },
          ],
          nextCursor: null,
          totalCount: 1,
        },
        null,
        2,
      ),
    );
    const comments = await listComments("abc123", { status: "open" }, runner);
    expect(calls[0]?.args.join(" ")).toContain("comment list --artifact abc123 --status open");
    expect(calls[0]?.args).not.toContain("--json"); // no such flag in v0.26.0
    expect(comments).toEqual([{ id: "c1", body: "tighten this", textQuote: "perps are live", createdOnVersion: 1 }]);
  });

  it("returns [] for an empty thread list", async () => {
    const { runner } = fakeRunner(JSON.stringify({ data: [], nextCursor: null, totalCount: 0 }));
    expect(await listComments("abc123", {}, runner)).toEqual([]);
  });
});

describe("resolveThread / deleteArtifact", () => {
  it("resolves a thread and deletes with --confirm", async () => {
    const a = fakeRunner(JSON.stringify({ data: { id: "c1", resolvedAt: "2026-06-12T00:00:00Z" } }, null, 2));
    await resolveThread("c1", a.runner);
    expect(a.calls[0]?.args.join(" ")).toContain("thread resolve c1");
    const b = fakeRunner("Deleted perps-launch-blog (abc123)\n");
    await deleteArtifact("abc123", b.runner);
    expect(b.calls[0]?.args.join(" ")).toContain("delete abc123 --confirm");
  });
});

describe("redactDisplayKey", () => {
  it("strips the API key from CLI output before it can reach an Error message", () => {
    process.env.DISPLAYDEV_API_KEY = "sk_live_secret";
    try {
      expect(redactDisplayKey("auth failed for sk_live_secret (expired)")).toBe(
        "auth failed for [redacted] (expired)",
      );
    } finally {
      delete process.env.DISPLAYDEV_API_KEY;
    }
  });
});
