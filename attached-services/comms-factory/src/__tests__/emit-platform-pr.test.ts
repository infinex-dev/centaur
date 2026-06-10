import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  _test,
  appendFeatureCopyEntry,
  emitLaunchPR,
  markRoadmapNodeDone,
  type LaunchPackage,
} from "../emit-platform-pr.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("roadmap structured edit", () => {
  it("ticks the named node, reorders it above in-progress siblings, and leaves siblings intact", () => {
    const updated = markRoadmapNodeDone(roadmapFixture(), {
      nodeName: "NFT",
      parentName: "Trading",
    });

    expect(updated).toContain("{ id: id(), name: 'NFT', status: 'done' }");
    expect(updated).toContain("{ id: id(), name: 'Perps', status: 'done' }");
    expect(updated).toContain("{ id: id(), name: 'Order books', status: 'planned' }");
    expect(updated.indexOf("name: 'NFT'")).toBeLessThan(updated.indexOf("name: 'Prediction markets'"));
  });

  it("uses parentName to disambiguate duplicate node names", () => {
    const updated = markRoadmapNodeDone(roadmapFixture(), {
      nodeName: "Advanced order types",
      parentName: "Spot",
    });

    expect(updated).toContain("{ id: id(), name: 'Advanced order types', status: 'done' }");
  });

  it("fails when a node is missing or ambiguous", () => {
    expect(() =>
      markRoadmapNodeDone(roadmapFixture(), { nodeName: "Missing" }),
    ).toThrow(/not found/);
    expect(() =>
      markRoadmapNodeDone(roadmapFixture(), { nodeName: "Advanced order types" }),
    ).toThrow(/ambiguous/);
  });

  it("ticks the immediate parent to done when a child ships (parent not already done)", () => {
    const src = [
      "type TreeNode = { id: string; name: string; status?: string; children?: TreeNode[] };",
      "let nodeId = 0;",
      "const id = () => String(++nodeId);",
      "export const infinexTreeData: TreeNode = {",
      "  id: id(), name: 'Infinex', children: [",
      "    {",
      "      id: id(), name: 'TradFi & CEX', status: 'in_progress', children: [",
      "        { id: id(), name: 'Onramp (bank account)', status: 'in_progress' },",
      "        { id: id(), name: 'Infinex card', status: 'planned' },",
      "      ],",
      "    },",
      "  ],",
      "};",
    ].join("\n");
    const updated = markRoadmapNodeDone(src, { nodeName: "Onramp (bank account)" });
    expect(updated).toContain("name: 'Onramp (bank account)', status: 'done'");
    expect(updated).toContain("name: 'TradFi & CEX', status: 'done'");
    expect(updated).toContain("name: 'Infinex card', status: 'planned'");
  });

  it("leaves an already-done parent unchanged", () => {
    const src = [
      "type TreeNode = { id: string; name: string; status?: string; children?: TreeNode[] };",
      "let nodeId = 0;",
      "const id = () => String(++nodeId);",
      "export const infinexTreeData: TreeNode = {",
      "  id: id(), name: 'Infinex', children: [",
      "    {",
      "      id: id(), name: 'Spot', status: 'done', children: [",
      "        { id: id(), name: 'Limit orders', status: 'in_progress' },",
      "      ],",
      "    },",
      "  ],",
      "};",
    ].join("\n");
    const updated = markRoadmapNodeDone(src, { nodeName: "Limit orders" });
    expect(updated).toContain("name: 'Limit orders', status: 'done'");
    expect(updated.match(/name: 'Spot', status: 'done'/g)?.length).toBe(1);
  });
});

describe("feature copy structured append", () => {
  it("appends a TypeScript object entry to FEATURES_COPY", () => {
    const updated = appendFeatureCopyEntry(featuresFixture(), `{
  title: 'Prediction markets',
  description: 'Trade prediction markets from Infinex.',
}`);

    expect(updated).toContain("title: 'Prediction markets'");
    expect(updated).toContain("  {\n    title: 'Prediction markets'");
    expect(updated.trimEnd().endsWith("];")).toBe(true);
  });
});

