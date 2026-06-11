import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import ts from "typescript";

const execFileAsync = promisify(execFile);

const ROADMAP_DATA_PATH = "apps/public-website/src/app/(site)/roadmap/data.ts";
const FEATURES_DATA_PATH = "apps/public-website/src/app/(site)/features/data.ts";
const BLOG_DIR = "apps/content-app/content/blog";
const DEFAULT_PLATFORM_ROOT = resolve(homedir(), "Sites/infinex-xyz/platform");

export type LaunchPackage = {
  changelogSlug: string;
  changelogMd: string;
  roadmapTick?: { nodeName: string; parentName?: string };
  featureCard?: { dataTsEntry: string };
};

export type EmitOpts = {
  platformRoot?: string;
  dryRun?: boolean;
  branch?: string;
};

export type EmitResult = {
  prUrl: string | null;
  plannedDiff: string;
  prDescription: string;
  roadmapChanges: RoadmapChangeSummary[];
};

export type RoadmapChangeSummary = {
  path: string;
  from: string | null;
  to: "done";
  reason: "selected" | "parent-rollup";
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandRunner = (
  command: string,
  args: readonly string[],
  opts?: { cwd?: string; maxBuffer?: number },
) => Promise<CommandResult>;

type RoadmapNode = {
  name: string;
  object: ts.ObjectLiteralExpression;
  parent: RoadmapNode | null;
  status: string | null;
  nameProp: ts.PropertyAssignment;
  statusProp: ts.PropertyAssignment | null;
  childrenArray: ts.ArrayLiteralExpression | null;
};

type Edit = {
  start: number;
  end: number;
  text: string;
};

export async function emitLaunchPR(pkg: LaunchPackage, opts: EmitOpts = {}): Promise<EmitResult> {
  return emitLaunchPRWithRunner(pkg, opts, defaultCommandRunner);
}

async function emitLaunchPRWithRunner(
  pkg: LaunchPackage,
  opts: EmitOpts,
  runCommand: CommandRunner,
): Promise<EmitResult> {
  assertLaunchPackage(pkg);
  const emitPkg: LaunchPackage = {
    ...pkg,
    changelogMd: markChangelogPublished(pkg.changelogMd),
  };

  const platformRoot = resolve(opts.platformRoot ?? process.env.PLATFORM_ROOT ?? DEFAULT_PLATFORM_ROOT);
  if (!existsSync(platformRoot)) {
    throw new Error(`platform root does not exist: ${platformRoot}`);
  }

  const dryRun = opts.dryRun ?? true;
  const branch = opts.branch ?? defaultBranchName(emitPkg.changelogSlug);
  assertSafeBranch(branch);

  const worktreePath = join("/tmp", `cf-emit-${Date.now()}-${process.pid}`);
  const touchedPaths: string[] = [];
  let roadmapChanges: RoadmapChangeSummary[] = [];
  let worktreeCreated = false;

  try {
    if (!dryRun) {
      await runGit(runCommand, platformRoot, ["fetch", "origin", "main"]);
    }

    await runGit(runCommand, platformRoot, [
      "worktree",
      "add",
      worktreePath,
      "-b",
      branch,
      "origin/main",
    ]);
    worktreeCreated = true;

    const blogPath = join(BLOG_DIR, `${emitPkg.changelogSlug}.md`);
    const blogMd = await applyInternalNumber(emitPkg.changelogMd, join(worktreePath, BLOG_DIR));
    await writeNewFile(join(worktreePath, blogPath), ensureTrailingNewline(blogMd));
    touchedPaths.push(blogPath);

    if (emitPkg.roadmapTick) {
      const roadmapPath = join(worktreePath, ROADMAP_DATA_PATH);
      const roadmapSource = await readFile(roadmapPath, "utf8");
      roadmapChanges = describeRoadmapChanges(roadmapSource, emitPkg.roadmapTick);
      await writeFile(
        roadmapPath,
        markRoadmapNodeDone(roadmapSource, emitPkg.roadmapTick),
        "utf8",
      );
      touchedPaths.push(ROADMAP_DATA_PATH);
    }

    if (emitPkg.featureCard) {
      const featuresPath = join(worktreePath, FEATURES_DATA_PATH);
      const featuresSource = await readFile(featuresPath, "utf8");
      await writeFile(
        featuresPath,
        appendFeatureCopyEntry(featuresSource, emitPkg.featureCard.dataTsEntry),
        "utf8",
      );
      touchedPaths.push(FEATURES_DATA_PATH);
    }

    await runGit(runCommand, worktreePath, ["add", "--intent-to-add", "--", ...touchedPaths]);
    const plannedDiff = await gitStdout(runCommand, worktreePath, [
      "diff",
      "--no-ext-diff",
      "--",
      ...touchedPaths,
    ]);
    const prDescription = buildPrBody(emitPkg, roadmapChanges);

    if (dryRun) {
      return { prUrl: null, plannedDiff, prDescription, roadmapChanges };
    }

    await runGit(runCommand, worktreePath, ["add", "--", ...touchedPaths]);
    await runGit(runCommand, worktreePath, [
      "commit",
      "--no-verify",
      "-m",
      `Emit ${extractChangelogTitle(emitPkg.changelogMd, emitPkg.changelogSlug)} launch comms`,
    ]);
    await runGit(runCommand, worktreePath, ["push", "-u", "origin", branch]);

    const prUrl = (await runCommand("gh", [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      extractChangelogTitle(emitPkg.changelogMd, emitPkg.changelogSlug),
      "--body",
      prDescription,
    ], { cwd: worktreePath, maxBuffer: 1024 * 1024 })).stdout.trim();

    return { prUrl: prUrl.length > 0 ? prUrl : null, plannedDiff, prDescription, roadmapChanges };
  } finally {
    if (worktreeCreated) {
      await runGitBestEffort(runCommand, platformRoot, ["worktree", "remove", "--force", worktreePath]);
    } else {
      await rm(worktreePath, { recursive: true, force: true });
    }
    if (dryRun) {
      await runGitBestEffort(runCommand, platformRoot, ["branch", "-D", branch]);
    }
  }
}

export type RenumberDirective = { slug: string; internalNumber: number };

export type BatchEmitOpts = EmitOpts & { renumber?: readonly RenumberDirective[] };

export type BatchItemSummary = {
  slug: string;
  action: "create" | "renumber";
  internalNumber: number | null;
  roadmapChanges: RoadmapChangeSummary[];
  publishedFrom: string | null;
};

export type BatchEmitResult = {
  prUrl: string | null;
  plannedDiff: string;
  prDescription: string;
  items: BatchItemSummary[];
};

// Batch sibling of emitLaunchPR: stamps internalNumber onto already-shipped
// posts (`renumber`) and/or creates new launch posts, all in ONE worktree ->
// ONE branch -> ONE PR. The motivating case: stamp the existing #63 and emit
// the new #64 in a single PR instead of two. Renumbers run first so each new
// post auto-derives its number from the freshly-stamped state. Reuses every
// git-safety guard from the single-emit path; never edits the real checkout.
export async function emitBatchLaunchPR(
  packages: readonly LaunchPackage[],
  opts: BatchEmitOpts = {},
): Promise<BatchEmitResult> {
  return emitBatchLaunchPRWithRunner(packages, opts, defaultCommandRunner);
}

async function emitBatchLaunchPRWithRunner(
  packages: readonly LaunchPackage[],
  opts: BatchEmitOpts,
  runCommand: CommandRunner,
): Promise<BatchEmitResult> {
  const renumber = opts.renumber ?? [];
  if (packages.length === 0 && renumber.length === 0) {
    throw new Error("batch emit requires at least one package or renumber directive");
  }
  for (const pkg of packages) assertLaunchPackage(pkg);
  for (const directive of renumber) {
    if (!isSafeSlug(directive.slug)) throw new Error(`unsafe renumber slug: ${directive.slug}`);
    if (!Number.isInteger(directive.internalNumber) || directive.internalNumber <= 0) {
      throw new Error(`renumber internalNumber must be a positive integer: ${directive.internalNumber}`);
    }
  }

  const platformRoot = resolve(opts.platformRoot ?? process.env.PLATFORM_ROOT ?? DEFAULT_PLATFORM_ROOT);
  if (!existsSync(platformRoot)) {
    throw new Error(`platform root does not exist: ${platformRoot}`);
  }

  const dryRun = opts.dryRun ?? true;
  const branch = opts.branch ?? defaultBatchBranchName();
  assertSafeBranch(branch);

  const worktreePath = join("/tmp", `cf-emit-batch-${Date.now()}-${process.pid}`);
  const touchedPaths: string[] = [];
  const items: BatchItemSummary[] = [];
  let worktreeCreated = false;

  try {
    if (!dryRun) {
      await runGit(runCommand, platformRoot, ["fetch", "origin", "main"]);
    }
    await runGit(runCommand, platformRoot, ["worktree", "add", worktreePath, "-b", branch, "origin/main"]);
    worktreeCreated = true;

    for (const directive of renumber) {
      const blogPath = join(BLOG_DIR, `${directive.slug}.md`);
      const absPath = join(worktreePath, blogPath);
      if (!existsSync(absPath)) {
        throw new Error(`cannot renumber: ${blogPath} not found on origin/main`);
      }
      const current = await readFile(absPath, "utf8");
      const stamped = stampInternalNumber(current, directive.internalNumber);
      if (stamped !== current) {
        await writeFile(absPath, stamped, "utf8");
        touchedPaths.push(blogPath);
      }
      items.push({
        slug: directive.slug,
        action: "renumber",
        internalNumber: parseChangelogNumber(stamped),
        roadmapChanges: [],
        publishedFrom: extractPublishedFrom(stamped),
      });
    }

    for (const pkg of packages) {
      const emitPkg: LaunchPackage = { ...pkg, changelogMd: markChangelogPublished(pkg.changelogMd) };
      const blogPath = join(BLOG_DIR, `${emitPkg.changelogSlug}.md`);
      const blogMd = await applyInternalNumber(emitPkg.changelogMd, join(worktreePath, BLOG_DIR));
      await writeNewFile(join(worktreePath, blogPath), ensureTrailingNewline(blogMd));
      touchedPaths.push(blogPath);

      let roadmapChanges: RoadmapChangeSummary[] = [];
      if (emitPkg.roadmapTick) {
        const roadmapAbs = join(worktreePath, ROADMAP_DATA_PATH);
        const roadmapSource = await readFile(roadmapAbs, "utf8");
        roadmapChanges = describeRoadmapChanges(roadmapSource, emitPkg.roadmapTick);
        await writeFile(roadmapAbs, markRoadmapNodeDone(roadmapSource, emitPkg.roadmapTick), "utf8");
        touchedPaths.push(ROADMAP_DATA_PATH);
      }
      if (emitPkg.featureCard) {
        const featuresAbs = join(worktreePath, FEATURES_DATA_PATH);
        const featuresSource = await readFile(featuresAbs, "utf8");
        await writeFile(featuresAbs, appendFeatureCopyEntry(featuresSource, emitPkg.featureCard.dataTsEntry), "utf8");
        touchedPaths.push(FEATURES_DATA_PATH);
      }

      items.push({
        slug: emitPkg.changelogSlug,
        action: "create",
        internalNumber: parseChangelogNumber(blogMd),
        roadmapChanges,
        publishedFrom: extractPublishedFrom(blogMd),
      });
    }

    const uniquePaths = [...new Set(touchedPaths)];
    if (uniquePaths.length === 0) {
      throw new Error("batch emit produced no file changes (every target already up to date)");
    }

    await runGit(runCommand, worktreePath, ["add", "--intent-to-add", "--", ...uniquePaths]);
    const plannedDiff = await gitStdout(runCommand, worktreePath, ["diff", "--no-ext-diff", "--", ...uniquePaths]);
    const prDescription = buildBatchPrBody(items);

    if (dryRun) {
      return { prUrl: null, plannedDiff, prDescription, items };
    }

    await runGit(runCommand, worktreePath, ["add", "--", ...uniquePaths]);
    await runGit(runCommand, worktreePath, ["commit", "--no-verify", "-m", batchCommitMessage(items)]);
    await runGit(runCommand, worktreePath, ["push", "-u", "origin", branch]);

    const prUrl = (await runCommand("gh", [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      batchPrTitle(items),
      "--body",
      prDescription,
    ], { cwd: worktreePath, maxBuffer: 1024 * 1024 })).stdout.trim();

    return { prUrl: prUrl.length > 0 ? prUrl : null, plannedDiff, prDescription, items };
  } finally {
    if (worktreeCreated) {
      await runGitBestEffort(runCommand, platformRoot, ["worktree", "remove", "--force", worktreePath]);
    } else {
      await rm(worktreePath, { recursive: true, force: true });
    }
    if (dryRun) {
      await runGitBestEffort(runCommand, platformRoot, ["branch", "-D", branch]);
    }
  }
}

function defaultBatchBranchName(): string {
  return `cf-emit-batch/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function batchCountLabel(items: readonly BatchItemSummary[]): string {
  const created = items.filter((item) => item.action === "create").length;
  const renumbered = items.filter((item) => item.action === "renumber").length;
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} new entr${created === 1 ? "y" : "ies"}`);
  if (renumbered > 0) parts.push(`${renumbered} renumber${renumbered === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

function batchCommitMessage(items: readonly BatchItemSummary[]): string {
  return `Emit launch comms batch (${batchCountLabel(items)})`;
}

function batchPrTitle(items: readonly BatchItemSummary[]): string {
  return `Launch comms batch: ${batchCountLabel(items)}`;
}

function buildBatchPrBody(items: readonly BatchItemSummary[]): string {
  const lines = [
    "Emitted by comms-factory as a batch from approved launch packages.",
    "",
    "## PR contents",
    "",
  ];
  for (const item of items) {
    if (item.action === "create") {
      const numberSuffix = item.internalNumber !== null ? ` (№ ${item.internalNumber})` : "";
      lines.push(`- New changelog: \`${BLOG_DIR}/${item.slug}.md\`${numberSuffix}`);
      lines.push("  - Publish status: `published: true`");
      for (const change of item.roadmapChanges) {
        const reason = change.reason === "parent-rollup" ? " (auto parent roll-up)" : "";
        lines.push(`  - Roadmap \`${change.path}\`: \`${formatRoadmapStatus(change.from)}\` -> \`${change.to}\`${reason}`);
      }
    } else {
      lines.push(`- Renumber: \`${BLOG_DIR}/${item.slug}.md\` -> \`internalNumber: ${item.internalNumber}\``);
    }
  }
  const scheduled = items.flatMap((item) =>
    item.action === "create" && item.publishedFrom !== null && isFutureTimestamp(item.publishedFrom)
      ? [{ slug: item.slug, publishedFrom: item.publishedFrom }]
      : [],
  );
  lines.push(...goLiveLines(scheduled));
  lines.push("", "human-approve, DO NOT merge");
  return lines.join("\n");
}

