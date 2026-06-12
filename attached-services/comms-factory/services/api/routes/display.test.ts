import { describe, expect, it } from "vitest";
import { makeDisplayHandlers } from "./display.js";
import type { DisplayDeps } from "./display.js";

function ctx(body: unknown) {
  return {
    request: {} as never,
    method: "POST",
    url: new URL("http://x/display"),
    body,
    requestId: "t",
  };
}

const fakes: DisplayDeps = {
  displayConfigured: () => true,
  publishArtifact: async () => ({ shortId: "abc", url: "https://dsp.so/a/abc", version: 1 }),
  listComments: async () => [{ id: "c1", body: "b", textQuote: "q", createdOnVersion: 1 }],
  resolveThread: async () => {},
  deleteArtifact: async () => {},
};

// Group 1: not configured
describe("display handlers: not configured", () => {
  const notCfgDeps: DisplayDeps = {
    ...fakes,
    displayConfigured: () => false,
    publishArtifact: async () => {
      throw new Error("should not be called");
    },
    listComments: async () => {
      throw new Error("should not be called");
    },
    resolveThread: async () => {
      throw new Error("should not be called");
    },
    deleteArtifact: async () => {
      throw new Error("should not be called");
    },
  };

  it("publish returns display_not_configured without calling the dep", async () => {
    const { "/display/publish": handler } = makeDisplayHandlers(notCfgDeps);
    const result = await handler!(ctx({ markdown: "md", name: "n" }));
    expect(result.body).toMatchObject({ ok: false, error: "display_not_configured" });
  });

  it("comments returns display_not_configured without calling the dep", async () => {
    const { "/display/comments": handler } = makeDisplayHandlers(notCfgDeps);
    const result = await handler!(ctx({ short_id: "abc" }));
    expect(result.body).toMatchObject({ ok: false, error: "display_not_configured" });
  });

  it("resolve returns display_not_configured without calling the dep", async () => {
    const { "/display/resolve": handler } = makeDisplayHandlers(notCfgDeps);
    const result = await handler!(ctx({ root_comment_id: "c1" }));
    expect(result.body).toMatchObject({ ok: false, error: "display_not_configured" });
  });

  it("unpublish returns display_not_configured without calling the dep", async () => {
    const { "/display/unpublish": handler } = makeDisplayHandlers(notCfgDeps);
    const result = await handler!(ctx({ short_id: "abc" }));
    expect(result.body).toMatchObject({ ok: false, error: "display_not_configured" });
  });
});

// Group 2: publish
describe("display handlers: /display/publish", () => {
  it("creates with visibility defaulted to private and returns ok + snake_case envelope", async () => {
    let calledWith: Parameters<typeof fakes.publishArtifact>[0] | undefined;
    const deps: DisplayDeps = {
      ...fakes,
      publishArtifact: async (opts) => {
        calledWith = opts;
        return { shortId: "abc", url: "https://dsp.so/a/abc", version: 1 };
      },
    };
    const { "/display/publish": handler } = makeDisplayHandlers(deps);
    const result = await handler!(
      ctx({ markdown: "Draft body", name: "perps-launch-blog", share: ["a@x.com"] }),
    );
    expect(calledWith?.visibility).toBe("private");
    expect(calledWith?.share).toContain("a@x.com");
    expect(result.body).toMatchObject({
      ok: true,
      short_id: "abc",
      url: "https://dsp.so/a/abc",
      version: 1,
    });
  });

  it("update form: passes id + baseVersion to the dep", async () => {
    let calledWith: Parameters<typeof fakes.publishArtifact>[0] | undefined;
    const deps: DisplayDeps = {
      ...fakes,
      publishArtifact: async (opts) => {
        calledWith = opts;
        return { shortId: "abc", url: "https://dsp.so/a/abc", version: 2 };
      },
    };
    const { "/display/publish": handler } = makeDisplayHandlers(deps);
    const result = await handler!(
      ctx({ markdown: "v2 body", name: "perps-launch-blog", id: "abc", base_version: 1 }),
    );
    expect(calledWith?.id).toBe("abc");
    expect(calledWith?.baseVersion).toBe(1);
    expect(result.body).toMatchObject({ ok: true, short_id: "abc", version: 2 });
  });

  it("update form without base_version: throws HttpError 400 missing_base_version, dep not called", async () => {
    let depCalled = false;
    const deps: DisplayDeps = {
      ...fakes,
      publishArtifact: async () => {
        depCalled = true;
        return { shortId: "abc", url: "https://dsp.so/a/abc", version: 1 };
      },
    };
    const { "/display/publish": handler } = makeDisplayHandlers(deps);
    const { HttpError } = await import("../http.js");
    await expect(
      handler!(ctx({ markdown: "md", name: "n", id: "abc" })),
    ).rejects.toBeInstanceOf(HttpError);
    await expect(
      handler!(ctx({ markdown: "md", name: "n", id: "abc" })),
    ).rejects.toMatchObject({ status: 400, code: "missing_base_version" });
    expect(depCalled).toBe(false);
  });
});

