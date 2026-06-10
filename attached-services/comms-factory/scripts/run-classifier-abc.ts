#!/usr/bin/env tsx
/**
 * Director classification A/B/C bake-off runner.
 * Design spec: research/director-classifier-abc-2026-06-04.md
 *
 * Standalone experiment. Does NOT modify pipeline src/ (the only allowed
 * additive touch — exporting classify-corpus internals — is avoided here by
 * slicing SYSTEM_PROMPT out of the file text at runtime, since that script
 * has a top-level process.exit that makes importing it unsafe).
 *
 * Run FOREGROUND in chunks of <=10:
 *   npx tsx scripts/run-classifier-abc.ts --arm A --offset 0 --limit 10
 *   npx tsx scripts/run-classifier-abc.ts --arm A --offset 10 --limit 10
 *   ... etc, then --arm B, --arm C.
 *   --variance for the 12-item twice-run subset (arms A and C).
 *
 * Resume guard: skips item_ids already present in the per-arm results.jsonl.
 */
import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseReleaseCard, type ReleaseCard } from "../src/card.js";
import type { Candidate, Channel } from "../src/generator.js";
import {
  buildDirectorUserMessage,
  parseDirectorAudit,
  type AuditCandidateWithDirectorOptions,
} from "../src/actor-director.js";
import { buildDirectorMemoryPack } from "../src/actor-memory.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

// ---------------------------------------------------------------------------
loadEnv(".env");
loadEnv("harness/.env.local");

const ROOT = resolve(".");
const OUT_DIR = resolve(ROOT, "research/classifier-abc-2026-06-04");
const DB_PATH = resolve(ROOT, "harness/harness.db");
const CARD_ID = "01KT5FTDJVCCE8ZG5DX4CXAG15";
const BATTERY_DIR = resolve(ROOT, "research/director-mutation-battery-2026-06-03");
const MODEL = "claude-sonnet-4-6";
const MAIN_TEMPI: readonly string[] = INFINEX_VOICE.main_tempi;
const BEAT_ONLY: readonly string[] = INFINEX_VOICE.beat_only_tempi;

const ACCOUNTABILITY_PREFIX =
  "ACCOUNTABILITY: a human operator personally grades every verdict you issue. " +
  "If they agree with your tempo+legality call you earn +5; if they overturn you, -10. " +
  "You are defending a rating to an expert who will check it, not nodding it through. " +
  "Be precise; an unjustified 'commanding' that the operator reads as e.g. sociable or " +
  "near costs you.\n\n";

// ---- classify-corpus SYSTEM_PROMPT + tool schema (read at runtime) ---------
function loadClassifierSystemPrompt(): string {
  const src = readFileSync(resolve(ROOT, "scripts/classify-corpus.ts"), "utf8");
  const start = src.indexOf("const SYSTEM_PROMPT = `");
  if (start === -1) throw new Error("could not locate SYSTEM_PROMPT in classify-corpus.ts");
  const bodyStart = src.indexOf("`", start) + 1;
  // The prompt ends at the closing backtick of the template literal.
  const bodyEnd = src.indexOf("`;", bodyStart);
  if (bodyEnd === -1) throw new Error("could not locate end of SYSTEM_PROMPT");
  // Un-escape the template-literal escapes (\` and \$) used in the source.
  return src
    .slice(bodyStart, bodyEnd)
    .replace(/\\`/g, "`")
    .replace(/\\\$/g, "$");
}

const CLASSIFY_TOOL = {
  name: "classify_samples",
  description:
    "Emit one Mirodan / Laban placement reading per input sample. Read what is on the page. Use 'unknown' / 'n/a' freely when the sample is too short or ambiguous to read.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            classification: {
              type: "object",
              properties: {
                tempo_primary: {
                  type: "string",
                  description:
                    "The single dominant Mirodan tempo the prose reads as. One of the 24 named tempi (Commanding, Sombre, Irradiant, Practical, Sociable, Materialistic, Human, Warm, Cool, Receptive, Self-Contained, Overpowering, Diffused, Unacknowledged, Acknowledged, Revealed, Concealed, Egocentric, Altruistic, Unsociable, Acute, Doubting, Certain, Uncertain), or 'n/a' when the sample is too short to read a tempo.",
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                rationale: { type: "string" },
              },
              required: ["tempo_primary", "confidence", "rationale"],
            },
          },
          required: ["id", "classification"],
        },
      },
    },
    required: ["items"],
  },
};

