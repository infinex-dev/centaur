/**
 * Pipeline 3 A/B/C/D/E test — same docstring variants, same releases as v2,
 * but routed through orchestrateActorDirectorWithRetries() instead of the
 * legacy generate().
 *
 * Uses the v2 grounded through_action + lining (from
 * research/card-docstring-ab-v2-results-2026-05-28/rows.json) as the card's
 * inner-work fields, so the docstring variant's influence is held constant
 * at the input layer and the SOLE variable is the pipeline architecture.
 *
 * Phase 1: Actor/Director × 50 cells, parallel.
 * Phase 2: judge final caption per cell with same metrics as v2.
 *
 * Output: research/card-docstring-ab-pipeline3-results-2026-05-28/
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ReleaseCard } from "../../src/card.js";
import { orchestrateActorDirectorWithRetries } from "../../src/actor-orchestrator.js";
import { buildPipeline3Proof, PIPELINE_3_ENTRYPOINT, type PipelineIdentityReport } from "../../src/pipeline-identity.js";
import { INFINEX_VOICE } from "../../src/voice/infinex.js";

const JUDGE_MODEL = "claude-sonnet-4-5";
const V2_ROWS_PATH = "research/card-docstring-ab-v2-results-2026-05-28/rows.json";
const OUT_DIR = "research/card-docstring-ab-pipeline3-results-2026-05-28";
process.env.HARNESS_GENERATOR_ARCH = "actor";

// ============================================================
// Release-level base card data (reused from v2; same corpus)
// ============================================================

interface ReleaseMeta {
  title: string;
  description: string;
  deployed_facts: string[];
  metric: string;
  value: string;
}

const RELEASE_META: Record<string, ReleaseMeta> = {
  "fiat-onramp": {
    title: "Fiat deposits via virtual bank accounts",
    description: "Infinex now supports fiat deposits via virtual bank accounts (ACH, SEPA, wire). Each user gets an account number; they can send dollars, euros, or pounds from any bank, and it arrives in their Infinex wallet as USDC, on-chain. The integration uses Bridge.xyz's virtual-account infrastructure.",
    deployed_facts: [
      "Infinex account numbers support ACH, SEPA, wire deposits",
      "Fiat deposits convert to USDC and arrive on-chain in the user's Infinex wallet",
      "Bridge.xyz powers the virtual account infrastructure",
      "Supported currencies: USD, EUR, GBP, MXN, BRL, COP",
    ],
    metric: "Fiat deposit support",
    value: "Live",
  },
  "chain-add-megaeth": {
    title: "Swidge now bridges into MegaETH",
    description: "Swidge — Infinex's cross-chain switch — adds support for MegaETH. Users can move into MegaETH from any chain in a single transaction; gas, bridging, and the destination DEX are handled by the protocol.",
    deployed_facts: [
      "Swidge bridges into MegaETH from any supported source chain",
      "Single-transaction execution: bridge + gas + destination DEX integrated",
    ],
    metric: "Swidge chain support",
    value: "MegaETH added",
  },
  "yield-vault-launch": {
    title: "AI-augmented yield vaults with audit layer",
    description: "Infinex launches AI-augmented yield vaults. The agent picks the strategy across Aave, Morpho, Pendle, Maple. An audit layer surfaces why each rebalance happened, so the user can read the agent's reasoning post-trade.",
    deployed_facts: [
      "Yield vaults use AI agent to pick and rotate across DeFi protocols",
      "Protocols routed across: Aave, Morpho, Pendle, Maple",
      "Audit layer shows the agent's reasoning per rebalance",
    ],
    metric: "AI yield vaults",
    value: "Live",
  },
  "partnership-spot-hyperliquid": {
    title: "Spot Hyperliquid live in Infinex",
    description: "Spot trading on Hyperliquid is now native inside Infinex. Same account, same passkey; the Hyperliquid orderbook surfaces inside the Infinex app where the user's portfolio already lives.",
    deployed_facts: [
      "Hyperliquid spot trading available natively in Infinex",
      "Single account + passkey covers both Infinex and Hyperliquid spot",
    ],
    metric: "Spot Hyperliquid",
    value: "Native",
  },
  "passkey-portable": {
    title: "Passkey-portable accounts (no seed phrase)",
    description: "Infinex accounts are passkey-portable: a user can log in on a new device by authenticating with their passkey. No seed phrase to remember, store, or recover.",
    deployed_facts: [
      "Infinex accounts authenticate via passkey",
      "Account access portable across devices without seed phrase",
    ],
    metric: "Account auth",
    value: "Passkey",
  },
  "perps-maintenance": {
    title: "Perps engine maintenance window",
    description: "Scheduled maintenance for the perpetuals engine: Sunday 02:00 UTC, expected 10 minutes of downtime. Open positions are unaffected; new orders will queue during the window.",
    deployed_facts: [
      "Perps engine maintenance scheduled Sunday 02:00 UTC",
      "Expected downtime: ~10 minutes",
      "Open positions unaffected; new orders queue during window",
    ],
    metric: "Perps maintenance",
    value: "Sun 02:00 UTC",
  },
  "private-send-ga": {
    title: "Private Send moves to GA",
    description: "Private Send — Infinex's payment-without-exposed-history primitive — graduates from beta to general availability. Users can send crypto to any address without revealing their on-chain financial history.",
    deployed_facts: [
      "Private Send leaves beta; available to all users",
      "Payments can be sent without exposing the sender's on-chain history",
    ],
    metric: "Private Send",
    value: "GA",
  },
  "scale-milestone-10m": {
    title: "Infinex crosses 10M users",
    description: "Infinex passes 10 million accounts. The growth came from passkey-onboarding (no seed phrase friction) and the AI yield vault product (first deposit converts to a managed position).",
    deployed_facts: [
      "Infinex user count: 10 million accounts",
      "Primary growth drivers: passkey onboarding, AI yield vaults",
    ],
    metric: "Accounts",
    value: "10M",
  },
  "agent-vault-constraints": {
    title: "Yield-vault constraint controls",
    description: "Yield-vault users can now set the agent's constraints directly: max risk band, allowed protocols, rebalance cadence. The agent operates inside those constraints and reports each rebalance against them.",
    deployed_facts: [
      "Yield-vault constraints user-configurable: max risk, allowed protocols, rebalance cadence",
      "Agent reports each rebalance against the user's locked constraints",
    ],
    metric: "Agent constraints",
    value: "User-set",
  },
  "yield-aggregator-sunset": {
    title: "Old yield UI sunset; new vault interface live",
    description: "The legacy yield-aggregator interface (manual APY-comparison surface) is sunset. The replacement is the AI-augmented yield vault: a single position the user funds, with the agent managing protocol selection and rebalancing.",
    deployed_facts: [
      "Legacy yield-aggregator UI removed",
      "Replacement: AI-augmented yield vault (single funded position)",
    ],
    metric: "Yield UI",
    value: "New vault interface",
  },
};

// ============================================================
// v2 row structure (we only need a few fields)
// ============================================================

interface V2Row {
  release_id: string;
  variant_id: string;
  through_action: string;
  lining: string;
}

// ============================================================
// Phase 1 — Pipeline 3 invocation per cell (parallel)
// ============================================================

interface Pipeline3Result {
  release_id: string;
  variant_id: string;
  through_action_in: string;  // what we passed into the card
  lining_in: string;
  actor_thesis?: string;
  actor_through_action?: string;
  actor_lining?: string;
  final_caption: string;
  director_passed: boolean;
  attempts_used: number;
  exhausted: boolean;
  director_voice_issues?: string[];
  director_factual_issues?: string[];
  pipeline_proof?: PipelineIdentityReport;
  error?: string;
}

async function runPipeline3Cell(row: V2Row): Promise<Pipeline3Result> {
  const meta = RELEASE_META[row.release_id];
  if (!meta) {
    return {
      release_id: row.release_id,
      variant_id: row.variant_id,
      through_action_in: row.through_action,
      lining_in: row.lining,
      final_caption: "",
      director_passed: false,
      attempts_used: 0,
      exhausted: true,
      error: `no RELEASE_META for ${row.release_id}`,
    };
  }

  // Construct the card. through_action + lining come from the v2 grounding
  // (which was shaped by the variant docstring at grounding time).
  const card: ReleaseCard = {
    id: `pipeline3-test-${row.release_id}-${row.variant_id}`,
    title: meta.title,
    ship_date: "2026-05-28",
    audience: ["x"],
    deployed_facts: meta.deployed_facts,
    kind: "data-card-official",
    metric: meta.metric,
    value: meta.value,
    through_action: row.through_action,
    lining: row.lining,
  };

  try {
    const result = await orchestrateActorDirectorWithRetries(card, ["x"], {
      voice: INFINEX_VOICE,
      n: 1,             // one candidate per channel for test simplicity
      warmup_mode: "scene_rehearsal",
      maxAttempts: 3,
    });

    const pick = result.picks[0];
    // Pull the Actor's table_work from the last attempt
    const lastAttempt = result.attempts[result.attempts.length - 1];
    const actorTW = lastAttempt?.actor.output.table_work;
    const directorAudit = lastAttempt?.records.find((r) => r.candidate.text === pick?.text)?.director_audit;
    const proof = buildPipeline3Proof({
      env_arch: process.env.HARNESS_GENERATOR_ARCH,
      entrypoint: PIPELINE_3_ENTRYPOINT,
      actor_attempt_rows: 0,
      actor_run_event_rows: 0,
      candidate_rationale_has_actor_option: result.attempts.some((attempt) =>
        attempt.records.some((record) => record.candidate.rationale?.includes("Actor option "))),
      director_audit_has_split_gates: result.attempts.some((attempt) =>
        attempt.records.some((record) =>
          record.director_audit !== undefined &&
          typeof record.director_audit.copy_voice_passed === "boolean" &&
          typeof record.director_audit.factual_passed === "boolean" &&
          typeof record.director_audit.publication_gate_passed === "boolean")),
    });

    return {
      release_id: row.release_id,
      variant_id: row.variant_id,
      through_action_in: row.through_action,
      lining_in: row.lining,
      ...(actorTW?.thesis ? { actor_thesis: actorTW.thesis } : {}),
      ...(actorTW?.through_action ? { actor_through_action: actorTW.through_action } : {}),
      ...(actorTW?.lining ? { actor_lining: actorTW.lining } : {}),
      final_caption: pick?.text ?? "",
      director_passed: !!pick,
      attempts_used: result.attempts.length,
      exhausted: result.exhausted,
      ...(directorAudit?.voice_issues ? { director_voice_issues: directorAudit.voice_issues } : {}),
      ...(directorAudit?.factual_issues ? { director_factual_issues: directorAudit.factual_issues } : {}),
      pipeline_proof: proof,
    };
  } catch (err) {
    return {
      release_id: row.release_id,
      variant_id: row.variant_id,
      through_action_in: row.through_action,
      lining_in: row.lining,
      final_caption: "",
      director_passed: false,
      attempts_used: 0,
      exhausted: true,
      error: String(err),
    };
  }
}

// ============================================================
// Phase 2 — judge final caption (same as v2)
// ============================================================

interface CaptionJudgment {
  release_id: string;
  variant_id: string;
  wall_present: boolean;
  refusing_present: boolean;
  eliminate_present: boolean;
  anchoring_score: number;
  ship_quality: number;
  voice_fit: number;
  notes: string;
  error?: string;
}

async function judgeCaption(
  client: Anthropic,
  result: Pipeline3Result,
): Promise<CaptionJudgment> {
  const caption = result.final_caption;
  const lower = caption.toLowerCase();
  const wall_present = /\bwall\b|\bbank.{0,5}wallet\b|\bdissolved\b/.test(lower);
  const refusing_present = /\brefus/.test(lower);
  const eliminate_present = /\beliminat/.test(lower);

  if (!caption || result.error) {
    return {
      release_id: result.release_id,
      variant_id: result.variant_id,
      wall_present,
      refusing_present,
      eliminate_present,
      anchoring_score: 0,
      ship_quality: 0,
      voice_fit: 0,
      notes: `pipeline failed: ${result.error ?? "no caption"}`,
      error: result.error ?? "no caption",
    };
  }

  const meta = RELEASE_META[result.release_id]!;
  const systemPrompt = `You are an impartial judge evaluating the FINAL CAPTION text from a release-card pipeline.

The Actor read a release card containing a through_action and lining (proposed in advance). The Actor then composed a final caption for the X channel.

Score the caption on three dimensions via the score_caption tool. Be terse.`;

  const userMessage = `## Release
**${meta.title}** — ${meta.description}

## Card's pre-baked through_action and lining (Actor read these as inputs)
- through_action: "${result.through_action_in}"
- lining: "${result.lining_in}"

## FINAL CAPTION (X channel)

\`\`\`
${caption}
\`\`\`

Score via score_caption.`;

  try {
    const response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 1024,
      tools: [
        {
          name: "score_caption",
          description: "Score the final caption.",
          input_schema: {
            type: "object",
            properties: {
              anchoring_score: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "How much does the caption echo the input through_action/lining's tokens, pattern, or frame? 1 = independent of inputs (Actor transformed them); 5 = direct echo of input tokens. If the through_action contained 'wall' or 'dissolved' and the caption also does, that's high anchoring.",
              },
              ship_quality: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "Would you ship this caption? 1 = embarrassing. 3 = acceptable. 5 = excellent, on-character, distinctive.",
              },
              voice_fit: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "Does the caption read as the Infinex voice (Stable + Penetrating + Flow-stressed Bound; Spell→Vision axis; banker-turned-crypto-trailblazer character; no urgency / FOMO / hype theatre)? 1 = off-character. 5 = on-character.",
              },
              notes: {
                type: "string",
                description: "One short sentence on what's strongest or weakest.",
              },
            },
            required: ["anchoring_score", "ship_quality", "voice_fit", "notes"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "score_caption" },
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return {
        release_id: result.release_id,
        variant_id: result.variant_id,
        wall_present,
        refusing_present,
        eliminate_present,
        anchoring_score: 0,
        ship_quality: 0,
        voice_fit: 0,
        notes: "no tool_use in judge response",
        error: "no tool_use",
      };
    }
    const input = toolUse.input as { anchoring_score?: number; ship_quality?: number; voice_fit?: number; notes?: string };
    return {
      release_id: result.release_id,
      variant_id: result.variant_id,
      wall_present,
      refusing_present,
      eliminate_present,
      anchoring_score: input.anchoring_score ?? 0,
      ship_quality: input.ship_quality ?? 0,
      voice_fit: input.voice_fit ?? 0,
      notes: input.notes ?? "",
    };
  } catch (err) {
    return {
      release_id: result.release_id,
      variant_id: result.variant_id,
      wall_present,
      refusing_present,
      eliminate_present,
      anchoring_score: 0,
      ship_quality: 0,
      voice_fit: 0,
      notes: String(err),
      error: String(err),
    };
  }
}

// ============================================================
// Phase 3 — aggregate
// ============================================================

interface VariantMetrics {
  variant_id: string;
  count: number;
  director_pass_rate: number;
  exhausted_rate: number;
  mean_attempts: number;
  wall_hit_rate: number;
  refusing_hit_rate: number;
  eliminate_hit_rate: number;
  mean_anchoring_score: number;
  mean_ship_quality: number;
  mean_voice_fit: number;
  mean_caption_length: number;
}

function aggregate(
  variantId: string,
  results: Pipeline3Result[],
  judgments: CaptionJudgment[],
): VariantMetrics {
  const r = results.filter((x) => x.variant_id === variantId);
  const j = judgments.filter((x) => x.variant_id === variantId);
  const ok = j.filter((x) => !x.error);

  return {
    variant_id: variantId,
    count: r.length,
    director_pass_rate: Number((r.filter((x) => x.director_passed).length / Math.max(1, r.length)).toFixed(3)),
    exhausted_rate: Number((r.filter((x) => x.exhausted).length / Math.max(1, r.length)).toFixed(3)),
    mean_attempts: r.length > 0 ? Number((r.reduce((s, x) => s + x.attempts_used, 0) / r.length).toFixed(2)) : 0,
    wall_hit_rate: Number((j.filter((x) => x.wall_present).length / Math.max(1, j.length)).toFixed(3)),
    refusing_hit_rate: Number((j.filter((x) => x.refusing_present).length / Math.max(1, j.length)).toFixed(3)),
    eliminate_hit_rate: Number((j.filter((x) => x.eliminate_present).length / Math.max(1, j.length)).toFixed(3)),
    mean_anchoring_score: ok.length > 0 ? Number((ok.reduce((s, x) => s + x.anchoring_score, 0) / ok.length).toFixed(2)) : 0,
    mean_ship_quality: ok.length > 0 ? Number((ok.reduce((s, x) => s + x.ship_quality, 0) / ok.length).toFixed(2)) : 0,
    mean_voice_fit: ok.length > 0 ? Number((ok.reduce((s, x) => s + x.voice_fit, 0) / ok.length).toFixed(2)) : 0,
    mean_caption_length: r.length > 0 ? Math.round(r.reduce((s, x) => s + x.final_caption.length, 0) / r.length) : 0,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const client = new Anthropic();

  console.log(`[${new Date().toISOString()}] Loading v2 groundings from ${V2_ROWS_PATH}`);
  const v2Rows: V2Row[] = JSON.parse(await fs.readFile(V2_ROWS_PATH, "utf8"));
  console.log(`  loaded ${v2Rows.length} (release × variant) cells`);

  console.log(`[${new Date().toISOString()}] Phase 1: Pipeline 3 × ${v2Rows.length} (parallel)`);
  const startPhase1 = Date.now();
  const pipelinePromises = v2Rows.map((row) =>
    runPipeline3Cell(row).then((res) => {
      const tag = res.error
        ? `ERROR(${res.error.slice(0, 50)})`
        : `pass=${res.director_passed} attempts=${res.attempts_used} chars=${res.final_caption.length}`;
      console.log(`  ${res.release_id} × ${res.variant_id}: ${tag}`);
      return res;
    }),
  );
  const results = await Promise.all(pipelinePromises);
  await fs.writeFile(path.join(OUT_DIR, "pipeline3-results.json"), JSON.stringify(results, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 1 done in ${Math.round((Date.now() - startPhase1) / 1000)}s`);

  console.log(`[${new Date().toISOString()}] Phase 2: judge captions × ${results.length} (parallel)`);
  const judgmentPromises = results.map((r) =>
    judgeCaption(client, r).then((j) => {
      const tag = j.error
        ? `ERROR`
        : `anchor=${j.anchoring_score} ship=${j.ship_quality} voice=${j.voice_fit} wall=${j.wall_present} refus=${j.refusing_present}`;
      console.log(`  judge ${r.release_id} × ${r.variant_id}: ${tag}`);
      return j;
    }),
  );
  const judgments = await Promise.all(judgmentPromises);
  await fs.writeFile(path.join(OUT_DIR, "judgments.json"), JSON.stringify(judgments, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 2 done`);

  console.log(`[${new Date().toISOString()}] Phase 3: aggregating`);
  const variantIds = [...new Set(results.map((r) => r.variant_id))];
  const metrics = variantIds.map((v) => aggregate(v, results, judgments));
  await fs.writeFile(path.join(OUT_DIR, "metrics.json"), JSON.stringify(metrics, null, 2));

  // Per-row flat table for HTML
  const rows = results.map((r) => {
    const j = judgments.find((x) => x.release_id === r.release_id && x.variant_id === r.variant_id);
    return {
      release_id: r.release_id,
      variant_id: r.variant_id,
      through_action_in: r.through_action_in,
      lining_in: r.lining_in,
      actor_through_action: r.actor_through_action ?? "",
      actor_lining: r.actor_lining ?? "",
      final_caption: r.final_caption,
      caption_length: r.final_caption.length,
      director_passed: r.director_passed,
      attempts_used: r.attempts_used,
      exhausted: r.exhausted,
      wall_present: j?.wall_present ?? false,
      refusing_present: j?.refusing_present ?? false,
      eliminate_present: j?.eliminate_present ?? false,
      anchoring_score: j?.anchoring_score ?? 0,
      ship_quality: j?.ship_quality ?? 0,
      voice_fit: j?.voice_fit ?? 0,
	      notes: j?.notes ?? "",
	      pipeline_id: r.pipeline_proof?.pipeline_id ?? "pipeline-3",
	      pipeline_proof_passed: r.pipeline_proof?.proof_passed ?? false,
	      pipeline_proof_warnings: r.pipeline_proof?.warnings ?? ["proof absent"],
	      ...(r.error ? { pipeline_error: r.error } : {}),
	    };
  });
  await fs.writeFile(path.join(OUT_DIR, "rows.json"), JSON.stringify(rows, null, 2));

  console.log("\n=== Pipeline 3 Summary ===\n");
  for (const m of metrics) {
    console.log(`${m.variant_id}`);
    console.log(`  director pass rate:  ${(m.director_pass_rate * 100).toFixed(0)}%`);
    console.log(`  exhausted rate:      ${(m.exhausted_rate * 100).toFixed(0)}%`);
    console.log(`  mean attempts:       ${m.mean_attempts}`);
    console.log(`  wall hit rate:       ${(m.wall_hit_rate * 100).toFixed(0)}%`);
    console.log(`  refusing hit rate:   ${(m.refusing_hit_rate * 100).toFixed(0)}%`);
    console.log(`  eliminate hit rate:  ${(m.eliminate_hit_rate * 100).toFixed(0)}%`);
    console.log(`  anchoring (1-5):     ${m.mean_anchoring_score}`);
    console.log(`  ship quality (1-5):  ${m.mean_ship_quality}`);
    console.log(`  voice fit (1-5):     ${m.mean_voice_fit}`);
    console.log(`  mean caption chars:  ${m.mean_caption_length}`);
    console.log("");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
