/**
 * display.dev client wrapping the @displaydev/cli (`dsp`) binary — the loop's
 * commands were trial-validated 2026-06-11 (publish/comment list/thread
 * resolve/delete). Auth is the DISPLAYDEV_API_KEY env var (the CLI reads it
 * natively — verified against the published package); the key NEVER appears in
 * argv. DISPLAYDEV_SKIP_BROWSER=1 keeps the CLI headless in-pod.
 *
 * Output contract probed against v0.26.0 (2026-06-12) — there is NO --json
 * flag on these commands (only `dsp login --json` exists):
 * - `publish` (authenticated) prints two human lines on stdout:
 *   `<url>\nPublished|Updated <name> (<shortId>) v<n>` → parsed by regex.
 * - `publish -` (stdin) REQUIRES --id, so the CREATE path writes the markdown
 *   to a temp `.md` file (extension drives the CLI's format detection) and
 *   publishes by path; the UPDATE path streams via stdin.
 * - `comment list` prints pretty JSON: `{ data: [...], nextCursor, totalCount }`;
 *   rows carry `anchor.textQuote` as an OBJECT ({ exact, prefix, suffix }) and
 *   `createdOnVersion` as a STRING (real trial output 2026-06-11).
 * - `thread resolve` prints the resolved comment as pretty JSON (opaque here).
 * - `delete --confirm` prints `Deleted <name> (<shortId>)` (opaque here).
 * Unauthenticated runs FAIL CLOSED: we always pass `--visibility`, which the
 * CLI rejects without auth — the anonymous public-publish fallback can't fire.
 * The CLI's update-notice writes to stderr only, so stdout stays parse-safe.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type DspRunner = (
  args: readonly string[],
  opts?: { stdin?: string },
) => Promise<{ stdout: string; stderr: string }>;

export function displayConfigured(): boolean {
  return Boolean(process.env.DISPLAYDEV_API_KEY?.trim());
}

/** Third-party CLI stderr may echo the key in auth-failure diagnostics — strip
 *  it before the text can reach an Error message (http.ts echoes messages into
 *  500 bodies and logs unsanitized). Exported for direct testing. */
export function redactDisplayKey(text: string): string {
  const key = process.env.DISPLAYDEV_API_KEY?.trim();
  return key ? text.split(key).join("[redacted]") : text;
}

export const defaultRunner: DspRunner = (args, opts) =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "dsp", ...args], {
      env: { ...process.env, DISPLAYDEV_SKIP_BROWSER: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`dsp ${args[0]} exited ${code}: ${redactDisplayKey(stderr).slice(0, 300)}`));
    });
    if (opts?.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });

export function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n+/);
  return match ? markdown.slice(match[0].length) : markdown;
}

export interface PublishOptions {
  markdown: string;
  name: string;
  visibility?: "private" | "company";
  share?: string[];
  id?: string;
  baseVersion?: number;
}

export interface PublishResult {
  shortId: string;
  url: string;
  version: number;
}

/** Authenticated publish prints `<url>` then `Published|Updated <name> (<shortId>) v<n>`. */
function parsePublishOutput(stdout: string): PublishResult {
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const tail = lines[lines.length - 1] ?? "";
  const match = /^(?:Published|Updated) .* \(([\w-]+)\) v(\d+)$/.exec(tail);
  if (lines.length < 2 || !match) {
    throw new Error(`unexpected dsp publish output: ${redactDisplayKey(stdout).slice(0, 200)}`);
  }
  return { shortId: match[1] ?? "", url: lines[0] ?? "", version: Number(match[2]) };
}

export async function publishArtifact(
  opts: PublishOptions,
  runner: DspRunner = defaultRunner,
): Promise<PublishResult> {
  const body = stripFrontmatter(opts.markdown);
  const flags = ["--name", opts.name, "--visibility", opts.visibility ?? "private", "--theme", "github"];
  for (const email of opts.share ?? []) flags.push("--share", email);
  if (opts.id) {
    // Update path: stdin re-publish (the only stdin mode the CLI allows).
    const args = ["publish", "-", ...flags, "--id", opts.id, "--base-version", String(opts.baseVersion ?? 1), "--reload"];
    const { stdout } = await runner(args, { stdin: body });
    return parsePublishOutput(stdout);
  }
  // Create path: `publish -` exits 2 without --id, so publish a temp .md by path.
  const tmpPath = join(tmpdir(), `dsp-publish-${randomUUID()}.md`);
  await writeFile(tmpPath, body, "utf8");
  try {
    const { stdout } = await runner(["publish", tmpPath, ...flags]);
    return parsePublishOutput(stdout);
  } finally {
    await rm(tmpPath, { force: true });
  }
}

export interface DisplayComment {
  id: string;
  body: string;
  textQuote: string;
  createdOnVersion: number;
}

interface CommentRow {
  id?: string;
  body?: string;
  anchor?: { textQuote?: { exact?: string } | string };
  createdOnVersion?: number | string;
}

export async function listComments(
  artifactId: string,
  opts: { status?: "open" | "resolved" } = {},
  runner: DspRunner = defaultRunner,
): Promise<DisplayComment[]> {
  const { stdout } = await runner(["comment", "list", "--artifact", artifactId, "--status", opts.status ?? "open"]);
  const parsed = JSON.parse(stdout) as { data?: CommentRow[] } | CommentRow[];
  const rows = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
  return rows.map((r) => {
    const quote = r.anchor?.textQuote;
    return {
      id: String(r.id ?? ""),
      body: String(r.body ?? ""),
      textQuote: typeof quote === "string" ? quote : String(quote?.exact ?? ""),
      createdOnVersion: Number(r.createdOnVersion ?? 0),
    };
  });
}

export async function resolveThread(rootCommentId: string, runner: DspRunner = defaultRunner): Promise<void> {
  await runner(["thread", "resolve", rootCommentId]);
}

export async function deleteArtifact(shortId: string, runner: DspRunner = defaultRunner): Promise<void> {
  await runner(["delete", shortId, "--confirm"]);
}
