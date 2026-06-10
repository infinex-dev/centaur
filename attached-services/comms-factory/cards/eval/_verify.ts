/**
 * Verify every card in cards/eval/ parses against parseReleaseCard().
 * Exits non-zero if any card fails to parse, with a per-card error report.
 *
 * Run:
 *   pnpm tsx cards/eval/_verify.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseReleaseCard } from "../../src/card.js";

const HERE = path.dirname(new URL(import.meta.url).pathname);

const files = fs
  .readdirSync(HERE)
  .filter((f) => f.endsWith(".json"))
  .sort();

let failures = 0;
const kindCounts: Record<string, number> = {};

for (const file of files) {
  const full = path.join(HERE, file);
  try {
    const raw = JSON.parse(fs.readFileSync(full, "utf8"));
    const card = parseReleaseCard(raw);
    kindCounts[card.kind] = (kindCounts[card.kind] ?? 0) + 1;
    console.log(`ok   ${file}  (${card.kind})  id=${card.id}`);
  } catch (err) {
    failures += 1;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${file}`);
    console.error(msg);
  }
}

console.log("");
console.log(`total: ${files.length}  failures: ${failures}`);
console.log(`by kind: ${JSON.stringify(kindCounts)}`);

if (failures > 0) {
  process.exit(1);
}
