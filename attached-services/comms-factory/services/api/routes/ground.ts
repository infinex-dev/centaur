import { CentaurResearchExecutor, type CentaurResearchConfig } from "../../../src/centaur-research.js";
import { buildDeployedFacts, groundFacts, type VerifiedFact } from "../../../src/fact-grounder-llm.js";
import { getRoutingManifest } from "../../../src/fact-grounder/sources/repo-manifest.js";
import { assertRecord, boundedInteger, HttpError, optionalString, requiredString, type JsonResponse, type RequestContext } from "../http.js";

const GROUND_SCHEMA_V1 = "comms_factory.ground_from_tools.v1";
// Transitional: also accept the pre-rename capability-plane contract for one
// release so a non-atomic rolling restart can't drop grounding requests while
// Centaur is still on the old client. Remove once the pinned Centaur image is
// confirmed on the tool-plane contract (deferred follow-up).
const LEGACY_GROUND_SCHEMA_V1 = "comms_factory.ground_from_capabilities.v1";

export async function handleGround(ctx: RequestContext): Promise<JsonResponse> {
  const body = assertRecord(ctx.body);
  const brief = requiredString(body, "brief");
  const events: unknown[] = [];
  // The grounder needs room to dig: cheap registry/partner lookups resolve literal
  // brief claims fast, but the salient-attribute sweep (read_range into platform docs)
  // wants several rounds. The grounder's own native default is 16; keep this path
  // generous (default 10) and overridable up to 16. Routed runs (manifest present)
  // default to the full 16: the routed first step budgets ~3 extra turns on top of
  // the mandatory discovery sweep, and 10 would squeeze one or the other out.
  const routingManifest = getRoutingManifest();
  const maxTurns = boundedInteger(body, "max_turns", routingManifest ? 16 : 10, 1, 16);
  const operatorFacts = parseOperatorFacts(body.operator_facts ?? body.facts);
  const hasGroundSchema = body.schema_version !== undefined;
  const hasGroundMode = body.mode !== undefined;
  const toolMode =
    (body.schema_version === GROUND_SCHEMA_V1 && body.mode === "ground_from_tools") ||
    (body.schema_version === LEGACY_GROUND_SCHEMA_V1 && body.mode === "ground_from_capabilities");
  if ((hasGroundSchema || hasGroundMode) && !toolMode && body.mode !== "local_dev_fallback") {
    throw new HttpError(400, "unsupported_ground_contract", `unsupported /ground contract; expected ${GROUND_SCHEMA_V1} + ground_from_tools`);
  }
  const researchConfig = toolMode ? parseCentaurResearchConfig(body, ctx.requestId) : undefined;

  if (toolMode && !researchConfig && operatorFacts.length === 0) {
    throw new HttpError(
      400,
      "tool_plane_not_configured",
      "/ground ground_from_tools requires tool_plane config or operator_facts",
    );
  }

  if (toolMode && !researchConfig && operatorFacts.length > 0) {
    return buildGroundResponse(operatorFacts, [], [], {
      mode: "operator_facts_only",
      model: "none",
      ground_turns: 0,
      truncated: false,
      event_count: 0,
    });
  }

  if (!toolMode && body.mode !== "local_dev_fallback") {
    throw new HttpError(
      400,
      "ground_from_tools_required",
      `/ground requires schema_version ${GROUND_SCHEMA_V1}; use mode=local_dev_fallback only for explicit local development`,
    );
  }

  if (!toolMode && process.env.NODE_ENV === "production") {
    throw new HttpError(
      400,
      "ground_from_tools_required",
      `production /ground requires schema_version ${GROUND_SCHEMA_V1}`,
    );
  }

  const opts: Parameters<typeof groundFacts>[1] = {
    on_event: (event) => {
      events.push(event);
    },
    max_turns: maxTurns,
  };
  const surface = optionalString(body, "surface");
  const job = optionalString(body, "job") ?? optionalString(body, "job_id");
  const stage = optionalString(body, "stage") ?? "ground";
  if (surface !== undefined) opts.surface = surface;
  if (job !== undefined) opts.job = job;
  if (operatorFacts.length > 0) opts.operator_facts = operatorFacts;
  // Route-before-grep: inject the cached self-derived manifest (never built
  // in-request — startManifestRefresh owns freshness). Absent manifest ⇒ the
  // grounder prompt and seed payload are byte-identical to the unrouted path.
  if (routingManifest) opts.routing_manifest = routingManifest;
  // Always ground against a concrete ref. On the Centaur tool path nothing else
  // resolves one (the local harness branch-discovery is bypassed), so without this
  // the grounder's salient-attribute sweep — gated on a ref being set — never fires
  // and depth collapses to whatever the model does for the brief's literal claims.
  // Default to the repo's default branch; an explicit caller ref still wins.
  opts.ref = optionalString(body, "ref") ?? "main";

  let executor: CentaurResearchExecutor | undefined;
  if (researchConfig) {
    executor = new CentaurResearchExecutor(researchConfig);
    opts.tool_executor = (toolName, toolInput, toolUseId, ref) => executor!.execute(
      toolName,
      toolInput,
      toolUseId,
      ref ? { ref } : {},
    );
  }

  const result = await groundFacts(brief, opts);
  return buildGroundResponse(
    result.facts,
    result.unverifiable,
    result.evidence ?? executor?.evidence ?? [],
    {
      mode: researchConfig ? "ground_from_tools" : "local_dev_fallback",
      schema_version: researchConfig ? GROUND_SCHEMA_V1 : undefined,
      model: result.model,
      ground_turns: result.ground_turns,
      truncated: result.truncated === true,
      event_count: events.length,
      stage,
      fact_receipts: result.fact_receipts ?? [],
    },
  );
}

