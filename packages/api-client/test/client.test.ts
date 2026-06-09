import { afterEach, describe, expect, it, vi } from "vitest";

import { CentaurClient, type StreamEvent } from "../src/client";
import type { ToolResult } from "../src/types";

const ENVELOPE: ToolResult = {
  schema_version: "centaur.tool_result.v1",
  ok: true,
  content: "ev_abc — infinex-platform@sha:src/x.ts",
  text: "ev_abc — infinex-platform@sha:src/x.ts",
  output: { matches: 1 },
  evidence: [
    {
      schema_version: "centaur.evidence_item.v1",
      id: "ev_abc",
      source: "repo.search",
      source_ref: "infinex-platform@sha:src/x.ts",
    },
  ],
  error: null,
  retryable: false,
};

async function collectEvents(events: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const collected: StreamEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

function sseResponse(body: string, init?: ResponseInit): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      ...init,
    },
  );
}

describe("CentaurClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses SSE ids, events, JSON data, [DONE], and invalid JSON payloads", async () => {
    const fetchMock = vi.fn(async () => sseResponse([
      "id: 11",
      "event: amp_raw_event",
      'data: {"type":"assistant","message":{"content":"hello"}}',
      "",
      "id: 12",
      "event: done",
      "data: [DONE]",
      "",
      "id: 13",
      "data: not-json",
      "",
      "",
    ].join("\n")));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CentaurClient({
      apiUrl: "http://api.local",
      apiKey: "test-key",
    });

    await expect(collectEvents(client.streamEvents({ threadKey: "thread-1" }))).resolves.toEqual([
      {
        eventId: 11,
        eventKind: "amp_raw_event",
        data: { type: "assistant", message: { content: "hello" } },
      },
      {
        eventId: 13,
        eventKind: "message",
        data: { type: "unknown", raw: "not-json" },
      },
    ]);
  });

  it("URL encodes Slack thread keys in event stream URLs", async () => {
    const fetchMock = vi.fn(async () => sseResponse(""));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CentaurClient({
      apiUrl: "http://api.local",
      apiKey: "test-key",
    });

    await collectEvents(client.streamEvents({
      threadKey: "slack:C123:1700000000.000100",
      executionId: "exe-1",
      afterEventId: 42,
      pollMs: 250,
    }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.local/agent/threads/slack%3AC123%3A1700000000.000100/events?after_event_id=42&execution_id=exe-1&poll_ms=250",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-key",
          "X-Centaur-Thread-Key": "slack:C123:1700000000.000100",
        },
      }),
    );
  });

  it("URL encodes Slack thread keys in path-based API calls", async () => {
    const client = new CentaurClient({
      apiUrl: "http://api.local",
      apiKey: "test-key",
    });
    const getMock = vi.spyOn(client.http, "get").mockResolvedValue({
      data: { thread_key: "slack:C123:1700000000.000100", executions: [] },
    });
    const postMock = vi.spyOn(client.http, "post").mockResolvedValue({ data: { ok: true } });

    await client.listExecutions("slack:C123:1700000000.000100", 2);
    await client.releaseThread("slack:C123:1700000000.000100", {
      releaseId: "release:1",
      cancelInflight: true,
    });

    expect(getMock).toHaveBeenCalledWith(
      "/agent/threads/slack%3AC123%3A1700000000.000100/executions",
      { params: { limit: 2 } },
    );
    expect(postMock).toHaveBeenCalledWith(
      "/agent/threads/slack%3AC123%3A1700000000.000100/release",
      {
        release_id: "release:1",
        cancel_inflight: true,
      },
    );
  });

  it("throws useful errors for non-OK event stream responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "upstream unavailable",
      { status: 503, statusText: "Service Unavailable" },
    )));
    const client = new CentaurClient({
      apiUrl: "http://api.local",
      apiKey: "test-key",
    });

    await expect(
      collectEvents(client.streamEvents({ threadKey: "slack:C123:1700000000.000100" })),
    ).rejects.toThrow(
      "/agent/threads/{thread}/events failed (503): upstream unavailable",
    );
  });

  it("posts the expected steerExecution payload", async () => {
    const client = new CentaurClient({
      apiUrl: "http://api.local",
      apiKey: "test-key",
    });
    const postMock = vi.spyOn(client.http, "post").mockResolvedValue({ data: { ok: true } });

    await client.steerExecution("exe:123", {
      contentBlocks: [{ type: "text", text: "replacement" }],
      messageId: "slack:1700000000.000200",
      userId: "U123",
      metadata: { platform: "slack" },
      suppressCancellationDelivery: true,
    });

    expect(postMock).toHaveBeenCalledWith(
      "/agent/executions/exe%3A123/steer",
      {
        content_blocks: [{ type: "text", text: "replacement" }],
        message_id: "slack:1700000000.000200",
        user_id: "U123",
        metadata: {
          platform: "slack",
          steer_replacement: true,
        },
      },
    );
  });

  it("posts the expected final-delivery payloads", async () => {
    const client = new CentaurClient({
      apiUrl: "http://api.local",
      apiKey: "test-key",
    });
    const postMock = vi.spyOn(client.http, "post").mockResolvedValue({ data: { ok: true, deliveries: [] } });

    await client.claimFinalDeliveries({
      consumerId: "slackbot-1",
      limit: 3,
      leaseSeconds: 120,
      platform: "slack",
    });
    await client.renewFinalDeliveryLease("exe:123", {
      consumerId: "slackbot-1",
      leaseSeconds: 90,
    });
    await client.markFinalDelivered("exe:123", "slackbot-1");
    await client.markFinalFailed("exe:123", "rate limited", {
      consumerId: "slackbot-1",
      retryAfterSeconds: 45,
      nonRetryable: true,
      errorClass: "slack_rate_limit",
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/agent/final-deliveries/claim",
      {
        consumer_id: "slackbot-1",
        limit: 3,
        lease_seconds: 120,
        platform: "slack",
      },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/agent/final-deliveries/exe%3A123/heartbeat",
      {
        consumer_id: "slackbot-1",
        lease_seconds: 90,
      },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      "/agent/final-deliveries/exe%3A123/delivered",
      { consumer_id: "slackbot-1" },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      4,
      "/agent/final-deliveries/exe%3A123/failed",
      {
        consumer_id: "slackbot-1",
        error: "rate limited",
        retry_after_seconds: 45,
        non_retryable: true,
        error_class: "slack_rate_limit",
      },
    );
  });

  describe("callTool", () => {
    function client() {
      return new CentaurClient({ apiUrl: "http://api.local", apiKey: "test-key" });
    }

    it("posts raw input to /tools/{tool}/{method} and returns the envelope incl. evidence", async () => {
      const c = client();
      const postMock = vi
        .spyOn(c.http, "post")
        .mockResolvedValue({ status: 200, data: ENVELOPE });

      const result = await c.callTool("repo_context", "search", { query: "foo", repo: "infinex-platform" });

      expect(postMock).toHaveBeenCalledWith(
        "/tools/repo_context/search",
        { query: "foo", repo: "infinex-platform" },
        expect.objectContaining({ headers: {}, validateStatus: expect.any(Function) }),
      );
      expect(result).toEqual(ENVELOPE);
      expect(result.evidence[0]?.id).toBe("ev_abc");
    });

    it("URL-encodes tool/method segments", async () => {
      const c = client();
      const postMock = vi.spyOn(c.http, "post").mockResolvedValue({ status: 200, data: ENVELOPE });

      await c.callTool("web fetch", "fetch/json", {});

      expect(postMock).toHaveBeenCalledWith(
        "/tools/web%20fetch/fetch%2Fjson",
        {},
        expect.anything(),
      );
    });

    it("sends Idempotency-Key and X-Centaur-* trace headers when provided", async () => {
      const c = client();
      const postMock = vi.spyOn(c.http, "post").mockResolvedValue({ status: 200, data: ENVELOPE });

      await c.callTool(
        "repo_context",
        "search",
        { query: "foo" },
        {
          idempotencyKey: "job1:ground:repo_context:tu1",
          trace: { jobId: "job1", stage: "ground", threadKey: "slack:C1:1.2", traceId: "run-9" },
        },
      );

      expect(postMock).toHaveBeenCalledWith(
        "/tools/repo_context/search",
        { query: "foo" },
        expect.objectContaining({
          headers: {
            "Idempotency-Key": "job1:ground:repo_context:tu1",
            "X-Centaur-Job-Id": "job1",
            "X-Centaur-Stage": "ground",
            "X-Centaur-Thread-Key": "slack:C1:1.2",
            "X-Centaur-Trace": "run-9",
          },
        }),
      );
    });

    it("omits optional headers when idempotencyKey/trace are absent", async () => {
      const c = client();
      const postMock = vi.spyOn(c.http, "post").mockResolvedValue({ status: 200, data: ENVELOPE });

      await c.callTool("repo_context", "search", { query: "foo" });

      const config = postMock.mock.calls[0]?.[2] as { headers: Record<string, string> };
      expect(config.headers).toEqual({});
    });

    it("maps HTTP >= 500 to a retryable typed error", async () => {
      const c = client();
      vi.spyOn(c.http, "post").mockResolvedValue({ status: 503, data: "upstream down" });

      const result = await c.callTool("repo_context", "search", {});

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("unavailable");
      expect(result.retryable).toBe(true);
      expect(result.evidence).toEqual([]);
    });

    it("maps 403 to a non-retryable forbidden error", async () => {
      const c = client();
      vi.spyOn(c.http, "post").mockResolvedValue({ status: 403, data: { detail: "nope" } });

      const result = await c.callTool("slack", "send_message", {});

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("forbidden");
      expect(result.retryable).toBe(false);
    });

    it("maps a non-JSON 2xx body to a typed invalid_json error", async () => {
      const c = client();
      vi.spyOn(c.http, "post").mockResolvedValue({ status: 200, data: "<html>not json</html>" });

      const result = await c.callTool("repo_context", "search", {});

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("invalid_json");
      expect(result.retryable).toBe(false);
    });

    it("maps a network failure to a retryable error without throwing", async () => {
      const c = client();
      vi.spyOn(c.http, "post").mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await c.callTool("repo_context", "search", {});

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("unavailable");
      expect(result.retryable).toBe(true);
      expect(result.error?.message).toContain("ECONNREFUSED");
    });

    it("returns application-level ok:false envelopes verbatim", async () => {
      const c = client();
      const errEnvelope: ToolResult = {
        schema_version: "centaur.tool_result.v1",
        ok: false,
        content: null,
        text: null,
        output: { error: "boom" },
        evidence: [],
        error: { code: "tool_failed", message: "boom" },
        retryable: false,
      };
      vi.spyOn(c.http, "post").mockResolvedValue({ status: 200, data: errEnvelope });

      const result = await c.callTool("repo_context", "search", {});

      expect(result).toEqual(errEnvelope);
    });
  });
});