// ---- Types -----------------------------------------------------------------
interface CorpusItem {
  item_id: string;
  source: "real" | "mutation" | "control";
  channel: Channel;
  text: string;
  structured?: unknown;
  defect_class?: string | null;
  defect_label?: string | null;
  base_candidate_id?: string;
}

interface BlindRead {
  tempo: string;
  confidence: number;
  rationale: string;
}

interface ArmResult {
  item_id: string;
  arm: "A" | "B" | "C";
  variance_pass?: number;
  source: string;
  channel: Channel;
  defect_class?: string | null;
  authoritative_tempo: string; // the arm's tempo read used for legality
  director_tempo?: string; // the contextual Director's own tempo (A only / B / C-warm)
  blind_tempo?: string;
  legal: boolean;
  legal_reason: string;
  copy_voice_passed?: boolean;
  factual_passed?: boolean;
  passed?: boolean; // overall draft pass (legal && copy_voice && factual)
  voice_issues?: string[];
  factual_issues?: string[];
  coaching_note?: string;
  classifier_rationale?: string;
  director_rationale?: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

// ---- Legality gate (mirrors shipped parseDirectorAudit logic) --------------
function legalityOf(
  primaryTempo: string,
  channel: Channel,
  text: string,
): { legal: boolean; reason: string } {
  const t = primaryTempo.toLowerCase();
  if (MAIN_TEMPI.includes(t)) {
    return { legal: true, reason: `${t} is a primary allowed Infinex tempo.` };
  }
  if (BEAT_ONLY.includes(t)) {
    const isMicrocopy =
      (channel === "in-product" || channel === "modal") && !text.includes("\n");
    if (isMicrocopy) {
      return {
        legal: true,
        reason: `beat-only tempo "${t}" legal as a single contained microcopy beat (${channel}, no newline).`,
      };
    }
    return {
      legal: false,
      reason: `primary_tempo "${t}" is a beat-only/reserve tempo, not a primary allowed tempo; it cannot be the whole-copy primary read.`,
    };
  }
  // unknown / n/a / out-of-palette named tempo (e.g. materialistic, acute)
  if (t === "unknown" || t === "n/a" || t === "") {
    return { legal: false, reason: `tempo unread ("${primaryTempo}") — cannot confirm a primary allowed tempo.` };
  }
  return {
    legal: false,
    reason: `primary_tempo "${t}" is not in Infinex's allowed palette [${MAIN_TEMPI.join(", ")}].`,
  };
}

// ---- Anthropic helpers -----------------------------------------------------
type Usage = { input_tokens: number; output_tokens: number };

/** Hard wall-clock timeout: the SDK `timeout` option does not reliably abort a
 * slow-but-alive connection, so we race every call against a rejecting timer. */
function withHardTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`hard timeout ${ms}ms: ${label}`)), ms).unref?.()),
  ]);
}

async function classifyBlind(
  client: Anthropic,
  system: string,
  item: CorpusItem,
): Promise<{ read: BlindRead; usage: Usage }> {
  const payload = JSON.stringify({
    instruction:
      "Classify the sample independently. Return one item for the given id. Pick a single tempo_primary; if too short to read, use 'n/a'.",
    samples: [{ id: item.item_id, channel: item.channel, text: item.text }],
  });
  const resp = await withHardTimeout(client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    tools: [CLASSIFY_TOOL as never],
    tool_choice: { type: "tool", name: "classify_samples", disable_parallel_tool_use: true },
    messages: [{ role: "user", content: payload }],
  }), 150_000, `classify ${item.item_id}`);
  let read: BlindRead = { tempo: "n/a", confidence: 0, rationale: "(no tool call)" };
  for (const block of resp.content) {
    if (block.type !== "tool_use" || block.name !== "classify_samples") continue;
    const items = (block.input as { items?: unknown[] }).items ?? [];
    const first = items[0] as { classification?: Record<string, unknown> } | undefined;
    const c = first?.classification ?? {};
    read = {
      tempo: typeof c.tempo_primary === "string" ? c.tempo_primary : "n/a",
      confidence: typeof c.confidence === "number" ? c.confidence : 0,
      rationale: typeof c.rationale === "string" ? c.rationale : "",
    };
  }
  return { read, usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens } };
}

