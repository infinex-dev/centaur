import { allFeatures, lookupFeature, searchFeatures, type PartnerRegistryEntry } from "./fact-grounder/sources/partner-registry.js";
import { READ_FILE_CAP, TOOL_RESULT_CAP, type ResearchToolName, type ResearchToolResult } from "./research-tools.js";
import { CentaurToolsClient, type EvidenceItem, type ToolResult } from "./centaur-tools.js";

export interface CentaurResearchConfig {
  base_url: string;
  bearer_token?: string;
  bearer_token_env?: string;
  job_id: string;
  thread_key?: string;
  workflow_run_id?: string;
  requester_user_id?: string;
  stage?: string;
  gate_version?: string;
  timeout_ms?: number;
}

export interface CentaurResearchExecutorOptions {
  ref?: string;
}

export class CentaurResearchExecutor {
  readonly evidence: EvidenceItem[] = [];
  private readonly config: CentaurResearchConfig;
  private readonly client: CentaurToolsClient;

  constructor(config: CentaurResearchConfig) {
    const token = config.bearer_token ?? (config.bearer_token_env ? process.env[config.bearer_token_env] : undefined);
    if (!config.base_url.trim()) throw new Error("centaur base_url is required");
    if (!token?.trim()) throw new Error("centaur bearer token is required");
    this.config = { ...config, base_url: config.base_url.replace(/\/+$/, "") };
    this.client = new CentaurToolsClient({
      base_url: this.config.base_url,
      token: token.trim(),
      ...(this.config.timeout_ms ? { timeout_ms: this.config.timeout_ms } : {}),
    });
  }

  async execute(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseId: string,
    opts: CentaurResearchExecutorOptions = {},
  ): Promise<ResearchToolResult> {
    if (toolName === "lookup_partner") {
      return executeLocalPartnerLookup(toolInput, toolUseId);
    }
    const mapped = mapLogicalToolToTool(toolName, toolInput, opts.ref);
    if (!mapped) {
      return { tool_use_id: toolUseId, content: `UNAVAILABLE: no Centaur tool mapping for ${toolName}` };
    }
    const rejected = localInputRejection(toolName, mapped.input);
    if (rejected) {
      return { tool_use_id: toolUseId, content: rejected };
    }

    const stage = this.config.stage ?? "ground";
    let result: ToolResult;
    try {
      result = await this.client.callTool(mapped.tool, mapped.method, mapped.input, {
        idempotencyKey: deterministicRequestId(this.config.job_id, stage, toolName, toolUseId),
        trace: {
          jobId: this.config.job_id,
          stage,
          ...(this.config.thread_key ? { threadKey: this.config.thread_key } : {}),
          ...(this.config.workflow_run_id ? { trace: this.config.workflow_run_id } : {}),
        },
      });
    } catch (error) {
      return { tool_use_id: toolUseId, content: `ERROR: ${String(error)}` };
    }

    if (!result.ok) {
      const prefix = result.retryable || result.error.retryable ? "UNAVAILABLE" : "ERROR";
      return {
        tool_use_id: toolUseId,
        content: `${prefix}: ${result.error.code}: ${result.error.message}`,
      };
    }

    const evidence = Array.isArray(result.evidence) ? result.evidence : [];
    this.evidence.push(...evidence);
    const cap = toolName === "read_platform_file" ? READ_FILE_CAP : TOOL_RESULT_CAP;
    const content = capModelText(modelTextFromToolResult(result), cap);
    return {
      tool_use_id: toolUseId,
      content: evidence.length > 0
        ? `${content}\n\nEvidence IDs: ${evidence.map((item) => item.id).join(", ")}`
        : content,
      evidence,
      tool: `${mapped.tool}.${mapped.method}`,
    };
  }
}

export function centaurResearchExecutorFromEnv(overrides: Partial<CentaurResearchConfig> = {}): CentaurResearchExecutor {
  const timeoutMs = intFromEnv("CENTAUR_TIMEOUT_MS");
  return new CentaurResearchExecutor({
    base_url: process.env.CENTAUR_BASE_URL ?? "",
    bearer_token_env: "CENTAUR_TOKEN",
    job_id: overrides.job_id ?? process.env.CENTAUR_JOB_ID ?? "comms-factory-grounding",
    stage: overrides.stage ?? "ground",
    ...(timeoutMs ? { timeout_ms: timeoutMs } : {}),
    ...overrides,
  });
}

export function hasCentaurResearchEnv(): boolean {
  return Boolean(process.env.CENTAUR_BASE_URL?.trim() && process.env.CENTAUR_TOKEN?.trim());
}

