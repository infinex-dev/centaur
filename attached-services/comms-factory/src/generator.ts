import Anthropic from "@anthropic-ai/sdk";
import { deployedFactClaims, type ReleaseCard } from "./card.js";
import { generateImageBrief } from "./brief-generator.js";
import { INFINEX_VOICE } from "./voice/infinex.js";
import type { BeatSequence, CharacterSpec, TempoBeat, TempoName, WorkingAction } from "./voice/types.js";

type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];

/**
 * Minimal client seam mirroring validator-active's pattern. Provided so tests
 * can inject a deterministic mock without an ANTHROPIC_API_KEY.
 */
export interface AnthropicMessagesClient {
  messages: {
    create: (params: AnthropicCreateParams) => Promise<{ content: Anthropic.Message["content"] }>;
  };
}

/**
 * Generator. Given a release card + beat sequence, produces N caption candidates.
 *
 * A caption is a beat sequence — each beat in its declared tempo. The generator
 * outputs full posts where the beats are sequenced naturally (paragraph breaks
 * between beats by default).
 *
 * The generator does NOT validate. It produces; the validator gates. This is
 * the same separation Nigel's voice subsystem uses.
 *
 * Modes:
 *   - live:  uses Anthropic API (Opus generator, Sonnet validator on retry)
 *   - stub:  returns deterministic seeded candidates from few-shot library;
 *            used when ANTHROPIC_API_KEY is unset, for tests and quick wiring
 *
 * Voice spec is loaded from src/voice/infinex.ts (post brand-factory `voiced`
 * gate, this could load from brand-factory/brands/infinex/04-voice/tone.md).
 */

/**
 * Prompt-architecture permutations for the system prompt assembly path. Used
 * by eval/run-permutations.ts to measure whether the model needs explicit
 * Mirodan/Laban context to write on-spec copy. Default is "current": preserves
 * the existing 8-section prompt.
 *
 *   - current   : production prompt (currently v2)
 *   - v2        : explicit alias for the production v2 prompt
 *   - v1-current: archived Wave 2 production prompt
 *   - kernel    : v1-current + 12-rule Mirodan derivation kernel injected after
 *                 validation_criterion
 *   - placement : character placement header only + RESOLVED PLACEMENT block
 *   - examples  : tempi example_lines only (no feel/lining/opening_shapes)
 *   - full      : kernel + placement header + RESOLVED PLACEMENT block +
 *                 examples-only loop
 */
export type PromptPermutation =
  | "current"
  | "v2"
  | "v1-current"
  | "kernel"
  | "placement"
  | "examples"
  | "full";

export interface GenerateOptions {
  voice?: CharacterSpec; // defaults to INFINEX_VOICE
  beats?: BeatSequence; // legacy: single-call path uses this. Two-call path generates beats from InnerWork.
  defaultBeats?: (kind: string) => TempoBeat[]; // per-voice card-kind→beats mapping; demoted to fallback under two-call path
  channel?: Channel;
  n?: number;
  model?: string;
  mode?: "live" | "stub" | "auto";
  feedback?: string; // validator/orchestrator feedback for retry attempts
  permutation?: PromptPermutation;
  /**
   * Two-call orchestration controls. When undefined, generate() runs the
   * two-call path (Stage A: inner work → Stage B: drafting). Set to a
   * pre-computed InnerWork to skip Stage A (useful for testing, or for
   * fanning Stage B across channels using one shared InnerWork).
   */
  innerWork?: InnerWork;
  /**
   * Force single-call legacy path. Mostly here for tests that need to
   * exercise the old behavior; default is two-call.
   */
  legacySingleCall?: boolean;
  /**
   * Optional mutable capture object. When supplied, the generator writes the
   * exact {system, user} prompts it sent to the model into the corresponding
   * field as a side effect. Stub mode leaves the capture empty (no prompts
   * are built). The harness uses this to persist per-attempt prompts for
   * visibility into the generator → validator feedback loop.
   */
  capturePrompts?: GenerationPromptCapture;
  /** Optional client override (tests inject a mock to avoid an API key). */
  client?: AnthropicMessagesClient;
}

export interface PromptPair {
  system: string;
  user: string;
}

export interface GenerationPromptCapture {
  /** Stage A (inner-work step) prompt. Populated by the two-call path. */
  inner_work?: PromptPair;
  /** Stage B (drafting step) prompt. Populated by the two-call path. */
  drafting?: PromptPair;
  /** Single-call legacy prompt. Populated only when legacySingleCall is forced. */
  legacy?: PromptPair;
}

export type Channel = "web" | "x" | "in-product" | "modal" | "blog" | "x-thread" | "carousel" | "image-brief";

/**
 * Structured output for multi-part / structured channels. The `text` field on a
 * Candidate stays the canonical READABLE rendering (slop rules, history-guards,
 * display, DB all keep working on it); `structured` carries the typed shape that
 * the surface actually consumes. Shapes mirror real platform surfaces:
 *   - web-card  → apps/public-website/.../feature-card-alt/data.ts
 *   - carousel  → apps/content-app/content/app-alert (the "What's new" surface)
 *   - thread    → an X thread (ships via Typefully; no native platform API)
 */
export type StructuredOutput =
  | { kind: "web-card"; subheading: string; title: string; caption: string }
  | { kind: "carousel"; slides: { name: string; body: string }[] }
  | { kind: "thread"; tweets: string[] };

/** Channels whose output is structured rather than a single string. */
export const STRUCTURED_CHANNELS: Channel[] = ["web", "carousel", "x-thread"];

/** Render a StructuredOutput to the canonical readable `text` used by slop rules + display. */
export function renderStructured(s: StructuredOutput): string {
  switch (s.kind) {
    case "web-card":
      return [s.subheading, s.title.replace(/\s*\/\s*/g, " "), s.caption].filter(Boolean).join("\n");
    case "carousel":
      return s.slides.map((sl, i) => `${i + 1}. ${sl.name}\n${sl.body}`).join("\n\n");
    case "thread":
      return s.tweets.join("\n\n");
  }
}

export interface Candidate {
  id: string;
  text: string;
  /** Populated for STRUCTURED_CHANNELS; undefined for single-string channels. */
  structured?: StructuredOutput;
  channel: Channel;
  // The generator no longer DECLARES a tempo per beat — the audience (validator)
  // reads the tempo from how the beat lands. tempo is optional here: populated
  // by the legacy single-call path (which still takes explicit BeatSequence
  // input), undefined under the two-call path where the generator emits only
  // inner work + verbs.
  declared_beats: {
    tempo?: TempoName;
    hint?: string;
    objective_verb?: string;
    working_action?: WorkingAction;
    physical_score?: string;
    preparation_from?: WorkingAction;
  }[];
  movement_score?: CandidateMovementScoreBeat[];
  movement_receipt?: CandidateMovementReceipt[];
  deployed_facts_used?: string[];
  not_said?: NotSaidFact[];
  rationale?: string;
  /** Vertical flow direction the candidate was generated under (inwards-out | outwards-in). */
  prompt_variant?: string;
  source: "stub" | "anthropic";
}

export interface CandidateMovementScoreBeat {
  objective_verb: string;
  working_action: WorkingAction;
  physical_score: string;
  preparation_from?: WorkingAction;
}

export interface CandidateMovementReceipt {
  text_span: string;
  objective_verb: string;
  working_action: WorkingAction;
  evidence: string;
}

export interface NotSaidFact {
  fact: string;
  reason: string;
}

// -- Two-call generator types -----------------------------------------------
// Phase 2: the actor's table-work artifact. Stage A produces InnerWork; Stage B
// drafts conditioned on it. Mirodan inheritance: the actor commits to thesis
// + beat plan + transitive verbs BEFORE drafting. Tempo is emergent from
// inner work, not pre-assigned.

/**
 * A beat in the generator's plan. Carries the transitive verb the actor
 * consciously plays ("to reveal" / "to disarm" / "to invite"), the
 * micro-objective for the reader, and the local obstacle the beat is fighting
 * against. Optional shadow_move per Mirodan §7: the involuntary Lining-leak
 * the prose carries underneath the beat.
 *
 * NOTE: No tempo field. Per Mirodan (Ch.1 p. 286, p. 302, p. 351), the actor
 * never picks tempo — tempo emerges from the verb being played under the
 * Subconscious Motif (Inner Attitude + Aspect + Stress + Lining). The
 * audience perceives the tempo; the validator scores it post-hoc.
 */
export interface BeatPlan {
  verb: string; // transitive: "to reveal", "to land", "to invite" — what the actor consciously plays (Mirodan p. 351)
  // The scored motor the verb is played THROUGH (Mirodan Ch.1 pp. 350-351: the
  // verb fits a Working Action; the WA is the playable motor layer the actor
  // scores in table work — same shape as the actor path's ActorBeatPlan).
  // Tempo still emerges; the motor is what differentiates "to declare" played
  // pressing→punching from "to unfold" played floating→flicking.
  working_action?: WorkingAction;
  preparation_from?: WorkingAction; // Sustained prep partner when working_action is a Quick release (Mirodan §1.7 p. 347)
  micro_objective: string; // what this beat is trying to make the reader notice/feel
  obstacle_local: string; // what this beat is fighting against in the reader (default expectation, prior, etc.)
  shadow_move?: string; // involuntary Lining-leak — what the prose lets slip (Mirodan §7)
}

const WORKING_ACTIONS: WorkingAction[] = [
  "pressing", "punching", "wringing", "slashing",
  "gliding", "dabbing", "floating", "flicking",
];

function parseWorkingAction(value: unknown): WorkingAction | undefined {
  return typeof value === "string" && (WORKING_ACTIONS as string[]).includes(value.toLowerCase())
    ? (value.toLowerCase() as WorkingAction)
    : undefined;
}

/**
 * The actor's table-work artifact, produced by Stage A and consumed by Stage B.
 * The model commits to the interpretation BEFORE drafting. This is what
 * separates the two-call path from the legacy single-call path: the model
 * cannot rationalize its way into the draft because it has already declared
 * the thesis and beat plan.
 */
export interface InnerWork {
  /** Single-sentence declarative interpretation of the release. The thesis the post must earn. */
  thesis: string;
  /** Refined or inherited from card.through_action. */
  through_action: string;
  /** Refined or inherited from card.obstacle. */
  obstacle: string;
  /** Refined or inherited from card.lining. The hidden Inner Action the post leaks. */
  lining: string;
  /** Refined or inherited from card.reader_prior. */
  reader_prior?: string;
  /** Refined or inherited from card.not_the_point. */
  not_the_point?: string;
  /** The committed beat sequence. Tempi are SELECTED to serve the through_action, not assigned by card.kind. */
  beat_plan: BeatPlan[];
  /** Free-form rationale the model can include to explain the beat plan. Audit-readable. */
  rationale?: string;
  /** Mode the InnerWork was produced in. */
  source: "stub" | "anthropic";
}

const DEFAULT_N = 2;
const DEFAULT_MODEL = "claude-opus-4-7";

