/**
 * Re-run Bridge.xyz card through the TWO-CALL generator. Surfaces Stage A's
 * committed InnerWork alongside Stage B's drafts so the operator can see the
 * interpretation as well as the output.
 *
 * Run: pnpm tsx scripts/rerun-bridge-card.ts
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseReleaseCard } from "../src/card.js";
import {
  draftFromInnerWork,
  generateInnerWork,
  type InnerWork,
} from "../src/generator.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

// Inline .env loader.
try {
  const env = readFileSync("/Users/opaque/.superset/projects/comms-factory/.env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || !m[1]) continue;
    if (!process.env[m[1]]) {
      const raw = (m[2] ?? "").replace(/^["']|["']$/g, "");
      process.env[m[1]] = raw;
    }
  }
} catch {
  /* live mode will fail loudly */
}

const CARD_ID = "01KS6QJNEGFYP6X048V8Y900DM";
const DB_PATH = "/Users/opaque/.superset/projects/comms-factory/harness/harness.db";
const OUT = "/Users/opaque/.superset/projects/comms-factory/research/bridge-card-rerun-2026-05-22.md";

function sqlite(query: string): string {
  return execFileSync("sqlite3", [DB_PATH, "-json", query], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

const cardRowJson = sqlite(
  `SELECT release_card_json FROM release_cards WHERE card_id = '${CARD_ID}'`,
);
const cardRows = JSON.parse(cardRowJson || "[]") as { release_card_json: string }[];
const cardRow = cardRows[0];
if (!cardRow) throw new Error(`card not found: ${CARD_ID}`);

const card = parseReleaseCard(JSON.parse(cardRow.release_card_json));

interface ExistingRow {
  id: string;
  channel: string;
  text: string;
  validation_passed: number;
}
const existingJson = sqlite(
  `SELECT id, channel, text, validation_passed FROM candidates WHERE card_id = '${CARD_ID}' ORDER BY attempt, id`,
);
const existing = JSON.parse(existingJson || "[]") as ExistingRow[];

console.log("Card inner-work fields (operator-declared on the card):");
console.log(`  through_action: ${card.through_action ?? "(none)"}`);
console.log(`  obstacle: ${card.obstacle ?? "(none)"}`);
console.log(`  lining: ${card.lining ?? "(none)"}`);
console.log(`  reader_prior: ${card.reader_prior ?? "(none)"}`);
console.log(`  not_the_point: ${card.not_the_point ?? "(none)"}`);
console.log("");
console.log(`Existing candidates in harness: ${existing.length}`);
console.log("");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not set — cannot run live generator");
  process.exit(1);
}

const channel = "web" as const;
const n = 6;

// --- Stage A: produce InnerWork ----------------------------------------------
console.log(`Stage A: generating InnerWork (channel=${channel}, mode=live)...`);
console.log("");
const innerWork: InnerWork = await generateInnerWork(card, {
  channel,
  mode: "live",
  voice: INFINEX_VOICE,
});

console.log("Stage A committed:");
console.log(`  thesis:         ${innerWork.thesis}`);
console.log(`  through_action: ${innerWork.through_action}`);
console.log(`  obstacle:       ${innerWork.obstacle}`);
console.log(`  lining:         ${innerWork.lining}`);
if (innerWork.reader_prior) console.log(`  reader_prior:   ${innerWork.reader_prior}`);
if (innerWork.not_the_point) console.log(`  not_the_point:  ${innerWork.not_the_point}`);
console.log(`  beat_plan (${innerWork.beat_plan.length} beats):`);
for (const [i, b] of innerWork.beat_plan.entries()) {
  console.log(`    ${i + 1}. ${b.tempo} — verb: ${b.verb}`);
  console.log(`        micro_objective: ${b.micro_objective}`);
  console.log(`        obstacle_local:  ${b.obstacle_local}`);
  if (b.shadow_move) console.log(`        shadow_move:     ${b.shadow_move}`);
}
if (innerWork.rationale) console.log(`  rationale:      ${innerWork.rationale}`);
console.log("");

// --- Stage B: draft N candidates against the InnerWork ----------------------
console.log(`Stage B: drafting ${n} candidates against committed InnerWork...`);
console.log("");
const newCandidates = await draftFromInnerWork(card, innerWork, {
  channel,
  n,
  mode: "live",
  voice: INFINEX_VOICE,
});

// --- Report ----------------------------------------------------------------
const md: string[] = [];
md.push(`# Bridge.xyz card re-run — 2026-05-22 (Phase 2: two-call generator)`);
md.push("");
md.push(`Card: \`${CARD_ID}\` (Bridge.xyz fiat deposit, kind=\`split\`).`);
md.push("");
md.push(`This run uses the new TWO-CALL generator: Stage A produces InnerWork (interpretation), Stage B drafts N candidates against the committed plan. Compare to the previous single-call run earlier this session.`);
md.push("");

md.push(`## Card inner-work (backfilled today)`);
md.push("");
md.push(`- **through_action**: ${card.through_action}`);
md.push(`- **obstacle**: ${card.obstacle}`);
md.push(`- **reader_prior**: ${card.reader_prior}`);
md.push(`- **not_the_point**: ${card.not_the_point}`);
md.push(`- **lining**: ${card.lining}`);
md.push("");

md.push(`## Stage A — committed InnerWork (the model's planning before drafting)`);
md.push("");
md.push(`- **thesis**: ${innerWork.thesis}`);
md.push(`- **through_action** (refined or inherited from card): ${innerWork.through_action}`);
md.push(`- **obstacle**: ${innerWork.obstacle}`);
md.push(`- **lining**: ${innerWork.lining}`);
if (innerWork.reader_prior) md.push(`- **reader_prior**: ${innerWork.reader_prior}`);
if (innerWork.not_the_point) md.push(`- **not_the_point**: ${innerWork.not_the_point}`);
if (innerWork.rationale) md.push(`- **rationale**: ${innerWork.rationale}`);
md.push("");
md.push(`### Beat plan (${innerWork.beat_plan.length} beats)`);
md.push("");
md.push(`| # | tempo | verb (transitive) | micro_objective | obstacle_local | shadow_move |`);
md.push(`|---|---|---|---|---|---|`);
for (const [i, b] of innerWork.beat_plan.entries()) {
  md.push(`| ${i + 1} | ${b.tempo} | ${b.verb} | ${b.micro_objective} | ${b.obstacle_local} | ${b.shadow_move ?? "—"} |`);
}
md.push("");

md.push(`## BEFORE — existing candidates from harness (single-call, no inner-work)`);
md.push("");
for (const row of existing) {
  md.push(`### existing-${row.id} (${row.channel}, validation_passed=${row.validation_passed})`);
  md.push("```");
  md.push(row.text);
  md.push("```");
  md.push("");
}

md.push(`## AFTER — new candidates (Phase 2 two-call, InnerWork above)`);
md.push("");
for (const c of newCandidates) {
  md.push(`### ${c.id} (${c.channel})`);
  md.push("```");
  md.push(c.text);
  md.push("```");
  if (c.rationale) md.push(`*rationale*: ${c.rationale}`);
  if (c.deployed_facts_used && c.deployed_facts_used.length > 0) {
    md.push(`*deployed_facts_used*: ${JSON.stringify(c.deployed_facts_used)}`);
  }
  if (c.not_said && c.not_said.length > 0) {
    md.push(`*not_said*:`);
    for (const nd of c.not_said) md.push(`  - ${nd.fact} — ${nd.reason}`);
  }
  md.push("");
}

// Diagnostic checks
md.push(`## Falsifiable checks`);
md.push("");

const dissolutionRegex =
  /\b(no longer|stops? being|used to|wall|silo|gap|dissolv\w+|collaps\w+|disappear\w+|ended|ends|stops existing|stop existing|same account|already lives|already holds|wasn't yours|isn't yours|stop needing)\b/i;

md.push(`### 1. Dissolution / wall language (any post that names something ending)`);
md.push("");
let beforeHits = 0;
for (const row of existing) {
  if (row.text.match(dissolutionRegex)) beforeHits++;
}
let afterHits = 0;
for (const c of newCandidates) {
  if (c.text.match(dissolutionRegex)) afterHits++;
}
md.push(`- BEFORE: ${beforeHits}/${existing.length}`);
md.push(`- AFTER:  ${afterHits}/${newCandidates.length}`);
md.push("");

// Currency-list regression check — specific test of whether not_the_point landed
const currencyListRegex =
  /\b(USD,\s*EUR|EUR,\s*MXN|MXN,\s*BRL|BRL,\s*GBP|GBP,\s*COP|USD.*EUR.*MXN|ACH.*wire.*SEPA)\b/i;

md.push(`### 2. Supported-currencies listicle regression (not_the_point said NO)`);
md.push("");
let beforeListicle = 0;
for (const row of existing) {
  if (row.text.match(currencyListRegex)) beforeListicle++;
}
let afterListicle = 0;
for (const c of newCandidates) {
  if (c.text.match(currencyListRegex)) afterListicle++;
}
md.push(`- BEFORE: ${beforeListicle}/${existing.length} (single-call routinely listed currencies)`);
md.push(`- AFTER:  ${afterListicle}/${newCandidates.length} (two-call should respect not_the_point)`);
md.push("");

// Verb-tempo coherence: does each beat carry its declared verb's energy?
md.push(`### 3. Beat-plan execution (each candidate has N paragraphs matching N beats)`);
md.push("");
for (const c of newCandidates) {
  const paragraphs = c.text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const match = paragraphs.length === innerWork.beat_plan.length ? "✓" : `✗ (${paragraphs.length} ≠ ${innerWork.beat_plan.length})`;
  md.push(`- ${c.id}: ${match}`);
}
md.push("");

writeFileSync(OUT, md.join("\n"));
console.log(`Wrote: ${OUT}`);
console.log("");
console.log("=== HEADLINE METRICS ===");
console.log(`Dissolution language:        BEFORE ${beforeHits}/${existing.length}  →  AFTER ${afterHits}/${newCandidates.length}`);
console.log(`Currency-list regression:    BEFORE ${beforeListicle}/${existing.length}  →  AFTER ${afterListicle}/${newCandidates.length}`);
console.log("");
console.log("=== NEW CANDIDATES ===");
for (const c of newCandidates) {
  console.log(`--- ${c.id} ---`);
  console.log(c.text);
  console.log("");
}
