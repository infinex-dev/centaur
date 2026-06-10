/**
 * Laban / Mirodan classifier for marketing copy corpora.
 *
 * v2 — corrected taxonomy + rich emission (2026-05-18 rewrite).
 *
 * Reads a markdown corpus with at least an ID and Text column per table, then
 * asks Sonnet to read each sample for placement on the Mirodan framework.
 *
 * Sonnet emits what it can READ from the prose. The framework derivations
 * (Inner Attitude from tempo, Drive Axis from Inner+Aspect+Stress) happen
 * mechanically in code via the canonical 24-cell table (see
 * `skills/laban-voice-for-ai-agents/references/drive-mapping.md`).
 *
 * Output per sample includes:
 *   - tempo_primary           — the dominant tempo Sonnet read in the prose
 *   - inner_attitude          — auto-derived from tempo_primary (the 24-tempo→inner map)
 *   - aspect, stress, pole    — placement detail, factor-coherence enforced
 *   - drive_primary           — Inner Character Drive (resting), from 24-cell table
 *   - drive_secondary         — Outer Character Drive (secondary formative), from 24-cell table
 *   - drive_introvert         — Main Inner Action Drive (hidden lining), from 24-cell table
 *   - drive_extravert         — Main Outer Action Drive (visible projection), from 24-cell table
 *   - drive_axis              — e.g. "Spell→Vision" — the Main Character-Action Axis
 *   - motor_pair              — Working Actions firing at the dominant tempo
 *   - outer_action_tempi      — any *secondary* tempi that flash within the sample as
 *                               transient Outer Action moments (e.g. an Unsociable beat
 *                               within a Stable-D post = a Remote moment)
 *   - outer_action_inners     — derived Inner Attitudes of the outer_action_tempi
 *   - confidence, rationale, literary_anchor
 *
 * Usage:
 *   pnpm tsx scripts/classify-corpus.ts <corpus.md> <output.json> \
 *     [--model=claude-sonnet-4-6] [--batch=10] [--limit=N]
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

// ---- CLI arg parsing -------------------------------------------------------

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = new Map(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const eq = a.indexOf("=");
      if (eq === -1) return [a.slice(2), "true"] as const;
      return [a.slice(2, eq), a.slice(eq + 1)] as const;
    }),
);

if (positional.length < 2) {
  console.error(
    "Usage: pnpm tsx scripts/classify-corpus.ts <corpus.md> <output.json> [--model=claude-sonnet-4-6] [--batch=10] [--limit=N]",
  );
  process.exit(1);
}

const CORPUS_PATH = path.resolve(positional[0]!);
const OUTPUT_PATH = path.resolve(positional[1]!);
const MODEL = flags.get("model") ?? "claude-sonnet-4-6";
const BATCH = Number.parseInt(flags.get("batch") ?? "10", 10);
const LIMIT = flags.has("limit") ? Number.parseInt(flags.get("limit")!, 10) : Infinity;

// ---- Types -----------------------------------------------------------------

type InnerAttitude =
  | "stable"
  | "near"
  | "adream"
  | "mobile"
  | "awake"
  | "remote"
  | "unknown";

type Stress = "time" | "space" | "flow" | "unknown";

type Pole =
  | "bound" | "free"          // Flow poles
  | "strong" | "light"        // Weight poles (Weight is never a stress, but pole on inner participation)
  | "direct" | "flexible"     // Space poles
  | "sustained" | "quick"     // Time poles
  | "n/a";

type Aspect = "enclosing" | "penetrating" | "radiating" | "circumscribing" | "unknown";

type Drive = "doing" | "spell" | "passion" | "vision" | "unknown";

type WorkingAction =
  | "pressing" | "wringing" | "gliding" | "floating"
  | "punching" | "slashing" | "dabbing" | "flicking";

interface Classification {
  // Primary placement
  tempo_primary: string;
  inner_attitude: InnerAttitude;
  aspect: Aspect;
  stress: Stress;
  pole: Pole;

  // Drive derivation (from 24-cell table)
  drive_primary: Drive;       // Inner Character Drive (resting)
  drive_secondary: Drive;     // Outer Character Drive (secondary formative)
  drive_introvert: Drive;     // Main Inner Action Drive (hidden lining)
  drive_extravert: Drive;     // Main Outer Action Drive (visible projection)
  drive_axis: string;         // e.g. "Spell→Vision"

  // Motor pair
  motor_pair: [WorkingAction, WorkingAction] | null;

  // Outer action moments
  outer_action_tempi: string[];
  outer_action_inners: InnerAttitude[];

  // Meta
  confidence: number;
  rationale: string;
  literary_anchor: string | null;
}

interface Sample {
  id: string;
  text: string;
}

interface ClassifiedSample extends Sample {
  classification: Classification;
}

// ---- Canonical Mirodan framework data -------------------------------------

const INNER_ATTITUDES: InnerAttitude[] = [
  "stable", "near", "adream", "mobile", "awake", "remote", "unknown",
];
const STRESSES: Stress[] = ["time", "space", "flow", "unknown"];
const POLES: Pole[] = [
  "bound", "free", "strong", "light",
  "direct", "flexible", "sustained", "quick", "n/a",
];
const ASPECTS: Aspect[] = ["enclosing", "penetrating", "radiating", "circumscribing", "unknown"];
const DRIVES: Drive[] = ["doing", "spell", "passion", "vision", "unknown"];
const WORKING_ACTIONS: WorkingAction[] = [
  "pressing", "wringing", "gliding", "floating",
  "punching", "slashing", "dabbing", "flicking",
];

// 24 tempi → which Inner Attitude they belong to.
const TEMPO_INNER: Record<string, InnerAttitude> = {
  // Stable
  "commanding": "stable", "receptive": "stable", "practical": "stable", "self-contained": "stable",
  // Near
  "materialistic": "near", "human": "near", "warm": "near", "cool": "near",
  // Adream
  "sombre": "adream", "irradiant": "adream", "overpowering": "adream", "diffused": "adream",
  // Mobile (outer of Adream-Time or Near-Flow)
  "unacknowledged": "mobile", "acknowledged": "mobile", "revealed": "mobile", "concealed": "mobile",
  // Remote (outer of Adream-Space or Stable-Flow)
  "egocentric": "remote", "altruistic": "remote", "sociable": "remote", "unsociable": "remote",
  // Awake (outer of Stable-Time or Near-Space)
  "acute": "awake", "doubting": "awake", "certain": "awake", "uncertain": "awake",
};

const ALL_TEMPI = Object.keys(TEMPO_INNER);
const MAIN_TEMPI = ALL_TEMPI.filter((t) =>
  ["stable", "near", "adream"].includes(TEMPO_INNER[t]!),
);
const OUTER_TEMPI = ALL_TEMPI.filter((t) =>
  ["mobile", "remote", "awake"].includes(TEMPO_INNER[t]!),
);

// Factor coherence: each Inner Attitude's available stresses + aspects.
const INNER_AVAILABLE_STRESSES: Record<string, Stress[]> = {
  // Baselines (3): stress = factor NOT in inner pair, minus Weight (Weight is never stress)
  stable: ["time", "flow"],   // Stable = W+S → stresses Time or Flow
  near:   ["space", "flow"],  // Near   = W+T → stresses Space or Flow
  adream: ["time", "space"],  // Adream = W+F → stresses Time or Space
  // Action attitudes (3): Mirodan treats these as outer-only; for classification
  // we allow Sonnet to mark them with whatever stress reads, treated as best-effort.
  mobile: ["time", "space", "flow"],
  awake:  ["time", "space", "flow"],
  remote: ["time", "space", "flow"],
};

const INNER_AVAILABLE_ASPECTS: Record<string, Aspect[]> = {
  // Each baseline: Enclosing (Weight-led, always available since Weight in pair) +
  // the aspect of its OTHER inner factor.
  stable: ["enclosing", "penetrating"],     // W-led or S-led
  near:   ["enclosing", "circumscribing"],  // W-led or T-led
  adream: ["enclosing", "radiating"],       // W-led or F-led
  // Action attitudes — best-effort
  mobile: ["circumscribing", "radiating"],  // T-led or F-led
  awake:  ["penetrating", "circumscribing"],// S-led or T-led
  remote: ["penetrating", "radiating"],     // S-led or F-led
};

/**
 * The canonical 24-cell drive table (Mirodan vol 2 pp. 552–557, illustrated at
 * 561a/563a/565a). For each (inner, aspect, stress) cell, the X-diagram has:
 *
 *   - BL: drive_primary   (Inner Character Drive — resting)
 *   - BR: drive_secondary (Outer Character Drive — secondary formative)
 *   - TL: drive_introvert (Main Inner Action Drive — hidden lining)
 *   - TR: drive_extravert (Main Outer Action Drive — visible projection)
 *   - axis: BL → TR (Main Character-Action Axis)
 *
 * Only Stable / Adream / Near produce embodied characters. The 12 Mobile /
 * Remote / Awake "diagrams" surface only as outer projections within these 12.
 */