export function markRoadmapNodeDone(
  source: string,
  tick: { nodeName: string; parentName?: string },
): string {
  const sourceFile = parseTypeScriptSource(source, ROADMAP_DATA_PATH);
  const root = findRoadmapRoot(sourceFile);
  const allNodes = collectRoadmapNodes(root, null);
  const matches = allNodes.filter((node) =>
    node.name === tick.nodeName &&
    (tick.parentName === undefined || node.parent?.name === tick.parentName));

  if (matches.length === 0) {
    const parentSuffix = tick.parentName ? ` under parent "${tick.parentName}"` : "";
    throw new Error(`roadmap node not found: "${tick.nodeName}"${parentSuffix}`);
  }
  if (matches.length > 1) {
    throw new Error(`roadmap node is ambiguous: "${tick.nodeName}". Provide parentName.`);
  }

  const target = matches[0];
  if (!target) throw new Error("roadmap node selection failed");

  // Roll completion up one level: if the immediate parent isn't already done,
  // tick it too. A shipped child means the parent capability shipped — matching
  // the roadmap convention of done parents over not-done children (e.g. "Send"
  // is done with planned sub-items). The parent's status prop sits outside the
  // children array, so this edit never overlaps the sibling reorder below.
  const edits: Edit[] = [];
  if (target.parent && target.parent.status !== "done") {
    edits.push(statusEdit(source, target.parent, sourceFile));
  }

  const parentArray = target.parent?.childrenArray;
  const targetText = markObjectTextDone(source, target, sourceFile);

  if (!parentArray) {
    edits.push(statusEdit(source, target, sourceFile));
    return applyEdits(source, edits);
  }

  const siblings = target.parent?.childrenArray
    ? collectChildNodes(target.parent.childrenArray, target.parent)
    : [];
  const targetIndex = siblings.findIndex((node) => node.object === target.object);
  if (targetIndex < 0) throw new Error(`roadmap node is not present in its parent children array: "${target.name}"`);

  const firstInProgressIndex = siblings.findIndex((node) =>
    node.object !== target.object && node.status === "in_progress");
  const shouldMove = firstInProgressIndex >= 0 && targetIndex > firstInProgressIndex;

  if (!shouldMove) {
    edits.push(statusEdit(source, target, sourceFile));
    return applyEdits(source, edits);
  }

  const childTexts = siblings.map((node) =>
    node.object === target.object
      ? targetText
      : source.slice(node.object.getStart(sourceFile), node.object.getEnd()));
  const [movingText] = childTexts.splice(targetIndex, 1);
  if (!movingText) throw new Error(`could not move roadmap node: "${target.name}"`);
  const insertionIndex = targetIndex < firstInProgressIndex
    ? firstInProgressIndex - 1
    : firstInProgressIndex;
  childTexts.splice(insertionIndex, 0, movingText);

  edits.push({
    start: parentArray.getStart(sourceFile),
    end: parentArray.getEnd(),
    text: renderArrayWithExistingIndent(source, parentArray, childTexts),
  });
  return applyEdits(source, edits);
}

