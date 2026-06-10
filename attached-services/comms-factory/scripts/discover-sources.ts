#!/usr/bin/env tsx
// Inspect the grounder's source-of-truth discovery: which branches/PRs exist for
// a feature, ranked by freshness × maturity × code-vs-plan.
//   pnpm tsx scripts/discover-sources.ts --query="bridge" [--repo=infinex-xyz/platform]
import { discoverSources } from "../src/fact-grounder/sources/branch-discovery.js";

function flag(name: string): string | undefined {
  const p = `--${name}=`;
  return process.argv.find((a) => a.startsWith(p))?.slice(p.length);
}

async function main(): Promise<void> {
  const query = flag("query");
  if (!query) throw new Error('--query="<feature>" required');
  const result = await discoverSources(query, { repo: flag("repo") ?? "infinex-xyz/platform" });

  const out = flag("out");
  if (out) (await import("node:fs")).writeFileSync(out, JSON.stringify(result, null, 2));

  console.log(`\nSource discovery · "${result.query}" · ${result.repo}\n`);
  const p = result.primary;
  console.log(p ? `PRIMARY → #${p.number} ${p.branch}  (score ${p.score}, ${p.status})\n` : "PRIMARY → none found\n");
  console.log("rank  score  state    days  kind  branch / title");
  console.log("─".repeat(92));
  result.candidates.forEach((c, i) => {
    const star = c === p ? "►" : " ";
    const id = c.number ? `#${c.number}` : "(branch)";
    console.log(
      `${star}${String(i + 1).padStart(3)}  ${String(c.score).padStart(5)}  ${c.state.padEnd(7)}  ${String(c.daysAgo ?? "?").padStart(4)}  ${c.kind.padEnd(4)}  ${id} ${c.branch}`,
    );
    console.log(`              ${c.title.slice(0, 70)}`);
    if (c.notes.length) console.log(`              · ${c.notes.join(" · ")}`);
  });
  console.log("");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