async function callDirectorRaw(
  client: Anthropic,
  system: string,
  user: string,
): Promise<{ raw: string; usage: Usage }> {
  const resp = await withHardTimeout(client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: user }],
  }), 150_000, "director");
  let raw = "";
  for (const block of resp.content) {
    if (block.type === "text") raw += block.text;
  }
  return { raw, usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens } };
}

import type { DirectorAuditResult } from "../src/actor-director.js";

/**
 * Call Director + parse, retrying once if the model emits malformed JSON
 * (parseDirectorAudit throws on unrecoverable JSON). Production swallows this
 * via createMessageWithRetry; we replicate the resilience here.
 */
async function safeAuditDirector(
  client: Anthropic,
  system: string,
  user: string,
  item: CorpusItem,
): Promise<{ audit: DirectorAuditResult; usage: Usage; calls: number }> {
  const memory = buildDirectorMemoryPack(INFINEX_VOICE);
  let inTok = 0;
  let outTok = 0;
  const MAX = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX; attempt++) {
    try {
      const { raw, usage } = await callDirectorRaw(client, system, user);
      inTok += usage.input_tokens;
      outTok += usage.output_tokens;
      const audit = parseDirectorAudit(raw, memory, user, "anthropic", item.text, {
        channel: item.channel,
        voice: INFINEX_VOICE,
      });
      return { audit, usage: { input_tokens: inTok, output_tokens: outTok }, calls: attempt + 1 };
    } catch (err) {
      lastErr = err;
      process.stderr.write(`    (Director call/parse failed for ${item.item_id}, attempt ${attempt + 1}: ${err instanceof Error ? err.message.slice(0, 80) : err}; retrying)\n`);
    }
  }
  // Degrade rather than abort the chunk: emit a stub audit flagged as failed.
  process.stderr.write(`    (Director DEGRADED for ${item.item_id} after ${MAX} attempts)\n`);
  const stub = parseDirectorAudit("{}", memory, user, "stub", item.text, {
    channel: item.channel,
    voice: INFINEX_VOICE,
  });
  stub.voice_issues = [`director_unavailable: ${lastErr instanceof Error ? lastErr.message.slice(0, 120) : String(lastErr)}`];
  stub.copy_voice_passed = false;
  stub.passed = false;
  return { audit: stub, usage: { input_tokens: inTok, output_tokens: outTok }, calls: MAX };
}

// ---- Coaching call (Arm C, illegal items) ----------------------------------
async function writeCoaching(
  client: Anthropic,
  blindTempo: string,
  item: CorpusItem,
): Promise<{ note: string; usage: Usage }> {
  const system =
    "You are an Infinex voice director. Infinex's locked placement is Stable + Penetrating, " +
    "Flow-stressed (Spell→Vision drive). Allowed primary tempi: " +
    `[${MAIN_TEMPI.join(", ")}]. Beat-only/reserve tempi (legal only as transient single ` +
    `microcopy beats): [${BEAT_ONLY.join(", ")}].`;
  const user =
    `A blind reader classified this ${item.channel} copy as primary tempo "${blindTempo}", ` +
    `which is illegal for Infinex. Write 2-4 sentences of coaching for the Actor: name what was read, ` +
    `state the allowed palette, and explain WHY this reads off-placement (e.g. reads Near/Adream/Remote, ` +
    `or overpowering/sociable, rather than Stable+Penetrating) and what would pull it back. ` +
    `Copy:\n\n${item.text}`;
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  let note = "";
  for (const block of resp.content) if (block.type === "text") note += block.text;
  return { note: note.trim(), usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens } };
}