describe("emitLaunchPR dry-run", () => {
  it("returns a planned diff for the blog and roadmap update without requiring a remote or gh", async () => {
    const platformRoot = makePlatformFixture();
    const pkg: LaunchPackage = {
      changelogSlug: "prediction-markets-live",
      changelogMd: [
        "---",
        "title: Prediction markets are live",
        "date: 2026-06-05",
        "published: true",
        "pinned: false",
        "category: changelogs",
        "---",
        "### Prediction markets",
        "",
        "Prediction markets are live on Infinex.",
      ].join("\n"),
      roadmapTick: {
        nodeName: "NFT",
        parentName: "Trading",
      },
    };

    const result = await emitLaunchPR(pkg, {
      platformRoot,
      dryRun: true,
      branch: "cf-emit/test-prediction-markets",
    });

    expect(result.prUrl).toBeNull();
    expect(result.plannedDiff).toContain("apps/content-app/content/blog/prediction-markets-live.md");
    expect(result.plannedDiff).toContain("+        { id: id(), name: 'NFT', status: 'done' }");
    expect(git(platformRoot, ["status", "--short"])).toBe("");
    expect(git(platformRoot, ["branch", "--list", "cf-emit/test-prediction-markets"])).toBe("");
  });

  it("rejects main as an emit branch", () => {
    expect(() => _test.assertSafeBranch("main")).toThrow(/unsafe branch/);
    expect(() => _test.assertSafeBranch("origin/main")).toThrow(/unsafe branch/);
    expect(() => _test.assertSafeBranch("refs/heads/main")).toThrow(/unsafe branch/);
    expect(() => _test.assertSafeBranch("+main")).toThrow(/unsafe branch/);
  });
});

function makePlatformFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "cf-platform-"));
  tempDirs.push(dir);
  writeFixtureFile(dir, "apps/public-website/src/app/(site)/roadmap/data.ts", roadmapFixture());
  writeFixtureFile(dir, "apps/public-website/src/app/(site)/features/data.ts", featuresFixture());

  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "comms-factory@example.com"]);
  git(dir, ["config", "user.name", "Comms Factory"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "initial platform fixture"]);
  git(dir, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  return dir;
}

function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const path = resolve(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function roadmapFixture(): string {
  return [
    "import type { TreeNode } from './types';",
    "",
    "let nodeId = 0;",
    "const id = () => String(++nodeId);",
    "",
    "export const infinexTreeData: TreeNode = {",
    "  id: id(),",
    "  name: 'Infinex',",
    "  children: [",
    "    {",
    "      id: id(),",
    "      name: 'Trading',",
    "      children: [",
    "        { id: id(), name: 'Perps', status: 'done' },",
    "        { id: id(), name: 'Prediction markets', status: 'in_progress' },",
    "        { id: id(), name: 'NFT', status: 'in_progress' },",
    "        { id: id(), name: 'Order books', status: 'planned' },",
    "      ],",
    "    },",
    "    {",
    "      id: id(),",
    "      name: 'Perps',",
    "      children: [",
    "        { id: id(), name: 'Advanced order types', status: 'in_progress' },",
    "      ],",
    "    },",
    "    {",
    "      id: id(),",
    "      name: 'Spot',",
    "      children: [",
    "        { id: id(), name: 'Advanced order types', status: 'in_progress' },",
    "      ],",
    "    },",
    "  ],",
    "};",
    "",
  ].join("\n");
}

function featuresFixture(): string {
  return [
    "type FeatureCopyOptions = { title: string; description?: string };",
    "export const FEATURES_COPY: FeatureCopyOptions[] = [",
    "  {",
    "    title: 'Homepage',",
    "    description: 'A command center view.',",
    "  },",
    "];",
    "",
  ].join("\n");
}
