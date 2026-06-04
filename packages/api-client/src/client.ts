import { EventSourceParserStream, type EventSourceMessage } from "eventsource-parser/stream";
import axios, { type AxiosInstance } from "axios";

import type { ToolResult } from "./types";

export type InputContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source_path?: string;
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "document";
      source_path?: string;
      source: { type: "base64"; media_type: string; data: string };
    };

export interface SpawnOptions {
  threadKey: string;
  spawnId?: string;
  harness?: string;
  engine?: string;
  personaId?: string;
  agentsMdOverride?: string;
}

export interface SpawnResult {
  ok: boolean;
  runtime_id: string;
  thread_key: string;
  trace_id?: string;
  assignment_state: string;
  assignment_generation: number;
  persona_id?: string | null;
  prompt_ref?: string | null;
  effective_agents_md_sha256?: string | null;
}

export interface MessageOptions {
  threadKey: string;
  assignmentGeneration: number;
  messageId?: string;
  role?: string;
  event?: Record<string, unknown>;
  parts?: InputContentBlock[];
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecuteOptions {
  threadKey: string;
  assignmentGeneration: number;
  executeId?: string;
  harness?: string;
  platform?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  delivery?: Record<string, unknown>;
}

export interface ExecutionAccepted {
  ok: boolean;
  execution_id: string;
  execute_id: string;
  assignment_generation: number;
  status: string;
  final_key: string;
  delivery_token: string;
  idempotent?: boolean;
}

export interface WorkflowRunOptions {
  workflowName: string;
  triggerKey?: string;
  input?: Record<string, unknown>;
  eagerStart?: boolean;
  timeoutMs?: number;
}

export interface WorkflowRunAccepted {
  ok: boolean;
  run_id: string;
  workflow_name: string;
  workflow_version?: string;
  workflow_source_path?: string | null;
  parent_run_id?: string | null;
  root_run_id?: string | null;
  status: string;
  thread_key?: string | null;
  execution_id?: string | null;
  output_json?: Record<string, unknown> | null;
  error_text?: string | null;
  latest_checkpoint_name?: string | null;
  latest_step_kind?: string | null;
  waiting_on?: Record<string, unknown> | null;
  child_runs_count?: number;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  idempotent?: boolean;
}

export interface ThreadMessageRecord {
  id: string;
  role: string;
  parts: Array<Record<string, unknown>>;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface StreamEvent {
  eventId: number;
  eventKind: string;
  data: Record<string, unknown>;
}

/** Traceability metadata sent as X-Centaur-* headers on a tool call (R8). */
export interface CallToolTrace {
  jobId?: string;
  stage?: string;
  threadKey?: string;
  traceId?: string;
}

export interface CallToolOptions {
  /** Opt-in replay key; the tool plane accepts (and currently ignores) it. */
  idempotencyKey?: string;
  trace?: CallToolTrace;
}

/** Build a typed error envelope for a transport-level failure (no tool ran). */
function toolTransportError(
  code: string,
  message: string,
  retryable: boolean,
): ToolResult {
  return {
    schema_version: "centaur.tool_result.v1",
    ok: false,
    content: null,
    text: null,
    output: null,
    evidence: [],
    error: { code, message },
    retryable,
  };
}

export class CentaurClient {
  readonly http: AxiosInstance;
  private log?: { info: Function; warn: Function; error: Function };

  constructor(opts: {
    apiUrl: string;
    apiKey: string;
    timeoutMs?: number;
    logger?: { info: Function; warn: Function; error: Function };
  }) {
    this.log = opts.logger;
    this.http = axios.create({
      baseURL: opts.apiUrl,
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      timeout: opts.timeoutMs ?? 30_000,
    });
  }

  private get authHeader(): string {
    return (this.http.defaults.headers["Authorization"] ??
      this.http.defaults.headers.common?.["Authorization"]) as string;
  }

