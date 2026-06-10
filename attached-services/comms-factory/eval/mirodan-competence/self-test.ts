/**
 * Self-test for the Mirodan competence eval.
 *
 * For each question, synthesize an "ideal" response from the answer key (or
 * the rationale, where helpful) and feed it through the grader. Every
 * question must pass — failing the self-test means the grader rules and the
 * answer-key declarations are out of sync.
 *
 * Run:
 *   pnpm tsx eval/mirodan-competence/self-test.ts
 */

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
      return synthForRegex(q.id, q.correct_answer);
    case "all_of":
      return q.correct_answer.map((group) => group[0]!).join(", ");
    case "structured":
      return synthForStructured(q.id, q.correct_answer);
  }
}

function synthForRegex(id: string, _patterns: string[]): string {
  // Hand-crafted prose strings that satisfy at least one regex in the
  // question's pattern array. Each must be readable as a plausible model answer.
  switch (id) {
    case "lvm-05-attitudes-shadow-moves":
      return "attitude=2, drive=3 — Inner Attitudes use 2 Motion Factors and Drives use 3.";
    case "mp-06-cold-quick-opener":
      return "The Punching degrades to its prep-version: it reads as just Pressing.";
    case "tp-04-slop-signature":
      return "Paint-by-numbers slop — tempo without inner cause, dynamically correct but dramatically inert.";
    case "dd-04-passion-disqualified-for-infinex":
      return "Infinex's Penetrating aspect is Space-led, so Space is an active factor in Infinex; Passion is the Spaceless Drive — Space is subdued / latent in Passion. Active Space in Infinex contradicts subdued Space in Passion.";
    case "dd-05-infinex-passion-fix":
      return "Change the aspect from Penetrating to Enclosing (Weight-led). With Space no longer led by the aspect, the placement can route toward Passion-bearing Adream Time-stressed Enclosing instead.";
    default:
      throw new Error(`No regex-synth string defined for ${id}`);
  }
}

function synthForStructured(
  id: string,
  spec: Record<
    string,
    { kind: "one_of"; values: string[] } | { kind: "regex"; values: string[] }
  >,
): string {
  const lines: string[] = [];
  for (const [key, matcher] of Object.entries(spec)) {
    let value: string;
    if (matcher.kind === "one_of") {
      value = matcher.values[0]!;
    } else {
      value = synthForStructuredRegexValue(id, key);
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

function synthForStructuredRegexValue(id: string, key: string): string {
  const map: Record<string, Record<string, string>> = {
    "bl-06-adream-illegal-stress": {
      reason: "Flow is already active in the Adream inner pair (Weight+Flow); a stress must come from outside the inner pair, so Flow-stressed Adream violates factor coherence.",
    },
    "cl-01-on-spec-commanding": {
      motor: "pressing → punching",
    },
    "cl-02-on-spec-sombre": {
      motor: "pressing → punching",
    },
    "cl-03-off-spec-passion-fomo": {
      mechanism: "Passion drive — Time-as-urgency / FOMO / deadline-as-protagonist.",
    },
    "cl-04-off-spec-ai-slop": {
      markers: "cliche ('game-changing'), AI-slop adjective ('revolutionary'), hype theater ('thrilled to', 'going to be huge')",
    },
    "cl-05-off-spec-antagonism": {
      mechanism: "antagonism toward a named competitor with pejoratives",
      character_clash:
        "Infinex's banker-turned-crypto-trailblazer / Duke / Werle character is 'in on the joke, never the bully' — conviction is already settled, so the voice does not need to punch sideways at competitors.",
    },
  };
  const v = map[id]?.[key];
  if (!v) throw new Error(`No structured-regex-synth value defined for ${id}.${key}`);
  return v;
}

function main(): void {
  const responses: ModelResponse[] = QUESTIONS.map((q) => ({
    question_id: q.id,
    response: synthIdealResponse(q),
  }));
  const results = gradeAll(QUESTIONS, responses);
  const failed = results.filter((r) => !r.pass);
  const agg = aggregate(results);

  console.log("\nMirodan competence eval — SELF-TEST");
  console.log("─".repeat(56));
  console.log(`Total questions: ${agg.total}`);
  console.log(`Passed:          ${agg.passed}`);
  console.log(`Pass rate:       ${(agg.pass_rate * 100).toFixed(1)}%`);
  console.log();
  console.log("By category:");
  for (const [cat, m] of Object.entries(agg.by_category)) {
    console.log(`  ${cat.padEnd(24)} ${m.passed}/${m.total}  (${(m.pass_rate * 100).toFixed(1)}%)`);
  }
  console.log();
  console.log("By discriminator:");
  for (const [d, m] of Object.entries(agg.by_discriminator)) {
    console.log(`  ${d.padEnd(24)} ${m.passed}/${m.total}  (${(m.pass_rate * 100).toFixed(1)}%)`);
  }
  console.log();
  if (failed.length === 0) {
    console.log("SELF-TEST PASSED — all questions grade as pass against synthesized ideal answers.");
    process.exit(0);
  } else {
    console.log(`SELF-TEST FAILED — ${failed.length} question(s) did not pass:`);
    for (const f of failed) {
      const q = QUESTIONS.find((qq) => qq.id === f.question_id)!;
      const resp = responses.find((r) => r.question_id === f.question_id)!.response;
      console.log(`\n  ${f.question_id} (${f.category})`);
      console.log(`    grader_kind: ${q.grader_kind}`);
      console.log(`    reasoning:   ${f.reasoning}`);
      console.log(`    synth resp:  ${JSON.stringify(resp.slice(0, 200))}`);
    }
    process.exit(1);
  }
}

main();
