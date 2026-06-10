import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseReleaseCard } from "../src/card.js";
import { validate, type RuleFailure } from "../src/validator.js";
import type { ReleaseCard } from "../src/card.js";

type Channel = "x" | "web" | "in-product";

interface Row {
  attempt: number;
  warmup_mode: string;
  id: string;
  channel: Channel;
  text: string;
  validation_passed: 0 | 1;
  validation_failures_json: string;
}

interface ScoredRow {
  attempt: number;
  warmup_mode: string;
  id: string;
  channel: Channel;
  text: string;
  text_length: number;
  rail_token_count: number;
  old_passed: boolean;
  old_failures: RuleFailure[];
  new_regex_passed: boolean;
  new_hard_passed: boolean;
  new_failures: RuleFailure[];
}

const DEFAULT_CARD_ID = "01KS6QJNEGFYP6X048V8Y900DM";
const DEFAULT_DB = "harness/harness.db";
const DEFAULT_OUT = "research/regex-rescore-warmup-corpus-2026-05-27.html";

const CHANNEL_MAX_LEN: Record<Channel, number> = {
  x: 280,
  web: 140,
  "in-product": 80,
};

const RAIL_RE =
  /\b(?:ACH|SEPA|SPEI|PIX|FPS|Bre-B|USD|EUR|MXN|BRL|GBP|COP|IBAN|CLABE|routing number|wire)\b/gi;

const cardId = process.argv[2] ?? DEFAULT_CARD_ID;
const dbPath = process.argv[3] ?? DEFAULT_DB;
const outPath = process.argv[4] ?? DEFAULT_OUT;

const releaseCard = loadReleaseCard(dbPath, cardId);
const rows = queryJson<Row>(dbPath, `
  SELECT aa.attempt,
         json_extract(aw.daily_pages_json, '$.mode') AS warmup_mode,
         c.id,
         c.channel,
         c.text,
         c.validation_passed,
         c.validation_failures_json
    FROM actor_attempts aa
    JOIN actor_warmups aw ON aw.actor_attempt_id = aa.id
    JOIN candidates c ON c.card_id = aa.card_id AND c.attempt = aa.attempt
   WHERE aa.card_id = ${sqlString(cardId)}
   ORDER BY aa.attempt, c.channel, c.created_at
`);

const scored = rows.map((row) => scoreRow(row, releaseCard));
const summary = summarize(scored);

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, renderHtml(releaseCard, scored, summary));

console.log(`Rescored ${scored.length} candidates for ${cardId}`);
for (const item of summary.by_mode) {
  console.log(
    [
      item.mode,
      `${item.new_hard_passed}/${item.total} new hard-pass`,
      `${item.old_passed}/${item.total} old pass`,
      `avg rail tokens ${item.avg_rail_tokens.toFixed(1)}`,
    ].join(" | "),
  );
}
console.log(outPath);

function loadReleaseCard(dbFile: string, id: string): ReleaseCard {
  const row = queryJson<{ release_card_json: string }>(
    dbFile,
    `SELECT release_card_json FROM release_cards WHERE card_id = ${sqlString(id)}`,
  )[0] as
    | { release_card_json: string }
    | undefined;
  if (!row) throw new Error(`No release card found for ${id}`);
  return parseReleaseCard(JSON.parse(row.release_card_json));
}

function queryJson<T>(dbFile: string, sql: string): T[] {
  const stdout = execFileSync("sqlite3", ["-json", dbFile, sql], { encoding: "utf8" });
  if (!stdout.trim()) return [];
  return JSON.parse(stdout) as T[];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function scoreRow(row: Row, card: ReleaseCard): ScoredRow {
  const oldFailures = parseFailures(row.validation_failures_json);
  const validation = validate(row.text, { card });
  const lengthMax = CHANNEL_MAX_LEN[row.channel];
  const lengthFailure =
    row.text.length > lengthMax
      ? [{ rule: "length", reason: `length: ${row.text.length} > ${lengthMax} for channel ${row.channel}` }]
      : [];
  const newFailures = [...validation.failures, ...lengthFailure];
  return {
    attempt: row.attempt,
    warmup_mode: row.warmup_mode,
    id: row.id,
    channel: row.channel,
    text: row.text,
    text_length: row.text.length,
    rail_token_count: row.text.match(RAIL_RE)?.length ?? 0,
    old_passed: row.validation_passed === 1,
    old_failures: oldFailures,
    new_regex_passed: validation.passed,
    new_hard_passed: newFailures.length === 0,
    new_failures: newFailures,
  };
}

function parseFailures(json: string): RuleFailure[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter(isRuleFailure) : [];
  } catch {
    return [];
  }
}

