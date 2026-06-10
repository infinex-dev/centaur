// Local, dependency-free client for Centaur's native tool plane (POST /tools/{tool}/{method}).
//
// This vendors the transport + envelope types so comms-factory builds and tests with NO dependency
// on the centaur repo (`@centaur/api-client`). Adopting the shared client / codegen'd types is a
// deferred follow-up; until then these types mirror the pinned `centaur.tool_result.v1` contract.

export interface EvidenceItem {
  id: string;
  source: string;
  source_ref?: string;
  title?: string;
  url?: string;
  quote?: string;
  retrieved_at?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}

export type ToolResult =
  | {
      ok: true;
      content?: string;
      text?: string;
      output?: unknown;
      evidence: EvidenceItem[];
    }
  | {
      ok: false;
      error: ToolError;
      retryable: boolean;
    };

export interface ToolTrace {
  jobId?: string;
  stage?: string;
  threadKey?: string;
  trace?: string;
}

export interface CallToolOptions {
  idempotencyKey?: string;
  trace?: ToolTrace;
}

export interface CentaurToolsClientConfig {
  base_url: string;
  token: string;
  timeout_ms?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export class CentaurToolsClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(config: CentaurToolsClientConfig) {
    if (!config.base_url.trim()) throw new Error("centaur tools base_url is required");
    if (!config.token?.trim()) throw new Error("centaur tools token is required");
    this.baseUrl = config.base_url.replace(/\/+$/, "");
    this.token = config.token.trim();
    this.timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  }

  async callTool(
    tool: string,
    method: string,
    input: Record<string, unknown>,
    opts: CallToolOptions = {},
  ): Promise<ToolResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts.trace?.jobId) headers["X-Centaur-Job-Id"] = opts.trace.jobId;
    if (opts.trace?.stage) headers["X-Centaur-Stage"] = opts.trace.stage;
    if (opts.trace?.threadKey) headers["X-Centaur-Thread-Key"] = opts.trace.threadKey;
    if (opts.trace?.trace) headers["X-Centaur-Trace"] = opts.trace.trace;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/tools/${tool}/${method}`, {
        method: "POST",
        headers,
        body: JSON.stringify(input ?? {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Network failures / aborts are transient — retryable. Redact the token defensively.
      return { ok: false, retryable: true, error: { code: "transport_error", message: this.redact(String(error)), retryable: true } };
    }

    const text = await response.text();
    let parsed: unknown;
    if (text.trim()) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return {
          ok: false,
          retryable: false,
          error: { code: "invalid_json", message: this.redact(text.slice(0, 500)), retryable: false },
        };
      }
    }

    if (response.status === 401 || response.status === 403) {
      const message = errorMessageFrom(parsed) ?? `HTTP ${response.status}`;
      return { ok: false, retryable: false, error: { code: "forbidden", message: this.redact(message), retryable: false } };
    }

    const envelope = normalizeToolResult(parsed);
    if (!envelope.ok) {
      const retryable = envelope.retryable || envelope.error.retryable === true || response.status >= 500;
      return {
        ok: false,
        retryable,
        error: { ...envelope.error, message: this.redact(envelope.error.message), retryable },
      };
    }

    if (!response.ok) {
      // ok:true envelope but non-2xx status — treat the HTTP status as authoritative.
      const message = errorMessageFrom(parsed) ?? `HTTP ${response.status}`;
      return {
        ok: false,
        retryable: response.status >= 500,
        error: { code: `http_${response.status}`, message: this.redact(message), retryable: response.status >= 500 },
      };
    }

    return envelope;
  }

  private redact(message: string): string {
    return this.token ? message.split(this.token).join("[redacted]") : message;
  }
}

function normalizeToolResult(value: unknown): ToolResult {
  if (isRecord(value) && value.ok === false) {
    const raw = isRecord(value.error) ? value.error : {};
    return {
      ok: false,
      retryable: value.retryable === true,
      error: {
        code: typeof raw.code === "string" ? raw.code : "tool_error",
        message: typeof raw.message === "string" ? raw.message : "tool execution failed",
        retryable: typeof raw.retryable === "boolean" ? raw.retryable : value.retryable === true,
        ...(raw.details !== undefined ? { details: raw.details } : {}),
      },
    };
  }
  if (isRecord(value) && value.ok === true) {
    return {
      ok: true,
      ...(typeof value.content === "string" ? { content: value.content } : {}),
      ...(typeof value.text === "string" ? { text: value.text } : {}),
      ...(value.output !== undefined ? { output: value.output } : {}),
      evidence: Array.isArray(value.evidence) ? value.evidence.filter(isEvidenceItem) : [],
    };
  }
  return {
    ok: false,
    retryable: false,
    error: { code: "invalid_tool_result", message: "tool response must be an object with ok:true or ok:false", retryable: false },
  };
}

function errorMessageFrom(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.message === "string") return value.message;
  if (typeof value.detail === "string") return value.detail;
  if (isRecord(value.error) && typeof value.error.message === "string") return value.error.message;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvidenceItem(value: unknown): value is EvidenceItem {
  return isRecord(value) && typeof value.id === "string" && typeof value.source === "string";
}