export const CHANNEL_GENERATION_PROFILES: Record<
  Channel,
  {
    maxChars: number;
    guidance: string;
    beatless?: boolean;
    /** Per-segment budgets for structured channels (enforced by validator.structureIssues). */
    segments?: { min: number; max: number };
  }
> = {
  x: {
    maxChars: 280,
    guidance: "single X post; no thread setup; each beat must earn its characters",
  },
  web: {
    maxChars: 140,
    guidance:
      "a feature card on the Infinex website (feature-card-alt). NOT one blob: produce three fields — `subheading` (a short category label, e.g. 'Perpetual Futures'; ≤24 chars), `title` (the announcement headline, ≤48 chars; you may use a single ' / ' to mark a responsive line break), and `caption` (one supporting fact, ≤44 chars). Headline register, no narrative arc.",
  },
  "in-product": {
    maxChars: 80,
    guidance: "UI microcopy — a headline or CTA label that appears directly in the product interface. Each candidate is ONE short phrase: either a headline ('Spot trading live') or an action label ('Deposit to Spot'). No narrative arc, no beats, no marketing language. A user should be able to act on it immediately.",
    beatless: true,
  },
  modal: {
    maxChars: 250,
    guidance: "an in-app dialog shown to a user already inside the product, mid-flow. A short title, a line or two of body, and a clear next action (CTA). Addressed to the active user — second person, something to do now — not broadcast.",
  },
  blog: {
    maxChars: 3600,
    guidance: "a full long-form post for the Infinex blog, 300–600 words. Multi-paragraph; free to develop the moment at length. Read by someone who chose to open it, not interrupted.",
  },
  "x-thread": {
    maxChars: 280,
    guidance:
      "an X thread — produce a `tweets` array of 2–6 tweets, EACH ≤280 chars. The first tweet is the hook (must stand alone); the middle tweets carry the facts one beat each; the last tweet lands. No '1/' numbering, no 'a thread 🧵' cliché.",
    segments: { min: 2, max: 6 },
  },
  carousel: {
    maxChars: 240,
    guidance:
      "the in-app 'What's new' carousel (the app-alert surface) — a CONDENSED companion to the changelog. Produce a `slides` array of 3–6 slides, each with a `name` (slide title, ≤40 chars, e.g. 'Real order book') and a `body` (1–3 sentences, ≤240 chars). One feature per slide; mirror the changelog sections but shorter and punchier. Addressed to a user already in the app.",
    segments: { min: 3, max: 6 },
  },
  "image-brief": {
    maxChars: 4000,
    guidance:
      "art direction for the designer. Produce one readable image brief covering hero, in-app-mobile, and feature-detail. Ground every scene in deployed_facts, outward_product_name, and feature_states. This is not voiced copy and not a posting channel.",
    beatless: true,
  },
};

