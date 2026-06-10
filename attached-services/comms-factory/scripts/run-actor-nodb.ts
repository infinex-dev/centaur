#!/usr/bin/env tsx
// Pipeline 3 (Actor/Director) run WITHOUT sqlite persistence — sidesteps the
// stale better-sqlite3 native build. Prints picks + derived table-work.
//   pnpm tsx scripts/run-actor-nodb.ts --card=<json> [--channels=x,web,in-product] [--n=3] [--out=<json>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseReleaseCard } from "../src/card.js";
import type { Channel } from "../src/generator.js";
import { orchestrateActorDirectorWithRetries } from "../src/actor-orchestrator.js";
import { parseActorWarmupMode } from "../src/actor-director.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

loadEnv(".env");

function flag(name: string): string | undefined {
  const p = `--${name}=`;
  return process.argv.find((a) => a.startsWith(p))?.slice(p.length);
}

async function main(): Promise<void> {
  process.env.HARNESS_GENERATOR_ARCH = "actor";
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required");
  const cardPath = flag("card");
  if (!cardPath || !existsSync(cardPath)) throw new Error("--card=<json path> required");
  const card = parseReleaseCard(JSON.parse(readFileSync(cardPath, "utf8")));
  const channels = (flag("channels") ?? "x,web,in-product")
    .split(",").map((c) => c.trim())
    .filter((c): c is Channel => c === "x" || c === "web" || c === "in-product");

  const result = await orchestrateActorDirectorWithRetries(card, channels, {
    n: Number(flag("n") ?? 3),
    warmup_mode: parseActorWarmupMode(flag("warmup")),
    voice: INFINEX_VOICE,
    mode: "live",
    operator_preferences: [],
    onEvent: (e) => console.error(`[a${e.attempt ?? "-"}${e.channel ? "/" + e.channel : ""}] ${e.event_type}: ${(e.message ?? "").slice(0, 120)}`),
  });

  const summary = {
    card_id: card.id,
    attempts: result.attempts.length,
    table_work: result.attempts.map((a) => a.actor.output.table_work),
    picks: result.picks.map((p) => ({ channel: p.channel, text: p.text })),
  };
  const out = flag("out");
  if (out) writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k && process.env[k] === undefined) process.env[k] = v!.replace(/^['"]|['"]$/g, "");
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.stack ?? e.message : String(e)); process.exit(1); });
