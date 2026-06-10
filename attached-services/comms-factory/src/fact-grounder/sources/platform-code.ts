/**
 * Internal fact source: platform code introspection.
 *
 * Wraps ripgrep (`rg`) against the Infinex platform monorepo.
 * PLATFORM_ROOT is env-driven — defaults to ~/Sites/infinex-xyz/platform.
 * Tests provide a fixture directory via PLATFORM_ROOT env override.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { promisify } from "node:util";
import { isAbsolute, relative, resolve } from "node:path";
import { homedir } from "node:os";

// -- args intentionally declared before use below (cleaned up) ---

const execFileAsync = promisify(execFile);

// Use /usr/bin/grep directly — rg is a Claude Code shell wrapper
// and not available as a real binary via execFile.
const GREP_BIN = "/usr/bin/grep";

const DEFAULT_PLATFORM_ROOT = resolve(homedir(), "Sites/infinex-xyz/platform");

export function getPlatformRoot(): string {
  return process.env.PLATFORM_ROOT ?? DEFAULT_PLATFORM_ROOT;
}

// Runtime ref context. When set (per grounding run), grepPlatform/readPlatformFile
// search the platform repo AT THAT GIT REF (a branch / PR head) instead of the
// working tree — so a launch's unmerged code on a feature branch is visible. A
// feature branch is a superset of main, so a ref-scoped search also covers main.
let activePlatformRef: string | undefined;
export function setActivePlatformRef(ref: string | undefined): void {
  activePlatformRef = ref;
}
export function getActivePlatformRef(): string | undefined {
  return activePlatformRef;
}

// Default file types to grep. Includes *.md because a launch's positioning,
// category data, and product narrative live in docs/ (brainstorms, plans,
// collectibles research) — not just *.ts code. The Collector Crypt category
// census (Pokemon/One Piece/sports cards) is markdown-only.
const DEFAULT_GREP_GLOBS = ["*.ts", "*.tsx", "*.json", "*.md"];

// Tolerate a comma-joined glob string (e.g. "*.ts,*.md") — the grounding model
// sometimes passes the whole default set as one value, which as a single
// pathspec matches nothing. Split it back into individual globs.
function parseGlobs(glob: string | undefined): string[] {
  if (!glob) return DEFAULT_GREP_GLOBS;
  const parts = glob.split(",").map((g) => g.trim()).filter(Boolean);
  return parts.length > 0 ? parts : DEFAULT_GREP_GLOBS;
}

// Cap matches PER FILE before the global cap, so a broad pattern returns BREADTH
// (many files) instead of all results from the first 2-3 chatty files. Without
// this, a `Collector Crypt` grep is fully consumed by the wordy requirements docs
// and never surfaces the research doc where the category census lives.
const PER_FILE_CAP = 3;
function capPerFile(matches: GrepMatch[], total: number): GrepMatch[] {
  const seen = new Map<string, number>();
  const out: GrepMatch[] = [];
  for (const m of matches) {
    const n = seen.get(m.file) ?? 0;
    if (n >= PER_FILE_CAP) continue;
    seen.set(m.file, n + 1);
    out.push(m);
    if (out.length >= total) break;
  }
  return out;
}

export interface GrepMatch {
  file: string;     // relative to PLATFORM_ROOT
  line: number;
  preview: string;  // the matched line content (trimmed)
}

export interface GrepOptions {
  /** Narrow the search to a sub-path within PLATFORM_ROOT. */
  path?: string;
  maxResults?: number;
  /** File glob pattern, e.g. "*.ts". Passed as -g to rg. */
  glob?: string;
  /** Git ref (branch/PR head) to search instead of the working tree. Defaults to the active ref. */
  ref?: string;
}

/**
 * Search the platform repo using ripgrep.
 * Returns [] (not throws) when rg finds no matches.
 * Throws when PLATFORM_ROOT doesn't exist or rg is not installed.
 */
