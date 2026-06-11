import { z } from "zod";

/**
 * Release card schema.
 *
 * A release card is the structured input to the comms pipeline.
 * Something ships -> a release card is emitted -> generator produces caption
 * candidates -> validator gates them -> orchestrator picks per-channel -> renderer
 * builds video -> ship gate posts.
 *
 * Mirrors Nigel's card pattern: deployed_facts are the load-bearing claims that
 * downstream stages (generator prompts, validator audits) must respect. Anything
 * NOT in deployed_facts cannot be asserted by the caption.
 *
 * Template families come from research/visual-vocabulary.md §03:
 *   - data-card-official: live product moment as protagonist, sober register
 *   - data-card-wry:      same chrome, in-on-the-joke caption
 *   - launch-tier:        reserved, ~4x/year, scarcity-signaled
 *   - split:              semantic two-color split (bridge from/to, in/out, etc.)
 */

// "carousel" is RETIRED (2026-06-11): its in-app surface (appAlert / What's-New
// dialog) is formally deprecated platform-side (docs/content-pipeline.md) and
// renders nowhere. Kept in the enum so historical cards still parse; the
// harness no longer offers it and the card-builder prompt excludes it.
const Audience = z.enum(["web", "x", "x-thread", "telegram", "in-product", "modal", "blog", "carousel", "email", "press", "internal"]);
export type Audience = z.infer<typeof Audience>;

// A deployed fact may be a bare string (the common case) OR an object that
// carries the BASIS of a derived/editorial number. "24 markets" is really
// "the markets above $100k 24h volume; total market count is higher" — the bare
// count leaked into copy as truth. When a fact is an editorial cut, the grounder
// records the basis/scope so the generator (and Director) can see the number is
// not raw. Kept lean: claim + optional basis/scope only — not a metadata framework.
export const DeployedFactObject = z.object({
  claim: z.string().min(1),
  basis: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
});
export type DeployedFactObject = z.infer<typeof DeployedFactObject>;

export const DeployedFact = z.union([z.string().min(1), DeployedFactObject]);
export type DeployedFact = z.infer<typeof DeployedFact>;

// Per-referenced-feature state at ship time. The unified account ships WITH
// spot, so copy must not assume the reader already has it. changing-at-ship
// features must be treated as unfamiliar to the reader, not as established.
export const FeatureState = z.object({
  feature: z.string().min(1),
  state: z.enum(["new", "existing", "changing-at-ship"]),
  note: z.string().min(1).optional(),
});
export type FeatureState = z.infer<typeof FeatureState>;

const Base = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  ship_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ship_date must be YYYY-MM-DD"),
  audience: z.array(Audience).min(1),

  // Editorial category, orthogonal to `kind` (kind selects the visual template
  // family; category selects the editorial genus). Known values: "changelog"
  // (default behavior when absent — blog changelog scaffold + format gate) and
  // "thesis" (long-form positioning essay: no CTA anywhere, essay-length blog,
  // ships to X as an article). Free string so the genus set stays open;
  // consumers treat unknown values as the default genus.
  category: z.string().min(1).optional(),
  deployed_facts: z
    .array(DeployedFact)
    .min(1, "at least one deployed_fact required — caption can only assert what's listed here"),
  product_page_url: z.string().url().optional(),
  timestamp: z.string().datetime().optional(),

  // The outward-facing product name. "Spot V1" / "Hyperliquid Spot V1" is
  // internal-changelog register — version tags must not appear in outward
  // channels (x, x-thread, web, carousel). The Director and validator enforce
  // this; the card supplies the name copy should actually use.
  outward_product_name: z.string().min(1).optional(),

  // Per-referenced-feature state at ship. Lets the Actor know which features
  // are new/changing (unfamiliar to the reader) vs already-established.
  feature_states: z.array(FeatureState).optional(),

  // -- Inner-work layer (Mirodan / Stanislavski inheritance) -----------------
  // These fields encode the dramaturgical intake that precedes drafting. They
  // guide INTERPRETATION; they are not assertable claims. Only deployed_facts
  // can be asserted in the post text. The inner-work fields tell the generator
  // what the moment means, what the reader expects, what the post is trying
  // to land against, and what the surface is covering underneath.
  //
  // Optional during pilot; promote to required once the grounder reliably
  // proposes them and the operator workflow is settled.

  // The transitive verb chain — "to <verb> <object>" — describing what THIS
  // post is doing toward the brand's Super-Objective. Per-release.
  // Stanislavski-Mirodan "through-action" (Mirodan §13, pp. 282-306):
  // the character's pursued objective for this scene.
  // Required: transitive verb; object names the structural shift this post
  // performs.
  // Forbidden: product-specific nouns; brand metaphors; mechanical
  // descriptions (rails, plumbing, feature taxonomies).
  through_action: z.string().min(1).optional(),

  // What stops the through-action from landing. Usually a reader-side prior,
  // a genre default, or a competitor framing. The post should land AGAINST it.
  // Example: "reader expects another fintech partnership announcement and
  // will skim if framed as rails".
  obstacle: z.string().min(1).optional(),

  // The hidden Inner Action the visible Outer covers (Mirodan §7.1, pp. 554-555).
  // Format: "on the surface, X; underneath, Y". Outer/Lining gap is the engine
  // of dramatic life. Authoring discipline: never name the Lining in the prose
  // — write the Outer, leak the Lining (§7.3).
  // Required: two-clause structure; surface clause names the visible Outer;
  // underneath clause names what the prose carries but refuses to perform.
  // Forbidden: product mechanics on either side; brand metaphors; explicit
  // statement of what the underneath "means" — it must remain unsaid in the
  // final prose.
  lining: z.string().min(1).optional(),

  // The default belief / genre expectation the reader brings. Aligned with
  // obstacle but specifically about the reader's prior state. NOT a deployed
  // fact — never asserted, only landed against.
  reader_prior: z.string().min(1).optional(),

  // The boring/mechanical framing the post must AVOID. The "if we said only
  // this, we would be re-publishing the changelog." Useful as a negative
  // anchor for the generator.
  not_the_point: z.string().min(1).optional(),
});

