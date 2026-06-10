/**
 * Experiment: rewrite howdensteenstra.com copy through two Adream placements.
 *
 * Diagram B — Space-stressed Radiating (Hamlet / Hedda Gabler): Spell→Vision axis.
 *             Outer: Stable primary + Mobile secondary. Composure holds feeling.
 *
 * Diagram D — Time-stressed Radiating (Ophelia / Blanche): Passion→Vision axis.
 *             Outer: Mobile primary + Stable secondary. Feeling fires before frame.
 *
 * Both specs share the same Adream inner attitude and Radiating aspect, so any
 * divergence in output is attributable to the Stress + Drive difference alone.
 *
 * Grounding is disabled — this is personal portfolio copy, not fact-grounded
 * product claims. The intent extractor still reads current_text structurally.
 *
 * Run:
 *   pnpm tsx scripts/rewrite-nick-copy.ts > research/nick-adream-experiment.md
 *   pnpm tsx scripts/rewrite-nick-copy.ts --ids=N01,N05,N07 > /tmp/spotcheck.md
 *   pnpm tsx scripts/rewrite-nick-copy.ts --spec=b > /tmp/b-only.md
 *   pnpm tsx scripts/rewrite-nick-copy.ts --spec=d > /tmp/d-only.md
 */

import {
  rewriteCopyLoop,
  type CopyRewriteResult,
} from "../src/copy-rewrite-llm.js";
import { NICK_B } from "../src/voice/nick-b.js";
import { NICK_D } from "../src/voice/nick-d.js";

type Job =
  | "hero"
  | "positioning"
  | "logline"
  | "statement"
  | "concept"
  | "cta"
  | "section_head"
  | "feature_description"
  | "credit_note"
  | "value_prop";

interface Sample {
  id: string;
  text: string;
  surface: string;
  job: Job;
}

// Samples drawn from howdensteenstra.com (fetched 2026-05-22).
// Covers homepage, Walk by Water, voiceover, and work pages.
const SAMPLES: Sample[] = [
  // -- Homepage --
  {
    id: "N01",
    surface: "howdensteenstra.com — homepage hero / identity label",
    job: "hero",
    text: "Actor·Writer·Voiceover·Film",
  },
  {
    id: "N02",
    surface: "howdensteenstra.com — homepage about paragraph",
    job: "positioning",
    text: "Actor, voiceover artist and sound mixer based between London and Sydney. Walk by Water (2026), written, produced, edited and starring, is his first short film.",
  },
  {
    id: "N03",
    surface: "howdensteenstra.com — homepage film card (Walk by Water)",
    job: "feature_description",
    text: "Walk by Water — Short film. First as writer-producer. World premiere available · submitting Autumn 2026 festival circuit.",
  },
  {
    id: "N04",
    surface: "howdensteenstra.com — homepage index tagline",
    job: "value_prop",
    text: "Index · 2026 London / Sydney",
  },

  // -- Walk by Water page --
  {
    id: "N05",
    surface: "howdensteenstra.com/walk-by-water — film logline",
    job: "logline",
    text: "Two exes walk along the Thames late at night. By morning, they may never speak again.",
  },
  {
    id: "N06",
    surface: "howdensteenstra.com/walk-by-water — formal concept note",
    job: "concept",
    text: "Shot twice, gender swapped between versions. Presented as one half.",
  },
  {
    id: "N07",
    surface: "howdensteenstra.com/walk-by-water — writer's statement opening",
    job: "statement",
    text: "I wrote Walk by Water as a response to a friend's script. Their script was told very deliberately from one perspective, and I couldn't get out of my head what the other character must have been experiencing. I wanted to make something that embraced fully the two-sidedness of a situation.",
  },
  {
    id: "N08",
    surface: "howdensteenstra.com/walk-by-water — writer's statement (the unexpected turn)",
    job: "statement",
    text: "The shock, when I was writing it, was the father's death. That wasn't the film I thought I was making. I thought I was writing about trying to find closure too late.",
  },
  {
    id: "N09",
    surface: "howdensteenstra.com/walk-by-water — writer's statement (the formal experiment rationale)",
    job: "statement",
    text: "We filmed it twice. Same script, same scenes, on the same stretch of river. The actors swapping roles between the two versions. Two reasons. First, a rebellion against the industry's habit of casting to type. Second, an experiment in projection: if the ex on the doorstep is a woman, does the audience read the scene one way?",
  },
  {
    id: "N10",
    surface: "howdensteenstra.com/walk-by-water — screener access CTA",
    job: "cta",
    text: "A private link is available for festival programmers, press and distribution. Password-protected on Vimeo. Email Nick for the password with a brief context note.",
  },

  // -- Voiceover page --
  {
    id: "N11",
    surface: "howdensteenstra.com/voiceover — section header",
    job: "section_head",
    text: "Voice over.",
  },
  {
    id: "N12",
    surface: "howdensteenstra.com/voiceover — descriptor line",
    job: "feature_description",
    text: "Commercial, brand and narrative voiceover.",
  },

  // -- Work page --
  {
    id: "N13",
    surface: "howdensteenstra.com/work — Edinburgh Fringe credit note",
    job: "credit_note",
    text: "Writer and performer. Outstanding Fringe Debut, Theatre Weekly 2018.",
  },
];

