import Anthropic from "@anthropic-ai/sdk";
import {
  grepPlatform,
  readPlatformFile,
} from "./fact-grounder/sources/platform-code.js";
import {
  allFeatures,
  lookupFeature,
  searchFeatures,
  type PartnerRegistryEntry,
} from "./fact-grounder/sources/partner-registry.js";
import { fetchInfinexPage } from "./fact-grounder/sources/infinex-pages.js";
import { fetchPublicPage } from "./fact-grounder/sources/public-page.js";
import {
  fetchRenderedPage,
  AgentBrowserUnavailableError,
} from "./fact-grounder/sources/rendered-page.js";
import {
  infinexWebSearch,
  infinexSearchRecentPosts,
  ProjectjinUnavailableError,
} from "./fact-grounder/sources/projectjin-research.js";

export type AnthropicTool = NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>[number];

export interface ResearchToolResult {
  tool_use_id: string;
  content: string;
  /** Set when a fetch_json_api call was blocked pending operator approval (host not in our code). */
  approvalRequest?: ApiApprovalRequest;
  evidence?: import("./centaur-tools.js").EvidenceItem[];
  tool?: string;
}

/** A partner-API call the grounder wanted to make but couldn't auto-approve (host not referenced in our code). */
export interface ApiApprovalRequest {
  host: string;
  url: string;
  reason: string;
}

export type ResearchToolExecutor = (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolUseId: string,
  ref?: string,
  approvedHosts?: string[],
) => Promise<ResearchToolResult>;

export type ResearchToolName =
  | "grep_platform_code"
  | "read_platform_file"
  | "lookup_partner"
  | "fetch_infinex_page"
  | "fetch_public_page"
  | "fetch_rendered_page"
  | "fetch_json_api"
  | "infinex_web_search"
  | "infinex_search_recent_posts";

const RESEARCH_TOOL_NAMES = new Set<string>([
  "grep_platform_code",
  "read_platform_file",
  "lookup_partner",
  "fetch_infinex_page",
  "fetch_public_page",
  "fetch_rendered_page",
  "fetch_json_api",
  "infinex_web_search",
  "infinex_search_recent_posts",
]);

export const TOOL_RESULT_CAP = 4000;
// read_platform_file is a DELIBERATE "give me this whole doc" action, not an
// incidental match list — cap it high enough to return a full research/requirements
// doc. The 4000 cap was guillotining docs mid-file: a category census or volume
// table near the end of a doc (e.g. collector-crypt-das-research.md, ~9k chars,
// census at offset ~7.5k) got cut before the model ever saw it.
export const READ_FILE_CAP = 16000;
const DEFAULT_JSON_API_ALLOWLIST = [
  "api.hyperliquid.xyz",
  "clob.polymarket.com",
  "gamma-api.polymarket.com",
];

export function isResearchToolName(name: string): name is ResearchToolName {
  return RESEARCH_TOOL_NAMES.has(name);
}

