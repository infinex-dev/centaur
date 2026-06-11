#!/usr/bin/env tsx
/**
 * Range demo (2026-06-10): what do irradiant / sombre / sociable PRIMARIES
 * look like on a real card?
 *
 * Emergence-clean steering: Stage A runs live once (shared interpretation:
 * thesis/through_action/obstacle/lining). Each register variant then swaps in
 * a hand-scored beat plan — verbs + Working-Action motors only, never a tempo
 * name. Stage B drafts from each plan; the UNCHANGED Director reads the
 * results blind and reports which register actually landed.
 *
 * Usage: pnpm tsx scripts/tempo-range-demo.ts <card.json> [--n=2] [--out=research/tempo-eval/range-demo]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseReleaseCard } from "../src/card.js";
import {
  draftFromInnerWork,
  generateInnerWork,
  type BeatPlan,
  type InnerWork,
} from "../src/generator.js";
import { auditCandidateWithDirector } from "../src/actor-director.js";

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2]!.replace(/^['"]|['"]$/g, "");
  }
}
loadEnv(".env");
loadEnv("harness/.env.local");

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const eq = a.indexOf("=");
    return eq === -1 ? ([a.slice(2), "true"] as const) : ([a.slice(2, eq), a.slice(eq + 1)] as const);
  }),
);
const cardPath = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!cardPath) {
  console.error("usage: pnpm tsx scripts/tempo-range-demo.ts <card.json> [--n=2]");
  process.exit(1);
}
const N = Number.parseInt(args.get("n") ?? "2", 10);
const CHANNEL = (args.get("channel") ?? "x") as import("../src/generator.js").Channel;
const OUT_DIR = resolve(args.get("out") ?? "research/tempo-eval/range-demo");

// Register-steered beat plans. Motors only — the playable layer per Mirodan
// Ch.1 pp. 350-351. No tempo names anywhere; the Director adjudicates blind.
const STEERED_PLANS: Record<string, BeatPlan[]> = {
  unsteered: [], // replaced by Stage A's own plan
  "irradiant-aim": [
    {
      verb: "to unfold what just opened",
      working_action: "floating",
      micro_objective: "the reader feels the surface widen rather than being told a feature shipped",
      obstacle_local: "launch-genre default of announcing at the reader",
    },
    {
      verb: "to let the fact surface, lightly",
      working_action: "flicking",
      preparation_from: "floating",
      micro_objective: "the load-bearing fact lands as a glint inside the unfolding, not as a headline",
      obstacle_local: "the urge to bear down on the number",
    },
    {
      verb: "to lift toward what this makes possible",
      working_action: "floating",
      micro_objective: "future-tense lift; the reader leaves mid-air, accompanied",
      obstacle_local: "the genre's hard CTA close",
    },
  ],
  "sombre-aim": [
    {
      verb: "to bear the weight of what this replaces",
      working_action: "pressing",
      micro_objective: "the reader feels the old arrangement as a held pressure, almost unspoken",
      obstacle_local: "reading the post as a cheerful feature note",
    },
    {
      verb: "to land the fact under containment",
      working_action: "punching",
      preparation_from: "pressing",
      micro_objective: "the fact arrives heavy and bound — resolve without celebration",
      obstacle_local: "the urge to brighten at the moment of landing",
    },
    {
      verb: "to hold the resolve in place",
      working_action: "pressing",
      micro_objective: "the close stays contained; no lift, the weight remains carried",
      obstacle_local: "genre default of ending on a flourish",
    },
  ],
  "sociable-aim": [
    {
      verb: "to welcome the venue in",
      working_action: "gliding",
      micro_objective: "the reader senses companionship — us alongside the venue, doors open",
      obstacle_local: "reading the partner as a vendor integration",
    },
    {
      verb: "to place the fact between us and them",
      working_action: "dabbing",
      preparation_from: "gliding",
      micro_objective: "the load-bearing fact lands as a shared, direct, light touch",
      obstacle_local: "the urge to claim the venue's strength as our own",
    },
    {
      verb: "to extend the company forward",
      working_action: "gliding",
      micro_objective: "the close gestures outward — room at the table, more seats coming",
      obstacle_local: "the genre's self-centred close",
    },
  ],
};

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const card = parseReleaseCard(JSON.parse(readFileSync(resolve(cardPath!), "utf8")));

  process.stderr.write("Stage A (shared interpretation)...\n");
  const baseInnerWork = await generateInnerWork(card, { channel: CHANNEL, mode: "live" });

  const results: Array<{
    variant: string;
    id: string;
    text: string;
    director_primary: string;
    director_pass: boolean;
    director_legal: boolean;
    fit_reason: string;
  }> = [];

  for (const [variant, plan] of Object.entries(STEERED_PLANS)) {
    const innerWork: InnerWork = plan.length === 0 ? baseInnerWork : { ...baseInnerWork, beat_plan: plan };
    process.stderr.write(`Stage B + Director: ${variant}...\n`);
    const candidates = await draftFromInnerWork(card, innerWork, { channel: CHANNEL, n: N, mode: "live" });
    const audits = await Promise.all(
      candidates.map((candidate) => auditCandidateWithDirector({ card, candidate, channel: CHANNEL })),
    );
    candidates.forEach((candidate, i) => {
      const audit = audits[i]!;
      results.push({
        variant,
        id: `${variant}-${i + 1}`,
        text: candidate.text,
        director_primary: audit.primary_tempo,
        director_pass: audit.passed,
        director_legal: audit.infinex_fit.legal,
        fit_reason: audit.infinex_fit.reason,
      });
    });
  }

  writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify({ inner_work: baseInnerWork, results }, null, 2));
  for (const r of results) {
    console.log(`\n=== ${r.id} | Director: ${r.director_primary} | pass=${r.director_pass} legal=${r.director_legal}`);
    console.log(r.text);
  }
  console.log(`\nsaved: ${OUT_DIR}/results.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
