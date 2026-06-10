#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { ulid } from "ulid";
import { parseReleaseCard, type ReleaseCard } from "../src/card.js";
import type { Candidate, Channel } from "../src/generator.js";
import {
  buildFactRequestGrounder,
  orchestrateActorDirectorWithRetries,
  type ActorDirectorResult,
  type ActorDirectorRunEvent,
  type OperatorSelectionPreference,
} from "../src/actor-orchestrator.js";
import { groundFacts } from "../src/fact-grounder-llm.js";
import { parseActorWarmupMode, type VerticalFlowDirection } from "../src/actor-director.js";
import { buildPipeline3Proof, PIPELINE_3_ENTRYPOINT, type PipelineIdentityReport } from "../src/pipeline-identity.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

type Db = Database.Database;

interface Args {
  card: string;
  channels: Channel[];
  n: number;
  dbPath: string;
  warmup: string | undefined;
  flowDirection: VerticalFlowDirection;
  review: boolean;
  operatorPreferences: OperatorSelectionPreference[];
}

loadEnv(".env");
loadEnv("harness/.env.local");

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  process.env.HARNESS_GENERATOR_ARCH = "actor";
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for Pipeline 3 live Actor/Director runs.");
  }

  const db = new Database(args.dbPath);
  db.pragma("foreign_keys = ON");
  ensureSchema(db);

  const { cardId, releaseCard } = loadCard(db, args.card);
  const runId = newId();
  const attemptBase = nextActorAttempt(db, cardId);
  const result = await orchestrateActorDirectorWithRetries(releaseCard, args.channels, {
    n: args.n,
    warmup_mode: parseActorWarmupMode(args.warmup),
    flow_direction: args.flowDirection,
    voice: INFINEX_VOICE,
    mode: "live",
    operator_preferences: args.operatorPreferences,
    grounder: buildFactRequestGrounder({ groundFacts }),
    onEvent: (event) => persistActorRunEvent(db, cardId, runId, event),
  });

  persistActorDirectorResult(db, {
    cardId,
    releaseCard,
    result,
    attemptBase,
  });
  const proof = buildPipeline3Proof({
    env_arch: process.env.HARNESS_GENERATOR_ARCH,
    entrypoint: PIPELINE_3_ENTRYPOINT,
    actor_attempt_rows: countRows(db, "actor_attempts", cardId),
    actor_run_event_rows: countRows(db, "actor_run_events", cardId),
    candidate_rationale_has_actor_option: result.attempts.some((attempt) =>
      attempt.records.some((record) => record.candidate.rationale?.includes("Actor option "))),
    director_audit_has_split_gates: result.attempts.some((attempt) =>
      attempt.records.some((record) =>
        record.director_audit !== undefined &&
        typeof record.director_audit.copy_voice_passed === "boolean" &&
        typeof record.director_audit.factual_passed === "boolean" &&
        typeof record.director_audit.publication_gate_passed === "boolean")),
  });
  persistPipelineRun(db, cardId, runId, proof);

  let reviewPath: string | null = null;
  if (args.review) {
    reviewPath = execFileSync("node", ["scripts/build-actor-run-review.mjs", cardId], {
      encoding: "utf8",
      env: { ...process.env, HARNESS_GENERATOR_ARCH: "actor" },
    }).trim();
  }

  console.log(JSON.stringify({
    card_id: cardId,
    pipeline_id: proof.pipeline_id,
    proof_passed: proof.proof_passed,
    proof_warnings: proof.warnings,
    channels: args.channels,
    flow_direction: args.flowDirection,
    attempts: result.attempts.length,
    picks: result.picks.map((pick) => ({ channel: pick.channel, text: pick.text })),
    review_html: reviewPath,
    auto_posted: false,
  }, null, 2));
}

function parseArgs(argv: string[]): Args {
  const first = argv.find((arg) => !arg.startsWith("--"));
  const card = flag(argv, "card") ?? first;
  if (!card) {
    throw new Error("Usage: pnpm tsx scripts/run-actor-director-card.ts --card=<card-id-or-json-path> [--channels=x,x-thread,web,in-product,modal,blog,carousel] [--flow=inwards-out|outwards-in] [--n=5] [--prefer=web:phrase] [--avoid=x:phrase]");
  }
  return {
    card,
    channels: parseChannels(flag(argv, "channels") ?? "x,web,in-product"),
    n: Number(flag(argv, "n") ?? 5),
    dbPath: resolve(flag(argv, "db") ?? "harness/harness.db"),
    warmup: flag(argv, "warmup"),
    flowDirection: parseFlowDirection(flag(argv, "flow")),
    review: !argv.includes("--no-review"),
    operatorPreferences: parseOperatorPreferences(argv),
  };
}

