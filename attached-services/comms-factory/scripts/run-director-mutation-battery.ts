#!/usr/bin/env tsx
import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseReleaseCard, type ReleaseCard } from "../src/card.js";
import type { Candidate, Channel, NotSaidFact, CandidateMovementReceipt } from "../src/generator.js";
import { auditCandidateWithDirector, type AnthropicMessagesClient, type DirectorAuditResult } from "../src/actor-director.js";
import { validate } from "../src/validator.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

// Wrap the real client only to RAISE the output ceiling. The system under test is
// the Director model + prompt, both untouched. The hardcoded 4096-token budget in
// auditCandidateWithDirector truncated a long blog audit mid-JSON; that is a harness
// artifact, not a Director verdict, so we bump max_tokens to 8192 here.
function budgetClient(): AnthropicMessagesClient {
  const inner = new Anthropic();
  return {
    messages: {
      create: (params) => inner.messages.create({ ...params, max_tokens: 8192 }),
    },
  } as AnthropicMessagesClient;
}

loadEnv(".env");
loadEnv("harness/.env.local");

const CARD_ID = "01KT5FTDJVCCE8ZG5DX4CXAG15";
const DIR = "research/director-mutation-battery-2026-06-03";

interface MutationEntry {
  mutation_id: string;
  base_candidate_id: string;
  base_index: number;
  channel: Channel;
  defect_class: string;
  defect_label: string;
  original_text: string;
  mutated_text: string;
  deployed_facts_used: string[];
  not_said: NotSaidFact[];
  movement_receipt: CandidateMovementReceipt[];
}