// ---- Corpus loaders --------------------------------------------------------
function loadRealCorpus(db: Database.Database): CorpusItem[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.channel, c.attempt, c.text, c.structured_json
       FROM director_audits d JOIN candidates c ON c.id=d.candidate_id
       WHERE d.card_id=? ORDER BY c.channel, c.attempt`,
    )
    .all(CARD_ID) as Array<{ id: string; channel: string; text: string; structured_json: string | null }>;
  return rows.map((r) => ({
    item_id: r.id,
    source: "real",
    channel: r.channel as Channel,
    text: r.text,
    structured: r.structured_json ? JSON.parse(r.structured_json) : undefined,
  }));
}

function loadBattery(): CorpusItem[] {
  const muts = JSON.parse(readFileSync(resolve(BATTERY_DIR, "mutations.json"), "utf8")) as Array<{
    mutation_id: string;
    base_candidate_id: string;
    channel: string;
    defect_class: string;
    defect_label: string;
    mutated_text: string;
  }>;
  const bases = JSON.parse(readFileSync(resolve(BATTERY_DIR, "bases.json"), "utf8")) as Array<{
    base_candidate_id: string;
    channel: string;
    text: string;
  }>;
  const items: CorpusItem[] = [];
  for (const m of muts) {
    items.push({
      item_id: m.mutation_id,
      source: "mutation",
      channel: m.channel as Channel,
      text: m.mutated_text,
      defect_class: m.defect_class,
      defect_label: m.defect_label,
      base_candidate_id: m.base_candidate_id,
    });
  }
  for (const b of bases) {
    items.push({
      item_id: `ctrl-${b.base_candidate_id.slice(-6)}`,
      source: "control",
      channel: b.channel as Channel,
      text: b.text,
      defect_class: null,
      defect_label: null,
      base_candidate_id: b.base_candidate_id,
    });
  }
  return items;
}

function loadCard(db: Database.Database): ReleaseCard {
  // Reconstruct from embedded director_prompt_json on any audit row.
  const row = db
    .prepare(
      `SELECT director_prompt_json FROM director_audits WHERE card_id=? LIMIT 1`,
    )
    .get(CARD_ID) as { director_prompt_json: string } | undefined;
  if (row?.director_prompt_json) {
    const prompt = JSON.parse(row.director_prompt_json);
    const userText: string = prompt.user ?? "";
    const anchor = userText.indexOf("Release card fact contract");
    const start = anchor !== -1 ? userText.indexOf("{", anchor) : -1;
    if (start !== -1) {
      let depth = 0;
      let end = -1;
      for (let i = start; i < userText.length; i++) {
        const ch = userText[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end !== -1) {
        try {
          return parseReleaseCard(JSON.parse(userText.slice(start, end)));
        } catch {
          /* fall through */
        }
      }
    }
  }
  // Fallback: battery card.json (same card subject).
  return parseReleaseCard(JSON.parse(readFileSync(resolve(BATTERY_DIR, "card.json"), "utf8")));
}

function toCandidate(item: CorpusItem): Candidate {
  return {
    id: item.item_id,
    text: item.text,
    channel: item.channel,
    declared_beats: [],
    source: "anthropic",
    ...(item.structured ? { structured: item.structured as never } : {}),
  };
}

// ---- Arm runners -----------------------------------------------------------
async function runArmA(
  client: Anthropic,
  classifierSystem: string,
  card: ReleaseCard,
  item: CorpusItem,
): Promise<ArmResult> {
  // classifier read and contextual Director are independent → run concurrently
  const opts: AuditCandidateWithDirectorOptions = {
    card,
    candidate: toCandidate(item),
    channel: item.channel,
    voice: INFINEX_VOICE,
    mode: "live",
  };
  const memory = buildDirectorMemoryPack(INFINEX_VOICE);
  const user = buildDirectorUserMessage(opts);
  const [{ read, usage: u1 }, dir] = await Promise.all([
    classifyBlind(client, classifierSystem, item),
    safeAuditDirector(client, memory.system_prompt, user, item),
  ]);
  const { audit, usage: u2, calls: dirCalls } = dir;
  const calls = 1 + dirCalls;
  const inTok = u1.input_tokens + u2.input_tokens;
  const outTok = u1.output_tokens + u2.output_tokens;
  const gate = legalityOf(read.tempo, item.channel, item.text);
  return {
    item_id: item.item_id,
    arm: "A",
    source: item.source,
    channel: item.channel,
    defect_class: item.defect_class,
    authoritative_tempo: read.tempo, // classifier's read is authoritative
    director_tempo: audit.primary_tempo,
    legal: gate.legal,
    legal_reason: gate.reason,
    copy_voice_passed: audit.copy_voice_passed,
    factual_passed: audit.factual_passed,
    passed: gate.legal && audit.copy_voice_passed && audit.factual_passed,
    voice_issues: audit.voice_issues,
    factual_issues: audit.factual_issues,
    classifier_rationale: read.rationale,
    director_rationale: audit.tempo_basis?.attitude_or_state,
    calls, input_tokens: inTok, output_tokens: outTok,
  };
}

async function runArmB(
  client: Anthropic,
  card: ReleaseCard,
  item: CorpusItem,
): Promise<ArmResult> {
  const opts: AuditCandidateWithDirectorOptions = {
    card,
    candidate: toCandidate(item),
    channel: item.channel,
    voice: INFINEX_VOICE,
    mode: "live",
  };
  const memory = buildDirectorMemoryPack(INFINEX_VOICE);
  const user = buildDirectorUserMessage(opts);
  const system = ACCOUNTABILITY_PREFIX + memory.system_prompt;
  const { audit, usage, calls } = await safeAuditDirector(client, system, user, item);
  return {
    item_id: item.item_id,
    arm: "B",
    source: item.source,
    channel: item.channel,
    defect_class: item.defect_class,
    authoritative_tempo: audit.primary_tempo,
    director_tempo: audit.primary_tempo,
    legal: audit.infinex_fit.legal,
    legal_reason: audit.infinex_fit.reason,
    copy_voice_passed: audit.copy_voice_passed,
    factual_passed: audit.factual_passed,
    passed: audit.passed,
    voice_issues: audit.voice_issues,
    factual_issues: audit.factual_issues,
    director_rationale: audit.tempo_basis?.attitude_or_state,
    calls, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
  };
}

async function runArmC(
  client: Anthropic,
  classifierSystem: string,
  item: CorpusItem,
): Promise<ArmResult> {
  let calls = 0;
  let inTok = 0;
  let outTok = 0;
  // 1. blind classifier read (character-blind = the classify-corpus prompt)
  const { read, usage: u1 } = await classifyBlind(client, classifierSystem, item);
  calls++; inTok += u1.input_tokens; outTok += u1.output_tokens;
  const gate = legalityOf(read.tempo, item.channel, item.text);
  let coaching: string | undefined;
  // 2. if illegal, warm director writes coaching (now GIVEN the placement)
  if (!gate.legal) {
    const { note, usage: u2 } = await writeCoaching(client, read.tempo, item);
    calls++; inTok += u2.input_tokens; outTok += u2.output_tokens;
    coaching = note;
  }
  return {
    item_id: item.item_id,
    arm: "C",
    source: item.source,
    channel: item.channel,
    defect_class: item.defect_class,
    authoritative_tempo: read.tempo,
    blind_tempo: read.tempo,
    legal: gate.legal,
    legal_reason: gate.reason,
    passed: gate.legal, // C is a classify->gate->coach experiment; pass == legal
    coaching_note: coaching,
    classifier_rationale: read.rationale,
    calls, input_tokens: inTok, output_tokens: outTok,
  };
}

// ---- Variance subset -------------------------------------------------------
function varianceSubset(real: CorpusItem[], battery: CorpusItem[]): CorpusItem[] {
  // mix of channels + a few mutations = 12 items.
  const oneEachChannel: CorpusItem[] = [];
  const seen = new Set<string>();
  for (const it of real) {
    if (!seen.has(it.channel)) {
      seen.add(it.channel);
      oneEachChannel.push(it);
    }
  }
  // 7 channels -> add 5 mutations (spread across defect classes)
  const muts = battery.filter((b) => b.source === "mutation");
  const pickedMuts: CorpusItem[] = [];
  const classesSeen = new Set<string>();
  for (const m of muts) {
    if (m.defect_class && !classesSeen.has(m.defect_class)) {
      classesSeen.add(m.defect_class);
      pickedMuts.push(m);
    }
    if (pickedMuts.length >= 5) break;
  }
  return [...oneEachChannel, ...pickedMuts].slice(0, 12);
}

// ---- Main ------------------------------------------------------------------
function flag(name: string): string | undefined {
  const p = `--${name}`;
  const idx = process.argv.indexOf(p);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1]!.startsWith("--")) {
    return process.argv[idx + 1];
  }
  const eqp = process.argv.find((a) => a.startsWith(`${p}=`));
  return eqp ? eqp.slice(p.length + 1) : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readExistingIds(path: string, variancePass?: number): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(path)) return ids;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as ArmResult;
      if (variancePass !== undefined) {
        if (r.variance_pass === variancePass) ids.add(r.item_id);
      } else if (r.variance_pass === undefined) {
        ids.add(r.item_id);
      }
    } catch {
      /* skip */
    }
  }
  return ids;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required.");
  mkdirSync(OUT_DIR, { recursive: true });
  const arm = (flag("arm") ?? "C").toUpperCase() as "A" | "B" | "C";
  const offset = Number(flag("offset") ?? 0);
  const limit = Number(flag("limit") ?? 10);
  const variance = hasFlag("variance");
  const variancePass = variance ? Number(flag("pass") ?? 1) : undefined;

  const db = new Database(DB_PATH, { readonly: true });
  const card = loadCard(db);
  const real = loadRealCorpus(db);
  const battery = loadBattery();
  db.close();

  const classifierSystem = loadClassifierSystemPrompt();
  // 120s per-request timeout + bounded retries: a hung long-form Director call
  // aborts and retries cleanly rather than blocking a worker indefinitely.
  const client = new Anthropic({ timeout: 120_000, maxRetries: 3 });

  let corpus: CorpusItem[];
  let outPath: string;
  if (variance) {
    corpus = varianceSubset(real, battery);
    outPath = resolve(OUT_DIR, `arm-${arm}-variance.jsonl`);
  } else {
    corpus = [...real, ...battery];
    outPath = resolve(OUT_DIR, `arm-${arm}-results.jsonl`);
  }

  const slice = corpus.slice(offset, offset + limit);
  const done = readExistingIds(outPath, variancePass);
  process.stderr.write(
    `Arm ${arm}${variance ? ` variance pass ${variancePass}` : ""}: corpus=${corpus.length}, slice [${offset},${offset + limit}) = ${slice.length} items, ${done.size} already done.\n`,
  );

  const concurrency = Number(flag("concurrency") ?? 4);
  const todo = slice.filter((it) => !done.has(it.item_id));
  process.stderr.write(`  ${slice.length - todo.length} skipped (done), ${todo.length} to run, concurrency=${concurrency}.\n`);

  let processed = 0;
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const item = todo[cursor++]!;
      let res: ArmResult;
      if (arm === "A") res = await runArmA(client, classifierSystem, card, item);
      else if (arm === "B") res = await runArmB(client, card, item);
      else res = await runArmC(client, classifierSystem, item);
      if (variancePass !== undefined) res.variance_pass = variancePass;
      appendFileSync(outPath, JSON.stringify(res) + "\n");
      processed++;
      process.stderr.write(
        `  [${processed}/${todo.length}] ${item.item_id} (${item.channel}/${item.source}) → tempo=${res.authoritative_tempo} legal=${res.legal} pass=${res.passed}\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length || 1) }, () => worker()));
  process.stderr.write(`Done. Wrote ${processed} new row(s) to ${outPath}\n`);
}

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!k || process.env[k] !== undefined) continue;
    process.env[k] = v.replace(/^['"]|['"]$/g, "");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