export function appendFeatureCopyEntry(source: string, dataTsEntry: string): string {
  const entryText = normalizeFeatureEntry(dataTsEntry);
  const sourceFile = parseTypeScriptSource(source, FEATURES_DATA_PATH);
  const featuresArray = findArrayInitializer(sourceFile, "FEATURES_COPY");
  if (!featuresArray) throw new Error("FEATURES_COPY array not found");

  const arrayStart = featuresArray.getStart(sourceFile);
  const arrayEnd = featuresArray.getEnd();
  const closeBracket = source.lastIndexOf("]", arrayEnd - 1);
  if (closeBracket < arrayStart) throw new Error("FEATURES_COPY array closing bracket not found");

  const elementIndent = arrayElementIndent(source, featuresArray, sourceFile);
  const closeIndent = closingBracketIndent(source, closeBracket);
  const insertionStart = closeBracket - closeIndent.length;
  const indentedEntry = indentBlock(entryText, elementIndent);
  const hasElements = featuresArray.elements.length > 0;
  const beforeClose = source.slice(arrayStart + 1, insertionStart);
  const needsSeparator = hasElements && !beforeClose.trimEnd().endsWith(",");
  const needsLeadingNewline = !source.slice(0, insertionStart).endsWith("\n");
  const insertion = [
    needsSeparator ? "," : "",
    needsLeadingNewline ? "\n" : "",
    indentedEntry,
    ",\n",
    closeIndent,
  ].join("");

  return `${source.slice(0, insertionStart)}${insertion}${source.slice(closeBracket)}`;
}

