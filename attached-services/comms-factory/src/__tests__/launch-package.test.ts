import { describe, expect, it } from "vitest";
import { appendFeatureCopyEntry } from "../emit-platform-pr.js";
import { buildLaunchPackage, featureCardEntry, normalizeBlogFrontmatter } from "../launch-package.js";

// Mirrors the LIVE FEATURES_COPY schema (verified 2026-06-12 against
// infinex-xyz/platform@main: {title: string; description?: string; …images optional}).
const FEATURES_FIXTURE = `type FeatureCopyOptions = { title: string; description?: string };
export const FEATURES_COPY: FeatureCopyOptions[] = [
  {
    title: "Homepage",
    description: "A command center view.",
  },
];
`;

const WEB_CANDIDATE = {
  id: "cand_web_1",
  channel: "web",
  structured: { kind: "web-card" as const, subheading: "Perpetual Futures", title: "Trade perps / in-app", caption: "Powered by Hyperliquid" },
};

const BLOG_MD = `---
title: "Perps launch"
date: 2026-06-01
category: changelogs
---

Perps are live as of 2026-06-01.
`;

describe("featureCardEntry", () => {
  it("maps structured web copy to the live schema, stripping the ' / ' line-break marker", () => {
    const entry = featureCardEntry(WEB_CANDIDATE.structured);
    expect(entry).toContain('"Trade perps in-app"');
    expect(entry).toContain('"Powered by Hyperliquid"');
    expect(entry).not.toContain("subheading"); // no slot in FeatureCopyOptions — dropped
  });

  it("round-trips through appendFeatureCopyEntry into the live-schema fixture", () => {
    const out = appendFeatureCopyEntry(FEATURES_FIXTURE, featureCardEntry(WEB_CANDIDATE.structured));
    expect(out).toContain("Trade perps in-app");
    expect(out).toContain("Homepage"); // existing entries untouched
  });
});

describe("normalizeBlogFrontmatter", () => {
  it("freshens the stale date and its verbatim echoes to emit-day", () => {
    const { text, dateChanges } = normalizeBlogFrontmatter(BLOG_MD, { title: "Perps launch", today: "2026-06-12" });
    expect(text).toContain("date: 2026-06-12");
    expect(text).toContain("as of 2026-06-12");
    expect(dateChanges.length).toBeGreaterThan(0);
  });

  it("synthesizes frontmatter when absent (title, date, published, category)", () => {
    const { text } = normalizeBlogFrontmatter("Just a body.", { title: "Perps launch", today: "2026-06-12" });
    expect(text).toMatch(/^---\n/);
    expect(text).toContain('title: "Perps launch"');
    expect(text).toContain("date: 2026-06-12");
    expect(text).toContain("published: true");
    expect(text).toContain("category: changelogs");
  });

  it("injects typefullyUrl when supplied and omits it otherwise", () => {
    const withUrl = normalizeBlogFrontmatter(BLOG_MD, { title: "t", today: "2026-06-12", typefullyUrl: "https://typefully.com/t/abc" });
    expect(withUrl.text).toContain("typefullyUrl: https://typefully.com/t/abc");
    const without = normalizeBlogFrontmatter(BLOG_MD, { title: "t", today: "2026-06-12" });
    expect(without.text).not.toContain("typefullyUrl");
  });

  it("ensures published: true via markChangelogPublished semantics", () => {
    const { text } = normalizeBlogFrontmatter(BLOG_MD, { title: "t", today: "2026-06-12" });
    expect(text).toContain("published: true");
  });
});

describe("buildLaunchPackage", () => {
  const card = { title: "Perps launch", deployed_facts: ["perps live"] };
  const finalByChannel = {
    blog: { text: BLOG_MD, candidate_id: "cand_blog_1", edited: false, pick: true },
    web: { text: "Perpetual Futures\nTrade perps in-app\nPowered by Hyperliquid", candidate_id: "cand_web_1", edited: false, pick: true },
    x: { text: "tweet", candidate_id: "cand_x_1", edited: false, pick: true },
  };

  it("builds blog+web: changelogMd normalized, featureCard from candidate.structured via candidate_id", () => {
    const built = buildLaunchPackage(card, finalByChannel, [WEB_CANDIDATE], { today: "2026-06-12" });
    expect(built.pkg.changelogSlug).toBe("perps-launch");
    expect(built.pkg.changelogMd).toContain("date: 2026-06-12");
    expect(built.pkg.featureCard?.dataTsEntry).toContain("Trade perps in-app");
    expect(built.pkg.roadmapTick).toBeUndefined(); // never guessed
  });

  it("omits missing channels: blog-only and web-only both work", () => {
    const blogOnly = buildLaunchPackage(card, { blog: finalByChannel.blog }, [], { today: "2026-06-12" });
    expect(blogOnly.pkg.changelogMd).toBeDefined();
    expect(blogOnly.pkg.featureCard).toBeUndefined();
    const webOnly = buildLaunchPackage(card, { web: finalByChannel.web }, [WEB_CANDIDATE], { today: "2026-06-12" });
    expect(webOnly.pkg.changelogMd).toBeUndefined();
    expect(webOnly.pkg.featureCard?.dataTsEntry).toContain("Trade perps in-app");
  });

  it("notes (not crashes) when web is approved but the structured candidate is missing", () => {
    const built = buildLaunchPackage(card, { web: finalByChannel.web }, [], { today: "2026-06-12" });
    expect(built.pkg.featureCard).toBeUndefined();
    expect(built.notes.join(" ")).toContain("web");
  });

  it("threads typefullyUrl into the blog frontmatter", () => {
    const built = buildLaunchPackage(card, { blog: finalByChannel.blog }, [], { today: "2026-06-12", typefullyUrl: "https://typefully.com/t/abc" });
    expect(built.pkg.changelogMd).toContain("typefullyUrl: https://typefully.com/t/abc");
  });
});
