import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../card.js";
import {
  CHANNEL_GENERATION_PROFILES,
  buildSystemPrompt,
  draftFromInnerWork,
  generate,
  generateForChannels,
  generateInnerWork,
  type GenerationPromptCapture,
} from "../generator.js";
import { validate } from "../validator.js";
import { CREAM_OF_THE_CROP_VOICE } from "../voice/cream.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

const CARD: ReleaseCard = {
  id: "generator-test",
  kind: "launch-tier",
  title: "Fact A Launch",
  ship_date: "2026-05-13",
  audience: ["x", "web"],
  deployed_facts: ["Fact A is live"],
  headline: "Fact A",
  tier_reason: "test card",
};

describe("voice-portable system prompt", () => {
  it("emits Infinex's structural traits from its voice spec, not hardcoded text", () => {
    const prompt = buildSystemPrompt(INFINEX_VOICE);
    // Infinex's locked structural traits
    expect(prompt).toContain("banker-turned-crypto trailblazer");
    expect(prompt).toContain("No listicle openers");
    expect(prompt).toContain("No antagonism toward named competitors");
    // The prompt scaffolding still says "reason from character placement"
    expect(prompt).toContain("Do NOT apply a hardcoded ban list");
  });

  it("does not leak Infinex's structural traits into other voices", () => {
    // Cream of the Crop has no structural_traits defined — generator must
    // therefore not surface any Infinex-specific lines for it.
    const prompt = buildSystemPrompt(CREAM_OF_THE_CROP_VOICE);
    expect(prompt).not.toContain("banker-turned-crypto trailblazer");
    expect(prompt).not.toContain("No listicle openers");
    expect(prompt).not.toContain("No antagonism toward named competitors");
    // The structural-constraints HEADING should also be absent (no traits to list)
    expect(prompt).not.toContain("Structural constraints (character-derived");
  });

  it("renders the v2 Infinex prompt with the portable Mirodan substrate", () => {
    const prompt = buildSystemPrompt(INFINEX_VOICE, "v2");

    expect(prompt).toContain("spell → vision");
    expect(prompt).toContain("stable|penetrating|flow");
    for (const tempo of ["Commanding", "Practical", "Sombre", "Irradiant", "Sociable"]) {
      expect(prompt).toContain(tempo);
    }
    expect(prompt).not.toContain("Passion is OFF-SPEC");
    expect(prompt).toContain("primary = bottom-left");
    expect(prompt).toContain("extravert = top-right");
    expect(prompt).toContain("Subdued, hidden, or introvert does not mean absent");
    expect(prompt).toContain("axis is a structural read, not a playable verb");
  });

  it("makes current an alias for v2 while keeping v1-current available", () => {
    expect(buildSystemPrompt(INFINEX_VOICE, "current")).toBe(
      buildSystemPrompt(INFINEX_VOICE, "v2"),
    );
    expect(buildSystemPrompt(INFINEX_VOICE, "v1-current")).toContain("Historical lore");
    expect(buildSystemPrompt(INFINEX_VOICE, "current")).not.toContain("Historical lore");
  });
});

describe("channel-aware generation", () => {
  it("generates a separate candidate batch for each requested channel", async () => {
    const candidates = await generateForChannels(CARD, ["x", "web"], {
      mode: "stub",
      voice: INFINEX_VOICE,
      beats: { beats: [{ tempo: "commanding" }] },
      n: 1,
    });

    expect(candidates.map((candidate) => candidate.channel).sort()).toEqual(["web", "x"]);
  });

  it("fits deterministic in-product stubs to the channel max before validation", async () => {
    const candidates = await generate(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "in-product",
      beats: { beats: [{ tempo: "commanding" }] },
      n: 1,
    });

    expect(candidates[0]?.text.length).toBeLessThanOrEqual(
      CHANNEL_GENERATION_PROFILES["in-product"].maxChars,
    );
  });

  it("keeps compact multi-beat stubs classifiable by the selected voice", async () => {
    const beats = {
      beats: [
        { tempo: "human" as const },
        { tempo: "cool" as const },
        { tempo: "diffused" as const },
        { tempo: "irradiant" as const },
      ],
    };
    const candidates = await generate(CARD, {
      mode: "stub",
      voice: CREAM_OF_THE_CROP_VOICE,
      channel: "x",
      beats,
      n: 1,
    });
    const candidate = candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) throw new Error("expected candidate");
    const result = validate(candidate.text, {
      beats,
      voice: CREAM_OF_THE_CROP_VOICE,
      card: CARD,
      ...(candidate.deployed_facts_used !== undefined
        ? { deployed_facts_used: candidate.deployed_facts_used }
        : {}),
      ...(candidate.not_said !== undefined ? { not_said: candidate.not_said } : {}),
    });
    expect(result.failures.map((failure) => failure.rule)).not.toContain("beat-tempo-fit");
  });
});

