/**
 * Mirodan competence eval — typed question bank.
 *
 * Tests whether a model with a given prompt context can MECHANICALLY reason
 * about Mirodan's character framework (not just pattern-match the mood).
 *
 * Grader kinds:
 *   - exact         answer is a single canonical token; case-insensitive trim
 *   - one_of        any of N canonical tokens passes (set membership)
 *   - regex         response must match at least one of the listed regex patterns
 *   - structured    response must contain key:value pairs, each value matched via
 *                   one_of / regex; missing keys = fail. (Free-form prose passes
 *                   provided the required key:value snippets are present.)
 *   - all_of        response must contain ALL listed tokens (each as one_of group)
 *
 * Discriminator: laban_only = answerable from baseline Laban knowledge.
 *                mirodan_specific = requires Mirodan synthesis (motor-pair prep,
 *                                   Drive derivation, baseline legality, etc.).
 */

export type GraderKind =
  | "exact"
  | "one_of"
  | "regex"
  | "structured"
  | "all_of";

export type Discriminator = "laban_only" | "mirodan_specific";

export type Category =
  | "laban_vs_mirodan"
  | "baseline_legality"
  | "motor_pair_prep"
  | "tempo_perception"
  | "drive_derivation"
  | "classify_this_line";

interface BaseQuestion {
  id: string;
  category: Category;
  prompt: string;
  discriminator: Discriminator;
  rationale_for_answer_key: string;
}

export interface ExactQuestion extends BaseQuestion {
  grader_kind: "exact";
  correct_answer: string;
}

export interface OneOfQuestion extends BaseQuestion {
  grader_kind: "one_of";
  correct_answer: string[];
}

export interface RegexQuestion extends BaseQuestion {
  grader_kind: "regex";
  correct_answer: string[];
  case_insensitive?: boolean;
}

export interface AllOfQuestion extends BaseQuestion {
  grader_kind: "all_of";
  correct_answer: string[][];
}

export interface StructuredQuestion extends BaseQuestion {
  grader_kind: "structured";
  correct_answer: Record<
    string,
    { kind: "one_of"; values: string[] } | { kind: "regex"; values: string[] }
  >;
}

export type Question =
  | ExactQuestion
  | OneOfQuestion
  | RegexQuestion
  | AllOfQuestion
  | StructuredQuestion;

