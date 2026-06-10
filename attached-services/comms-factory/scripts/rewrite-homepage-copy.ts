/**
 * Rewrite Infinex homepage strings through the three-subagent loop:
 *   1. Intent extractor (Sonnet) — abstract job-to-be-done from shipped copy.
 *   2. In-character generator (Opus) — re-derive copy from intent + character
 *      spec ONLY. Never sees current_text.
 *   3. Blind validator (Sonnet) — already-locked auditTextLLM().
 *
 * If the validator's blind read of the regenerated line disagrees with the
 * generator's declared tempo, the orchestrator retries with feedback (max 3
 * attempts). current_text is never threaded into the generator on retry.
 *
 * The inventory mirrors the H01–H20 set from
 * scripts/dogfood-homepage-tempo-fit.ts, but STRIPS the `declared` field — the
 * whole point of this experiment is to see whether the character spec alone
 * (no human-asserted tempo) can re-derive plausible copy. Letting the operator
 * declare tempo would poison the test.
 *
 * Run:
 *   pnpm tsx scripts/rewrite-homepage-copy.ts > research/infinex-homepage-rewrite.md
 *   pnpm tsx scripts/rewrite-homepage-copy.ts --ids=H01,H07,H14 > /tmp/spotcheck.md
 */

import {
  POISONING_THRESHOLD,
  rewriteCopyLoop,
  type CopyRewriteResult,
} from "../src/copy-rewrite-llm.js";

type Job =
  | "hero"
  | "section_head"
  | "value_prop"
  | "feature_title"
  | "feature_description"
  | "trust_line"
  | "partner_credit"
  | "positioning"
  | "cta";

interface Sample {
  id: string;
  text: string;
  surface: string;
  job: Job;
}

// Same H01-H20 set as scripts/dogfood-homepage-tempo-fit.ts, with the
// `declared` field intentionally removed. Surface descriptions inline the
// homepage placement so the intent extractor can read structural context
// without seeing the operator's tempo guess.
const SAMPLES: Sample[] = [
  { id: "H01", surface: "Infinex homepage — hero", job: "hero", text: "Change the way you crypto." },
  { id: "H02", surface: "Infinex homepage — value prop label", job: "value_prop", text: "Unified portfolio." },
  { id: "H03", surface: "Infinex homepage — value prop label", job: "value_prop", text: "Multi-provider trading." },
  { id: "H04", surface: "Infinex homepage — value prop label", job: "value_prop", text: "Serious Opsec." },
  { id: "H05", surface: "Infinex homepage — primary CTA", job: "cta", text: "Get Infinex" },
  { id: "H06", surface: "Infinex homepage — section opener for shipped + upcoming", job: "section_head", text: "See everything we've shipped, and everything that's coming up" },
  { id: "H07", surface: "Infinex homepage — features section opener", job: "section_head", text: "Explore key features" },
  { id: "H08", surface: "Infinex homepage — wallet feature description", job: "feature_description", text: "Passkey-first, gas-abstracted wallet with support for 20+ chains." },
  { id: "H09", surface: "Infinex homepage — product enumeration", job: "feature_description", text: "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain." },
  { id: "H10", surface: "Infinex homepage — wallet import feature", job: "feature_description", text: "More than view-only. Import or connect existing wallets and take control." },
  { id: "H11", surface: "Infinex homepage — wallet connectivity feature", job: "feature_description", text: "Connect securely to any dapp and take your account with you." },
  { id: "H12", surface: "Infinex homepage — security tier feature", job: "feature_description", text: "Passkey to Ledger to Safe. Choose the Opsec to suit your spec." },
  { id: "H13", surface: "Infinex homepage — rewards feature", job: "feature_description", text: "Switch to Infinex and earn crates and cashback on every trade." },
  { id: "H14", surface: "Infinex homepage — top-level positioning line", job: "positioning", text: "One super app." },
  { id: "H15", surface: "Infinex homepage — perps feature description", job: "feature_description", text: "Trade perps in-app with up to 40x leverage" },
  { id: "H16", surface: "Infinex homepage — partner credit line", job: "partner_credit", text: "Powered by Hyperliquid" },
  { id: "H17", surface: "Infinex homepage — partner credit line", job: "partner_credit", text: "Powered by Polymarket" },
  { id: "H18", surface: "Infinex homepage — trust footer line", job: "trust_line", text: "Your keys, secured by Turnkey" },
  { id: "H19", surface: "Infinex homepage — value prop label", job: "value_prop", text: "Phishing resistant security" },
  { id: "H20", surface: "Infinex homepage — value prop label", job: "value_prop", text: "See what privileges you're granting" },
];

const IDS_ARG = process.argv.find((arg) => arg.startsWith("--ids="));
const ONLY_IDS = IDS_ARG
  ? new Set(IDS_ARG.slice("--ids=".length).split(",").map((id) => id.trim()).filter(Boolean))
  : null;

const SELECTED = ONLY_IDS ? SAMPLES.filter((s) => ONLY_IDS.has(s.id)) : SAMPLES;

function escapeCell(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ");
}

function fmtSimilarity(value: number): string {
  return value.toFixed(2);
}

console.error(`Rewriting ${SELECTED.length} homepage string(s): ${SELECTED.map((s) => s.id).join(", ")}`);

const results: CopyRewriteResult[] = [];

