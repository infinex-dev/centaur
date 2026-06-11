/**
 * Self-derived routing manifest for the fact-grounder (route-before-grep).
 *
 * Builds a compact "where do features live" index from the repos the Centaur
 * repo-cache already syncs, using only commit-pinned repo_context reads — no
 * hand-maintained nav doc. Each allowlisted repo is classified by structure
 * and harvested by the matching extractor:
 *
 *   code-monorepo  (pnpm-workspace.yaml present)  → package.json name/description
 *                                                    per {apps,packages,workers}/<dir>
 *   knowledge      (root *.md with frontmatter)   → frontmatter description/type for
 *                                                    docs whose `type` is allowlisted
 *
 * Manifest fields are hostile-input surfaces (repo content written by many
 * engineers and AI agents, injected into an LLM prompt): every label/blurb is
 * byte-capped and stripped of fenced-code/tag characters at extraction time,
 * and the grounder renders the manifest as data, never as instructions.
 *
 * Refresh model: build at service startup + background interval; /ground reads
 * the current snapshot and never blocks on (or triggers) a build.
 */

import { CentaurToolsClient, type ToolResult } from "../../centaur-tools.js";

export type ManifestEntryKind = "code" | "knowledge";

export interface ManifestEntry {
  repo: string;
  kind: ManifestEntryKind;
  /** Package name (code) or doc filename (knowledge). */
  label: string;
  /** Directory of the package (code) or doc path (knowledge) — the grep/read target. */
  path: string;
  /** Sanitized description, when the source carries one. */
  blurb?: string;
}

export interface RoutingManifest {
  built_at: string;
  entries: ManifestEntry[];
  /** Repos whose harvest failed transiently this build — their previous entries
   * are carried forward by the refresh instead of being silently dropped. */
  failed_repos?: string[];
}

/** Minimal tool-call surface so tests can inject fakes. */
export type ToolCall = (
  tool: string,
  method: string,
  input: Record<string, unknown>,
) => Promise<ToolResult>;

const LABEL_MAX = 60;
const BLURB_MAX = 120;
/** Hard cap on rendered entries — keeps the injected block ~6KB worst case. */
const RENDER_MAX_ENTRIES = 60;
/** Frontmatter `type` values allowed into the knowledge manifest. Docs with a
 * missing or unknown type (e.g. persona files like IDENTITY.md) are excluded
 * by default — that is the instruction-bleed guard. */
const KNOWLEDGE_TYPE_ALLOWLIST = new Set(["canon", "log"]);
const CODE_GROUPS = ["apps", "packages", "workers"] as const;
/** R6: vendor/build noise that must never become a manifest entry. */
const NOISE_PATH = /node_modules|charting_library|\bdist\b|\.min\.js/;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

// ─── Sanitization (R7) ────────────────────────────────────────────────────────

/** Neutralize prompt-structural characters and cap length. Backticks/angle
 * brackets are what would let a description break out of a data rendering;
 * removing them (plus newlines) keeps the field inert without keyword games. */
function sanitizeField(value: string, max: number): string {
  return value
    .replace(/[`<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

// ─── Search-result helpers ────────────────────────────────────────────────────

interface SearchMatch {
  path: string;
  line: number;
  preview: string;
}

/** A retryable/transport failure is NOT "not found" — treating it as absence
 * would silently drop a whole repo from the manifest for a refresh cycle.
 * Throw so the per-repo handler logs and carries the previous entries forward. */
function assertNotTransient(result: ToolResult): void {
  if (!result.ok && (result.retryable || result.error.retryable === true)) {
    throw new Error(`transient tool failure: ${result.error.code}: ${result.error.message}`);
  }
}

function matchesFrom(result: ToolResult): SearchMatch[] {
  assertNotTransient(result);
  if (!result.ok) return [];
  const output = result.output;
  if (typeof output !== "object" || output === null || Array.isArray(output)) return [];
  const matches = (output as Record<string, unknown>).matches;
  if (!Array.isArray(matches)) return [];
  const parsed: SearchMatch[] = [];
  for (const item of matches) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.path !== "string" || typeof record.preview !== "string") continue;
    parsed.push({
      path: record.path,
      line: typeof record.line === "number" ? record.line : 0,
      preview: record.preview,
    });
  }
  return parsed;
}

/** First match per path (lowest line) — for package.json that is the top-level key. */
function firstMatchPerPath(matches: SearchMatch[]): Map<string, SearchMatch> {
  const byPath = new Map<string, SearchMatch>();
  for (const match of matches) {
    const existing = byPath.get(match.path);
    if (!existing || match.line < existing.line) byPath.set(match.path, match);
  }
  return byPath;
}

function jsonStringValue(preview: string, key: string): string | undefined {
  const match = preview.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return match?.[1]?.trim() || undefined;
}

/** Frontmatter `key: value` (optionally quoted) — only meaningful near the top of a doc. */
function frontmatterValue(preview: string, key: string): string | undefined {
  const match = preview.match(new RegExp(`^${key}:\\s*"?([^"]*?)"?\\s*$`));
  return match?.[1]?.trim() || undefined;
}

