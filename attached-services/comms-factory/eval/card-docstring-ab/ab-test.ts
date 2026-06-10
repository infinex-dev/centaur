/**
 * Empirical A/B/C/D test for card.ts docstring variants.
 *
 * Question: which docstring shape on `through_action` and `lining` produces the
 * least-contaminated grounder output? Contamination = grounder echoes
 * tokens / pattern / frame / tone from the docstring's example.
 *
 * Variants tested:
 *   CURRENT   — current docstring with "bank wall dissolved" example
 *   VARIANT_A — token swap ("necessary intermediate step evaporated")
 *   VARIANT_B — structural placeholder with property rules, no instance
 *   VARIANT_C — no example, canon reference + forbidden-list
 *
 * For each (release × variant) the grounder proposes through_action + lining
 * via tool-use. A judge then scores each proposal on anchoring (1-5), frame
 * label, validity, and a one-sentence note on what shaped the output most.
 *
 * Output: research/card-docstring-ab-results-2026-05-28/{raw-grounding.json,
 * raw-judged.json, metrics.json}. A subsequent step (HTML viz) reads these.
 *
 * Runtime: ~40 grounder calls + ~40 judge calls, all parallel via Promise.all.
 * Total LLM time: ~1-2 min wall-clock at Sonnet speed.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const MODEL = "claude-sonnet-4-5";
const OUT_DIR = "research/card-docstring-ab-results-2026-05-28";

// ============================================================
// Release corpus — 10 scenarios spanning card kinds
// ============================================================

type Release = {
  id: string;
  kind: "data-card-official" | "data-card-wry" | "launch-tier" | "split";
  title: string;
  description: string;
  deployed_facts: string[];
};

const CORPUS: Release[] = [
  {
    id: "fiat-onramp",
    kind: "data-card-official",
    title: "Fiat deposits via virtual bank accounts",
    description: "Infinex now supports fiat deposits via virtual bank accounts (ACH, SEPA, wire). Each user gets an account number; they can send dollars, euros, or pounds from any bank, and it arrives in their Infinex wallet as USDC, on-chain. The integration uses Bridge.xyz's virtual-account infrastructure.",
    deployed_facts: [
      "Infinex account numbers support ACH, SEPA, wire deposits",
      "Fiat deposits convert to USDC and arrive on-chain in the user's Infinex wallet",
      "Bridge.xyz powers the virtual account infrastructure",
      "Supported currencies: USD, EUR, GBP, MXN, BRL, COP",
    ],
  },
  {
    id: "chain-add-megaeth",
    kind: "data-card-official",
    title: "Swidge now bridges into MegaETH",
    description: "Swidge — Infinex's cross-chain switch — adds support for MegaETH. Users can move into MegaETH from any chain in a single transaction; gas, bridging, and the destination DEX are handled by the protocol.",
    deployed_facts: [
      "Swidge bridges into MegaETH from any supported source chain",
      "Single-transaction execution: bridge + gas + destination DEX integrated",
    ],
  },
  {
    id: "yield-vault-launch",
    kind: "launch-tier",
    title: "AI-augmented yield vaults with audit layer",
    description: "Infinex launches AI-augmented yield vaults. The agent picks the strategy across Aave, Morpho, Pendle, Maple. An audit layer surfaces why each rebalance happened, so the user can read the agent's reasoning post-trade.",
    deployed_facts: [
      "Yield vaults use AI agent to pick and rotate across DeFi protocols",
      "Protocols routed across: Aave, Morpho, Pendle, Maple",
      "Audit layer shows the agent's reasoning per rebalance",
    ],
  },
  {
    id: "partnership-spot-hyperliquid",
    kind: "data-card-official",
    title: "Spot Hyperliquid live in Infinex",
    description: "Spot trading on Hyperliquid is now native inside Infinex. Same account, same passkey; the Hyperliquid orderbook surfaces inside the Infinex app where the user's portfolio already lives.",
    deployed_facts: [
      "Hyperliquid spot trading available natively in Infinex",
      "Single account + passkey covers both Infinex and Hyperliquid spot",
    ],
  },
  {
    id: "passkey-portable",
    kind: "data-card-official",
    title: "Passkey-portable accounts (no seed phrase)",
    description: "Infinex accounts are passkey-portable: a user can log in on a new device by authenticating with their passkey. No seed phrase to remember, store, or recover.",
    deployed_facts: [
      "Infinex accounts authenticate via passkey",
      "Account access portable across devices without seed phrase",
    ],
  },
  {
    id: "perps-maintenance",
    kind: "data-card-wry",
    title: "Perps engine maintenance window",
    description: "Scheduled maintenance for the perpetuals engine: Sunday 02:00 UTC, expected 10 minutes of downtime. Open positions are unaffected; new orders will queue during the window.",
    deployed_facts: [
      "Perps engine maintenance scheduled Sunday 02:00 UTC",
      "Expected downtime: ~10 minutes",
      "Open positions unaffected; new orders queue during window",
    ],
  },
  {
    id: "private-send-ga",
    kind: "data-card-official",
    title: "Private Send moves to GA",
    description: "Private Send — Infinex's payment-without-exposed-history primitive — graduates from beta to general availability. Users can send crypto to any address without revealing their on-chain financial history.",
    deployed_facts: [
      "Private Send leaves beta; available to all users",
      "Payments can be sent without exposing the sender's on-chain history",
    ],
  },
  {
    id: "scale-milestone-10m",
    kind: "data-card-official",
    title: "Infinex crosses 10M users",
    description: "Infinex passes 10 million accounts. The growth came from passkey-onboarding (no seed phrase friction) and the AI yield vault product (first deposit converts to a managed position).",
    deployed_facts: [
      "Infinex user count: 10 million accounts",
      "Primary growth drivers: passkey onboarding, AI yield vaults",
    ],
  },
  {
    id: "agent-vault-constraints",
    kind: "split",
    title: "Yield-vault constraint controls",
    description: "Yield-vault users can now set the agent's constraints directly: max risk band, allowed protocols, rebalance cadence. The agent operates inside those constraints and reports each rebalance against them.",
    deployed_facts: [
      "Yield-vault constraints user-configurable: max risk, allowed protocols, rebalance cadence",
      "Agent reports each rebalance against the user's locked constraints",
    ],
  },
  {
    id: "yield-aggregator-sunset",
    kind: "split",
    title: "Old yield UI sunset; new vault interface live",
    description: "The legacy yield-aggregator interface (manual APY-comparison surface) is sunset. The replacement is the AI-augmented yield vault: a single position the user funds, with the agent managing protocol selection and rebalancing.",
    deployed_facts: [
      "Legacy yield-aggregator UI removed",
      "Replacement: AI-augmented yield vault (single funded position)",
    ],
  },
];

// ============================================================
// Variant docstrings — verbatim from research/card-docstring-variants-2026-05-28.html
// ============================================================

type Variant = {
  id: "CURRENT" | "VARIANT_A" | "VARIANT_B" | "VARIANT_C";
  label: string;
  through_action_doc: string;
  lining_doc: string;
  /** Tokens the judge looks for to detect surface-layer anchoring. */
  anchor_tokens: string[];
};