  async spawn(opts: SpawnOptions): Promise<SpawnResult> {
    const { data } = await this.http.post("/agent/spawn", {
      thread_key: opts.threadKey,
      spawn_id: opts.spawnId,
      harness: opts.harness,
      engine: opts.engine,
      persona_id: opts.personaId,
      agents_md_override: opts.agentsMdOverride,
    });
    return data as SpawnResult;
  }

  async message(opts: MessageOptions): Promise<{ ok: boolean; message_id: string; attachment_ids: string[] }> {
    const body: Record<string, unknown> = {
      thread_key: opts.threadKey,
      assignment_generation: opts.assignmentGeneration,
      message_id: opts.messageId,
      metadata: opts.metadata,
      user_id: opts.userId,
    };

    if (opts.event) {
      body.event = opts.event;
    } else {
      body.role = opts.role ?? "user";
      body.parts = opts.parts ?? [];
    }

    const { data } = await this.http.post("/agent/message", body);
    return data as { ok: boolean; message_id: string; attachment_ids: string[] };
  }

  async execute(opts: ExecuteOptions): Promise<ExecutionAccepted> {
    const { data } = await this.http.post("/agent/execute", {
      thread_key: opts.threadKey,
      assignment_generation: opts.assignmentGeneration,
      execute_id: opts.executeId,
      harness: opts.harness,
      platform: opts.platform,
      user_id: opts.userId,
      metadata: opts.metadata,
      delivery: opts.delivery,
    });
    return data as ExecutionAccepted;
  }