export async function generate(
  card: ReleaseCard,
  opts: GenerateOptions = {},
): Promise<Candidate[]> {
  const n = opts.n ?? DEFAULT_N;
  const channel = opts.channel ?? "x";
  const voice = opts.voice ?? INFINEX_VOICE;

  if (channel === "image-brief") {
    const brief = await generateImageBrief(card, {
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      ...(opts.client !== undefined ? { client: opts.client } : {}),
    });
    return [{
      id: "image-brief-1",
      text: brief.text,
      channel,
      declared_beats: [],
      deployed_facts_used: deployedFactClaims(card),
      not_said: [],
      rationale: "Generated image brief surface: art direction only; on-image lines slop-validated in brief-generator.",
      source: brief.source,
    }];
  }

  // Legacy single-call path: pre-Phase-2 behavior. Kept for backwards compat
  // and the few tests that want to exercise the old flow. Default is the
  // two-call path (Stage A → Stage B).
  if (opts.legacySingleCall) {
    const fallbackBeats: TempoBeat[] = opts.defaultBeats
      ? opts.defaultBeats(card.kind)
      : voice.main_tempi.slice(0, 4).map((t) => ({ tempo: t }));
    const beats: BeatSequence = opts.beats ?? { beats: fallbackBeats };

    const mode =
      opts.mode === "live"
        ? "live"
        : opts.mode === "stub"
          ? "stub"
          : process.env.ANTHROPIC_API_KEY
            ? "live"
            : "stub";

    if (mode === "stub") return stubCandidates(card, beats, channel, n, voice);

    const client = opts.client ?? new Anthropic();
    const systemPrompt = buildSystemPrompt(voice, opts.permutation);
    const userPrompt = buildUserPrompt(card, beats, channel, n, voice, opts.feedback);
    if (opts.capturePrompts) {
      opts.capturePrompts.legacy = { system: systemPrompt, user: userPrompt };
    }

    const resp = await client.messages.create({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    return parseModelResponse(resp, beats, channel);
  }

  // Two-call path (default).
  // If opts.beats is supplied explicitly, the caller is requesting a forced
  // beat plan — typically a test fixture. Route through the legacy path so
  // those tests still work without rewriting.
  if (opts.beats) {
    return generate(card, { ...opts, legacySingleCall: true });
  }

  const innerWork = opts.innerWork ?? (await generateInnerWork(card, {
    ...(opts.voice !== undefined ? { voice: opts.voice } : {}),
    ...(opts.channel !== undefined ? { channel: opts.channel } : {}),
    ...(opts.model !== undefined ? { model: opts.model } : {}),
    ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
    ...(opts.feedback !== undefined ? { feedback: opts.feedback } : {}),
    ...(opts.permutation !== undefined ? { permutation: opts.permutation } : {}),
    ...(opts.capturePrompts !== undefined ? { capturePrompts: opts.capturePrompts } : {}),
    ...(opts.client !== undefined ? { client: opts.client } : {}),
  }));

  return draftFromInnerWork(card, innerWork, {
    ...(opts.voice !== undefined ? { voice: opts.voice } : {}),
    ...(opts.channel !== undefined ? { channel: opts.channel } : {}),
    n,
    ...(opts.model !== undefined ? { model: opts.model } : {}),
    ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
    ...(opts.feedback !== undefined ? { feedback: opts.feedback } : {}),
    ...(opts.permutation !== undefined ? { permutation: opts.permutation } : {}),
    ...(opts.capturePrompts !== undefined ? { capturePrompts: opts.capturePrompts } : {}),
    ...(opts.client !== undefined ? { client: opts.client } : {}),
  });
}

export async function generateForChannels(
  card: ReleaseCard,
  channels: Channel[],
  opts: Omit<GenerateOptions, "channel"> = {},
): Promise<Candidate[]> {
  // Two-call optimization: compute InnerWork ONCE per card (it's
  // channel-agnostic — the interpretation is the same regardless of where
  // the post lands), then fan Stage B out per channel. Falls back to per-call
  // InnerWork if the caller forced legacy mode or supplied an explicit beat
  // sequence.
  const sharedInnerWork =
    opts.legacySingleCall || opts.beats || opts.innerWork
      ? undefined
      : await generateInnerWork(card, {
          ...(opts.voice !== undefined ? { voice: opts.voice } : {}),
          ...(opts.model !== undefined ? { model: opts.model } : {}),
          ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
          ...(opts.feedback !== undefined ? { feedback: opts.feedback } : {}),
          ...(opts.permutation !== undefined ? { permutation: opts.permutation } : {}),
        });

  const batches = await Promise.all(
    channels.map((channel) =>
      generate(card, {
        ...opts,
        channel,
        ...(sharedInnerWork ? { innerWork: sharedInnerWork } : {}),
      }),
    ),
  );
  return batches.flat();
}

// -- Prompt construction ------------------------------------------------------

export function buildSystemPrompt(
  voice: CharacterSpec,
  permutation: PromptPermutation = "current",
): string {
  if (permutation === "current" || permutation === "v2") {
    return buildV2SystemPrompt(voice);
  }

  const v1Permutation = permutation === "v1-current" ? "current" : permutation;
  const parts: string[] = [];

  const includesPlacementHeader =
    v1Permutation === "current" ||
    v1Permutation === "kernel" ||
    v1Permutation === "placement" ||
    v1Permutation === "full";
  const includesFullCurrentChrome =
    v1Permutation === "current" || v1Permutation === "kernel";
  const includesKernel = v1Permutation === "kernel" || v1Permutation === "full";
  const includesResolvedFacts =
    v1Permutation === "placement" || v1Permutation === "full";
  const includesExamplesLoop =
    v1Permutation === "examples" || v1Permutation === "full";

  parts.push(`You write release captions for ${voice.name}.`, "");

  if (includesPlacementHeader) {
    parts.push(`# Character placement (Mirodan-grounded)`);
    parts.push(`- Inner Attitude: ${voice.inner_attitude}`);
    parts.push(`- Stress: ${voice.stress}${voice.stress_pole ? ` (${voice.stress_pole} pole)` : ""}`);
    parts.push(`- Aspect: ${voice.aspect}`);
    parts.push(`- Drive: ${voice.drive_primary} + ${voice.drive_secondary}${voice.drive_axis ? ` (${voice.drive_axis})` : ""}`);
    parts.push(`- Off-spec visible/extravert drives (must NOT surface): ${voice.off_spec_drives.join(", ")}`);
    parts.push("");
  }

  if (includesFullCurrentChrome) {
    if (voice.super_objective) {
      parts.push("# Super-Objective (what the character ALWAYS wants)");
      parts.push(
        "This is the standing transitive-verb intent the character pursues across every release. Every post should arc toward this — not by quoting it, but by being recognizably driven by it. The Super-Objective is the spine that prevents posts from collapsing into mechanical announcement-voice.",
      );
      parts.push("");
      parts.push(`> ${voice.super_objective}`);
      parts.push("");
      if (voice.super_objective_examples && voice.super_objective_examples.length > 0) {
        parts.push("How the Super-Objective shows up in concrete releases:");
        for (const ex of voice.super_objective_examples) parts.push(`  - ${ex}`);
        parts.push("");
      }
    }

    if (voice.historical_lore) {
      parts.push("# Historical lore (scar tissue — informs refusals, NEVER named in prose)");
      parts.push(
        "This is the version of the character that no longer is. Past learnings the current placement has internalized. The character refuses moves that belong to the past era; never names the era. The scars hold the discipline.",
      );
      parts.push("");
      parts.push(`> ${voice.historical_lore}`);
      parts.push("");
    }

    if (voice.validation_criterion) {
      parts.push("# Validation criterion (the operational test the character is trying to pass)");
      parts.push(
        "This is the observable success condition — NOT the Super-Objective. Every post should be the kind of artifact that helps this condition come true, never the kind that violates it.",
      );
      parts.push("");
      parts.push(`> ${voice.validation_criterion}`);
      parts.push("");
    }
  }

  if (includesKernel) {
    parts.push(...buildMirodanKernel());
    parts.push("");
  }

  if (includesResolvedFacts) {
    parts.push(...buildResolvedFactsBlock(voice));
    parts.push("");
  }

  if (includesFullCurrentChrome) {
    parts.push("# Outer / Lining discipline (Mirodan §7.1-7.3)");
    parts.push(
      "Every tempo carries TWO layers: the visible OUTER (what the reader sees on the surface) and the hidden LINING (the inner action the Outer covers). Outer/Lining gap is the engine of dramatic life. Authoring discipline: write the Outer, LEAK the Lining. Never name the Lining in the prose — let it surface as texture, restraint, a phrase that points at what the post is refusing to say. Posts without Lining read as one-layer, which is what gives generated copy its AI feel.",
    );
    parts.push("");

    parts.push(`# Tempi available`);
    parts.push("Each beat declares one tempo. The post is a sequence of beats. Each tempo carries its own standing Lining — fire the Outer; let the Lining seep.");
    parts.push("");

    for (const name of voice.main_tempi) {
      const t = voice.tempi[name];
      if (!t) continue;
      const innerCombo = t.inner_combo ?? (t.factor_shape ? `${t.attitude} · ${t.factor_shape}` : t.attitude);
      parts.push(`## ${name} (${innerCombo})`);
      const motorArrow = t.motor_relation === "co_exist" ? "/" : "→";
      const motorNote = t.motor_relation === "co_exist" ? "(co-existing, same Time pole)" : "(preparation → release)";
      parts.push(`Motor: ${t.motor[0]} ${motorArrow} ${t.motor[1]} ${motorNote}`);
      if (t.canonical_shorthand) parts.push(`Canon: ${t.canonical_shorthand}`);
      if (t.feel) parts.push(`Feel: ${t.feel}`);
      if (t.lining) parts.push(`Lining (do NOT name in prose — leak it): ${t.lining}`);
      if (t.opening_shapes?.length) parts.push(`Opening shapes: ${t.opening_shapes.slice(0, 3).join(" | ")}`);
      if (t.vocab_anchor?.length) parts.push(`Vocab anchor: ${t.vocab_anchor.slice(0, 6).join(", ")}`);
      if (t.example_lines?.length) {
        parts.push("Example lines:");
        for (const ex of t.example_lines.slice(0, 2)) parts.push(`  > ${ex}`);
      }
      parts.push("");
    }

    parts.push("# Preparation hierarchy (HARD CONSTRAINT, applies to Sus→Q tempi)");
    parts.push("For tempi whose motor pair is Sustained → Quick (e.g., Commanding: pressing→punching), the");
    parts.push("Sustained prep MUST fire first within that beat. The sequence is structural:");
    parts.push("  Pressing → Punching · Wringing → Slashing · Gliding → Dabbing · Floating → Flicking");
    parts.push("");
    parts.push("Tempi whose motor pair is both-Sustained (e.g., Human: floating→gliding, Warm: pressing→wringing)");
    parts.push("fire NO Quick action — no prep concern.");
    parts.push("");
    parts.push("Tempi whose motor pair is both-Quick (e.g., Cool: dabbing→flicking, Materialistic:");
    parts.push("punching→slashing) handle prep INTERNALLY in the character's inner state per Mirodan §1.7 —");
    parts.push("the prep is invisible, the post fires as Quick from the start. Don't try to force a");
    parts.push("Sustained prep beat in front of these.");
    parts.push("");

    parts.push("# Hard rules (validator will reject violations)");
    parts.push("Reason from the character placement above and the motor vocabulary in each tempo. Do NOT apply a hardcoded ban list of words. The validator judges by character coherence — a phrase that reads as in-character despite seeming generic is acceptable, and a phrase from a preferred vocabulary still fails if it pulls the prose off-character.");
    parts.push("");
    if (voice.structural_traits && voice.structural_traits.length > 0) {
      parts.push("Structural constraints (character-derived, from this voice's spec):");
      for (const trait of voice.structural_traits) {
        parts.push(`- ${trait}`);
      }
      parts.push("");
    }
    if (voice.off_spec_regexes.length > 0) {
      parts.push(`- Off-spec drive language (visible/extravert failures; drive lock: ${voice.drive_primary}+${voice.drive_secondary}; off-spec surfaces: ${voice.off_spec_drives.join(", ") || "none"}):`);
      for (const r of voice.off_spec_regexes) {
        parts.push(`  ${r.name}: ${r.reason}`);
      }
    }
    parts.push("- Only assert claims supported by card.deployed_facts. Inventing claims is a hard fail.");
    parts.push("- Emit fact receipts for traceability, not as a writing target: deployed_facts_used contains exact card.deployed_facts strings that materially support the final text.");
    parts.push("- not_said contains exact card.deployed_facts strings you considered and intentionally left out. Do not force background facts, rail lists, provider names, or mechanics into prose just to satisfy receipt coverage.");
  }

  if (includesExamplesLoop) {
    parts.push(`# Tempi reference (canonical Mirodan shorthand)`);
    parts.push("");
    for (const name of voice.main_tempi) {
      const t = voice.tempi[name];
      if (!t) continue;
      parts.push(`## ${name}`);
      if (t.canonical_shorthand) parts.push(`  > ${t.canonical_shorthand}`);
      if (t.example_lines?.length) {
        for (const ex of t.example_lines) parts.push(`  > ${ex}`);
      }
      parts.push("");
    }
    parts.push("- Only assert claims supported by card.deployed_facts. Inventing claims is a hard fail.");
    parts.push("- Emit fact receipts for traceability, not as a writing target: deployed_facts_used contains exact card.deployed_facts strings that materially support the final text.");
    parts.push("- not_said contains exact card.deployed_facts strings you considered and intentionally left out. Do not force background facts, rail lists, provider names, or mechanics into prose just to satisfy receipt coverage.");
  }

  return parts.join("\n");
}

function buildV2SystemPrompt(voice: CharacterSpec): string {
  const parts: string[] = [];
  const driveCell = voice.drive_table_cell ?? `${voice.inner_attitude}|${voice.aspect}|${voice.stress}`;
  const axis = voice.drive_axis ?? `${voice.drive_primary} → ${voice.drive_extravert ?? voice.drive_secondary}`;

  parts.push(`You write release captions for ${voice.name}.`, "");

  parts.push("# Brand placement");
  parts.push(`- Baseline Inner Attitude: ${voice.inner_attitude} (${factorPairForBaseline(voice.inner_attitude)})`);
  parts.push(`- Aspect: ${voice.aspect}${voice.aspect === "penetrating" ? " (Space-led)" : ""}`);
  parts.push(`- Stress: ${voice.stress}${voice.stress_pole ? ` (${voice.stress_pole} pole)` : ""}`);
  parts.push(`- Drive table cell: ${driveCell}`);
  parts.push(`- Drive primary: ${voice.drive_primary}`);
  parts.push(`- Drive secondary: ${voice.drive_secondary}`);
  if (voice.drive_introvert) parts.push(`- Drive introvert: ${voice.drive_introvert} (HIDDEN LINING — leak as texture, never visible)`);
  if (voice.drive_extravert) parts.push(`- Drive extravert: ${voice.drive_extravert}`);
  parts.push(`- Main Character-Action Axis: ${axis.toLowerCase()}`);
  parts.push("- The Drive axis is a structural read, not a playable verb. Write concrete objective verbs and Working Actions; let the axis be legible after the fact.");
  if (voice.character_image) parts.push(`- Character image: ${voice.character_image}`);
  if (voice.literary_anchors && voice.literary_anchors.length > 0) {
    parts.push(`- Literary anchors: ${voice.literary_anchors.join("; ")}`);
  }
  if (voice.super_objective) parts.push(`- Super-Objective: ${voice.super_objective}`);
  parts.push("");

  if (voice.mirodan_kernel) {
    parts.push("# Mirodan framework");
    parts.push("Use these as derivation rules, not decorative terminology.");
    parts.push("");
    parts.push(voice.mirodan_kernel);
    parts.push("");
  }

  if (voice.drive_table) {
    parts.push("# The 12-cell drive table");
    parts.push("Use the table to derive the drive cell mechanically. The same scaffold ports to another brand by changing the placement row.");
    parts.push("");
    parts.push(voice.drive_table);
    parts.push("");
  }

  parts.push(`# The ${voice.main_tempi.length} locked tempi (the audience's read — never a writing target)`);
  parts.push("These are the registers the audience can read off this character's prose. Do not name, choose, or target a tempo while writing — play transitive verbs through their Working Actions and the tempo emerges (Mirodan Ch.1 p. 286: tempo is the physical realization of Deciding; pp. 350-351: 'Punching' can't be acted, 'to box' can). Each tempo carries a Sustained-prep → Quick-release motor pair unless its motor definition says otherwise.");
  parts.push("Listed in the character's resting-cadence order — most at-home register first:");
  parts.push("");
  for (const name of mainTempiByCadence(voice)) {
    const tempo = voice.tempi[name];
    if (!tempo) continue;
    const innerCombo = tempo.inner_combo ?? (tempo.factor_shape ? `${tempo.attitude} · ${tempo.factor_shape}` : tempo.attitude);
    const motorArrow = tempo.motor_relation === "co_exist" ? "/" : "→";
    parts.push(`## ${labelTempoName(name)} (${innerCombo})`);
    parts.push(`- Motor: ${tempo.motor[0]} ${motorArrow} ${tempo.motor[1]}`);
    if (tempo.canonical_shorthand) parts.push(`- Canon: ${tempo.canonical_shorthand}`);
    if (tempo.feel) parts.push(`- Feel: ${tempo.feel}`);
    if (tempo.lining) parts.push(`- Lining (do NOT name in prose — leak it): ${tempo.lining}`);
    if (tempo.opening_shapes?.length) parts.push(`- Opening shapes: ${tempo.opening_shapes.slice(0, 4).join(" · ")}`);
    if (tempo.vocab_anchor?.length) parts.push(`- Vocab anchors: ${tempo.vocab_anchor.slice(0, 8).join(" · ")}`);
    if (tempo.example_lines?.length) {
      parts.push("- Example lines:");
      for (const example of tempo.example_lines.slice(0, 2)) {
        parts.push(`  - ${example}`);
      }
    }
    parts.push("");
  }

  parts.push(...buildPlacementRangeSection(voice));

  parts.push("# Outer / Lining discipline");
  parts.push("Every tempo has two layers: Outer is what the reader sees on the surface; Lining is the hidden drive underneath. The gap between them is the engine.");
  parts.push("Write the Outer; LEAK the Lining. Never name the Lining in prose. The Lining is the thing the post is refusing to perform.");
  parts.push("");

  parts.push("# Off-spec patterns");
  parts.push("Do NOT apply a hardcoded ban list as a substitute for character reasoning; these are mechanical failure patterns.");
  parts.push("");
  parts.push("## Drive-level");
  if (voice.aspect === "penetrating") {
    parts.push("- Passion may exist as hidden lining. It fails when time-pressure, scarcity, or hype makes Passion the visible/extravert projection instead of Vision.");
  }
  parts.push("- Clock-as-deadline: act now, today only, last chance, limited time, only N hours/days left, tick tock, while supplies last, right now.");
  parts.push("- FOMO / scarcity-of-attention: FOMO, missing out, don't sleep on, catch up before, before everyone else.");
  parts.push("- Hype theater: buckle up, let's go, wagmi, gm gm, massive news, huge news, crazy news, rocket/fire emoji.");
  parts.push("");
  parts.push("## Voice-level");
  if (voice.structural_traits && voice.structural_traits.length > 0) {
    for (const trait of voice.structural_traits) parts.push(`- ${trait}`);
  }
  parts.push("- Listicle openers: N reasons, why X matters, the only X you'll ever need, top N.");
  parts.push("- AI-slop adjectives: innovative, cutting-edge, revolutionary, thrilled to, stay tuned, we're proud to.");
  parts.push("- Antagonism toward named competitors paired with pejoratives.");
  parts.push("- Cliches: game-changer, unlock, paradigm, seamless, empower, leverage as a verb, next-gen.");
  parts.push("- Em-dash density: zero tolerance in short social copy.");
  parts.push("");
  parts.push("## Fact contract");
  parts.push("- Inventing claims not supported by card.deployed_facts is a hard fail.");
  parts.push("- Receipts are traceability, not copy obligations: deployed_facts_used should list exact card.deployed_facts strings that materially support the final text.");
  parts.push("- not_said should list exact card.deployed_facts strings intentionally left out. Do not force rail lists, currencies, provider names, or background mechanics into prose to satisfy receipts.");
  parts.push("");

  parts.push("# Three self-check questions");
  parts.push("1. What word is the protagonist of this sentence? If it is a clock-word used as urgency, rewrite. If it is a clock-word used as destination, keep.");
  parts.push("2. Am I telling the reader to act, or showing what's true? If telling, soften the verb. But 'showing what's true' must still carry the character: the line bears the trace of a decision already taken (Weight/Intending — built, chose, refused, holds) or yields into the stress's Flow (waves, lift, future-tense). A line that merely registers a settled fact, with neither will nor flow, is a reporter's line — Awake 'certain', off this placement entirely.");
  parts.push("3. Would this still feel right with no exclamation marks, no rocket, no 'thrilled to'? If not, the sentence is performing the wrong character.");
  parts.push("");

  parts.push("# Fact contract");
  parts.push("Only assert claims supported by card.deployed_facts. Do not infer partner names, numbers, launch scope, dates, chain support, user eligibility, or product behavior from context unless the claim is supported by deployed_facts.");
  parts.push("Return JSON only. Each candidate must include text, rationale, deployed_facts_used, and not_said. Receipts are for audit traceability; they must not make the prose enumerate background facts.");

  return parts.join("\n");
}

/** main_tempi sorted by the voice's locked cadence, heaviest first (stable for ties/no cadence). */
function mainTempiByCadence(voice: CharacterSpec): TempoName[] {
  const weight = (name: TempoName) => voice.cadence[name] ?? 0;
  return [...voice.main_tempi].sort((a, b) => weight(b) - weight(a));
}

type MotionFactor = "weight" | "space" | "time" | "flow";

const BASELINE_FACTOR_PAIRS: Record<CharacterSpec["inner_attitude"], [MotionFactor, MotionFactor]> = {
  stable: ["weight", "space"],
  near: ["weight", "time"],
  adream: ["weight", "flow"],
};

const ASPECT_FACTOR: Record<string, MotionFactor> = {
  enclosing: "weight",
  penetrating: "space",
  circumscribing: "time",
  radiating: "flow",
};

function attitudeFromFactorPair(a: MotionFactor, b: MotionFactor): string | undefined {
  const key = [a, b].sort().join("+");
  const table: Record<string, string> = {
    "space+weight": "stable",
    "time+weight": "near",
    "flow+weight": "adream",
    "flow+time": "mobile",
    "space+time": "awake",
    "flow+space": "remote",
  };
  return table[key];
}

/**
 * Range of the placement — replaces the old per-post-kind tempo-arc table.
 * Pre-assigned arcs were the pre-assignment Mirodan forbids: tempo is the
 * physical realization of Deciding (Ch.1 p. 286) and the actor can only play
 * transitive verbs (pp. 350-351), so a tempo sequence keyed to artifact kind
 * assigns the unplayable and skips the playable. Stress/energy order tracks
 * the immediate circumstance of the scene (vol 2 p. 552 fn), never the post
 * type. This section gives the model the placement's reachable registers
 * instead, derived per the Action-Attitude formation rule (pp. 553-554).
 */
function buildPlacementRangeSection(voice: CharacterSpec): string[] {
  const parts: string[] = [];
  parts.push("# Range of the placement (derived, Mirodan vol 2 pp. 553-558)");

  const pair = BASELINE_FACTOR_PAIRS[voice.inner_attitude];
  const aspectFactor = ASPECT_FACTOR[voice.aspect];
  const stressFactor = voice.stress as MotionFactor;
  if (pair && aspectFactor && pair.includes(aspectFactor)) {
    const secondaryFactor = pair[0] === aspectFactor ? pair[1] : pair[0];
    const outer = attitudeFromFactorPair(stressFactor, aspectFactor);
    const inner = attitudeFromFactorPair(stressFactor, secondaryFactor);
    if (outer && inner) {
      parts.push(
        `- Action-Attitude formation rule (pp. 553-554): Outer Action = Stress + the Aspect's main Inner Participation; Inner Action = Stress + the secondary one. For this placement: baseline ${voice.inner_attitude}; visible Outer-Action flashes read as ${outer}; the hidden Inner Action lives in ${inner}. The character is BUILT to move across these attitudes.`,
      );
    }
  }

  const byAttitude = new Map<string, TempoName[]>();
  for (const name of voice.main_tempi) {
    const t = voice.tempi[name];
    if (!t) continue;
    const list = byAttitude.get(t.attitude) ?? [];
    list.push(name);
    byAttitude.set(t.attitude, list);
  }
  if (byAttitude.size > 0) {
    parts.push(
      `- Locked tempi by attitude: ${[...byAttitude.entries()].map(([attitude, names]) => `${attitude} (${names.join(", ")})`).join(" · ")}.`,
    );
  }

  parts.push(
    "- A character has all four Variations of its Attitude at its disposal; one tends to occur less often (the Aspect's mark), 'but the other three are used to a large extent and their use makes for variety and interest in performance' (p. 558). Camping in one register is off-canon.",
  );
  parts.push(
    "- Stress and energy order track the immediate circumstance of the scene (p. 552 fn), never the artifact type. There is NO canonical tempo arc per post kind. Sequence beats by what the through-action must do next.",
  );
  if (voice.drive_primary === "spell") {
    parts.push(
      "- Spell tempo signature (p. 537): Spell-resting characters 'generally display a Sustained tempo... dream-like: almost, but not literally, in slow motion.' Strong+Direct will-assertion is this character's MARKED move, spent deliberately — not its default register. Dream-like means Flow-borne (waves, yielding, lift), NOT will-less.",
    );
  }
  parts.push(
    "- Two collapse traps flank this placement. (a) Wall-to-wall will-assertion: every line pressing/punching reads as Doing-dominant armor. (b) Will-LESS reporting: registering settled facts with neither Intending nor Flow reads as Awake 'certain' (Direct + Sustained) — a neutral observer, an attitude OUTSIDE this placement. The character speaks as someone whose decision is already taken (Weight present in the line) or lets the stress carry it; never as a reporter of someone else's release.",
  );
  parts.push("");
  return parts;
}

function factorPairForBaseline(attitude: CharacterSpec["inner_attitude"]): string {
  switch (attitude) {
    case "stable":
      return "Weight + Space";
    case "adream":
      return "Weight + Flow";
    case "near":
      return "Weight + Time";
  }
}

function labelTempoName(name: TempoName): string {
  return name
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("-");
}

/**
 * The 12-rule Mirodan kernel — distilled from `research/infinex-character-bundle.md`
 * §6/§7 + `research/infinex-character-sheet.md`. Each rule names one
 * conceptual point of the framework's derivation chain. Cite sources inline so
 * the model can ground its reasoning.
 */
function buildMirodanKernel(): string[] {
  return [
    "# Mirodan kernel (12 derivation rules — reason from these, do not pattern-match)",
    "",
    "Per research/infinex-character-bundle.md §6/§7 + research/infinex-character-sheet.md. The framework is a derivation chain, not a vocabulary list. Apply it.",
    "",
    "1. Laban (Movement Analysis) names the four Motion Factors — Weight, Time, Space, Flow. Mirodan (1997 PhD) synthesizes Laban + Malmgren + Carpenter into a character framework: inner attitudes, stresses, aspects, drives derived from those factors. The framework is mechanical; outputs are reproducible by reading the prose.",
    "2. Only three Inner Attitudes can be character baselines: Stable (Weight+Space), Adream (Weight+Flow), Near (Weight+Time). The other three — Mobile, Remote, Awake — are outer Action Attitudes that fire as projections of a baseline under stress, never as resting states.",
    "3. Baseline + Stress determines the visible action. Stress = the third Motion Factor that is NOT in the baseline's inner pair (Weight is never a stress — it is in every baseline pair).",
    "4. Stable's only legal stresses are Time or Flow (Space is already in the baseline). Time-stressed Stable activates Passion. Flow-stressed Stable activates Spell.",
    "5. Working Actions (Mirodan §1, p. 347) are the eight visible motors. Each is a 3-axis combination of Weight × Time × Space: pressing, wringing, gliding, floating (Sustained — preparation pole); punching, slashing, dabbing, flicking (Quick — release pole).",
    "6. Preparation hierarchy (Mirodan §1.7, p. 347): every Quick action requires its Sustained partner to fire first. Without the prep, the Quick degrades into the Sustained — the audience reads it flat. Motor pairs: Pressing→Punching · Wringing→Slashing · Gliding→Dabbing · Floating→Flicking.",
    "7. Tempo is PERCEIVED by the audience — DERIVED from the actor's Deciding (the verb being played) under the Subconscious Motif (Inner Attitude + Aspect + Stress + Lining). The actor never picks tempo; it emerges. Mirodan Ch.1 p. 286 + p. 302: 'Punching can't be acted. To box can.' Only the transitive verb is conscious; tempo follows.",
    "8. Drive is derived from the 24-cell Drive table (Mirodan vol 2 pp. 552-557, illustrated 561a/563a/565a) via (Inner Attitude × Aspect × Stress). Each cell yields: drive_primary (resting Inner), drive_secondary (formative Outer), drive_introvert (hidden lining), drive_extravert (visible projection). Drive is not chosen from vibe and is not a playable verb — it is mechanical.",
    "9. For Infinex specifically: Stable baseline (Weight+Space), Flow stress (bound pole), Penetrating aspect (Space-led) → Diagram D in the 24-cell table → drive_primary=Spell, drive_secondary=Doing, drive_introvert=Passion, drive_extravert=Vision. The Main Character-Action Axis is Spell → Vision.",
    "10. Passion is present for Infinex as hidden/introvert lining, not absent. It becomes OFF-SPEC when it surfaces as visible/extravert projection: urgency framing, clock-as-deadline, FOMO, scarcity-of-attention, hype heat. Time-pressure language is the most common drift.",
    "11. The five tempi in rotation for Infinex are: Commanding (Stable · Strong/Direct · Pressing→Punching), Practical (Stable · Strong/Flexible · Wringing→Slashing), Sombre (Adream-outer · Strong/Bound · Pressing→Punching bound), Irradiant (Adream-outer · Light/Free · Floating→Flicking), Sociable (Remote-outer · Direct/Free · Gliding→Dabbing). Each pairs a Sustained-prep with a Quick-release motor — the preparation must fire first within the beat.",
    "12. Posts SHIFT tempo WITHIN themselves. A post is a beat sequence, not a single-tempo monolith. There is no canonical tempo arc per post kind (stress and energy order track the scene's circumstance, Mirodan vol 2 p. 552 fn) — sequence beats by what the through-action must do next; per-beat tempo is derived by the audience reading the prose.",
  ];
}

/**
 * RESOLVED PLACEMENT block — for variants that test whether the model needs
 * derivation infrastructure (kernel) or just resolved facts to write on-spec.
 */
function buildResolvedFactsBlock(voice: CharacterSpec): string[] {
  const motorLines: string[] = [];
  for (const name of voice.main_tempi) {
    const t = voice.tempi[name];
    if (!t) continue;
    motorLines.push(`  - ${t.motor[0]} → ${t.motor[1]}`);
  }
  const offSpecTics =
    voice.off_spec_regexes.length > 0
      ? voice.off_spec_regexes.map((r) => r.name).join(", ")
      : "urgency/FOMO/deadline language, AI-slop ('thrilled', 'game-changer'), anti-competitor pejoratives, em-dash density > 2 per 280 chars";
  return [
    "# RESOLVED PLACEMENT (use, don't derive)",
    "",
    `- Baseline: ${voice.inner_attitude} (Weight + ${voice.inner_attitude === "stable" ? "Space" : voice.inner_attitude === "near" ? "Time" : "Flow"})`,
    `- Locked stress: ${voice.stress}${voice.stress_pole ? ` (${voice.stress_pole} pole)` : ""}`,
    `- Aspect: ${voice.aspect}`,
    `- Drive axis: ${voice.drive_axis ?? `${voice.drive_primary} → ${voice.drive_secondary}`}`,
    `- Motor pairs in rotation:`,
    ...motorLines,
    `- Off-spec visible drive surface (reject): ${voice.off_spec_drives.join(", ") || "none"}`,
    `- Off-spec verbal tics (reject): ${offSpecTics}`,
  ];
}

function buildUserPrompt(
  card: ReleaseCard,
  beats: BeatSequence,
  channel: Channel,
  n: number,
  voice: CharacterSpec,
  feedback?: string,
): string {
  const profile = CHANNEL_GENERATION_PROFILES[channel];
  const parts = [
    `Release card (kind=${card.kind}, channel=${channel}):`,
    JSON.stringify(card, null, 2),
    "",
    `Channel constraint: ${profile.guidance}.`,
    `Hard channel max: ${profile.maxChars} characters.`,
    "",
  ];

  // -- Inner-work interpretive layer --------------------------------------
  // If the card carries dramaturgical intake (through_action, obstacle, etc.),
  // surface it explicitly so the model treats it as the *interpretive frame*
  // and not as additional facts. These fields are NOT in deployed_facts and
  // must not be quoted verbatim. They guide what the post MEANS, not what it
  // says.
  const innerWorkFields: Array<[string, string | undefined, string]> = [
    [
      "through_action",
      card.through_action,
      "What this post is doing toward the Super-Objective. Treat as the transitive intent driving every beat. Do NOT quote verbatim.",
    ],
    [
      "obstacle",
      card.obstacle,
      "What the post is landing AGAINST. The reader-side prior, genre default, or competitor framing it must displace. The post should feel like it knows this obstacle exists, without naming it.",
    ],
    [
      "reader_prior",
      card.reader_prior,
      "What the reader currently assumes. NOT a fact — never assert it. Land against it without naming it.",
    ],
    [
      "not_the_point",
      card.not_the_point,
      "The mechanical/changelog framing the post must AVOID. Negative anchor.",
    ],
    [
      "lining",
      card.lining,
      "The hidden Inner Action the Outer covers. The post should LEAK this — never name it in the prose, never quote it. Outer/Lining gap is the engine of the post (Mirodan §7.1-7.3).",
    ],
  ];

  const presentInnerWork = innerWorkFields.filter(([, value]) => value && value.trim().length > 0);
  if (presentInnerWork.length > 0) {
    parts.push(
      "# Inner-work interpretive layer (NOT deployed_facts — guides MEANING, not claims)",
      "These fields tell you what the moment means, what the reader expects, what the post is trying to land against, and what the surface is covering underneath. They are interpretive frame. Do NOT quote them verbatim, do NOT treat them as assertable claims, do NOT name the lining in the prose.",
      "",
    );
    for (const [key, value, instruction] of presentInnerWork) {
      parts.push(`**${key}**: ${value}`);
      parts.push(`  How to use: ${instruction}`);
      parts.push("");
    }
  }

  if (profile.beatless) {
    parts.push(
      "This channel does NOT use a beat sequence. Each candidate is a single phrase or short sentence.",
      "deployed_facts_used: exact strings from card.deployed_facts that materially support the text. not_said: exact strings for facts intentionally left out. Receipts are not a reason to force background facts into the phrase.",
      "",
    );
  } else {
    const beatLines = beats.beats.map((b, i) => {
      if (!b.tempo) throw new Error(`legacy single-call path requires tempo on every beat; got undefined at beat ${i}`);
      const t = voice.tempi[b.tempo];
      if (!t) throw new Error(`tempo ${b.tempo} not in ${voice.name} spec`);
      return `${i + 1}. ${b.tempo} (${t.motor[0]} → ${t.motor[1]})${b.hint ? ` — ${b.hint}` : ""}`;
    }).join("\n");
    parts.push("Beat sequence to follow:", beatLines, "");
  }

  if (feedback?.trim()) {
    parts.push(
      "Previous attempt failed validation. Fix these issues directly; do not explain the fix:",
      feedback.trim(),
      "",
    );
  }

  if (profile.beatless) {
    parts.push(
      `Produce ${n} distinct UI copy candidates for the ${channel} channel. Each candidate is ONE phrase (not a paragraph, not a sentence with multiple clauses). Stay within ${profile.maxChars} chars.`,
      "",
      `Return as a JSON array of {"text": string, "rationale": string, "deployed_facts_used": string[], "not_said": [{"fact": string, "reason": string}]}.`,
      `Each candidate should be a meaningfully different take — vary the action vs headline framing, not just the wording. No padding, no preamble.`,
    );
  } else if (channel === "x-thread") {
    parts.push(
      `Produce ${n} X thread candidates. Each candidate emits a tweets array, not a single text blob.`,
      `Stay within the per-tweet max before validation; do not rely on downstream trim.`,
      "",
      `Return as a JSON array of {"tweets": string[], "rationale": string, "deployed_facts_used": string[], "not_said": [{"fact": string, "reason": string}]}.`,
      `Each candidate should approach the same beat sequence from a different angle. No padding, no preamble.`,
    );
  } else if (channel === "carousel") {
    parts.push(
      `Produce ${n} in-app carousel candidates. Each candidate emits slides, not a single text blob.`,
      `Stay within the per-slide max before validation; do not rely on downstream trim.`,
      "",
      `Return as a JSON array of {"slides": [{"name": string, "body": string}], "rationale": string, "deployed_facts_used": string[], "not_said": [{"fact": string, "reason": string}]}.`,
      `Each candidate should approach the same beat sequence from a different angle. No padding, no preamble.`,
    );
  } else if (channel === "web") {
    parts.push(
      `Produce ${n} web feature-card candidates. Each candidate emits subheading/title/caption fields, not a single text blob.`,
      `Stay within the per-field max before validation; do not rely on downstream trim.`,
      "",
      `Return as a JSON array of {"subheading": string, "title": string, "caption": string, "rationale": string, "deployed_facts_used": string[], "not_said": [{"fact": string, "reason": string}]}.`,
      `Each candidate should approach the same beat sequence from a different angle. No padding, no preamble.`,
    );
  } else {
    parts.push(
      `Produce ${n} caption candidates for the ${channel} channel. Each candidate is a multi-paragraph post where each paragraph implements one beat in its declared tempo. Use a blank line between beats.`,
      `Stay within the hard channel max before validation; do not rely on the orchestrator to trim.`,
      "",
      `Return as a JSON array of {"text": string, "rationale": string, "deployed_facts_used": string[], "not_said": [{"fact": string, "reason": string}]}.`,
      `deployed_facts_used: exact strings from card.deployed_facts that materially support claims in the post text. Paraphrase is allowed when the claim is supported.`,
      `not_said: exact card.deployed_facts strings intentionally left out. Do not force background facts into the prose to make the receipt look complete.`,
      `Each candidate should approach the same beat sequence from a different angle. No padding, no preamble.`,
    );
  }

  return parts.join("\n");
}

// -- Response parsing ---------------------------------------------------------

function parseModelResponse(
  resp: { content: Anthropic.Message["content"] },
  beats: BeatSequence,
  channel: Channel,
): Candidate[] {
  const block = resp.content[0];
  const raw = block && block.type === "text" ? block.text : "";
  const arr = extractJsonArray(raw);
  return arr.map((c, i) => {
    const structured = parseStructuredCandidate(c, channel);
    return {
      id: `anthropic-${i}`,
      text: structured ? renderStructured(structured) : c.text,
      ...(structured ? { structured } : {}),
      channel,
      declared_beats: beats.beats,
      ...(Array.isArray(c.deployed_facts_used)
        ? { deployed_facts_used: c.deployed_facts_used.filter((f): f is string => typeof f === "string") }
        : {}),
      ...(Array.isArray(c.not_said)
        ? { not_said: parseNotSaid(c.not_said) }
        : {}),
      ...(c.rationale !== undefined ? { rationale: c.rationale } : {}),
      source: "anthropic" as const,
    };
  });
}

function parseStructuredCandidate(
  candidate: {
    tweets?: unknown;
    slides?: unknown;
    subheading?: unknown;
    title?: unknown;
    caption?: unknown;
    structured?: unknown;
    web_card?: unknown;
  },
  channel: Channel,
): StructuredOutput | undefined {
  if (channel === "x-thread") {
    const source = isRecord(candidate.structured) ? candidate.structured.tweets : candidate.tweets;
    const tweets = Array.isArray(source) ? source.filter((tweet): tweet is string => typeof tweet === "string") : [];
    return tweets.length > 0 ? { kind: "thread", tweets } : undefined;
  }
  if (channel === "carousel") {
    const source = isRecord(candidate.structured) ? candidate.structured.slides : candidate.slides;
    if (!Array.isArray(source)) return undefined;
    const slides = source.flatMap((slide) => {
      if (!isRecord(slide) || typeof slide.name !== "string" || typeof slide.body !== "string") return [];
      return [{ name: slide.name, body: slide.body }];
    });
    return slides.length > 0 ? { kind: "carousel", slides } : undefined;
  }
  if (channel === "web") {
    const source = isRecord(candidate.web_card)
      ? candidate.web_card
      : isRecord(candidate.structured)
        ? candidate.structured
        : candidate;
    if (typeof source.subheading !== "string" && typeof source.title !== "string" && typeof source.caption !== "string") {
      return undefined;
    }
    return {
      kind: "web-card",
      subheading: typeof source.subheading === "string" ? source.subheading : "",
      title: typeof source.title === "string" ? source.title : "",
      caption: typeof source.caption === "string" ? source.caption : "",
    };
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJsonArray(text: string): Array<{
  text: string;
  tweets?: unknown;
  slides?: unknown;
  subheading?: unknown;
  title?: unknown;
  caption?: unknown;
  structured?: unknown;
  web_card?: unknown;
  rationale?: string;
  deployed_facts_used?: unknown;
  not_said?: unknown;
}> {
  const start = text.indexOf("[");
  if (start === -1) throw new Error(`Generator response contains no JSON array.\n---\n${text.slice(0, 300)}`);

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "[") depth++;
    if (c === "]") {
      depth--;
      if (depth === 0) {
        const json = text.slice(start, i + 1);
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) throw new Error("Generator response JSON is not an array");
        return parsed;
      }
    }
  }

  throw new Error(`Generator response JSON array is not closed.\n---\n${text.slice(0, 300)}`);
}

function parseNotSaid(raw: unknown[]): NotSaidFact[] {
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const obj = item as Record<string, unknown>;
    if (typeof obj.fact !== "string") return [];
    return [{ fact: obj.fact, reason: typeof obj.reason === "string" ? obj.reason : "" }];
  });
}

