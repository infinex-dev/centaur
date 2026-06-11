import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../../../src/card.js";
import { HttpError } from "../http.js";
import { CHANNELS, normalizeChannels } from "./generate.js";

// normalizeChannels only reads card.audience when the value is undefined.
const card = { audience: ["x"] } as unknown as ReleaseCard;

describe("generate route channel allowlist", () => {
  it("accepts every generator-library channel", () => {
    const all = ["x", "x-thread", "web", "carousel", "modal", "in-product", "blog"];
    expect(normalizeChannels(all, card)).toEqual(all);
    for (const channel of all) expect(CHANNELS.has(channel)).toBe(true);
  });

  it("preserves the tweet→x alias", () => {
    expect(normalizeChannels(["tweet"], card)).toEqual(["x"]);
  });

  it("dedupes while preserving order", () => {
    expect(normalizeChannels(["blog", "x", "blog", "tweet"], card)).toEqual(["blog", "x"]);
  });

  it("rejects unknown channels with unsupported_channels", () => {
    try {
      normalizeChannels(["tiktok"], card);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).code).toBe("unsupported_channels");
    }
  });

  it("rejects an empty channel list with missing_channels", () => {
    try {
      normalizeChannels([], card);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as HttpError).code).toBe("missing_channels");
    }
  });
});
