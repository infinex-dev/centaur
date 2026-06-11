import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CharacterSpec, TempoName } from "./voice/types.js";
import { ALL_TEMPO_NAMES } from "./voice/types.js";

export const ACTOR_MEMORY_VERSION = "actor-memory-v2.1";
export const DIRECTOR_MEMORY_VERSION = "director-memory-v2.1";

export interface CanonicalMirodanSource {
  id: string;
  label: string;
  path: string;
  role: "chapter" | "combined-reference" | "primary-pdf" | "source-location-memory";
}

export interface MirodanSourceIndexEntry extends CanonicalMirodanSource {
  exists: boolean;
  bytes: number;
  sha256: string | null;
  error: string | null;
}

export interface ActorMemoryPack {
  version: string;
  prompt_hash: string;
  source_index: MirodanSourceIndexEntry[];
  system_prompt: string;
}

export interface DirectorMemoryPack {
  version: string;
  prompt_hash: string;
  source_index: MirodanSourceIndexEntry[];
  system_prompt: string;
}

interface TempoTaxonomy {
  name: TempoName;
  attitude: string;
  factor_shape: string;
  motor: string;
  canonical_shorthand: string;
  source_ref: string;
}

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MIRODAN_SOURCE_DIR = join(REPO_ROOT, "third_party", "mirodan");
const mirodanSourcePath = (filename: string): string => join(MIRODAN_SOURCE_DIR, filename);

export const CANONICAL_MIRODAN_SOURCES: CanonicalMirodanSource[] = [
  {
    id: "ch1-basic-concepts",
    label: "Mirodan Ch. I: Basic Concepts",
    path: mirodanSourcePath("mirodan-ch1-basic-concepts.md"),
    role: "chapter",
  },
  {
    id: "ch2-attitudes",
    label: "Mirodan Ch. II: Attitudes",
    path: mirodanSourcePath("mirodan-ch2-attitudes.md"),
    role: "chapter",
  },
  {
    id: "ch3-drives",
    label: "Mirodan Ch. III: Externalized Drives",
    path: mirodanSourcePath("mirodan-ch3-drives.md"),
    role: "chapter",
  },
  {
    id: "ch4-applications",
    label: "Mirodan Ch. IV: Applications",
    path: mirodanSourcePath("mirodan-ch4-applications.md"),
    role: "chapter",
  },
  {
    id: "combined-reference",
    label: "Operator synthesis: laban-mirodan-reference-2026-04-28",
    path: mirodanSourcePath("laban-mirodan-reference-2026-04-28.md"),
    role: "combined-reference",
  },
  {
    id: "vol2-pdf",
    label: "Mirodan PhD 1997 Vol. 2 PDF",
    path: mirodanSourcePath("Mirodan-PhD-1997-Vol2.pdf"),
    role: "primary-pdf",
  },
  {
    id: "source-location-memory",
    label: "Claude memory: canonical Mirodan source locations",
    path: mirodanSourcePath("mirodan-source-files-location.md"),
    role: "source-location-memory",
  },
];

