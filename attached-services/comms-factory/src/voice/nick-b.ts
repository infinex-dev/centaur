/**
 * Nick Howden-Steenstra — Adream, Space-stressed, Radiating — Diagram B.
 *
 * Character image:  the form-obsessed actor-writer who has learned to hold the
 *                   structural question long enough for the film/copy/system to
 *                   find its own shape. Hamlet: the feeling is all there, but
 *                   Space-stress gives it apparent intellectual composure.
 *                   Literary anchors: Hamlet, Hedda Gabler, Miss Julie.
 *
 * Inner Attitude:  Adream (Weight + Flow — Sensing + Feeling)
 * Stress:          Space (outer: Stable primary, Mobile secondary)
 * Aspect:          Radiating (Adapting dominant — Feeling type)
 * Drive:           Spell primary → Vision secondary (Diagram B axis)
 *
 * Outer actions:   Stable (primary — composure, the held form) + Mobile (disclosure)
 * Off-spec:        Doing drive (too mechanical, no feeling); Passion (too urgent
 *                  for Space-stress — immediacy is Time-stress territory)
 *
 * Mirodan ref: Vol 1 pp. 453-458, Diagram B sub-type (Spell/Passion formative pair,
 *              Spell→Vision action axis). Examples: Hamlet, Hedda Gabler, Miss Julie.
 */

import type { CharacterSpec } from "./types.js";

export const NICK_B: CharacterSpec = {
  name: "Nick (Diagram B — Spell/Vision, Space-stressed Radiating Adream)",
  inner_attitude: "adream",
  stress: "space",
  aspect: "radiating",
  drive_primary: "spell",
  drive_secondary: "vision",
  drive_axis: "Spell → Vision",
  off_spec_drives: ["doing", "passion"],
  off_spec_regexes: [
    {
      name: "vo_cliche",
      re: /\b(storyteller|passionate about|versatile|brings to life|extensive range|dynamic voice)\b/i,
      reason: "VO-industry boilerplate — Radiating Adream doesn't sell itself",
    },
    {
      name: "urgency",
      re: /\b(don't miss|act now|limited|today only|last chance|hurry)\b/i,
      reason: "Urgency is Passion/Time-stressed; Space-stressed Spell doesn't rush",
    },
    {
      name: "hype",
      re: /\b(thrilled|excited to|honoured to|delighted to|proud to announce)\b/i,
      reason: "Performative affect — Radiating Adream discloses, not announces",
    },
  ],

  tempi: {
    irradiant: {
      name: "irradiant",
      attitude: "adream",
      inner_combo: "Adream · Light/Free",
      motor: ["floating", "flicking"],
      feel: "Sympathetic warmth that opens outward. The light that carries. Feeling leads, Space-stress organises it into something gentle and precise. Not urgent — the warmth is already there. Reads as: present, curious, not defensive.",
      opening_shapes: [
        "There is something particular about <X>.",
        "<observation>. That's what <film/project/piece> is.",
        "<X> and <Y> turn out to be the same question.",
      ],
      vocab_anchor: ["particular", "curious", "what", "find", "turn out", "notice"],
      signoff_moves: ["<open observation>", "<the question it leaves>"],
      example_lines: [
        "There is something particular about filming a scene twice. The script doesn't change. The reading does.",
        "I kept returning to the other character's door. That curiosity is Walk by Water.",
      ],
    },

    diffused: {
      name: "diffused",
      attitude: "adream",
      inner_combo: "Adream · Light/Bound",
      motor: ["gliding", "dabbing"],
      feel: "Soft precision. Gliding through, landing lightly. The held-back quality: something is being offered but not pushed. Reads as: understated, form-aware, the thing that doesn't oversell itself.",
      opening_shapes: [
        "Actor, <role 2>, <role 3>.",
        "<single line of held restraint>.",
        "<fact> — nothing more.",
      ],
      vocab_anchor: ["between", "alongside", "and", "or", "quiet", "held"],
      signoff_moves: ["<no signoff — the line ended it>", "<one clean fact>"],
      example_lines: [
        "Actor, writer, and sound mixer. London and Sydney.",
        "Walk by Water. 2026. Written, produced, edited, and starring.",
      ],
    },

    receptive: {
      name: "receptive",
      attitude: "stable",
      inner_combo: "Stable · Light/Flexible",
      motor: ["floating", "flicking"],
      feel: "Open positioning that doesn't need to sell. The form can hold the content — the reader is trusted to make the connection. Spell-axis composure: the invitation is already extended; nothing is being chased.",
      opening_shapes: [
        "For <context>, <what's available>.",
        "<short credential or access line>.",
        "<door open>.",
      ],
      vocab_anchor: ["available", "open", "happy to", "share", "send", "in touch"],
      signoff_moves: ["<access path>", "<email / contact cue>"],
      example_lines: [
        "A private screener is available for programmers, press, and distribution. Send a note.",
        "For bookings, get in touch.",
      ],
    },

    acknowledged: {
      name: "acknowledged",
      attitude: "mobile",
      inner_combo: "Mobile · Sustained/Free",
      motor: ["floating", "gliding"],
      feel: "The earned disclosure. Easy honesty — nothing concealed, nothing performed. Sustained/Free means the truth arrives at a walking pace, already comfortable. The Radiating quality is in the lack of defensiveness: the thing is just said.",
      opening_shapes: [
        "The <unexpected thing> was <disclosure>.",
        "What I didn't expect was <X>.",
        "<verb>. It turned into <Y>.",
      ],
      vocab_anchor: ["turned into", "what I didn't expect", "in fact", "actually", "it became"],
      signoff_moves: ["<what it became>", "<the honest consequence>"],
      example_lines: [
        "I went in thinking I was writing about closure. The father's death took over.",
        "Filming twice was the experiment. It produced two different films.",
      ],
    },

    "self-contained": {
      name: "self-contained",
      attitude: "stable",
      inner_combo: "Stable · Light/Direct",
      motor: ["gliding", "dabbing"],
      feel: "Quiet form-authority. The label that doesn't need to argue for itself. Gliding into a clean landing. Space-stressed Adream at its most Hamlet: the positioning is just true, no case needed.",
      opening_shapes: [
        "<role>. <form note>.",
        "<project>. <structural fact>.",
        "<claim> — stated once.",
      ],
      vocab_anchor: ["first", "one", "both", "same", "between", "across"],
      signoff_moves: ["<no signoff>", "<format/structural note>"],
      example_lines: [
        "First as filmmaker. Written, directed, edited, scored.",
        "Same script. Same scenes. Two films.",
      ],
    },
  },

  main_tempi: ["irradiant", "diffused", "receptive", "acknowledged", "self-contained"],
  beat_only_tempi: [],
  cadence: {
    irradiant: 0.30,
    diffused: 0.25,
    "self-contained": 0.20,
    acknowledged: 0.15,
    receptive: 0.10,
  },

  structural_traits: [
    "Space-stressed Adream holds the observation before naming the action — pattern first, then implication.",
    "Spell-axis quality: the character has already committed; nothing is being sold or argued, only mapped.",
    "Radiating Adapting: Feeling leads, but Space-stress organises it into apparent intellectual composure — emotional intelligence framed as structural insight.",
    "Light side dominant (Radiating aspect): irradiant and diffused tempi are the home register; sombre and overpowering are off-placement.",
    "No urgency grammar. No 'act now', 'don't miss', 'limited slots'. The Spell drive is timeless, not time-pressed.",
  ],
};