// -- Stub mode ----------------------------------------------------------------

function stubCandidates(
  card: ReleaseCard,
  beats: BeatSequence,
  channel: Channel,
  n: number,
  voice: CharacterSpec,
): Candidate[] {
  // Deterministic stubs that ACTUALLY use the beat sequence — synthesizes one
  // sample paragraph per beat from the tempo's example_lines library, then
  // joins them. Good enough for end-to-end pipeline exercise without API.
  const candidates: Candidate[] = [];
  const factClaims = deployedFactClaims(card);
  const primaryFact = factClaims[0] ?? card.title;

  for (let k = 0; k < n; k++) {
    const paragraphs = beats.beats.map((b, beatIdx) => {
      if (!b.tempo) throw new Error(`stub path requires tempo on every beat; got undefined at beat ${beatIdx}`);
      const t = voice.tempi[b.tempo];
      if (!t) throw new Error(`tempo ${b.tempo} not in ${voice.name} spec`);
      // Laban-pure voices have no example_lines; fall back to canonical_shorthand
      // (or to the bare tempo name if neither is set).
      const examples = t.example_lines ?? [];
      const example = examples.length > 0
        ? (examples[(k + beatIdx) % examples.length] ?? "")
        : (t.canonical_shorthand ?? t.name);
      if (beatIdx === Math.floor(beats.beats.length / 2)) {
        // Inject one deployed fact into a middle beat so the stub exercises
        // the claim-contract path without calling the live model.
        return `${example}\n\n${primaryFact}.`;
      }
      return example;
    });
    const text = fitStubTextToChannel(paragraphs, card, beats, voice, channel);
    candidates.push({
      id: `stub-beat-${k}`,
      text,
      channel,
      declared_beats: beats.beats,
      deployed_facts_used: [primaryFact],
      not_said: factClaims
        .filter((fact) => fact !== primaryFact)
        .map((fact) => ({ fact, reason: "held back by deterministic stub; only one fact is deployed" })),
      rationale: `Stub composition from beat library, variation ${k + 1}`,
      source: "stub",
    });
  }

  // Include one intentionally-bad slop candidate when there is room so the
  // validator path is exercised end-to-end. n=1 should still return one usable
  // deterministic candidate for smoke tests and channel-specific generation.
  if (candidates.length > 1) {
    candidates[Math.min(2, candidates.length - 1)] = {
      id: "stub-slop",
      text: `We're thrilled to unlock a game-changing, next-gen, seamless experience. Don't miss out — act now! 🚀`,
      channel,
      declared_beats: beats.beats,
      deployed_facts_used: ["not in deployed facts"],
      not_said: [],
      rationale: "intentional slop fixture — validator must reject (cliches + AI-slop + time-pressure)",
      source: "stub",
    };
  }

  return candidates.slice(0, n);
}