for (const sample of SELECTED) {
  process.stderr.write(`[${sample.id}] extract`);
  const result = await rewriteCopyLoop(
    {
      id: sample.id,
      surface: sample.surface,
      job: sample.job,
      current_text: sample.text,
    },
    {
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
  results.push(result);
}

// -- Markdown report ----------------------------------------------------------

console.log("# Infinex Homepage — Spec-Only Rewrite Loop");
console.log();
console.log("Date: 2026-05-15");
console.log("Source strings: https://infinex.xyz/ (fetched 2026-05-15)");
console.log("Loop: intent extractor (Sonnet) → in-character generator (Opus, blind to current_text) → blind validator (Sonnet).");
console.log();
console.log("## Method");
console.log();
console.log("Three-subagent loop, distinct API calls, distinct prompts:");
console.log();
console.log("1. **Intent extractor** reads `(surface, job, current_text)` and emits `{intent, constraints}`. It is forbidden from echoing shipped wording or recommending phrasing.");
console.log("2. **In-character generator** reads `(surface, job, intent, constraints)` plus the locked Infinex character spec. It NEVER sees the shipped wording. It picks one of the five main tempi and writes a replacement.");
console.log("3. **Blind validator** is the existing `auditTextLLM()` — classifies the regenerated line blind to the declared tempo. If `independent_classification.tempo != selected_tempo` OR the verdict fails, the orchestrator retries with feedback (max 3 attempts).");
console.log();
console.log("The point: if the regenerated copy reads in-character AND the generator + validator agree on tempo, the character spec is doing real work. If `similarity_to_current >= 0.6` (token Jaccard, stopword + length filtered), the loop converged too close to the shipped wording — flagged for review as a possible context-poisoning candidate.");
console.log();
console.log("## Results");
console.log();
console.log("| ID | Surface | Job | Current text | Extracted intent | Selected tempo | Replacement text | Verifier tempo | Verdict | Retries | Similarity |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
let passes = 0;
let fails = 0;
let totalRetries = 0;
const poisoningCandidates: CopyRewriteResult[] = [];
for (const result of results) {
  const verdict = result.ok ? "PASS" : "FAIL";
  if (result.ok) passes += 1;
  else fails += 1;
  totalRetries += result.retry_count;
  if (result.similarity_poisoning_flag) poisoningCandidates.push(result);
  console.log(
    `| ${result.id}` +
      ` | ${escapeCell(result.surface)}` +
      ` | ${escapeCell(SELECTED.find((s) => s.id === result.id)?.job ?? "")}` +
      ` | ${escapeCell(result.current_text)}` +
      ` | ${escapeCell(result.intent)}` +
      ` | ${escapeCell(result.final.selected_tempo)}` +
      ` | ${escapeCell(result.final.replacement_text)}` +
      ` | ${escapeCell(result.final.verifier_tempo)}` +
      ` | ${verdict}` +
      ` | ${result.retry_count}` +
      ` | ${fmtSimilarity(result.similarity_to_current)}` +
      ` |`,
  );
}

console.log();
console.log("## Constraints extracted (per string)");
console.log();
for (const result of results) {
  console.log(`- **${result.id}**: ${result.constraints.map((c) => `\`${c}\``).join(", ") || "_(none extracted)_"}`);
}

console.log();
console.log("## Summary");
console.log();
console.log(`Total strings rewritten: ${results.length}`);
console.log(`  - Passes (verifier agreed): ${passes}`);
console.log(`  - Fails (max attempts exhausted): ${fails}`);
console.log(`  - Mean retries: ${(totalRetries / Math.max(1, results.length)).toFixed(2)}`);
console.log();
console.log(`## Possible context-poisoning candidates (similarity ≥ ${POISONING_THRESHOLD.toFixed(2)})`);
console.log();
if (poisoningCandidates.length === 0) {
  console.log("_None — every regenerated line diverged from the shipped wording. Spec is doing real work._");
} else {
  console.log("These rows converged too close to the shipped wording. Either the intent extractor leaked phrasing, the job description encoded the answer, or the surface only has one viable phrasing for this character — flag and review.");
  console.log();
  console.log("| ID | Similarity | Current text | Replacement text |");
  console.log("|---|---|---|---|");
  for (const result of poisoningCandidates) {
    console.log(
      `| ${result.id}` +
        ` | ${fmtSimilarity(result.similarity_to_current)}` +
        ` | ${escapeCell(result.current_text)}` +
        ` | ${escapeCell(result.final.replacement_text)}` +
        ` |`,
    );
  }
}

console.log();
console.log("## Per-string attempt traces");
console.log();
for (const result of results) {
  console.log(`### ${result.id} — ${result.surface}`);
  console.log();
  console.log(`- Job: ${SELECTED.find((s) => s.id === result.id)?.job ?? ""}`);
  console.log(`- Current text: "${result.current_text}"`);
  console.log(`- Extracted intent: ${result.intent}`);
  console.log(`- Constraints: ${result.constraints.map((c) => `\`${c}\``).join(", ") || "(none)"}`);
  console.log(`- Final: ${result.ok ? "PASS" : "FAIL"} (similarity ${fmtSimilarity(result.similarity_to_current)})`);
  console.log();
  for (const attempt of result.attempts) {
    console.log(`#### Attempt ${attempt.attempt}`);
    console.log();
    console.log(`- Selected tempo: \`${attempt.selected_tempo}\` — ${attempt.tempo_reason}`);
    console.log(`- Replacement text: "${attempt.replacement_text}"`);
    console.log(`- Preserved intent: ${attempt.preserved_intent}`);
    console.log(`- Verifier tempo: \`${attempt.verifier_tempo}\` (${attempt.verifier_pass ? "PASS" : "FAIL"})`);
    console.log(`- Verifier rationale: ${attempt.verifier_rationale}`);
    if (attempt.verifier_feedback && !attempt.verifier_pass) {
      console.log(`- Verifier feedback: ${attempt.verifier_feedback}`);
    }
    console.log();
  }
}

console.error();
console.error(`Done. ${passes}/${results.length} passed; ${fails} failed; ${poisoningCandidates.length} poisoning candidate(s).`);