export function markChangelogPublished(markdown: string): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) {
    throw new Error("changelogMd must include YAML frontmatter so emit can set published: true");
  }

  const fullFrontmatter = match[0];
  const frontmatter = match[1];
  if (frontmatter === undefined) throw new Error("changelog frontmatter parse failed");

  const publishedRe = /^published:\s*(?:true|false)\s*$/m;
  const nextFrontmatter = publishedRe.test(frontmatter)
    ? frontmatter.replace(publishedRe, "published: true")
    : insertPublishedFlag(frontmatter);

  return `${fullFrontmatter.replace(frontmatter, nextFrontmatter)}${markdown.slice(fullFrontmatter.length)}`;
}

export function extractPublishedFrom(markdown: string): string | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  const frontmatter = match?.[1];
  if (frontmatter === undefined) return null;
  const line = frontmatter.match(/^publishedFrom:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
  return line?.[1] ?? null;
}

function isFutureTimestamp(value: string): boolean {
  const t = Date.parse(value);
  return Number.isFinite(t) && t > Date.now();
}

// Go-live truth per platform docs/content-pipeline.md: the website auto-deploys
// straight to prod on merge, but the in-app changelog popout rides inside the
// web-app bundle and only updates per platform deploy of each env (main -> test,
// prod branch -> production). The emit PR body states this so the ship gate
// stops implying "merged = live everywhere" (launch-day postmortem 2026-06-09).
function goLiveLines(scheduled: readonly { slug: string; publishedFrom: string }[]): string[] {
  const lines = [
    "",
    "## Go-live (per platform `docs/content-pipeline.md`)",
    "",
    "- infinex.xyz news page: live on merge — the website auto-deploys straight to prod.",
    "- In-app changelog popout: NOT live on merge. The post ships inside the web-app bundle: test updates on the next `main` platform deploy; production updates on the next platform release (`prod` branch).",
  ];
  for (const item of scheduled) {
    lines.push(
      `- ⚠ \`${item.slug}\` is scheduled (\`publishedFrom: ${item.publishedFrom}\` is in the future): the web-app filters at read time, so it appears once the time passes — but statically-rendered infinex.xyz pages read at build time, so the website needs a deploy AFTER that time for the post to show.`,
    );
  }
  return lines;
}

