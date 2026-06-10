/**
 * Laban-Mirodan voice types — generic framework, brand-agnostic.
 *
 * Used by the generator (beats[] input) and the validator (beat-tempo audit +
 * preparation-hierarchy guard). The framework comes from Veronica Mirodan's
 * 1997 PhD synthesis of Yat Malmgren's adaptation of Laban Movement Analysis.
 *
 * See skills/laban-voice-for-ai-agents/ for the full reference.
 */

// The 8 Working Actions — body of every visible motor.
// Sustained = introvert / preparation. Quick = extravert / release.
export const SUSTAINED_ACTIONS = ["pressing", "wringing", "gliding", "floating"] as const;
export const QUICK_ACTIONS = ["punching", "slashing", "dabbing", "flicking"] as const;
export type SustainedAction = (typeof SUSTAINED_ACTIONS)[number];
export type QuickAction = (typeof QUICK_ACTIONS)[number];
export type WorkingAction = SustainedAction | QuickAction;

// Preparation hierarchy (Mirodan §1.7, p. 347):
// Every Quick action requires its Sustained partner as prep.
// Without prep, the Quick action degrades to its Sustained version.
export const PREPARATION_PAIRS: Record<QuickAction, SustainedAction> = {
  punching: "pressing",
  slashing: "wringing",
  dabbing: "gliding",
  flicking: "floating",
};

// The 6 Inner Attitudes — but only 3 (Stable, Adream, Near) can be character
// baselines. Mobile, Remote, Awake are Action Attitudes only — they fire as
// outer projections of a baseline under stress, never as a resting state.
export const BASELINE_ATTITUDES = ["stable", "adream", "near"] as const;
export const OUTER_ONLY_ATTITUDES = ["mobile", "remote", "awake"] as const;
export type BaselineAttitude = (typeof BASELINE_ATTITUDES)[number];
export type OuterOnlyAttitude = (typeof OUTER_ONLY_ATTITUDES)[number];
export type InnerAttitude = BaselineAttitude | OuterOnlyAttitude;

// Stress factors. Each baseline has TWO available stresses (the two Motion
// Factors NOT in its inner pair). Stress carries a status grammar:
//   time-stress  = adolescent / lower / immature
//   space-stress = mature / higher / sophisticated
//   flow-stress  = emotional / sociable
//   weight-stress only fires on Mobile/Remote/Awake outers.
export type Stress = "time" | "space" | "flow" | "weight";

// Aspects — which Inner Participation is emphasized.
// Fixed per character; determines psychological type.
export type Aspect =
  | "enclosing" // Intending emphasized
  | "penetrating" // Attending emphasized
  | "circumscribing" // Deciding emphasized
  | "radiating"; // Adapting emphasized

// Drives — the four structural energies/axes a character runs on.
// Mirodan: Doing, Spell, Passion, Vision.
//   Time-axis activates Passion.
//   Flow-axis activates Spell on Stable; Adream Space-stressed mixes Spell+Passion.
// Drive lock determines which language families are off-spec as visible surfaces.
export type Drive = "doing" | "spell" | "passion" | "vision";

// The 24 named Tempi across all 6 Inner Attitudes.
// Each baseline (Stable, Adream, Near) has its own 4 internal-variation tempi.
// The 3 outer-only attitudes (Mobile, Remote, Awake) also have 4 tempi each,
// but these fire as OUTER PROJECTIONS of a baseline under stress — never as a
// resting state. Which 12 of the 24 are available to a given character depends
// on (Inner Attitude + Stress) — see references/working-actions.md.
export type StableTempo =
  | "commanding" // Strong/Direct — Pressing→Punching
  | "practical" // Strong/Flexible — Wringing→Slashing
  | "self-contained" // Light/Direct — Gliding→Dabbing
  | "receptive"; // Light/Flexible — Floating→Flicking

export type AdreamOuterTempo =
  | "sombre" // Strong/Bound — Pressing→Punching (bound flow)
  | "overpowering" // Strong/Free — Wringing→Slashing
  | "diffused" // Light/Bound — Gliding→Dabbing
  | "irradiant"; // Light/Free — Floating→Flicking

export type NearTempo =
  | "materialistic" // Strong/Quick — Punching→Slashing (sudden aggressive intent)
  | "human" // Light/Sustained — Floating→Gliding (slow tenderness)
  | "warm" // Strong/Sustained — Pressing→Wringing (warm consent)
  | "cool"; // Light/Quick — Dabbing→Flicking (pert intimacy)

