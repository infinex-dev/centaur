/**
 * Laban-Mirodan framework constants — generic, brand-agnostic.
 *
 * The mapping rules below are mechanical: per Mirodan, a baseline + stress
 * combination deterministically produces the outer Action Attitudes available.
 *
 * Used by the validator (preparation hierarchy) and by the skill's interview
 * flow (mapping user answers to a CharacterSpec).
 */

import { PREPARATION_PAIRS } from "./types.js";
import type {
  BaselineAttitude,
  Drive,
  InnerAttitude,
  OuterOnlyAttitude,
  QuickAction,
  Stress,
  SustainedAction,
  WorkingAction,
} from "./types.js";

// Available stresses per baseline (Mirodan §4.1).
// A baseline character's two available stresses are the two Motion Factors
// NOT in its inner pair.
//   Stable inner = Weight + Space → stresses: Time or Flow
//   Adream inner = Weight + Flow  → stresses: Time or Space
//   Near   inner = Weight + Time  → stresses: Space or Flow
export const AVAILABLE_STRESSES: Record<BaselineAttitude, readonly Stress[]> = {
  stable: ["time", "flow"],
  adream: ["time", "space"],
  near: ["space", "flow"],
};

// Outer Action Attitudes produced by (baseline + stress) per Mirodan §4.1.
//   Stable + Time → Near or Awake
//   Stable + Flow → Adream or Remote
//   Adream + Time → Near or Mobile  (the "Adream split" — §4.5)
//   Adream + Space → Stable or Remote
//   Near + Space → Stable or Awake
//   Near + Flow → Adream or Mobile
export const OUTER_PROJECTIONS: Record<
  BaselineAttitude,
  Record<Stress, readonly InnerAttitude[]>
> = {
  stable: {
    time: ["near", "awake"],
    flow: ["adream", "remote"],
    space: [],
    weight: [],
  },
  adream: {
    time: ["near", "mobile"],
    space: ["stable", "remote"],
    flow: [],
    weight: [],
  },
  near: {
    space: ["stable", "awake"],
    flow: ["adream", "mobile"],
    time: [],
    weight: [],
  },
};

// Drive sub-diagrams per Mirodan §2 + §3.
// Each character (Inner Attitude + Stress + Aspect) maps to a Drive axis pair.
// Critical for Drive-lock: knowing which axis is visible tells you which
// language families are off-spec as surface projection.
//
// Time-stress always activates Passion (and removes Vision-only paths).
// Flow-stress on Stable activates Spell; Passion may still be hidden lining.
// Space-stress on Adream mixes Spell with Passion (both diagrams use Passion).
export interface DriveDiagram {
  primary_axis: [Drive, Drive]; // e.g., ["spell", "doing"]
  sub_axis: [Drive, Drive]; // e.g., ["spell", "vision"]
  example_characters: string[];
}

export const DRIVE_DIAGRAMS: Record<string, DriveDiagram> = {
  // Stable
  "stable-time-enclosing-A": {
    primary_axis: ["doing", "spell"],
    sub_axis: ["doing", "passion"],
    example_characters: ["Creon", "Hawthorne"],
  },
  "stable-flow-penetrating-D": {
    primary_axis: ["spell", "doing"],
    sub_axis: ["spell", "vision"], // NO PASSION — the Infinex placement
    example_characters: ["the Duke (Measure for Measure)", "Werle (Wild Duck)"],
  },
  // Adream
  "adream-space-enclosing-A": {
    primary_axis: ["spell", "passion"],
    sub_axis: ["spell", "doing"],
    example_characters: ["Claudius"],
  },
  "adream-space-radiating-B": {
    primary_axis: ["spell", "passion"], // mixes Spell with Passion
    sub_axis: ["spell", "vision"],
    example_characters: ["Hamlet", "Hedda Gabler", "Miss Julie"],
  },
  "adream-time-enclosing-C": {
    primary_axis: ["passion", "spell"],
    sub_axis: ["passion", "doing"],
    example_characters: ["Stanley", "Lear", "Jean"],
  },
  "adream-time-radiating-D": {
    primary_axis: ["passion", "spell"],
    sub_axis: ["passion", "vision"],
    example_characters: ["Ophelia", "Blanche"],
  },
  // Near
  "near": {
    primary_axis: ["doing", "passion"],
    sub_axis: ["doing", "passion"], // always Doing + Passion
    example_characters: ["Big Daddy", "Iago (if Near)", "Tesman"],
  },
};

// Status grammar (Mirodan §4.4) — what each stress reads as in terms of
// perceived maturity / social position.
export const STATUS_GRAMMAR: Record<Stress, string> = {
  time: "adolescent / lower status / immature",
  space: "mature / higher status / sophisticated",
  flow: "emotional / sociable",
  weight: "(only on outer Mobile/Remote/Awake projections)",
};

// -- Preparation hierarchy enforcement ----------------------------------------

/**
 * Given a sequence of motor actions (one per beat), check that every Quick
 * action is preceded by its required Sustained prep.
 *
 * Returns the indices of beats that lack the required prep.
 */
export function checkPrepHierarchy(motors: WorkingAction[]): number[] {
  const failures: number[] = [];
  for (let i = 0; i < motors.length; i++) {
    const m = motors[i];
    if (!m) continue;
    if (!isQuick(m)) continue;
    const prep = PREPARATION_PAIRS[m as QuickAction];
    // Look backward for the prep in immediately preceding beats.
    let found = false;
    for (let j = i - 1; j >= 0; j--) {
      const prev = motors[j];
      if (prev === prep) {
        found = true;
        break;
      }
      // A Quick action breaks the prep chain.
      if (prev && isQuick(prev)) break;
    }
    if (!found) failures.push(i);
  }
  return failures;
}

export function isQuick(a: WorkingAction): a is QuickAction {
  return a === "punching" || a === "slashing" || a === "dabbing" || a === "flicking";
}

export function isSustained(a: WorkingAction): a is SustainedAction {
  return a === "pressing" || a === "wringing" || a === "gliding" || a === "floating";
}

// -- Hard rules (Mirodan overrides — never violate) ---------------------------

export const HARD_RULES = [
  "Mobile, Awake, and Remote are NEVER baseline characters — only outer projections. CharacterSpec.inner_attitude must be one of Stable, Adream, Near.",
  "The three opposite-pairs are mutually exclusive: Stable↔Mobile, Near↔Remote, Awake↔Adream. A character anchored at one pole cannot have its opposite as either Inner Attitude or Action Attitude.",
  "Available stresses are determined by the baseline's Inner Factors. Space-stressed Stable does NOT exist (Stable's Inner = Weight+Space, so Space cannot be the stress).",
  "Every Quick action requires its Sustained partner as prep. Without prep, the Quick action degrades to its Sustained version (Pressing instead of Punching, etc.).",
  "Inner Attitudes produce Shadow Moves (2-axis, subliminal). Action Attitudes produce Working Actions (3-axis, visible). The Stress is the bridge — the third axis added to the inner pair to produce a visible Action.",
];