function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function flags(argv: string[], name: string): string[] {
  const prefix = `--${name}=`;
  return argv.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length));
}

function parseChannels(value: string): Channel[] {
  const channels = value.split(",").map((item) => item.trim()).filter(Boolean);
  const valid = channels.filter((channel): channel is Channel =>
    isChannel(channel));
  const unsupported = channels.filter((channel) => !valid.includes(channel as Channel));
  if (unsupported.length > 0) {
    console.error(`Ignoring unsupported generator channel(s): ${unsupported.join(", ")}. Email remains draft-only.`);
  }
  if (valid.length === 0) throw new Error("No supported channels requested. Use x, x-thread, web, in-product, modal, blog, and/or carousel.");
  return [...new Set(valid)];
}

function parseFlowDirection(value: string | undefined): VerticalFlowDirection {
  return value === "outwards-in" ? "outwards-in" : "inwards-out";
}

function parseOperatorPreferences(argv: string[]): OperatorSelectionPreference[] {
  return [
    ...flags(argv, "prefer").map((value) => parseOperatorPreference(value, "prefer")),
    ...flags(argv, "avoid").map((value) => parseOperatorPreference(value, "avoid")),
  ];
}

function parseOperatorPreference(value: string, kind: "prefer" | "avoid"): OperatorSelectionPreference {
  const [maybeChannel, ...rest] = value.split(":");
  const channel = isChannel(maybeChannel)
    ? maybeChannel
    : undefined;
  const term = (channel ? rest.join(":") : value).trim();
  if (!term) throw new Error(`--${kind} requires a text fragment, optionally prefixed by a channel such as x:, x-thread:, web:, or carousel:.`);
  return {
    ...(channel !== undefined ? { channel } : {}),
    [kind]: term,
    reason: "CLI operator preference",
  };
}

function isChannel(value: string | undefined): value is Channel {
  return (
    value === "x" ||
    value === "x-thread" ||
    value === "web" ||
    value === "in-product" ||
    value === "modal" ||
    value === "blog" ||
    value === "carousel"
  );
}

function loadCard(db: Db, cardArg: string): { cardId: string; releaseCard: ReleaseCard } {
  if (existsSync(cardArg)) {
    const releaseCard = parseReleaseCard(JSON.parse(readFileSync(cardArg, "utf8")));
    upsertCard(db, releaseCard);
    return { cardId: releaseCard.id, releaseCard };
  }
  const row = db.prepare("SELECT release_card_json FROM release_cards WHERE card_id = ?").get(cardArg) as
    | { release_card_json: string }
    | undefined;
  if (!row) throw new Error(`No release_card_json found for card id ${cardArg}`);
  return { cardId: cardArg, releaseCard: parseReleaseCard(JSON.parse(row.release_card_json)) };
}