function fitStubTextToChannel(
  paragraphs: string[],
  card: ReleaseCard,
  beats: BeatSequence,
  voice: CharacterSpec,
  channel: Channel,
): string {
  const text = paragraphs.join("\n\n");
  const maxChars = CHANNEL_GENERATION_PROFILES[channel].maxChars;
  if (text.length <= maxChars) return text;

  const primaryFact = deployedFactClaims(card)[0] ?? card.title;
  const compact = beats.beats.map((beat, i) => {
    const tempo = beat.tempo ? voice.tempi[beat.tempo] : undefined;
    const anchors = tempo?.vocab_anchor?.slice(0, i === 0 ? 2 : 3) ?? [beat.tempo ?? "—"];
    const anchorText = anchors.join(". ");
    if (i === 0) return `${primaryFact}. ${anchorText}.`;
    return `${anchorText}.`;
  });
  const compactText = compact.join("\n\n");
  if (compactText.length <= maxChars) return compactText;
  return primaryFact.slice(0, maxChars);
}

// =============================================================================
// Two-call generator — Stage A (inner work) + Stage B (drafting)
// =============================================================================
// Mirodan inheritance: the actor commits to thesis + beat plan + transitive
// verbs BEFORE drafting. Stage A produces InnerWork (planning); Stage B drafts
// conditioned on it (execution). The model cannot rationalize its way into the
// draft because it has already declared the plan.

