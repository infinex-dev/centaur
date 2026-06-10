/**
 * External fact source: public documentation/page fetcher.
 *
 * This is intentionally narrower than a browser: it fetches public HTTPS pages,
 * strips them to text, caches for 24h, and rejects local/private network targets.
 * Use it for official provider docs when the platform code has not landed yet.
 */

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { isIP } from "node:net";

const DEFAULT_CACHE_DIR = resolve(homedir(), ".cache/comms-factory/public-pages");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OUTPUT_CAP = 8000;

interface CacheEntry {
  url: string;
  text: string;
  fetched_at: string;
}

export interface PublicPageResult {
  url: string;
  text: string;
  fetched_at: string;
  from_cache: boolean;
  truncated: boolean;
}

function getCacheDir(): string {
  return process.env.COMMS_FACTORY_CACHE_DIR
    ? resolve(process.env.COMMS_FACTORY_CACHE_DIR, "public-pages")
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

export async function fetchPublicPage(rawUrl: string): Promise<PublicPageResult> {
  const url = buildPublicUrl(rawUrl);

  const cached = readCache(url);
  if (cached) {
    const truncated = cached.text.length > OUTPUT_CAP;
    return {
      ...cached,
      text: truncated ? cached.text.slice(0, OUTPUT_CAP) : cached.text,
      from_cache: true,
      truncated,
    };
  }

  const parsed = new URL(url);
  await assertPublicHost(parsed.hostname);

  const doFetch = () =>
    fetch(url, {
      headers: { "User-Agent": "comms-factory/fact-grounder (internal)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

  let response = await doFetch();
  if (response.status === 429 || response.status >= 500) {
    await new Promise((r) => setTimeout(r, 3000));
    response = await doFetch();
  }

  if (!response.ok) {
    throw new Error(`fetchPublicPage: HTTP ${response.status} for ${url}. Do not retry this tool.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  const text = contentType.includes("html") ? htmlToText(raw) : textToCompactText(raw);
  const fetched_at = new Date().toISOString();
  const entry: CacheEntry = { url, text, fetched_at };
  writeCache(entry);

  const truncated = text.length > OUTPUT_CAP;
  return {
    url,
    text: truncated ? text.slice(0, OUTPUT_CAP) : text,
    fetched_at,
    from_cache: false,
    truncated,
  };
}

function buildPublicUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`fetchPublicPage only supports https:// URLs (got ${parsed.protocol})`);
  }
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`fetchPublicPage rejects local/private host: ${parsed.hostname}`);
  }
  return parsed.toString();
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error(`fetchPublicPage rejects local/private address: ${hostname}`);
    }
    return;
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new Error(`fetchPublicPage rejects host resolving to local/private address: ${hostname}`);
    }
  }
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    isBlockedAddress(host)
  );
}

function isBlockedAddress(address: string): boolean {
  const host = address.toLowerCase();
  return (
    /^0\.0\.0\.0$/.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  );
}

function htmlToText(html: string): string {
  return textToCompactText(
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"'),
  );
}

function textToCompactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