export type MobileOuterTempo =
  // Mobile = outer of Adream-Time or Near-Flow only. Never baseline.
  | "unacknowledged" // Quick/Bound — Punching/Slashing (self-concealed aggression)
  | "acknowledged" // Sustained/Free — Floating/Gliding (easy disclosure)
  | "revealed" // Quick/Free — Dabbing/Flicking (sudden disclosure)
  | "concealed"; // Sustained/Bound — Pressing/Wringing (withheld weight)

export type RemoteOuterTempo =
  // Remote = outer of Adream-Space or Stable-Flow only. Never baseline.
  | "egocentric" // Direct/Bound — Pressing→Punching
  | "unsociable" // Flexible/Bound — Wringing→Slashing
  | "sociable" // Direct/Free — Gliding→Dabbing
  | "altruistic"; // Flexible/Free — Floating→Flicking

export type AwakeOuterTempo =
  // Awake = outer of Stable-Time or Near-Space only. Never baseline.
  | "acute" // Direct/Quick — Punching→Dabbing (acute idea-decision)
  | "doubting" // Flexible/Sustained — Floating→Wringing (slowly dawning doubt)
  | "certain" // Direct/Sustained — Pressing→Gliding (certain awareness)
  | "uncertain"; // Flexible/Quick — Flicking→Slashing (sudden new idea)

export type TempoName =
  | StableTempo
  | AdreamOuterTempo
  | NearTempo
  | MobileOuterTempo
  | RemoteOuterTempo
  | AwakeOuterTempo;

export const ALL_TEMPO_NAMES = [
  "commanding",
  "practical",
  "self-contained",
  "receptive",
  "sombre",
  "overpowering",
  "diffused",
  "irradiant",
  "materialistic",
  "human",
  "warm",
  "cool",
  "unacknowledged",
  "acknowledged",
  "revealed",
  "concealed",
  "egocentric",
  "unsociable",
  "sociable",
  "altruistic",
  "acute",
  "doubting",
  "certain",
  "uncertain",
] as const satisfies readonly TempoName[];

export interface Tempo {
  name: TempoName;
  attitude: InnerAttitude;
  // Two-factor Laban Variation declaration — e.g. "Strong + Direct" for
  // Commanding, "Strong + Bound" for Sombre. The locked Mirodan signature for
  // this tempo's factor shape. Brand-agnostic; identical across all brands.
  // Optional during transitional migration; promote to required once all voice
  // files (cream, nick-b, nick-d, projectjin) have declared it.
  factor_shape?: string;
  // Canonical Mirodan shorthand — locked, both-poles formulation from
  // Mirodan vol 2. E.g. "Receptive acceptance or receptive rejection of
  // a 'welcoming tenderness'". The 'or' is the directional axis: per-beat,
  // directional_intent (toward | away_from) resolves which pole the beat
  // plays in service of the scene's through-action objective. The noun phrase
  // (e.g. 'welcoming tenderness') is the quality the beat orbits.
  // Source: research/24-tempi-audit-2026-05-27.md (canonical from Mirodan
  // vol 2). Brand-agnostic. No operator paraphrase layer — the canon is
  // what feeds the Director.
  // Optional during transitional migration; promote to required once all voice
  // files have declared it.
  canonical_shorthand?: string;
  // Motor pair: two Working Actions characterizing this tempo's signature.
  // motor_relation determines semantics:
  //   "prep_release" — motor[0] is Sustained prep, motor[1] is Quick release
  //     (Stable, Adream, Remote tempi). Validator enforces prep hierarchy.
  //   "co_exist" — both motifs sit on the same Time pole, no prep→release
  //     ordering (Near, Mobile, Awake tempi). Validator does NOT enforce prep.
  motor: [WorkingAction, WorkingAction];
  motor_relation?: "prep_release" | "co_exist";
  // Default directional intent for this tempo when no per-beat override is
  // supplied. Per-beat directional_intent on the BeatSequence is authoritative.
  // toward     = beat embraces scene through-action objective via the quality
  // away_from  = beat moves away from objective via the quality
  // Same factor shape, opposite valence. See mirodan-directional-intent-axis.
  directional_intent_default?: "toward" | "away_from";

  // ----- legacy / deprecated fields (brand-vocab) -----
  // These were the operator-shorthand + brand-sample layers that the Laban-pure
  // voice spec migration (2026-05-28) moved DOWN to brands/<x>/04-voice/samples/
  // and to per-card through_action / lining fields. infinex voice spec no
  // longer sets these; nigel voice spec still does pending migration. Generator
  // and validator-llm read canonical_shorthand by default and only fall back
  // to these legacy fields when canonical_shorthand is absent (transitional).
  inner_combo?: string;
  feel?: string;
  opening_shapes?: string[];
  vocab_anchor?: string[];
  signoff_moves?: string[];
  example_lines?: string[];
  lining?: string;
}

