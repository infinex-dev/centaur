/**
 * Dogfood: run real Infinex website/platform copy strings through the locked
 * Infinex voice pipeline. Reports per-string:
 *   - Layer 1 validator rule firings (slop / cliche / AI-slop / off-spec drive)
 *   - Layer 2 blind tempo classification (what tempo does it READ as?)
 *
 * Purpose: answer "would our verification loop catch the slop in shipped copy?"
 *
 * Run:  pnpm tsx scripts/dogfood-existing-copy.ts > research/infinex-dogfood-pipeline.md
 *       pnpm tsx scripts/dogfood-existing-copy.ts --llm > research/infinex-dogfood-pipeline.llm.md
 */

import { INFINEX_VOICE } from "../src/voice/infinex.js";
import { auditCopySetLLM } from "../src/validator-llm.js";
import {
  classifyTempoBlind,
  rejectCliches,
  rejectAIslop,
  rejectAntagonism,
  rejectListicleVoice,
  rejectOffSpecDrive,
  rejectClaimedPalettes,
} from "../src/validator.js";
import type { LLMCopyAuditItem } from "../src/validator-llm.js";

const USE_LLM = process.argv.includes("--llm");
const IDS_ARG = process.argv.find((arg) => arg.startsWith("--ids="));
const ONLY_IDS = IDS_ARG
  ? new Set(IDS_ARG.slice("--ids=".length).split(",").map((id) => id.trim()).filter(Boolean))
  : null;

// Real strings sourced from the 2026-05-15 platform dogfood transcript audit.
// Each is shipped (or recently-shipped) Infinex product / marketing copy.
const SAMPLES: { id: string; surface: string; text: string }[] = [
  { id: "S01", surface: "Website homepage hero", text: "Change the way you crypto." },
  { id: "S02", surface: "Import wallet pitch", text: "Give your wallet Infinex superpowers." },
  { id: "S03", surface: "Import wallet pitch", text: "Import to unlock seamless trading, management and multi-chain access." },
  { id: "S04", surface: "Import wallet — scanning", text: "Hang tight while we check." },
  { id: "S05", surface: "Import wallet — success", text: "Nice one!" },
  { id: "S06", surface: "External wallets card", text: "Bring your wallets into Infinex. Enjoy the seamless experience you love." },
  { id: "S07", surface: "Product subtitle", text: "Infinex, a crypto super app." },
  { id: "S08", surface: "Perps blurb", text: "Track your positions and PnL at a glance." },
  { id: "S09", surface: "Perps marketing", text: "Seamless on desktop and mobile." },
  { id: "S10", surface: "Send error", text: "You can't send to your own Infinex account address. Use Move instead." },
  { id: "S11", surface: "Deposit BTC note", text: "Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added." },
  { id: "S12", surface: "Deposit address warning", text: "This address may change. Always copy the address from here before each deposit." },
  { id: "S13", surface: "Earn label", text: "Liquid staking" },
  { id: "S14", surface: "Audit-proposed rewrite", text: "Import an external wallet." },
  { id: "S15", surface: "Audit-proposed rewrite", text: "Connect via seed phrase or private key." },
  { id: "S16", surface: "Audit-proposed rewrite", text: "Scanning wallet activity." },
  { id: "S17", surface: "Audit-proposed rewrite", text: "Wallet imported." },
  { id: "S18", surface: "Audit-proposed rewrite", text: "Copy a fresh address for every deposit." },
];

const SELECTED_SAMPLES = ONLY_IDS
  ? SAMPLES.filter((sample) => ONLY_IDS.has(sample.id))
  : SAMPLES;

const LAYER1_RULES = [
  { name: "cliches", fn: rejectCliches },
  { name: "ai-slop", fn: rejectAIslop },
  { name: "antagonism", fn: rejectAntagonism },
  { name: "listicle", fn: rejectListicleVoice },
  { name: "claimed-palettes", fn: rejectClaimedPalettes },
];

function runLayer1(text: string) {
  const failures: { rule: string; reason: string }[] = [];
  for (const { name, fn } of LAYER1_RULES) {
    const r = fn(text);
    if (!r.passed) failures.push({ rule: name, reason: r.reason ?? "(no reason)" });
  }
  const drive = rejectOffSpecDrive(text, INFINEX_VOICE);
  if (!drive.passed) failures.push({ rule: "off-spec-drive", reason: drive.reason ?? "(no reason)" });
  return failures;
}

function fmtTempo(text: string): string {
  const r = classifyTempoBlind(text, INFINEX_VOICE);
  if (r.tempo === "unknown") return "unknown (no anchor matched)";
  return `${r.tempo} (conf=${r.confidence.toFixed(2)}, margin=${r.margin.toFixed(2)})`;
}