// ─── Classification ───────────────────────────────────────────────────────────

export type RepoType = "code-monorepo" | "knowledge" | "unknown";

export async function classifyRepo(call: ToolCall, repo: string): Promise<RepoType> {
  const workspace = await call("repo_context", "read_file", { repo, path: "pnpm-workspace.yaml" });
  assertNotTransient(workspace);
  if (workspace.ok) return "code-monorepo";
  // `:(glob)*.md` = root-level markdown only; frontmatter description near the top.
  const frontmatter = await call("repo_context", "search", {
    repo,
    query: "description:",
    path_glob: ":(glob)*.md",
    limit: 10,
  });
  if (matchesFrom(frontmatter).some((m) => m.line <= 10)) return "knowledge";
  return "unknown";
}

// ─── Extractors ───────────────────────────────────────────────────────────────

export async function extractCodeManifest(call: ToolCall, repo: string): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  for (const group of CODE_GROUPS) {
    // :(glob) magic: git's default pathspec wildcards cross "/" — without it,
    // apps/*/package.json matches nested examples/fixtures/vendored files at any
    // depth, polluting the manifest and eating the server's 100-match cap.
    const glob = `:(glob)${group}/*/package.json`;
    const [names, descriptions] = await Promise.all([
      call("repo_context", "search", { repo, query: '"name":', path_glob: glob, limit: 100 }),
      call("repo_context", "search", { repo, query: '"description":', path_glob: glob, limit: 100 }),
    ]);
    const nameByPath = firstMatchPerPath(matchesFrom(names));
    const descByPath = firstMatchPerPath(matchesFrom(descriptions));
    for (const [path, match] of nameByPath) {
      if (NOISE_PATH.test(path)) continue;
      const dir = path.replace(/\/package\.json$/, "");
      if (dir === path) continue; // not a package.json match — malformed
      const name = jsonStringValue(match.preview, "name");
      const description = descByPath.get(path)
        ? jsonStringValue(descByPath.get(path)!.preview, "description")
        : undefined;
      const entry: ManifestEntry = {
        repo,
        kind: "code",
        label: sanitizeField(name ?? dir.split("/").pop() ?? dir, LABEL_MAX),
        path: dir,
      };
      const blurb = description ? sanitizeField(description, BLURB_MAX) : "";
      if (blurb) entry.blurb = blurb;
      entries.push(entry);
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function extractKnowledgeManifest(
  call: ToolCall,
  repo: string,
): Promise<ManifestEntry[]> {
  // Root-level canon docs only for the MVP — highest signal, bounded size.
  const glob = ":(glob)*.md";
  const [descriptions, types] = await Promise.all([
    call("repo_context", "search", { repo, query: "description:", path_glob: glob, limit: 100 }),
    call("repo_context", "search", { repo, query: "type:", path_glob: glob, limit: 100 }),
  ]);
  const frontmatterRegion = (m: SearchMatch) => m.line <= 10;
  const descByPath = firstMatchPerPath(matchesFrom(descriptions).filter(frontmatterRegion));
  const typeByPath = firstMatchPerPath(matchesFrom(types).filter(frontmatterRegion));
  const entries: ManifestEntry[] = [];
  for (const [path, typeMatch] of typeByPath) {
    const docType = frontmatterValue(typeMatch.preview, "type");
    if (!docType || !KNOWLEDGE_TYPE_ALLOWLIST.has(docType)) continue;
    const description = descByPath.get(path)
      ? frontmatterValue(descByPath.get(path)!.preview, "description")
      : undefined;
    const entry: ManifestEntry = {
      repo,
      kind: "knowledge",
      label: sanitizeField(path.split("/").pop() ?? path, LABEL_MAX),
      path,
    };
    const blurb = description ? sanitizeField(description, BLURB_MAX) : "";
    if (blurb) entry.blurb = blurb;
    entries.push(entry);
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

// ─── Build + render ───────────────────────────────────────────────────────────

async function discoverRepos(call: ToolCall): Promise<string[]> {
  const result = await call("repo_context", "list_repos", {});
  if (!result.ok) return [];
  const output = result.output;
  if (typeof output !== "object" || output === null) return [];
  const repositories = (output as Record<string, unknown>).repositories;
  if (!Array.isArray(repositories)) return [];
  const repos: string[] = [];
  for (const item of repositories) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.repo === "string" && record.available !== false) repos.push(record.repo);
  }
  return repos;
}

export async function buildManifest(call: ToolCall): Promise<RoutingManifest> {
  const repos = await discoverRepos(call);
  const entries: ManifestEntry[] = [];
  const failedRepos: string[] = [];
  for (const repo of repos) {
    try {
      const type = await classifyRepo(call, repo);
      if (type === "code-monorepo") entries.push(...(await extractCodeManifest(call, repo)));
      else if (type === "knowledge") entries.push(...(await extractKnowledgeManifest(call, repo)));
    } catch (error) {
      failedRepos.push(repo);
      logEvent("manifest_repo_failed", { repo, error: String(error).slice(0, 200) });
    }
  }
  return {
    built_at: new Date().toISOString(),
    entries,
    ...(failedRepos.length > 0 ? { failed_repos: failedRepos } : {}),
  };
}

/**
 * Rule-capped render selection (no keyword matching — a silent keyword miss
 * would degrade to blind grep undetectably, and feature briefs share no
 * keywords with framing docs). Priority within the cap:
 *   1. knowledge entries (always included — company-framing layer)
 *   2. code entries with a real blurb
 *   3. apps/* entries (user-facing surfaces are the usual comms subjects)
 *   4. everything else, repo-list order
 */
export function selectEntries(manifest: RoutingManifest): ManifestEntry[] {
  const knowledge = manifest.entries.filter((entry) => entry.kind === "knowledge");
  const code = manifest.entries.filter((entry) => entry.kind === "code");
  const blurbed = code.filter((entry) => entry.blurb);
  const apps = code.filter((entry) => !entry.blurb && entry.path.startsWith("apps/"));
  const rest = code.filter((entry) => !entry.blurb && !entry.path.startsWith("apps/"));
  return [...knowledge, ...blurbed, ...apps, ...rest].slice(0, RENDER_MAX_ENTRIES);
}

// ─── Module cache + background refresh ────────────────────────────────────────

let cachedManifest: RoutingManifest | undefined;
let refreshTimer: NodeJS.Timeout | undefined;
let refreshInFlight: Promise<void> | undefined;

function logEvent(event: string, fields: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "comms-factory-api",
      event,
      ...fields,
    }),
  );
}