interface DriveCell {
  primary: Drive;
  secondary: Drive;
  introvert: Drive;
  extravert: Drive;
}

const DRIVE_TABLE: Record<string, DriveCell> = {
  // STABLE (formative: doing + spell)
  "stable|enclosing|time":    { primary: "doing",   secondary: "spell",   introvert: "vision",  extravert: "passion" },
  "stable|penetrating|time":  { primary: "doing",   secondary: "spell",   introvert: "passion", extravert: "vision"  },
  "stable|enclosing|flow":    { primary: "spell",   secondary: "doing",   introvert: "vision",  extravert: "passion" },
  "stable|penetrating|flow":  { primary: "spell",   secondary: "doing",   introvert: "passion", extravert: "vision"  }, // Infinex Diagram D

  // ADREAM (formative: passion + spell)
  "adream|enclosing|space":   { primary: "spell",   secondary: "passion", introvert: "vision",  extravert: "doing"   },
  "adream|radiating|space":   { primary: "spell",   secondary: "passion", introvert: "doing",   extravert: "vision"  },
  "adream|enclosing|time":    { primary: "passion", secondary: "spell",   introvert: "vision",  extravert: "doing"   },
  "adream|radiating|time":    { primary: "passion", secondary: "spell",   introvert: "doing",   extravert: "vision"  },

  // NEAR (formative: doing + passion)
  "near|circumscribing|space":{ primary: "doing",   secondary: "passion", introvert: "vision",  extravert: "spell"   },
  "near|enclosing|space":     { primary: "doing",   secondary: "passion", introvert: "spell",   extravert: "vision"  },
  "near|circumscribing|flow": { primary: "passion", secondary: "doing",   introvert: "vision",  extravert: "spell"   },
  "near|enclosing|flow":      { primary: "passion", secondary: "doing",   introvert: "spell",   extravert: "vision"  },
};