function insertPublishedFlag(frontmatter: string): string {
  const lines = frontmatter.split(/\r?\n/);
  const dateIndex = lines.findIndex((line) => /^date:\s*/.test(line));
  const insertAt = dateIndex >= 0 ? dateIndex + 1 : lines.length;
  lines.splice(insertAt, 0, "published: true");
  return lines.join("\n");
}

// Internal changelog numbering. The № lives only in `internalNumber` frontmatter
// — deliberately NOT in the public title or the content package whitelist, so it
// stays an operator-only tracking number (visible in Keystatic admin, never on
// /news or in-app). We derive the next number from the freshest origin/main blog
// snapshot inside the worktree, so concurrent local state can't desync it.
export function parseChangelogNumber(markdown: string): number | null {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/)?.[1];
  if (!frontmatter) return null;
  const internal = frontmatter.match(/^internalNumber:\s*(\d+)\s*$/m)?.[1];
  if (internal) return Number(internal);
  const title = frontmatter.match(/^title:\s*(.+?)\s*$/m)?.[1];
  const titled = title?.match(/№\s*(\d+)/)?.[1];
  return titled ? Number(titled) : null;
}

export function nextChangelogNumber(markdowns: readonly string[]): number {
  let max = 0;
  for (const markdown of markdowns) {
    const n = parseChangelogNumber(markdown);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}

export function stampInternalNumber(markdown: string, n: number): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) {
    throw new Error("changelogMd must include YAML frontmatter so emit can set internalNumber");
  }
  const fullFrontmatter = match[0];
  const frontmatter = match[1];
  if (frontmatter === undefined) throw new Error("changelog frontmatter parse failed");
  if (/^internalNumber:\s*\d+\s*$/m.test(frontmatter)) {
    return markdown;
  }
  const nextFrontmatter = insertInternalNumber(frontmatter, n);
  return `${fullFrontmatter.replace(frontmatter, nextFrontmatter)}${markdown.slice(fullFrontmatter.length)}`;
}

