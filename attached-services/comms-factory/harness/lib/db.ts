/**
 * better-sqlite3 instance + schema initialisation.
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ulid } from 'ulid';

const HARNESS_ROOT = existsSync(resolve(process.cwd(), 'lib/schema.sql'))
  ? process.cwd()
  : resolve(process.cwd(), 'harness');
const DB_PATH = process.env.HARNESS_DB_PATH ?? resolve(HARNESS_ROOT, 'harness.db');
const SCHEMA_PATH = (() => {
  const local = resolve(process.cwd(), 'lib/schema.sql');
  if (existsSync(local)) return local;
  return resolve(HARNESS_ROOT, 'lib/schema.sql');
})();

let dbInstance: Database.Database | null = null;
let schemaInitialised = false;

export function newId(): string {
  return ulid();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  ensureSchema(dbInstance);
  return dbInstance;
}

export function initSchema(): void {
  const db = getDb();
  ensureSchema(db);
  console.log(`Schema initialised at ${DB_PATH}`);
}

export function writeTx<T>(db: Database.Database, fn: () => T): T {
  return db.transaction(fn)();
}

function ensureSchema(db: Database.Database): void {
  if (schemaInitialised) return;
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  dropLegacyChannelChecks(db, schema);
  repairStaleCandidateForeignKeys(db, schema);
  addColumnIfMissing(db, 'candidates', 'structured_json', 'TEXT');
  addColumnIfMissing(db, 'final_picks', 'final_structured_json', 'TEXT');
  schemaInitialised = true;
}

/**
 * `CREATE TABLE IF NOT EXISTS` won't add a column to a pre-existing table, so
 * additive columns need an explicit ALTER. Idempotent: skips if the column is
 * already present. Used for structured_json (structured-channel output).
 */
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  type: string,
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

/**
 * Pre-existing DBs baked `CHECK (channel IN ('x','web','in-product'))` into their
 * tables, so `CREATE TABLE IF NOT EXISTS` can't relax it — the old constraint would
 * reject new channels (modal, blog). Channel is now validated app-side (lib/types
 * Channel), so rebuild any table still carrying the CHECK without it. Idempotent:
 * once the CHECK is gone the regex test fails and this is a no-op.
 */
function dropLegacyChannelChecks(db: Database.Database, schema: string): void {
  const tables = ['generator_attempts', 'actor_run_events', 'candidates', 'director_audits', 'final_picks'];
  const checkRe = /\s*CHECK\s*\(channel IN \([^)]*\)( OR channel IS NULL)?\)/i;
  let rebuilt = false;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const table of tables) {
        const row = db
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
          .get(table) as { sql: string } | undefined;
        if (!row?.sql || !checkRe.test(row.sql)) continue;
        const newSql = row.sql.replace(checkRe, '');
        db.exec(`ALTER TABLE ${table} RENAME TO ${table}__chkmig`);
        db.exec(newSql); // recreates `table` (original name) without the channel CHECK
        db.exec(`INSERT INTO ${table} SELECT * FROM ${table}__chkmig`);
        db.exec(`DROP TABLE ${table}__chkmig`);
        rebuilt = true;
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  // Indexes drop with the old tables — re-run schema to recreate them (CREATE INDEX IF NOT EXISTS).
  if (rebuilt) db.exec(schema);
}

/**
 * Older local DBs that ran the channel-CHECK rebuild while `candidates` was
 * renamed can retain foreign keys pointing at `candidates__chkmig`. Repair those
 * table definitions back to `candidates` before structured-channel runs insert
 * new Director audits or picks.
 */
function repairStaleCandidateForeignKeys(db: Database.Database, schema: string): void {
  // Scan EVERY table for the dangling `candidates__chkmig` reference rather than a
  // hardcoded list — a fixed list silently misses tables (candidate_decisions,
  // candidate_text_edits, candidate_semantic_edits, candidate_audits all carry the
  // same FK) and leaves them throwing "no such table: candidates__chkmig" under FK checks.
  const tables = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%candidates__chkmig%'")
      .all() as { name: string }[]
  ).map((r) => r.name);
  let rebuilt = false;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const table of tables) {
        const row = db
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
          .get(table) as { sql: string } | undefined;
        if (!row?.sql || !row.sql.includes('candidates__chkmig')) continue;
        const newSql = row.sql.replace(/REFERENCES\s+"?candidates__chkmig"?/g, 'REFERENCES candidates');
        db.exec(`ALTER TABLE ${table} RENAME TO ${table}__fkmig`);
        db.exec(newSql);
        db.exec(`INSERT INTO ${table} SELECT * FROM ${table}__fkmig`);
        db.exec(`DROP TABLE ${table}__fkmig`);
        rebuilt = true;
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  if (rebuilt) db.exec(schema);
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'init') {
    initSchema();
  } else {
    console.error('Usage: tsx lib/db.ts init');
    process.exit(1);
  }
}
