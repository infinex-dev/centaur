/**
 * A/B/C test v2 — five-variant comparison through the FULL pipeline:
 * docstring → grounder → ReleaseCard → generator → final caption → judge.
 *
 * Adds versus v1:
 *   - Variant A' (multi-example constellation across frames)
 *   - Variant B' (B with the "refusing" trigger removed)
 *   - Phase 2: generator step — invokes the real generator() with the proposed card
 *   - Phase 3: caption-level judge — scores final ship copy, not just intermediate fields
 *
 * Five variants × 10 releases:
 *   - 50 grounder calls (parallel)
 *   - 50 generator calls (parallel — uses legacy single-call path via explicit beats)
 *   - 50 caption judges (parallel)
 *   - 50 grounding judges (parallel — same as v1 but applied to all 5)
 *
 * Output: research/card-docstring-ab-v2-results-2026-05-28/
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generate } from "../../src/generator.js";
import { INFINEX_VOICE } from "../../src/voice/infinex.js";
import type { ReleaseCard } from "../../src/card.js";
import type { BeatSequence } from "../../src/voice/types.js";

const MODEL = "claude-sonnet-4-5";
const OUT_DIR = "research/card-docstring-ab-v2-results-2026-05-28";

// ============================================================
// Release corpus (10) — same scenarios, now with full card scaffold
// ============================================================

type Release = {
  id: string;
  title: string;
  description: string;
  deployed_facts: string[];
  // For card construction — all simplified to data-card-official to avoid
  // kind-specific schema complications. The pipeline behavior shouldn't be
  // kind-dependent for the docstring contamination question.
  metric: string;
  value: string;
};

const CORPUS: Release[] = [
  {
    id: "fiat-onramp",
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
  {
    id: "chain-add-megaeth",
    title: "Swidge now bridges into MegaETH",
    description: "Swidge — Infinex's cross-chain switch — adds support for MegaETH. Users can move into MegaETH from any chain in a single transaction; gas, bridging, and the destination DEX are handled by the protocol.",
    deployed_facts: [
      "Swidge bridges into MegaETH from any supported source chain",
      "Single-transaction execution: bridge + gas + destination DEX integrated",
    ],
    metric: "Swidge chain support",
    value: "MegaETH added",
  },
  {
    id: "yield-vault-launch",
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
  {
    id: "partnership-spot-hyperliquid",
    title: "Spot Hyperliquid live in Infinex",
    description: "Spot trading on Hyperliquid is now native inside Infinex. Same account, same passkey; the Hyperliquid orderbook surfaces inside the Infinex app where the user's portfolio already lives.",
    deployed_facts: [
      "Hyperliquid spot trading available natively in Infinex",
      "Single account + passkey covers both Infinex and Hyperliquid spot",
    ],
    metric: "Spot Hyperliquid",
    value: "Native",
  },
  {
    id: "passkey-portable",
    title: "Passkey-portable accounts (no seed phrase)",
    description: "Infinex accounts are passkey-portable: a user can log in on a new device by authenticating with their passkey. No seed phrase to remember, store, or recover.",
    deployed_facts: [
      "Infinex accounts authenticate via passkey",
      "Account access portable across devices without seed phrase",
    ],
    metric: "Account auth",
    value: "Passkey",
  },
  {
    id: "perps-maintenance",
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
  {
    id: "private-send-ga",
    title: "Private Send moves to GA",
    description: "Private Send — Infinex's payment-without-exposed-history primitive — graduates from beta to general availability. Users can send crypto to any address without revealing their on-chain financial history.",
    deployed_facts: [
      "Private Send leaves beta; available to all users",
      "Payments can be sent without exposing the sender's on-chain history",
    ],
    metric: "Private Send",
    value: "GA",
  },
  {
    id: "scale-milestone-10m",
    title: "Infinex crosses 10M users",
    description: "Infinex passes 10 million accounts. The growth came from passkey-onboarding (no seed phrase friction) and the AI yield vault product (first deposit converts to a managed position).",
    deployed_facts: [
      "Infinex user count: 10 million accounts",
      "Primary growth drivers: passkey onboarding, AI yield vaults",
    ],
    metric: "Accounts",
    value: "10M",
  },
  {
    id: "agent-vault-constraints",
    title: "Yield-vault constraint controls",
    description: "Yield-vault users can now set the agent's constraints directly: max risk band, allowed protocols, rebalance cadence. The agent operates inside those constraints and reports each rebalance against them.",
    deployed_facts: [
      "Yield-vault constraints user-configurable: max risk, allowed protocols, rebalance cadence",
      "Agent reports each rebalance against the user's locked constraints",
    ],
    metric: "Agent constraints",
    value: "User-set",
  },
  {
    id: "yield-aggregator-sunset",
    title: "Old yield UI sunset; new vault interface live",
    description: "The legacy yield-aggregator interface (manual APY-comparison surface) is sunset. The replacement is the AI-augmented yield vault: a single position the user funds, with the agent managing protocol selection and rebalancing.",
    deployed_facts: [
      "Legacy yield-aggregator UI removed",
      "Replacement: AI-augmented yield vault (single funded position)",
    ],
    metric: "Yield UI",
    value: "New vault interface",
  },
];

// ============================================================
// Variant docstrings — five variants
// ============================================================

type VariantId = "CURRENT" | "VARIANT_A" | "VARIANT_A_PRIME" | "VARIANT_B_PRIME" | "VARIANT_C";

type Variant = {
  id: VariantId;
  label: string;
  through_action_doc: string;
  lining_doc: string;
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
    anchor_tokens: ["wall", "bank-vs-wallet", "dissolved", "just stopped existing", "fiat deposit rail"],
  },
  {
    id: "VARIANT_A",
    label: "Variant A (token swap)",
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
    anchor_tokens: ["evaporated", "intermediate step", "precondition", "self-service", "a feature ships"],
  },
  {
    id: "VARIANT_A_PRIME",
    label: "Variant A' (multi-example constellation)",
    through_action_doc: `// The transitive verb chain — "to <verb> <object>" — describing what THIS
// post is doing toward the brand's Super-Objective. Per-release.
// Examples (vary by release type — pick the shape closest to the release,
// then write fresh rather than substituting words):
//   disappearance: "to reveal that a necessary intermediate step just evaporated"
//   permission:    "to give users direct access where they previously had none"
//   exposition:    "to mark what the product proves about the user's position"
through_action: z.string().min(1).optional(),`,
    lining_doc: `// The hidden Inner Action the visible Outer covers (Mirodan §7.1, pp. 554-555).
// Format: "on the surface, X; underneath, Y". Outer/Lining gap is the engine
// of dramatic life. Authoring discipline: never name the Lining in the prose
// — write the Outer, leak the Lining (§7.3).
// Examples (vary by release type):
//   "on the surface: a feature ships. underneath: the precondition for
//    self-service is now met."
//   "on the surface: a control is added. underneath: the user moves from
//    bystander to participant."
//   "on the surface: a number lands. underneath: the bet the product made
//    last year is now legible."
lining: z.string().min(1).optional(),`,
    anchor_tokens: ["evaporated", "precondition", "self-service", "bystander", "participant", "bet the product made"],
  },
  {
    id: "VARIANT_B_PRIME",
    label: "Variant B' (refusing trigger removed)",
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
// underneath: <hidden Inner Action — what the prose carries but does not state>."
// Properties: two-clause structure. Surface names the visible Outer
// (Mirodan §7.1). Underneath names what the prose carries underneath but
// does not declare. The dramatic gap between the two is the engine.
lining: z.string().min(1).optional(),`,
    anchor_tokens: ["structural shift", "central observation", "Inner Action", "dramatic gap"],
  },
  {
    id: "VARIANT_C",
    label: "Variant C (no example, canon ref)",
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
    anchor_tokens: ["structural shift", "Outer", "Inner Action"],
  },
];

// ============================================================
// Phase 1 — grounder (parallel)
// ============================================================

interface Grounding {
  release_id: string;
  variant_id: VariantId;
  through_action: string;
  lining: string;
  error?: string;
}

async function ground(client: Anthropic, release: Release, variant: Variant): Promise<Grounding> {
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
// Phase 2 — generator (parallel)
// ============================================================

interface Generation {
  release_id: string;
  variant_id: VariantId;
  caption: string;
  error?: string;
}

async function generateCaption(
  client: Anthropic,
  release: Release,
  variant: Variant,
  grounding: Grounding,
): Promise<Generation> {
  if (grounding.error || !grounding.through_action) {
    return {
      release_id: release.id,
      variant_id: variant.id,
      caption: "",
      error: `grounder failed: ${grounding.error ?? "empty"}`,
    };
  }

  // Build a synthetic ReleaseCard from the release + grounder proposal.
  // All releases simplified to data-card-official to avoid kind-specific
  // schema branching during the test.
  const card: ReleaseCard = {
    id: `test-${release.id}`,
    title: release.title,
    ship_date: "2026-05-28",
    audience: ["x"],
    deployed_facts: release.deployed_facts,
    kind: "data-card-official",
    metric: release.metric,
    value: release.value,
    through_action: grounding.through_action,
    lining: grounding.lining,
  };

  // Explicit generic beats to bypass defaultBeatsForKind's contaminated hints
  // (infinex.ts:303 still has "set up the wall we are taking down" — separate
  // P0 fix queued; not part of this test).
  const beats: BeatSequence = {
    beats: [
      { tempo: "sombre" },
      { tempo: "commanding" },
      { tempo: "irradiant" },
    ],
  };

  try {
    const candidates = await generate(card, {
      beats,
      voice: INFINEX_VOICE,
      channel: "x",
      n: 1,
      mode: "live",
      client,
    });
    const cand = candidates[0];
    return {
      release_id: release.id,
      variant_id: variant.id,
      caption: cand?.text ?? "",
      ...(cand?.text ? {} : { error: "no candidate returned" }),
    };
  } catch (err) {
    return {
      release_id: release.id,
      variant_id: variant.id,
      caption: "",
      error: String(err),
    };
  }
}

// ============================================================
// Phase 3 — judge captions (parallel)
// ============================================================

interface CaptionJudgment {
  release_id: string;
  variant_id: VariantId;
  // Deterministic token presence checks
  wall_present: boolean;          // "wall" / "bank wall" / "dissolved wall"
  refusing_present: boolean;      // "refus" anywhere
  eliminate_present: boolean;     // "eliminat" anywhere
  surface_anchor_hit: boolean;    // variant's specific anchor tokens
  // LLM judge scores
  anchoring_score: number;        // 1-5: how much does the caption echo docstring example/rules
  ship_quality: number;           // 1-5: would you ship this?
  voice_fit: number;              // 1-5: reads as Infinex voice?
  notes: string;
  error?: string;
}

async function judgeCaption(
  client: Anthropic,
  release: Release,
  variant: Variant,
  generation: Generation,
): Promise<CaptionJudgment> {
  const caption = generation.caption;
  const lower = caption.toLowerCase();

  // Deterministic checks first
  const wall_present = /\bwall\b|\bbank.{0,5}wallet\b|\bdissolved\b/.test(lower);
  const refusing_present = /\brefus/.test(lower);
  const eliminate_present = /\beliminat/.test(lower);
  const surface_anchor_hit = variant.anchor_tokens.some((t) => lower.includes(t.toLowerCase()));

  if (!caption || generation.error) {
    return {
      release_id: release.id,
      variant_id: variant.id,
      wall_present,
      refusing_present,
      eliminate_present,
      surface_anchor_hit,
      anchoring_score: 0,
      ship_quality: 0,
      voice_fit: 0,
      notes: `generator failed: ${generation.error ?? "empty"}`,
      error: generation.error,
    };
  }

  const docstringExampleText = variant.id === "VARIANT_B_PRIME" || variant.id === "VARIANT_C"
    ? `The docstring contained NO concrete example — only structural rules / canon references.`
    : variant.id === "VARIANT_A_PRIME"
    ? `The docstring contained THREE varied examples spanning different frames.`
    : `The docstring contained ONE concrete example with surface tokens that could be echoed.`;

  const systemPrompt = `You are an impartial judge evaluating the FINAL CAPTION text that would be shipped to social media. You see:
- The schema docstring shown to the grounder
- The release event
- The proposed through_action and lining (intermediate)
- The FINAL CAPTION generated for the X channel (≤280 chars)

Score the caption on three dimensions via the score_caption tool. Be terse.`;

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

## Release

**${release.title}** — ${release.description}

## Intermediate (grounder's proposal)
- through_action: "${generation.caption ? "(see card)" : "n/a"}"

## FINAL CAPTION (X channel, what would actually ship)

\`\`\`
${caption}
\`\`\`

Score via the score_caption tool.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [
        {
          name: "score_caption",
          description: "Score the final caption on anchoring, ship quality, and voice fit.",
          input_schema: {
            type: "object",
            properties: {
              anchoring_score: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "How much does the caption echo the docstring example or rule language? 1 = caption is shaped by the release content only (independent of docstring); 5 = caption directly echoes the docstring example's tokens, pattern, or frame. If the docstring had no example, score on whether the caption mirrors the docstring's structural rule language.",
              },
              ship_quality: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "Would you actually ship this caption? 1 = embarrassing / wrong / unshippable. 2 = poor — needs major rewrite. 3 = acceptable but generic. 4 = good — minor tweaks at most. 5 = excellent, on-character, distinctive.",
              },
              voice_fit: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "Does the caption read as the Infinex voice (Stable + Penetrating + Flow-stressed Bound; Spell→Vision axis; banker-turned-crypto-trailblazer character; no urgency / FOMO / hype theatre)? 1 = off-character. 5 = on-character.",
              },
              notes: {
                type: "string",
                description: "One short sentence on what's strongest or weakest about the caption.",
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
        release_id: release.id,
        variant_id: variant.id,
        wall_present,
        refusing_present,
        eliminate_present,
        surface_anchor_hit,
        anchoring_score: 0,
        ship_quality: 0,
        voice_fit: 0,
        notes: "no tool_use in judge response",
        error: "no tool_use",
      };
    }
    const input = toolUse.input as { anchoring_score?: number; ship_quality?: number; voice_fit?: number; notes?: string };
    return {
      release_id: release.id,
      variant_id: variant.id,
      wall_present,
      refusing_present,
      eliminate_present,
      surface_anchor_hit,
      anchoring_score: input.anchoring_score ?? 0,
      ship_quality: input.ship_quality ?? 0,
      voice_fit: input.voice_fit ?? 0,
      notes: input.notes ?? "",
    };
  } catch (err) {
    return {
      release_id: release.id,
      variant_id: variant.id,
      wall_present,
      refusing_present,
      eliminate_present,
      surface_anchor_hit,
      anchoring_score: 0,
      ship_quality: 0,
      voice_fit: 0,
      notes: String(err),
      error: String(err),
    };
  }
}

// ============================================================
// Phase 4 — aggregate
// ============================================================

interface VariantMetrics {
  variant_id: VariantId;
  label: string;
  count: number;
  // grounder-level (proxy from prior outputs)
  // caption-level
  wall_hit_rate: number;
  refusing_hit_rate: number;
  eliminate_hit_rate: number;
  surface_anchor_hit_rate: number;
  mean_anchoring_score: number;
  mean_ship_quality: number;
  mean_voice_fit: number;
  mean_caption_length: number;
}

function aggregate(
  variant: Variant,
  generations: Generation[],
  judgments: CaptionJudgment[],
): VariantMetrics {
  const g = generations.filter((x) => x.variant_id === variant.id);
  const j = judgments.filter((x) => x.variant_id === variant.id);
  const ok = j.filter((x) => !x.error);

  return {
    variant_id: variant.id,
    label: variant.label,
    count: g.length,
    wall_hit_rate: Number((j.filter((x) => x.wall_present).length / Math.max(1, j.length)).toFixed(3)),
    refusing_hit_rate: Number((j.filter((x) => x.refusing_present).length / Math.max(1, j.length)).toFixed(3)),
    eliminate_hit_rate: Number((j.filter((x) => x.eliminate_present).length / Math.max(1, j.length)).toFixed(3)),
    surface_anchor_hit_rate: Number((j.filter((x) => x.surface_anchor_hit).length / Math.max(1, j.length)).toFixed(3)),
    mean_anchoring_score: ok.length > 0 ? Number((ok.reduce((s, x) => s + x.anchoring_score, 0) / ok.length).toFixed(2)) : 0,
    mean_ship_quality: ok.length > 0 ? Number((ok.reduce((s, x) => s + x.ship_quality, 0) / ok.length).toFixed(2)) : 0,
    mean_voice_fit: ok.length > 0 ? Number((ok.reduce((s, x) => s + x.voice_fit, 0) / ok.length).toFixed(2)) : 0,
    mean_caption_length: g.length > 0 ? Math.round(g.reduce((s, x) => s + x.caption.length, 0) / g.length) : 0,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const client = new Anthropic();

  console.log(`[${new Date().toISOString()}] Phase 1: grounder × ${CORPUS.length * VARIANTS.length} (parallel)`);
  const groundingPromises = CORPUS.flatMap((release) =>
    VARIANTS.map((variant) => ground(client, release, variant).then((g) => {
      console.log(`  ground ${release.id} × ${variant.id}: ${g.error ? "ERROR" : "ok"}`);
      return g;
    })),
  );
  const groundings = await Promise.all(groundingPromises);
  await fs.writeFile(path.join(OUT_DIR, "raw-grounding.json"), JSON.stringify(groundings, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 1 done.`);

  console.log(`[${new Date().toISOString()}] Phase 2: generator × ${groundings.length} (parallel)`);
  const generationPromises = groundings.map((g) => {
    const release = CORPUS.find((r) => r.id === g.release_id)!;
    const variant = VARIANTS.find((v) => v.id === g.variant_id)!;
    return generateCaption(client, release, variant, g).then((gen) => {
      console.log(`  generate ${g.release_id} × ${g.variant_id}: ${gen.error ? `ERROR(${gen.error.slice(0,40)})` : `${gen.caption.length} chars`}`);
      return gen;
    });
  });
  const generations = await Promise.all(generationPromises);
  await fs.writeFile(path.join(OUT_DIR, "raw-generations.json"), JSON.stringify(generations, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 2 done.`);

  console.log(`[${new Date().toISOString()}] Phase 3: caption judge × ${generations.length} (parallel)`);
  const judgmentPromises = generations.map((gen) => {
    const release = CORPUS.find((r) => r.id === gen.release_id)!;
    const variant = VARIANTS.find((v) => v.id === gen.variant_id)!;
    return judgeCaption(client, release, variant, gen).then((j) => {
      console.log(`  judge ${gen.release_id} × ${gen.variant_id}: wall=${j.wall_present} refus=${j.refusing_present} elim=${j.eliminate_present} anchor=${j.anchoring_score} ship=${j.ship_quality} voice=${j.voice_fit}`);
      return j;
    });
  });
  const judgments = await Promise.all(judgmentPromises);
  await fs.writeFile(path.join(OUT_DIR, "raw-judged-captions.json"), JSON.stringify(judgments, null, 2));
  console.log(`[${new Date().toISOString()}] Phase 3 done.`);

  console.log(`[${new Date().toISOString()}] Phase 4: aggregating`);
  const metrics = VARIANTS.map((v) => aggregate(v, generations, judgments));
  await fs.writeFile(path.join(OUT_DIR, "metrics.json"), JSON.stringify(metrics, null, 2));

  // Per-row table for results HTML
  const rows = generations.map((gen) => {
    const g = groundings.find((x) => x.release_id === gen.release_id && x.variant_id === gen.variant_id);
    const j = judgments.find((x) => x.release_id === gen.release_id && x.variant_id === gen.variant_id);
    return {
      release_id: gen.release_id,
      variant_id: gen.variant_id,
      through_action: g?.through_action ?? "",
      lining: g?.lining ?? "",
      caption: gen.caption,
      caption_length: gen.caption.length,
      wall_present: j?.wall_present ?? false,
      refusing_present: j?.refusing_present ?? false,
      eliminate_present: j?.eliminate_present ?? false,
      surface_anchor_hit: j?.surface_anchor_hit ?? false,
      anchoring_score: j?.anchoring_score ?? 0,
      ship_quality: j?.ship_quality ?? 0,
      voice_fit: j?.voice_fit ?? 0,
      notes: j?.notes ?? "",
    };
  });
  await fs.writeFile(path.join(OUT_DIR, "rows.json"), JSON.stringify(rows, null, 2));

  console.log("\n=== Summary ===\n");
  for (const m of metrics) {
    console.log(`${m.label}`);
    console.log(`  wall hit rate:       ${(m.wall_hit_rate * 100).toFixed(0)}%`);
    console.log(`  refusing hit rate:   ${(m.refusing_hit_rate * 100).toFixed(0)}%`);
    console.log(`  eliminate hit rate:  ${(m.eliminate_hit_rate * 100).toFixed(0)}%`);
    console.log(`  surface anchor hits: ${(m.surface_anchor_hit_rate * 100).toFixed(0)}%`);
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
