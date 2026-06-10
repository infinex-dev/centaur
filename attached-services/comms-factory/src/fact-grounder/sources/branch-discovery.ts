/**
 * Source-of-truth discovery for the fact grounder.
 *
 * The platform monorepo is "a part-complete, part-abandoned, part-developed
 * city" — the truth for a launch lives in whichever branch/PR is newest, most
 * complete, and actually ship-bound, NOT on `main` and NOT in every branch that
 * merely mentions the feature. This module enumerates candidate sources
 * (open/merged/closed PRs by title, plus PR-less branches) and ranks them by
 * freshness × maturity × code-vs-plan, so the grounder can ground against the
 * live stratum while logging the ruins as context rather than asserting them.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { getPlatformRoot } from "./platform-code.js";

const execFileAsync = promisify(execFile);

/**
 * Fetch a branch into the local platform checkout and return a stable local ref
 * to search. The ref is then passed to groundFacts({ ref }) so grep/read run
 * against the branch's tree.
 *
 * Fetches over HTTPS — the same transport discoverSources already uses (`gh`,
 * `git ls-remote https://...`). The checkout's `origin` is `git@github.com:` and
 * fails headless ("Permission denied (publickey)") whenever no SSH agent is
 * loaded, which silently drops discovery back to grounding `main`. HTTPS rides
 * the gh credential helper and needs no key.
 */
export async function fetchRef(
  branch: string,
  opts: { repo?: string; root?: string } = {},
): Promise<string> {
  const root = opts.root ?? getPlatformRoot();
  const repo = opts.repo ?? "infinex-xyz/platform";
  const localRef = `refs/comms-factory/${branch}`;
  try {
    await execFileAsync("git", [
      "-C", root, "fetch", `https://github.com/${repo}.git`,
      `${branch}:${localRef}`, "--force", "--quiet",
    ], { maxBuffer: 16 * 1024 * 1024 });
    return localRef;
  } catch (fetchErr) {
    // The branch may have been merged and DELETED on the remote after shipping
    // (the launch-day blind spot: a feature is live, but `git fetch <branch>`
    // returns "couldn't find remote ref"). Rather than abort — which silently
    // drops grounding back to a stale `main` that lacks the just-shipped
    // feature — fall back to the already-cached remote-tracking ref if it
    // resolves locally. The cached tree still carries the shipped code.
    const cached = `refs/remotes/origin/${branch}`;
    try {
      await execFileAsync("git", ["-C", root, "rev-parse", "--verify", "--quiet", cached], {
        maxBuffer: 1024 * 1024,
      });
      return cached;
    } catch {
      const reason = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      throw new Error(
        `fetchRef: could not fetch '${branch}' from ${repo} (${reason}) and no cached ` +
          `origin/${branch} exists locally. If the branch was merged + deleted, ground ` +
          `against the merge commit or main instead.`,
      );
    }
  }
}

/**
 * Refresh the local checkout's origin/<branch> (default main) to LIVE via HTTPS
 * (gh credential helper, no SSH key) WITHOUT touching the working tree — it
 * updates the remote-tracking ref only, never checks out. Grounding + emit branch
 * off origin/main, so this keeps them from running against a stale local main
 * (the clone can silently drift weeks behind; the SSH `origin` fetch fails on
 * keyless envs). Best-effort: on failure (offline) the existing ref stays. No
 * stash needed because we never touch the working tree. Returns the live short
 * SHA if it refreshed, else null.
 */