function buildGroundResponse(
  facts: VerifiedFact[],
  unverifiable: { claim: string; reason: string }[],
  evidence: unknown[],
  progress: Record<string, unknown>,
): JsonResponse {
  return {
    body: {
      ok: true,
      operation: "ground",
      facts,
      deployed_facts: buildDeployedFacts(facts),
      unverifiable,
      evidence,
      progress: Object.fromEntries(Object.entries(progress).filter(([, value]) => value !== undefined)),
    },
  };
}

function parseCentaurResearchConfig(body: Record<string, unknown>, requestId: string): CentaurResearchConfig | undefined {
  // Tool-plane native field; fall back to the legacy capability_plane during the
  // transition window (see LEGACY_GROUND_SCHEMA_V1).
  const raw = body.tool_plane ?? body.capability_plane;
  if (raw !== undefined && (typeof raw !== "object" || Array.isArray(raw) || raw === null)) {
    throw new HttpError(400, "invalid_tool_plane", "tool_plane must be an object when supplied");
  }
  const record = raw as Record<string, unknown> | undefined;
  const configuredEndpoint = process.env.CENTAUR_BASE_URL;
  const requestedEndpoint = stringFrom(record?.base_url) ?? stringFrom(record?.endpoint);
  if (requestedEndpoint && configuredEndpoint && requestedEndpoint.replace(/\/+$/, "") !== configuredEndpoint.replace(/\/+$/, "")) {
    throw new HttpError(400, "tool_plane_endpoint_mismatch", "tool_plane endpoint must match server configuration");
  }
  const auth = record?.auth && typeof record.auth === "object" && !Array.isArray(record.auth)
    ? record.auth as Record<string, unknown>
    : undefined;
  const envName = auth?.type === "bearer_env" ? stringFrom(auth.env) : undefined;
  if (envName && envName !== "CENTAUR_TOKEN") {
    throw new HttpError(400, "unsupported_tool_token_env", "tool_plane auth.env must be CENTAUR_TOKEN");
  }
  const endpoint = configuredEndpoint;
  const token = process.env.CENTAUR_TOKEN;
  if (!endpoint || !token) return undefined;
  const threadKey = optionalString(body, "thread_key");
  const workflowRunId = optionalString(body, "workflow_run_id");
  const requesterUserId = optionalString(body, "requester_user_id");
  const gateVersion = optionalString(body, "gate_version");
  const timeoutMs = integerFrom(record?.timeout_ms) ?? integerFrom(body.tool_timeout_ms) ?? integerFrom(body.capability_timeout_ms) ?? integerFrom(process.env.CENTAUR_TIMEOUT_MS);
  return {
    base_url: endpoint,
    bearer_token: token,
    job_id: optionalString(body, "job_id") ?? optionalString(body, "job") ?? requestId,
    ...(threadKey ? { thread_key: threadKey } : {}),
    ...(workflowRunId ? { workflow_run_id: workflowRunId } : {}),
    ...(requesterUserId ? { requester_user_id: requesterUserId } : {}),
    stage: optionalString(body, "stage") ?? "ground",
    ...(gateVersion ? { gate_version: gateVersion } : {}),
    ...(timeoutMs ? { timeout_ms: timeoutMs } : {}),
  };
}

function parseOperatorFacts(value: unknown): VerifiedFact[] {
  if (!Array.isArray(value)) return [];
  const facts: VerifiedFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const claim = stringFrom(record.claim);
    const rawValue = stringFrom(record.value ?? record.fact ?? record.text);
    if (!claim || !rawValue) continue;
    facts.push({
      category: factCategory(record.category),
      claim,
      value: rawValue,
      source: factSource(record.source),
      source_ref: stringFrom(record.source_ref) ?? "operator-input",
      confidence: typeof record.confidence === "number" ? Math.max(0, Math.min(1, record.confidence)) : 1,
      verified_at: stringFrom(record.verified_at) ?? new Date().toISOString().slice(0, 10),
      ...(Array.isArray(record.evidence_ids) ? { evidence_ids: record.evidence_ids.filter((id): id is string => typeof id === "string") } : {}),
    });
  }
  return facts;
}

function factCategory(value: unknown): VerifiedFact["category"] {
  const allowed: VerifiedFact["category"][] = ["partner", "capability", "number", "chain", "product", "url", "date", "ticker"];
  return allowed.includes(value as VerifiedFact["category"]) ? value as VerifiedFact["category"] : "capability";
}

function factSource(value: unknown): VerifiedFact["source"] {
  const allowed: VerifiedFact["source"][] = ["platform-code", "platform-docs", "partner-registry", "provider-docs", "infinex-page", "web-search", "operator-input"];
  return allowed.includes(value as VerifiedFact["source"]) ? value as VerifiedFact["source"] : "operator-input";
}

function integerFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