export function buildResearchTools(): AnthropicTool[] {
  return [
    {
      name: "grep_platform_code",
      description:
        "Search the Infinex platform monorepo using ripgrep (case-insensitive). Use for finding constants, config values, feature flags, leverage caps, supported chain counts, or any hardcoded product fact. Returns file paths, line numbers, and matched content. By default it already searches BOTH code (*.ts/*.tsx/*.json) and docs (*.md) — so for 'what does the product offer / what categories are supported / how is it positioned / what volume figures' claims, just search normally and you WILL hit the docs (docs/brainstorms/, docs/plans/, docs/collectibles/), then read_platform_file the matching .md. Leave glob UNSET to search everything. Only set glob to NARROW to a single file type, and pass exactly ONE pattern (e.g. glob:'*.md' for docs-only) — never a comma-separated list.",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Ripgrep search pattern (plain text or regex)" },
          path: { type: "string", description: "Optional sub-path within the platform root, e.g. 'apps/perps-app/src'" },
          glob: { type: "string", description: "File glob, e.g. '*.ts'. Defaults to *.ts, *.tsx, *.json" },
          maxResults: { type: "number", description: "Max matches to return (default 20)" },
        },
        required: ["pattern"],
      },
    },
    {
      name: "read_platform_file",
      description:
        "Read a specific file from the platform monorepo. Use after grep_platform_code to read the full context around a match. Path is relative to the platform root.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path within the platform root, e.g. 'apps/perps-app/src/app/[[...params]]/page.tsx'" },
          startLine: { type: "number", description: "First line to read (1-indexed)" },
          endLine: { type: "number", description: "Last line to read (1-indexed)" },
        },
        required: ["path"],
      },
    },
    {
      name: "lookup_partner",
      description:
        "Look up which third-party provider powers a specific Infinex product feature. Use this first when the copy mentions a feature (perps, prediction markets, swap routing, passkeys). Faster and more reliable than web search for partnership facts.",
      input_schema: {
        type: "object",
        properties: {
          feature: { type: "string", description: "Feature name, e.g. 'perps_trading', 'prediction_markets', 'passkey_custody', 'swap_routing'" },
          search: { type: "string", description: "Fuzzy search term if you don't know the exact feature name" },
        },
      },
    },
    {
      name: "fetch_infinex_page",
      description:
        "Fetch a page from any *.infinex.xyz domain. Product apps live on subdomains: perps -> https://perps.app.infinex.xyz, prediction markets -> https://predict.app.infinex.xyz, main site -> https://infinex.xyz. Pass a full URL for subdomains. Results are cached for 24h.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Full URL for subdomains (e.g. 'https://perps.app.infinex.xyz') or path for main site (e.g. '/earn')" },
        },
        required: ["path"],
      },
    },
    {
      name: "fetch_public_page",
      description:
        "Fetch a public HTTPS page and return stripped text. Use for official provider/protocol docs when platform code has not landed yet, especially for product mechanics: what enters, what converts, what settles, and what the user sees. Rejects local/private hosts. Results cached for 24h.",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full HTTPS URL to an official docs/product page" },
        },
        required: ["url"],
      },
    },
    {
      name: "fetch_rendered_page",
      description:
        "Fetch the live rendered view of a web page (Chrome headless via agent-browser). Returns what a user actually sees after JS has run, with frontend aliasing/normalization applied. Use before raw API calls when verifying any claim about what shows up in product. Optional clickAfterLoad opens a dropdown/menu. Output capped at 6000 chars.",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to fetch (https:// preferred)" },
          selector: { type: "string", description: "Optional CSS selector to scope the extraction (default: body)" },
          waitFor: { type: "string", enum: ["networkidle", "load", "domcontentloaded"], description: "Wait strategy after navigation (default: networkidle)" },
          clickAfterLoad: { type: "string", description: "Optional CSS selector or @ref to click after page loads" },
          waitForText: { type: "string", description: "Optional substring to wait for before extracting" },
        },
        required: ["url"],
      },
    },
    {
      name: "fetch_json_api",
      description:
        "Fetch a READ-ONLY JSON API endpoint and return the parsed response — for live partner/protocol data (counts, categories, volumes, on-chain state). This is the general way to ground any partner's live data: once you've found the partner's API host in the branch code, replay the READ calls our integration code makes. Hosts referenced in the platform branch are auto-allowed; an unknown host returns APPROVAL_NEEDED (queued for the operator — don't retry). Read/list/search/info endpoints only — never mutating calls, never send credentials. Results capped at 4000 chars.",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to fetch" },
          method: { type: "string", enum: ["GET", "POST"], description: "HTTP method (default GET). POST only for read-style endpoints (e.g. an `/info` query)." },
          body: { type: "object", description: "JSON body for POST requests" },
          reason: { type: "string", description: "Short note on what this call is meant to reveal (shown to the operator if approval is needed)" },
          jq: { type: "string", description: "Optional: a plain-English description of which fields to inspect" },
        },
        required: ["url"],
      },
    },
    {
      name: "infinex_web_search",
      description:
        "Search the web via Grok/X for external verification. Use when internal sources do not resolve a claim, or when you need to verify that a partnership is current and publicly announced. Requires projectjin CLI.",
      input_schema: {
        type: "object",
        properties: {
          context: { type: "string", maxLength: 500, description: "Why you are running this search" },
          query: { type: "string", description: "Search query" },
        },
        required: ["context", "query"],
      },
    },
    {
      name: "infinex_search_recent_posts",
      description:
        "Search recent X/Twitter posts. Use as follow-up when web search is inconclusive, or when you need to verify a recent announcement by Infinex or a named partner. Requires projectjin CLI.",
      input_schema: {
        type: "object",
        properties: {
          context: { type: "string", maxLength: 500, description: "Why you are running this search" },
          query: { type: "string", description: "X API search syntax; supports from:user, exact quotes, etc." },
          hoursBack: { type: "number", description: "Hours back to search (1..168, default 24)" },
          maxResults: { type: "number", description: "Results to return (10..100, default 10)" },
          sortOrder: { type: "string", enum: ["recency", "relevancy"] },
        },
        required: ["context", "query"],
      },
    },
  ];
}

