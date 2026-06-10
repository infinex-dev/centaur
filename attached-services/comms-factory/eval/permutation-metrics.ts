/**
 * Cell-level metric computation for the permutation eval rig.
 *
 * One "cell" = one (card, permutation) — the set of candidates generated under
 * that combination. Metrics summarize whether the candidates landed inside the
 * locked Infinex placement.
 *
 * Locked placement (per memory/infinex-drive-spell-not-passion.md +
 * memory/infinex-5-tempi-locked.md):
 *   - inner_attitude: stable
 *   - stress: flow
 *   - aspect: penetrating
 *   - drive axis: spell → vision
 *   - off-spec drive: passion
 *   - five tempi in rotation: commanding, practical, sombre, irradiant, sociable
 */

import type { ReleaseCard } from "../src/card.js";
import type { Candidate } from "../src/generator.js";
import { validate } from "../src/validator.js";
import type { VerifierResult } from "./corpus-format.js";

const LOCKED_INNER = "stable";
const LOCKED_STRESS = "flow";
const LOCKED_ASPECT = "penetrating";
const LOCKED_DRIVE_SUBSTRING = "spell";
const OFF_SPEC_DRIVE_SUBSTRING = "passion";

const LOCKED_TEMPI: ReadonlyArray<string> = [
  "commanding",
  "practical",
  "sombre",
  "irradiant",
  "sociable",
];

export interface CellInput {
  card: ReleaseCard;
  permutation: string;
  candidates: Candidate[];
  /** verifier output, joined by candidate id */
  verifier_by_id: Map<string, VerifierResult>;
}

export interface CellMetrics {
  card_id: string;
  permutation: string;
  n_candidates: number;

  // Slop / validator gate
  validator_pass_rate: number;
  validator_pass_count: number;

  // Mechanical surface
  em_dash_density_per_280: { min: number; median: number; p95: number; mean: number };
  length_chars: { min: number; median: number; p95: number; max: number };

  // Placement hits
  placement_hit_rate: number;
  placement_hit_count: number;
  off_spec_drive_rate: number;
  off_spec_drive_count: number;

  // Register coverage
  tempo_distribution: Record<string, number>;
  tempo_coverage_count: number; // how many of the 5 locked tempi appeared at least once
  tempo_coverage_missing: string[];
  tempo_entropy: number; // Shannon entropy over the locked-tempi distribution

  // Motors
  motor_pair_distribution: Record<string, number>;

  // Fact-contract
  fact_contract_violation_rate: number;
  fact_contract_violation_count: number;
}

export function computeCellMetrics(input: CellInput): CellMetrics {
  const { card, candidates, permutation } = input;
  const n = candidates.length;

  // Validator pass rate
  let validatorPass = 0;
  for (const c of candidates) {
    const r = validate(c.text, {
      card,
      ...(c.deployed_facts_used !== undefined ? { deployed_facts_used: c.deployed_facts_used } : {}),
      ...(c.not_said !== undefined ? { not_said: c.not_said } : {}),
    });
    if (r.passed) validatorPass++;
  }

  // Em-dash density (per 280 chars)
  const emDashDensities = candidates.map((c) => {
    const dashes = (c.text.match(/—/g) ?? []).length;
    const chars = Math.max(1, c.text.length);
    return (dashes / chars) * 280;
  });
  const lengths = candidates.map((c) => c.text.length);

  // Verifier-derived metrics
  let placementHit = 0;
  let offSpecDrive = 0;
  const tempoDist: Record<string, number> = {};
  const motorDist: Record<string, number> = {};

  for (const c of candidates) {
    const v = input.verifier_by_id.get(c.id);
    if (!v) continue;
    const cls = v.classification;
    const driveAxisLower = cls.drive_axis.toLowerCase();
    if (
      cls.inner_attitude === LOCKED_INNER &&
      cls.stress === LOCKED_STRESS &&
      cls.aspect === LOCKED_ASPECT &&
      driveAxisLower.includes(LOCKED_DRIVE_SUBSTRING)
    ) {
      placementHit++;
    }
    if (driveAxisLower.includes(OFF_SPEC_DRIVE_SUBSTRING)) {
      offSpecDrive++;
    }
    const tempoKey = cls.tempo_primary.toLowerCase();
    tempoDist[tempoKey] = (tempoDist[tempoKey] ?? 0) + 1;
    if (cls.motor_pair) {
      const key = `${cls.motor_pair[0]}→${cls.motor_pair[1]}`;
      motorDist[key] = (motorDist[key] ?? 0) + 1;
    }
  }

  // Register coverage over the locked five tempi
  const coverageSeen = LOCKED_TEMPI.filter((t) => (tempoDist[t] ?? 0) > 0);
  const coverageMissing = LOCKED_TEMPI.filter((t) => (tempoDist[t] ?? 0) === 0);
  const lockedTotal = LOCKED_TEMPI.reduce((s, t) => s + (tempoDist[t] ?? 0), 0);
  let entropy = 0;
  if (lockedTotal > 0) {
    for (const t of LOCKED_TEMPI) {
      const p = (tempoDist[t] ?? 0) / lockedTotal;
      if (p > 0) entropy -= p * Math.log2(p);
    }
  }

  // Fact-contract violations
  let factViolations = 0;
  const cardFactSet = new Set(card.deployed_facts);
  for (const c of candidates) {
    const used = c.deployed_facts_used ?? [];
    if (used.length === 0) {
      factViolations++;
      continue;
    }
    const overlaps = used.some((f) => cardFactSet.has(f));
    if (!overlaps) factViolations++;
  }

  return {
    card_id: card.id,
    permutation,
    n_candidates: n,
    validator_pass_rate: n === 0 ? 0 : validatorPass / n,
    validator_pass_count: validatorPass,
    em_dash_density_per_280: distributionSummary(emDashDensities),
    length_chars: lengthDistribution(lengths),
    placement_hit_rate: n === 0 ? 0 : placementHit / n,
    placement_hit_count: placementHit,
    off_spec_drive_rate: n === 0 ? 0 : offSpecDrive / n,
    off_spec_drive_count: offSpecDrive,
    tempo_distribution: tempoDist,
    tempo_coverage_count: coverageSeen.length,
    tempo_coverage_missing: coverageMissing,
    tempo_entropy: entropy,
    motor_pair_distribution: motorDist,
    fact_contract_violation_rate: n === 0 ? 0 : factViolations / n,
    fact_contract_violation_count: factViolations,
  };
}

function distributionSummary(xs: number[]): { min: number; median: number; p95: number; mean: number } {
  if (xs.length === 0) return { min: 0, median: 0, p95: 0, mean: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    min: sorted[0]!,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    mean,
  };
}

function lengthDistribution(xs: number[]): { min: number; median: number; p95: number; max: number } {
  if (xs.length === 0) return { min: 0, median: 0, p95: 0, max: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    min: sorted[0]!,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]!,
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * (sortedAsc.length - 1))));
  return sortedAsc[idx]!;
}