function deriveDrives(inner: InnerAttitude, aspect: Aspect, stress: Stress): DriveCell | null {
  const key = `${inner}|${aspect}|${stress}`;
  return DRIVE_TABLE[key] ?? null;
}

// ---- Corpus parsing --------------------------------------------------------

function parseCorpus(markdown: string): Sample[] {
  const lines = markdown.split(/\r?\n/);
  const samples: Sample[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!isTableHeader(line, lines[i + 1])) {
      i++;
      continue;
    }
    const headerCells = splitTableRow(line);
    const idIdx = headerCells.findIndex((c) =>
      /\bid\b|^#$|^\s*#\s*$/i.test(c.trim()),
    );
    const textIdx = headerCells.findIndex((c) => /\btext\b/i.test(c.trim()));
    if (idIdx === -1 || textIdx === -1) {
      i += 2;
      continue;
    }
    i += 2;
    while (i < lines.length && lines[i]!.trim().startsWith("|")) {
      const rowCells = splitTableRow(lines[i]!);
      const id = (rowCells[idIdx] ?? "").trim();
      let text = (rowCells[textIdx] ?? "").trim();
      if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
        text = text.slice(1, -1);
      }
      text = text.replace(/\\\|/g, "|");
      if (id && text) samples.push({ id, text });
      i++;
    }
  }
  return samples;
}

function isTableHeader(header: string, sep: string | undefined): boolean {
  if (!header.trim().startsWith("|")) return false;
  if (!sep || !sep.trim().startsWith("|")) return false;
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-*:?\s*\|?\s*$/.test(sep);
}

function splitTableRow(row: string): string[] {
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|");
}

// ---- Anthropic tool schema -------------------------------------------------

type AnthropicTool = NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>[number];