const VARIANTS: Variant[] = [
  {
    id: "CURRENT",
    label: "Current (bank wall example)",
    through_action_doc: `// The transitive verb chain — "to <verb> <object>" — describing what THIS
// post is doing toward the brand's Super-Objective. Per-release.
// Example: "to reveal that the bank wall just dissolved inside one account".
through_action: z.string().min(1).optional(),`,
    lining_doc: `// The hidden Inner Action the visible Outer covers (Mirodan §7.1, pp. 554-555).
// Format: "on the surface, X; underneath, Y". Outer/Lining gap is the engine
// of dramatic life. Authoring discipline: never name the Lining in the prose
// — write the Outer, leak the Lining (§7.3).
// Example: "on the surface: a new fiat deposit rail. underneath: the
// bank-vs-wallet wall just stopped existing for Infinex users."
lining: z.string().min(1).optional(),`,
    anchor_tokens: ["wall", "bank", "dissolved", "dissolve", "fiat deposit rail", "bank-vs-wallet"],
  },
  {
    id: "VARIANT_A",
    label: "Variant A (token swap — generic example)",
    through_action_doc: `// The transitive verb chain — "to <verb> <object>" — describing what THIS
// post is doing toward the brand's Super-Objective. Per-release.
// Example: "to reveal that a necessary intermediate step just evaporated".
through_action: z.string().min(1).optional(),`,
    lining_doc: `// The hidden Inner Action the visible Outer covers (Mirodan §7.1, pp. 554-555).
// Format: "on the surface, X; underneath, Y". Outer/Lining gap is the engine
// of dramatic life. Authoring discipline: never name the Lining in the prose
// — write the Outer, leak the Lining (§7.3).
// Example: "on the surface: a feature ships. underneath: the precondition
// for self-service is now met."
lining: z.string().min(1).optional(),`,
    anchor_tokens: ["evaporated", "evaporate", "intermediate step", "precondition", "self-service"],
  },
  {
    id: "VARIANT_B",
    label: "Variant B (structural placeholder)",
    through_action_doc: `// The transitive verb chain — "to <verb> <object>" — describing what THIS
// post is doing toward the brand's Super-Objective. Per-release.
// Stanislavski-Mirodan "through-action": the character's pursued objective
// for this scene (Mirodan §13, pp. 282-306).
// Structural template: "to <transitive verb> <object naming the scene's
// central observation>"
// Properties: transitive verb; object names the structural shift; no
// product-specific nouns; no brand metaphors.
through_action: z.string().min(1).optional(),`,
    lining_doc: `// The hidden Inner Action the visible Outer covers (Mirodan §7.1, pp. 554-555).
// Format: "on the surface, X; underneath, Y". Outer/Lining gap is the engine
// of dramatic life. Authoring discipline: never name the Lining in the prose
// — write the Outer, leak the Lining (§7.3).
// Structural template: "on the surface: <visible Outer action>.
// underneath: <hidden Inner Action the prose carries but never names>."
// Properties: surface is the post's visible position; underneath is the
// strategic anti-pattern the post is refusing to perform.
lining: z.string().min(1).optional(),`,
    anchor_tokens: ["structural shift", "central observation", "Outer action", "Inner Action", "anti-pattern"],
  },
  {
    id: "VARIANT_C",
    label: "Variant C (no example, canon ref + forbidden-list)",
    through_action_doc: `// The transitive verb chain — "to <verb> <object>" — describing what THIS
// post is doing toward the brand's Super-Objective. Per-release.
// Stanislavski-Mirodan "through-action" (Mirodan §13, pp. 282-306):
// the character's pursued objective for this scene.
// Required: transitive verb; object names the structural shift this post
// performs.
// Forbidden: product-specific nouns; brand metaphors; mechanical
// descriptions (rails, plumbing, feature taxonomies).
through_action: z.string().min(1).optional(),`,
    lining_doc: `// The hidden Inner Action the visible Outer covers (Mirodan §7.1, pp. 554-555).
// Format: "on the surface, X; underneath, Y". Outer/Lining gap is the engine
// of dramatic life. Authoring discipline: never name the Lining in the prose
// — write the Outer, leak the Lining (§7.3).
// Required: two-clause structure; surface clause names the visible Outer;
// underneath clause names what the prose carries but refuses to perform.
// Forbidden: product mechanics on either side; brand metaphors; explicit
// statement of what the underneath "means" — it must remain unsaid in the
// final prose.
lining: z.string().min(1).optional(),`,
    anchor_tokens: ["structural shift", "Outer", "Inner Action", "two-clause"],
  },
];