// Group 3: comments
describe("display handlers: /display/comments", () => {
  it("returns ok + snake_case comments array from the dep", async () => {
    const { "/display/comments": handler } = makeDisplayHandlers(fakes);
    const result = await handler!(ctx({ short_id: "abc" }));
    expect(result.body).toMatchObject({
      ok: true,
      comments: [{ id: "c1", body: "b", text_quote: "q", created_on_version: 1 }],
    });
  });

  it("passes status filter through to the dep", async () => {
    let capturedOpts: { status?: string } | undefined;
    const deps: DisplayDeps = {
      ...fakes,
      listComments: async (_id, opts) => {
        capturedOpts = opts;
        return [];
      },
    };
    const { "/display/comments": handler } = makeDisplayHandlers(deps);
    await handler!(ctx({ short_id: "abc", status: "resolved" }));
    expect(capturedOpts?.status).toBe("resolved");
  });
});

// Group 4: resolve (idempotent)
describe("display handlers: /display/resolve", () => {
  it("resolves a thread and returns ok:true", async () => {
    let calledWith: string | undefined;
    const deps: DisplayDeps = {
      ...fakes,
      resolveThread: async (id) => {
        calledWith = id;
      },
    };
    const { "/display/resolve": handler } = makeDisplayHandlers(deps);
    const result = await handler!(ctx({ root_comment_id: "c1" }));
    expect(calledWith).toBe("c1");
    expect(result.body).toMatchObject({ ok: true });
  });

  it("idempotent: a dep throwing 'already resolved' still returns ok:true", async () => {
    const deps: DisplayDeps = {
      ...fakes,
      resolveThread: async () => {
        throw new Error("already resolved");
      },
    };
    const { "/display/resolve": handler } = makeDisplayHandlers(deps);
    const result = await handler!(ctx({ root_comment_id: "c1" }));
    expect(result.body).toMatchObject({ ok: true });
  });
});

// Group 5: unpublish (idempotent)
describe("display handlers: /display/unpublish", () => {
  it("deletes the artifact and returns ok:true", async () => {
    let calledWith: string | undefined;
    const deps: DisplayDeps = {
      ...fakes,
      deleteArtifact: async (id) => {
        calledWith = id;
      },
    };
    const { "/display/unpublish": handler } = makeDisplayHandlers(deps);
    const result = await handler!(ctx({ short_id: "abc" }));
    expect(calledWith).toBe("abc");
    expect(result.body).toMatchObject({ ok: true });
  });

  it("idempotent: a dep throwing 'not found' still returns ok:true", async () => {
    const deps: DisplayDeps = {
      ...fakes,
      deleteArtifact: async () => {
        throw new Error("not found");
      },
    };
    const { "/display/unpublish": handler } = makeDisplayHandlers(deps);
    const result = await handler!(ctx({ short_id: "abc" }));
    expect(result.body).toMatchObject({ ok: true });
  });
});

// Group 6: missing required fields
describe("display handlers: missing required fields", () => {
  it("publish: missing markdown throws HttpError 400 missing_markdown", async () => {
    const { HttpError } = await import("../http.js");
    const { "/display/publish": handler } = makeDisplayHandlers(fakes);
    await expect(handler!(ctx({ name: "n" }))).rejects.toBeInstanceOf(HttpError);
    await expect(handler!(ctx({ name: "n" }))).rejects.toMatchObject({
      status: 400,
      code: "missing_markdown",
    });
  });

  it("publish: missing name throws HttpError 400 missing_name", async () => {
    const { HttpError } = await import("../http.js");
    const { "/display/publish": handler } = makeDisplayHandlers(fakes);
    await expect(handler!(ctx({ markdown: "md" }))).rejects.toBeInstanceOf(HttpError);
    await expect(handler!(ctx({ markdown: "md" }))).rejects.toMatchObject({
      status: 400,
      code: "missing_name",
    });
  });

  it("comments: missing short_id throws HttpError 400 missing_short_id", async () => {
    const { HttpError } = await import("../http.js");
    const { "/display/comments": handler } = makeDisplayHandlers(fakes);
    await expect(handler!(ctx({}))).rejects.toBeInstanceOf(HttpError);
    await expect(handler!(ctx({}))).rejects.toMatchObject({
      status: 400,
      code: "missing_short_id",
    });
  });

  it("resolve: missing root_comment_id throws HttpError 400 missing_root_comment_id", async () => {
    const { HttpError } = await import("../http.js");
    const { "/display/resolve": handler } = makeDisplayHandlers(fakes);
    await expect(handler!(ctx({}))).rejects.toBeInstanceOf(HttpError);
    await expect(handler!(ctx({}))).rejects.toMatchObject({
      status: 400,
      code: "missing_root_comment_id",
    });
  });

  it("unpublish: missing short_id throws HttpError 400 missing_short_id", async () => {
    const { HttpError } = await import("../http.js");
    const { "/display/unpublish": handler } = makeDisplayHandlers(fakes);
    await expect(handler!(ctx({}))).rejects.toBeInstanceOf(HttpError);
    await expect(handler!(ctx({}))).rejects.toMatchObject({
      status: 400,
      code: "missing_short_id",
    });
  });
});