export function buildGrounderTools(): AnthropicTool[] {
  return [
    ...buildResearchTools(),
    {
      name: "record_fact",
      description:
        "Record a verified fact. Call this when you have found a reliable source for a claim in the source copy. Record the most specific and authoritative version of the fact.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["partner", "capability", "number", "chain", "product", "url", "date", "ticker"],
            description: "The type of fact",
          },
          claim: { type: "string", description: "Human-readable claim, e.g. 'perps venue provider' or 'max leverage multiplier'" },
          value: { type: "string", description: "The verified value, e.g. 'Hyperliquid' or '50'" },
          source: {
            type: "string",
            enum: ["platform-code", "platform-docs", "partner-registry", "provider-docs", "infinex-page", "web-search", "operator-input"],
          },
          source_ref: { type: "string", description: "File path with line number, URL, or evidence ID" },
          evidence_ids: { type: "array", items: { type: "string" }, description: "Optional EvidenceItem IDs from the preceding tool result that support this fact" },
          confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence in this fact (0..1)" },
        },
        required: ["category", "claim", "value", "source", "source_ref", "confidence"],
      },
    },
    {
      name: "mark_unverifiable",
      description:
        "Mark a claim that could not be verified through any available source. This is an honest signal; better to mark unverifiable than to guess.",
      input_schema: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The claim that could not be verified" },
          reason: { type: "string", description: "Why it could not be verified" },
        },
        required: ["claim", "reason"],
      },
    },
    {
      name: "done_grounding",
      description:
        "Signal that grounding is complete. Call when every potentially-verifiable claim in the source copy is either recorded via record_fact or marked via mark_unverifiable.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-line summary of what was found" },
        },
        required: ["summary"],
      },
    },
  ];
}

export const LocalResearchToolExecutor: ResearchToolExecutor = async (
  toolName,
  toolInput,
  toolUseId,
  ref,
  approvedHosts,
) => {
  // Gate live API calls here (not in the inner switch) so a blocked host can emit
  // a structured approval request, not just a rejection string.
  if (toolName === "fetch_json_api") {
    const gate = await gateJsonApiHost(toolInput, ref, approvedHosts);
    if (!gate.allowed) {
      return {
        tool_use_id: toolUseId,
        content: gate.content,
        ...(gate.approvalRequest ? { approvalRequest: gate.approvalRequest } : {}),
      };
    }
  }
  const raw = await executeLocalResearchToolCallInner(toolName, toolInput, ref);
  const cap = toolName === "read_platform_file" ? READ_FILE_CAP : TOOL_RESULT_CAP;
  const content = raw.length > cap
    ? raw.slice(0, cap) + `\n[truncated - ${raw.length - cap} chars omitted; re-read with startLine to continue]`
    : raw;
  return { tool_use_id: toolUseId, content };
};