interface InnerWorkGenerateOptions {
  voice?: CharacterSpec;
  channel?: Channel;
  model?: string;
  mode?: "live" | "stub" | "auto";
  feedback?: string;
  permutation?: PromptPermutation;
  /** Optional prompt capture — populates `.inner_work` when the live path runs. */
  capturePrompts?: GenerationPromptCapture;
  /** Optional client override (tests inject a mock to avoid an API key). */
  client?: AnthropicMessagesClient;
}

/**
 * Stage A: produce the inner work (thesis, through_action, obstacle, lining,
 * beat_plan with transitive verbs) for this card. Single call per card. Does
 * NOT draft. Output is consumed by draftFromInnerWork().
 */
export async function generateInnerWork(
  card: ReleaseCard,
  opts: InnerWorkGenerateOptions = {},
): Promise<InnerWork> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const channel = opts.channel ?? "x";

  const mode =
    opts.mode === "live"
      ? "live"
      : opts.mode === "stub"
        ? "stub"
        : process.env.ANTHROPIC_API_KEY
          ? "live"
          : "stub";

  if (mode === "stub") return stubInnerWork(card, voice, channel);

  const client = opts.client ?? new Anthropic();
  const systemPrompt = buildSystemPrompt(voice, opts.permutation);
  const userPrompt = buildInnerWorkUserPrompt(card, voice, channel, opts.feedback);
  if (opts.capturePrompts) {
    opts.capturePrompts.inner_work = { system: systemPrompt, user: userPrompt };
  }

  const resp = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return parseInnerWorkResponse(resp);
}

interface DraftFromInnerWorkOptions {
  voice?: CharacterSpec;
  channel?: Channel;
  n?: number;
  model?: string;
  mode?: "live" | "stub" | "auto";
  feedback?: string;
  permutation?: PromptPermutation;
  /** Optional prompt capture — populates `.drafting` when the live path runs. */
  capturePrompts?: GenerationPromptCapture;
  /** Optional client override (tests inject a mock to avoid an API key). */
  client?: AnthropicMessagesClient;
}

/**
 * Stage B: draft N candidates that execute the committed InnerWork. Each
 * candidate is a multi-beat post where each beat plays its declared
 * transitive verb in its declared tempo.
 */
export async function draftFromInnerWork(
  card: ReleaseCard,
  innerWork: InnerWork,
  opts: DraftFromInnerWorkOptions = {},
): Promise<Candidate[]> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const channel = opts.channel ?? "x";
  const n = opts.n ?? DEFAULT_N;

  const mode =
    opts.mode === "live"
      ? "live"
      : opts.mode === "stub"
        ? "stub"
        : process.env.ANTHROPIC_API_KEY
          ? "live"
          : "stub";

  if (mode === "stub") return stubDraftFromInnerWork(card, innerWork, channel, n, voice);

  const client = opts.client ?? new Anthropic();
  const systemPrompt = buildSystemPrompt(voice, opts.permutation);
  const userPrompt = buildDraftFromInnerWorkUserPrompt(card, voice, innerWork, channel, n, opts.feedback);
  if (opts.capturePrompts) {
    opts.capturePrompts.drafting = { system: systemPrompt, user: userPrompt };
  }

  const resp = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 32000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return parseDraftResponseWithBeatPlan(resp, innerWork, channel);
}

// -- Stage A: user prompt ---------------------------------------------------