function defaultToolCall(): ToolCall | undefined {
  const baseUrl = process.env.CENTAUR_BASE_URL?.trim();
  const token = process.env.CENTAUR_TOKEN?.trim();
  if (!baseUrl || !token) return undefined;
  const client = new CentaurToolsClient({ base_url: baseUrl, token });
  return (tool, method, input) =>
    client.callTool(tool, method, input, {
      trace: { jobId: "repo-manifest-refresh", stage: "manifest" },
    });
}

/** R7 audit trail: a blurb that changes between refreshes is the poisoning signal. */
function logBlurbChanges(previous: RoutingManifest | undefined, next: RoutingManifest): void {
  if (!previous) return;
  const previousByKey = new Map(
    previous.entries.map((entry) => [`${entry.repo}:${entry.path}`, entry.blurb ?? ""]),
  );
  for (const entry of next.entries) {
    const key = `${entry.repo}:${entry.path}`;
    const before = previousByKey.get(key);
    if (before !== undefined && before !== (entry.blurb ?? "")) {
      logEvent("manifest_blurb_changed", {
        repo: entry.repo,
        path: entry.path,
        previous: before,
        next: entry.blurb ?? "",
      });
    }
  }
}

/** Stale-while-revalidate: failures keep the previous manifest in place, and a
 * partial build (some repos failed transiently) carries the failed repos'
 * previous entries forward rather than silently dropping them for a cycle. */
export async function refreshRoutingManifest(call?: ToolCall): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  const toolCall = call ?? defaultToolCall();
  if (!toolCall) {
    logEvent("manifest_disabled", { reason: "CENTAUR_BASE_URL/CENTAUR_TOKEN not configured" });
    return;
  }
  refreshInFlight = (async () => {
    try {
      const manifest = await buildManifest(toolCall);
      const failed = new Set(manifest.failed_repos ?? []);
      if (failed.size > 0 && cachedManifest) {
        const carried = cachedManifest.entries.filter((entry) => failed.has(entry.repo));
        manifest.entries.push(...carried);
        logEvent("manifest_refresh_partial", {
          failed_repos: [...failed],
          carried_entries: carried.length,
        });
      }
      if (manifest.entries.length > 0) {
        logBlurbChanges(cachedManifest, manifest);
        cachedManifest = manifest;
        logEvent("manifest_refreshed", { entries: manifest.entries.length });
      } else {
        logEvent("manifest_refresh_empty", { kept_previous: cachedManifest !== undefined });
      }
    } catch (error) {
      logEvent("manifest_refresh_failed", {
        error: String(error).slice(0, 200),
        kept_previous: cachedManifest !== undefined,
      });
    } finally {
      refreshInFlight = undefined;
    }
  })();
  return refreshInFlight;
}

/** Current rendered manifest, or undefined before the first successful build —
 * callers degrade to today's unrouted behavior. Never builds in-request. */
export function getRoutingManifest(): ManifestEntry[] | undefined {
  if (!cachedManifest) return undefined;
  const selected = selectEntries(cachedManifest);
  return selected.length > 0 ? selected : undefined;
}

/** Startup hook: build now (fire-and-forget) and refresh on an interval. */
export function startManifestRefresh(intervalMs: number = REFRESH_INTERVAL_MS): void {
  void refreshRoutingManifest();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => void refreshRoutingManifest(), intervalMs);
  refreshTimer.unref?.();
}

/** Test hook. */
export function _resetManifestCache(): void {
  cachedManifest = undefined;
  refreshInFlight = undefined;
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = undefined;
}