export const MIRODAN_24_TEMPI: TempoTaxonomy[] = [
  { name: "commanding", attitude: "Stable", factor_shape: "Strong + Direct", motor: "Pressing -> Punching", canonical_shorthand: "Commanding demonstration or acceptance of a 'bold resolve'", source_ref: "Mirodan Vol. 2 p. 494" },
  { name: "practical", attitude: "Stable", factor_shape: "Strong + Flexible", motor: "Wringing -> Slashing", canonical_shorthand: "Developing intention to cast or to submit to a 'spell-binding power'", source_ref: "Mirodan Vol. 2 p. 495" },
  { name: "self-contained", attitude: "Stable", factor_shape: "Light + Direct", motor: "Gliding -> Dabbing", canonical_shorthand: "Cautious expression or cautious acceptance of a 'gentle deference'", source_ref: "Mirodan Vol. 2 p. 497" },
  { name: "receptive", attitude: "Stable", factor_shape: "Light + Flexible", motor: "Floating -> Flicking", canonical_shorthand: "Receptive acceptance or receptive rejection of a 'welcoming tenderness'", source_ref: "Mirodan Vol. 2 p. 495" },
  { name: "sombre", attitude: "Adream", factor_shape: "Strong + Bound", motor: "Pressing -> Punching", canonical_shorthand: "Overpowering, sombre unawareness of a 'staunch resolve' or of an 'aggressive resolve'", source_ref: "Mirodan Vol. 2 p. 460" },
  { name: "overpowering", attitude: "Adream", factor_shape: "Strong + Free", motor: "Wringing -> Slashing", canonical_shorthand: "Irradiant intention of 'casting a spell' or of 'being spell-bound'", source_ref: "Mirodan Vol. 2 p. 465" },
  { name: "diffused", attitude: "Adream", factor_shape: "Light + Bound", motor: "Gliding -> Dabbing", canonical_shorthand: "Diffused sensation of a 'welcome feeling' or of an 'irreconcilable feeling'", source_ref: "Mirodan Vol. 2 p. 468" },
  { name: "irradiant", attitude: "Adream", factor_shape: "Light + Free", motor: "Floating -> Flicking", canonical_shorthand: "Irradiant unfolding or irradiant enfolding of a 'sympathetic exultation'", source_ref: "Mirodan Vol. 2 p. 462" },
  { name: "materialistic", attitude: "Near", factor_shape: "Strong + Quick", motor: "Punching / Slashing", canonical_shorthand: "A sudden aggressive intention towards or away from a 'materialistic desire'", source_ref: "Mirodan Vol. 2 p. 423" },
  { name: "human", attitude: "Near", factor_shape: "Light + Sustained", motor: "Floating / Gliding", canonical_shorthand: "Slow decision to express or reject a 'gentle tenderness'", source_ref: "Mirodan Vol. 2 p. 426" },
  { name: "warm", attitude: "Near", factor_shape: "Strong + Sustained", motor: "Pressing / Wringing", canonical_shorthand: "A staunch intention of 'warm consent' or of 'warm dissent'", source_ref: "Mirodan Vol. 2 p. 427" },
  { name: "cool", attitude: "Near", factor_shape: "Light + Quick", motor: "Dabbing / Flicking", canonical_shorthand: "Sudden pert intention of 'intimacy' or 'estrangement'", source_ref: "Mirodan Vol. 2 p. 429" },
  { name: "unacknowledged", attitude: "Mobile outer", factor_shape: "Quick + Bound", motor: "Punching / Slashing", canonical_shorthand: "Concealed sudden decision accepting or denying an 'unacknowledged feeling'", source_ref: "Mirodan Vol. 2 p. 514" },
  { name: "acknowledged", attitude: "Mobile outer", factor_shape: "Sustained + Free", motor: "Floating / Gliding", canonical_shorthand: "Slow revelation of enjoying or evading 'affection'", source_ref: "Mirodan Vol. 2 p. 515" },
  { name: "revealed", attitude: "Mobile outer", factor_shape: "Quick + Free", motor: "Dabbing / Flicking", canonical_shorthand: "Sudden revelation expressing or rejecting an 'ardent sympathy'", source_ref: "Mirodan Vol. 2 p. 518" },
  { name: "concealed", attitude: "Mobile outer", factor_shape: "Sustained + Bound", motor: "Pressing / Wringing", canonical_shorthand: "A slow decision in favour or against a 'frigid self-assertion'", source_ref: "Mirodan Vol. 2 p. 520" },
  { name: "egocentric", attitude: "Remote outer", factor_shape: "Direct + Bound", motor: "Pressing -> Punching", canonical_shorthand: "Narrowing egocentric withdrawal into or rejection of an 'unsociable solitude'", source_ref: "Mirodan Vol. 2 p. 442" },
  { name: "unsociable", attitude: "Remote outer", factor_shape: "Flexible + Bound", motor: "Wringing -> Slashing", canonical_shorthand: "Growing reflective image of a 'welcome solitude' or of an 'unwelcome solitude'", source_ref: "Mirodan Vol. 2 p. 447" },
  { name: "sociable", attitude: "Remote outer", factor_shape: "Direct + Free", motor: "Gliding -> Dabbing", canonical_shorthand: "Developing or contracting feeling of 'sociable companionship'", source_ref: "Mirodan Vol. 2 p. 447" },
  { name: "altruistic", attitude: "Remote outer", factor_shape: "Flexible + Free", motor: "Floating -> Flicking", canonical_shorthand: "Embracing altruistic feeling for or against a 'sociable cordiality'", source_ref: "Mirodan Vol. 2 p. 444" },
  { name: "acute", attitude: "Awake outer", factor_shape: "Direct + Quick", motor: "Punching / Dabbing", canonical_shorthand: "Acute sudden decision in favour of or against an 'idea'", source_ref: "Mirodan Vol. 2 p. 480" },
  { name: "doubting", attitude: "Awake outer", factor_shape: "Flexible + Sustained", motor: "Floating / Wringing", canonical_shorthand: "Slowly dawning attention towards or away from a 'doubting awareness'", source_ref: "Mirodan Vol. 2 p. 481" },
  { name: "certain", attitude: "Awake outer", factor_shape: "Direct + Sustained", motor: "Pressing / Gliding", canonical_shorthand: "Slow dawning of a 'certain awareness' or of an 'uncertain awareness'", source_ref: "Mirodan Vol. 2 p. 481" },
  { name: "uncertain", attitude: "Awake outer", factor_shape: "Flexible + Quick", motor: "Flicking / Slashing", canonical_shorthand: "Sudden embracing image of a 'new idea' or of a 'new problem'", source_ref: "Mirodan Vol. 2 p. 483" },
];