  async startWorkflowRun(opts: WorkflowRunOptions): Promise<WorkflowRunAccepted> {
    const { data } = await this.http.post("/workflows/runs", {
      workflow_name: opts.workflowName,
      trigger_key: opts.triggerKey,
      input: opts.input ?? {},
      eager_start: opts.eagerStart ?? false,
    }, {
      timeout: opts.timeoutMs,
    });
    return data as WorkflowRunAccepted;
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRunAccepted> {
    const { data } = await this.http.get(`/workflows/runs/${encodeURIComponent(runId)}`);
    return data as WorkflowRunAccepted;
  }

  async listWorkflowRuns(opts?: {
    workflowName?: string;
    threadKey?: string;
    status?: string;
    parentRunId?: string;
    limit?: number;
  }): Promise<{ ok: boolean; items: WorkflowRunAccepted[] }> {
    const { data } = await this.http.get("/workflows/runs", {
      params: {
        workflow_name: opts?.workflowName,
        thread_key: opts?.threadKey,
        status: opts?.status,
        parent_run_id: opts?.parentRunId,
        limit: opts?.limit,
      },
    });
    return data as { ok: boolean; items: WorkflowRunAccepted[] };
  }

  async getWorkflowChildren(runId: string, limit = 200): Promise<{ ok: boolean; items: WorkflowRunAccepted[] }> {
    const { data } = await this.http.get(`/workflows/runs/${encodeURIComponent(runId)}/children`, {
      params: { limit },
    });
    return data as { ok: boolean; items: WorkflowRunAccepted[] };
  }

  async cancelWorkflowRun(runId: string): Promise<WorkflowRunAccepted> {
    const { data } = await this.http.post(`/workflows/runs/${encodeURIComponent(runId)}/cancel`);
    return data as WorkflowRunAccepted;
  }

  async sendWorkflowEvent(opts: {
    eventType: string;
    correlationId: string;
    payload?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const { data } = await this.http.post("/workflows/events", {
      event_type: opts.eventType,
      correlation_id: opts.correlationId,
      payload: opts.payload ?? {},
    });
    return data as Record<string, unknown>;
  }

  async *streamEvents(opts: {
    threadKey: string;
    afterEventId?: number;
    executionId?: string;
    pollMs?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<StreamEvent, void, undefined> {
    const params = new URLSearchParams();
    if (opts.afterEventId !== undefined) params.set("after_event_id", String(opts.afterEventId));
    if (opts.executionId) params.set("execution_id", opts.executionId);
    if (opts.pollMs !== undefined) params.set("poll_ms", String(opts.pollMs));

    const url = `${this.http.defaults.baseURL}/agent/threads/${encodeURIComponent(opts.threadKey)}/events?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "X-Centaur-Thread-Key": opts.threadKey,
      },
      signal: opts.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`/agent/threads/{thread}/events failed (${res.status}): ${text.slice(0, 300)}`);
    }
    if (!res.body) return;

    const stream = (res.body as ReadableStream<Uint8Array>)
      .pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>)
      .pipeThrough(new EventSourceParserStream());

    for await (const event of stream as unknown as AsyncIterable<EventSourceMessage>) {
      if (!event.data || event.data === "[DONE]") continue;
      let parsed: Record<string, unknown> = { type: "unknown", raw: event.data };
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        // keep raw fallback
      }
      yield {
        eventId: Number(event.id || 0),
        eventKind: event.event || "message",
        data: parsed,
      };
    }
  }

  async getExecution(executionId: string) {
    const { data } = await this.http.get(`/agent/executions/${encodeURIComponent(executionId)}`);
    return data as Record<string, unknown>;
  }

  async getMessages(threadKey: string, opts?: { cursor?: string; limit?: number }) {
    const { data } = await this.http.get("/agent/messages", {
      params: {
        thread_key: threadKey,
        cursor: opts?.cursor,
        limit: opts?.limit ?? 50,
      },
    });
    return data as {
      messages: ThreadMessageRecord[];
      cursor: string | null;
      has_more: boolean;
    };
  }

  async listExecutions(threadKey: string, limit = 20) {
    const { data } = await this.http.get(
      `/agent/threads/${encodeURIComponent(threadKey)}/executions`,
      { params: { limit } },
    );
    return data as { thread_key: string; executions: Array<Record<string, unknown>> };
  }

  async cancelExecution(executionId: string) {
    const { data } = await this.http.post(`/agent/executions/${encodeURIComponent(executionId)}/cancel`);
    return data as Record<string, unknown>;
  }

  async steerExecution(
    executionId: string,
    opts?: {
      contentBlocks?: Array<Record<string, unknown>>;
      messageId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
      suppressCancellationDelivery?: boolean;
    },
  ) {
    const { data } = await this.http.post(`/agent/executions/${encodeURIComponent(executionId)}/steer`, {
      content_blocks: opts?.contentBlocks,
      message_id: opts?.messageId,
      user_id: opts?.userId,
      metadata: {
        ...(opts?.metadata || {}),
        ...(opts?.suppressCancellationDelivery === undefined
          ? {}
          : { steer_replacement: opts.suppressCancellationDelivery }),
      },
    });
    return data as Record<string, unknown>;
  }

  async releaseThread(threadKey: string, opts?: { releaseId?: string; cancelInflight?: boolean }) {
    const { data } = await this.http.post(
      `/agent/threads/${encodeURIComponent(threadKey)}/release`,
      {
        release_id: opts?.releaseId,
        cancel_inflight: opts?.cancelInflight ?? false,
      },
    );
    return data as Record<string, unknown>;
  }

  async claimFinalDeliveries(opts: { consumerId: string; limit?: number; leaseSeconds?: number; platform?: string }) {
    const { data } = await this.http.post("/agent/final-deliveries/claim", {
      consumer_id: opts.consumerId,
      limit: opts.limit ?? 1,
      lease_seconds: opts.leaseSeconds ?? 60,
      platform: opts.platform,
    });
    return data as { deliveries: Array<Record<string, unknown>> };
  }

  async renewFinalDeliveryLease(executionId: string, opts: { consumerId: string; leaseSeconds?: number }) {
    const { data } = await this.http.post(
      `/agent/final-deliveries/${encodeURIComponent(executionId)}/heartbeat`,
      {
        consumer_id: opts.consumerId,
        lease_seconds: opts.leaseSeconds ?? 60,
      },
    );
    return data as Record<string, unknown>;
  }

  async markFinalDelivered(executionId: string, consumerId?: string) {
    const { data } = await this.http.post(
      `/agent/final-deliveries/${encodeURIComponent(executionId)}/delivered`,
      { consumer_id: consumerId },
    );
    return data as Record<string, unknown>;
  }

  async markFinalFailed(
    executionId: string,
    error: string,
    opts?: {
      consumerId?: string;
      retryAfterSeconds?: number;
      nonRetryable?: boolean;
      errorClass?: string;
    },
  ) {
    const { data } = await this.http.post(
      `/agent/final-deliveries/${encodeURIComponent(executionId)}/failed`,
      {
        consumer_id: opts?.consumerId,
        error,
        retry_after_seconds: opts?.retryAfterSeconds ?? 15,
        non_retryable: opts?.nonRetryable ?? false,
        error_class: opts?.errorClass,
      },
    );
    return data as Record<string, unknown>;
  }

  async getStatus(threadKey: string) {
    const { data } = await this.http.get("/agent/status", { params: { key: threadKey } });
    return data as Record<string, unknown>;
  }

  /**
   * Invoke a native tool method and return the `tool_result.v1` envelope.
   *
   * POSTs the raw `input` (not wrapped in any envelope) to
   * `/tools/{tool}/{method}` with Bearer auth, an optional `Idempotency-Key`,
   * and optional `X-Centaur-*` trace headers. The response envelope is returned
   * verbatim, including application-level `ok:false` tool errors.
   *
   * Transport failures never throw: a non-JSON body, a 403, an HTTP >= 500, a
   * network error, or any other non-2xx status is mapped into a typed error
   * envelope so callers branch on `result.ok`/`result.error.code` rather than
   * catching exceptions. HTTP >= 500 and network failures are marked
   * `retryable` (read-only calls are safe to re-run).
   */
  async callTool(
    tool: string,
    method: string,
    input: Record<string, unknown> = {},
    opts: CallToolOptions = {},
  ): Promise<ToolResult> {
    const headers: Record<string, string> = {};
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    const trace = opts.trace;
    if (trace?.jobId) headers["X-Centaur-Job-Id"] = trace.jobId;
    if (trace?.stage) headers["X-Centaur-Stage"] = trace.stage;
    if (trace?.threadKey) headers["X-Centaur-Thread-Key"] = trace.threadKey;
    if (trace?.traceId) headers["X-Centaur-Trace"] = trace.traceId;

    const url = `/tools/${encodeURIComponent(tool)}/${encodeURIComponent(method)}`;

    let status: number;
    let data: unknown;
    try {
      const res = await this.http.post(url, input ?? {}, {
        headers,
        validateStatus: () => true,
      });
      status = res.status;
      data = res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return toolTransportError("unavailable", `tool transport failed: ${message}`, true);
    }

    if (status >= 500) {
      return toolTransportError("unavailable", `tool plane returned HTTP ${status}`, true);
    }
    if (status === 403) {
      return toolTransportError(
        "forbidden",
        `not authorized to call ${tool}/${method} (HTTP 403)`,
        false,
      );
    }
    if (status >= 400) {
      return toolTransportError("http_error", `tool plane returned HTTP ${status}`, false);
    }

    // 2xx — expect a tool_result.v1 envelope. axios leaves an unparseable JSON
    // body as a raw string, so a string here means the response was not JSON.
    let parsed: unknown = data;
    if (typeof data === "string") {
      if (data.trim() === "") {
        return toolTransportError("invalid_json", "tool plane returned an empty body", false);
      }
      try {
        parsed = JSON.parse(data);
      } catch {
        return toolTransportError("invalid_json", "tool plane returned a non-JSON body", false);
      }
    }
    if (!parsed || typeof parsed !== "object") {
      return toolTransportError("invalid_json", "tool plane returned an unexpected body", false);
    }
    return parsed as ToolResult;
  }
}