function buildClassifyTool(): AnthropicTool {
  return {
    name: "classify_samples",
    description:
      "Emit one Mirodan / Laban placement reading per input sample. Read what is on the page. Use 'unknown' / 'n/a' freely when the sample is too short or ambiguous to read.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              classification: {
                type: "object",
                properties: {
                  tempo_primary: {
                    type: "string",
                    description:
                      "The single dominant Mirodan tempo the prose reads as. One of the 24 named tempi (Commanding, Sombre, Irradiant, Practical, Sociable, Materialistic, Human, Warm, Cool, Receptive, Self-Contained, Overpowering, Diffused, Unacknowledged, Acknowledged, Revealed, Concealed, Egocentric, Altruistic, Unsociable, Acute, Doubting, Certain, Uncertain), or 'n/a' when the sample is too short to read a tempo.",
                  },
                  aspect: { type: "string", enum: ASPECTS },
                  stress: { type: "string", enum: STRESSES },
                  pole: { type: "string", enum: POLES },
                  motor_pair: {
                    type: ["array", "null"],
                    items: { type: "string", enum: WORKING_ACTIONS },
                    minItems: 2,
                    maxItems: 2,
                  },
                  outer_action_tempi: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Any *secondary* tempi (especially Mobile/Remote/Awake outer-attitude tempi like Unsociable, Sociable, Acute, Acknowledged etc.) that flash within the sample as transient Outer Action moments. Empty array if the sample is single-register.",
                  },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  rationale: { type: "string" },
                  literary_anchor: { type: ["string", "null"] },
                },
                required: [
                  "tempo_primary", "aspect", "stress", "pole",
                  "motor_pair", "outer_action_tempi",
                  "confidence", "rationale", "literary_anchor",
                ],
              },
            },
            required: ["id", "classification"],
          },
        },
      },
      required: ["items"],
    },
  };
}

// ---- System prompt ---------------------------------------------------------