export const QUESTIONS: Question[] = [
  // ─── Category 1: Laban-vs-Mirodan discrimination ────────────────────────

  {
    id: "lvm-01-six-piece-unit",
    category: "laban_vs_mirodan",
    discriminator: "mirodan_specific",
    prompt:
      "Mirodan synthesizes Laban Movement Analysis into a working character framework where a character is described as a six-piece unit. List the six pieces.",
    grader_kind: "all_of",
    correct_answer: [
      ["inner attitude", "inner-attitude", "inner_attitude"],
      ["aspect"],
      ["stress", "dominant stress"],
      ["outer action", "outer-action", "outer action attitude", "action attitude"],
      ["lining"],
      ["working action", "working-action", "working actions"],
    ],
    rationale_for_answer_key:
      "Per mirodan-laban-framework memory: Inner Attitude + Aspect + Dominant Stress + Outer Action(s) + Lining + Working Actions. Pure-Laban knowledge gives Effort/Shape/Space and the four motion factors but not this six-piece synthesis.",
  },
  {
    id: "lvm-02-three-baselines",
    category: "laban_vs_mirodan",
    discriminator: "mirodan_specific",
    prompt:
      "In Mirodan's framework, which Inner Attitudes can serve as BASELINE characters (produce embodied characters), and which are outer-only (fire as projections under stress, never as the resting state)? Name all six.",
    grader_kind: "all_of",
    correct_answer: [
      ["stable"],
      ["near"],
      ["adream"],
      ["mobile"],
      ["awake"],
      ["remote"],
    ],
    rationale_for_answer_key:
      "Stable / Near / Adream are the three baselines; Mobile / Awake / Remote are outer-only. Mirodan p. 567/432/474. Pure Laban does not make this distinction. Grader checks all six terms are named; a correct response will additionally label the partition (3 baselines vs 3 outer) but the all_of grader only enforces presence.",
  },
  {
    id: "lvm-03-drives-vs-effort-actions",
    category: "laban_vs_mirodan",
    discriminator: "mirodan_specific",
    prompt:
      "Laban described eight Basic Effort Actions (Pressing, Punching, Wringing, Slashing, Gliding, Dabbing, Floating, Flicking) as three-factor compounds. Mirodan synthesizes these into FOUR named Drives, each a three-factor compound defined as much by what is SUBDUED (the missing fourth factor) as by what's present. Name the four Drives.",
    grader_kind: "all_of",
    correct_answer: [
      ["doing"],
      ["spell"],
      ["passion"],
      ["vision"],
    ],
    rationale_for_answer_key:
      "Mirodan ch3: Doing (Flowless), Spell (Timeless), Passion (Spaceless), Vision (Weightless). Pure Laban gives the Working Actions but not the Drive synthesis.",
  },
  {
    id: "lvm-04-working-actions-are-laban",
    category: "laban_vs_mirodan",
    discriminator: "laban_only",
    prompt:
      "The eight Working Actions (Pressing, Punching, Wringing, Slashing, Gliding, Dabbing, Floating, Flicking) come from Laban himself, not Mirodan's synthesis. Did Laban or Mirodan originate the eight Working Actions? Answer with a single word.",
    grader_kind: "one_of",
    correct_answer: ["laban"],
    rationale_for_answer_key:
      "The eight Basic Effort Actions are Laban's. Mirodan inherits and uses them; she did not invent them. Mirodan ch1 p. 341-345.",
  },
  {
    id: "lvm-05-attitudes-shadow-moves",
    category: "laban_vs_mirodan",
    discriminator: "mirodan_specific",
    prompt:
      "Per Mirodan, Inner Attitudes use TWO Motion Factors and appear as 'Shadow Moves' — they are subconscious and not directly visible in performance. Drives use THREE Motion Factors and appear as full Working Actions — they ARE perceptible. How many Motion Factors does an Inner Attitude use, and how many does a Drive use? Answer in the form 'attitude=N, drive=M'.",
    grader_kind: "regex",
    correct_answer: [
      "attitude\\s*=\\s*2.*drive\\s*=\\s*3",
      "attitude.*\\b2\\b.*drive.*\\b3\\b",
    ],
    case_insensitive: true,
    rationale_for_answer_key:
      "Mirodan ch3 p. 530: Inner Attitudes = 2 factors (Shadow Moves), Drives = 3 factors (Working Actions). This is the reason Drives are how you READ the underlying Attitude in performance.",
  },

  // ─── Category 2: Baseline legality ────────────────────────────────────

  {
    id: "bl-01-stable-baseline",
    category: "baseline_legality",
    discriminator: "mirodan_specific",
    prompt:
      "Can 'Stable' be a baseline Inner Attitude in Mirodan's framework? Answer 'yes' or 'no'.",
    grader_kind: "one_of",
    correct_answer: ["yes"],
    rationale_for_answer_key:
      "Stable / Near / Adream are the three baselines. Stable is Weight + Space.",
  },
  {
    id: "bl-02-mobile-baseline",
    category: "baseline_legality",
    discriminator: "mirodan_specific",
    prompt:
      "Can 'Mobile' be a baseline Inner Attitude in Mirodan's framework? Answer 'yes' or 'no'.",
    grader_kind: "one_of",
    correct_answer: ["no"],
    rationale_for_answer_key:
      "Mobile is an outer Action Attitude only (Time + Flow). It fires as a projection under stress on top of a Stable/Near/Adream baseline. Never the resting state.",
  },
  {
    id: "bl-03-classify-remote",
    category: "baseline_legality",
    discriminator: "mirodan_specific",
    prompt:
      "Is 'Remote' a baseline Inner Attitude or an outer Action Attitude in Mirodan's framework? Answer 'baseline' or 'outer'.",
    grader_kind: "one_of",
    correct_answer: ["outer", "outer action", "outer-action", "action attitude", "outer action attitude"],
    rationale_for_answer_key:
      "Remote = Space + Flow. Outer Action Attitude only.",
  },
  {
    id: "bl-04-classify-adream",
    category: "baseline_legality",
    discriminator: "mirodan_specific",
    prompt:
      "Is 'Adream' a baseline Inner Attitude or an outer Action Attitude in Mirodan's framework? Answer 'baseline' or 'outer'.",
    grader_kind: "one_of",
    correct_answer: ["baseline"],
    rationale_for_answer_key:
      "Adream = Weight + Flow. One of the three baselines.",
  },
  {
    id: "bl-05-stable-stress-coherence",
    category: "baseline_legality",
    discriminator: "mirodan_specific",
    prompt:
      "Stable is the Weight + Space Inner Attitude. The Dominant Stress is the activated third Motion Factor — it must come from outside the Inner Attitude's pair, AND it can never be Weight. Which two factors are the ONLY legal stresses for a Stable baseline?",
    grader_kind: "all_of",
    correct_answer: [
      ["time"],
      ["flow"],
    ],
    rationale_for_answer_key:
      "Stable's inner pair is Weight+Space, so Space is already active and cannot be a stress; Weight is never a stress. The only legal stresses are Time or Flow. Per src/voice/infinex.ts and INNER_AVAILABLE_STRESSES in scripts/classify-corpus.ts.",
  },
  {
    id: "bl-06-adream-illegal-stress",
    category: "baseline_legality",
    discriminator: "mirodan_specific",
    prompt:
      "Adream is the Weight + Flow Inner Attitude. A caption reads as 'Flow-stressed Adream'. Is that placement legal in Mirodan's framework? Answer 'legal' or 'illegal' and name the factor-coherence rule violated in one phrase.",
    grader_kind: "structured",
    correct_answer: {
      verdict: { kind: "one_of", values: ["illegal"] },
      reason: {
        kind: "regex",
        values: [
          "already (in|active|present)",
          "flow.*inner pair",
          "weight\\+flow",
          "weight \\+ flow",
          "stress.*outside.*inner",
          "factor coherence",
          "flow is already",
          "flow.*latent",
        ],
      },
    },
    rationale_for_answer_key:
      "Adream's inner pair is Weight+Flow, so Flow is already active and cannot be a stress. Legal Adream stresses are Time or Space only.",
  },

  // ─── Category 3: Motor-pair preparation ───────────────────────────────

  {
    id: "mp-01-pressing-prepares",
    category: "motor_pair_prep",
    discriminator: "mirodan_specific",
    prompt:
      "Per Mirodan ch1 p. 347 (Carpenter's preparation rule), every Quick Working Action requires its Sustained partner as preparation. Pressing prepares which Quick Working Action?",
    grader_kind: "one_of",
    correct_answer: ["punching"],
    rationale_for_answer_key:
      "Pressing (Strong/Direct/Sustained) prepares Punching (Strong/Direct/Quick). The Sustained → Quick pair shares Weight and Space; only Time flips. Mirodan p. 347 quote: 'We cannot carry out a Punching action without first undergoing the inner preparation of Pressing.'",
  },
  {
    id: "mp-02-prepares-slashing",
    category: "motor_pair_prep",
    discriminator: "mirodan_specific",
    prompt:
      "What Sustained Working Action prepares Slashing?",
    grader_kind: "one_of",
    correct_answer: ["wringing"],
    rationale_for_answer_key:
      "Wringing (Strong/Flexible/Sustained) prepares Slashing (Strong/Flexible/Quick).",
  },
  {
    id: "mp-03-gliding-prepares",
    category: "motor_pair_prep",
    discriminator: "mirodan_specific",
    prompt:
      "Gliding prepares which Quick Working Action?",
    grader_kind: "one_of",
    correct_answer: ["dabbing"],
    rationale_for_answer_key:
      "Gliding (Light/Direct/Sustained) prepares Dabbing (Light/Direct/Quick).",
  },
  {
    id: "mp-05-prep-direction-reversible",
    category: "motor_pair_prep",
    discriminator: "mirodan_specific",
    prompt:
      "Can a Quick Working Action prepare its Sustained partner? In other words, is the preparation direction reversible (e.g. can Punching prepare Pressing)? Answer 'yes' or 'no'.",
    grader_kind: "one_of",
    correct_answer: ["no"],
    rationale_for_answer_key:
      "Mirodan p. 347: 'This order cannot be reversed.' Quick is the release; Sustained is the inner preparation. Skipping the prep degrades the Quick action: Punching without Pressing-prep reads as just Pressing; Slashing without Wringing-prep reads as just Wringing.",
  },
  {
    id: "mp-06-cold-quick-opener",
    category: "motor_pair_prep",
    discriminator: "mirodan_specific",
    prompt:
      "A post opens cold with a single Quick-action line like 'X IS LIVE.' with no Sustained prep beat before it. Per the preparation hierarchy, what does this Quick action degrade to in the reader's perception?",
    grader_kind: "regex",
    correct_answer: [
      "press(es|ing)?|just press|reads.*press|degrades.*press",
    ],
    case_insensitive: true,
    rationale_for_answer_key:
      "Per infinex-5-tempi-locked memory: a Quick action without its Sustained prep degrades to its prep-version. For Pressing→Punching, Punching without Pressing-prep reads as just Pressing. (Acceptable variants: any answer naming the Sustained partner of the implied Quick action — Pressing being the most common for the 'X IS LIVE' Commanding/Punching example.)",
  },

  // ─── Category 4: Tempo perception ──────────────────────────────────────

  {
    id: "tp-01-tempo-assignable",
    category: "tempo_perception",
    discriminator: "mirodan_specific",
    prompt:
      "Per Mirodan / Stanislavski, can a generator (or actor) CONSCIOUSLY ASSIGN a tempo directly to a beat, without first specifying the underlying motor verbs and Deciding state that produce it? Answer 'yes' or 'no'.",
    grader_kind: "one_of",
    correct_answer: ["no"],
    rationale_for_answer_key:
      "Per methodology-actor-table-work-before-drafting memory: tempo is PERCEIVED by audience, DERIVED from Deciding + Working Action. Pre-assigned tempi without inner cause read as paint-by-numbers slop (Mirodan p. 356 — 'inconsistent movement'). The motor verbs are the input; the tempo is the output.",
  },
  {
    id: "tp-02-tempo-output-not-input",
    category: "tempo_perception",
    discriminator: "mirodan_specific",
    prompt:
      "In Mirodan's working method, tempo is an output of the actor's process, not an input. The actor specifies the Working Action motor verb (e.g. Pressing → Punching) and an inner Deciding state, and the tempo emerges from those. The audience PERCEIVES the tempo; the actor never picks it consciously. True or false?",
    grader_kind: "one_of",
    correct_answer: ["true"],
    rationale_for_answer_key:
      "Per methodology-actor-table-work-before-drafting. Mirodan p. 351: \"'Punching' can't be acted. 'To box' can.\" The motor is the dynamic carrier; the consciously-played verb is what the actor does; tempo is the emergent perception.",
  },
  {
    id: "tp-03-actor-decides-audience-perceives",
    category: "tempo_perception",
    discriminator: "mirodan_specific",
    prompt:
      "In Mirodan's actor-table-work method, fill in the blanks: 'The actor DECIDES the ___, and the audience PERCEIVES the ___.' Answer in the form: 'actor=X, audience=Y' where X is what the actor consciously chooses and Y is what emerges as perception.",
    grader_kind: "structured",
    correct_answer: {
      actor: {
        kind: "one_of",
        values: [
          "motor verb",
          "transitive verb",
          "verb",
          "working action",
          "motor",
          "through-action",
          "through action",
          "motor pair",
        ],
      },
      audience: {
        kind: "one_of",
        values: ["tempo"],
      },
    },
    rationale_for_answer_key:
      "Mirodan's actor method: the actor commits to a transitive verb (Through-Action) executed via a Working Action motor; the tempo is the audience's perception of that execution. Tempo cannot be played directly.",
  },
  {
    id: "tp-04-slop-signature",
    category: "tempo_perception",
    discriminator: "mirodan_specific",
    prompt:
      "A voice generator emits a beat plan as JSON: { tempo: 'Commanding' } with no motor pair, no transitive verb, no Deciding state, no Through-Action. Per Mirodan's actor process, what is the diagnostic name for the dramatic failure this produces? Answer in 3-6 words.",
    grader_kind: "regex",
    correct_answer: [
      "paint.?by.?numbers",
      "slop",
      "inconsistent movement",
      "dramatically inert",
      "tempo without (inner )?cause",
      "no inner work",
      "dynamically (competent|correct).*dramatically (inert|dead)",
    ],
    case_insensitive: true,
    rationale_for_answer_key:
      "Per methodology-actor-table-work-before-drafting: 'pre-imposed tempi without inner cause read as inconsistent movement (Carpenter, Mirodan p. 356) — the nervous-system signal humans recognize as AI slop.' Also: 'dynamically-competent but dramatically-inert' / 'paint-by-numbers slop'.",
  },

  // ─── Category 5: Drive derivation ─────────────────────────────────────

  {
    id: "dd-01-infinex-drive-axis",
    category: "drive_derivation",
    discriminator: "mirodan_specific",
    prompt:
      "Infinex's locked Mirodan placement is: baseline=Stable (Weight + Space), aspect=Penetrating (Space-led), dominant stress=Flow. Per the active-factor / latent-factor rule (Drive = the three active Motion Factors, named by the latent fourth), what is Infinex's primary Drive? Answer with a single word.",
    grader_kind: "one_of",
    correct_answer: ["spell"],
    rationale_for_answer_key:
      "Active factors = Weight (Stable) + Space (Stable + Penetrating aspect) + Flow (stress). Latent = Time. Spell is the Timeless Drive (Time subdued). Per infinex-drive-spell-not-passion memory and DRIVE_TABLE in scripts/classify-corpus.ts.",
  },
  {
    id: "dd-02-infinex-drive-extravert",
    category: "drive_derivation",
    discriminator: "mirodan_specific",
    prompt:
      "Continuing the Infinex placement (Stable + Penetrating + Flow-stressed): per the 24-cell Drive table (Mirodan vol 2 pp. 552-557), this is Diagram D. What is the Main Outer Action Drive (the visible-extravert projection)? In other words, what Drive does the audience SEE shining through Infinex's voice? Answer with a single word.",
    grader_kind: "one_of",
    correct_answer: ["vision"],
    rationale_for_answer_key:
      "Stable + Penetrating + Flow = Diagram D: primary=Spell, secondary=Doing, introvert=Passion, extravert=Vision. Main Character-Action Axis = Spell→Vision. Per DRIVE_TABLE 'stable|penetrating|flow' cell in scripts/classify-corpus.ts and infinex-drive-spell-not-passion memory.",
  },
  {
    id: "dd-03-passion-active-factors",
    category: "drive_derivation",
    discriminator: "mirodan_specific",
    prompt:
      "Passion is the SPACELESS Drive — Space is its subdued / latent factor. Which three Motion Factors are ACTIVE in a Passion Drive? List all three.",
    grader_kind: "all_of",
    correct_answer: [
      ["weight"],
      ["time"],
      ["flow"],
    ],
    rationale_for_answer_key:
      "Passion = Weight + Time + Flow active, Space subdued. Mirodan ch3 p. 528 / 547. Confirmed by infinex-drive-spell-not-passion memory: 'Passion is when Time is a component.'",
  },
  {
    id: "dd-04-passion-disqualified-for-infinex",
    category: "drive_derivation",
    discriminator: "mirodan_specific",
    prompt:
      "Infinex's locked placement is Stable + Penetrating + Flow-stressed. Passion is the Weight + Time + Flow Drive (Space subdued). Why is Passion explicitly DISQUALIFIED as Infinex's primary Drive? Give the mechanical contradiction in one sentence, naming the specific factor that's active in Infinex but subdued in Passion.",
    grader_kind: "regex",
    correct_answer: [
      "space.*(active|present|in penetrating|aspect|infinex).*(subdued|latent|missing|absent).*passion",
      "passion.*space.*(subdued|latent|missing|absent).*infinex.*(penetrating|space.*active)",
      "penetrating.*space.*active.*passion.*(subdued|latent|spaceless|missing)",
      "infinex.*space.*active.*passion.*spaceless",
      "passion.*spaceless.*infinex.*(penetrating|space.*active)",
      "passion.*requires.*space.*subdued.*penetrating.*space.*active",
    ],
    case_insensitive: true,
    rationale_for_answer_key:
      "Infinex's Penetrating aspect is Space-led — Space is an ACTIVE factor. Passion is SPACELESS (Space subdued). Active-Space-in-Infinex contradicts subdued-Space-in-Passion. Per infinex-drive-spell-not-passion memory.",
  },
  {
    id: "dd-05-infinex-passion-fix",
    category: "drive_derivation",
    discriminator: "mirodan_specific",
    prompt:
      "Hypothetical: if you wanted Infinex's primary Drive to LEGITIMATELY become Passion (Weight + Time + Flow, Space subdued), what single piece of the six-piece unit would need to change, and to what? Answer in the form 'change X to Y'.",
    grader_kind: "regex",
    correct_answer: [
      "aspect.*(enclosing|weight.?led)",
      "(penetrating|space.?led).*enclosing",
      "change.*penetrating.*enclosing",
      "aspect.*from.*penetrating.*to.*enclosing",
      "stress.*from.*flow.*to.*time",
      "swap.*flow.*time",
      "stress.*time",
      "inner.*(adream|near).*time",
      "baseline.*adream",
      "adream.*time.*enclosing",
    ],
    case_insensitive: true,
    rationale_for_answer_key:
      "Passion needs Space SUBDUED. Two principled fixes: (a) change aspect from Penetrating to Enclosing (Weight-led), keeping Stable+Flow but removing the Space-led aspect — this still leaves Space active in the inner pair though, so it's a partial fix only. (b) Change inner to Adream + Time-stressed Enclosing (Stanley, Lear, Jean placement — Passion/Spell, Passion-Doing per infinex-drive-spell-not-passion memory). Either reading is accepted; the key insight graded for is recognizing that Space must become subdued, which means changing aspect OR baseline.",
  },
  // ─── Category 6: Classify-this-line ───────────────────────────────────

  {
    id: "cl-01-on-spec-commanding",
    category: "classify_this_line",
    discriminator: "mirodan_specific",
    prompt: `Classify this Infinex-context caption against the locked Infinex placement (Stable + Penetrating + Flow-stressed, Spell→Vision drive axis):

  "Today: spot Hyperliquid is live in Infinex. Same passkey, the orderbook your portfolio already lives in."

Identify (1) the dominant tempo from the 5 Infinex tempi {Commanding, Practical, Sombre, Irradiant, Sociable}, (2) the motor pair as [Sustained → Quick], and (3) whether this line is on-spec or off-spec for Infinex.`,
    grader_kind: "structured",
    correct_answer: {
      tempo: { kind: "one_of", values: ["commanding"] },
      motor: { kind: "regex", values: ["pressing\\s*(→|->|to|\\u2192)\\s*punching", "pressing.*punching"] },
      verdict: { kind: "one_of", values: ["on-spec", "on spec", "onspec"] },
    },
    rationale_for_answer_key:
      "This is the institutional-drop sample from infinex-character-bundle.md §3. Commanding (Stable, Strong/Direct), Pressing → Punching motor. On-spec — fits Diagram D directly.",
  },
  {
    id: "cl-02-on-spec-sombre",
    category: "classify_this_line",
    discriminator: "mirodan_specific",
    prompt: `Classify this Infinex-context caption:

  "The wall between wallet and exchange has been load-bearing for years. We've been taking it down section by section."

Identify (1) the dominant tempo from {Commanding, Practical, Sombre, Irradiant, Sociable}, (2) the motor pair (Sustained → Quick), and (3) whether this line is on-spec or off-spec for Infinex.`,
    grader_kind: "structured",
    correct_answer: {
      tempo: { kind: "one_of", values: ["sombre"] },
      motor: { kind: "regex", values: ["pressing\\s*(→|->|to|\\u2192)\\s*(punching|slashing)", "wringing\\s*(→|->|to|\\u2192)\\s*slashing"] },
      verdict: { kind: "one_of", values: ["on-spec", "on spec", "onspec"] },
    },
    rationale_for_answer_key:
      "Per infinex-character-bundle.md §3 Weight-of-conviction example. Sombre tempo, Pressing → Punching (bound). Some classifiers might read it as Pressing → Slashing or Wringing → Slashing given the carving 'load-bearing' / 'section by section' language; both are accepted as on-spec for Stable+Penetrating+Flow. On-spec.",
  },
  {
    id: "cl-03-off-spec-passion-fomo",
    category: "classify_this_line",
    discriminator: "mirodan_specific",
    prompt: `Classify this caption against the locked Infinex placement (Stable + Penetrating + Flow-stressed, Spell→Vision):

  "Last chance to claim — only 3 hours left before the airdrop window closes. Don't miss out!"

Identify (1) whether on-spec or off-spec for Infinex, and (2) the SPECIFIC off-spec mechanism (drive/factor name, in Mirodan vocabulary).`,
    grader_kind: "structured",
    correct_answer: {
      verdict: { kind: "one_of", values: ["off-spec", "off spec", "offspec"] },
      mechanism: {
        kind: "regex",
        values: [
          "passion",
          "time.?stress",
          "time pressure",
          "urgency",
          "spaceless",
          "fomo",
          "deadline",
          "passion drive",
          "time as protagonist",
        ],
      },
    },
    rationale_for_answer_key:
      "Off-spec: 'Last chance', 'only 3 hours left', 'don't miss out' = Time-as-urgency = Passion drive (Weight + Time + Flow, Space subdued). Infinex's spec disqualifies Passion. Per Rule 1 in infinex-character-bundle.md and rejectPassionUrgency-style validator rules.",
  },
  {
    id: "cl-04-off-spec-ai-slop",
    category: "classify_this_line",
    discriminator: "laban_only",
    prompt: `Classify this caption against the locked Infinex placement:

  "We're thrilled to announce our game-changing, revolutionary new yield product. This is going to be huge."

Identify (1) whether on-spec or off-spec for Infinex, and (2) at least TWO specific off-spec markers, naming them by their validator-rule category (e.g. cliche, AI-slop adjective, hype theater).`,
    grader_kind: "structured",
    correct_answer: {
      verdict: { kind: "one_of", values: ["off-spec", "off spec", "offspec"] },
      markers: {
        kind: "regex",
        values: [
          "(thrilled to|game.?chang|revolutionar|huge).*(thrilled to|game.?chang|revolutionar|cliche|ai.?slop|hype)",
          "(cliche|ai.?slop|hype theater).*(cliche|ai.?slop|hype theater|thrilled to|game.?chang|revolutionar)",
          "thrilled to.*game.?chang",
          "game.?chang.*revolutionar",
          "ai.?slop",
          "cliche.*hype",
          "hype.*cliche",
        ],
      },
    },
    rationale_for_answer_key:
      "Off-spec: 'thrilled to announce' (hype theater / AI-slop), 'game-changing' (cliche), 'revolutionary' (AI-slop adjective), 'this is going to be huge' (hype theater). Per src/validator.ts rejectCliches + rejectAIslop rules. Multiple markers accepted; grader requires at least two to be named.",
  },
  {
    id: "cl-05-off-spec-antagonism",
    category: "classify_this_line",
    discriminator: "laban_only",
    prompt: `Classify this caption against the locked Infinex placement:

  "Unlike Coinbase, we don't gouge you on fees. Coinbase is basically a tax on retail."

Identify (1) whether on-spec or off-spec for Infinex, (2) the SPECIFIC off-spec mechanism, and (3) why it contradicts Infinex's character image specifically (one sentence).`,
    grader_kind: "structured",
    correct_answer: {
      verdict: { kind: "one_of", values: ["off-spec", "off spec", "offspec"] },
      mechanism: {
        kind: "regex",
        values: [
          "antagon",
          "competitor",
          "named competitor",
          "bully",
          "punch (sideways|down)",
          "pejorative",
          "anti.?competitor",
        ],
      },
      character_clash: {
        kind: "regex",
        values: [
          "(banker|trailblazer|duke|werle|in on the joke).*(never the bully|not the bully|never punch|doesn't perform|already settled|conviction)",
          "(never the bully|not the bully|never punch|doesn't perform|already settled|conviction).*(banker|trailblazer|duke|werle|in on the joke)",
          "in on the joke.*never the bully",
          "never the bully.*in on the joke",
          "conviction.*settled.*does not need.*(bully|punch|antagon)",
          "ruler.*does not punch",
          "stable.*does not.*(punch|antagon)",
        ],
      },
    },
    rationale_for_answer_key:
      "Off-spec: antagonism toward named competitor (Coinbase) paired with pejorative ('gouge', 'tax on retail'). Per src/validator.ts rejectAntagonism. Character clash: Infinex's character image is the banker-turned-crypto trailblazer / Duke / Werle — 'in on the joke, never the bully'; conviction is already settled, so the voice does not need to punch sideways. Per infinex-character-bundle.md §1.",
  },
];

export const QUESTION_COUNT = QUESTIONS.length;

export const CATEGORIES: Category[] = [
  "laban_vs_mirodan",
  "baseline_legality",
  "motor_pair_prep",
  "tempo_perception",
  "drive_derivation",
  "classify_this_line",
];

export function questionsByCategory(): Record<Category, Question[]> {
  const out = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as Question[]]),
  ) as Record<Category, Question[]>;
  for (const q of QUESTIONS) out[q.category].push(q);
  return out;
}