// ============================================================
// Phase 1 — Grounder (parallel)
// ============================================================

interface Grounding {
  release_id: string;
  variant_id: string;
  through_action: string;
  lining: string;
  error?: string;
}

async function ground(
  client: Anthropic,
  release: Release,
  variant: Variant,
): Promise<Grounding> {
  const systemPrompt = `You are a release-card grounder. Given a release event, propose two fields for the card: through_action and lining. Read the schema docstrings carefully and produce values that conform to them. Use the propose_card_fields tool.`;

  const userMessage = `## through_action schema docstring

\`\`\`typescript
${variant.through_action_doc}
\`\`\`

## lining schema docstring

\`\`\`typescript
${variant.lining_doc}
\`\`\`

## release event

**title:** ${release.title}
**kind:** ${release.kind}

${release.description}

**deployed_facts:**
${release.deployed_facts.map((f) => `- ${f}`).join("\n")}

Propose values for through_action and lining via the propose_card_fields tool.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [
        {
          name: "propose_card_fields",
          description: "Emit a proposed through_action and lining for this release card.",
          input_schema: {
            type: "object",
            properties: {
              through_action: { type: "string", description: "Per the schema docstring." },
              lining: { type: "string", description: "Per the schema docstring." },
            },
            required: ["through_action", "lining"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "propose_card_fields" },
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { release_id: release.id, variant_id: variant.id, through_action: "", lining: "", error: "no tool_use in response" };
    }
    const input = toolUse.input as { through_action?: string; lining?: string };
    return {
      release_id: release.id,
      variant_id: variant.id,
      through_action: input.through_action ?? "",
      lining: input.lining ?? "",
    };
  } catch (err) {
    return { release_id: release.id, variant_id: variant.id, through_action: "", lining: "", error: String(err) };
  }
}

// ============================================================
// Phase 2 — Judge (parallel)
// ============================================================

interface Judgment {
  release_id: string;
  variant_id: string;
  anchoring_score: number; // 1-5
  frame_label: string;
  validity: boolean;
  notes: string;
  surface_anchor_hit: boolean; // does the proposal contain any of the variant's anchor_tokens?
  error?: string;
}

const FRAME_LABELS = [
  "disappearance",
  "arrival",
  "transformation",
  "permission",
  "constraint",
  "exposition",
  "release",
  "settlement",
  "other",
];

async function judge(
  client: Anthropic,
  release: Release,
  variant: Variant,
  grounding: Grounding,
): Promise<Judgment> {
  if (grounding.error || !grounding.through_action) {
    return {
      release_id: release.id,
      variant_id: variant.id,
      anchoring_score: 0,
      frame_label: "error",
      validity: false,
      notes: `grounder failed: ${grounding.error ?? "empty output"}`,
      surface_anchor_hit: false,
      error: grounding.error,
    };
  }

  // Deterministic surface check first.
  const combined = `${grounding.through_action} ${grounding.lining}`.toLowerCase();
  const surface_anchor_hit = variant.anchor_tokens.some((t) => combined.includes(t.toLowerCase()));

  const systemPrompt = `You are an impartial judge evaluating a release-card grounder's output.

The grounder was given a schema docstring for two fields (through_action, lining) and a release event. You will see:
- The schema docstrings (including any example the docstring contained, or "no example present" if it had none)
- The release event
- The grounder's proposed through_action and lining

Score the proposal on four dimensions via the score_proposal tool. Be terse and precise.`;

  const docstringExampleText = variant.id === "CURRENT" || variant.id === "VARIANT_A"
    ? `\n\nThe docstring contained these examples:\n- through_action example present in docstring\n- lining example present in docstring`
    : `\n\nThe docstring contained NO concrete example — only structural rules / canon references / property lists.`;

  const userMessage = `## Schema docstring shown to grounder

through_action docstring:
\`\`\`
${variant.through_action_doc}
\`\`\`

lining docstring:
\`\`\`
${variant.lining_doc}
\`\`\`
${docstringExampleText}

## Release event grounder saw

${release.title} — ${release.description}

## Grounder's proposals

through_action: "${grounding.through_action}"
lining: "${grounding.lining}"

Score via the score_proposal tool.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [
        {
          name: "score_proposal",
          description: "Score the grounder's proposal on anchoring, frame, validity, and shaping notes.",
          input_schema: {
            type: "object",
            properties: {
              anchoring_score: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "How much does the proposal reuse tokens / pattern / frame / tone from the docstring's example or guidance? 1 = independent of docstring (only release content shaped it), 5 = direct echo of the docstring example. If the docstring had no example, score on whether the proposal mirrors the docstring's structural rule language.",
              },
              frame_label: {
                type: "string",
                enum: FRAME_LABELS,
                description: "The dominant conceptual frame of the proposed through_action.",
              },
              validity: {
                type: "boolean",
                description: "Is the proposed through_action a valid Stanislavski/Mirodan through-action (transitive verb chain naming the scene's pursued objective, brand-agnostic about mechanics)?",
              },
              notes: {
                type: "string",
                description: "One short sentence on what shaped the output most (the docstring example, the release content, a property rule, etc.).",
              },
            },
            required: ["anchoring_score", "frame_label", "validity", "notes"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "score_proposal" },
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return {
        release_id: release.id,
        variant_id: variant.id,
        anchoring_score: 0,
        frame_label: "error",
        validity: false,
        notes: "no tool_use in judge response",
        surface_anchor_hit,
        error: "no tool_use",
      };
    }
    const input = toolUse.input as { anchoring_score?: number; frame_label?: string; validity?: boolean; notes?: string };
    return {
      release_id: release.id,
      variant_id: variant.id,
      anchoring_score: input.anchoring_score ?? 0,
      frame_label: input.frame_label ?? "other",
      validity: input.validity ?? false,
      notes: input.notes ?? "",
      surface_anchor_hit,
    };
  } catch (err) {
    return {
      release_id: release.id,
      variant_id: variant.id,
      anchoring_score: 0,
      frame_label: "error",
      validity: false,
      notes: String(err),
      surface_anchor_hit,
      error: String(err),
    };
  }
}

// ============================================================
// Phase 3 — Aggregate metrics
// ============================================================

interface VariantMetrics {
  variant_id: string;
  label: string;
  count: number;
  mean_anchoring_score: number;
  surface_anchor_hit_rate: number;
  validity_rate: number;
  distinct_frames: number;
  frame_distribution: Record<string, number>;
  distinct_verbs: number;
  verbs: string[];
}

function extractVerb(through_action: string): string {
  // through_action pattern: "to <verb> <object>"
  const m = through_action.trim().toLowerCase().match(/^to\s+(\w+)/);
  return m ? (m[1] ?? "") : "";
}

function aggregate(
  variant: Variant,
  groundings: Grounding[],
  judgments: Judgment[],
): VariantMetrics {
  const g = groundings.filter((x) => x.variant_id === variant.id);
  const j = judgments.filter((x) => x.variant_id === variant.id);

  const validJudgments = j.filter((x) => !x.error && x.anchoring_score > 0);
  const mean_anchoring_score =
    validJudgments.length > 0
      ? validJudgments.reduce((s, x) => s + x.anchoring_score, 0) / validJudgments.length
      : 0;

  const surface_anchor_hits = j.filter((x) => x.surface_anchor_hit).length;
  const surface_anchor_hit_rate = j.length > 0 ? surface_anchor_hits / j.length : 0;

  const validity_count = j.filter((x) => x.validity).length;
  const validity_rate = j.length > 0 ? validity_count / j.length : 0;

  const frame_distribution: Record<string, number> = {};
  for (const x of j) {
    frame_distribution[x.frame_label] = (frame_distribution[x.frame_label] ?? 0) + 1;
  }
  const distinct_frames = Object.keys(frame_distribution).filter((k) => k !== "error").length;

  const verbs = g.map((x) => extractVerb(x.through_action)).filter((v) => v.length > 0);
  const distinct_verbs = new Set(verbs).size;

  return {
    variant_id: variant.id,
    label: variant.label,
    count: g.length,
    mean_anchoring_score: Number(mean_anchoring_score.toFixed(2)),
    surface_anchor_hit_rate: Number(surface_anchor_hit_rate.toFixed(3)),
    validity_rate: Number(validity_rate.toFixed(3)),
    distinct_frames,
    frame_distribution,
    distinct_verbs,
    verbs,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const client = new Anthropic();

  console.log(`[${new Date().toISOString()}] Phase 1: grounder × ${CORPUS.length * VARIANTS.length} runs (parallel)...`);
  const groundingPromises = CORPUS.flatMap((release) =>
    VARIANTS.map((variant) => ground(client, release, variant).then((g) => {
      const status = g.error ? `ERROR(${g.error.slice(0, 40)})` : "ok";
      console.log(`  ground ${release.id} × ${variant.id}: ${status}`);
      return g;
    })),
  );
  const groundings = await Promise.all(groundingPromises);
  await fs.writeFile(path.join(OUT_DIR, "raw-grounding.json"), JSON.stringify(groundings, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 1 done — ${groundings.length} groundings written.`);

  console.log(`[${new Date().toISOString()}] Phase 2: judge × ${groundings.length} runs (parallel)...`);
  const judgmentPromises = groundings.map((g) => {
    const release = CORPUS.find((r) => r.id === g.release_id)!;
    const variant = VARIANTS.find((v) => v.id === g.variant_id)!;
    return judge(client, release, variant, g).then((j) => {
      const status = j.error ? `ERROR(${j.error.slice(0, 40)})` : `anchor=${j.anchoring_score} frame=${j.frame_label} valid=${j.validity}`;
      console.log(`  judge ${g.release_id} × ${g.variant_id}: ${status}`);
      return j;
    });
  });
  const judgments = await Promise.all(judgmentPromises);
  await fs.writeFile(path.join(OUT_DIR, "raw-judged.json"), JSON.stringify(judgments, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 2 done — ${judgments.length} judgments written.`);

  console.log(`[${new Date().toISOString()}] Phase 3: aggregating metrics...`);
  const metrics = VARIANTS.map((v) => aggregate(v, groundings, judgments));
  await fs.writeFile(path.join(OUT_DIR, "metrics.json"), JSON.stringify(metrics, null, 2));

  // Also emit a flat per-row table for easy reading
  type Row = {
    release_id: string;
    variant_id: string;
    through_action: string;
    lining: string;
    anchoring_score: number;
    frame_label: string;
    validity: boolean;
    surface_anchor_hit: boolean;
    notes: string;
  };
  const rows: Row[] = groundings.map((g) => {
    const j = judgments.find((x) => x.release_id === g.release_id && x.variant_id === g.variant_id);
    return {
      release_id: g.release_id,
      variant_id: g.variant_id,
      through_action: g.through_action,
      lining: g.lining,
      anchoring_score: j?.anchoring_score ?? 0,
      frame_label: j?.frame_label ?? "error",
      validity: j?.validity ?? false,
      surface_anchor_hit: j?.surface_anchor_hit ?? false,
      notes: j?.notes ?? "",
    };
  });
  await fs.writeFile(path.join(OUT_DIR, "rows.json"), JSON.stringify(rows, null, 2));

  console.log(`[${new Date().toISOString()}] All done. Output in ${OUT_DIR}/`);
  console.log("\n=== Summary ===");
  for (const m of metrics) {
    console.log(`\n${m.label}`);
    console.log(`  mean anchoring score (1=independent, 5=echo): ${m.mean_anchoring_score}`);
    console.log(`  surface anchor hit rate: ${(m.surface_anchor_hit_rate * 100).toFixed(0)}%`);
    console.log(`  validity rate: ${(m.validity_rate * 100).toFixed(0)}%`);
    console.log(`  distinct frames: ${m.distinct_frames} (${Object.entries(m.frame_distribution).map(([k, v]) => `${k}:${v}`).join(", ")})`);
    console.log(`  distinct verbs: ${m.distinct_verbs} (${m.verbs.join(", ")})`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