function fmtLLM(verdict: LLMCopyAuditItem | undefined): string {
  if (!verdict) return "";
  const cls = verdict.independent_classification;
  const base = `${verdict.passed ? "PASS" : "FAIL"} · ${cls.tempo} (conf=${cls.confidence.toFixed(2)})`;
  if (verdict.passed) return `${base} · ${verdict.notes ?? cls.rationale}`;
  const issue = verdict.voice_issues[0];
  return `${base} · ${issue ? `${issue.rule}: ${issue.fix}` : verdict.feedback}`;
}

console.log("# Infinex Dogfood — Pipeline Verification");
console.log();
console.log("Date: 2026-05-15");
console.log();
console.log("Tests whether the locked Infinex TOV pipeline (Layer 1 regex slop + ");
console.log("Layer 2 blind tempo classifier) catches the slop in real shipped copy.");
console.log();
console.log("**Voice spec:** Stable + Flow-stressed + Penetrating, Drive = Spell+Vision (Diagram D).");
console.log("Main tempi: Commanding · Practical · Sombre · Irradiant · Sociable.");
console.log();
console.log("## Results");
console.log();
console.log(
  USE_LLM
    ? "| ID | Surface | Text | Layer 1 verdict | Deterministic tempo | Sonnet validator |"
    : "| ID | Surface | Text | Layer 1 verdict | Layer 2 tempo |",
);
console.log(USE_LLM ? "|---|---|---|---|---|---|" : "|---|---|---|---|---|");

let caught = 0;
let missed = 0;
const llmById = new Map<string, LLMCopyAuditItem>();
if (USE_LLM) {
  console.error(`Sonnet copy-set audit: ${SELECTED_SAMPLES.length} sample(s): ${SELECTED_SAMPLES.map((sample) => sample.id).join(", ")}`);
  const batch = await auditCopySetLLM(
    SELECTED_SAMPLES.map((sample) => ({
      id: sample.id,
      text: sample.text,
      surface: sample.surface,
      job: parseInt(sample.id.slice(1), 10) >= 14 ? "audit-proposed rewrite" : "existing shipped copy",
    })),
    { voice: INFINEX_VOICE },
  );
  console.error(`Sonnet copy-set audit complete: ${batch.items.length} verdict(s).`);
  for (const item of batch.items) llmById.set(item.id, item);
}

for (const s of SELECTED_SAMPLES) {
  const f = runLayer1(s.text);
  const layer1 =
    f.length === 0
      ? "PASS"
      : `FAIL · ${f.map((x) => `${x.rule}: ${x.reason}`).join(" · ")}`;
  const tempo = fmtTempo(s.text);
  const llm = USE_LLM ? llmById.get(s.id) : undefined;
  // Escape pipes in text for markdown table
  const safe = s.text.replace(/\|/g, "\\|");
  const safeLayer1 = layer1.replace(/\|/g, "\\|");
  if (USE_LLM) {
    const safeLLM = fmtLLM(llm).replace(/\|/g, "\\|");
    console.log(`| ${s.id} | ${s.surface} | "${safe}" | ${safeLayer1} | ${tempo} | ${safeLLM} |`);
  } else {
    console.log(`| ${s.id} | ${s.surface} | "${safe}" | ${safeLayer1} | ${tempo} |`);
  }
  if (s.id.startsWith("S") && parseInt(s.id.slice(1), 10) <= 13) {
    // S01-S13 are the shipped/marketing strings the audit flagged
    const llmCaught = llm ? !llm.passed : false;
    if (f.length > 0 || llmCaught) caught++;
    else missed++;
  }
}

console.log();
console.log("## Summary");
console.log();
const shippedCount = SELECTED_SAMPLES.filter((sample) => parseInt(sample.id.slice(1), 10) <= 13).length;
console.log(`Shipped/marketing strings tested (selected S01-S13): ${shippedCount}`);
console.log(USE_LLM ? `  - Caught by Layer 1 or Sonnet: ${caught}` : `  - Caught by Layer 1: ${caught}`);
console.log(`  - Passed (not caught): ${missed}`);
console.log();
console.log("The strings that PASS Layer 1 but are off-tone are the gap. They");
console.log("represent Infinex-specific allergens — they fail tone, not generic slop —");
console.log("and belong in brand-factory/brands/infinex/04-voice/tone.md once the gate");
console.log("flips, and/or in a new validator rule like rejectInfinexCasualToneInUtility.");
console.log();
console.log("## Audit-proposed rewrites (S14-S18) tempo readings");
console.log();
console.log("These are the rewrites the Gemini-pass audit proposed for the strings above.");
console.log("Layer 2 classifies them as the tempi the locked TOV expects for product UI:");
console.log("Commanding (labels/CTAs/success) + Practical (instructions/mechanics).");