export const executeResearchToolCall = LocalResearchToolExecutor;

type JsonApiGate =
  | { allowed: true }
  | { allowed: false; content: string; approvalRequest?: ApiApprovalRequest };

/**
 * Decide whether the grounder may call a live JSON API. A host is auto-approved
 * when it's base-allowlisted, operator-approved, or — the general case —
 * referenced anywhere in the resolved platform branch (we integrate it, so the
 * integration code IS the recipe). Otherwise the call is queued for the operator
 * rather than rejected outright.
 */
async function gateJsonApiHost(
  input: Record<string, unknown>,
  ref: string | undefined,
  approvedHosts: string[] | undefined,
): Promise<JsonApiGate> {
  const url = String(input.url ?? "");
  const parsed = (() => { try { return new URL(url); } catch { return null; } })();
  if (!parsed || parsed.protocol !== "https:") {
    return { allowed: false, content: `fetch_json_api rejected: only https:// URLs are allowed (got ${url})` };
  }
  const host = parsed.hostname.toLowerCase();
  // SSRF guard: private / loopback / link-local / metadata addresses are NEVER
  // callable and never offered for approval, even if they somehow appear in code.
  if (isBlockedAddressHost(host)) {
    return { allowed: false, content: `fetch_json_api rejected: ${host} is a private/internal address and is never allowed.` };
  }
  const approved = (approvedHosts ?? []).map((h) => h.trim().toLowerCase());
  if (isBaseAllowlistedHost(host) || approved.includes(host) || (await hostAppearsInBranch(host, ref))) {
    return { allowed: true };
  }
  return {
    allowed: false,
    content:
      `APPROVAL_NEEDED: ${host} is not referenced in the platform branch and has not been operator-approved. ` +
      `This call has been queued for operator approval — do NOT retry it. Ground what you can from code/docs, or mark the dependent claim unverifiable.`,
    approvalRequest: {
      host,
      url: parsed.toString(),
      reason: typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : `read ${parsed.pathname || "/"}`,
    },
  };
}

/** Private/loopback/link-local/metadata hosts — hard-blocked (SSRF guard), never approvable. */
function isBlockedAddressHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "[::1]") return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;          // private / loopback / this-host
    if (a === 169 && b === 254) return true;                    // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;           // private
    if (a === 192 && b === 168) return true;                    // private
    return false;
  }
  // IPv6 link-local / unique-local
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

/** True if the host string appears anywhere in the resolved branch (code or docs) — i.e. we integrate it. */
async function hostAppearsInBranch(host: string, ref: string | undefined): Promise<boolean> {
  if (!ref) return false;
  try {
    const matches = await grepPlatform(host, { ref, maxResults: 1 });
    return matches.length > 0;
  } catch {
    return false;
  }
}

