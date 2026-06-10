import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface JsonResponse {
  status?: number;
  body: unknown;
}

export type Handler = (req: RequestContext) => Promise<JsonResponse> | JsonResponse;

export interface RequestContext {
  request: IncomingMessage;
  method: string;
  url: URL;
  body: unknown;
  requestId: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function makeJsonServer(routes: Map<string, Handler>) {
  return createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
    const started = Date.now();
    try {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "/", `http://${host}`);
      const method = request.method ?? "GET";
      const key = `${method} ${url.pathname}`;
      const handler = routes.get(key);
      if (!handler) throw new HttpError(404, "not_found", "route not found");
      const body = method === "GET" || method === "HEAD" ? undefined : await readJsonBody(request);
      const result = await handler({ request, method, url, body, requestId });
      writeJson(response, result.status ?? 200, result.body, requestId);
      log("info", "request_completed", { requestId, method, path: url.pathname, status: result.status ?? 200, duration_ms: Date.now() - started });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : "internal_error";
      const message = error instanceof HttpError ? error.message : "internal server error";
      const details = error instanceof HttpError ? error.details : undefined;
      writeJson(response, status, { ok: false, error: code, message, ...(details === undefined ? {} : { details }) }, requestId);
      log(status >= 500 ? "error" : "warn", "request_failed", {
        requestId,
        status,
        error: code,
        message,
        duration_ms: Date.now() - started,
        // Surface the real cause for unexpected (non-HttpError) 500s — otherwise the
        // actual exception is swallowed and the failure is undiagnosable from logs.
        ...(error instanceof HttpError
          ? {}
          : {
              cause_name: error instanceof Error ? error.name : typeof error,
              cause_message: error instanceof Error ? error.message : String(error),
              cause_stack: error instanceof Error ? error.stack : undefined,
            }),
      });
    }
  });
}

export function requirePostAuth(req: IncomingMessage): void {
  const token = process.env.COMMS_FACTORY_SERVICE_TOKEN?.trim();
  if (!token) {
    if (process.env.NODE_ENV === "production" && process.env.COMMS_FACTORY_ALLOW_UNAUTHENTICATED !== "true") {
      throw new HttpError(503, "service_auth_not_configured", "service auth token is not configured");
    }
    return;
  }
  const authorization = req.headers.authorization ?? "";
  if (authorization !== `Bearer ${token}`) {
    throw new HttpError(401, "unauthorized", "missing or invalid bearer token");
  }
}

export function assertRecord(value: unknown, code = "invalid_json_body"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, code, "request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `missing_${key}`, `${key} is required`);
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function stringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

export function boundedInteger(body: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = body[key];
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || typeof value !== "number" || value < min || value > max) {
    throw new HttpError(400, `invalid_${key}`, `${key} must be an integer between ${min} and ${max}`);
  }
  return value;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buf.length;
    if (bytes > 1_000_000) throw new HttpError(413, "payload_too_large", "request body too large");
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "malformed_json", "request body is not valid JSON");
  }
}

function writeJson(response: ServerResponse, status: number, body: unknown, requestId: string): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
  });
  response.end(JSON.stringify(body));
}

export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void {
  const safe = sanitizeLog(fields) as Record<string, unknown>;
  console[level === "warn" ? "warn" : level](JSON.stringify({ timestamp: new Date().toISOString(), level, service: "comms-factory-api", event, ...safe }));
}

function sanitizeLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLog);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|authorization|cookie|key/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = sanitizeLog(item);
    }
  }
  return out;
}
