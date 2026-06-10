import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseReleaseCard } from "../src/card.js";
import type { ReleaseCard } from "../src/card.js";
import type { Candidate, Channel, NotSaidFact } from "../src/generator.js";
import { auditCandidateWithDirector, type DirectorAuditResult } from "../src/actor-director.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";
import { validate, type RuleFailure } from "../src/validator.js";

interface Row {
  actor_attempt_id: string;
  attempt: number;
  warmup_mode: string;
  actor_response_json: string;
  id: string;
  channel: Channel;
  text: string;
  declared_beats_json: string;
  rationale: string | null;
}

interface CandidateReceipt {
  deployed_facts_used: string[];
  not_said: NotSaidFact[];
}

interface AuditRow {
  attempt: number;
  warmup_mode: string;
  channel: Channel;
  candidate_id: string;
  text: string;
  text_length: number;
  rail_token_count: number;
  hard_passed: boolean;
  hard_failures: RuleFailure[];
  director?: DirectorAuditResult;
}

const DEFAULT_CARD_ID = "01KS6QJNEGFYP6X048V8Y900DM";
const DEFAULT_DB = "harness/harness.db";
const DEFAULT_JSON_OUT = "research/director-audit-warmup-corpus-2026-05-27.json";
const DEFAULT_HTML_OUT = "research/director-audit-warmup-corpus-2026-05-27.html";

const CHANNEL_MAX_LEN: Record<Channel, number> = {
  x: 280,
  web: 140,
  "in-product": 80,
};

const RAIL_RE =
  /\b(?:ACH|SEPA|SPEI|PIX|FPS|Bre-B|USD|EUR|MXN|BRL|GBP|COP|IBAN|CLABE|routing number|wire)\b/gi;

const cardId = process.argv[2] ?? DEFAULT_CARD_ID;
const dbPath = process.argv[3] ?? DEFAULT_DB;
const jsonOut = process.argv[4] ?? DEFAULT_JSON_OUT;
const htmlOut = process.argv[5] ?? DEFAULT_HTML_OUT;

const releaseCard = loadReleaseCard(dbPath, cardId);
const rows = queryJson<Row>(dbPath, `
  SELECT aa.id AS actor_attempt_id,
         aa.attempt,
         json_extract(aw.daily_pages_json, '$.mode') AS warmup_mode,
         aa.actor_response_json,
         c.id,
         c.channel,
         c.text,
         c.declared_beats_json,
         c.rationale
    FROM actor_attempts aa
    JOIN actor_warmups aw ON aw.actor_attempt_id = aa.id
    JOIN candidates c ON c.card_id = aa.card_id AND c.attempt = aa.attempt
   WHERE aa.card_id = ${sqlString(cardId)}
   ORDER BY aa.attempt, c.channel, c.created_at
`);

const hardPassed = rows
  .map((row) => ({ row, hard: hardValidate(row, releaseCard) }))
  .filter(({ hard }) => hard.failures.length === 0);

const audited: AuditRow[] = [];
for (const { row, hard } of hardPassed) {
  const receipt = receiptForSelectedCandidate(row);
  const candidate: Candidate = {
    id: row.id,
    text: row.text,
    channel: row.channel,
    declared_beats: parseDeclaredBeats(row.declared_beats_json),
    deployed_facts_used: receipt.deployed_facts_used,
    not_said: receipt.not_said,
    ...(row.rationale ? { rationale: row.rationale } : {}),
    source: "anthropic",
  };
  const director = await auditCandidateWithDirector({
    card: releaseCard,
    candidate,
    channel: row.channel,
    voice: INFINEX_VOICE,
    mode: "live",
  });
  audited.push({
    attempt: row.attempt,
    warmup_mode: row.warmup_mode,
    channel: row.channel,
    candidate_id: row.id,
    text: row.text,
    text_length: row.text.length,
    rail_token_count: row.text.match(RAIL_RE)?.length ?? 0,
    hard_passed: true,
    hard_failures: hard.failures,
    director,
  });
  console.log(`${row.warmup_mode} attempt ${row.attempt} ${row.channel}: ${director.passed ? "PASS" : "FAIL"} ${director.primary_tempo} ${director.primary_confidence}`);
}

const summary = summarize(audited);
mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
writeFileSync(jsonOut, JSON.stringify({ card_id: cardId, summary, audited }, null, 2));
writeFileSync(htmlOut, renderHtml(releaseCard, audited, summary));

console.log(`Audited ${audited.length} hard-pass candidates`);
for (const mode of summary.by_mode) {
  console.log(`${mode.mode} | director pass ${mode.director_passed}/${mode.total} | legal ${mode.legal}/${mode.total} | rails ${mode.avg_rail_tokens.toFixed(1)} | tempi ${JSON.stringify(mode.tempi)}`);
}
console.log(jsonOut);
console.log(htmlOut);