function insertInternalNumber(frontmatter: string, n: number): string {
  const lines = frontmatter.split(/\r?\n/);
  const categoryIndex = lines.findIndex((line) => /^category:\s*/.test(line));
  const dateIndex = lines.findIndex((line) => /^date:\s*/.test(line));
  const anchor = categoryIndex >= 0 ? categoryIndex : dateIndex;
  const insertAt = anchor >= 0 ? anchor + 1 : lines.length;
  lines.splice(insertAt, 0, `internalNumber: ${n}`);
  return lines.join("\n");
}

async function applyInternalNumber(markdown: string, blogDir: string): Promise<string> {
  if (!/^category:\s*changelogs\s*$/m.test(markdown)) return markdown;
  const existing = await readExistingChangelogMarkdowns(blogDir);
  return stampInternalNumber(markdown, nextChangelogNumber(existing));
}

async function readExistingChangelogMarkdowns(blogDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(blogDir);
  } catch {
    return [];
  }
  const mdFiles = entries.filter((name) => name.endsWith(".md"));
  return Promise.all(mdFiles.map((name) => readFile(join(blogDir, name), "utf8")));
}

export function describeRoadmapChanges(
  source: string,
  tick: { nodeName: string; parentName?: string },
): RoadmapChangeSummary[] {
  const sourceFile = parseTypeScriptSource(source, ROADMAP_DATA_PATH);
  const root = findRoadmapRoot(sourceFile);
  const allNodes = collectRoadmapNodes(root, null);
  const matches = allNodes.filter((node) =>
    node.name === tick.nodeName &&
    (tick.parentName === undefined || node.parent?.name === tick.parentName));

  if (matches.length === 0) {
    const parentSuffix = tick.parentName ? ` under parent "${tick.parentName}"` : "";
    throw new Error(`roadmap node not found: "${tick.nodeName}"${parentSuffix}`);
  }
  if (matches.length > 1) {
    throw new Error(`roadmap node is ambiguous: "${tick.nodeName}". Provide parentName.`);
  }

  const target = matches[0];
  if (!target) throw new Error("roadmap node selection failed");

  const changes: RoadmapChangeSummary[] = [];
  if (target.parent && target.parent.status !== "done") {
    changes.push({
      path: roadmapPath(target.parent),
      from: target.parent.status,
      to: "done",
      reason: "parent-rollup",
    });
  }
  if (target.status !== "done") {
    changes.push({
      path: roadmapPath(target),
      from: target.status,
      to: "done",
      reason: "selected",
    });
  }
  return changes;
}

export function extractChangelogTitle(markdown: string, fallbackSlug: string): string {
  const frontmatterTitle = markdown.match(/^title:\s*(.+?)\s*$/m)?.[1];
  if (frontmatterTitle && !frontmatterTitle.startsWith("|") && !frontmatterTitle.startsWith(">")) {
    return unquoteYamlScalar(frontmatterTitle);
  }
  const heading = markdown.match(/^#{1,2}\s+(.+?)\s*$/m)?.[1];
  return heading?.trim() || fallbackSlug;
}

async function defaultCommandRunner(
  command: string,
  args: readonly string[],
  opts: { cwd?: string; maxBuffer?: number } = {},
): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, [...args], {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: opts.maxBuffer ?? 8 * 1024 * 1024,
  });
  return { stdout, stderr };
}

