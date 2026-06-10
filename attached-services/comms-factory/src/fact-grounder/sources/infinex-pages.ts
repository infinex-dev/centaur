/**
 * Internal fact source: infinex.xyz page fetcher.
 *
 * Fetches pages from infinex.xyz and returns their text content.
 * Results are cached with a 24h TTL to avoid re-fetching on every
 * grounder run (homepage doesn't change minute-to-minute).
 *
 * Cache lives at ~/.cache/comms-factory/infinex-pages/<hash>.json.
 * Set COMMS_FACTORY_CACHE_DIR to override.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const DEFAULT_CACHE_DIR = resolve(homedir(), ".cache/comms-factory/infinex-pages");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const INFINEX_BASE = "https://infinex.xyz";

interface CacheEntry {
  url: string;
  text: string;
  fetched_at: string;
}

function getCacheDir(): string {
  return process.env.COMMS_FACTORY_CACHE_DIR
    ? resolve(process.env.COMMS_FACTORY_CACHE_DIR, "infinex-pages")
    : DEFAULT_CACHE_DIR;
}

function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function readCache(url: string): CacheEntry | null {
  const dir = getCacheDir();
  const file = resolve(dir, `${cacheKey(url)}.json`);
  if (!existsSync(file)) return null;
  try {
    const entry = JSON.parse(readFileSync(file, "utf8")) as CacheEntry;
    const age = Date.now() - new Date(entry.fetched_at).getTime();
    if (age > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  const dir = getCacheDir();
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${cacheKey(entry.url)}.json`);
  writeFileSync(file, JSON.stringify(entry, null, 2), "utf8");
}

function htmlToText(html: string): string {
  // Strip tags, collapse whitespace — good enough for fact-checking
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface InfinexPageResult {
  url: string;
  text: string;
  fetched_at: string;
  from_cache: boolean;
}

/**
 * Fetch a page from infinex.xyz.
 * Path should start with "/" e.g. "/" for homepage, "/perps" for perps.
 */
export async function fetchInfinexPage(path: string): Promise<InfinexPageResult> {
  const url = buildInfinexUrl(path);

  const cached = readCache(url);
  if (cached) {
    return { ...cached, from_cache: true };
  }

  const doFetch = () =>
    fetch(url, {
      headers: { "User-Agent": "comms-factory/fact-grounder (internal)" },
      signal: AbortSignal.timeout(15_000),
    });

  let response = await doFetch();

  if (response.status === 429 || response.status >= 500) {
    await new Promise((r) => setTimeout(r, 3000));
    response = await doFetch();
  }

  if (!response.ok) {
    const hint = " Do not retry this tool — mark dependent claims as unverifiable.";
    throw new Error(`fetchInfinexPage: HTTP ${response.status} for ${url}.${hint}`);
  }

  const html = await response.text();
  const text = htmlToText(html);
  const fetched_at = new Date().toISOString();
  const entry: CacheEntry = { url, text, fetched_at };
  writeCache(entry);

  return { url, text, fetched_at, from_cache: false };
}

function buildInfinexUrl(path: string): string {
  const trimmed = path.trim() || "/";
  const parsed = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? new URL(trimmed)
    : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, INFINEX_BASE);

  const allowed = parsed.protocol === "https:" &&
    (parsed.hostname === "infinex.xyz" || parsed.hostname.endsWith(".infinex.xyz"));
  if (!allowed) {
    throw new Error("fetchInfinexPage only supports https://*.infinex.xyz URLs.");
  }
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}