function isRuleFailure(value: unknown): value is RuleFailure {
  return Boolean(
    value &&
      typeof value === "object" &&
      "rule" in value &&
      typeof (value as { rule?: unknown }).rule === "string" &&
      "reason" in value &&
      typeof (value as { reason?: unknown }).reason === "string",
  );
}

function summarize(items: ScoredRow[]) {
  const byMode = new Map<string, ScoredRow[]>();
  for (const item of items) {
    const bucket = byMode.get(item.warmup_mode) ?? [];
    bucket.push(item);
    byMode.set(item.warmup_mode, bucket);
  }

  return {
    total: items.length,
    old_passed: items.filter((item) => item.old_passed).length,
    new_hard_passed: items.filter((item) => item.new_hard_passed).length,
    by_mode: [...byMode.entries()].map(([mode, modeItems]) => ({
      mode,
      total: modeItems.length,
      old_passed: modeItems.filter((item) => item.old_passed).length,
      new_hard_passed: modeItems.filter((item) => item.new_hard_passed).length,
      new_regex_passed: modeItems.filter((item) => item.new_regex_passed).length,
      avg_rail_tokens: average(modeItems.map((item) => item.rail_token_count)),
      old_failure_counts: countRules(modeItems.flatMap((item) => item.old_failures)),
      new_failure_counts: countRules(modeItems.flatMap((item) => item.new_failures)),
    })),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countRules(failures: RuleFailure[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const failure of failures) counts[failure.rule] = (counts[failure.rule] ?? 0) + 1;
  return counts;
}

function renderHtml(
  card: ReleaseCard,
  items: ScoredRow[],
  summary: ReturnType<typeof summarize>,
): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Regex Rescore Warmup Corpus</title>
  <style>
    body { font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #181818; background: #fafafa; }
    h1, h2 { margin: 0 0 12px; }
    .meta { color: #666; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 18px 0 32px; background: #fff; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f0f0f0; }
    .pass { color: #087a32; font-weight: 700; }
    .fail { color: #a31515; font-weight: 700; }
    .copy { white-space: pre-wrap; max-width: 54rem; }
    .small { font-size: 12px; color: #666; }
    code { background: #eee; padding: 1px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Regex Rescore Warmup Corpus</h1>
  <div class="meta">${escapeHtml(card.title)} · ${escapeHtml(card.id)} · ${summary.new_hard_passed}/${summary.total} pass after regex-as-hygiene</div>

  <h2>Summary</h2>
  <table>
    <thead><tr><th>Mode</th><th>Old pass</th><th>New regex pass</th><th>New hard pass incl length</th><th>Avg rail tokens</th><th>Old failures</th><th>New failures</th></tr></thead>
    <tbody>
      ${summary.by_mode.map((row) => `<tr>
        <td>${escapeHtml(row.mode)}</td>
        <td>${row.old_passed}/${row.total}</td>
        <td>${row.new_regex_passed}/${row.total}</td>
        <td>${row.new_hard_passed}/${row.total}</td>
        <td>${row.avg_rail_tokens.toFixed(1)}</td>
        <td><code>${escapeHtml(JSON.stringify(row.old_failure_counts))}</code></td>
        <td><code>${escapeHtml(JSON.stringify(row.new_failure_counts))}</code></td>
      </tr>`).join("\n")}
    </tbody>
  </table>

  <h2>Candidates</h2>
  <table>
    <thead><tr><th>Attempt</th><th>Mode</th><th>Channel</th><th>Old</th><th>New</th><th>Rails</th><th>Copy</th><th>New Failures</th></tr></thead>
    <tbody>
      ${items.map((item) => `<tr>
        <td>${item.attempt}</td>
        <td>${escapeHtml(item.warmup_mode)}</td>
        <td>${item.channel}</td>
        <td class="${item.old_passed ? "pass" : "fail"}">${item.old_passed ? "pass" : "fail"}</td>
        <td class="${item.new_hard_passed ? "pass" : "fail"}">${item.new_hard_passed ? "pass" : "fail"}</td>
        <td>${item.rail_token_count}</td>
        <td class="copy">${escapeHtml(item.text)}<div class="small">${item.text_length} chars</div></td>
        <td><code>${escapeHtml(JSON.stringify(item.new_failures))}</code></td>
      </tr>`).join("\n")}
    </tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
