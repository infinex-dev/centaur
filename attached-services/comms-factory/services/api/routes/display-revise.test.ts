import { describe, expect, it } from "vitest";
import { buildReviseSeeds, makeDisplayReviseHandler } from "./display.js";

const CARD = {
  kind: "launch-tier",
  id: "rel_1", // Base schema requires id + ship_date (card.ts Base)
  ship_date: "2026-06-12",
  title: "Perps launch",
  headline: "Perps launch", // required by the LaunchTier zod schema (card.ts:146)
  audience: ["blog"],
  deployed_facts: ["perps are live"],
  tier_reason: "test",
};
const MARKDOWN = "## Perps launch\n\nperps are live today.";
const COMMENTS = [
  { text_quote: "perps are live", body: "cite the venue" },
  { text_quote: "this span was rewritten away", body: "stale one" },
];

describe("buildReviseSeeds", () => {
  it("builds a prior-turn transcript carrying the current markdown verbatim", () => {
    const seeds = buildReviseSeeds(MARKDOWN, [{ textQuote: "perps are live", body: "cite the venue" }]);
    expect(seeds.seed_transcript).toHaveLength(2);
    expect(seeds.seed_transcript[0]?.role).toBe("user");
    expect(seeds.seed_transcript[1]).toEqual({ role: "assistant", content: MARKDOWN });
  });

  it("turns comments into DirectorNotes that quote the anchored span", () => {
    const seeds = buildReviseSeeds(MARKDOWN, [{ textQuote: "perps are live", body: "cite the venue" }]);
    expect(seeds.seed_notes.attempt).toBe(1);
    expect(seeds.seed_notes.notes.join(" ")).toContain("perps are live");
    expect(seeds.seed_notes.notes.join(" ")).toContain("cite the venue");
    expect(seeds.seed_notes.change?.copy?.length).toBe(1);
  });
});

describe("handleDisplayRevise", () => {
  function fakeOrchestrate(captured: { opts?: Record<string, unknown>; channels?: string[] }) {
    return async (_card: unknown, channels: string[], opts: Record<string, unknown>) => {
      captured.channels = channels;
      captured.opts = opts;
      return {
        picks: [{ id: "rev_1", channel: "blog", text: "REVISED MARKDOWN" }],
        selection_rationales: {},
        attempts: [{ records: [{ candidate: { id: "rev_1", channel: "blog" }, director_audit: { publication_gate: "pass" } }] }],
        exhausted: false,
      };
    };
  }

  it("feeds seeds + blog channel to the orchestrator and returns revised markdown + audit + stale anchors", async () => {
    const captured: { opts?: Record<string, unknown>; channels?: string[] } = {};
    const handler = makeDisplayReviseHandler(fakeOrchestrate(captured) as never, () => true);
    const result = await handler({
      request: {} as never, method: "POST", url: new URL("http://x/display/revise"), requestId: "t",
      body: { markdown: MARKDOWN, comments: COMMENTS, release_card: CARD, run_id: "run_1" },
    });
    expect(captured.channels).toEqual(["blog"]);
    const seeds = captured.opts as { seed_transcript?: Array<{ content: string }>; seed_notes?: { notes: string[] } };
    expect(seeds.seed_transcript?.[1]?.content).toBe(MARKDOWN);
    // the stale comment (textQuote absent from markdown) is NOT fed to the reviser:
    expect(seeds.seed_notes?.notes.join(" ")).not.toContain("stale one");
    expect(result.body).toMatchObject({
      ok: true,
      markdown: "REVISED MARKDOWN",
      director_audit: { publication_gate: "pass" },
      stale_anchors: [{ text_quote: "this span was rewritten away", body: "stale one" }],
    });
  });

  it("400s on an invalid release card", async () => {
    const handler = makeDisplayReviseHandler(fakeOrchestrate({}) as never, () => true);
    await expect(
      handler({ request: {} as never, method: "POST", url: new URL("http://x"), requestId: "t",
        body: { markdown: MARKDOWN, comments: [], release_card: { nope: true }, run_id: "r" } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("400s no_actionable_comments when every anchor is stale", async () => {
    const handler = makeDisplayReviseHandler(fakeOrchestrate({}) as never, () => true);
    await expect(
      handler({ request: {} as never, method: "POST", url: new URL("http://x"), requestId: "t",
        body: { markdown: MARKDOWN, comments: [{ text_quote: "gone span", body: "stale" }], release_card: CARD, run_id: "r" } }),
    ).rejects.toMatchObject({ status: 400, code: "no_actionable_comments" });
  });

  it("returns display_not_configured when the capability is off (no LLM call)", async () => {
    const captured: { opts?: Record<string, unknown> } = {};
    const handler = makeDisplayReviseHandler(fakeOrchestrate(captured) as never, () => false);
    const result = await handler({ request: {} as never, method: "POST", url: new URL("http://x"), requestId: "t",
      body: { markdown: MARKDOWN, comments: COMMENTS, release_card: CARD, run_id: "run_1" } });
    expect(result.body).toMatchObject({ ok: false, error: "display_not_configured" });
    expect(captured.opts).toBeUndefined(); // the orchestrator was never invoked
  });
});