function buildInnerWorkUserPrompt(
  card: ReleaseCard,
  voice: CharacterSpec,
  channel: Channel,
  feedback?: string,
): string {
  const profile = CHANNEL_GENERATION_PROFILES[channel];

  const parts: string[] = [
    "# Inner-work step (planning, NOT drafting)",
    "",
    "You are doing the actor's table-work on this release before any drafts are written. Mirodan inheritance: the actor never starts with a motor or a tempo. They start with the scene — what's true (Given Circumstances), what they want (Through-Action), what stands in the way (Obstacle), what the visible Outer covers (Lining). Only after this is committed do they choose the transitive VERB they will play.",
    "",
    "DO NOT WRITE DRAFTS. The drafting step will execute from your committed plan. Your job is to COMMIT to interpretation.",
    "",
    "DO NOT DECLARE A TEMPO. Per Mirodan Ch.1 p. 286 and p. 302, tempo is the visible/audible trace of the verb being played under the Subconscious Motif — the actor never picks it; the audience reads it. The validator scores tempo post-hoc by reading the drafted prose. Your only conscious lever is the transitive verb per beat.",
    "",
    `## Release card (kind=${card.kind})`,
    "",
    JSON.stringify(card, null, 2),
    "",
    `## Channel context`,
    `Target channel for downstream drafts: ${channel} (max ${profile.maxChars} chars). ${profile.guidance}.`,
    "",
  ];

  // Surface card-level inner-work fields if present (operator-declared or grounder-proposed).
  // Stage A's job is to USE them when present, REFINE them when too generic, INVENT them when absent.
  const cardInnerWork: Array<[string, string | undefined]> = [
    ["through_action", card.through_action],
    ["obstacle", card.obstacle],
    ["lining", card.lining],
    ["reader_prior", card.reader_prior],
    ["not_the_point", card.not_the_point],
  ];
  const presentCardFields = cardInnerWork.filter(([, v]) => v && v.trim().length > 0);
  if (presentCardFields.length > 0) {
    parts.push("## Card-level inner-work (operator-declared — USE these when good, REFINE when too generic, never ignore)");
    parts.push("");
    for (const [key, value] of presentCardFields) {
      parts.push(`- **${key}**: ${value}`);
    }
    parts.push("");
  } else {
    parts.push("## Card-level inner-work");
    parts.push("");
    parts.push("None declared on the card. You must INVENT through_action / obstacle / lining / reader_prior / not_the_point from first principles, grounded in deployed_facts + voice spec.");
    parts.push("");
  }

  parts.push("## Beat plan rules");
  parts.push("");
  parts.push(`- Beat count is CHANNEL-DEPENDENT and is a HARD CONSTRAINT:`);
  if (channel === "web") {
    parts.push("  - This is a **web** card (140 chars). ONE BEAT ONLY. The whole card is a single declarative + supporting clause — there is no narrative arc, no 'set up then land' structure. One paragraph. One beat.");
  } else if (channel === "x") {
    parts.push("  - This is an **x** post (280 chars). Beat count emerges from verb selection (Mirodan §1.7, vol 2 p. 347). A single beat that carries its Sustained prep inside it is legal and often correct — any of the four prep -> release pairs: Pressing -> Punching, Wringing -> Slashing, Gliding -> Dabbing, Floating -> Flicking. When the verb needs more room, sequence sustained-feeling setup before quick-feeling release.");
  } else if (channel === "in-product") {
    parts.push("  - This is **in-product** UI copy. Beatless — output a beat_plan of length 1, but the draft itself is ONE phrase, not a multi-beat post.");
  } else if (channel === "modal") {
    parts.push("  - This is an in-app **modal** dialog (~250 chars): a short title, a line or two, and a clear next action. Beat count emerges from the verbs — usually brief. Tight enough to read at a glance mid-task.");
  } else if (channel === "blog") {
    parts.push("  - This is a **blog** post (300–600 words). Beat count emerges from the through-action; long-form gives room for a full sequence. Don't pad — every beat earns its place.");
  } else {
    parts.push("  - Default: 3 beats.");
  }
  parts.push("- **Each beat declares a TRANSITIVE VERB the actor plays in that beat** ('to reveal', 'to mark', 'to invite', 'to disarm', 'to land', 'to compress', 'to refuse', 'to absolve'). Mirodan p. 351: 'Punching can't be acted. To box can.' The verb is the actor's conscious lever. Tempo emerges from how the verb is played under the inner work; the audience reads the tempo. You do not declare it.");
  parts.push("- **Each beat SCORES the Working Action its verb is played through** (Mirodan pp. 350-351: a transitive verb *fits* a Working Action; scoring the motor is table work, not tempo-picking). One of: pressing, punching, wringing, slashing, gliding, dabbing, floating, flicking. If you score a Quick release (punching/slashing/dabbing/flicking), set preparation_from to its Sustained partner (pressing/wringing/gliding/floating respectively: Pressing->Punching, Wringing->Slashing, Gliding->Dabbing, Floating->Flicking) and make sure that prep actually fires earlier in the same or a prior beat.");
  parts.push("- **Score motors across the placement's range, as the through-action demands.** A plan whose every beat is pressing/punching presents Doing-armor; a plan with no Weight and no Flow anywhere presents an Awake reporter. Light motors (gliding, floating and their releases) and Flow-borne textures are this character's stress made audible — use them when the beat's job is to open, lift, dissolve, or accompany rather than to land.");
  parts.push("- **Verb-level preparation hierarchy** (Mirodan §1.7, p. 347): a quick-release verb (to land, to snap, to sting, to lift) must be preceded by its sustained-prep counterpart (to set, to press, to draw out, to hold). Quick without prep degrades into the sustained motor and the audience reads it flat.");
  parts.push("- Each beat must declare a micro_objective (what the reader notices/feels) and obstacle_local (what the beat is fighting against in the reader — usually a genre default or prior expectation).");
  parts.push("- Optional shadow_move per beat: what the prose LEAKS underneath the Outer (Mirodan §7). This is the per-beat Lining-leak — never named in the eventual draft, but informs texture.");
  parts.push("");
  parts.push("## not_the_point discipline (HARD)");
  parts.push("When not_the_point names specific framings to avoid (e.g., 'do not list supported currencies', 'do not explain virtual account mechanics'), write the not_the_point field in your output as a CONCRETE, ENFORCEABLE instruction the drafting actor will see. Examples of strong not_the_point phrasing: 'The draft must NOT name any specific currency code (USD/EUR/etc) anywhere — not in a list, not inline, not as an example. The supported-currencies fact is in deployed_facts; the draft refuses to surface it.' The drafting actor respects what you write here verbatim — if you're vague, the regression returns.");
  parts.push("");

  if (feedback?.trim()) {
    parts.push("## Feedback from prior attempt");
    parts.push("");
    parts.push(feedback.trim());
    parts.push("");
  }

  parts.push("## Output");
  parts.push("");
  parts.push("Return a single JSON object matching this shape (no preamble, no prose outside the JSON):");
  parts.push("");
  parts.push("```json");
  parts.push(`{
  "thesis": "single declarative sentence — what this post MEANS. Names something that ends/dissolves/begins/becomes; not a restatement of deployed_facts.",
  "through_action": "to <transitive verb> <object> — what this post is doing toward the Super-Objective. Honor card.through_action if present; refine if generic.",
  "obstacle": "what stops the through_action from landing — reader prior, genre default, competitor framing. Honor card.obstacle if present.",
  "lining": "on the surface: X. underneath: Y. The hidden Inner Action the post LEAKS. Honor card.lining if present.",
  "reader_prior": "what the reader assumes before reading. NOT a fact — never assert it in drafts; only land against it.",
  "not_the_point": "the mechanical framing the drafts must AVOID. Specific (e.g., 'do not list supported currencies as a row'), not abstract.",
  "beat_plan": [
    {
      "verb": "to <transitive verb> — what this beat consciously plays. Mirodan §1: this is the actor's conscious lever per beat. NO tempo field.",
      "working_action": "the motor the verb is played through — one of: pressing | punching | wringing | slashing | gliding | dabbing | floating | flicking",
      "preparation_from": "required when working_action is a Quick release — its Sustained prep partner",
      "micro_objective": "what this beat makes the reader notice or feel",
      "obstacle_local": "what this beat is fighting against in the reader at this moment",
      "shadow_move": "optional — the involuntary Lining-leak this beat carries"
    }
  ],
  "rationale": "1-2 sentences: why this beat plan serves the through_action against the obstacle"
}`);
  parts.push("```");
  parts.push("");
  parts.push("Commit your table work. DO NOT write the draft text. The drafting actor will execute your plan.");

  return parts.join("\n");
}

// -- Stage A: response parsing ----------------------------------------------

function parseInnerWorkResponse(resp: { content: Anthropic.Message["content"] }): InnerWork {
  const block = resp.content[0];
  const raw = block && block.type === "text" ? block.text : "";
  const obj = extractJsonObject(raw);

  if (typeof obj.thesis !== "string") throw new Error(`Stage A: thesis missing or not a string.\n${JSON.stringify(obj).slice(0, 300)}`);
  if (typeof obj.through_action !== "string") throw new Error("Stage A: through_action missing");
  if (typeof obj.obstacle !== "string") throw new Error("Stage A: obstacle missing");
  if (typeof obj.lining !== "string") throw new Error("Stage A: lining missing");
  if (!Array.isArray(obj.beat_plan)) throw new Error("Stage A: beat_plan missing or not an array");

  const beat_plan: BeatPlan[] = obj.beat_plan.flatMap((b: unknown) => {
    if (!b || typeof b !== "object") return [];
    const beat = b as Record<string, unknown>;
    if (typeof beat.verb !== "string") return [];
    const workingAction = parseWorkingAction(beat.working_action);
    const preparationFrom = parseWorkingAction(beat.preparation_from);
    return [{
      verb: beat.verb,
      ...(workingAction ? { working_action: workingAction } : {}),
      ...(preparationFrom ? { preparation_from: preparationFrom } : {}),
      micro_objective: typeof beat.micro_objective === "string" ? beat.micro_objective : "",
      obstacle_local: typeof beat.obstacle_local === "string" ? beat.obstacle_local : "",
      ...(typeof beat.shadow_move === "string" ? { shadow_move: beat.shadow_move } : {}),
    }];
  });

  if (beat_plan.length === 0) throw new Error("Stage A: beat_plan parsed to zero valid beats");

  return {
    thesis: obj.thesis,
    through_action: obj.through_action,
    obstacle: obj.obstacle,
    lining: obj.lining,
    ...(typeof obj.reader_prior === "string" ? { reader_prior: obj.reader_prior } : {}),
    ...(typeof obj.not_the_point === "string" ? { not_the_point: obj.not_the_point } : {}),
    beat_plan,
    ...(typeof obj.rationale === "string" ? { rationale: obj.rationale } : {}),
    source: "anthropic",
  };
}

function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  if (start === -1) throw new Error(`No JSON object found.\n---\n${text.slice(0, 300)}`);

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) {
        const json = text.slice(start, i + 1);
        const parsed = JSON.parse(json);
        if (typeof parsed !== "object" || parsed === null) throw new Error("JSON parsed to non-object");
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error(`JSON object not closed.\n---\n${text.slice(0, 300)}`);
}

// -- Stage A: stub mode -----------------------------------------------------

function stubInnerWork(card: ReleaseCard, voice: CharacterSpec, channel: Channel): InnerWork {
  // Deterministic InnerWork. Tempo is no longer declared per beat (Mirodan:
  // emerges from the verb under inner work, validator scores it post-hoc).
  // Beat count is taken from voice.main_tempi as a sensible default.
  const beatCount = defaultBeatsForKindFallback(card.kind, voice).length;

  return {
    thesis: card.lining
      ? `[stub] ${card.title} — ${card.lining.slice(0, 80)}${card.lining.length > 80 ? "…" : ""}`
      : `[stub] ${card.title}: ${card.deployed_facts[0] ?? ""}`,
    through_action: card.through_action ?? `to ship ${card.title} cleanly`,
    obstacle: card.obstacle ?? "reader will read this as another announcement",
    lining: card.lining ?? "on the surface: a feature ships. underneath: the work is done.",
    ...(card.reader_prior ? { reader_prior: card.reader_prior } : {}),
    ...(card.not_the_point ? { not_the_point: card.not_the_point } : {}),
    beat_plan: Array.from({ length: beatCount }, (_, i) => ({
      verb: i === 0 ? "to set up" : i === beatCount - 1 ? "to lift" : "to land",
      micro_objective: `[stub] beat ${i + 1}`,
      obstacle_local: "stub-mode obstacle",
    })),
    rationale: `[stub] fallback beat plan from card.kind=${card.kind} for channel=${channel}`,
    source: "stub",
  };
}

