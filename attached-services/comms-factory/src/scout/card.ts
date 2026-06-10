import { z } from "zod";

/**
 * Proactive-lane contract — the Scout's output and the proposal it graduates into.
 *
 * Mirror image of the reactive lane (`src/card.ts`). Where a ReleaseCard is the
 * structured INPUT to the comms pipeline (something shipped -> say it), a
 * ProposalCard is the structured OUTPUT of the research pipeline (something is
 * worth building -> here's why). Step 0, upstream of everything else:
 *
 *   question -> scout (produces findings) -> director (adds brand_case) ->
 *   ProposalCard -> Monday review -> approve -> build -> emits a ReleaseCard
 *
 * Two roles, two cards, one cast. The Scout fills the quantitative_case; the
 * Director fills the brand_case. A ProposalCard with only a quantitative_case is
 * a finding that hasn't been judged for fit yet — useful, but not yet a proposal.
 *
 * NOT the grounder. The grounder verifies a release's deployed_facts (reactive).
 * The Scout discovers a claim worth making (proactive). Shared tool library,
 * separate role — see GOAL-proactive-research-lane-2026-06-01.md.
 */

// Confidence vocabulary from the method gates (references/method-gates.md G2).
// `hard` = stablecoins at $1, BTC/native at spot. `medium` = diffuse token sends,
// residual mispricing risk. `estimated` = band-proxy / inferred. `artifact` rows
// are excluded upstream and never reach a metric.
export const Confidence = z.enum(["hard", "medium", "estimated"]);
export type Confidence = z.infer<typeof Confidence>;

// Which scout produced this. Internal = revealed demand from our own data.
// External = anticipated demand from the whole-market radar (spot-before-big).
export const ScoutKind = z.enum(["internal", "external"]);
export type ScoutKind = z.infer<typeof ScoutKind>;

// The two-layer decomposition (G5). Every internal finding is one or the other;
// they imply different builds. External findings are market-level, hence optional.
export const LeakageLayer = z.enum(["L1-activity", "L2-capital"]);
export type LeakageLayer = z.infer<typeof LeakageLayer>;

// What the data says we should DO with this finding. "perps = defend, don't
// build" is a real instance-#1 disposition — not every finding is a build.
export const Disposition = z.enum(["build", "defend", "monitor", "reject"]);
export type Disposition = z.infer<typeof Disposition>;

// One load-bearing number, with its provenance. The mirror of a ReleaseCard's
// deployed_fact: a deployed_fact is a claim the caption MAY assert; a Metric is
// a claim the Scout HAS verified. source_ref (the exact SQL / onchain trace) is
// the reproducibility that makes the number safe to act on — record it always.
export const Metric = z.object({
  claim: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  confidence: Confidence,
  source_ref: z
    .string()
    .min(1)
    .describe("exact SQL run, or onchain trace — every figure must be reproducible"),
});
export type Metric = z.infer<typeof Metric>;

/**
 * ScoutFinding — the Scout's raw output, before the Director's brand pass.
 * This is what a `scout` run emits and writes into a brief.
 */
export const ScoutFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  scouted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scouted_date must be YYYY-MM-DD"),
  scout: ScoutKind,
  layer: LeakageLayer.optional(),

  // The one-line case a proposal would carry. The headline, not the workings.
  // e.g. "$3.38M sits idle at 0%; lending is the #1 vertical users leave for."
  quantitative_case: z.string().min(1),

  // The verified numbers behind the case. At least one — a case with no metric
  // is a hunch, not a finding.
  metrics: z.array(Metric).min(1),

  // Gate 4: any dominant/swung number gets a concentration note, never bare.
  // e.g. "$143M across 3 accounts / 2 Solana addresses — artifact, excluded".
  concentration_note: z.string().min(1).optional(),

  // What the data cannot see — carried into every brief (G-caveats). No
  // USD-inflow ledger, DeBank EVM-only, banded balances, off-platform commingling.
  caveats: z.array(z.string().min(1)),

  // The probes that produced this (the SQL). Reproducibility = the safety
  // mechanism, the same discipline as the grounder's source_ref.
  probes_run: z.array(z.string().min(1)).min(1),

  disposition: Disposition.default("build"),
});
export type ScoutFinding = z.infer<typeof ScoutFindingSchema>;

/**
 * brand_case — the Director's contribution. Judges whether the product move fits
 * Infinex identity, the same lens the Director applies to copy (infinex_fit) but
 * aimed at an integration rather than a sentence. Empty until the Director runs.
 */
export const BrandCase = z.object({
  fit: z.string().min(1).describe("why this move is on-brand, in plain terms"),
  super_objective_alignment: z
    .string()
    .min(1)
    .describe('does it advance "take responsibility for the tech, so the user only has to want"?'),
  director_verdict: z.enum(["on-brand", "needs-work", "off-brand"]),
});
export type BrandCase = z.infer<typeof BrandCase>;

/**
 * ProposalCard — the Monday-review unit. A ScoutFinding that has been through the
 * Director's brand lens. quantitative_case (Scout) + brand_case (Director). When
 * both support it and a human approves, it triggers a build that eventually emits
 * a ReleaseCard into the reactive lane.
 */
export const ProposalCardSchema = ScoutFindingSchema.extend({
  // Present once the Director has judged it. A finding without a brand_case is
  // still a valid finding; it just hasn't been judged for fit.
  brand_case: BrandCase.optional(),

  // Rank within a Monday batch — recoverable $ x buildability, not gross flow.
  rank: z.number().int().positive().optional(),
});
export type ProposalCard = z.infer<typeof ProposalCardSchema>;

export function parseScoutFinding(input: unknown): ScoutFinding {
  return ScoutFindingSchema.parse(input);
}

export function parseProposalCard(input: unknown): ProposalCard {
  return ProposalCardSchema.parse(input);
}

export function safeParseProposalCard(input: unknown) {
  return ProposalCardSchema.safeParse(input);
}
