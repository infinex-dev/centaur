/**
 * Fetch the *rendered* view of a web page using agent-browser CLI.
 *
 * Difference vs `fetch_infinex_page` / `fetch_json_api`:
 *   - That tool returns raw HTML or raw JSON from an API.
 *   - This tool returns what the user actually sees, after JS has run.
 *
 * Why this matters: many protocols alias raw API data in their frontend
 * (Hyperliquid spot @109 → "HYPE/USDC", Uniswap WETH → "ETH", Aave aTokens
 * → underlying). The raw API is misleading; the rendered page is authoritative
 * for "what does the operator see in product."
 *
 * Requires: agent-browser CLI on PATH (https://github.com/lightpanda-io/agent-browser).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SESSION_NAME = "fact-grounder";
const DEFAULT_TIMEOUT_MS = 60_000;
const OUTPUT_CAP = 6000;

export interface RenderedPageOptions {
  /** CSS selector to scope extraction (default: body). */
  selector?: string;
  /** Wait strategy: 'networkidle' (default), 'load', or 'domcontentloaded'. */
  waitFor?: "networkidle" | "load" | "domcontentloaded";
  /** Optional ref or selector to click after load (e.g. to open a dropdown). */
  clickAfterLoad?: string;
  /** Optional explicit text to wait for before extracting (substring match). */
  waitForText?: string;
}

export interface RenderedPageResult {
  url: string;
  text: string;
  truncated: boolean;
}

export class AgentBrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentBrowserUnavailableError";
  }
}

async function runAgentBrowser(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "agent-browser",
      ["--session", SESSION_NAME, ...args],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
    );
    if (stderr && !stdout) return stderr;
    return stdout;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; stderr?: string };
    if (e.code === "ENOENT") {
      throw new AgentBrowserUnavailableError(
        "agent-browser CLI not found on PATH. Install: brew install agent-browser",
      );
    }
    throw new Error(`agent-browser failed: ${e.stderr ?? e.message ?? String(err)}`);
  }
}

export async function fetchRenderedPage(
  url: string,
  opts: RenderedPageOptions = {},
): Promise<RenderedPageResult> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Only http/https URLs allowed (got ${parsed.protocol})`);
  }
  // Block private/local addresses
  const blocked = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1|fd[0-9a-f]{2}:)/i;
  if (blocked.test(parsed.hostname)) {
    throw new Error(`Private/local addresses are not allowed: ${parsed.hostname}`);
  }

  const waitFor = opts.waitFor ?? "networkidle";

  // Open page
  await runAgentBrowser(["open", parsed.toString()]);
  // Wait for it to settle
  await runAgentBrowser(["wait", "--load", waitFor]);

  // Optional click to reveal content (e.g. open a dropdown)
  if (opts.clickAfterLoad) {
    try {
      await runAgentBrowser(["click", opts.clickAfterLoad]);
      await runAgentBrowser(["wait", "500"]);
    } catch {
      // non-fatal
    }
  }

  // Optional wait for specific text to appear
  if (opts.waitForText) {
    try {
      await runAgentBrowser(["wait", "--text", opts.waitForText]);
    } catch {
      // non-fatal — continue with whatever's rendered
    }
  }

  // Extract text from selector or body
  const selector = opts.selector ?? "body";
  const text = await runAgentBrowser(["get", "text", selector]);

  const truncated = text.length > OUTPUT_CAP;
  return {
    url: parsed.toString(),
    text: truncated ? text.slice(0, OUTPUT_CAP) + `\n[truncated — ${text.length - OUTPUT_CAP} chars omitted]` : text,
    truncated,
  };
}