function upsertCard(db: Db, card: ReleaseCard): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO cards (id, voice, brief, status, created_at)
     VALUES (?, 'infinex', ?, 'in-progress', ?)
     ON CONFLICT(id) DO NOTHING`,
  ).run(card.id, card.title, now);
  db.prepare(
    `INSERT INTO release_cards (card_id, release_card_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(card_id) DO UPDATE SET release_card_json=excluded.release_card_json, updated_at=excluded.updated_at`,
  ).run(card.id, JSON.stringify(card, null, 2), now);
}

function persistActorDirectorResult(
  db: Db,
  opts: {
    cardId: string;
    releaseCard: ReleaseCard;
    result: ActorDirectorResult;
    attemptBase: number;
  },
): void {
  const tx = db.transaction(() => {
    for (const attempt of opts.result.attempts) {
      const dbAttemptNum = opts.attemptBase + (attempt.attempt - 1);
      const actorAttemptId = newId();
      const createdAtForAttempt = new Date().toISOString();
      db.prepare(
        `INSERT INTO actor_attempts
           (id, card_id, attempt, channels_json, source_index_json, prompt_version,
            prompt_hash, model, director_notes_in_json, actor_prompt_json,
            actor_transcript_json, actor_response_json, table_work_json,
            generator_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        actorAttemptId,
        opts.cardId,
        dbAttemptNum,
        JSON.stringify([...new Set(attempt.records.map((r) => r.candidate.channel))]),
        JSON.stringify(attempt.actor.memory.source_index),
        attempt.actor.memory.version,
        attempt.actor.memory.prompt_hash,
        process.env.COMMS_ACTOR_MODEL ?? "claude-opus-4-7",
        attempt.director_notes_in ? JSON.stringify(attempt.director_notes_in) : null,
        JSON.stringify(attempt.actor.prompt),
        JSON.stringify(attempt.actor.transcript_messages),
        attempt.actor.raw_response,
        JSON.stringify(attempt.actor.output.table_work),
        attempt.actor.source,
        createdAtForAttempt,
      );
      db.prepare(
        `INSERT INTO actor_warmups
           (id, actor_attempt_id, card_id, attempt, daily_pages_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(newId(), actorAttemptId, opts.cardId, dbAttemptNum, JSON.stringify(attempt.actor.output.warmup), createdAtForAttempt);

      for (const record of attempt.records) {
        const candidate = record.candidate;
        const id = newId();
        const createdAt = new Date().toISOString();
        const directorPassed = record.director_audit
          ? record.director_audit.copy_voice_passed &&
            record.director_audit.factual_passed &&
            record.director_audit.infinex_fit.legal
          : null;
        db.prepare(
          `INSERT INTO candidates
             (id, card_id, channel, attempt, text, structured_json, declared_beats_json, beat_audit_json,
              validation_passed, validation_failures_json, rationale, source, prompt_variant, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          opts.cardId,
          candidate.channel,
          dbAttemptNum,
          candidate.text,
          candidate.structured ? JSON.stringify(candidate.structured) : null,
          JSON.stringify(candidate.declared_beats),
          JSON.stringify(record.script_validation.beat_audit ?? []),
          record.script_validation.passed ? 1 : 0,
          JSON.stringify(record.script_validation.failures),
          candidate.rationale ?? null,
          candidate.source,
          candidate.prompt_variant ?? null,
          createdAt,
        );
        if (record.director_audit) {
          db.prepare(
            `INSERT INTO director_audits
               (id, actor_attempt_id, candidate_id, card_id, channel, attempt,
                director_model, director_prompt_json, director_audit_json, passed, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            newId(),
            actorAttemptId,
            id,
            opts.cardId,
            candidate.channel,
            dbAttemptNum,
            process.env.COMMS_DIRECTOR_MODEL ?? process.env.COMMS_ACTIVE_VALIDATOR_MODEL ?? "claude-sonnet-4-6",
            JSON.stringify(record.director_audit.prompt),
            JSON.stringify(record.director_audit),
            directorPassed ? 1 : 0,
            createdAt,
          );
        }
      }
    }
  });
  tx();
}

function persistActorRunEvent(db: Db, cardId: string, runId: string, event: ActorDirectorRunEvent): void {
  db.prepare(
    `INSERT INTO actor_run_events
       (id, card_id, run_id, attempt, channel, event_type, message, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    cardId,
    runId,
    event.attempt ?? null,
    event.channel ?? null,
    event.event_type,
    event.message,
    JSON.stringify(event.payload ?? {}),
    new Date().toISOString(),
  );
}

function persistPipelineRun(db: Db, cardId: string, runId: string, proof: PipelineIdentityReport): void {
  db.prepare(
    `INSERT INTO pipeline_runs
       (id, card_id, pipeline_id, pipeline_label, entrypoint, proof_json, proof_passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    cardId,
    proof.pipeline_id,
    proof.pipeline_label,
    proof.entrypoint,
    JSON.stringify(proof),
    proof.proof_passed ? 1 : 0,
    proof.generated_at,
  );
}

function nextActorAttempt(db: Db, cardId: string): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt FROM candidates WHERE card_id = ?")
    .get(cardId) as { attempt: number };
  return row.attempt;
}

function countRows(db: Db, table: string, cardId: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE card_id = ?`).get(cardId) as { count: number };
  return row.count;
}

function ensureSchema(db: Db): void {
  const schema = readFileSync("harness/lib/schema.sql", "utf8");
  db.exec(schema);
  repairStaleCandidateForeignKeys(db, schema);
  addColumnIfMissing(db, "candidates", "structured_json", "TEXT");
}

function repairStaleCandidateForeignKeys(db: Db, schema: string): void {
  const tables = ["director_audits", "final_picks"];
  let rebuilt = false;
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      for (const table of tables) {
        const row = db
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
          .get(table) as { sql: string } | undefined;
        if (!row?.sql || !row.sql.includes("candidates__chkmig")) continue;
        const newSql = row.sql.replace(/REFERENCES\s+"?candidates__chkmig"?/g, "REFERENCES candidates");
        db.exec(`ALTER TABLE ${table} RENAME TO ${table}__fkmig`);
        db.exec(newSql);
        db.exec(`INSERT INTO ${table} SELECT * FROM ${table}__fkmig`);
        db.exec(`DROP TABLE ${table}__fkmig`);
        rebuilt = true;
      }
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  if (rebuilt) db.exec(schema);
}

function addColumnIfMissing(db: Db, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function newId(): string {
  return ulid();
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