describe("two-call generator (Phase 2)", () => {
  it("Stage A returns a valid InnerWork in stub mode", async () => {
    const innerWork = await generateInnerWork(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
    });

    // Required fields populated
    expect(innerWork.thesis).toBeTruthy();
    expect(innerWork.through_action).toBeTruthy();
    expect(innerWork.obstacle).toBeTruthy();
    expect(innerWork.lining).toBeTruthy();
    expect(innerWork.beat_plan.length).toBeGreaterThan(0);
    expect(innerWork.source).toBe("stub");

    // Every beat carries a transitive verb — no tempo declaration per
    // Mirodan (tempo emerges from the verb under inner work; validator
    // scores it post-hoc).
    for (const beat of innerWork.beat_plan) {
      expect(beat.verb).toBeTruthy();
      expect(beat.verb.length).toBeGreaterThan(2);
    }
  });

  it("inner-work step never declares a tempo per beat (Mirodan: tempo emerges, validator scores)", async () => {
    const innerWork = await generateInnerWork(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "x",
    });

    for (const beat of innerWork.beat_plan) {
      // BeatPlan has no tempo field. The verb is the actor's only conscious
      // lever; tempo is what the audience reads off the drafted prose.
      expect("tempo" in beat).toBe(false);
    }
  });

  it("drafting step preserves the inner-work beat verbs onto candidates as hints", async () => {
    const innerWork = await generateInnerWork(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
    });

    const candidates = await draftFromInnerWork(CARD, innerWork, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
      n: 2,
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.declared_beats.length).toBe(innerWork.beat_plan.length);
      for (let i = 0; i < candidate.declared_beats.length; i++) {
        // No tempo carried through — only the verb hint.
        expect(candidate.declared_beats[i]?.tempo).toBeUndefined();
        expect(candidate.declared_beats[i]?.hint).toBe(innerWork.beat_plan[i]?.verb);
      }
    }
  });

  it("generate() routes through Stage A → Stage B by default (no explicit beats)", async () => {
    const candidates = await generate(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
      n: 1,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0]?.declared_beats.length).toBeGreaterThan(0);
  });

  it("generate() honors pre-computed innerWork (skips Stage A)", async () => {
    const innerWork = await generateInnerWork(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
    });

    const candidates = await generate(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
      n: 1,
      innerWork,
    });

    // Two-call path no longer declares tempo per beat; the verb is the link.
    expect(candidates[0]?.declared_beats[0]?.hint).toBe(innerWork.beat_plan[0]?.verb);
  });

  it("generate() routes through legacy single-call path when explicit beats are supplied", async () => {
    // Explicit beats means caller wants a forced plan — exercise the legacy
    // path so existing fixtures keep working without rewriting.
    const candidates = await generate(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
      beats: { beats: [{ tempo: "commanding" }] },
      n: 1,
    });

    expect(candidates[0]?.declared_beats.length).toBe(1);
    expect(candidates[0]?.declared_beats[0]?.tempo).toBe("commanding");
  });
});

