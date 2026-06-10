/**
 * Nick Howden-Steenstra — Adream, Time-stressed, Radiating — Diagram D.
 *
 * Character image:  the actor-writer who follows feeling into form. Passion
 *                   drive makes direct contact with the material; Time-stress
 *                   means the inner splits into Near + Mobile before it
 *                   consolidates. The disclosure arrives before the frame.
 *                   Literary anchors: Ophelia, Blanche DuBois, Eilert Lovborg.
 *
 * Inner Attitude:  Adream (Weight + Flow — Sensing + Feeling)
 * Stress:          Time (outer: Mobile primary, Stable secondary)
 * Aspect:          Radiating (Adapting dominant — Feeling type)
 * Drive:           Passion primary → Vision secondary (Diagram D axis)
 *
 * Outer actions:   Mobile primary (revealed, acknowledged — disclosure fires first)
 *                  Stable secondary (self-contained, receptive — composure arrives after)
 * Off-spec:        Doing drive (too mechanical, no feeling); Spell (too composed
 *                  and timeless — Time-stressed characters don't do inevitability grammar)
 *
 * Mirodan ref: Vol 1 pp. 453-458, Diagram D sub-type (Passion/Spell formative pair,
 *              Passion→Vision action axis). Examples: Ophelia, Blanche, Lovborg.
 */

import type { CharacterSpec } from "./types.js";