async function runGit(
  runCommand: CommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<void> {
  guardGitArgs(args);
  await runCommand("git", args, { cwd, maxBuffer: 8 * 1024 * 1024 });
}

async function gitStdout(
  runCommand: CommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<string> {
  guardGitArgs(args);
  return (await runCommand("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 })).stdout;
}

async function runGitBestEffort(
  runCommand: CommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<void> {
  try {
    await runGit(runCommand, cwd, args);
  } catch {
    // Cleanup is best-effort; the original platform checkout is never edited.
  }
}

function guardGitArgs(args: readonly string[]): void {
  const verb = gitVerb(args);
  if (verb === "merge") {
    throw new Error("emitLaunchPR is not allowed to merge");
  }
  if (verb === "push" && args.some((arg) => arg === "main" || arg === "master" || arg === "origin/main")) {
    throw new Error("emitLaunchPR is not allowed to push main");
  }
}

function gitVerb(args: readonly string[]): string | undefined {
  let i = 0;
  while (args[i] === "-c") i += 2;
  return args[i];
}

async function writeNewFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { encoding: "utf8", flag: "wx" });
}

function assertLaunchPackage(pkg: LaunchPackage): void {
  if (!isSafeSlug(pkg.changelogSlug)) {
    throw new Error(`unsafe changelogSlug: ${pkg.changelogSlug}`);
  }
  if (pkg.changelogMd.trim().length === 0) {
    throw new Error("changelogMd is empty");
  }
}

function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}

function defaultBranchName(slug: string): string {
  return `cf-emit/${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertSafeBranch(branch: string): void {
  const lastSegment = branch.split("/").at(-1);
  if (!branch || branch.trim() !== branch) throw new Error(`unsafe branch name: ${branch}`);
  if (
    branch === "main" ||
    branch === "master" ||
    branch === "origin/main" ||
    branch === "origin/master" ||
    branch.startsWith("refs/") ||
    lastSegment === "main" ||
    lastSegment === "master"
  ) {
    throw new Error(`unsafe branch name: ${branch}`);
  }
  if (
    branch.startsWith("-") ||
    branch.startsWith("+") ||
    branch.includes("..") ||
    branch.includes("@{") ||
    /[\s~^:?*[\\\x00-\x1f\x7f]/.test(branch) ||
    branch.endsWith("/") ||
    branch.endsWith(".") ||
    branch.includes("//")
  ) {
    throw new Error(`unsafe branch name: ${branch}`);
  }
}

function buildPrBody(pkg: LaunchPackage, roadmapChanges: RoadmapChangeSummary[]): string {
  const lines = [
    "Emitted by comms-factory from an approved launch package.",
    "",
    "## PR contents",
    "",
    `- Changelog: \`${BLOG_DIR}/${pkg.changelogSlug}.md\``,
    "  - Publish status: `published: true`",
  ];
  if (roadmapChanges.length > 0) {
    lines.push("- Roadmap:");
    for (const change of roadmapChanges) {
      const reason = change.reason === "parent-rollup" ? " (auto parent roll-up)" : "";
      lines.push(`  - \`${change.path}\`: \`${formatRoadmapStatus(change.from)}\` -> \`${change.to}\`${reason}`);
    }
  } else if (pkg.roadmapTick) {
    lines.push(`- Roadmap: \`${pkg.roadmapTick.parentName ? `${pkg.roadmapTick.parentName} / ` : ""}${pkg.roadmapTick.nodeName}\` already done`);
  }
  if (pkg.featureCard) {
    lines.push("- Feature card: appended to `FEATURES_COPY[]`");
  }
  const publishedFrom = extractPublishedFrom(pkg.changelogMd);
  const scheduled =
    publishedFrom !== null && isFutureTimestamp(publishedFrom)
      ? [{ slug: pkg.changelogSlug, publishedFrom }]
      : [];
  lines.push(...goLiveLines(scheduled));
  lines.push("", "human-approve, DO NOT merge");
  return lines.join("\n");
}

function roadmapPath(node: RoadmapNode): string {
  const parts: string[] = [];
  for (let current: RoadmapNode | null = node; current?.parent; current = current.parent) {
    parts.unshift(current.name);
  }
  return parts.join(" / ") || node.name;
}

function formatRoadmapStatus(status: string | null): string {
  return status ?? "unset";
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function parseTypeScriptSource(source: string, fileName: string): ts.SourceFile {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (parseDiagnostics.length > 0) {
    throw new Error(`could not parse ${fileName}: ${parseDiagnostics[0]?.messageText}`);
  }
  return sourceFile;
}

function findRoadmapRoot(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression {
  const declaration = findVariableDeclaration(sourceFile, "infinexTreeData");
  if (!declaration?.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
    throw new Error("infinexTreeData object not found");
  }
  return declaration.initializer;
}

function findArrayInitializer(sourceFile: ts.SourceFile, variableName: string): ts.ArrayLiteralExpression | null {
  const declaration = findVariableDeclaration(sourceFile, variableName);
  return declaration?.initializer && ts.isArrayLiteralExpression(declaration.initializer)
    ? declaration.initializer
    : null;
}

function findVariableDeclaration(sourceFile: ts.SourceFile, variableName: string): ts.VariableDeclaration | null {
  let found: ts.VariableDeclaration | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function collectRoadmapNodes(
  object: ts.ObjectLiteralExpression,
  parent: RoadmapNode | null,
): RoadmapNode[] {
  const node = roadmapNodeFromObject(object, parent);
  if (!node) return [];
  return [node, ...collectChildNodes(node.childrenArray, node).flatMap((child) =>
    collectRoadmapNodes(child.object, node))];
}

function collectChildNodes(
  childrenArray: ts.ArrayLiteralExpression | null,
  parent: RoadmapNode,
): RoadmapNode[] {
  if (!childrenArray) return [];
  return childrenArray.elements
    .filter(ts.isObjectLiteralExpression)
    .map((object) => roadmapNodeFromObject(object, parent))
    .filter((node): node is RoadmapNode => node !== null);
}

function roadmapNodeFromObject(
  object: ts.ObjectLiteralExpression,
  parent: RoadmapNode | null,
): RoadmapNode | null {
  const nameProp = propertyAssignment(object, "name");
  if (!nameProp || !ts.isStringLiteralLike(nameProp.initializer)) return null;
  const statusProp = propertyAssignment(object, "status");
  const status = statusProp && ts.isStringLiteralLike(statusProp.initializer)
    ? statusProp.initializer.text
    : null;
  const childrenProp = propertyAssignment(object, "children");
  const childrenArray = childrenProp && ts.isArrayLiteralExpression(childrenProp.initializer)
    ? childrenProp.initializer
    : null;
  return {
    name: nameProp.initializer.text,
    object,
    parent,
    status,
    nameProp,
    statusProp,
    childrenArray,
  };
}

function propertyAssignment(
  object: ts.ObjectLiteralExpression,
  key: string,
): ts.PropertyAssignment | null {
  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name;
    if ((ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === key) {
      return prop;
    }
  }
  return null;
}

function statusEdit(
  source: string,
  node: RoadmapNode,
  sourceFile: ts.SourceFile,
): Edit {
  if (node.statusProp) {
    return {
      start: node.statusProp.initializer.getStart(sourceFile),
      end: node.statusProp.initializer.getEnd(),
      text: "'done'",
    };
  }

  const nameEnd = propertyEndIncludingComma(source, node.nameProp.getEnd());
  const propIndent = indentationAt(source, node.nameProp.getStart(sourceFile));
  return {
    start: nameEnd,
    end: nameEnd,
    text: `\n${propIndent}status: 'done',`,
  };
}

function markObjectTextDone(
  source: string,
  node: RoadmapNode,
  sourceFile: ts.SourceFile,
): string {
  const objectStart = node.object.getStart(sourceFile);
  const objectEnd = node.object.getEnd();
  const objectText = source.slice(objectStart, objectEnd);
  const edit = statusEdit(source, node, sourceFile);
  return `${objectText.slice(0, edit.start - objectStart)}${edit.text}${objectText.slice(edit.end - objectStart)}`;
}

function propertyEndIncludingComma(source: string, propEnd: number): number {
  let end = propEnd;
  while (source[end] === " " || source[end] === "\t") end += 1;
  if (source[end] === ",") return end + 1;
  return propEnd;
}

function renderArrayWithExistingIndent(
  source: string,
  array: ts.ArrayLiteralExpression,
  elementTexts: string[],
): string {
  const arrayStart = array.getStart();
  const arrayEnd = array.getEnd();
  const closeBracket = source.lastIndexOf("]", arrayEnd - 1);
  if (closeBracket < arrayStart) throw new Error("array closing bracket not found");
  const elementIndent = arrayElementIndent(source, array);
  const closeIndent = closingBracketIndent(source, closeBracket);
  if (elementTexts.length === 0) return "[]";
  return `[\n${elementIndent}${elementTexts.join(`,\n${elementIndent}`)},\n${closeIndent}]`;
}

function arrayElementIndent(
  source: string,
  array: ts.ArrayLiteralExpression,
  sourceFile?: ts.SourceFile,
): string {
  const first = array.elements[0];
  if (first) return indentationAt(source, first.getStart(sourceFile));
  const arrayIndent = indentationAt(source, array.getStart(sourceFile));
  return `${arrayIndent}  `;
}

function closingBracketIndent(source: string, closeBracket: number): string {
  return indentationAt(source, closeBracket);
}

function indentationAt(source: string, position: number): string {
  const lineStart = source.lastIndexOf("\n", position - 1) + 1;
  return source.slice(lineStart, position).match(/^[ \t]*/)?.[0] ?? "";
}

function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of sorted) {
    out = `${out.slice(0, edit.start)}${edit.text}${out.slice(edit.end)}`;
  }
  return out;
}

function normalizeFeatureEntry(dataTsEntry: string): string {
  const trimmed = dataTsEntry.trim().replace(/,+$/, "").trim();
  const source = `const __entry = ${trimmed};`;
  const sourceFile = parseTypeScriptSource(source, "feature-entry.ts");
  const declaration = findVariableDeclaration(sourceFile, "__entry");
  if (!declaration?.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
    throw new Error("featureCard.dataTsEntry must be a TypeScript object literal");
  }
  return trimmed;
}

function indentBlock(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export const _test = {
  emitLaunchPRWithRunner,
  emitBatchLaunchPRWithRunner,
  assertSafeBranch,
};
