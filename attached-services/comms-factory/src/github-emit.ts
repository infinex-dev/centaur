/**
 * REST-only platform emit: deterministic branch ref + Contents API PUTs (blob
 * sha => clean replace, no fast-forward concept) + Pulls API. Replaces the
 * git/gh-in-pod path (emitLaunchPR stays as the operator-laptop break-glass
 * twin). Idempotent: route-level pre-flight finds an existing PR; 422s on
 * ref/PR creation resolve to "already there"; contents are re-read from the
 * BRANCH on retry so replays never double-apply transforms.
 * The token is used ONLY as an Authorization header value.
 */
import { createTwoFilesPatch } from "diff";
import {
  appendFeatureCopyEntry,
  BLOG_DIR,
  buildPrBody,
  describeRoadmapChanges,
  ensureTrailingNewline,
  extractChangelogTitle,
  FEATURES_DATA_PATH,
  markRoadmapNodeDone,
  ROADMAP_DATA_PATH,
  type LaunchPackage,
  type RoadmapChangeSummary,
} from "./emit-platform-pr.js";
import type { EmitPackage } from "./launch-package.js";

export interface GithubEmitOptions {
  token: string;
  repo: string; // "owner/name"
  branch: string;
  dryRun: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface GithubEmitResult {
  ok: boolean;
  error?: "github_permission_denied" | "github_emit_failed";
  status?: number;
  /**
   * Token-safe failure context: repo-shape/user-input transform messages
   * ("roadmap node not found: X") or the "github_unreachable" transport
   * marker. The token only ever lives in a request header, never a message.
   */
  detail?: string;
  prUrl: string | null;
  plannedDiff: string | null;
  branch: string;
  existing?: boolean;
  /** Per-file skips (target absent at the ref) — surfaced, never silently dropped. */
  skipped: string[];
}

type Gh = (path: string, init?: RequestInit) => Promise<{ status: number; json: unknown }>;

function makeGh(opts: GithubEmitOptions): Gh {
  const base = (opts.baseUrl ?? process.env.GITHUB_API_BASE_URL ?? "https://api.github.com").replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  return async (path, init) => {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      // Transport-level rejection (DNS, ECONNREFUSED, reset): keep the typed
      // contract — a constant message, never the raw cause (token-safe).
      throw Object.assign(new Error("github_unreachable"), { status: 502 });
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, json };
  };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

const b64encode = (s: string) => Buffer.from(s, "utf8").toString("base64");
const b64decode = (s: string) => Buffer.from(s, "base64").toString("utf8");

interface FileChange { path: string; before: string | null; after: string; sha: string | null; skip: boolean }

function failResult(branch: string, status: number, detail?: string): GithubEmitResult {
  return {
    ok: false,
    error: status === 401 || status === 403 ? "github_permission_denied" : "github_emit_failed",
    status,
    ...(detail ? { detail } : {}),
    prUrl: null,
    plannedDiff: null,
    branch,
    skipped: [],
  };
}

export async function emitViaRest(pkg: EmitPackage, opts: GithubEmitOptions): Promise<GithubEmitResult> {
  try {
    return await emitViaRestInner(pkg, opts);
  } catch (error) {
    // Transport rejections (and any other stray throw in the network phases)
    // resolve to the typed failure envelope — callers never see a raw throw.
    const typed = error as { status?: number };
    if (typed.status === undefined) {
      // Unexpected programmer-error throw (not a typed transport failure) — log it so
      // it doesn't silently masquerade as a soft GitHub failure.
      const detail = error instanceof Error ? error.message.slice(0, 400) : String(error);
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", service: "comms-factory-api", event: "github_emit_unexpected", detail }));
    }
    return failResult(
      opts.branch,
      typed.status ?? 500,
      error instanceof Error ? error.message.slice(0, 200) : undefined,
    );
  }
}

async function emitViaRestInner(pkg: EmitPackage, opts: GithubEmitOptions): Promise<GithubEmitResult> {
  const gh = makeGh(opts);
  const [owner] = opts.repo.split("/");
  const skipped: string[] = [];
  const fail = (status: number, detail?: string): GithubEmitResult =>
    failResult(opts.branch, status, detail);

  // 1. Pre-flight idempotency — BEFORE any mutation (double-click / crash-retry).
  const preflight = await gh(`/repos/${opts.repo}/pulls?head=${encodeURIComponent(`${owner}:${opts.branch}`)}&state=open`);
  if (preflight.status >= 400) return fail(preflight.status);
  const existingPr = Array.isArray(preflight.json) ? (preflight.json[0] as { html_url?: string } | undefined) : undefined;
  if (existingPr?.html_url) {
    return { ok: true, prUrl: existingPr.html_url, plannedDiff: null, branch: opts.branch, existing: true, skipped };
  }

  // 2. Base sha.
  const ref = await gh(`/repos/${opts.repo}/git/ref/heads/main`);
  if (ref.status >= 400) return fail(ref.status);
  const baseSha = (ref.json as { object?: { sha?: string } })?.object?.sha;
  if (!baseSha) return fail(500);

  // Helper: read a file at a ref (null when absent).
  const readFileAt = async (path: string, at: string): Promise<{ content: string; sha: string } | null> => {
    const res = await gh(`/repos/${opts.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(at)}`);
    if (res.status === 404) return null;
    if (res.status >= 400) throw Object.assign(new Error("github_read_failed"), { status: res.status });
    const body = res.json as { content?: string; sha?: string };
    return { content: b64decode(body.content ?? ""), sha: body.sha ?? "" };
  };

  // 3-4. Compute file changes (dry-run reads from main; real path reads from the
  // branch AFTER creating it, so retries see already-applied transforms).
  let roadmapChanges: RoadmapChangeSummary[] = [];
  const readRef = opts.dryRun ? "main" : opts.branch;

  if (!opts.dryRun) {
    const created = await gh(`/repos/${opts.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${opts.branch}`, sha: baseSha }),
    });
    // 422 "Reference already exists" => crash-retry — continue idempotently.
    if (created.status >= 400 && created.status !== 422) return fail(created.status);
  }

  let changes: FileChange[];
  try {
    changes = [];
    if (pkg.changelogMd) {
      const path = `${BLOG_DIR}/${pkg.changelogSlug}.md`;
      const current = await readFileAt(path, readRef);
      const after = ensureTrailingNewline(pkg.changelogMd);
      changes.push({ path, before: current?.content ?? null, after, sha: current?.sha ?? null, skip: current?.content === after });
    }
    if (pkg.roadmapTick) {
      const current = await readFileAt(ROADMAP_DATA_PATH, readRef);
      if (current) {
        roadmapChanges = describeRoadmapChanges(current.content, pkg.roadmapTick);
        const after = markRoadmapNodeDone(current.content, pkg.roadmapTick);
        changes.push({ path: ROADMAP_DATA_PATH, before: current.content, after, sha: current.sha, skip: after === current.content });
      } else {
        // Surfaced, never silently dropped: an approved channel must not vanish.
        skipped.push(`${ROADMAP_DATA_PATH} not found at ${readRef} — change skipped`);
      }
    }
    if (pkg.featureCard) {
      const current = await readFileAt(FEATURES_DATA_PATH, readRef);
      if (current) {
        // Replay-safe skip: appendFeatureCopyEntry re-indents the entry when
        // splicing, so raw-prefix matching can never hit. Intra-line content
        // survives — match on the trimmed title property line instead.
        const marker = pkg.featureCard.dataTsEntry
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("title:"));
        const alreadyApplied = Boolean(marker && current.content.includes(marker));
        const after = alreadyApplied ? current.content : appendFeatureCopyEntry(current.content, pkg.featureCard.dataTsEntry);
        changes.push({ path: FEATURES_DATA_PATH, before: current.content, after, sha: current.sha, skip: alreadyApplied });
      } else {
        skipped.push(`${FEATURES_DATA_PATH} not found at ${readRef} — change skipped`);
      }
    }
  } catch (error) {
    // Transform errors here are repo-shape/user-input messages ("roadmap node
    // not found: X") — actionable and token-safe by construction.
    return fail(
      (error as { status?: number }).status ?? 500,
      error instanceof Error ? error.message.slice(0, 200) : undefined,
    );
  }

  if (opts.dryRun) {
    const plannedDiff = changes
      .map((c) => createTwoFilesPatch(c.path, c.path, c.before ?? "", c.after))
      .join("\n");
    return { ok: true, prUrl: null, plannedDiff, branch: opts.branch, skipped };
  }

  // 5. PUT contents (blob sha => clean replace), skipping already-applied files.
  for (const change of changes) {
    if (change.skip) continue;
    const put = await gh(`/repos/${opts.repo}/contents/${encodePath(change.path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Emit ${pkg.changelogSlug} launch comms: ${change.path}`,
        content: b64encode(change.after),
        branch: opts.branch,
        ...(change.sha ? { sha: change.sha } : {}),
      }),
    });
    if (put.status >= 400) return fail(put.status);
  }

  // 6. Open the PR (422 "already exists" => fetch and return it).
  const title = pkg.changelogMd
    ? extractChangelogTitle(pkg.changelogMd, pkg.changelogSlug)
    : `Update FEATURES_COPY: ${pkg.changelogSlug}`;
  const body = pkg.changelogMd
    ? buildPrBody(pkg as LaunchPackage, roadmapChanges)
    : `Emitted by comms-factory from an approved launch package.\n\n- Feature card: appended to \`FEATURES_COPY[]\`\n\nhuman-approve, DO NOT merge`;
  const pr = await gh(`/repos/${opts.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head: opts.branch, base: "main", body }),
  });
  if (pr.status === 422) {
    const again = await gh(`/repos/${opts.repo}/pulls?head=${encodeURIComponent(`${owner}:${opts.branch}`)}&state=open`);
    const found = Array.isArray(again.json) ? (again.json[0] as { html_url?: string } | undefined) : undefined;
    if (found?.html_url) return { ok: true, prUrl: found.html_url, plannedDiff: null, branch: opts.branch, existing: true, skipped };
    return fail(422);
  }
  if (pr.status >= 400) return fail(pr.status);
  return { ok: true, prUrl: (pr.json as { html_url?: string })?.html_url ?? null, plannedDiff: null, branch: opts.branch, skipped };
}