export const DataCardOfficial = Base.extend({
  kind: z.literal("data-card-official"),
  metric: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  delta: z.string().optional(),
});

export const DataCardWry = Base.extend({
  kind: z.literal("data-card-wry"),
  metric: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  joke_angle: z.string().min(1).describe("seed for the wry register — generator riffs on this"),
});

export const LaunchTier = Base.extend({
  kind: z.literal("launch-tier"),
  headline: z.string().min(1),
  subhead: z.string().optional(),
  tier_reason: z
    .string()
    .min(1)
    .describe("why this earns the reserved template (used ~4x/year)"),
});

export const Split = Base.extend({
  kind: z.literal("split"),
  from: z.string().min(1),
  to: z.string().min(1),
  split_semantics: z
    .string()
    .min(1)
    .describe("bridge | swap | principal-yield | spot-perp | in-out | on-off-chain"),
});

export const ReleaseCardSchema = z.discriminatedUnion("kind", [
  DataCardOfficial,
  DataCardWry,
  LaunchTier,
  Split,
]);

export type ReleaseCard = z.infer<typeof ReleaseCardSchema>;

export const ReleaseCardKind = z.enum([
  "data-card-official",
  "data-card-wry",
  "launch-tier",
  "split",
]);
export type ReleaseCardKind = z.infer<typeof ReleaseCardKind>;

/** The bare claim string for a deployed fact (string facts pass through). */
export function deployedFactClaim(fact: DeployedFact): string {
  return typeof fact === "string" ? fact : fact.claim;
}

/** All deployed-fact claim strings — the backward-compatible string[] view. */
export function deployedFactClaims(card: { deployed_facts: DeployedFact[] }): string[] {
  return card.deployed_facts.map(deployedFactClaim);
}

/**
 * Human-readable rendering of a deployed fact that surfaces its basis/scope, so
 * the generator and Director can see a derived number is an editorial cut, not
 * a raw count. "24 markets" -> "24 markets (basis: markets >$100k 24h vol; scope: total is higher)".
 */
export function deployedFactLine(fact: DeployedFact): string {
  if (typeof fact === "string") return fact;
  const qualifiers = [
    fact.basis ? `basis: ${fact.basis}` : "",
    fact.scope ? `scope: ${fact.scope}` : "",
  ].filter(Boolean);
  return qualifiers.length > 0 ? `${fact.claim} (${qualifiers.join("; ")})` : fact.claim;
}

export function parseReleaseCard(input: unknown): ReleaseCard {
  return ReleaseCardSchema.parse(input);
}

export function safeParseReleaseCard(input: unknown) {
  return ReleaseCardSchema.safeParse(input);
}
