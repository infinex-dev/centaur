import { describe, expect, it } from "vitest";
import { INFINEX_VOICE } from "../voice/infinex.js";

describe("Infinex voice spec v2 substrate", () => {
  it("carries the Mirodan kernel and drive table as first-class voice data", () => {
    expect(INFINEX_VOICE.mirodan_kernel).toContain("Motion Factors");
    expect(INFINEX_VOICE.mirodan_kernel).toContain("Subdued, hidden, or introvert does not mean absent");
    expect(INFINEX_VOICE.mirodan_kernel).toContain("axis is a structural read, not a playable verb");
    expect(INFINEX_VOICE.drive_table).toContain("primary = bottom-left");
    expect(INFINEX_VOICE.drive_table).toContain("extravert = top-right");
    expect(INFINEX_VOICE.drive_table).toContain("stable|penetrating|flow");
    expect(INFINEX_VOICE.drive_table).toContain("primary=spell");
  });

  it("models Diagram D with all four drive slots, not just a two-word axis", () => {
    expect(INFINEX_VOICE.drive_primary).toBe("spell");
    expect(INFINEX_VOICE.drive_secondary).toBe("doing");
    expect(INFINEX_VOICE.drive_introvert).toBe("passion");
    expect(INFINEX_VOICE.drive_extravert).toBe("vision");
    expect(INFINEX_VOICE.drive_axis).toBe("Spell → Vision");
  });
});
