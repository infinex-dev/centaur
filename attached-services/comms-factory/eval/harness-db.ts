/**
 * Thin better-sqlite3 wrapper for inserting permutation-tagged candidates into
 * the harness DB. The eval rig needs to write into the same `candidates` table
 * the harness reads from, but with an extra `prompt_variant` column so we can
 * slice metrics by permutation later.
 *
 * The schema migration adding `prompt_variant` is happening in parallel —
 * this module trusts the column will exist when we run for real. For the
 * smoke test, we add the column ourselves if missing so the rig can build and
 * verify end-to-end without waiting for the parallel migration.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ulid } from "ulid";

import type { Candidate } from "../src/generator.js";
import type { ReleaseCard } from "../src/card.js";
import type { ValidationResult } from "../src/validator.js";

export interface HarnessDbOptions {
  /** Absolute path to harness.db. Will be created if missing. */
  dbPath: string;
  /** Absolute path to harness/lib/schema.sql for initial schema. */
  schemaPath: string;
}

export interface InsertCandidateRow {
  card: ReleaseCard;
  candidate: Candidate;
  attempt: number;
  validation: ValidationResult;
  promptVariant: string;
}

export class HarnessDb {
  private db: Database.Database;
  private hasPromptVariantColumn = false;

  constructor(opts: HarnessDbOptions) {
    const dir = path.dirname(opts.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(opts.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    if (existsSync(opts.schemaPath)) {
      this.db.exec(readFileSync(opts.schemaPath, "utf8"));
    }
    this.ensurePromptVariantColumn();
  }

  /**
   * In production the parallel migration will add `prompt_variant` to the
   * candidates table. Until that ships, the rig adds it itself so we can run
   * the smoke test end-to-end. Idempotent — checks PRAGMA before issuing the
   * ALTER.
   */
  private ensurePromptVariantColumn(): void {
    const cols = this.db.prepare(`PRAGMA table_info(candidates)`).all() as Array<{ name: string }>;
    const has = cols.some((c) => c.name === "prompt_variant");
    if (!has) {
      this.db.exec(`ALTER TABLE candidates ADD COLUMN prompt_variant TEXT`);
    }
    this.hasPromptVariantColumn = true;
  }

  ensureCard(card: ReleaseCard, voice = "infinex"): string {
    const cardId = card.id;
    const existing = this.db
      .prepare(`SELECT id FROM cards WHERE id = ?`)
      .get(cardId) as { id: string } | undefined;
    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO cards (id, voice, brief, status) VALUES (?, ?, ?, 'in-progress')`,
        )
        .run(cardId, voice, card.title ?? cardId);
    }
    // Mirror release_cards JSON so downstream tools can read this row through
    // the harness UI if anyone wants to.
    const releaseExisting = this.db
      .prepare(`SELECT card_id FROM release_cards WHERE card_id = ?`)
      .get(cardId) as { card_id: string } | undefined;
    if (!releaseExisting) {
      this.db
        .prepare(
          `INSERT INTO release_cards (card_id, release_card_json) VALUES (?, ?)`,
        )
        .run(cardId, JSON.stringify(card));
    }
    return cardId;
  }

  /**
   * Insert a single candidate row tagged with `prompt_variant`. Returns the
   * generated row id.
   */
  insertCandidate(row: InsertCandidateRow): string {
    if (!this.hasPromptVariantColumn) {
      throw new Error("HarnessDb: prompt_variant column missing — migration not applied");
    }
    const id = ulid();
    this.db
      .prepare(
        `INSERT INTO candidates (
          id, card_id, channel, attempt, text, declared_beats_json,
          beat_audit_json, validation_passed, validation_failures_json,
          rationale, source, prompt_variant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        row.card.id,
        row.candidate.channel,
        row.attempt,
        row.candidate.text,
        JSON.stringify(row.candidate.declared_beats),
        JSON.stringify(row.validation.beat_audit ?? []),
        row.validation.passed ? 1 : 0,
        JSON.stringify(row.validation.failures),
        row.candidate.rationale ?? null,
        row.candidate.source,
        row.promptVariant,
      );
    return id;
  }

  countCandidatesByPromptVariant(): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT prompt_variant AS variant, COUNT(*) AS n FROM candidates WHERE prompt_variant IS NOT NULL GROUP BY prompt_variant`,
      )
      .all() as Array<{ variant: string; n: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.variant] = r.n;
    return out;
  }

  close(): void {
    this.db.close();
  }
}
