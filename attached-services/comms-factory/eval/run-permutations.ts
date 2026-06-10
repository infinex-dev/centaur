/**
 * Permutation eval rig.
 *
 * For each (card, permutation, candidate_index):
 *   1. invoke generate() with the permutation flag
 *   2. append candidate to in-memory corpus
 *   3. after all candidates for a cell, write the corpus to a markdown file
 *      shaped for scripts/classify-corpus.ts's parseCorpus()
 *   4. spawn `pnpm tsx scripts/classify-corpus.ts <corpus.md> <output.json>`
 *   5. parse the JSON output
 *   6. insert each candidate into the harness DB tagged with prompt_variant
 *   7. compute cell metrics (validator pass, placement hit, register coverage,
 *      motor distribution, fact-contract violations, em-dash density, length)
 *
 * Wave 1 (this file) runs the smoke test: 1 card x 5 permutations x n=2 = 10
 * candidates. The full eval (5 cards x 5 permutations x n=30 = 750+) is Wave 2.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... pnpm tsx eval/run-permutations.ts \
 *     --cards=cards/trezor-2026-05-19.json \
 *     --permutations=current,kernel,placement,examples,full \
 *     --n=2 \
 *     --channel=x \
 *     --output-dir=eval/runs/smoke-2026-05-26 \
 *     --harness-db=harness/harness.db
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { ReleaseCard } from "../src/card.js";
import { parseReleaseCard } from "../src/card.js";
import {
  generate,
  type Candidate,
  type Channel,
  type PromptPermutation,
} from "../src/generator.js";
import { validate, type ValidationResult } from "../src/validator.js";

import { writeCorpusFile, parseVerifierJson, type VerifierResult } from "./corpus-format.js";
import { HarnessDb } from "./harness-db.js";
import { computeCellMetrics, type CellMetrics } from "./permutation-metrics.js";

export interface RunPermutationsOptions {
  cards: ReleaseCard[];
  permutations: PromptPermutation[];
  n: number;
  channel?: Channel;
  outputDir: string;
  harnessDbPath: string;
  /** Absolute path to harness/lib/schema.sql. Derived from worktree root by default. */
  harnessSchemaPath?: string;
  /** Absolute path to scripts/classify-corpus.ts. Derived from worktree root by default. */
  classifierScriptPath?: string;
  /** Skip the verifier call (no API key, smoke-of-the-smoke). */
  skipVerifier?: boolean;
  /** Number of cells to run concurrently. Default 1 (sequential). */
  concurrency?: number;
  /** Skip cells whose verifier JSON already exists in outputDir. */
  skipExisting?: boolean;
  /** Batch size for the verifier subprocess (--batch=N). Default 10. */
  verifierBatchSize?: number;
}

export interface CellRecord {
  card_id: string;
  permutation: PromptPermutation;
  candidates: Array<{
    db_id: string;
    candidate: Candidate;
    validation: ValidationResult;
    verifier: VerifierResult | null;
  }>;
  metrics: CellMetrics;
  corpus_path: string;
  verifier_output_path: string | null;
}

export interface RunResults {
  started_at: string;
  finished_at: string;
  options: {
    permutations: PromptPermutation[];
    n: number;
    channel: Channel;
    cards: string[];
  };
  cells: CellRecord[];
}