export const NICK_D: CharacterSpec = {
  name: "Nick (Diagram D — Passion/Vision, Time-stressed Radiating Adream)",
  inner_attitude: "adream",
  stress: "time",
  aspect: "radiating",
  drive_primary: "passion",
  drive_secondary: "vision",
  drive_axis: "Passion → Vision",
  off_spec_drives: ["doing", "spell"],
  off_spec_regexes: [
    {
      name: "vo_cliche",
      re: /\b(storyteller|passionate about|versatile|brings to life|extensive range|dynamic voice)\b/i,
      reason: "VO-industry boilerplate — Radiating Adream discloses, not markets itself",
    },
    {
      name: "hype",
      re: /\b(thrilled|excited to|honoured to|delighted to|proud to announce)\b/i,
      reason: "Performative affect — Radiating Adream feels without performing feeling",
    },
    {
      name: "spell_composure",
      re: /\b(inevitable|always known|long understood|timeless|it was only a matter of)\b/i,
      reason: "Spell-axis inevitability grammar — Time-stressed Passion doesn't do inevitability",
    },
  ],

  tempi: {
    irradiant: {
      name: "irradiant",
      attitude: "adream",
      inner_combo: "Adream · Light/Free",
      motor: ["floating", "flicking"],
      feel: "Sympathetic exultation — the feeling that opens outward before it has a frame. Passion-axis means the irradiance is more immediate, more unguarded than in B. The warmth arrives first; the structure comes after. Reads as: present, responsive, delighted by the found thing.",
      opening_shapes: [
        "I followed <X>. <Y> came with it.",
        "<observation>. That became the film.",
        "<immediate sensory note>.",
      ],
      vocab_anchor: ["followed", "came with", "found", "unexpected", "became", "still"],
      signoff_moves: ["<what it became>", "<the found consequence>"],
      example_lines: [
        "I followed a formal question. The film found its shape on the river.",
        "Voice work I've done for the BBC, HSBC, Johnnie Walker. The range is real.",
      ],
    },

    revealed: {
      name: "revealed",
      attitude: "mobile",
      inner_combo: "Mobile · Quick/Free",
      motor: ["dabbing", "flicking"],
      feel: "Sudden disclosure — the truth that surfaces before the thought is complete. Quick/Free means no filter, no performance. Passion-axis: constructing/unbuilding in one movement. The thing just comes out. Reads as: honest, quick, undefended.",
      opening_shapes: [
        "The <unexpected thing> was <disclosure>.",
        "<fact> — I hadn't expected that.",
        "That wasn't the <thing> I was making.",
      ],
      vocab_anchor: ["shock", "wasn't", "unexpected", "that changed", "turned out", "came out of"],
      signoff_moves: ["<the honest consequence>", "<no landing — it lands itself>"],
      example_lines: [
        "The shock was the father's death. That wasn't the film I thought I was making.",
        "We shot it twice. The actors swapped roles. It produced two different films.",
      ],
    },

    sombre: {
      name: "sombre",
      attitude: "adream",
      inner_combo: "Adream · Strong/Bound",
      motor: ["pressing", "punching"],
      feel: "Weight pressing into a clear landing. The underdog gravity — the thing that sits in the body. Passion-axis gives the sombre quality a combative undertone: this isn't resignation, it's the resolve underneath the weight. Reads as: direct, grounded, not easily moved.",
      opening_shapes: [
        "The industry <does X>. We <did Y>.",
        "<the constraint>. <what we did instead>.",
        "<body-first observation>.",
      ],
      vocab_anchor: ["industry", "against", "instead", "despite", "without", "the actual"],
      signoff_moves: ["<the alternative stated flatly>", "<no decoration>"],
      example_lines: [
        "The industry casts to type. We swapped the roles.",
        "A rebellion against one habit. Both versions exist because of it.",
      ],
    },

    acknowledged: {
      name: "acknowledged",
      attitude: "mobile",
      inner_combo: "Mobile · Sustained/Free",
      motor: ["floating", "gliding"],
      feel: "Open admission — the honest account at a walking pace. Time-stressed acknowledged moves faster than in Diagram B; the disclosure is still easy but it has Near energy underneath it. The physical world is closer. Reads as: warm, body-present, straightforwardly honest.",
      opening_shapes: [
        "We <did X>. Along a <physical detail>.",
        "<event>. <honest consequence>.",
        "<plain statement of the situation>.",
      ],
      vocab_anchor: ["we", "along", "near", "stretch", "between", "together"],
      signoff_moves: ["<the physical anchor>", "<the plain fact>"],
      example_lines: [
        "Shot along a stretch of the Thames. February 2020, just before the pandemic.",
        "Commercial, brand, and narrative. BBC. HSBC. Johnnie Walker.",
      ],
    },

    overpowering: {
      name: "overpowering",
      attitude: "adream",
      inner_combo: "Adream · Strong/Free",
      motor: ["wringing", "slashing"],
      feel: "Weight unleashed — the strong feeling that breaks free of restraint. Passion-axis gives this real construction/destruction energy: something is being built and dismantled in the same sentence. Reads as: bold, uncontained, alive to the contradiction.",
      opening_shapes: [
        "<two contradictory things in one sentence>.",
        "I couldn't <X>. So I <Y>.",
        "<the contradiction stated without apology>.",
      ],
      vocab_anchor: ["couldn't", "so", "both", "same", "contradiction", "and yet"],
      signoff_moves: ["<the contradiction left open>", "<the result, unresolved>"],
      example_lines: [
        "I couldn't stop thinking about the other character. That's the whole film.",
        "Presented as one half. You bring the other.",
      ],
    },
  },

  main_tempi: ["irradiant", "revealed", "sombre", "acknowledged", "overpowering"],
  beat_only_tempi: [],
  cadence: {
    revealed: 0.30,
    irradiant: 0.25,
    sombre: 0.20,
    acknowledged: 0.15,
    overpowering: 0.10,
  },

  structural_traits: [
    "Time-stressed Adream: feeling fires before frame — disclosure arrives, then (maybe) the structure catches up.",
    "Passion-axis directness: direct contact with the material, building and unbuilding in one movement, no timeless inevitability.",
    "Mobile primary outer: the revealed and acknowledged tempi dominate — things surface rather than settle.",
    "Near secondary: body-anchored, physical world close. Thames, bridge, walk, stretch.",
    "Radiating aspect: Feeling dominant over Sensing — empathy frame, not sensory dominance.",
    "Underdog grammar is native: Passion drive carries weight against authority from the same level, not above it.",
  ],
};
