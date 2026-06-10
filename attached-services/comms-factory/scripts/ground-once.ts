#!/usr/bin/env tsx
// One-off runner for the fact grounder. Grounds a brief into VerifiedFacts.
//   pnpm tsx scripts/ground-once.ts --file=<seed.md> [--ref=<branch>] [--discover=<query>] [--surface=x,web] [--job="..."] [--out=<json>]
// --ref=<branch>     : ground against that platform branch (fetched → origin/<branch>); covers main + unmerged code.
// --discover=<query> : auto-discover the ship-bound branch for <query> and ground against it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { centaurResearchExecutorFromEnv, hasCentaurResearchEnv } from "../src/centaur-research.js";
import { groundFacts, fetchRef, discoverSources } from "../src/fact-grounder-llm.js";

loadEnv(".env");

function flag(name: string): string | undefined {
  const p = `--${name}=`;
  return process.argv.find((a) => a.startsWith(p))?.slice(p.length);
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required");
  const file = flag("file");
  const copy = file ? readFileSync(file, "utf8") : (flag("copy") ?? "");
  if (!copy.trim()) throw new Error("provide --file=<seed.md> or --copy=...");

  const useCentaurResearch = flag("capabilities") === "1" || hasCentaurResearchEnv();
  let ref: string | undefined;
  const refFlag = flag("ref");
  const discover = flag("discover");
  if (useCentaurResearch) {
    console.error("grounding through Centaur capability plane; local gh/git discovery is skipped");
    ref = refFlag;
  } else if (refFlag) {
    ref = await fetchRef(refFlag);
    console.error(`grounding against ${ref}`);
  } else if (discover) {
    const d = await discoverSources(discover);
    if (d.primary?.number) {
      ref = await fetchRef(d.primary.branch);
      console.error(`discovered #${d.primary.number} ${d.primary.branch} → grounding against ${ref}`);
    } else {
      console.error(`no ship-bound branch for "${discover}"; grounding main + docs`);
    }
  }

  const researchExecutor = useCentaurResearch
    ? centaurResearchExecutorFromEnv({ job_id: flag("job-id") ?? "ground-once", stage: "ground-once" })
    : undefined;
  const result = await groundFacts(copy, {
    surface: flag("surface") ?? "x,web",
    job: flag("job") ?? "ground launch facts",
    ...(ref ? { ref } : {}),
    ...(researchExecutor ? { tool_executor: (name, input, id, scopedRef) => researchExecutor.execute(name, input, id, { ref: scopedRef }) } : {}),
    on_event: (e) => {
      if (e.type === "tool_call") console.error(`  → ${e.name}(${JSON.stringify(e.input).slice(0, 120)})`);
      if (e.type === "record_fact") console.error(`  ✓ ${e.fact.claim} = ${e.fact.value} [${e.fact.confidence}] ${e.fact.source}`);
      if (e.type === "unverifiable") console.error(`  ✗ ${e.claim} — ${e.reason}`);
    },
  });

  const out = flag("out");
  const json = JSON.stringify(result, null, 2);
  if (out) { writeFileSync(out, json); console.error(`\nwrote ${out}`); }
  console.log(json);
  console.error(`\nfacts: ${result.facts.length} | unverifiable: ${result.unverifiable.length} | turns: ${result.ground_turns} | model: ${result.model}`);
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