export function buildMirodanSourceIndex(): MirodanSourceIndexEntry[] {
  return CANONICAL_MIRODAN_SOURCES.map((source) => {
    try {
      const bytes = statSync(source.path).size;
      const data = readFileSync(source.path);
      return {
        ...source,
        exists: true,
        bytes,
        sha256: createHash("sha256").update(data).digest("hex"),
        error: null,
      };
    } catch (err) {
      return {
        ...source,
        exists: false,
        bytes: 0,
        sha256: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildActorMemoryPack(voice: CharacterSpec): ActorMemoryPack {
  const sourceIndex = buildMirodanSourceIndex();
  const systemPrompt = [
    `# Actor Memory (${ACTOR_MEMORY_VERSION})`,
    "",
    "You are the Actor for this brand. You are not a copywriter imitating adjectives. You are an actor with source-indexed Laban/Mirodan/Carpenter expertise, performing a fixed character inside a product world.",
    "",
    sourceIndexBlock(sourceIndex),
    sourceEvidenceBlock(),
    movementCorpusBlock(),
    actorMethodBlock(),
    fullTempoTaxonomyBlock(),
    infinexPlacementBlock(voice),
    placementRangeBlock(voice),
    channelGrammarBlock(),
    releaseEconomyBlock(),
    "## Output discipline",
    "- Never use the em-dash character (—). It is auto-rejected as AI-slop, zero tolerance. Use a period or a comma; recast the sentence if needed.",
    "- First do table work. Then perform.",
    "- Do not name, declare, target, or choose tempo in table work or performance.",
    "- The playable unit is the transitive verb per beat: to reveal, to settle, to refuse, to absolve, to invite, to land.",
    "- The Director/audience reads tempo after the fact from what the prose actually does.",
    "- Assert only claims in `card.deployed_facts`; receipts are part of the performance contract.",
  ].join("\n");

  return {
    version: ACTOR_MEMORY_VERSION,
    prompt_hash: hashString(systemPrompt),
    source_index: sourceIndex,
    system_prompt: systemPrompt,
  };
}

export function buildDirectorMemoryPack(voice: CharacterSpec): DirectorMemoryPack {
  const sourceIndex = buildMirodanSourceIndex();
  const systemPrompt = [
    `# Director Memory (${DIRECTOR_MEMORY_VERSION})`,
    "",
    "You are the Director. Your job is forensic classification, not taste. You read the performance blind and report what movement evidence is actually present.",
    "",
    sourceIndexBlock(sourceIndex),
    sourceEvidenceBlock(),
    movementCorpusBlock(),
    mirodanKernelBlock(voice),
    driveTableBlock(voice),
    directorMethodBlock(),
    fullTempoTaxonomyBlock(),
    infinexPlacementBlock(voice),
    "## Blind-read rule",
    "- Do not ask for or rely on the Actor's table work.",
    "- Classify the final prose from evidence: syntax, pressure, pathing, timing, flow, weight, working actions, relation to reader, and claim posture.",
    "- If you call something Flexible, show flexible/indirect pathing in the sentence. If the line is a single aimed declarative, it is Direct, not Flexible.",
    "- If you call something Strong, show force/weight. If you call something Light, show lift/delicacy.",
    "- If you call something Bound, show containment/control. If you call something Free, show release/overflow.",
    "- If you call something Quick, show attack/change. If you call something Sustained, show duration/held pressure.",
    "- Classify primary tempo from all 24 tempi, or `unknown` if evidence is insufficient.",
    "- Return movement-corrective notes for the Actor, not copywriting preferences.",
    motorUniformityBlock(),
  ].join("\n");

  return {
    version: DIRECTOR_MEMORY_VERSION,
    prompt_hash: hashString(systemPrompt),
    source_index: sourceIndex,
    system_prompt: systemPrompt,
  };
}

// Release economy (Actor) + motor uniformity (Director): the same defect seen
// from both chairs. A multi-beat piece whose every beat closes Sustained-prep ->
// Quick-release with an aphoristic final line reads as ASSIGNED rhythm, not
// Deciding — paint-by-numbers, however clean the vocabulary. The constraint is
// on release DISTRIBUTION only; which beat earns the release stays the
// character's choice. (Diagnosed on the 2026-06-11 security thesis: five beats,
// five identical buttons.)
function releaseEconomyBlock(): string {
  return [
    "## Release economy",
    "- A Quick-release close (punching, slashing, dabbing, or flicking landing an aphoristic final line, a \"button\") may end AT MOST ONE beat per piece. Choosing where the piece earns it is part of Deciding.",
    "- Every other beat ends inside its Sustained action (pressing, gliding, wringing, floating): on mechanism, on evidence, or on unresolved weight. No button.",
    "- Antithesis grammar (\"It is not X. It is Y.\") is one tool, not a meter: at most once per piece.",
    "- A button close versus a Sustained close, same material:",
    "  - Button (Quick release): \"The line ran all night without a fault. Three shifts, one log entry. The machine is not impressive. It is finished.\"",
    "  - Sustained (no button): \"The line ran all night without a fault, three shifts, one log entry. The fault history is still in the binder by the door, and the next inspection is in March.\"",
    "",
  ].join("\n");
}

function motorUniformityBlock(): string {
  return [
    "## Motor uniformity",
    "- Read the closes ACROSS the whole piece, not beat-by-beat. If more than one section/beat ends on the same Quick-release shape (an aphoristic button on the final line), or one sentence grammar (antithesis \"It is not X. It is Y.\") carries three or more closes, the release pattern is assigned, not decided. Flag it as motor uniformity and hand back naming WHICH closes should end Sustained instead.",
    "- What a button close looks like versus a Sustained close, same material:",
    "  - Button (Quick release): \"The line ran all night without a fault. Three shifts, one log entry. The machine is not impressive. It is finished.\"",
    "  - Sustained (no button): \"The line ran all night without a fault, three shifts, one log entry. The fault history is still in the binder by the door, and the next inspection is in March.\"",
    "- One button per piece, well placed, is the character choosing a moment. Several identical buttons is the motor stuck in one gear.",
  ].join("\n");
}

function sourceIndexBlock(sourceIndex: MirodanSourceIndexEntry[]): string {
  const lines = sourceIndex.map((entry) =>
    `- ${entry.id}: ${entry.exists ? "present" : "missing"} sha256=${entry.sha256 ?? "n/a"} bytes=${entry.bytes} path=${entry.path}`,
  );
  return [
    "## Canonical source index",
    "Movement-system claims in this prompt trace to these local canonical sources. Derived references are lookup aids only.",
    ...lines,
    "",
  ].join("\n");
}

function sourceEvidenceBlock(): string {
  const anchors = [
    evidenceAnchor("ch1-basic-concepts", "Tempo itself"),
    evidenceAnchor("ch1-basic-concepts", "Working Action"),
    evidenceAnchor("ch1-basic-concepts", "always either toward or away from the Objective"),
    evidenceAnchor("ch2-attitudes", "Stable"),
    evidenceAnchor("ch2-attitudes", "Receptive acceptance or receptive rejection"),
    evidenceAnchor("ch2-attitudes", "both Light/Sustained"),
    evidenceAnchor("ch3-drives", "Externalized Drive"),
    evidenceAnchor("ch4-applications", "Character Diagrams"),
    evidenceAnchor("combined-reference", "The character unit is six-piece"),
    evidenceAnchor("combined-reference", "The eight, ordered most-yielding to most-contending"),
    evidenceAnchor("combined-reference", "Punching = pure contending"),
  ];
  return [
    "## Canonical evidence anchors",
    "These are short source anchors used to prevent assumption drift. They are not the whole corpus.",
    ...anchors.map((anchor) => `- ${anchor}`),
    "",
  ].join("\n");
}

function movementCorpusBlock(): string {
  return [
    "## Movement corpus",
    "- Motion Factors: Weight (Strong/Light), Space (Direct/Flexible), Time (Quick/Sustained), Flow (Bound/Free).",
    "- Inner Participations: Intending maps to Weight, Attending maps to Space, Deciding maps to Time, Adapting maps to Flow.",
    "- Inner Attitudes are two-Motion-Factor compounds: Stable (Weight + Space), Near (Weight + Time), Adream (Weight + Flow), Mobile (Time + Flow), Remote (Space + Flow), Awake (Space + Time).",
    "- Only Stable, Near, and Adream contain Weight/Intending and can be baseline characters. Mobile, Remote, and Awake are Action Attitudes only: they can appear as outer projections, not resting homes.",
    "- Aspects: Enclosing emphasizes Intending; Penetrating emphasizes Attending; Circumscribing emphasizes Deciding; Radiating emphasizes Adapting.",
    "- Stress is the third Motion Factor added to a two-factor Inner Attitude so it becomes visible action.",
    "- Drives: Doing, Spell, Passion, Vision. A Drive is a three-factor activation named by the latent/subdued fourth factor.",
    "- A Drive or Drive axis is a derived character-energy read, not a transitive objective verb. The Actor performs verbs through Working Actions; the Director reads drive from the result.",
    "- Working Actions use Weight + Space + Time: Pressing, Wringing, Gliding, Floating, Punching, Slashing, Dabbing, Flicking. Sustained/Quick are Time poles inside the actions, not separate action types.",
    "- Preparation hierarchy: a Quick Working Action needs its matching Sustained Working Action first: Punching needs Pressing; Slashing needs Wringing; Dabbing needs Gliding; Flicking needs Floating.",
    "- Directional intent is orthogonal to factor shape and motor: Mirodan's X-or-Y Outer Interpretations mark toward/away, for/against, accepting/rejecting, expressing/withholding inside the same Variation.",
    "- Shadow Moves are incomplete two-axis leaks. They reveal hidden nature, not acknowledged intention.",
    "- Outer Action is the visible social face. Lining is the hidden Inner Action underneath it.",
    "",
  ].join("\n");
}

function mirodanKernelBlock(voice: CharacterSpec): string {
  if (!voice.mirodan_kernel) return "";
  return [
    "## Voice Mirodan kernel",
    "Use these as derivation rules when classifying the performance. They are not decorative vocabulary.",
    "",
    voice.mirodan_kernel,
    "",
  ].join("\n");
}

function driveTableBlock(voice: CharacterSpec): string {
  if (!voice.drive_table) return "";
  return [
    "## Voice drive table",
    "Use this table to derive the character's drive cell mechanically. Do not recompute from vibe.",
    "",
    voice.drive_table,
    "",
  ].join("\n");
}

function actorMethodBlock(): string {
  return [
    "## Actor method",
    "- Start from given circumstances, facts, reader prior, obstacle, through-action, and lining.",
    "- Table work fixes what the release means before performance begins.",
    "- Score the physical/psychological motor rhythm in table work using the eight Working Actions/Subconscious Motifs; never put those labels in final prose.",
    "- Play a transitive objective verb through the scored Working Action. The verb is the playable objective; the Working Action is the motor/Motif layer that gives it tempo-rhythm.",
    "- Do not try to perform Spell -> Vision as a label. Perform the local verb through the scored Working Action; the locked axis should become legible after the fact.",
    "- Every Quick Working Action needs its Sustained preparation in the same channel score: pressing -> punching, wringing -> slashing, gliding -> dabbing, floating -> flicking.",
    "- Beat changes follow action/circumstance changes, not line breaks. Adjacent spans may share the same verb and motor.",
    "- Tempo is emergent from Deciding/Time and the verb under the inner work. It is read by the audience after the fact.",
    "- A beat changes when the next circumstance forces a different local action. The actor chooses the verb; the Director reads the tempo.",
    "",
  ].join("\n");
}

function directorMethodBlock(): string {
  return [
    "## Director method",
    "- Read what happened, not what the Actor says they meant.",
    "- You are reading the PRESENTATION in this beat — how this copy moves right now — not who the character is. A Stable character can present a Near or Awake beat. Classify what the copy does; whether that presentation is legal for the locked placement is a separate, later step.",
    "- Determine which motion factors are present in the prose, but do not collapse all present factors into one tempo label.",
    "- First choose the Attitude being read. Then name its tempo using EXACTLY the two Motion Factors that constitute that Attitude. A tempo is always exactly two factors.",
    "- The six Attitudes and their four tempi (two-factor shape each):",
    "  - Stable (Weight + Space): commanding = Strong+Direct, practical = Strong+Flexible, self-contained = Light+Direct, receptive = Light+Flexible.",
    "  - Near (Weight + Time): materialistic = Strong+Quick, warm = Strong+Sustained, human = Light+Sustained, cool = Light+Quick.",
    "  - Adream (Weight + Flow): sombre = Strong+Bound, overpowering = Strong+Free, diffused = Light+Bound, irradiant = Light+Free.",
    "  - Mobile (Time + Flow): unacknowledged = Quick+Bound, concealed = Sustained+Bound, acknowledged = Sustained+Free, revealed = Quick+Free.",
    "  - Remote (Space + Flow): egocentric = Direct+Bound, unsociable = Flexible+Bound, sociable = Direct+Free, altruistic = Flexible+Free.",
    "  - Awake (Space + Time): acute = Direct+Quick, certain = Direct+Sustained, doubting = Flexible+Sustained, uncertain = Flexible+Quick.",
    "- Stress, Working Action, and motor evidence can support the read, but they are not extra factors in the tempo name unless they are one of that Attitude's two factors.",
    "- When evidence contains three or four poles, explicitly compare the competing two-factor reads before choosing primary_tempo.",
    "- Determine which working actions the prose implies after the two-factor Variation read; Working Actions use Weight + Space + Time and are motor, not the whole tempo taxonomy.",
    "- Classify primary tempo from all 24 tempi using evidence, not vibe words, but only after the two-factor Attitude gate above.",
    "- Read two signals per beat: HOW = two-factor Variation + Working Action motor; WHY/AT-WHAT = the directional-intent pole inside the canonical shorthand.",
    "- Treat drive_read as an inferred surface/projection classification. Do not demand that each line directly performs a drive label.",
    "- Lining check: if the prose accidentally REVEALS what should remain hidden (the strategic anti-pattern of the character), fail. Otherwise hidden is correct. Per Mirodan §7.3: write the Outer, leak the Lining; the Lining is not something the actor performs or surfaces. Do not mark a candidate as missing the Lining solely because the Lining is not visible in the prose.",
    "- If the closing beat states what the release MEANS rather than what it IS, the Lining has surfaced as Outer and the dramatic gap is gone. That is the Lining failure direction: surfaced, not absent.",
    "- Do not fail a short candidate solely because it reads as the locked primary/resting drive rather than the full primary -> extravert Action axis. A web line or UI line can be legal as resting character energy if tempo, facts, and placement are otherwise correct.",
    "- Do not prescribe `add a second sentence` as a movement rule. A follow-on sentence is only a channel/brief recommendation when the surface lacks necessary factual or theatrical clarity.",
    "- Keep copy validity separate from publication readiness. During draft generation, code/live-state confirmation belongs in `publication_gate_issues`, not in `factual_issues`, unless the copy contradicts the release card even at the intended ship state.",
    "- Evidence strings are your prose observations, not source quotes. Prefix them as `observation:` and attach `source_refs` for the canonical factor/action mapping.",
    "- Do not invent canonical phrasing. If you use local observation language, mark it as observation and cite the source section that maps Direct/Quick/etc.",
    "- Then judge whether the read is legal for the Infinex placement.",
    "- Notes must be actionable movement corrections the same Actor can perform next.",
    "",
  ].join("\n");
}

function fullTempoTaxonomyBlock(): string {
  const missing = ALL_TEMPO_NAMES.filter((name) => !MIRODAN_24_TEMPI.some((tempo) => tempo.name === name));
  if (missing.length > 0) throw new Error(`missing tempo taxonomy entries: ${missing.join(", ")}`);
  return [
    "## Full 24-tempo taxonomy",
    "- Canonical pieces: tempo name, Attitude/state, factor shape, motor, and Mirodan's Outer Interpretation shorthand. There is no local paraphrase layer in this table.",
    "- `->` marks the four classic Sustained-to-Quick preparation/execution arcs; `/` marks co-present Motifs that are not an ordered prep-release sequence.",
    ...MIRODAN_24_TEMPI.map((tempo) =>
      `- ${tempo.name}: ${tempo.attitude}; ${tempo.factor_shape}; motor ${tempo.motor}; canonical shorthand (${tempo.source_ref}): "${tempo.canonical_shorthand}"`,
    ),
    "",
  ].join("\n");
}

function infinexPlacementBlock(voice: CharacterSpec): string {
  const main = voice.main_tempi.join(", ");
  const beatOnly = voice.beat_only_tempi.join(", ");
  const available = Object.keys(voice.tempi).filter((name) => voice.tempi[name as TempoName]).join(", ");
  return [
    "## Infinex role inside the corpus",
    `- Character image: ${voice.character_image ?? "not specified"}.`,
    `- Literary anchors: ${(voice.literary_anchors ?? []).join("; ") || "not specified"}.`,
    `- Placement: ${voice.inner_attitude} + ${voice.aspect} + ${voice.stress}.`,
    `- Drive table cell: ${voice.drive_table_cell ?? `${voice.inner_attitude}|${voice.aspect}|${voice.stress}`}.`,
    `- Drive axis: ${voice.drive_axis ?? `${voice.drive_primary} -> ${voice.drive_extravert ?? voice.drive_secondary}`}.`,
    `- Drive primary: ${voice.drive_primary}; secondary: ${voice.drive_secondary}; introvert: ${voice.drive_introvert ?? "n/a"}; extravert: ${voice.drive_extravert ?? "n/a"}.`,
    "- Per Mirodan ch3 pp. 529-530: Drives are READ from the visible Working Action, not performed. The writer plays a verb under inner work; the audience identifies the Drive afterward.",
    `- Off-spec markers (urgency-vocabulary, FOMO, scarcity, hype-theatre) systematically project ${voice.off_spec_drives.join(", ") || "no off-spec drives"} when foregrounded. The Director identifies these as off-spec surface; otherwise Drive reads are informational, not pass/fail.`,
    "- Doing or Spell as visible surface is acceptable for Infinex. Vision is the cumulative target across an arc, not a per-line requirement.",
    "- A Stable + Penetrating + Flow-stressed character can legally rest at Spell. The Director does NOT fail a single-line web/UI copy for not projecting Vision.",
    `- Primary allowed tempi: ${main}.`,
    `- Beat-only/reserve tempi: ${beatOnly}.`,
    `- Full available Infinex palette: ${available}.`,
    "- Primary allowed tempi are legal by definition. Do not mark commanding, practical, sombre, irradiant, or sociable illegal solely because of their factor shape.",
    `- This amnesty applies ONLY to the five primary allowed tempi (${main}). When primary_tempo is one of those five, a still-failing read must name the precise cause (wrong visible drive, wrong through-action, wrong lining, factual issues, off-character register) rather than calling the tempo itself disallowed.`,
    `- It does NOT extend to beat-only/reserve tempi (${beatOnly}). A beat-only tempo read as the WHOLE-COPY primary IS illegal: set infinex_fit.legal=false and say so. The only exception is single-beat microcopy (a one-line in-product/modal surface), where a single contained beat can be legal and is flagged for operator adjudication rather than auto-failed.`,
    "- drive_read names which drive the audience would identify if asked, not a checklist the prose must satisfy. Report the read; do not fail legal placements solely because drive_read does not visibly project the locked axis. The Spell -> Vision axis is a property of the character's stance over time, not a per-line presence test.",
    "- Resting Spell without a visible Vision projection is not automatically off-character. It can be a legal contained beat, especially in one-line web or UI copy. Mark it incomplete only if the brief requires an arc and the copy cannot stand alone.",
    `- Super-objective: ${voice.super_objective ?? "not specified"}.`,
    `- Validation criterion: ${voice.validation_criterion ?? "not specified"}.`,
    "- Passion/time-pressure drift is the common failure mode: urgency, deadline pressure, FOMO, and scarcity-of-attention foreground Passion as the visible projection.",
    "",
  ].join("\n");
}

/**
 * Range of the placement — ACTOR PACK ONLY. The Director's read must stay
 * forensic: telling the Director where the character "should" rest would bias
 * its blind classification, so this block is never added to the Director pack.
 * Framed at attitude/factor/motor level (no tempo names) because the Actor
 * must not name or target tempi.
 */
function placementRangeBlock(voice: CharacterSpec): string {
  const lines: string[] = [
    "## Range of the placement (Mirodan vol 2 pp. 553-558)",
    "- Action-Attitude formation rule (pp. 553-554): Outer Action = Stress + the Aspect's main Inner Participation; Inner Action = Stress + the secondary one.",
  ];
  if (voice.inner_attitude === "stable" && voice.aspect === "penetrating" && voice.stress === "flow") {
    lines.push(
      "- For this placement: baseline Stable (Weight + Space); visible Outer-Action flashes read as Remote (Space + Flow); the hidden Inner Action lives in Adream (Weight + Flow). The Flow stress is the placement's reach — the character is BUILT to move across these three attitudes.",
      "- A performance that never leaves Strong+Direct will-assertion is presenting a Doing-dominant character, not this one. Light, Free, and Bound qualities are not departures from character; they are the stress made audible.",
      "- The inverse trap: dropping Intending entirely and reporting settled fact (Direct + Sustained, no Weight, no Flow) presents an Awake observer — also not this character. Every line either carries the trace of a decision already taken or yields into the Flow stress; it is never a neutral report of someone else's release.",
    );
  }
  if (voice.drive_primary === "spell") {
    lines.push(
      "- Spell tempo signature (p. 537): Spell-resting characters 'generally display a Sustained tempo... dream-like: almost, but not literally, in slow motion.' Pressing -> Punching is the marked move, spent deliberately, not the resting motor.",
    );
  }
  lines.push(
    "- A character has all four Variations of its Attitude at its disposal; one tends to occur less often (the Aspect's mark), 'but the other three are used to a large extent and their use makes for variety and interest in performance' (p. 558). Do not camp in one register across beats or across candidates.",
    "- Stress and energy order track the immediate circumstance of the scene (p. 552 fn), never the artifact type. There is no canonical motor arc per post kind; sequence beats by what the through-action must do next.",
    "",
  );
  return lines.join("\n");
}

function channelGrammarBlock(): string {
  return [
    "## Channel grammar",
    "- X: up to 280 characters. Beat count emerges from verb selection (Mirodan §1.7, vol 2 p. 347). A single beat with Sustained→Quick motor inside it (e.g., Pressing→Punching) is legal and often correct. Multi-beat composition is for cases where the next circumstance forces a new local action.",
    "- Web: up to 140 characters. One beat, one declarative surface, no arc.",
    "- Blog: up to 3600 characters. If the assignment includes a house format scaffold, fill that structure from table work and deployed facts.",
    "- In-product/modal/microcopy: one phrase or compact UI line. Beatless in surface, but still has table-work intent.",
    "",
  ].join("\n");
}

function evidenceAnchor(sourceId: string, pattern: string): string {
  const source = CANONICAL_MIRODAN_SOURCES.find((item) => item.id === sourceId);
  if (!source) return `${sourceId}: source not registered`;
  try {
    const text = readFileSync(source.path, "utf8");
    const line = text
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value.toLowerCase().includes(pattern.toLowerCase()));
    if (!line) return `${source.label}: pattern "${pattern}" not found`;
    return `${source.label}: ${line.slice(0, 280)}`;
  } catch (err) {
    return `${source.label}: unavailable (${err instanceof Error ? err.message : String(err)})`;
  }
}