const IDS_ARG = process.argv.find((arg) => arg.startsWith("--ids="));
const SPEC_ARG = process.argv.find((arg) => arg.startsWith("--spec="))?.slice("--spec=".length);
const ONLY_IDS = IDS_ARG
  ? new Set(IDS_ARG.slice("--ids=".length).split(",").map((id) => id.trim()).filter(Boolean))
  : null;

const SELECTED = ONLY_IDS ? SAMPLES.filter((s) => ONLY_IDS.has(s.id)) : SAMPLES;

const RUN_B = !SPEC_ARG || SPEC_ARG === "b";
const RUN_D = !SPEC_ARG || SPEC_ARG === "d";

function escapeCell(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

function fmtSimilarity(value: number): string {
  return value.toFixed(2);
}

async function runSpec(
  specLabel: string,
  voice: typeof NICK_B,
  samples: Sample[],
): Promise<Map<string, CopyRewriteResult>> {
  const results = new Map<string, CopyRewriteResult>();
  for (const sample of samples) {
    process.stderr.write(`[${specLabel}/${sample.id}] extract`);
    const result = await rewriteCopyLoop(
      {
        id: sample.id,
        surface: sample.surface,
        job: sample.job,
        current_text: sample.text,
      },
      {
        voice,
        enable_grounding: false,
        on_progress: (event) => {
          switch (event.stage) {
            case "extract_done":
              process.stderr.write(` ✓ → generate`);
              break;
            case "generate_done":
              process.stderr.write(` (${event.tempo}, attempt ${event.attempt})`);
              break;
            case "validate_start":
              process.stderr.write(` → verify`);
              break;
            case "validate_done":
              process.stderr.write(
                event.passed
                  ? ` ✓`
                  : ` ✗ (read as ${event.verifier_tempo}, retrying)`,
              );
              break;
            default:
              break;
          }
        },
      },
    );
    process.stderr.write(`\n`);
    results.set(sample.id, result);
  }
  return results;
}

// -- Run both specs ----------------------------------------------------------

process.stderr.write(
  `Rewriting ${SELECTED.length} sample(s): ${SELECTED.map((s) => s.id).join(", ")}\n`,
);

const bResults = RUN_B ? await runSpec("B", NICK_B, SELECTED) : new Map<string, CopyRewriteResult>();
const dResults = RUN_D ? await runSpec("D", NICK_D, SELECTED) : new Map<string, CopyRewriteResult>();

// -- Report ------------------------------------------------------------------

console.log("# Nick Adream Experiment — Diagram B vs Diagram D");
console.log();
console.log("Date: 2026-05-22");
console.log("Source: howdensteenstra.com (fetched 2026-05-22)");
console.log();
console.log("## Method");
console.log();
console.log("Same blind loop as `scripts/rewrite-homepage-copy.ts` — three subagents per string:");
console.log();
console.log("1. **Intent extractor** (Sonnet) — reads `(surface, job, current_text)`, emits `{intent, constraints}`. Forbidden from echoing shipped wording.");
console.log("2. **In-character generator** (Opus) — reads intent + constraints + one of the two character specs. Never sees current_text. Picks a tempo and writes.");
console.log("3. **Blind validator** (Sonnet) — classifies the generated line against the declared tempo. If they disagree, the orchestrator retries (max 3 attempts).");
console.log();
console.log("Grounding disabled — personal portfolio copy, no product facts to verify.");
console.log();
console.log("**Diagram B** — Adream Space-stressed Radiating. Spell → Vision axis. Outer: Stable primary + Mobile secondary. Character image: Hamlet, Hedda Gabler.");
console.log("**Diagram D** — Adream Time-stressed Radiating. Passion → Vision axis. Outer: Mobile primary + Stable secondary. Character image: Ophelia, Blanche DuBois.");
console.log();
console.log("## Comparison");
console.log();
console.log("| ID | Surface | Current copy | B replacement (tempo) | D replacement (tempo) |");
console.log("|---|---|---|---|---|");

for (const sample of SELECTED) {
  const b = bResults.get(sample.id);
  const d = dResults.get(sample.id);
  const bCell = b
    ? `${escapeCell(b.final.replacement_text)} *(${b.final.selected_tempo})*`
    : "—";
  const dCell = d
    ? `${escapeCell(d.final.replacement_text)} *(${d.final.selected_tempo})*`
    : "—";
  console.log(
    `| ${sample.id}` +
      ` | ${escapeCell(sample.surface)}` +
      ` | ${escapeCell(sample.text)}` +
      ` | ${bCell}` +
      ` | ${dCell}` +
      ` |`,
  );
}

console.log();
console.log("## Summary");
console.log();

if (RUN_B) {
  const bPasses = [...bResults.values()].filter((r) => r.ok).length;
  const bRetries = [...bResults.values()].reduce((acc, r) => acc + r.retry_count, 0);
  console.log(`**Diagram B**: ${bPasses}/${bResults.size} passed; ${bRetries} retries.`);
}
if (RUN_D) {
  const dPasses = [...dResults.values()].filter((r) => r.ok).length;
  const dRetries = [...dResults.values()].reduce((acc, r) => acc + r.retry_count, 0);
  console.log(`**Diagram D**: ${dPasses}/${dResults.size} passed; ${dRetries} retries.`);
}

console.log();
console.log("## Tempo distribution");
console.log();

if (RUN_B) {
  const bTempi = [...bResults.values()].map((r) => r.final.selected_tempo);
  const bCounts = bTempi.reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  console.log("**Diagram B tempi fired:**", Object.entries(bCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ×${n}`).join(", "));
}
if (RUN_D) {
  const dTempi = [...dResults.values()].map((r) => r.final.selected_tempo);
  const dCounts = dTempi.reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  console.log("**Diagram D tempi fired:**", Object.entries(dCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ×${n}`).join(", "));
}

console.log();
console.log("## Per-sample attempt traces");
console.log();

for (const sample of SELECTED) {
  console.log(`### ${sample.id} — ${sample.surface}`);
  console.log();
  console.log(`Current: "${sample.text}"`);
  console.log();

  const b = bResults.get(sample.id);
  if (b) {
    console.log(`#### Diagram B`);
    for (const attempt of b.attempts) {
      console.log(`- Attempt ${attempt.attempt}: \`${attempt.selected_tempo}\` — "${attempt.replacement_text}" — verifier: \`${attempt.verifier_tempo}\` (${attempt.verifier_pass ? "PASS" : "FAIL"})`);
    }
    console.log();
  }

  const d = dResults.get(sample.id);
  if (d) {
    console.log(`#### Diagram D`);
    for (const attempt of d.attempts) {
      console.log(`- Attempt ${attempt.attempt}: \`${attempt.selected_tempo}\` — "${attempt.replacement_text}" — verifier: \`${attempt.verifier_tempo}\` (${attempt.verifier_pass ? "PASS" : "FAIL"})`);
    }
    console.log();
  }
}

process.stderr.write("\nDone.\n");
