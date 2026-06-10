import { describe, expect, it } from "vitest";
import { parseReleaseCard, type ReleaseCard } from "../card.js";
import { buildBlogDraftMarkdown, defaultBlogDraftPath } from "../blog-draft.js";

const CARD: ReleaseCard = {
  id: "spark-2026",
  kind: "launch-tier",
  title: "Hyperliquid Spark is live on Infinex",
  ship_date: "2026-05-28",
  audience: ["web", "x"],
  deployed_facts: [
    "Hyperliquid Spark is live on Infinex from 2026-05-28",
    "Spark routes perp trades from Infinex directly to Hyperliquid L1",
  ],
  headline: "Hyperliquid Spark is live on Infinex",
  tier_reason: "first Hyperliquid perps integration",
  product_page_url: "https://infinex.xyz/news/hyperliquid-spark",
};

describe("blog draft scaffold", () => {
  it("prefills release facts and canonical touchpoint slots", () => {
    const markdown = buildBlogDraftMarkdown(CARD);

    expect(markdown).toContain('release_id: "spark-2026"');
    expect(markdown).toContain('canonical_url: "https://infinex.xyz/news/spark-2026"');
    for (const fact of CARD.deployed_facts) {
      expect(markdown).toContain(JSON.stringify(fact));
    }
    for (const heading of ["### X", "### Telegram", "### Website Modal", "### Email", "### Press"]) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain("Every asserted claim appears in `deployed_facts`.");
  });

  it("keeps the default draft path stable", () => {
    expect(defaultBlogDraftPath(CARD)).toBe("drafts/spark-2026.md");
  });

  it("allows non-generator touchpoints on release cards", () => {
    const card = parseReleaseCard({
      ...CARD,
      audience: ["x", "telegram", "email", "press"],
    });

    expect(card.audience).toEqual(["x", "telegram", "email", "press"]);
  });
});