export interface CharacterSpec {
  name: string; // "infinex"
  inner_attitude: BaselineAttitude;
  stress: Stress;
  stress_pole?: "bound" | "free" | "strong" | "light" | "direct" | "flexible" | "quick" | "sustained";
  aspect: Aspect;
  drive_primary: Drive;
  drive_secondary: Drive;
  drive_introvert?: Drive;
  drive_extravert?: Drive;
  drive_axis?: string; // "Spell -> Vision" etc.
  drive_table_cell?: string; // "<inner>|<aspect>|<stress>", e.g. "stable|penetrating|flow"
  off_spec_drives: Drive[]; // shorthand for drives that should NOT surface as visible/extravert projection
  off_spec_regexes: { name: string; re: RegExp; reason: string }[];
  tempi: Partial<Record<TempoName, Tempo>>; // 12 of 24 tempi available to this character (the rest are out-of-placement)
  main_tempi: TempoName[]; // tempi in rotation
  beat_only_tempi: TempoName[]; // tempi available but rarely
  cadence: Partial<Record<TempoName, number>>; // approximate distribution, sums to 1.0 for main_tempi
  character_image?: string;
  literary_anchors?: string[];
  mirodan_kernel?: string;
  drive_table?: string;
  /**
   * Character-derived STRUCTURAL constraints the generator should respect.
   * NOT a hardcoded slop / allergen list — those are off-spec and handled by
   * the validator's deterministic rules. These are framework-level shape
   * traits that follow from the placement (e.g. "No listicle openers" for a
   * Stable + Flow-stressed character — Wise-Old-Guard doesn't write BuzzFeed).
   *
   * Each entry should be a complete sentence the generator can include verbatim
   * in its system prompt's "Structural constraints" section. Reasoning should
   * cite the character placement, not operator taste.
   */
  structural_traits?: string[];

  /**
   * Super-Objective (Stanislavski/Mirodan inheritance, pp. 282-306, §13).
   * What the character ALWAYS wants — the standing through-action across the
   * whole arc. A transitive verb phrase ("to <verb> <object>"), not an
   * adjective. Generator prompts cite this to give the character intent before
   * each release, so beats arc toward something rather than restating mechanics.
   *
   * Examples are 2-3 worked applications: how the Super-Objective manifests
   * in concrete past releases. Teaches the model the pattern by demonstration.
   *
   * Optional so legacy voices keep working; promote to required once all
   * voices declare it.
   */
  super_objective?: string;
  super_objective_examples?: string[];

  /**
   * Historical lore — character backstory / scar tissue.
   * The version of the character that no longer is. Past learnings the
   * current placement has internalized. Encoded so the model knows what the
   * character has *moved past* and refuses to do — without naming the era
   * in prose. Same shape as Nigel's "bouffon-line" pattern (the wound
   * dismissed long enough ago that it now reads as discipline).
   *
   * Never appears in prose; only informs refusal of off-spec moves.
   */
  historical_lore?: string;

  /**
   * Validation criterion — operational test the character is trying to pass.
   * NOT the Super-Objective (that's the standing intent); this is the
   * observable success condition. Used by the audit layer to score whether
   * a given artifact would help or hurt this condition.
   *
   * Example for Infinex (CTO frame): one real user discovers the product
   * unprompted, no incentives, fills a need.
   */
  validation_criterion?: string;
}

// Beat sequence — what the generator consumes per release card.
// A post is N beats; each beat is a paragraph. The two-call path does not
// declare a tempo per beat (Mirodan: tempo emerges from the verb under the
// inner work; the audience perceives it; the validator scores it post-hoc).
// The legacy single-call path still supplies tempo explicitly, so tempo
// stays available — just optional.
export interface TempoBeat {
  tempo?: TempoName;
  hint?: string; // optional guidance for that specific beat
}

export interface BeatSequence {
  beats: TempoBeat[];
  enforce_prep_hierarchy?: boolean; // default true
}

// Validation result types — extending validator.ts shape for beat-sequence
// audits. The base validator returns per-rule failures; the beat-sequence
// validator returns per-beat failures.
export interface BeatAuditResult {
  beat_index: number;
  declared_tempo?: TempoName;
  classified_tempo?: TempoName | "unknown";
  classified_confidence?: number;
  passed: boolean;
  reason?: string;
}

export interface PrepHierarchyFailure {
  beat_index: number;
  quick_action: QuickAction;
  required_prep: SustainedAction;
  found_prep: SustainedAction | null;
}
