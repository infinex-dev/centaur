/**
 * The positioning spine — the layer ABOVE individual cards.
 *
 * Positioning in this project IS the locked super-objective (settled
 * 2026-05-29; see research/positioning-thesis-2026-05-29.md). It is not a
 * separate authored artifact and there is deliberately NO "category noun" /
 * "positioning statement" field — we proved the super-objective derives the
 * positioning. The spine is read from the voice spec; the cross-launch
 * through-line and coherence read are the only curated copy here.
 */

import { INFINEX_VOICE } from '@pipeline/voice/infinex';

export const POSITIONING_SPINE = {
  super_objective: INFINEX_VOICE.super_objective,
  validation_criterion: INFINEX_VOICE.validation_criterion,
  super_objective_examples: INFINEX_VOICE.super_objective_examples,
  character_image: INFINEX_VOICE.character_image,
} as const;

/**
 * The cross-launch through-line — the headline of the positioning surface.
 * Curated for v1 (operator-editable here). Stretch: synthesise it from the
 * derived theses across cards rather than hand-writing it.
 */
export const THROUGH_LINE =
  'Infinex absorbs the plumbing you used to manage — the spot/perps seam, the second venue, the bank wall — so the account becomes one thing, and you only have to want.';

/** Phrases inside THROUGH_LINE to highlight as the laddered proof-points. */
export const THROUGH_LINE_HIGHLIGHTS = [
  'the spot/perps seam',
  'the second venue',
  'the bank wall',
];

/**
 * The coherence read — are the launches telling one story or drifting?
 * Curated rollup for v1. Stretch: flag a card whose derived thesis doesn't
 * ladder back to the super-objective.
 */
export const COHERENCE_READ =
  "Every launch resolves to the same move: the account absorbs work that used to be the user's. A different seam each time — venue, balance, bank wall — one super-objective underneath.";
