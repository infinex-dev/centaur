import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../card.js";
import { generateImageBrief } from "../brief-generator.js";
import { CROP_SPECS, ImageBrief, SCENE_MAX_CHARS, STANDING_BRIEF_KINDS } from "../brief.js";

const CARD: ReleaseCard = {
  kind: "launch-tier",
  id: "hyperliquid-spot-2026-06-10",
  title: "Hyperliquid Spot Markets live on Infinex",
  ship_date: "2026-06-10",
  audience: ["web", "x", "x-thread", "blog"],
  deployed_facts: ["Hyperliquid Spot V1 is live in the Infinex Perps app; unified account required."],
  outward_product_name: "Hyperliquid Spot Markets",
  feature_states: [{ feature: "Unified account", state: "changing-at-ship", note: "required for spot" }],
  headline: "Hyperliquid Spot Markets are live on Infinex.",
  tier_reason: "First spot venue on Infinex.",
};

describe("generateImageBrief", () => {
  it("returns one generated surface covering all three standing kinds", async () => {
    const result = await generateImageBrief(CARD, { mode: "stub" });
    expect(result.source).toBe("stub");
    expect(result.structured.briefs.map((b) => b.kind)).toEqual(STANDING_BRIEF_KINDS);
    expect(result.text).toContain("HERO / COVER");
    expect(result.text).toContain("IN-APP MOBILE");
    expect(result.text).toContain("FEATURE DETAIL");
    for (const brief of result.structured.briefs) {
      expect(brief.crop_specs.length).toBeGreaterThan(0);
      expect(ImageBrief.parse(brief)).toBeTruthy();
    }
  });

  it("grounds scenes in the card subject", async () => {
    const result = await generateImageBrief(CARD, { mode: "stub" });
    for (const brief of result.structured.briefs) {
      expect(brief.scene).toContain("Hyperliquid Spot Markets");
    }
  });

  it("keeps every scene tweet-length (char-gated)", async () => {
    // A pathologically long subject must not produce a wall-of-text scene.
    const verbose = {
      ...CARD,
      outward_product_name: "Hyperliquid Spot Markets ".repeat(40).trim(),
    };
    const result = await generateImageBrief(verbose, { mode: "stub" });
    for (const brief of result.structured.briefs) {
      expect(brief.scene.length).toBeLessThanOrEqual(SCENE_MAX_CHARS);
    }
  });

  it("drops a cliché on-image line instead of shipping it", async () => {
    const sloppy = { ...CARD, outward_product_name: "Game-changer" };
    const result = await generateImageBrief(sloppy, { mode: "stub" });
    const hero = result.structured.briefs.find((b) => b.kind === "hero");
    expect(hero?.on_image_text.line).toBeNull();
    expect(hero?.on_image_text.validated).toBe(false);
    expect(hero?.on_image_text.failures.join(" ")).toMatch(/cliche/i);
    expect(result.text).toContain("On image: none");
  });
});

describe("CROP_SPECS", () => {
  it("covers every standing kind", () => {
    for (const kind of STANDING_BRIEF_KINDS) {
      expect(CROP_SPECS[kind].length).toBeGreaterThan(0);
    }
  });

  it("authors the hero at ~1.71:1 (guards the grounded crop numbers)", () => {
    const authorTarget = CROP_SPECS.hero[0];
    expect(authorTarget?.aspect).toBe("1.71:1");
    expect(authorTarget?.crop).toBe("center-cover");
  });

  it("treats in-app/feature-detail as letterboxed body images (no crop)", () => {
    expect(CROP_SPECS["in-app-mobile"].every((c) => c.crop === "contain")).toBe(true);
    expect(CROP_SPECS["feature-detail"].every((c) => c.crop === "contain")).toBe(true);
  });
});