export async function runPermutations(opts: RunPermutationsOptions): Promise<RunResults> {
  const channel: Channel = opts.channel ?? "x";
  const startedAt = new Date().toISOString();

  fs.mkdirSync(opts.outputDir, { recursive: true });
  const corpusDir = path.join(opts.outputDir, "corpora");
  const verifierDir = path.join(opts.outputDir, "verifier");
  fs.mkdirSync(corpusDir, { recursive: true });
  fs.mkdirSync(verifierDir, { recursive: true });

  const harness = new HarnessDb({
    dbPath: opts.harnessDbPath,
    schemaPath: opts.harnessSchemaPath ?? defaultSchemaPath(),
  });

  const classifier = opts.classifierScriptPath ?? defaultClassifierPath();
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const skipExisting = opts.skipExisting ?? false;
  const verifierBatchSize = opts.verifierBatchSize ?? 10;

  for (const card of opts.cards) harness.ensureCard(card);

  const cellSpecs: Array<{ card: ReleaseCard; permutation: PromptPermutation }> = [];
  for (const card of opts.cards) {
    for (const permutation of opts.permutations) {
      cellSpecs.push({ card, permutation });
    }
  }

  const cells: Array<CellRecord | null> = new Array(cellSpecs.length).fill(null);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= cellSpecs.length) return;
      const { card, permutation } = cellSpecs[i]!;
      const cellTag = `${card.id}__${permutation}`;
      const verifierOutputPath = path.join(verifierDir, `${cellTag}.json`);
      if (skipExisting && fs.existsSync(verifierOutputPath)) {
        process.stderr.write(`[cell ${cellTag}] skipped (cached verifier output exists)\n`);
        cells[i] = null;
        continue;
      }
      cells[i] = await runCell({
        card,
        permutation,
        n: opts.n,
        channel,
        corpusDir,
        verifierDir,
        classifier,
        harness,
        skipVerifier: opts.skipVerifier ?? false,
        verifierBatchSize,
      });
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, cellSpecs.length) }, () => worker()),
  );
  const runCells: CellRecord[] = cells.filter((c): c is CellRecord => c !== null);

  harness.close();

  const finishedAt = new Date().toISOString();
  const results: RunResults = {
    started_at: startedAt,
    finished_at: finishedAt,
    options: {
      permutations: opts.permutations,
      n: opts.n,
      channel,
      cards: opts.cards.map((c) => c.id),
    },
    cells: runCells,
  };

  fs.writeFileSync(
    path.join(opts.outputDir, "results.json"),
    JSON.stringify(results, null, 2),
  );
  fs.writeFileSync(
    path.join(opts.outputDir, "summary.md"),
    renderSummaryMarkdown(results),
  );

  return results;
}

interface RunCellOptions {
  card: ReleaseCard;
  permutation: PromptPermutation;
  n: number;
  channel: Channel;
  corpusDir: string;
  verifierDir: string;
  classifier: string;
  harness: HarnessDb;
  skipVerifier: boolean;
  verifierBatchSize?: number;
}

async function runCell(opts: RunCellOptions): Promise<CellRecord> {
  const { card, permutation, n, channel } = opts;
  const cellTag = `${card.id}__${permutation}`;
  process.stderr.write(`[cell ${cellTag}] generating n=${n}…\n`);

  const candidates = await generate(card, {
    permutation,
    n,
    channel,
  });

  const corpusPath = path.join(opts.corpusDir, `${cellTag}.md`);
  writeCorpusFile(
    candidates.map((c) => ({ id: c.id, text: c.text })),
    `permutation=${permutation} card=${card.id} channel=${channel}`,
    corpusPath,
  );

  let verifierResults: VerifierResult[] = [];
  let verifierOutputPath: string | null = null;
  if (!opts.skipVerifier) {
    verifierOutputPath = path.join(opts.verifierDir, `${cellTag}.json`);
    runVerifier(opts.classifier, corpusPath, verifierOutputPath, opts.verifierBatchSize);
    verifierResults = parseVerifierJson(verifierOutputPath);
  }

  // Verifier output uses the corpus row's `ID` column; we kept candidate.id
  // there so we can join directly. But verifier IDs in `parseCorpus` get
  // stripped of leading/trailing whitespace — match by exact string.
  const verifierById = new Map<string, VerifierResult>();
  for (const v of verifierResults) verifierById.set(v.id, v);

  const cellCandidates = candidates.map((cand) => {
    const validation = validate(cand.text, {
      card,
      ...(cand.deployed_facts_used !== undefined ? { deployed_facts_used: cand.deployed_facts_used } : {}),
      ...(cand.not_said !== undefined ? { not_said: cand.not_said } : {}),
    });
    const dbId = opts.harness.insertCandidate({
      card,
      candidate: cand,
      attempt: 1,
      validation,
      promptVariant: permutation,
    });
    return {
      db_id: dbId,
      candidate: cand,
      validation,
      verifier: verifierById.get(cand.id) ?? null,
    };
  });

  const metrics = computeCellMetrics({
    card,
    permutation,
    candidates,
    verifier_by_id: verifierById,
  });

  return {
    card_id: card.id,
    permutation,
    candidates: cellCandidates,
    metrics,
    corpus_path: corpusPath,
    verifier_output_path: verifierOutputPath,
  };
}