const SYSTEM_PROMPT = `You are a Laban / Mirodan placement classifier for marketing copy.

Veronica Mirodan's 1997 PhD synthesizes Laban Movement Analysis into a working character vocabulary. We adapt it here to classify the implicit character of brand copy. For each sample, read it for the placement it carries.

# Framework

## 4 Motion Factors
Weight (Strong/Light) · Time (Sustained/Quick) · Space (Direct/Flexible) · Flow (Bound/Free).

## Reading Weight (LOAD-BEARING — read this before choosing any tempo)
Weight is the visible trace of **Intending** — will, intention, desire, the push to impose oneself on circumstances (Mirodan Ch1 p. 281, 293) — expressed physically as muscular force / counter-pressure against gravity (Ch1 p. 292, 316). Read it from **will + exertion together**; never split the physical-force layer from its Intending root (Ch1 p. 312: the factor has no expressive power on its own).
- **Strong-Weight evidence** = asserted will / resolve / desire pushing against resistance ("we will take it down", "this stops now", "I refuse"), OR literal force / mass / heavy landing / weight-bearing pressure / sensual mass. **Light** = buoyancy, fine touch, will withheld, exertion without central-muscle contraction.
- **Epistemic certainty is NOT Weight.** "This is simply true / live / final / unhedged" is Space (**Direct**) + Awake (**certain**) — settled *awareness*, not asserted *will*. (Ch1 p. 298, 321; Ch2 p. 481.) Do NOT upgrade a confident factual line to Strong-Weight on the strength of its certainty alone.
- **Awake has no Weight in its constitutive pair (Space+Time), but Weight is *latent, not absent*** — the "certain" tempo's own motor is Pressing, a Strong action (Ch2 p. 481). Never cite certainty as "proof of zero Weight"; will simply isn't the *naming* factor there.
- **Commanding vs certain — the load-bearing test.** Both are Direct. Ask: does the line **exert will / impose a resolve** against resistance (→ **commanding**, Stable = Weight+Space, Pressing/Punching, p. 494), or **register a settled truth / awareness** (→ **certain**, Awake = Space+Time, p. 481)? Volitional pressure — not mere confidence — is the Weight signal.
- **Brevity is not Strong.** A short, hard, punchy line maps to Time (Quick) and maybe Space (Direct). Punching additionally requires Strong-Weight built from a Pressing preparation (Ch1 p. 347 — "we cannot carry out a Punching action without first undergoing the inner preparation of Pressing"). A short hard line with no will / weight-bearing build-up is a **Dab** (Light/Direct/Quick), not a Punch.

## 6 Inner Attitudes (2-factor combinations)

**3 baselines** — only these produce embodied characters:
- **stable** (Weight + Space) — intelligent ruler, decisions taken. Werle, Logan Roy, Aragorn, the Duke.
- **near** (Weight + Time) — down-to-earth, body-forward, relational. Big Daddy, Tony Soprano, the Nurse (R&J), Iago.
- **adream** (Weight + Flow) — dreamy, yielding, body-and-feel but no body. Hamlet, Hedda Gabler, Stanley, Ophelia, Stella, Brack.

**3 outer action attitudes** — fire as projections under stress; NEVER as baseline:
- **mobile** (Time + Flow) — fragmenting, multi-direction, scattered.
- **awake** (Space + Time) — alert sensor, strategist, noticing.
- **remote** (Space + Flow) — aristocratic-aloof, intellectual, withdrawn.

## Stress (the activated 3rd factor)
- **time** — urgency, immediacy, clock
- **space** — orientation, structural cognition, scanning
- **flow** — yielding, continuity, emotion-visible

⚠ **Weight is NEVER a stress.** It's in every baseline's inner pair. If a sample reads "weight-stressed", the stress is actually unknown.

## Available stresses per Inner Attitude (factor coherence — these are the ONLY legal stresses)
- stable → time OR flow (never space, never weight)
- near → space OR flow (never time, never weight)
- adream → time OR space (never flow, never weight)

If you read a sample that seems to want an illegal stress (e.g. "space-stressed stable"), the gut you feel is the **Aspect**, not the stress. Route as follows:
- "space-stressed stable" → Penetrating Stable (space-led aspect, time or flow stress)
- "flow-stressed adream" → Radiating Adream (flow-led aspect, time or space stress)
- "time-stressed near" → Circumscribing Near (time-led aspect, space or flow stress)

## Aspect (factor-led, available only when the inner contains that factor)
- **enclosing** — Weight-led. Available for stable, near, adream (Weight in all three baseline pairs).
- **penetrating** — Space-led. Available for stable, awake, remote.
- **radiating** — Flow-led. Available for adream, mobile, remote.
- **circumscribing** — Time-led. Available for near, mobile, awake.

## Pole (modifier on the stressed factor)
Pick the pole that fits the stressed factor:
- stress=time → sustained OR quick
- stress=space → direct OR flexible
- stress=flow → bound OR free
- stress=unknown → n/a

## 24 Tempi (4 per Inner Attitude)
- **Stable** (4): Commanding, Receptive, Practical, Self-Contained
- **Near** (4): Materialistic, Human, Warm, Cool
- **Adream** (4): Sombre, Irradiant, Overpowering, Diffused
- **Mobile** (4): Unacknowledged, Acknowledged, Revealed, Concealed
- **Remote** (4): Egocentric, Altruistic, Sociable, Unsociable
- **Awake** (4): Acute, Doubting, Certain, Uncertain

For each sample, pick the SINGLE dominant tempo (\`tempo_primary\`). If you can't pin one, use "n/a".

## Working Actions (motor pair)
The eight working actions and their canonical Weight×Space×Time composition (Mirodan Ch1 p. 341):
| Working action | Weight | Space | Time |
|---|---|---|---|
| Pressing | Strong | Direct | Sustained |
| Punching/Thrusting | Strong | Direct | Quick |
| Wringing | Strong | Flexible | Sustained |
| Slashing | Strong | Flexible | Quick |
| Gliding | **Light** | Direct | Sustained |
| Dabbing | **Light** | Direct | Quick |
| Floating | **Light** | Flexible | Sustained |
| Flicking | **Light** | Flexible | Quick |

**The motor MUST reconcile with the Weight pole — they cannot contradict.** Gliding, Dabbing, Floating, Flicking are LIGHT by definition; Wringing, Slashing, Pressing, Punching are STRONG. Never emit a Strong-Weight tempo with a Gliding/Dabbing/Floating/Flicking motor, or vice versa. If the prose's motor reads as a light touch (gliding/dabbing), the Weight is Light and the tempo is NOT commanding/sombre/overpowering/practical.

Emit as [sustained, quick] (e.g. ["pressing", "punching"]). Null when the sample is too short for a motor.

## Outer Action moments
Within a multi-register sample, *secondary* tempi can flash as transient Outer Action moments. E.g.:
- A Stable-D post that briefly lands as "Unsociable" (a Remote tempo) = a Remote moment.
- A Near-A post that flashes "Acknowledged" (a Mobile tempo) = a Mobile moment.

Record ALL such transient outer-action tempi in \`outer_action_tempi\` (array). Empty array if the sample reads single-register.

# Worked examples (use these as Mirodan-canonical anchors; don't anchor on any brand prior)

## Example 1 — Stable + Flow + Penetrating → Diagram D, Spell→Vision (Werle / the Duke / Infinex)

Sample: *"The wall between wallet and exchange has been load-bearing for years. We're taking it down section by section."*

Reads as: tempo_primary **Sombre** (Adream family — Sombre is Adream Strong+Bound, p. 460, NOT Stable); inner **adream** (Weight+Flow); aspect **penetrating** (Space-led — cuts to structural insight "load-bearing"); pole **bound** (held conviction, no urgency); motor **pressing → punching** (Sombre's canonical motor, p. 460). The Strong-Weight read IS justified here: "load-bearing… taking it down section by section" carries genuine force/exertion against resistance — that is real Weight evidence, not mere confidence. outer_action_tempi: []. literary_anchor: Werle (Wild Duck) / Logan Roy.

(Code will derive: drive_primary=spell, drive_secondary=doing, drive_introvert=passion, drive_extravert=vision, drive_axis="spell→vision".)

## Example 2 — an unhedged announcement that is NOT commanding (the Weight test in action)

Sample: *"Today: spot Hyperliquid is live in Infinex. Same passkey, the orderbook your portfolio already lives in."*

Reads as: tempo_primary **Certain** (Awake family), NOT commanding; inner read is **awake** (Space+Time) — alert, settled notice; aspect **penetrating** (Space-led); pole **direct**; motor null-to-light (a clean placing, no weight-bearing pressure). outer_action_tempi: [].
**Why not commanding:** the line is unhedged, categorical, final — but that is *Direct* (Space), and it **registers a settled fact**; it does not exert will or impose a resolve against resistance. Apply the commanding-vs-certain test: is the confidence an act of *will* (commanding) or *settled awareness* (certain)? Here it announces what is now true and orients the reader — settled awareness. So Awake **certain**, not commanding. (Weight is latent in Awake, not absent — Ch2 p. 474, 481 — so don't read this as "zero Weight"; read it as "will is not the load-bearing signal here.")

(If the same content asserted **will against resistance** — "We held this line for two years; today it breaks" — that added Intending/Weight could justify a Stable/commanding read. Epistemic confidence alone never does.)

## Example 3 — Adream + Time + Radiating → Passion→Vision (Ophelia / Lovborg / Blanche shape)

Sample: *"The money app that'll take you places."*

Reads as: tempo_primary **Overpowering** (Adream Strong+Free, p. 465); inner **adream** (Weight+Flow, yielding/dreamy); aspect **radiating** (Flow-led — expansive, lifting); pole **free**; motor **wringing → slashing** (Overpowering's canonical Strong+Flexible motor, p. 465 — NOT pressing→punching); outer_action_tempi: []. literary_anchor: Blanche DuBois projecting illusions.

(Derived: drive_primary=passion, drive_secondary=spell, drive_introvert=doing, drive_extravert=vision, drive_axis="passion→vision".)

## Example 4 — Near + Flow + Circumscribing → Passion→Spell (the Nurse / casual community voice)

Sample: *"gm, frens. Phantom Perps is live."*

Reads as: tempo_primary **Sociable** (Remote — Wait. Actually "gm, frens" is body-forward + casual + relational — that's NEAR territory. Re-read.) Tempo_primary **Warm** or **Cool**; inner **near**; aspect **circumscribing** (Time-led — using CT-native inherited form "gm/frens"); stress **flow**, pole **free**; motor gliding → dabbing; outer_action_tempi: []. literary_anchor: Anthony Bourdain casual mode.

(Derived: drive_primary=passion, drive_secondary=doing, drive_introvert=vision, drive_extravert=spell, drive_axis="passion→spell".)

## Example 5 — Stable + Time + Penetrating with Remote outer flash → "Unsociable beat"

Sample: *"You can't send to your own Infinex account address. Use Move instead."*

Reads as: tempo_primary **Certain** (Awake) or **Self-Contained** (Stable Light+Direct), NOT commanding; aspect **penetrating** (Space-led); pole **direct**; motor light (a clean placing/withholding, no force). outer_action_tempi: [**"Unsociable"**] — the curt refusal flashes a Remote-family Unsociable moment (Remote = Space+Flow, Unsociable = the "carved-off" tempo, p. 447).
**Why not commanding:** a direct factual refusal is settled and unhedged (Direct), but it **registers a constraint** — it does not assert will / impose a resolve against resistance. Apply the commanding-vs-certain test: settled awareness, not volitional pressure. Curtness reads as Quick/Direct (a Dab), not as Strong-Weight Punching. (Ch2 p. 481, 497.)

# Rules

- **Tempo_primary is the single dominant tempo.** If you can't pin one tempo, use "n/a".
- **outer_action_tempi captures transient outer moments.** A long sample with a refusal beat OR a sudden cultural beat should list those tempi here. Empty array if the sample is monochromatic.
- Read the prose for the drive it ACTUALLY carries. Rough heuristic (NOT definitional): future-pull ≈ vision; timeless-craft ≈ spell; getting-things-done ≈ doing; emotion-construction ≈ passion. Note "urgency" is Time/Quick-Deciding, not automatically Passion (Passion is Spaceless lost-Thinking emotion, Ch3 p. 534) — don't equate clock-urgency with Passion. Don't anchor on surface vocabulary alone.
- **Before any Strong-Weight tempo (commanding, practical, sombre, overpowering, warm, materialistic), apply the commanding-vs-certain test from "Reading Weight": is the confidence asserted *will* (Weight) or settled *awareness* (Space/certain)? Require will/resolve or literal force evidence — confidence/finality/brevity alone is not Weight.**
- Motor analysis is load-bearing AND must reconcile with the Weight pole (see Working Actions).
- **Use unknown / n/a freely.** A short label (1-2 words) is genuinely too short to read inner+aspect+stress. Be honest.
- Apply factor coherence: never emit illegal stress for the inner (see "Available stresses per Inner Attitude").
- Do NOT bias toward any specific brand placement. Each sample stands on its own.

# Output contract

Emit exactly ONE tool call to classify_samples with one item per input id, in input order. No prose outside the tool call.`;