async function executeLocalResearchToolCallInner(
  toolName: string,
  input: Record<string, unknown>,
  ref?: string,
): Promise<string> {
  try {
    switch (toolName) {
      case "grep_platform_code": {
        const matches = await grepPlatform(
          String(input.pattern ?? ""),
          {
            ...(typeof input.path === "string" ? { path: input.path } : {}),
            ...(typeof input.glob === "string" ? { glob: input.glob } : {}),
            ...(typeof input.maxResults === "number" ? { maxResults: input.maxResults } : {}),
            ...(ref ? { ref } : {}),
          },
        );
        if (matches.length === 0) return "No matches found.";
        return matches.map((m) => `${m.file}:${m.line}: ${m.preview}`).join("\n");
      }

      case "read_platform_file": {
        const content = await readPlatformFile(String(input.path ?? ""), {
          ...(typeof input.startLine === "number" ? { startLine: input.startLine } : {}),
          ...(typeof input.endLine === "number" ? { endLine: input.endLine } : {}),
          ...(ref ? { ref } : {}),
        });
        return content;
      }

      case "lookup_partner": {
        if (typeof input.feature === "string") {
          const entry = lookupFeature(input.feature);
          if (entry) return JSON.stringify(entry, null, 2);
        }
        if (typeof input.search === "string") {
          const results = searchFeatures(input.search);
          if (results.length > 0) return JSON.stringify(results, null, 2);
        }
        const all = allFeatures().map((e: PartnerRegistryEntry) => e.feature).join(", ");
        return `No entry found. Available features: ${all}`;
      }

      case "fetch_rendered_page": {
        const url = String(input.url ?? "");
        const result = await fetchRenderedPage(url, {
          ...(typeof input.selector === "string" ? { selector: input.selector } : {}),
          ...(input.waitFor === "networkidle" || input.waitFor === "load" || input.waitFor === "domcontentloaded"
            ? { waitFor: input.waitFor } : {}),
          ...(typeof input.clickAfterLoad === "string" ? { clickAfterLoad: input.clickAfterLoad } : {}),
          ...(typeof input.waitForText === "string" ? { waitForText: input.waitForText } : {}),
        });
        return `URL: ${result.url}\n\n${result.text}`;
      }

      case "fetch_public_page": {
        const result = await fetchPublicPage(String(input.url ?? ""));
        return `URL: ${result.url}\n\n${result.text}`;
      }

      case "fetch_json_api": {
        // Host gating + approval handled by gateJsonApiHost in executeResearchToolCall.
        const url = String(input.url ?? "");
        const parsed = new URL(url);
        parsed.username = "";
        parsed.password = "";
        const method = input.method === "POST" ? "POST" : "GET";
        const body = method === "POST" && input.body ? JSON.stringify(input.body) : undefined;
        const resp = await fetch(parsed.toString(), {
          method,
          headers: { "Content-Type": "application/json", "User-Agent": "comms-factory/research-tools (internal)" },
          signal: AbortSignal.timeout(15_000),
          ...(body ? { body } : {}),
        });
        if (!resp.ok) {
          return `HTTP ${resp.status} from ${parsed.toString()}. Do not retry; mark dependent claims as unverifiable or fail validation.`;
        }
        const json = await resp.json();
        return compactJsonForModel(json);
      }

      case "fetch_infinex_page": {
        const result = await fetchInfinexPage(String(input.path ?? "/"));
        return result.text.slice(0, 6000);
      }

      case "infinex_web_search": {
        const result = await infinexWebSearch({
          context: String(input.context ?? ""),
          query: String(input.query ?? ""),
        });
        return `Summary: ${result.summary}\nCitations: ${result.citations.join(", ")}`;
      }

      case "infinex_search_recent_posts": {
        const result = await infinexSearchRecentPosts({
          context: String(input.context ?? ""),
          query: String(input.query ?? ""),
          ...(typeof input.hoursBack === "number" ? { hoursBack: input.hoursBack } : {}),
          ...(typeof input.maxResults === "number" ? { maxResults: input.maxResults } : {}),
          ...(input.sortOrder === "recency" || input.sortOrder === "relevancy" ? { sortOrder: input.sortOrder } : {}),
        });
        if (result.posts.length === 0) return "No recent posts found.";
        return result.posts.map((p) => `@${p.author} (${p.createdAt}): ${p.text}\n${p.url}`).join("\n\n");
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    if (err instanceof ProjectjinUnavailableError || err instanceof AgentBrowserUnavailableError) {
      return `UNAVAILABLE: ${err.message}`;
    }
    return `ERROR: ${String(err)}`;
  }
}

export function compactJsonForModel(json: unknown): string {
  if (
    Array.isArray(json) && json.length === 2 &&
    json[0] && typeof json[0] === "object" && "universe" in (json[0] as object) &&
    Array.isArray((json[0] as Record<string, unknown>).universe) &&
    Array.isArray(json[1])
  ) {
    type HlToken = { name: string; fullName?: string | null; index: number; evmContract?: unknown };
    type HlMarket = { name: string; tokens: number[]; index: number; isCanonical?: boolean };
    const meta = json[0] as { universe: HlMarket[]; tokens: HlToken[] };
    const ctxs = json[1] as Array<{ coin?: string; dayNtlVlm?: string; [k: string]: unknown }>;
    const tokenMap = new Map<number, HlToken>(meta.tokens.map((t) => [t.index, t]));
    const ctxByCoin = new Map<string, { dayNtlVlm?: string }>(
      ctxs.filter((c): c is { coin: string; dayNtlVlm?: string } => typeof c.coin === "string")
        .map((c) => [c.coin, c]),
    );
    const seen = new Map<string, { pair: string; vol: number; fullName: string }>();
    for (const m of meta.universe) {
      if (m.tokens[1] !== 0) continue;
      const baseIdx = m.tokens[0];
      const tok = baseIdx !== undefined ? tokenMap.get(baseIdx) : undefined;
      const baseName = tok?.name ?? m.name;
      const fullName = tok?.fullName ?? "";
      const ctx = ctxByCoin.get(m.name);
      const vol = parseFloat(ctx?.dayNtlVlm ?? "0");
      const existing = seen.get(baseName);
      if (!existing || vol > existing.vol) {
        seen.set(baseName, { pair: `${baseName}/USDC`, vol, fullName });
      }
    }
    const rows = [...seen.values()].filter((r) => r.vol > 100_000).sort((a, b) => b.vol - a.vol);
    const lines = [
      `Hyperliquid spot markets - ${rows.length} with >$100K 24h volume (use this number in copy).`,
      `On-chain universe is ${meta.universe.length} but ${meta.universe.length - rows.length} had <$100K or zero volume - long-tail HIP-1 noise, not meaningfully tradeable. DO NOT use ${meta.universe.length} as a market count in facts.`,
    ];
    for (const r of rows) {
      const label = r.fullName ? ` (${r.fullName})` : "";
      lines.push(`  ${r.pair}: 24h vol $${(r.vol / 1e6).toFixed(2)}M${label}`);
    }
    lines.push("  (non-USDC pairs and <$100K pairs excluded from above)");
    return lines.join("\n");
  }

  if (json && typeof json === "object" && !Array.isArray(json) &&
    "universe" in (json as object) &&
    Array.isArray((json as Record<string, unknown>).universe)
  ) {
    type HlToken = { name: string; fullName?: string | null; index: number };
    type HlMarket = { name: string; tokens: number[] };
    const meta = json as { universe: HlMarket[]; tokens: HlToken[] };
    const tokenMap = new Map<number, HlToken>(meta.tokens.map((t) => [t.index, t]));
    const names = meta.universe.map((m) => {
      const baseIdx = m.tokens[0];
      const tok = baseIdx !== undefined ? tokenMap.get(baseIdx) : undefined;
      const name = tok?.name ?? m.name;
      const full = tok?.fullName ? ` (${tok.fullName})` : "";
      return `${name}/USDC${full}`;
    }).join(", ");
    return `Hyperliquid spot markets (${meta.universe.length}): ${names}`;
  }

  const minified = JSON.stringify(json);
  if (minified.length <= TOOL_RESULT_CAP) return minified;

  if (Array.isArray(json)) {
    const sample = JSON.stringify(json.slice(0, 3));
    return `Array of ${json.length} items. First 3: ${sample}\n[${json.length - 3} more items omitted]`;
  }

  return minified.slice(0, TOOL_RESULT_CAP) + `\n[truncated - ${minified.length - TOOL_RESULT_CAP} chars omitted]`;
}

function isBaseAllowlistedHost(hostname: string): boolean {
  const allowlist = (process.env.FACT_GROUNDER_JSON_API_ALLOWLIST ?? DEFAULT_JSON_API_ALLOWLIST.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(hostname.toLowerCase());
}
