import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  _test,
  appendFeatureCopyEntry,
  describeRoadmapChanges,
  emitBatchLaunchPR,
  emitLaunchPR,
  extractPublishedFrom,
  markChangelogPublished,
  markRoadmapNodeDone,
  nextChangelogNumber,
  parseChangelogNumber,
  stampInternalNumber,
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

  it("describes selected and parent roadmap changes for PR review", () => {
    expect(describeRoadmapChanges(roadmapFixture(), {
      nodeName: "NFT",
      parentName: "Trading",
    })).toEqual([
      {
        path: "Trading",
        from: null,
        to: "done",
        reason: "parent-rollup",
      },
      {
        path: "Trading / NFT",
        from: "in_progress",
        to: "done",
        reason: "selected",
      },
    ]);
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

describe("changelog publish normalization", () => {
  it("sets an existing published flag to true", () => {
    expect(markChangelogPublished([
      "---",
      "title: Launch",
      "date: 2026-06-05",
      "published: false",
      "---",
      "Body",
    ].join("\n"))).toContain("published: true");
  });

  it("inserts published true after date when the flag is missing", () => {
    expect(markChangelogPublished([
      "---",
      "title: Launch",
      "date: 2026-06-05",
      "pinned: false",
      "---",
      "Body",
    ].join("\n"))).toContain("date: 2026-06-05\npublished: true\npinned: false");
  });

  it("requires frontmatter before emitting", () => {
    expect(() => markChangelogPublished("### Launch")).toThrow(/frontmatter/);
  });
});

describe("internal changelog numbering", () => {
  it("reads the number from an internalNumber frontmatter field", () => {
    expect(parseChangelogNumber([
      "---",
      "title: Lighter comes to Infinex Perps",
      "category: changelogs",
      "internalNumber: 62",
      "---",
      "Body",
    ].join("\n"))).toBe(62);
  });

  it("falls back to the № NN prefix in the title", () => {
    expect(parseChangelogNumber([
      "---",
      "title: № 61 - Private send with Incognito Mode",
      "category: changelogs",
      "---",
      "Body",
    ].join("\n"))).toBe(61);
  });

  it("returns null when a post carries no number", () => {
    expect(parseChangelogNumber([
      "---",
      "title: Fiat bank deposits live via Bridge.xyz",
      "category: changelogs",
      "---",
      "Body",
    ].join("\n"))).toBeNull();
  });

  it("takes the max across mixed sources and adds one", () => {
    const posts = [
      "---\ntitle: № 61 - Private send\ncategory: changelogs\n---\n",
      "---\ntitle: Lighter\ncategory: changelogs\ninternalNumber: 62\n---\n",
      "---\ntitle: A news item\ncategory: news\n---\n",
    ];
    expect(nextChangelogNumber(posts)).toBe(63);
  });

  it("starts at 1 when no existing post carries a number", () => {
    expect(nextChangelogNumber(["---\ntitle: First\ncategory: changelogs\n---\n"])).toBe(1);
  });

  it("inserts internalNumber after the category line", () => {
    const stamped = stampInternalNumber([
      "---",
      "title: Fiat bank deposits live via Bridge.xyz",
      "date: 2026-06-09",
      "published: true",
      "category: changelogs",
      "---",
      "Body",
    ].join("\n"), 63);
    expect(stamped).toContain("category: changelogs\ninternalNumber: 63\n");
  });

  it("leaves an existing internalNumber untouched (explicit override wins)", () => {
    const md = [
      "---",
      "title: Manual override",
      "category: changelogs",
      "internalNumber: 99",
      "---",
      "Body",
    ].join("\n");
    expect(stampInternalNumber(md, 63)).toBe(md);
  });

  it("requires frontmatter before stamping", () => {
    expect(() => stampInternalNumber("### Launch", 63)).toThrow(/frontmatter/);
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
        "published: false",
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
    expect(result.plannedDiff).toContain("+published: true");
    expect(result.plannedDiff).not.toContain("+published: false");
    expect(result.plannedDiff).toContain("+        { id: id(), name: 'NFT', status: 'done' }");
    expect(result.prDescription).toContain("## PR contents");
    expect(result.prDescription).toContain("Publish status: `published: true`");
    expect(result.prDescription).toContain("- Roadmap:");
    expect(result.prDescription).toContain("`Trading`: `unset` -> `done` (auto parent roll-up)");
    expect(result.prDescription).toContain("`Trading / NFT`: `in_progress` -> `done`");
    expect(result.prDescription).toContain("## Go-live (per platform `docs/content-pipeline.md`)");
    expect(result.prDescription).toContain("In-app changelog popout: NOT live on merge");
    expect(result.prDescription).not.toContain("is scheduled");
    expect(git(platformRoot, ["status", "--short"])).toBe("");
    expect(git(platformRoot, ["branch", "--list", "cf-emit/test-prediction-markets"])).toBe("");
  });

  it("warns in the PR body when publishedFrom is in the future", async () => {
    const platformRoot = makePlatformFixture();
    const pkg: LaunchPackage = {
      changelogSlug: "scheduled-launch",
      changelogMd: [
        "---",
        "title: Scheduled launch",
        "date: 2026-06-05",
        "published: false",
        "publishedFrom: 2999-01-01T09:00:00.000Z",
        "category: changelogs",
        "---",
        "### Scheduled launch",
      ].join("\n"),
    };

    const result = await emitLaunchPR(pkg, {
      platformRoot,
      dryRun: true,
      branch: "cf-emit/test-scheduled",
    });

    expect(result.prDescription).toContain("`scheduled-launch` is scheduled");
    expect(result.prDescription).toContain("publishedFrom: 2999-01-01T09:00:00.000Z");
    expect(result.prDescription).toContain("needs a deploy AFTER that time");
  });

  it("extracts publishedFrom from frontmatter, tolerating quotes and absence", () => {
    expect(extractPublishedFrom("---\ntitle: X\npublishedFrom: 2026-07-01\n---\nBody")).toBe("2026-07-01");
    expect(extractPublishedFrom('---\ntitle: X\npublishedFrom: "2026-07-01T09:00:00.000Z"\n---\nBody')).toBe(
      "2026-07-01T09:00:00.000Z",
    );
    expect(extractPublishedFrom("---\ntitle: X\npublished: true\n---\nBody")).toBeNull();
    expect(extractPublishedFrom("no frontmatter here")).toBeNull();
  });

  it("auto-stamps the next internal number on a changelog, derived from existing posts", async () => {
    const platformRoot = makePlatformFixture({
      "61-incognito": "---\ntitle: № 61 - Private send with Incognito Mode\ndate: 2026-02-16\npublished: true\ncategory: changelogs\n---\nBody\n",
      "62-lighter": "---\ntitle: Lighter comes to Infinex Perps\ndate: 2026-03-03\npublished: true\ncategory: changelogs\ninternalNumber: 62\n---\nBody\n",
    });
    const result = await emitLaunchPR(
      {
        changelogSlug: "fiat-bank-deposits-live-via-bridge-xyz",
        changelogMd: [
          "---",
          "title: Fiat bank deposits live via Bridge.xyz",
          "date: 2026-06-09",
          "published: false",
          "pinned: false",
          "category: changelogs",
          "---",
          "### Fund Infinex from your bank",
        ].join("\n"),
      },
      { platformRoot, dryRun: true, branch: "cf-emit/test-bank-deposits" },
    );

    expect(result.plannedDiff).toContain("+internalNumber: 63");
  });

  it("does not number a non-changelog (news) post", async () => {
    const platformRoot = makePlatformFixture({
      "62-lighter": "---\ntitle: Lighter\ndate: 2026-03-03\npublished: true\ncategory: changelogs\ninternalNumber: 62\n---\nBody\n",
    });
    const result = await emitLaunchPR(
      {
        changelogSlug: "some-news-post",
        changelogMd: [
          "---",
          "title: A news post",
          "date: 2026-06-09",
          "published: false",
          "category: news",
          "---",
          "Body",
        ].join("\n"),
      },
      { platformRoot, dryRun: true, branch: "cf-emit/test-news" },
    );

    expect(result.plannedDiff).not.toContain("internalNumber");
  });

  it("rejects main as an emit branch", () => {
    expect(() => _test.assertSafeBranch("main")).toThrow(/unsafe branch/);
    expect(() => _test.assertSafeBranch("origin/main")).toThrow(/unsafe branch/);
    expect(() => _test.assertSafeBranch("refs/heads/main")).toThrow(/unsafe branch/);
    expect(() => _test.assertSafeBranch("+main")).toThrow(/unsafe branch/);
  });
});

describe("emitLaunchPR live path", () => {
  it("skips local pre-commit hooks while creating the PR branch", async () => {
    const platformRoot = makePlatformFixture();
    attachBareRemote(platformRoot);
    writeFileSync(
      join(platformRoot, ".git/hooks/pre-commit"),
      "#!/bin/sh\necho local formatter is missing >&2\nexit 1\n",
      { mode: 0o755 },
    );

    const commands: Array<{ command: string; args: string[] }> = [];
    const result = await _test.emitLaunchPRWithRunner(
      {
        changelogSlug: "prediction-markets-live",
        changelogMd: [
          "---",
          "title: Prediction markets are live",
          "date: 2026-06-05",
          "published: false",
          "pinned: false",
          "category: changelogs",
          "---",
          "### Prediction markets",
          "",
          "Prediction markets are live on Infinex.",
        ].join("\n"),
      },
      {
        platformRoot,
        dryRun: false,
        branch: "cf-emit/live-hook-test",
      },
      async (command, args, opts) => {
        commands.push({ command, args: [...args] });
        if (command === "gh") {
          return {
            stdout: "https://github.com/infinex-xyz/platform/pull/123\n",
            stderr: "",
          };
        }
        return {
          stdout: execFileSync(command, [...args], {
            cwd: opts?.cwd,
            encoding: "utf8",
            maxBuffer: opts?.maxBuffer ?? 8 * 1024 * 1024,
          }),
          stderr: "",
        };
      },
    );

    expect(result.prUrl).toBe("https://github.com/infinex-xyz/platform/pull/123");
    expect(result.prDescription).toContain("`apps/content-app/content/blog/prediction-markets-live.md`");
    expect(commands).toContainEqual({
      command: "git",
      args: [
        "commit",
        "--no-verify",
        "-m",
        "Emit Prediction markets are live launch comms",
      ],
    });
    const prCreate = commands.find((command) => command.command === "gh");
    const bodyIndex = prCreate?.args.indexOf("--body") ?? -1;
    expect(bodyIndex).toBeGreaterThanOrEqual(0);
    expect(prCreate?.args[bodyIndex + 1]).toContain("## PR contents");
  });
});

describe("emitBatchLaunchPR", () => {
  it("stamps an existing post AND emits a new one in a single PR (the 63 + 64 case)", async () => {
    const platformRoot = makePlatformFixture({
      "fiat-bank-deposits-live-via-bridge-xyz": [
        "---",
        "title: Fiat bank deposits live via Bridge.xyz",
        "date: 2026-06-09",
        "published: true",
        "pinned: false",
        "category: changelogs",
        "---",
        "Body",
        "",
      ].join("\n"),
    });

    const result = await emitBatchLaunchPR(
      [
        {
          changelogSlug: "next-thing-live",
          changelogMd: [
            "---",
            "title: The next thing is live",
            "date: 2026-06-11",
            "published: false",
            "pinned: false",
            "category: changelogs",
            "---",
            "### The next thing",
          ].join("\n"),
        },
      ],
      {
        platformRoot,
        dryRun: true,
        branch: "cf-emit-batch/test-63-64",
        renumber: [{ slug: "fiat-bank-deposits-live-via-bridge-xyz", internalNumber: 63 }],
      },
    );

    // #63 stamped on the existing file, #64 auto-derived for the new one.
    expect(result.plannedDiff).toContain("fiat-bank-deposits-live-via-bridge-xyz.md");
    expect(result.plannedDiff).toContain("+internalNumber: 63");
    expect(result.plannedDiff).toContain("next-thing-live.md");
    expect(result.plannedDiff).toContain("+internalNumber: 64");
    expect(result.plannedDiff).toContain("+published: true");

    expect(result.items).toEqual([
      { slug: "fiat-bank-deposits-live-via-bridge-xyz", action: "renumber", internalNumber: 63, roadmapChanges: [], publishedFrom: null },
      { slug: "next-thing-live", action: "create", internalNumber: 64, roadmapChanges: [], publishedFrom: null },
    ]);

    expect(result.prDescription).toContain("Renumber: `apps/content-app/content/blog/fiat-bank-deposits-live-via-bridge-xyz.md` -> `internalNumber: 63`");
    expect(result.prDescription).toContain("New changelog: `apps/content-app/content/blog/next-thing-live.md` (№ 64)");

    // Real checkout untouched; throwaway branch cleaned up.
    expect(git(platformRoot, ["status", "--short"])).toBe("");
    expect(git(platformRoot, ["branch", "--list", "cf-emit-batch/test-63-64"])).toBe("");
  });

  it("requires at least one package or renumber directive", async () => {
    const platformRoot = makePlatformFixture();
    await expect(emitBatchLaunchPR([], { platformRoot, dryRun: true })).rejects.toThrow(
      /at least one package or renumber directive/,
    );
  });

  it("fails loudly when a renumber target does not exist on origin/main", async () => {
    const platformRoot = makePlatformFixture();
    await expect(
      emitBatchLaunchPR([], {
        platformRoot,
        dryRun: true,
        branch: "cf-emit-batch/test-missing",
        renumber: [{ slug: "does-not-exist", internalNumber: 99 }],
      }),
    ).rejects.toThrow(/cannot renumber: .*does-not-exist\.md not found/);
    expect(git(platformRoot, ["branch", "--list", "cf-emit-batch/test-missing"])).toBe("");
  });

  it("opens exactly one PR for multiple new entries on the live path", async () => {
    const platformRoot = makePlatformFixture();
    attachBareRemote(platformRoot);

    const commands: Array<{ command: string; args: string[] }> = [];
    const result = await _test.emitBatchLaunchPRWithRunner(
      [
        {
          changelogSlug: "alpha-live",
          changelogMd: "---\ntitle: Alpha\ndate: 2026-06-11\npublished: false\ncategory: changelogs\n---\nBody",
        },
        {
          changelogSlug: "beta-live",
          changelogMd: "---\ntitle: Beta\ndate: 2026-06-12\npublished: false\ncategory: changelogs\n---\nBody",
        },
      ],
      { platformRoot, dryRun: false, branch: "cf-emit-batch/live-two" },
      async (command, args, opts) => {
        commands.push({ command, args: [...args] });
        if (command === "gh") {
          return { stdout: "https://github.com/infinex-xyz/platform/pull/200\n", stderr: "" };
        }
        return {
          stdout: execFileSync(command, [...args], {
            cwd: opts?.cwd,
            encoding: "utf8",
            maxBuffer: opts?.maxBuffer ?? 8 * 1024 * 1024,
          }),
          stderr: "",
        };
      },
    );

    expect(result.prUrl).toBe("https://github.com/infinex-xyz/platform/pull/200");
    expect(commands.filter((c) => c.command === "gh")).toHaveLength(1);
    expect(commands.filter((c) => c.command === "git" && c.args[0] === "commit")).toHaveLength(1);
    // Both new posts numbered sequentially within the one batch.
    expect(result.items.map((item) => item.internalNumber)).toEqual([1, 2]);
  });
});

describe("emitProdPromotionPR", () => {
  function makePromotionFixture(): { platformRoot: string; mergedOid: string } {
    const platformRoot = makePlatformFixture();
    // prod lags main by one commit: the "merged launch PR" commit exists on
    // main only — exactly the launch-day shape (#14754 merged, prod behind).
    git(platformRoot, ["update-ref", "refs/remotes/origin/prod", "HEAD"]);
    writeFixtureFile(
      platformRoot,
      "apps/content-app/content/blog/bank-deposits-live.md",
      "---\ntitle: Bank deposits live\ndate: 2026-06-09\npublished: true\ncategory: changelogs\n---\nBody\n",
    );
    git(platformRoot, ["add", "."]);
    git(platformRoot, ["commit", "-m", "Bank deposits live (#14754)"]);
    git(platformRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
    return { platformRoot, mergedOid: git(platformRoot, ["rev-parse", "HEAD"]) };
  }

  function ghStubRunner(
    view: { state: string; oid: string | null; title?: string },
    commands?: Array<{ command: string; args: string[] }>,
  ) {
    return async (command: string, args: readonly string[], opts?: { cwd?: string }) => {
      commands?.push({ command, args: [...args] });
      if (command === "gh" && args[1] === "view") {
        return {
          stdout: JSON.stringify({
            state: view.state,
            mergeCommit: view.oid === null ? null : { oid: view.oid },
            title: view.title ?? "Bank deposits live",
            url: "https://github.com/infinex-xyz/platform/pull/14754",
          }),
          stderr: "",
        };
      }
      if (command === "gh") {
        return { stdout: "https://github.com/infinex-xyz/platform/pull/14770\n", stderr: "" };
      }
      return {
        stdout: execFileSync(command, [...args], { cwd: opts?.cwd, encoding: "utf8" }),
        stderr: "",
      };
    };
  }

  it("dry-run: cherry-picks the merged commit onto prod and previews the diff + PR body", async () => {
    const { platformRoot, mergedOid } = makePromotionFixture();

    const result = await _test.emitProdPromotionPRWithRunner(
      14754,
      { platformRoot, dryRun: true, branch: "cf-promote/test-bank-deposits" },
      ghStubRunner({ state: "MERGED", oid: mergedOid }),
    );

    expect(result.prUrl).toBeNull();
    expect(result.mergeCommit).toBe(mergedOid);
    expect(result.plannedDiff).toContain("apps/content-app/content/blog/bank-deposits-live.md");
    expect(result.prDescription).toContain("Content-only promotion");
    expect(result.prDescription).toContain("docs/content-pipeline.md");
    expect(result.prDescription).toContain("Merging deploys the whole platform");
    expect(result.prDescription).toContain("human-approve, DO NOT merge automatically");
    expect(git(platformRoot, ["status", "--short"])).toBe("");
    expect(git(platformRoot, ["branch", "--list", "cf-promote/test-bank-deposits"])).toBe("");
  });

  it("refuses when the main PR is not merged", async () => {
    const { platformRoot, mergedOid } = makePromotionFixture();

    await expect(
      _test.emitProdPromotionPRWithRunner(
        14754,
        { platformRoot, dryRun: true },
        ghStubRunner({ state: "OPEN", oid: mergedOid }),
      ),
    ).rejects.toThrow(/not merged yet/);
  });

  it("refuses when the content is already on prod", async () => {
    const { platformRoot, mergedOid } = makePromotionFixture();
    git(platformRoot, ["update-ref", "refs/remotes/origin/prod", mergedOid]);

    await expect(
      _test.emitProdPromotionPRWithRunner(
        14754,
        { platformRoot, dryRun: true, branch: "cf-promote/test-noop" },
        ghStubRunner({ state: "MERGED", oid: mergedOid }),
      ),
    ).rejects.toThrow(/already on origin\/prod/);
  });

  it("live path: pushes a cf-promote branch and opens the PR against prod", async () => {
    const { platformRoot, mergedOid } = makePromotionFixture();
    const remote = attachBareRemote(platformRoot);
    git(platformRoot, ["push", "origin", `${mergedOid}:refs/heads/main`]);
    git(platformRoot, ["push", "origin", "refs/remotes/origin/prod:refs/heads/prod"]);

    const commands: Array<{ command: string; args: string[] }> = [];
    const result = await _test.emitProdPromotionPRWithRunner(
      14754,
      { platformRoot, dryRun: false, branch: "cf-promote/test-live" },
      ghStubRunner({ state: "MERGED", oid: mergedOid }, commands),
    );

    expect(result.prUrl).toBe("https://github.com/infinex-xyz/platform/pull/14770");
    expect(git(remote, ["log", "--oneline", "cf-promote/test-live"])).toContain("Promote to prod: Bank deposits live (#14754)");
    const prCreate = commands.find((c) => c.command === "gh" && c.args[1] === "create");
    expect(prCreate?.args).toContain("--base");
    expect(prCreate?.args[prCreate.args.indexOf("--base") + 1]).toBe("prod");
    expect(git(platformRoot, ["status", "--short"])).toBe("");
  });
});

function makePlatformFixture(blogPosts: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "cf-platform-"));
  tempDirs.push(dir);
  writeFixtureFile(dir, "apps/public-website/src/app/(site)/roadmap/data.ts", roadmapFixture());
  writeFixtureFile(dir, "apps/public-website/src/app/(site)/features/data.ts", featuresFixture());
  for (const [slug, markdown] of Object.entries(blogPosts)) {
    writeFixtureFile(dir, `apps/content-app/content/blog/${slug}.md`, markdown);
  }

  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "comms-factory@example.com"]);
  git(dir, ["config", "user.name", "Comms Factory"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["config", "core.hooksPath", join(dir, ".git/hooks")]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "initial platform fixture"]);
  git(dir, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  return dir;
}

function attachBareRemote(platformRoot: string): string {
  const remote = mkdtempSync(join(tmpdir(), "cf-platform-remote-"));
  tempDirs.push(remote);
  git(remote, ["init", "--bare", "-b", "main"]);
  git(platformRoot, ["remote", "add", "origin", remote]);
  git(platformRoot, ["push", "-u", "origin", "main"]);
  return remote;
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