// ---- Batch runner ----------------------------------------------------------

interface ToolItem {
  id: string;
  classification: Classification;
}

async function classifyBatch(
  client: Anthropic,
  batch: Sample[],
  batchIdx: number,
  totalBatches: number,
): Promise<ToolItem[]> {
  const userPayload = JSON.stringify(
    {
      instruction:
        "Classify each sample independently. Return one item per id, in the input order. Pick a single tempo_primary; record any transient outer-action moments in outer_action_tempi.",
      samples: batch,
    },
    null,
    2,
  );

  const maxTokens = Math.max(2048, batch.length * 1600);

  const t0 = Date.now();
  process.stderr.write(
    `[batch ${batchIdx + 1}/${totalBatches}] sending ${batch.length} sample(s) → ${MODEL}…\n`,
  );

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    tools: [buildClassifyTool()],
    tool_choice: { type: "tool", name: "classify_samples", disable_parallel_tool_use: true },
    messages: [{ role: "user", content: userPayload }],
  });

  const dtSec = ((Date.now() - t0) / 1000).toFixed(1);
  process.stderr.write(`[batch ${batchIdx + 1}/${totalBatches}] received in ${dtSec}s\n`);

  for (const block of response.content) {
    if (block.type !== "tool_use") continue;
    if (block.name !== "classify_samples") continue;
    const input = block.input as { items?: unknown };
    const items = Array.isArray(input.items) ? input.items : [];
    return items.flatMap((raw): ToolItem[] => {
      if (typeof raw !== "object" || raw === null) return [];
      const obj = raw as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : "";
      if (!id) return [];
      const c = (obj.classification as Record<string, unknown>) ?? {};
      return [{ id, classification: normalizeClassification(c) }];
    });
  }
  throw new Error(`batch ${batchIdx + 1}: model did not emit classify_samples tool call`);
}