function runVerifier(
  scriptPath: string,
  corpusPath: string,
  outputPath: string,
  batchSize?: number,
): void {
  const args = ["tsx", scriptPath, corpusPath, outputPath];
  if (batchSize && batchSize > 0) args.push(`--batch=${batchSize}`);
  const res = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(
      `Verifier failed: pnpm tsx ${args.slice(1).join(" ")} exited ${res.status}`,
    );
  }
}

function defaultSchemaPath(): string {
  return path.resolve(process.cwd(), "harness/lib/schema.sql");
}

function defaultClassifierPath(): string {
  return path.resolve(process.cwd(), "scripts/classify-corpus.ts");
}

function renderSummaryMarkdown(results: RunResults): string {
  const lines: string[] = [];
  lines.push("# Permutation eval — summary", "");
  lines.push(`- started_at: ${results.started_at}`);
  lines.push(`- finished_at: ${results.finished_at}`);
  lines.push(`- cards: ${results.options.cards.join(", ")}`);
  lines.push(`- channel: ${results.options.channel}`);
  lines.push(`- n per cell: ${results.options.n}`);
  lines.push("");
  lines.push("## Cells");
  lines.push("");
  lines.push(
    "| card | permutation | n | validator_pass | placement_hit | off_spec_drive | tempo_coverage | fact_contract_violations | em_dash_median | length_median |",
  );
  lines.push(
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const cell of results.cells) {
    const m = cell.metrics;
    lines.push(
      `| ${m.card_id} | ${m.permutation} | ${m.n_candidates} | ${pct(m.validator_pass_rate)} (${m.validator_pass_count}/${m.n_candidates}) | ${pct(m.placement_hit_rate)} (${m.placement_hit_count}) | ${pct(m.off_spec_drive_rate)} (${m.off_spec_drive_count}) | ${m.tempo_coverage_count}/5 | ${pct(m.fact_contract_violation_rate)} (${m.fact_contract_violation_count}) | ${m.em_dash_density_per_280.median.toFixed(2)} | ${m.length_chars.median} |`,
    );
  }
  lines.push("");
  lines.push("## Per-cell tempo distribution");
  lines.push("");
  for (const cell of results.cells) {
    const dist = Object.entries(cell.metrics.tempo_distribution)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t}=${c}`)
      .join(", ");
    lines.push(`- ${cell.metrics.card_id} / ${cell.metrics.permutation}: ${dist || "(empty)"}`);
  }
  return lines.join("\n") + "\n";
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

// -- CLI entrypoint ---------------------------------------------------------

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq === -1) {
      flags.set(a.slice(2), "true");
    } else {
      flags.set(a.slice(2, eq), a.slice(eq + 1));
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const cardsFlag = flags.get("cards");
  if (!cardsFlag) {
    console.error("--cards=<comma-separated card json paths> required");
    process.exit(1);
  }
  const cardPaths = cardsFlag.split(",").map((p) => p.trim()).filter(Boolean);
  const cards: ReleaseCard[] = cardPaths.map((p) => {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return parseReleaseCard(raw);
  });

  const permsFlag = flags.get("permutations") ?? "current,kernel,placement,examples,full";
  const permutations = permsFlag.split(",").map((p) => p.trim()) as PromptPermutation[];

  const n = Number.parseInt(flags.get("n") ?? "2", 10);
  const channel = (flags.get("channel") ?? "x") as Channel;
  const outputDir = path.resolve(flags.get("output-dir") ?? `eval/runs/run-${Date.now()}`);
  const harnessDbPath = path.resolve(flags.get("harness-db") ?? "harness/harness.db");
  const skipVerifier = flags.get("skip-verifier") === "true";
  const concurrency = Number.parseInt(flags.get("concurrency") ?? "1", 10);
  const skipExisting = flags.get("skip-existing") === "true";
  const verifierBatchSize = Number.parseInt(flags.get("verifier-batch") ?? "10", 10);

  const opts: RunPermutationsOptions = {
    cards,
    permutations,
    n,
    channel,
    outputDir,
    harnessDbPath,
    skipVerifier,
    concurrency,
    skipExisting,
    verifierBatchSize,
  };

  process.stderr.write(
    `runPermutations: cards=${cardPaths.length} perms=${permutations.length} n=${n} channel=${channel}\n  outputDir=${outputDir}\n  harnessDbPath=${harnessDbPath}\n`,
  );

  const results = await runPermutations(opts);

  process.stderr.write(
    `\nDone. ${results.cells.length} cell(s) written to ${outputDir}/results.json + summary.md\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