export async function refreshPlatformMain(
  opts: { repo?: string; root?: string; branch?: string } = {},
): Promise<string | null> {
  const root = opts.root ?? getPlatformRoot();
  const repo = opts.repo ?? "infinex-xyz/platform";
  const branch = opts.branch ?? "main";
  try {
    await execFileAsync("git", [
      "-C", root, "fetch", `https://github.com/${repo}.git`,
      `${branch}:refs/remotes/origin/${branch}`, "--force", "--quiet",
    ], { maxBuffer: 256 * 1024 * 1024 });
    const { stdout } = await execFileAsync("git", [
      "-C", root, "rev-parse", "--short", `refs/remotes/origin/${branch}`,
    ], { maxBuffer: 1024 * 1024 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// Conventional-commit type is the reliable plan signal — a `docs(...)`/`chore(...plan)`
// title or a plan-ish branch name. A bare "plan" word inside a feat: title (e.g.
// "feat(bridge): ... refresh plan") is NOT a plan — feat overrides.
const PLAN_TITLE = /^docs[(:]|^chore\([^)]*plan/i;
const PLAN_BRANCH = /plan|research|remediation|spike|experiment|\bwip\b|prototype/i;
const FEAT_TITLE = /^feat[(:]/i;

export interface SourceCandidate {
  number: number | null;
  title: string;
  branch: string;
  state: string;            // OPEN | DRAFT | MERGED | CLOSED | BRANCH
  updatedAt: string | null;
  daysAgo: number | null;
  reviewDecision: string | null;
  kind: "code" | "plan";
  status: "in-flight" | "in-flight-draft" | "merged" | "abandoned" | "branch-no-pr";
  stale: boolean;
  score: number;
  notes: string[];
}

export interface DiscoveryResult {
  query: string;
  repo: string;
  primary: SourceCandidate | null;
  candidates: SourceCandidate[];   // ranked desc by score
}

interface RawPR {
  number: number;
  title: string;
  headRefName: string;
  state: string;
  isDraft: boolean;
  updatedAt: string;
  reviewDecision: string | null;
}

const EXTRACT_MODEL = process.env.COMMS_GROUNDER_MODEL ?? "claude-sonnet-4-6";

/**
 * Extract the feature/product actually being LAUNCHED from a release brief, as a
 * short query for matching a PR/branch title. A keyword lexicon can't do this:
 * briefs name the new product ("Collect Crypt") AND compare it to shipped ones
 * ("similar to Perps (HL/Lighter)") in the same sentence, and the new product —
 * comms-factory's whole job — is by definition never in a hardcoded list while
 * the comparison almost always is. So a lexicon locks onto the analogy and
 * searches the wrong branch. An LLM reads which feature is the subject.
 *
 * Returns null when no feature is identifiable; the caller then grounds main + docs.
 */
export async function extractFeatureSubject(
  brief: string,
  client: Anthropic = new Anthropic(),
): Promise<string | null> {
  const prompt = `A product release brief announces exactly ONE feature/product launch. It often also mentions OTHER features purely as comparisons or analogies (e.g. "similar to Perps", "like the Bridge flow", "the way Spot works"). Those are NOT the subject.

Return ONLY the name of the feature being LAUNCHED, as a short query (1-3 words) suitable for matching a GitHub PR/branch title. Prefer the specific product, integration, or partner NAME — a proper noun such as "Bridge", "Swapper", "Hyperliquid", "Collect" — over a generic capability category like "fiat on-ramps", "deposits", or "trading"; branches and PRs are named after the product/integration, not the category. Ignore any feature mentioned only as a comparison. Reply in plain text only: no markdown, asterisks, backticks, or quotes. If no specific feature is identifiable, reply with the single word NONE.

Brief:
${brief}`;

  try {
    const res = await client.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 32,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      // Strip markdown/punctuation the model sometimes wraps the answer in
      // (e.g. `**Fiat on ramps**`) — a `**`-wrapped query matches zero PR titles.
      .replace(/[*`_"']/g, "")
      .trim();
    return !text || /^none$/i.test(text) ? null : text;
  } catch {
    return null;
  }
}

export async function discoverSources(
  query: string,
  opts: { repo?: string; limit?: number; now?: Date } = {},
): Promise<DiscoveryResult> {
  const repo = opts.repo ?? "infinex-xyz/platform";
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 25;

  const prs = await listPRs(query, repo, limit);
  const prBranches = new Set(prs.map((p) => p.headRefName));

  const candidates = prs.map((p) => scorePR(p, now));

  // PR-less branches matching the query — hole #1 (awareness without authority).
  for (const branch of await listBranchesWithoutPRs(query, repo, prBranches)) {
    candidates.push({
      number: null, title: branch, branch, state: "BRANCH", updatedAt: null, daysAgo: null,
      reviewDecision: null, kind: PLAN_BRANCH.test(branch) ? "plan" : "code",
      status: "branch-no-pr", stale: false, score: 10,
      notes: ["branch with no open PR — investigate manually; freshness unknown"],
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  // Highest-scored acceptable source; prefer code but fall back to best available.
  const acceptable = candidates.filter(
    (c) => c.status !== "abandoned" && c.status !== "branch-no-pr" && !c.stale,
  );
  const primary = acceptable.find((c) => c.kind === "code") ?? acceptable[0] ?? null;
  return { query, repo, primary, candidates };
}

function scorePR(p: RawPR, now: Date): SourceCandidate {
  const daysAgo = Math.round((now.getTime() - new Date(p.updatedAt).getTime()) / 86_400_000);
  const isFeat = FEAT_TITLE.test(p.title);
  const isPlan = !isFeat && (PLAN_TITLE.test(p.title) || PLAN_BRANCH.test(p.headRefName));
  const stale = daysAgo > 90;
  const notes: string[] = [];

  let score = 0;
  // state base — open ship-bound work beats already-merged baseline beats ruins
  if (p.state === "OPEN" && !p.isDraft) { score += 50; }
  else if (p.state === "OPEN" && p.isDraft) { score += 25; notes.push("draft"); }
  else if (p.state === "MERGED") { score += 30; notes.push("merged (live baseline)"); }
  else { score += 5; notes.push("closed (likely superseded/abandoned)"); }

  score += Math.max(0, 40 - Math.max(0, daysAgo)); // freshness decay
  if (isFeat) { score += 15; notes.push("feat: implementation"); }
  if (isPlan) { score -= 30; notes.push("plan/research — not the implementation"); }
  if (p.reviewDecision === "APPROVED") { score += 10; notes.push("approved"); }
  if (stale) { score -= 25; notes.push(`stale: ${daysAgo}d since update`); }

  const status: SourceCandidate["status"] =
    p.state === "CLOSED" ? "abandoned"
    : p.state === "MERGED" ? "merged"
    : p.isDraft ? "in-flight-draft"
    : "in-flight";

  return {
    number: p.number, title: p.title, branch: p.headRefName, state: p.state,
    updatedAt: p.updatedAt, daysAgo, reviewDecision: p.reviewDecision,
    kind: isPlan ? "plan" : "code", status, stale, score, notes,
  };
}

async function listPRs(query: string, repo: string, limit: number): Promise<RawPR[]> {
  try {
    const { stdout } = await execFileAsync("gh", [
      "pr", "list", "--repo", repo, "--search", `${query} in:title`, "--state", "all",
      "--json", "number,title,headRefName,state,isDraft,updatedAt,reviewDecision", "--limit", String(limit),
    ], { maxBuffer: 8 * 1024 * 1024 });
    return JSON.parse(stdout) as RawPR[];
  } catch {
    return [];
  }
}

async function listBranchesWithoutPRs(query: string, repo: string, covered: Set<string>): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", [
      "ls-remote", "--heads", `https://github.com/${repo}.git`, `*${query}*`,
    ], { maxBuffer: 8 * 1024 * 1024 });
    return stdout.split("\n")
      .map((l) => l.split("refs/heads/")[1]?.trim())
      .filter((b): b is string => typeof b === "string" && b.length > 0 && !covered.has(b))
      .slice(0, 10);
  } catch {
    return [];
  }
}