function normalizeClassification(c: Record<string, unknown>): Classification {
  // Read what Sonnet emitted, with permissive parsing.
  const tempoRaw = typeof c.tempo_primary === "string" ? c.tempo_primary.trim() : "n/a";
  const tempoKey = tempoRaw.toLowerCase();
  // Canonicalize tempo name (preserve original case if it's a known tempo).
  const tempo_primary = TEMPO_INNER[tempoKey] ? tempoRaw : (tempoRaw && tempoRaw !== "n/a" ? tempoRaw : "n/a");

  // Auto-derive inner_attitude from tempo_primary.
  const innerFromTempo = TEMPO_INNER[tempoKey] ?? "unknown";

  const aspect = pickEnum(c.aspect, ASPECTS, "unknown");
  const stress = pickEnum(c.stress, STRESSES, "unknown");
  const pole = pickEnum(c.pole, POLES, "n/a");

  // Factor coherence: if Sonnet emitted a stress not legal for this inner, downgrade to unknown.
  let coherentStress: Stress = stress;
  if (innerFromTempo !== "unknown" && stress !== "unknown") {
    const legal = INNER_AVAILABLE_STRESSES[innerFromTempo] ?? [];
    if (!legal.includes(stress)) {
      coherentStress = "unknown";
    }
  }
  let coherentAspect: Aspect = aspect;
  if (innerFromTempo !== "unknown" && aspect !== "unknown") {
    const legal = INNER_AVAILABLE_ASPECTS[innerFromTempo] ?? [];
    if (!legal.includes(aspect)) {
      coherentAspect = "unknown";
    }
  }

  // Derive drive cell from (inner, aspect, stress).
  const cell = deriveDrives(innerFromTempo, coherentAspect, coherentStress);

  const motor = c.motor_pair;
  let motor_pair: [WorkingAction, WorkingAction] | null = null;
  if (Array.isArray(motor) && motor.length === 2) {
    const [a, b] = motor;
    if (
      typeof a === "string" && typeof b === "string" &&
      WORKING_ACTIONS.includes(a as WorkingAction) &&
      WORKING_ACTIONS.includes(b as WorkingAction)
    ) {
      motor_pair = [a as WorkingAction, b as WorkingAction];
    }
  }

  const outer_action_tempi: string[] = Array.isArray(c.outer_action_tempi)
    ? c.outer_action_tempi.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const outer_action_inners: InnerAttitude[] = outer_action_tempi
    .map((t) => TEMPO_INNER[t.toLowerCase()] ?? null)
    .filter((i): i is InnerAttitude => i !== null);

  const lit = c.literary_anchor;
  const literary_anchor =
    typeof lit === "string" && lit.trim().length > 0 ? lit : null;

  return {
    tempo_primary,
    inner_attitude: innerFromTempo,
    aspect: coherentAspect,
    stress: coherentStress,
    pole,
    drive_primary: cell?.primary ?? "unknown",
    drive_secondary: cell?.secondary ?? "unknown",
    drive_introvert: cell?.introvert ?? "unknown",
    drive_extravert: cell?.extravert ?? "unknown",
    drive_axis: cell ? `${cell.primary}→${cell.extravert}` : "n/a",
    motor_pair,
    outer_action_tempi,
    outer_action_inners,
    confidence:
      typeof c.confidence === "number" && Number.isFinite(c.confidence)
        ? Math.max(0, Math.min(1, c.confidence))
        : 0,
    rationale: typeof c.rationale === "string" ? c.rationale : "",
    literary_anchor,
  };
}

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

