#!/usr/bin/env tsx
/**
 * Tempo-collapse proof harness (2026-06-10).
 *
 * Generates live candidates from release cards via the two-call generator,
 * audits each with the Director, and writes:
 *   - <out>/corpus.md       — ID|Text table for scripts/classify-corpus.ts
 *   - <out>/results.json    — per-candidate text + Director verdicts
 *   - <out>/summary.json    — Director pass-rate + tempo counts (Director read)
 *
 * The v2 classifier (the gold-standard instrument) is run SEPARATELY on
 * corpus.md; this script never substitutes its own tempo judgment.
 *
 * Usage:
 *   pnpm tsx scripts/tempo-eval.ts --label=before [--cards=a.json,b.json] [--n=3] [--channel=x]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { parseReleaseCard, type ReleaseCard } from "../src/card.js";
import { generate, type Candidate, type Channel } from "../src/generator.js";
import { auditCandidateWithDirector, type DirectorAuditResult } from "../src/actor-director.js";

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnv(".env");
loadEnv("harness/.env.local");

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const eq = a.indexOf("=");
    return eq === -1 ? ([a.slice(2), "true"] as const) : ([a.slice(2, eq), a.slice(eq + 1)] as const);
  }),
);

const LABEL = args.get("label") ?? "before";
const CHANNEL = (args.get("channel") ?? "x") as Channel;
const N = Number.parseInt(args.get("n") ?? "3", 10);
const DEFAULT_CARDS = [
  "cards/bridge-fiat-deposit-2026-06-05.json",
  "cards/hyperliquid-spot-unified-2026-05-29.json",
  "cards/infinex-synthetix-perps-2026-05-29.json",
  "cards/swidge-bridge-2026-05-20.json",
  "cards/trezor-2026-05-19.json",
];
const CARD_PATHS = (args.get("cards")?.split(",") ?? DEFAULT_CARDS).map((p) => resolve(p.trim()));
const OUT_DIR = resolve(args.get("out") ?? `research/tempo-eval/${LABEL}`);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY required (live generation + Director audit).");
  process.exit(1);
}

interface EvalRow {
  id: string;
  card: string;
  channel: Channel;
  text: string;
  rationale?: string;
  director: {
    passed: boolean;
    copy_voice_passed: boolean;
    legal: boolean;
    primary_tempo: string;
    primary_confidence: number;
    voice_issues: string[];
    infinex_fit_reason: string;
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const cards: Array<{ name: string; card: ReleaseCard }> = CARD_PATHS.map((p) => ({
    name: basename(p).replace(/\.json$/, ""),
    card: parseReleaseCard(JSON.parse(readFileSync(p, "utf8"))),
  }));

  process.stderr.write(`[tempo-eval:${LABEL}] generating n=${N} on ${cards.length} card(s), channel=${CHANNEL}\n`);

  const generated = await Promise.all(
    cards.map(async ({ name, card }) => {
      const candidates = await generate(card, { channel: CHANNEL, n: N, mode: "live" });
      process.stderr.write(`  ${name}: ${candidates.length} candidate(s)\n`);
      return { name, card, candidates };
    }),
  );

  const rows: EvalRow[] = [];
  for (const { name, card, candidates } of generated) {
    const audits = await Promise.all(
      candidates.map(async (candidate: Candidate, i: number): Promise<EvalRow> => {
        const audit: DirectorAuditResult = await auditCandidateWithDirector({
          card,
          candidate,
          channel: CHANNEL,
        });
        return {
          id: `${name}-${CHANNEL}-${i + 1}`,
          card: name,
          channel: CHANNEL,
          text: candidate.text,
          ...(candidate.rationale ? { rationale: candidate.rationale } : {}),
          director: {
            passed: audit.passed,
            copy_voice_passed: audit.copy_voice_passed,
            legal: audit.infinex_fit.legal,
            primary_tempo: audit.primary_tempo,
            primary_confidence: audit.primary_confidence,
            voice_issues: audit.voice_issues,
            infinex_fit_reason: audit.infinex_fit.reason,
          },
        };
      }),
    );
    rows.push(...audits);
    process.stderr.write(`  ${name}: director audits done\n`);
  }

  const corpusLines = [
    `# tempo-eval corpus (${LABEL}) — generated ${CHANNEL} candidates`,
    "",
    "| ID | Text |",
    "|---|---|",
    ...rows.map((r) => `| ${r.id} | ${r.text.replace(/\|/g, "\\|").replace(/\r?\n+/g, " <br> ")} |`),
    "",
  ];
  writeFileSync(`${OUT_DIR}/corpus.md`, corpusLines.join("\n"));
  writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(rows, null, 2));

  const tempoCounts: Record<string, number> = {};
  for (const r of rows) tempoCounts[r.director.primary_tempo] = (tempoCounts[r.director.primary_tempo] ?? 0) + 1;
  const summary = {
    label: LABEL,
    channel: CHANNEL,
    n_per_card: N,
    candidates: rows.length,
    director_pass: rows.filter((r) => r.director.passed).length,
    director_copy_voice_pass: rows.filter((r) => r.director.copy_voice_passed).length,
    director_legal: rows.filter((r) => r.director.legal).length,
    director_tempo_counts: tempoCounts,
  };
  writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`corpus: ${OUT_DIR}/corpus.md`);
  console.log(`next: pnpm tsx scripts/classify-corpus.ts ${OUT_DIR}/corpus.md ${OUT_DIR}/classified.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
