/**
 * Vitest wrapper for the self-test, so `pnpm test` covers it.
 *
 * Re-implements the same synthesis logic as self-test.ts (kept in sync) and
 * asserts pass-rate is 100%.
 */

import { describe, it, expect } from "vitest";
import { gradeAll, aggregate } from "./grader.js";
import type { ModelResponse } from "./grader.js";
import { QUESTIONS, type Question } from "./questions.js";

function synthIdealResponse(q: Question): string {
  switch (q.grader_kind) {
    case "exact":
      return q.correct_answer;
    case "one_of":
      return q.correct_answer[0]!;
    case "regex":
      return synthForRegex(q.id);
    case "all_of":
      return q.correct_answer.map((group) => group[0]!).join(", ");
    case "structured":
      return synthForStructured(q.id, q.correct_answer);
  }
}

function synthForRegex(id: string): string {
  const map: Record<string, string> = {
    "lvm-05-attitudes-shadow-moves":
      "attitude=2, drive=3 — Inner Attitudes use 2 Motion Factors and Drives use 3.",
    "mp-06-cold-quick-opener":
      "The Punching degrades to its prep-version: it reads as just Pressing.",
    "tp-04-slop-signature":
      "Paint-by-numbers slop — tempo without inner cause, dynamically correct but dramatically inert.",
    "dd-04-passion-disqualified-for-infinex":
      "Infinex's Penetrating aspect is Space-led, so Space is an active factor in Infinex; Passion is the Spaceless Drive — Space is subdued / latent in Passion. Active Space in Infinex contradicts subdued Space in Passion.",
    "dd-05-infinex-passion-fix":
      "Change the aspect from Penetrating to Enclosing (Weight-led). With Space no longer led by the aspect, the placement can route toward Passion-bearing Adream Time-stressed Enclosing instead.",
  };
  const v = map[id];
  if (!v) throw new Error(`No regex-synth string defined for ${id}`);
  return v;
}

function synthForStructured(
  id: string,
  spec: Record<
    string,
    { kind: "one_of"; values: string[] } | { kind: "regex"; values: string[] }
  >,
): string {
  const regexMap: Record<string, Record<string, string>> = {
    "bl-06-adream-illegal-stress": {
      reason:
        "Flow is already active in the Adream inner pair (Weight+Flow); a stress must come from outside the inner pair, so Flow-stressed Adream violates factor coherence.",
    },
    "cl-01-on-spec-commanding": { motor: "pressing → punching" },
    "cl-02-on-spec-sombre": { motor: "pressing → punching" },
    "cl-03-off-spec-passion-fomo": {
      mechanism: "Passion drive — Time-as-urgency / FOMO / deadline-as-protagonist.",
    },
    "cl-04-off-spec-ai-slop": {
      markers:
        "cliche ('game-changing'), AI-slop adjective ('revolutionary'), hype theater ('thrilled to', 'going to be huge')",
    },
    "cl-05-off-spec-antagonism": {
      mechanism: "antagonism toward a named competitor with pejoratives",
      character_clash:
        "Infinex's banker-turned-crypto-trailblazer / Duke / Werle character is 'in on the joke, never the bully' — conviction is already settled, so the voice does not need to punch sideways at competitors.",
    },
  };
  const lines: string[] = [];
  for (const [key, matcher] of Object.entries(spec)) {
    const value =
      matcher.kind === "one_of" ? matcher.values[0]! : regexMap[id]?.[key];
    if (!value) {
      throw new Error(`No structured-regex-synth value for ${id}.${key}`);
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

describe("Mirodan competence eval — self-test", () => {
  it("grades all questions as pass when fed synthesized ideal answers", () => {
    const responses: ModelResponse[] = QUESTIONS.map((q) => ({
      question_id: q.id,
      response: synthIdealResponse(q),
    }));
    const results = gradeAll(QUESTIONS, responses);
    const failed = results.filter((r) => !r.pass);
    if (failed.length > 0) {
      const detail = failed
        .map((f) => `  ${f.question_id}: ${f.reasoning}`)
        .join("\n");
      throw new Error(`Self-test failures:\n${detail}`);
    }
    expect(failed.length).toBe(0);
    const agg = aggregate(results);
    expect(agg.pass_rate).toBe(1);
  });

  it("rejects clearly-wrong responses across the board", () => {
    const garbage = QUESTIONS.map((q) => ({
      question_id: q.id,
      response: "I do not know. The sky is blue.",
    }));
    const results = gradeAll(QUESTIONS, garbage);
    const passed = results.filter((r) => r.pass);
    expect(passed.length).toBe(0);
  });

  it("has at least 24 questions covering all six categories", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(24);
    const cats = new Set(QUESTIONS.map((q) => q.category));
    expect(cats.size).toBe(6);
  });

  it("includes both laban_only and mirodan_specific discriminators", () => {
    const discs = new Set(QUESTIONS.map((q) => q.discriminator));
    expect(discs.has("laban_only")).toBe(true);
    expect(discs.has("mirodan_specific")).toBe(true);
  });
});
