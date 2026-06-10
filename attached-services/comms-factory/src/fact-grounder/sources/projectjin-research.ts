/**
 * External fact source: projectjin → Grok + X API.
 *
 * Mirrors Nigel's voice-validator research tools exactly.
 * Nigel source: agents/nigel/bot/voice/market_research.py:68–127
 *               agents/nigel/bot/voice/nigel_voice_validator.py:53–131
 *
 * Two tools:
 *   - infinex_web_search: Grok-summarised web search
 *   - infinex_search_recent_posts: X API v2 raw tweet search
 *
 * Both delegate to `projectjin` CLI subprocess.
 * Auth: PROJECTJIN_BIN or PROJECTJIN_CLI env var + optional PROJECTJIN_PROFILE.
 *
 * When PROJECTJIN_BIN is not set, both functions throw ProjectjinUnavailableError.
 * Callers should catch this and mark the claim as unverifiable via external search.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const TOOL_TIMEOUT_MS = 60_000;

export class ProjectjinUnavailableError extends Error {
  constructor() {
    super(
      "projectjin CLI not available. Set PROJECTJIN_BIN or PROJECTJIN_CLI env var. " +
        "External research (Grok/X) will be skipped; internal sources still work.",
    );
    this.name = "ProjectjinUnavailableError";
  }
}

function getProjectjinBin(): string | null {
  return process.env.PROJECTJIN_BIN ?? process.env.PROJECTJIN_CLI ?? null;
}

function getProfile(): string | null {
  return process.env.PROJECTJIN_PROFILE ?? null;
}

async function runProjectjinTool(
  tool: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const bin = getProjectjinBin();
  if (!bin) throw new ProjectjinUnavailableError();

  const profile = getProfile();
  const args = [
    ...(profile ? ["--profile", profile] : []),
    "--agent",
    "--json",
    "tool",
    "call",
    tool,
    "--input",
    JSON.stringify(input),
  ];

  const { stdout } = await execFileAsync(bin, args, {
    timeout: TOOL_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });

  return JSON.parse(stdout.trim());
}

// ─── Tool schemas (mirroring Nigel's validator.py:64–131) ──────────────────

export interface WebSearchInput {
  /** Brief explanation of why this search is being run. Max 500 chars. */
  context: string;
  query: string;
}

export interface WebSearchOutput {
  summary: string;      // Grok-summarised prose answer
  citations: string[];  // source URLs
}

export interface RecentPostsInput {
  context: string;
  /** X API search syntax — supports from:user, "exact match", etc. */
  query: string;
  /** Hours back from now. 1..168, default 24. */
  hoursBack?: number;
  /** Number of tweets. 10..100, default 10. */
  maxResults?: number;
  sortOrder?: "recency" | "relevancy";
}

export interface RecentPost {
  author: string;
  text: string;          // truncated to 280 chars
  createdAt: string;     // ISO date
  url: string;
}

export interface RecentPostsOutput {
  posts: RecentPost[];
}

// ─── Tool implementations ───────────────────────────────────────────────────

export async function infinexWebSearch(input: WebSearchInput): Promise<WebSearchOutput> {
  const raw = await runProjectjinTool("infinex_web_search", input as unknown as Record<string, unknown>);
  if (!isRecord(raw)) return { summary: String(raw), citations: [] };
  return {
    summary: typeof raw.summary === "string" ? raw.summary : (typeof raw.text === "string" ? raw.text : JSON.stringify(raw)),
    citations: Array.isArray(raw.citations) ? raw.citations.filter((c): c is string => typeof c === "string") : [],
  };
}

export async function infinexSearchRecentPosts(
  input: RecentPostsInput,
): Promise<RecentPostsOutput> {
  const raw = await runProjectjinTool("infinex_search_recent_posts", {
    context: input.context,
    query: input.query,
    ...(input.hoursBack !== undefined ? { hoursBack: input.hoursBack } : {}),
    ...(input.maxResults !== undefined ? { maxResults: input.maxResults } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  });
  if (!isRecord(raw)) return { posts: [] };
  const posts = Array.isArray(raw.posts)
    ? raw.posts.flatMap((p) => {
        if (!isRecord(p)) return [];
        return [{
          author: typeof p.author === "string" ? p.author : "",
          text: typeof p.text === "string" ? p.text.slice(0, 280) : "",
          createdAt: typeof p.createdAt === "string" ? p.createdAt : "",
          url: typeof p.url === "string" ? p.url : "",
        }];
      })
    : [];
  return { posts };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
