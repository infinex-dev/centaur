#!/usr/bin/env tsx
// One-off: replay the 21 candidates the Director rejected on 2026-05-27 (pre-rewiring)
// through the CURRENT Director, to separate "rewiring fixed the canon inversion" from
// "rewiring lobotomized the gate". Reads reconstructed inputs.json (card + receipts pulled
// from the stored director_prompt_json shapes). Does NOT touch harness.db.
//
// Mirrors scripts/run-director-mutation-battery.ts invocation plumbing (same entrypoint,
// same default model = unset -> claude-sonnet-4-6, same 8192 max_tokens budget client) but
// is a SEPARATE script writing to a SEPARATE output dir. Exponential backoff on rate limits.
import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseReleaseCard } from "../src/card.js";
import type { Candidate, Channel, NotSaidFact } from "../src/generator.js";
import { auditCandidateWithDirector, type AnthropicMessagesClient, type DirectorAuditResult } from "../src/actor-director.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

const DIR = "research/director-may27-replay-2026-06-03";

interface OldAudit {
  passed: boolean | null;
  primary_tempo: string | null;
  drive_read: string | null;
  placement_read: string | null;
  infinex_fit: { legal?: boolean; reason?: string; nearest_allowed_read?: string } | null;
  factual_issues: string[] | null;
  voice_issues: string[] | null;
  notes_for_actor: string[] | null;
}

interface InputItem {
  item_id: string;
  set: "warmup" | "run";
  candidate_id: string;
  warmup_mode: string | null;
  channel: Channel;
  text: string;
  card: unknown;
  deployed_facts_used: string[];
  not_said: NotSaidFact[];
  old_audit: OldAudit;
}

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

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required.");

  const items: InputItem[] = JSON.parse(readFileSync(`${DIR}/inputs.json`, "utf8"));
  const client = budgetClient();
  const results: Record<string, unknown>[] = [];
  let idx = 0;
  let errors = 0;

  for (const item of items) {
    idx++;
    const card = parseReleaseCard(item.card);
    const candidate: Candidate = {
      id: item.candidate_id,
      text: item.text,
      channel: item.channel,
      declared_beats: [],
      deployed_facts_used: item.deployed_facts_used ?? [],
      not_said: item.not_said ?? [],
      source: "anthropic",
    };

    let audit: DirectorAuditResult | undefined;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        audit = await auditCandidateWithDirector({
          card,
          candidate,
          channel: item.channel,
          voice: INFINEX_VOICE,
          mode: "live",
          client,
          // model left unset -> default claude-sonnet-4-6 (system under test)
        });
        break;
      } catch (err) {
        lastErr = err;
        const wait = Math.min(60000, 1500 * 2 ** (attempt - 1));
        console.error(`  [${item.item_id}] attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)} (backoff ${wait}ms)`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    const row: Record<string, unknown> = {
      item_id: item.item_id,
      set: item.set,
      candidate_id: item.candidate_id,
      warmup_mode: item.warmup_mode,
      channel: item.channel,
      text: item.text,
      old_audit: item.old_audit,
      new_audit: audit
        ? {
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
          }
        : null,
      audit_error: audit ? false : true,
      audit_error_message: audit ? null : (lastErr instanceof Error ? lastErr.message : String(lastErr)),
    };
    if (!audit) errors++;
    results.push(row);
    appendFileSync(`${DIR}/results.jsonl`, JSON.stringify(row) + "\n");
    const v = audit ? `pass=${audit.passed} legal=${audit.infinex_fit.legal} tempo=${audit.primary_tempo} drive=${audit.drive_read}` : "ERROR";
    console.error(`[${idx}/${items.length}] ${item.item_id} ${item.channel} -> ${v}`);
  }

  writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 2));
  console.error(`\nWrote ${results.length} results (${errors} errors) -> ${DIR}/results.json`);
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