// ---- Main ------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  const markdown = fs.readFileSync(CORPUS_PATH, "utf8");
  const allSamples = parseCorpus(markdown);
  if (allSamples.length === 0) {
    console.error(`No samples parsed from ${CORPUS_PATH}. Check that the file has markdown tables with ID + Text columns.`);
    process.exit(1);
  }
  const samples = Number.isFinite(LIMIT) ? allSamples.slice(0, LIMIT) : allSamples;
  process.stderr.write(
    `Parsed ${allSamples.length} sample(s) from ${path.basename(CORPUS_PATH)}; classifying ${samples.length}.\n`,
  );

  const client = new Anthropic();
  const batches: Sample[][] = [];
  for (let i = 0; i < samples.length; i += BATCH) {
    batches.push(samples.slice(i, i + BATCH));
  }
  process.stderr.write(
    `Running ${batches.length} batch(es) of up to ${BATCH} with model ${MODEL}.\n`,
  );

  const byId = new Map<string, ToolItem>();
  for (let b = 0; b < batches.length; b++) {
    const items = await classifyBatch(client, batches[b]!, b, batches.length);
    for (const item of items) byId.set(item.id, item);
    const received = items.length;
    if (received !== batches[b]!.length) {
      const missing = batches[b]!.filter((s) => !byId.has(s.id)).map((s) => s.id);
      process.stderr.write(
        `[batch ${b + 1}/${batches.length}] WARNING: expected ${batches[b]!.length} items, got ${received}. Missing: ${missing.join(", ") || "(none)"}\n`,
      );
    }
  }

  const output: ClassifiedSample[] = samples.map((s) => {
    const found = byId.get(s.id);
    if (found) {
      return { id: s.id, text: s.text, classification: found.classification };
    }
    return {
      id: s.id,
      text: s.text,
      classification: {
        tempo_primary: "n/a",
        inner_attitude: "unknown",
        aspect: "unknown",
        stress: "unknown",
        pole: "n/a",
        drive_primary: "unknown",
        drive_secondary: "unknown",
        drive_introvert: "unknown",
        drive_extravert: "unknown",
        drive_axis: "n/a",
        motor_pair: null,
        outer_action_tempi: [],
        outer_action_inners: [],
        confidence: 0,
        rationale: "(no classification returned)",
        literary_anchor: null,
      },
    };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  process.stderr.write(`Wrote ${output.length} classification(s) to ${OUTPUT_PATH}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