export function mapLogicalToolToTool(
  toolName: string,
  input: Record<string, unknown>,
  ref?: string,
): { tool: string; method: string; input: Record<string, unknown> } | undefined {
  switch (toolName as ResearchToolName) {
    case "grep_platform_code":
      // repo_context.search(repo, query, ref, path_glob, limit) — emit exactly those arg names;
      // the native tool plane rejects unknown kwargs.
      return {
        tool: "repo_context",
        method: "search",
        input: clean({
          repo: "infinex-platform",
          query: stringValue(input.pattern),
          path_glob: optionalString(input.glob) ?? optionalString(input.path),
          limit: optionalNumber(input.maxResults),
          ref,
        }),
      };
    case "read_platform_file": {
      const hasRange = typeof input.startLine === "number" || typeof input.endLine === "number";
      return {
        tool: "repo_context",
        method: hasRange ? "read_range" : "read_file",
        input: clean({
          repo: "infinex-platform",
          path: stringValue(input.path),
          start_line: optionalNumber(input.startLine),
          end_line: optionalNumber(input.endLine),
          ref,
        }),
      };
    }
    // Web/page fetching has no dedicated Centaur tool — it runs through the Exa-backed
    // websearch.search, which returns page contents. fetch_json_api (raw JSON endpoints)
    // has no native equivalent and is left unmapped → surfaced as UNAVAILABLE.
    case "fetch_public_page":
      return { tool: "websearch", method: "search", input: clean({ query: sanitizedHttpsUrl(input.url) }) };
    case "fetch_infinex_page":
      return { tool: "websearch", method: "search", input: clean({ query: infinexUrl(input.path), include_domains: ["infinex.xyz"] }) };
    case "fetch_rendered_page":
      return { tool: "websearch", method: "search", input: clean({ query: sanitizedUrl(input.url) }) };
    case "infinex_web_search":
      // websearch.search(query, num_results, …) — `context` is grounder-only reasoning, not a tool arg.
      return { tool: "websearch", method: "search", input: clean({ query: stringValue(input.query), num_results: optionalNumber(input.maxResults) }) };
    case "infinex_search_recent_posts":
      // twitter.search_tweets(query, search_type, limit) — map max_results→limit; drop the rest.
      return { tool: "twitter", method: "search_tweets", input: clean({ query: stringValue(input.query), limit: optionalNumber(input.maxResults) }) };
    default:
      return undefined;
  }
}

function localInputRejection(toolName: string, input: Record<string, unknown>): string | undefined {
  // Page-fetch tools carry the sanitized URL in `query` (they route through websearch.search);
  // the sanitizers emit a `tool_input_rejected:` sentinel for disallowed URLs/hosts.
  if (toolName === "fetch_public_page" || toolName === "fetch_infinex_page") {
    const candidate = typeof input.query === "string" ? input.query : undefined;
    if (candidate?.startsWith("tool_input_rejected:")) {
      return candidate.replace("tool_input_rejected: ", `${toolName} rejected: `);
    }
  }
  return undefined;
}

function executeLocalPartnerLookup(input: Record<string, unknown>, toolUseId: string): ResearchToolResult {
  if (typeof input.feature === "string") {
    const entry = lookupFeature(input.feature);
    if (entry) return { tool_use_id: toolUseId, content: JSON.stringify(entry, null, 2) };
  }
  if (typeof input.search === "string") {
    const results = searchFeatures(input.search);
    if (results.length > 0) return { tool_use_id: toolUseId, content: JSON.stringify(results, null, 2) };
  }
  const all = allFeatures().map((entry: PartnerRegistryEntry) => entry.feature).join(", ");
  return { tool_use_id: toolUseId, content: `No entry found. Available features: ${all}` };
}

function modelTextFromToolResult(result: Extract<ToolResult, { ok: true }>): string {
  if (typeof result.content === "string") return result.content;
  if (typeof result.text === "string") return result.text;
  if (typeof result.output === "string") return result.output;
  if (result.output !== undefined) return JSON.stringify(result.output, null, 2);
  if (result.evidence && result.evidence.length > 0) return result.evidence.map((item) => evidenceSummary(item)).join("\n");
  return "OK";
}

function evidenceSummary(item: EvidenceItem): string {
  return [item.id, item.title, item.source_ref ?? item.url, item.quote].filter(Boolean).join(" — ");
}

function capModelText(text: string, cap: number): string {
  return text.length > cap ? `${text.slice(0, cap)}\n[truncated - ${text.length - cap} chars omitted]` : text;
}

function deterministicRequestId(jobId: string, stage: string, toolName: string, toolUseId: string): string {
  return `${jobId}:${stage}:${toolName}:${toolUseId}`.replace(/[^A-Za-z0-9_.:-]+/g, "_").slice(0, 240);
}

function sanitizedHttpsUrl(value: unknown): string {
  const url = sanitizedUrl(value);
  if (!url.startsWith("https://")) return `tool_input_rejected: only https:// URLs are allowed (got ${url})`;
  return url;
}

function sanitizedUrl(value: unknown): string {
  const raw = stringValue(value);
  try {
    const parsed = new URL(raw);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return raw;
  }
}

function infinexUrl(value: unknown): string {
  const raw = stringValue(value || "/");
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://infinex.xyz${raw.startsWith("/") ? raw : `/${raw}`}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return `tool_input_rejected: fetch_infinex_page only supports https:// URLs (got ${raw})`;
    }
    parsed.username = "";
    parsed.password = "";
    const host = parsed.hostname.toLowerCase();
    if (host === "infinex.xyz" || host.endsWith(".infinex.xyz")) return parsed.toString();
    return `tool_input_rejected: fetch_infinex_page only supports infinex.xyz hosts (got ${host})`;
  } catch {
    return `tool_input_rejected: invalid Infinex URL (got ${raw})`;
  }
}

function intFromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function clean(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