export async function grepPlatform(
  pattern: string,
  opts: GrepOptions = {},
): Promise<GrepMatch[]> {
  const root = resolve(getPlatformRoot());
  if (!existsSync(root)) {
    throw new Error(
      `PLATFORM_ROOT does not exist: ${root}. Set PLATFORM_ROOT env var to the platform monorepo path.`,
    );
  }
  const ref = opts.ref ?? activePlatformRef;
  if (ref) return grepPlatformAtRef(root, ref, pattern, opts);
  const rootReal = realpathSync(root);

  const searchPath = opts.path ? resolve(rootReal, opts.path) : rootReal;
  if (!existsSync(searchPath)) {
    throw new Error(`grep path does not exist: ${searchPath}`);
  }
  const searchReal = realpathSync(searchPath);
  if (!isWithin(rootReal, searchReal)) {
    throw new Error(`grep path escapes PLATFORM_ROOT: ${searchReal}`);
  }
  const maxResults = opts.maxResults ?? 20;

  const globs = parseGlobs(opts.glob);

  const finalArgs = [
    "-rn",
    "-i",
    "--binary-files=without-match",
    "--exclude-dir=node_modules",
    "--exclude-dir=.git",
    "--exclude-dir=dist",
    "--exclude-dir=.next",
    "--exclude-dir=.turbo",
    ...globs.flatMap((g) => ["--include", g]),
    pattern,
    searchReal,
  ];

  try {
    const { stdout } = await execFileAsync(GREP_BIN, finalArgs, { maxBuffer: 2 * 1024 * 1024 });
    const parsed = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        // Format: /abs/path/to/file.ts:42:  matched content here
        const m = line.match(/^(.+?):(\d+):(.*)$/);
        if (!m) return null;
        const [, filePath, lineNum, content] = m;
        const preview = content!.trim();
        return {
          file: relative(rootReal, filePath!),
          line: parseInt(lineNum!, 10),
          preview: preview.length > 200 ? preview.slice(0, 200) + "…" : preview,
        };
      })
      .filter((m): m is GrepMatch => m !== null);
    return capPerFile(parsed, maxResults);
  } catch (err: unknown) {
    // grep exits with code 1 when there are no matches — treat as empty result
    if (isExecError(err) && err.code === 1) return [];
    throw err;
  }
}

/**
 * Search the platform repo at a specific git ref (branch / PR head) using
 * `git grep`. A feature branch is a superset of main, so this covers both
 * merged code and unmerged code on the branch. Excludes the bare_metal/ plan
 * tree (decision records / fixtures, not runtime code).
 */
async function grepPlatformAtRef(
  root: string,
  ref: string,
  pattern: string,
  opts: GrepOptions,
): Promise<GrepMatch[]> {
  const maxResults = opts.maxResults ?? 20;
  const globs = parseGlobs(opts.glob);
  const pathspecs = opts.path ? globs.map((g) => `${opts.path}/${g}`) : globs;
  const args = [
    "-C", root, "grep", "-n", "-I", "-i", "-E", "--no-color",
    "-e", pattern, ref, "--",
    ...pathspecs,
    ":(exclude)bare_metal",
    ":(exclude)apps/design-prototype-app",
    ":(exclude,glob)**/node_modules/**",
  ];
  try {
    const { stdout } = await execFileAsync("git", args, { maxBuffer: 4 * 1024 * 1024 });
    const parsed = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        // git grep with a ref prints: "<ref>:<path>:<line>:<content>"
        const afterRef = line.startsWith(`${ref}:`) ? line.slice(ref.length + 1) : line;
        const m = afterRef.match(/^(.+?):(\d+):(.*)$/);
        if (!m) return null;
        const preview = m[3]!.trim();
        return {
          file: m[1]!,
          line: parseInt(m[2]!, 10),
          preview: preview.length > 200 ? preview.slice(0, 200) + "…" : preview,
        };
      })
      .filter((m): m is GrepMatch => m !== null);
    return capPerFile(parsed, maxResults);
  } catch (err: unknown) {
    if (isExecError(err) && err.code === 1) return []; // git grep exits 1 on no matches
    throw err;
  }
}

export interface ReadPlatformFileOptions {
  startLine?: number;
  endLine?: number;
  /** Git ref to read from instead of the working tree. Defaults to the active ref. */
  ref?: string;
}

/**
 * Read a file from the platform repo (by relative path).
 * Optional line range avoids reading large files into memory.
 */
export async function readPlatformFile(
  relativePath: string,
  opts: ReadPlatformFileOptions = {},
): Promise<string> {
  const ref = opts.ref ?? activePlatformRef;
  let content: string;
  if (ref) {
    const { stdout } = await execFileAsync("git", [
      "-C", resolve(getPlatformRoot()), "show", `${ref}:${relativePath}`,
    ], { maxBuffer: 4 * 1024 * 1024 });
    content = stdout;
  } else {
    const root = resolve(getPlatformRoot());
    const rootReal = realpathSync(root);
    const absPath = resolve(rootReal, relativePath);
    if (!existsSync(absPath)) {
      throw new Error(`Platform file not found: ${relativePath} (resolved to ${absPath})`);
    }
    const fileReal = realpathSync(absPath);
    if (!isWithin(rootReal, fileReal)) {
      throw new Error(`read path escapes PLATFORM_ROOT: ${fileReal}`);
    }
    content = await readFile(fileReal, "utf8");
  }
  if (opts.startLine === undefined && opts.endLine === undefined) return content;

  const lines = content.split("\n");
  const start = Math.max(0, (opts.startLine ?? 1) - 1);
  const end = opts.endLine ? Math.min(lines.length, opts.endLine) : lines.length;
  return lines.slice(start, end).join("\n");
}

function isExecError(err: unknown): err is { code: number } {
  return typeof err === "object" && err !== null && "code" in err;
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