describe("prompt capture for harness visibility", () => {
  // The harness persists what was sent to the model per attempt. Wiring is
  // small but load-bearing — the operator's visibility into the generator ↔
  // validator feedback loop depends on these prompts being captured exactly
  // as built.

  function mockClient(jsonResponseText: string) {
    return {
      messages: {
        create: async () => ({
          content: [{ type: "text" as const, text: jsonResponseText }],
        }),
      },
    };
  }

  it("captures Stage A + Stage B prompts under the two-call live path", async () => {
    const innerWorkJson = JSON.stringify({
      thesis: "Bridge dissolves the wall.",
      through_action: "to dissolve the wall",
      obstacle: "users read 'bridge' as plumbing",
      lining: "on the surface: a feature ships. underneath: the chain seam is gone.",
      beat_plan: [
        { verb: "to dissolve", micro_objective: "name the seam ending", obstacle_local: "expectation of plumbing" },
      ],
    });
    const draftJson = JSON.stringify([
      { text: "The seam is gone.", rationale: "lands the dissolution", deployed_facts_used: [], not_said: [] },
    ]);
    // First create() call returns inner-work, second returns drafts.
    let callIndex = 0;
    const client = {
      messages: {
        create: async () => {
          const text = callIndex === 0 ? innerWorkJson : draftJson;
          callIndex += 1;
          return { content: [{ type: "text" as const, text }] };
        },
      },
    };

    const captureObj: GenerationPromptCapture = {};
    const candidates = await generate(CARD, {
      mode: "live",
      voice: INFINEX_VOICE,
      channel: "web",
      n: 1,
      client,
      capturePrompts: captureObj,
    });

    expect(candidates.length).toBe(1);
    expect(captureObj.inner_work).toBeDefined();
    expect(captureObj.inner_work?.system).toContain("Mirodan");
    expect(captureObj.inner_work?.user).toContain("Inner-work step");
    expect(captureObj.drafting).toBeDefined();
    expect(captureObj.drafting?.user).toContain("Drafting step");
    expect(captureObj.drafting?.user).toContain("Bridge dissolves the wall.");
  });

  it("captures legacy single-call prompt under the legacy live path", async () => {
    const draftJson = JSON.stringify([
      { text: "Hello world.", rationale: "stub", deployed_facts_used: [], not_said: [] },
    ]);
    const client = mockClient(draftJson);
    const captureObj: GenerationPromptCapture = {};
    await generate(CARD, {
      mode: "live",
      voice: INFINEX_VOICE,
      channel: "web",
      legacySingleCall: true,
      beats: { beats: [{ tempo: "commanding" }] },
      n: 1,
      client,
      capturePrompts: captureObj,
    });

    expect(captureObj.legacy).toBeDefined();
    expect(captureObj.legacy?.system).toContain("Mirodan");
    expect(captureObj.legacy?.user).toContain("Beat sequence to follow");
    expect(captureObj.inner_work).toBeUndefined();
    expect(captureObj.drafting).toBeUndefined();
  });

  it("threads feedback into the captured Stage A prompt for retries", async () => {
    const innerWorkJson = JSON.stringify({
      thesis: "x",
      through_action: "to land",
      obstacle: "o",
      lining: "on the surface: x. underneath: y.",
      beat_plan: [{ verb: "to land", micro_objective: "m", obstacle_local: "o" }],
    });
    const draftJson = JSON.stringify([
      { text: "ok", rationale: "x", deployed_facts_used: [], not_said: [] },
    ]);
    let callIndex = 0;
    const client = {
      messages: {
        create: async () => {
          const text = callIndex === 0 ? innerWorkJson : draftJson;
          callIndex += 1;
          return { content: [{ type: "text" as const, text }] };
        },
      },
    };
    const captureObj: GenerationPromptCapture = {};
    await generate(CARD, {
      mode: "live",
      voice: INFINEX_VOICE,
      channel: "web",
      n: 1,
      client,
      feedback: "Prior attempt was too explanatory.",
      capturePrompts: captureObj,
    });

    expect(captureObj.inner_work?.user).toContain("Prior attempt was too explanatory.");
    expect(captureObj.drafting?.user).toContain("Prior attempt was too explanatory.");
  });

  it("leaves capture empty in stub mode (no prompts are built)", async () => {
    const captureObj: GenerationPromptCapture = {};
    await generate(CARD, {
      mode: "stub",
      voice: INFINEX_VOICE,
      channel: "web",
      n: 1,
      capturePrompts: captureObj,
    });
    expect(Object.keys(captureObj).length).toBe(0);
  });
});