interface ResultRow {
  item_id: string;
  kind: "control" | "mutation";
  base_candidate_id: string;
  channel: Channel;
  defect_class: string | null;
  defect_label: string | null;
  text: string;
  director: {
    passed: boolean;
    copy_voice_passed: boolean;
    factual_passed: boolean;
    publication_gate_passed: boolean;
    infinex_fit_legal: boolean;
    infinex_fit_reason: string;
    primary_tempo: string;
    primary_confidence: number;
    drive_read: string;
    placement_read: string;
    voice_issues: string[];
    factual_issues: string[];
    publication_gate_issues: string[];
    notes_for_actor: string[];
  };
  voice_caught: boolean;
  only_factual_fired: boolean;
  audit_error?: boolean;
  regex: {
    passed: boolean;
    failures: { rule: string; reason: string }[];
  };
  audit_full: DirectorAuditResult;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY required.");
  }
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyN = onlyArg ? Number(onlyArg.slice("--only=".length)) : undefined;

  const card = loadCard();

  const mutations: MutationEntry[] = JSON.parse(readFileSync(`${DIR}/mutations.json`, "utf8"));
  const bases: MutationEntry[] = JSON.parse(readFileSync(`${DIR}/bases.json`, "utf8")).map((b: any, idx: number) => ({
    ...b,
    base_index: idx,
  }));

  // Build the worklist: controls (14 unmutated) + mutations (42).
  const work: Array<{ kind: "control" | "mutation"; entry: MutationEntry; text: string; item_id: string }> = [];
  for (const b of bases) {
    work.push({
      kind: "control",
      entry: b,
      text: b.original_text ?? (b as any).text,
      item_id: `ctrl-${b.channel}-${b.base_candidate_id.slice(-6)}`,
    });
  }
  for (const m of mutations) {
    work.push({ kind: "mutation", entry: m, text: m.mutated_text, item_id: m.mutation_id });
  }

  const doneIds = new Set(
    existsSync(`${DIR}/results.jsonl`)
      ? readFileSync(`${DIR}/results.jsonl`, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).item_id as string)
      : [],
  );
  const pending = work.filter((w) => !doneIds.has(w.item_id));
  console.error(`Resume: ${doneIds.size} done, ${pending.length} pending`);
  const sliced = onlyN ? pending.slice(0, onlyN) : pending;
  const client = budgetClient();
  const results: ResultRow[] = [];
  let idx = 0;
  let errors = 0;
  for (const item of sliced) {
    idx++;
    let row: ResultRow | undefined;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        row = await runOne(card, client, item.kind, item.entry, item.text, item.item_id);
        break;
      } catch (err) {
        lastErr = err;
        console.error(`  [${item.item_id}] audit attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (!row) {
      errors++;
      console.error(`[${idx}/${sliced.length}] ${item.item_id} ${item.entry.channel} ERROR (recorded as audit_error)`);
      results.push(errorRow(item.kind, item.entry, item.text, item.item_id, lastErr));
    } else {
      results.push(row);
      const tag = row.voice_caught ? "CAUGHT" : (row.only_factual_fired ? "FACT-ONLY" : "MISSED");
      console.error(
        `[${idx}/${sliced.length}] ${item.item_id} ${row.channel} class=${row.defect_class ?? "ctrl"} ` +
        `director_pass=${row.director.passed} voice=${tag} regex_pass=${row.regex.passed}`,
      );
    }
    // Incremental append (one JSON object per line) so a mid-run crash never
    // loses completed audits, and so we never depend on re-serializing a growing
    // array. The final results.json is rebuilt from this JSONL.
    appendFileSync(`${DIR}/results.jsonl`, JSON.stringify(results[results.length - 1]) + "\n");
  }

  writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 2));
  console.error(`\nWrote ${results.length} results (${errors} errors) -> ${DIR}/results.json`);
}

function errorRow(
  kind: "control" | "mutation",
  entry: MutationEntry,
  text: string,
  itemId: string,
  err: unknown,
): ResultRow {
  const regex = validate(text, { voice: INFINEX_VOICE });
  return {
    item_id: itemId,
    kind,
    base_candidate_id: entry.base_candidate_id,
    channel: entry.channel,
    defect_class: kind === "mutation" ? entry.defect_class : null,
    defect_label: kind === "mutation" ? entry.defect_label : null,
    text,
    director: {
      passed: false, copy_voice_passed: false, factual_passed: false, publication_gate_passed: false,
      infinex_fit_legal: false, infinex_fit_reason: "AUDIT ERROR: " + (err instanceof Error ? err.message : String(err)),
      primary_tempo: "error", primary_confidence: 0, drive_read: "error", placement_read: "AUDIT ERROR",
      voice_issues: [], factual_issues: [], publication_gate_issues: [], notes_for_actor: [],
    },
    voice_caught: false,
    only_factual_fired: false,
    audit_error: true,
    regex: { passed: regex.passed, failures: regex.failures },
    audit_full: null as unknown as DirectorAuditResult,
  };
}

async function runOne(
  card: ReleaseCard,
  client: AnthropicMessagesClient,
  kind: "control" | "mutation",
  entry: MutationEntry,
  text: string,
  itemId: string,
): Promise<ResultRow> {
  const candidate: Candidate = {
    id: itemId,
    text,
    channel: entry.channel,
    declared_beats: [],
    movement_receipt: entry.movement_receipt ?? [],
    deployed_facts_used: entry.deployed_facts_used ?? [],
    not_said: entry.not_said ?? [],
    source: "anthropic",
  };

  const audit = await auditCandidateWithDirector({
    card,
    candidate,
    channel: entry.channel,
    voice: INFINEX_VOICE,
    mode: "live",
    client,
    // model left unset -> default claude-sonnet-4-6, the system under test
  });

  const voiceCaught = audit.copy_voice_passed === false || audit.infinex_fit.legal === false;
  const onlyFactualFired = !voiceCaught && audit.factual_passed === false;

  const regex = validate(text, { voice: INFINEX_VOICE });

  return {
    item_id: itemId,
    kind,
    base_candidate_id: entry.base_candidate_id,
    channel: entry.channel,
    defect_class: kind === "mutation" ? entry.defect_class : null,
    defect_label: kind === "mutation" ? entry.defect_label : null,
    text,
    director: {
      passed: audit.passed,
      copy_voice_passed: audit.copy_voice_passed,
      factual_passed: audit.factual_passed,
      publication_gate_passed: audit.publication_gate_passed,
      infinex_fit_legal: audit.infinex_fit.legal,
      infinex_fit_reason: audit.infinex_fit.reason,
      primary_tempo: String(audit.primary_tempo),
      primary_confidence: audit.primary_confidence,
      drive_read: audit.drive_read,
      placement_read: audit.placement_read,
      voice_issues: audit.voice_issues,
      factual_issues: audit.factual_issues,
      publication_gate_issues: audit.publication_gate_issues,
      notes_for_actor: audit.notes_for_actor,
    },
    voice_caught: voiceCaught,
    only_factual_fired: onlyFactualFired,
    regex: {
      passed: regex.passed,
      failures: regex.failures,
    },
    audit_full: audit,
  };
}

function loadCard(): ReleaseCard {
  return parseReleaseCard(JSON.parse(readFileSync(`${DIR}/card.json`, "utf8")));
}

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

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