function defaultBeatsForKindFallback(kind: string, voice: CharacterSpec): { tempo: TempoName }[] {
  // Used by stub Stage A only. Live Stage A picks beats from inner work.
  const mains = voice.main_tempi;
  if (mains.length === 0) return [{ tempo: "commanding" as TempoName }];
  // Honor existing defaultBeatsForKind shape for split/launch-tier/data-card
  // mostly by returning a sensible 3-beat default.
  switch (kind) {
    case "launch-tier":
      return mains.slice(0, 4).map((tempo) => ({ tempo }));
    case "split":
      return mains.slice(0, 3).map((tempo) => ({ tempo }));
    default:
      return mains.slice(0, 3).map((tempo) => ({ tempo }));
  }
}

// -- Stage B: user prompt ---------------------------------------------------

function buildDraftFromInnerWorkUserPrompt(
  card: ReleaseCard,
  voice: CharacterSpec,
  innerWork: InnerWork,
  channel: Channel,
  n: number,
  feedback?: string,
): string {
  const profile = CHANNEL_GENERATION_PROFILES[channel];
  const beatLines = innerWork.beat_plan.map((b, i) => {
    const motorHint = b.working_action
      ? `\n   - motor (play the verb THROUGH this Working Action — its dynamic, not its vocabulary): ${b.working_action}${b.preparation_from ? ` (prep: ${b.preparation_from} must fire first)` : ""}`
      : "";
    const shadowHint = b.shadow_move ? `\n   - shadow_move (leak underneath): ${b.shadow_move}` : "";
    return `${i + 1}. **verb to play**: ${b.verb}${motorHint}
   - micro_objective: ${b.micro_objective}
   - obstacle_local: ${b.obstacle_local}${shadowHint}`;
  }).join("\n");

  // Show the voice's full tempo vocabulary at the top as the model's mental
  // map — but the drafting step does NOT pick a tempo per beat. Tempo
  // emerges from how each verb lands; the validator scores it post-hoc.
  const vocabLines = Object.entries(voice.tempi)
    .filter(([, t]) => t !== undefined)
    .map(([name, t]) => `  - **${name}** (${t!.motor[0]} → ${t!.motor[1]})${t!.lining ? ` · standing Lining: ${t!.lining}` : ""}`);

  const parts: string[] = [
    "# Drafting step",
    "",
    "The inner-work step has already committed to the interpretation. Your job: produce N draft candidates that EXECUTE the committed plan. Each candidate is a multi-beat post where each paragraph plays its declared transitive verb.",
    "",
    "Do not re-interpret. Do not propose a different thesis. The committed plan is the constraint.",
    "",
    "**Tempo:** do not name or target a tempo. Mirodan Ch.1 p. 286 — tempo emerges from the verb being played under the inner work; the audience perceives it; the validator scores it post-hoc. Your job is to make the verb land. The voice's available tempo vocabulary is shown below as a reference for the dynamic palette this character lives in — it is NOT a per-beat target.",
    "",
    "## Voice's tempo vocabulary (reference only)",
    "",
    ...vocabLines,
    "",
    `## Release card (kind=${card.kind}, channel=${channel}, max ${profile.maxChars} chars)`,
    "",
    JSON.stringify(card, null, 2),
    "",
    `Channel guidance: ${profile.guidance}.`,
    "",
    "## Committed inner work (from table work — execute, do not re-litigate)",
    "",
    `**thesis**: ${innerWork.thesis}`,
    `**through_action**: ${innerWork.through_action}`,
    `**obstacle**: ${innerWork.obstacle}`,
    `**lining**: ${innerWork.lining}`,
  ];
  if (innerWork.reader_prior) parts.push(`**reader_prior**: ${innerWork.reader_prior}`);
  if (innerWork.not_the_point) parts.push(`**not_the_point**: ${innerWork.not_the_point} (NEGATIVE ANCHOR — drafts must NOT do this)`);
  parts.push("");
  parts.push("## Beat plan (each candidate executes ALL beats in order, one paragraph per beat)");
  parts.push("");
  parts.push(beatLines);
  parts.push("");

  parts.push("## Drafting discipline");
  parts.push("");
  if (innerWork.beat_plan.length === 1) {
    parts.push("- This is a SINGLE-BEAT post. ONE paragraph, no blank-line splits. The whole draft is one declarative + one supporting clause carried by the declared verb.");
  } else {
    parts.push("- Each paragraph IS one beat. Use a blank line between beats.");
  }
  parts.push("- Each paragraph must play its declared TRANSITIVE VERB. The verb is what the actor consciously does. The tempo will emerge from how you play it; do not name a tempo.");
  parts.push("- LEAK the lining (Mirodan §7.3: write the Outer, leak the Lining). Never name innerWork.lining verbatim; never name innerWork.through_action verbatim; never quote innerWork.obstacle.");
  parts.push(`- **HARD: respect not_the_point as a hard refusal, not a soft preference.** The draft must NOT contain framings or content patterns named in not_the_point. If not_the_point says "do not list currencies," then the draft contains zero currency codes (no USD, no EUR, no inline list, no examples). Refusal is the point — landing the named particulars of the deployed_facts WITHOUT touching the not_the_point framings is the discipline.`);
  parts.push(`- Stay within the channel max (${profile.maxChars} chars) BEFORE validation. Don't rely on downstream trim. If the channel is web (140 chars), the entire post is a single declarative — no narrative arc.`);
  parts.push("- Only assert claims in card.deployed_facts. Anything else is a fact-drift hard fail.");
  parts.push("");

  if (feedback?.trim()) {
    parts.push("## Feedback from prior attempt");
    parts.push(feedback.trim());
    parts.push("");
  }

  parts.push("## Output");
  parts.push("");
  parts.push(`Return a JSON array of ${n} candidates, each matching this shape (no prose outside the array):`);
  parts.push("");
  parts.push("```json");
  if (channel === "x-thread") {
    parts.push(`[
  {
    "tweets": ["tweet 1, <=280 chars", "tweet 2, <=280 chars"],
    "rationale": "1 sentence on how this candidate differs from the others",
    "deployed_facts_used": ["exact deployed_facts strings that materially support claims in the tweets"],
    "not_said": [{"fact": "exact deployed_facts string intentionally left out", "reason": "brief reason"}]
  }
]`);
  } else if (channel === "carousel") {
    parts.push(`[
  {
    "slides": [{"name": "slide title", "body": "1-3 sentence slide body"}],
    "rationale": "1 sentence on how this candidate differs from the others",
    "deployed_facts_used": ["exact deployed_facts strings that materially support claims in the slides"],
    "not_said": [{"fact": "exact deployed_facts string intentionally left out", "reason": "brief reason"}]
  }
]`);
  } else if (channel === "web") {
    parts.push(`[
  {
    "subheading": "short category label",
    "title": "headline, <=48 chars",
    "caption": "supporting fact, <=44 chars",
    "rationale": "1 sentence on how this candidate differs from the others",
    "deployed_facts_used": ["exact deployed_facts strings that materially support claims in the fields"],
    "not_said": [{"fact": "exact deployed_facts string intentionally left out", "reason": "brief reason"}]
  }
]`);
  } else {
    parts.push(`[
  {
    "text": "the full draft, paragraphs separated by blank lines, one paragraph per beat",
    "rationale": "1 sentence on how this candidate differs from the others",
    "deployed_facts_used": ["exact deployed_facts strings that materially support claims in the text"],
    "not_said": [{"fact": "exact deployed_facts string intentionally left out", "reason": "brief reason"}]
  }
]`);
  }
  parts.push("```");
  parts.push("");
  parts.push(`Each of the ${n} candidates must execute the SAME beat plan but approach the thesis from a different angle (different metaphor, different ordering of the through_action's emphasis, different leak of the Lining). Vary the angle, not the structure.`);

  return parts.join("\n");
}

// -- Stage B: response parsing (variant of parseModelResponse that carries the beat plan) --

function parseDraftResponseWithBeatPlan(
  resp: { content: Anthropic.Message["content"] },
  innerWork: InnerWork,
  channel: Channel,
): Candidate[] {
  const block = resp.content[0];
  const raw = block && block.type === "text" ? block.text : "";
  const arr = extractJsonArray(raw);
  return arr.map((c, i) => {
    const structured = parseStructuredCandidate(c, channel);
    return {
      id: `anthropic-${i}`,
      text: structured ? renderStructured(structured) : c.text,
      ...(structured ? { structured } : {}),
      channel,
      // No tempo declared per beat — only the verb the actor plays and the
      // motor it is scored through. The validator classifies tempo post-hoc
      // and checks membership in voice.tempi.
      declared_beats: innerWork.beat_plan.map((b) => ({
        hint: b.verb,
        objective_verb: b.verb,
        ...(b.working_action ? { working_action: b.working_action } : {}),
        ...(b.preparation_from ? { preparation_from: b.preparation_from } : {}),
      })),
      ...(Array.isArray(c.deployed_facts_used)
        ? { deployed_facts_used: c.deployed_facts_used.filter((f): f is string => typeof f === "string") }
        : {}),
      ...(Array.isArray(c.not_said)
        ? { not_said: parseNotSaid(c.not_said) }
        : {}),
      ...(c.rationale !== undefined ? { rationale: c.rationale } : {}),
      source: "anthropic" as const,
    };
  });
}

// -- Stage B: stub ----------------------------------------------------------

function stubDraftFromInnerWork(
  card: ReleaseCard,
  innerWork: InnerWork,
  channel: Channel,
  n: number,
  voice: CharacterSpec,
): Candidate[] {
  // Delegate to existing stub path with the InnerWork's beat plan substituted
  // as the beat sequence. Preserves stub fidelity (deterministic output, no
  // API) while exercising the two-call shape.
  // The stub still needs SOME beat sequence to drive stubCandidates' paragraph
  // count. Synthesize one from voice.main_tempi — tempo here is purely a
  // placeholder for the stub renderer, not a declaration from the generator.
  const placeholderTempi = voice.main_tempi.slice(0, innerWork.beat_plan.length);
  const beats: BeatSequence = {
    beats: innerWork.beat_plan.map((b, i) => ({
      tempo: placeholderTempi[i] ?? voice.main_tempi[0] ?? "irradiant" as TempoName,
      hint: b.verb,
    })),
  };
  const candidates = stubCandidates(card, beats, channel, n, voice);
  // Strip the placeholder tempo from declared_beats: the two-call path's
  // generator does not declare a tempo per beat. Only the verb hint survives.
  return candidates.map((c) => ({
    ...c,
    declared_beats: c.declared_beats.map((b) =>
      b.hint !== undefined ? { hint: b.hint } : {},
    ),
  }));
}
