/**
 * Grade every runner output in a directory and emit a comparison table.
 *
 * Usage:
 *   pnpm tsx eval/mirodan-competence/grade-all.ts <runs-dir> [out.md]
 */

import fs from "node:fs";
import path from "node:path";
import { QUESTIONS } from "./questions.js";
import { gradeAll, aggregate, type AggregateMetrics } from "./grader.js";

interface RunnerOutput {
  label: string;
  model: string;
  system_prompt_path: string;
  ran_at: string;
  responses: Array<{ question_id: string; response: string }>;
}

interface RunSummary {
  label: string;
  permutation: string;
  model: string;
  metrics: AggregateMetrics;
}

function parseLabel(label: string): { permutation: string; model: string } {
  const m = label.match(/^([^-]+)-(.+)$/);
  if (!m) return { permutation: label, model: "" };
  return { permutation: m[1]!, model: m[2]! };
}

function main(): void {
  const dir = path.resolve(process.argv[2] ?? "eval/runs");
  const out = process.argv[3] ? path.resolve(process.argv[3]) : null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("results"))
    .sort();

  const summaries: RunSummary[] = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as RunnerOutput;
    const results = gradeAll(QUESTIONS, raw.responses);
    const metrics = aggregate(results);
    const { permutation, model } = parseLabel(raw.label);
    summaries.push({ label: raw.label, permutation, model, metrics });
  }

  const md = renderMarkdown(summaries);
  if (out) {
    fs.writeFileSync(out, md);
    process.stderr.write(`Wrote ${out}\n`);
  } else {
    process.stdout.write(md);
  }
}

function renderMarkdown(summaries: RunSummary[]): string {
  const lines: string[] = [];
  lines.push("# Mirodan competence — Wave 2 results", "");
  lines.push(
    "Headline metric: `mirodan_specific_pass_rate` — how well a prompt teaches the framework (vs. just supplying the mood).",
    "",
  );

  lines.push("## Headline grid (mirodan-specific pass rate)", "");
  const perms = uniq(summaries.map((s) => s.permutation));
  const models = uniq(summaries.map((s) => s.model));
  lines.push("| permutation | " + models.map(shortModel).join(" | ") + " |");
  lines.push("| --- | " + models.map(() => "---").join(" | ") + " |");
  for (const p of perms) {
    const row = [p];
    for (const m of models) {
      const s = summaries.find((x) => x.permutation === p && x.model === m);
      row.push(s ? pct(s.metrics.headline_mirodan_specific_pass_rate) : "—");
    }
    lines.push("| " + row.join(" | ") + " |");
  }

  lines.push("", "## Overall pass rate (all 30 questions, includes laban_only)", "");
  lines.push("| permutation | " + models.map(shortModel).join(" | ") + " |");
  lines.push("| --- | " + models.map(() => "---").join(" | ") + " |");
  for (const p of perms) {
    const row = [p];
    for (const m of models) {
      const s = summaries.find((x) => x.permutation === p && x.model === m);
      row.push(s ? `${pct(s.metrics.pass_rate)} (${s.metrics.passed}/${s.metrics.total})` : "—");
    }
    lines.push("| " + row.join(" | ") + " |");
  }

  lines.push("", "## Per-category breakdown", "");
  const categories = uniq(
    summaries.flatMap((s) => Object.keys(s.metrics.by_category)),
  );
  for (const cat of categories) {
    lines.push(`### ${cat}`, "");
    lines.push("| permutation | " + models.map(shortModel).join(" | ") + " |");
    lines.push("| --- | " + models.map(() => "---").join(" | ") + " |");
    for (const p of perms) {
      const row = [p];
      for (const m of models) {
        const s = summaries.find((x) => x.permutation === p && x.model === m);
        const c = s?.metrics.by_category[cat as keyof typeof s.metrics.by_category];
        row.push(c ? `${pct(c.pass_rate)} (${c.passed}/${c.total})` : "—");
      }
      lines.push("| " + row.join(" | ") + " |");
    }
    lines.push("");
  }

  return lines.join("\n");
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function shortModel(m: string): string {
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  return m;
}

main();