function loadReleaseCard(dbFile: string, id: string): ReleaseCard {
  const row = queryJson<{ release_card_json: string }>(
    dbFile,
    `SELECT release_card_json FROM release_cards WHERE card_id = ${sqlString(id)}`,
  )[0] as { release_card_json: string } | undefined;
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

function hardValidate(row: Row, card: ReleaseCard): { failures: RuleFailure[] } {
  const validation = validate(row.text, { card });
  const lengthMax = CHANNEL_MAX_LEN[row.channel];
  const lengthFailure: RuleFailure[] =
    row.text.length > lengthMax
      ? [{ rule: "length", reason: `length: ${row.text.length} > ${lengthMax} for channel ${row.channel}` }]
      : [];
  return { failures: [...validation.failures, ...lengthFailure] };
}

function receiptForSelectedCandidate(row: Row): CandidateReceipt {
  const parsed = JSON.parse(row.actor_response_json) as {
    performances?: Partial<Record<Channel, unknown[]>>;
    selected_performances?: Partial<Record<Channel, { selected_option?: number }>>;
  };
  const selected = parsed.selected_performances?.[row.channel]?.selected_option ?? 1;
  const option = parsed.performances?.[row.channel]?.[selected - 1];
  if (isRecord(option)) {
    return {
      deployed_facts_used: stringArray(option.deployed_facts_used),
      not_said: parseNotSaid(option.not_said),
    };
  }
  return { deployed_facts_used: [], not_said: [] };
}

function parseDeclaredBeats(json: string): Candidate["declared_beats"] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseNotSaid(value: unknown): NotSaidFact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.fact !== "string" || typeof item.reason !== "string") return [];
    return [{ fact: item.fact, reason: item.reason }];
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function summarize(items: AuditRow[]) {
  const byMode = new Map<string, AuditRow[]>();
  for (const item of items) {
    const bucket = byMode.get(item.warmup_mode) ?? [];
    bucket.push(item);
    byMode.set(item.warmup_mode, bucket);
  }
  return {
    total: items.length,
    director_passed: items.filter((item) => item.director?.passed).length,
    legal: items.filter((item) => item.director?.infinex_fit.legal).length,
    by_mode: [...byMode.entries()].map(([mode, modeItems]) => ({
      mode,
      total: modeItems.length,
      director_passed: modeItems.filter((item) => item.director?.passed).length,
      legal: modeItems.filter((item) => item.director?.infinex_fit.legal).length,
      avg_rail_tokens: average(modeItems.map((item) => item.rail_token_count)),
      tempi: countStrings(modeItems.map((item) => item.director?.primary_tempo ?? "unknown")),
      drives: countStrings(modeItems.map((item) => item.director?.drive_read ?? "unknown")),
    })),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countStrings(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function renderHtml(
  card: ReleaseCard,
  items: AuditRow[],
  summary: ReturnType<typeof summarize>,
): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Director Audit Warmup Corpus</title>
  <style>
    body { font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #181818; background: #fafafa; }
    h1, h2 { margin: 0 0 12px; }
    .meta { color: #666; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 18px 0 32px; background: #fff; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f0f0f0; }
    .pass { color: #087a32; font-weight: 700; }
    .fail { color: #a31515; font-weight: 700; }
    .copy { white-space: pre-wrap; max-width: 48rem; }
    .small { font-size: 12px; color: #666; }
    code { background: #eee; padding: 1px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Director Audit Warmup Corpus</h1>
  <div class="meta">${escapeHtml(card.title)} · ${escapeHtml(card.id)} · ${summary.director_passed}/${summary.total} Director pass</div>

  <h2>Summary</h2>
  <table>
    <thead><tr><th>Mode</th><th>Director pass</th><th>Legal</th><th>Avg rail tokens</th><th>Tempi</th><th>Drives</th></tr></thead>
    <tbody>
      ${summary.by_mode.map((row) => `<tr>
        <td>${escapeHtml(row.mode)}</td>
        <td>${row.director_passed}/${row.total}</td>
        <td>${row.legal}/${row.total}</td>
        <td>${row.avg_rail_tokens.toFixed(1)}</td>
        <td><code>${escapeHtml(JSON.stringify(row.tempi))}</code></td>
        <td><code>${escapeHtml(JSON.stringify(row.drives))}</code></td>
      </tr>`).join("\n")}
    </tbody>
  </table>

  <h2>Candidates</h2>
  <table>
    <thead><tr><th>Attempt</th><th>Mode</th><th>Channel</th><th>Director</th><th>Tempo</th><th>Drive</th><th>Rails</th><th>Copy</th><th>Notes</th></tr></thead>
    <tbody>
      ${items.map((item) => `<tr>
        <td>${item.attempt}</td>
        <td>${escapeHtml(item.warmup_mode)}</td>
        <td>${item.channel}</td>
        <td class="${item.director?.passed ? "pass" : "fail"}">${item.director?.passed ? "pass" : "fail"}</td>
        <td>${escapeHtml(item.director?.primary_tempo ?? "unknown")} (${item.director?.primary_confidence ?? 0})</td>
        <td>${escapeHtml(item.director?.drive_read ?? "unknown")}</td>
        <td>${item.rail_token_count}</td>
        <td class="copy">${escapeHtml(item.text)}<div class="small">${item.text_length} chars</div></td>
        <td>${escapeHtml([
          item.director?.infinex_fit.reason,
          ...(item.director?.voice_issues ?? []),
          ...(item.director?.factual_issues ?? []),
          ...(item.director?.notes_for_actor ?? []),
        ].filter(Boolean).join("\n"))}</td>
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
