import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReleaseCard } from "./card.js";
import {
  renderStructured,
  type Candidate,
  type CandidateMovementReceipt,
  type CandidateMovementScoreBeat,
  type Channel,
  type NotSaidFact,
  type StructuredOutput,
} from "./generator.js";
import { INFINEX_VOICE } from "./voice/infinex.js";
import type { CharacterSpec, TempoName, WorkingAction } from "./voice/types.js";
import {
  buildActorMemoryPack,
  buildDirectorMemoryPack,
  type ActorMemoryPack,
  type DirectorMemoryPack,
  type MirodanSourceIndexEntry,
} from "./actor-memory.js";

type AnthropicCreateParams = Anthropic.Beta.PromptCaching.MessageCreateParamsNonStreaming;

export interface AnthropicMessagesClient {
  messages: {
    create: (
      params: AnthropicCreateParams,
    ) => Promise<{
      content: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage["content"];
      usage?: Anthropic.Beta.PromptCaching.PromptCachingBetaUsage;
    }>;
  };
}

export interface ActorBeatPlan {
  verb: string;
  working_action: WorkingAction;
  physical_score: string;
  preparation_from?: WorkingAction;
  micro_objective: string;
  obstacle_local: string;
  shadow_move?: string;
}

export interface FactRequest {
  /** A specific, answerable question for the grounder. */
  question: string;
  /** Why the Actor/Director needs it — which claim it would unblock. */
  reason?: string;
  /** Channels whose copy depends on the answer (for targeted regeneration). */
  channels?: Channel[];
}

export interface ActorTableWork {
  thesis: string;
  through_action: string;
  obstacle: string;
  reader_prior: string;
  lining: string;
  not_the_point: string;
  channel_beat_plans: Partial<Record<Channel, ActorBeatPlan[]>>;
  /**
   * Specific, answerable questions the Actor wants the grounder to resolve
   * BEFORE it can write accurate copy. The Actor must request facts instead of
   * inventing adjacent specifics (e.g. naming a protocol's consensus mechanism
   * from training data, or comparing to providers the card never mentioned).
   */
  fact_requests: FactRequest[];
}

export interface ActorPerformanceCandidate {
  text: string;
  structured?: StructuredOutput;
  rationale: string;
  movement_receipt: ActorMovementReceipt[];
  deployed_facts_used: string[];
  not_said: NotSaidFact[];
}

export interface ActorMovementReceipt {
  text_span: string;
  objective_verb: string;
  working_action: WorkingAction;
  evidence: string;
}

export interface ActorDailyPages {
  page_1_given_circumstances: string;
  page_2_character_rehearsal: string;
  page_3_false_starts_and_adjustments: string;
  left_right_choices: Array<{
    left: string;
    right: string;
    decision: string;
  }>;
  what_felt_false: string[];
  warmed_state: string;
}

export type ActorWarmupMode = "none" | "daily_pages" | "scene_rehearsal";

export interface ActorSceneRehearsal {
  given_circumstances: string;
  reader_scene_partner: string;
  playable_objective: string;
  false_actions_rejected: Array<{
    action: string;
    reason: string;
  }>;
  rehearsal_passes: Array<{
    pass: number;
    action: string;
    text_or_moment: string;
    self_note: string;
  }>;
  final_playable_state: string;
}

export interface ActorWarmup {
  mode: ActorWarmupMode;
  daily_pages?: ActorDailyPages;
  scene_rehearsal?: ActorSceneRehearsal;
  notes: string[];
  warmed_state: string;
}

export interface ActorSelectedPerformance {
  selected_option: number;
  selection_rationale: string;
}

export interface ActorOutput {
  warmup: ActorWarmup;
  table_work: ActorTableWork;
  performances: Partial<Record<Channel, ActorPerformanceCandidate[]>>;
  selected_performances: Partial<Record<Channel, ActorSelectedPerformance>>;
}

export interface ActorPromptCapture {
  system: string;
  messages: ActorTranscriptMessage[];
  prompt_hash: string;
  source_index: MirodanSourceIndexEntry[];
}

export interface ActorAttemptResult {
  output: ActorOutput;
  candidates: Candidate[];
  emission_plan: ActorEmissionPlan;
  raw_response: string;
  transcript_messages: ActorTranscriptMessage[];
  prompt: ActorPromptCapture;
  memory: ActorMemoryPack;
  source: "anthropic" | "stub";
}

export interface ActorTranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateActorAttemptOptions {
  channels: Channel[];
  n?: number;
  warmup_mode?: ActorWarmupMode;
  flow_direction?: VerticalFlowDirection;
  feedback_wave_regime?: FeedbackWaveRegime;
  x_thread_target_tweets?: number;
  voice?: CharacterSpec;
  model?: string;
  mode?: "live" | "stub" | "auto";
  client?: AnthropicMessagesClient;
  previous_transcript?: ActorTranscriptMessage[];
  director_notes?: DirectorNotes;
}

export interface DirectorNotes {
  attempt: number;
  summary: string;
  notes: string[];
  feedback_wave?: FeedbackWaveSummary;
  preserve?: {
    through_action?: boolean;
    beat_plan?: boolean;
    working_actions?: boolean;
    objective_verbs?: boolean;
  };
  change?: {
    format?: string[];
    copy?: string[];
    facts?: string[];
    voice?: string[];
    movement?: string[];
    metaphor_image_system?: string[];
  };
}

export type VerticalFlowDirection = "inwards-out" | "outwards-in";
export type FeedbackWaveRegime = "two-tier" | "section-autonomous";
export type FeedbackWaveTier = "tier-1-holistic" | "tier-2-section-polish";

export interface ActorEmissionPlan {
  flow_direction: VerticalFlowDirection;
  flow_order: Channel[];
  feedback_wave_regime: FeedbackWaveRegime;
  x_thread_target_tweets?: number;
}

export interface FeedbackWaveSummary {
  regime: FeedbackWaveRegime;
  tier: FeedbackWaveTier;
  holistic_green_channels: Channel[];
  holistic_revision_channels: Channel[];
  locked_sections: FeedbackWaveSection[];
  revise_sections: FeedbackWaveSection[];
  regex_format_notes: string[];
  director_content_notes: string[];
}

export interface FeedbackWaveSection {
  channel: Channel;
  section: string;
  text_span?: string;
  reason: string;
}

export interface DirectorAuditPromptCapture {
  system: string;
  user: string;
  prompt_hash: string;
  source_index: MirodanSourceIndexEntry[];
}

export interface MotionEvidence {
  pole: string;
  evidence: string[];
  source_refs?: string[];
}

export interface WorkingActionEvidence {
  action: WorkingAction | string;
  evidence: string;
  source_refs?: string[];
}

export interface DirectorTempoBasis {
  attitude_or_state: string;
  variation_factors: string[];
  variation_poles: string[];
  excluded_present_poles: string[];
  rival_two_factor_reads_considered: Array<{
    tempo: string;
    factor_shape: string;
    reason_kept_or_rejected: string;
  }>;
}

export interface DirectorAuditResult {
  passed: boolean;
  copy_voice_passed: boolean;
  factual_passed: boolean;
  publication_gate_passed: boolean;
  primary_tempo: TempoName | "unknown";
  primary_confidence: number;
  tempo_basis: DirectorTempoBasis;
  motion_evidence: {
    weight: MotionEvidence;
    space: MotionEvidence;
    time: MotionEvidence;
    flow: MotionEvidence;
  };
  working_actions: WorkingActionEvidence[];
  movement_receipt_fit: {
    passed: boolean;
    issues: string[];
  };
  drive_read: string;
  placement_read: string;
  infinex_fit: {
    legal: boolean;
    reason: string;
    nearest_allowed_read?: string;
  };
  factual_issues: string[];
  publication_gate_issues: string[];
  voice_issues: string[];
  /**
   * Reader-fit flags: copy whose STANCE misfits the declared channel reader.
   * A note for the operator, NOT a gate — does not fail copy_voice/draft.
   */
  reader_fit_notes: string[];
  notes_for_actor: string[];
  /**
   * Questions the Director wants the grounder to answer. Emitted when copy makes
   * a proper-noun / technical claim not traceable to the card — the Director
   * both fails it factually AND requests the missing fact so the back-edge can
   * resolve it rather than leaving the Actor to re-invent.
   */
  fact_requests: FactRequest[];
  /** Per-beat (per-tweet / per-paragraph) classification for long-form audits. */
  per_beat: DirectorBeatAudit[];
  raw_response: string;
  prompt: DirectorAuditPromptCapture;
  memory: DirectorMemoryPack;
  source: "anthropic" | "stub";
}

export interface DirectorBeatAudit {
  beat: string;
  text_span: string;
  passed: boolean;
  issues: string[];
}

export interface AuditCandidateWithDirectorOptions {
  card: ReleaseCard;
  candidate: Candidate;
  channel: Channel;
  voice?: CharacterSpec;
  model?: string;
  mode?: "live" | "stub" | "auto";
  client?: AnthropicMessagesClient;
}

const DEFAULT_ACTOR_MODEL = process.env.COMMS_ACTOR_MODEL ?? "claude-opus-4-7";
const DEFAULT_DIRECTOR_MODEL = process.env.COMMS_DIRECTOR_MODEL ?? process.env.COMMS_ACTIVE_VALIDATOR_MODEL ?? "claude-sonnet-4-6";
const ACTOR_JSON_PARSE_ATTEMPTS = 3;

/**
 * Per-channel SITUATION profile. House rule (channel-profiles-situation-not-register):
 * profiles carry length + reader-context + CTA ONLY. Never stamp tempo, register,
 * or any Laban motor on a channel — voice emerges from table work, not the surface.
 *
 * reader_context is fed into the Actor's given circumstances so reader_prior is
 * DERIVED from the declared reader rather than self-invented each run, and into
 * the Director's user message so it can flag stance that misfits the reader.
 */
export interface ChannelProfile {
  max_chars: number;
  reader_context: string;
  /** Optional call-to-action expectation for the surface (situation, not register). */
  cta?: string;
}

export const CHANNEL_PROFILES: Record<Channel, ChannelProfile> = {
  x: {
    max_chars: 280,
    reader_context: "public timeline, mixed CT audience, scrolling, zero Infinex context assumed",
  },
  "x-thread": {
    max_chars: 280,
    reader_context: "same reader as x, but opted into depth by tapping in",
  },
  web: {
    max_chars: 140,
    reader_context: "cold prospect evaluating; arrived by link or search; no account assumed",
    cta: "a single clear next step (learn / start) — no account assumed",
  },
  "in-product": {
    max_chars: 80,
    reader_context: "logged-in user mid-session; already ours; needs orientation, not persuasion",
    cta: "one immediate in-product action label",
  },
  modal: {
    max_chars: 250,
    reader_context: "logged-in user, interrupted; deciding whether to engage right now",
    cta: "a clear engage-now / dismiss choice",
  },
  carousel: {
    max_chars: 240,
    reader_context: "active user browsing 'What's new'; existing user catching up",
  },
  blog: {
    max_chars: 3600,
    reader_context: "existing users + onlookers who chose to read; highest patience, expects substance",
  },
};

const INWARDS_OUT_FLOW: Channel[] = ["x", "x-thread", "in-product", "modal", "web", "carousel", "blog"];
const OUTWARDS_IN_FLOW: Channel[] = [...INWARDS_OUT_FLOW].reverse();

type ReleaseCardWithCategory = ReleaseCard & { category?: unknown };

function isBlogChangelogCard(card: ReleaseCard): boolean {
  const category = (card as ReleaseCardWithCategory).category;
  if (typeof category === "string") {
    return category === "changelog" || category === "changelogs";
  }
  return card.kind === "data-card-official" ||
    card.kind === "data-card-wry" ||
    card.kind === "launch-tier" ||
    card.kind === "split";
}

function buildBlogChangelogScaffoldSection(card: ReleaseCard, channels: Channel[]): string[] {
  if (!channels.includes("blog") || !isBlogChangelogCard(card)) return [];
  return [
    "",
    "## Blog changelog format scaffold",
    "Apply this scaffold only to performances.blog. Keep the declared blog reader_context unchanged.",
    "",
    "Frontmatter field set:",
    "```yaml",
    "---",
    "title: <release title>",
    "subtitle: <optional factual dek>",
    "date: <YYYY-MM-DD>",
    "published: false",
    "pinned: false",
    "category: changelogs",
    "coverImage:",
    "  src: <designer-cover-url>",
    "  alt: <factual alt text>",
    "  height: 640",
    "  width: 1280",
    "typefullyUrl: <optional x-thread-typefully-url>",
    "---",
    "```",
    "",
    "Body skeleton:",
    "```md",
    "### <heading>",
    "",
    "{% cloud-image src=\"<designer-cover-url>\" alt=\"<factual alt text>\" height=640 width=1280 /%}",
    "",
    "<opening section built from deployed_facts>",
    "",
    "---",
    "",
    "### <section heading>",
    "",
    "<body section built from deployed_facts>",
    "",
    "{% toggle title=\"<minor grouped item>\" defaultOpen=false %}",
    "<minor detail or grouped caveat>",
    "{% /toggle %}",
    "",
    "---",
    "",
    "### Coming up",
    "- <roadmap-backed next item, if supported by deployed_facts>",
    "",
    "For more, see the [Infinex Roadmap](https://infinex.xyz/roadmap).",
    "```",
    "",
    "Format constraints:",
    "- Write roughly 300-450 words.",
    "- Fill the scaffold through table work using only card.deployed_facts for assertions.",
    "- If an optional field has no support, omit it rather than inventing it.",
  ];
}

function buildActorEmissionPlan(
  channels: Channel[],
  opts: Pick<GenerateActorAttemptOptions, "flow_direction" | "feedback_wave_regime" | "x_thread_target_tweets">,
): ActorEmissionPlan {
  const flowDirection = opts.flow_direction ?? parseVerticalFlowDirection(process.env.COMMS_FLOW_DIRECTION) ?? "inwards-out";
  const canonicalOrder = flowDirection === "inwards-out" ? INWARDS_OUT_FLOW : OUTWARDS_IN_FLOW;
  const requested = new Set(channels);
  const flowOrder = canonicalOrder.filter((channel) => requested.has(channel));
  for (const channel of channels) {
    if (!flowOrder.includes(channel)) flowOrder.push(channel);
  }
  const explicitThreadTarget = opts.x_thread_target_tweets ?? parseThreadTarget(process.env.COMMS_X_THREAD_TARGET_TWEETS);
  return {
    flow_direction: flowDirection,
    flow_order: flowOrder,
    feedback_wave_regime: opts.feedback_wave_regime ?? parseFeedbackWaveRegime(process.env.COMMS_FEEDBACK_WAVE_REGIME) ?? "two-tier",
    ...(channels.includes("x-thread")
      ? { x_thread_target_tweets: explicitThreadTarget ?? sampleXThreadTargetTweetCount() }
      : {}),
  };
}

function parseVerticalFlowDirection(value: string | undefined): VerticalFlowDirection | undefined {
  if (value === "inwards-out" || value === "outwards-in") return value;
  return undefined;
}

function parseFeedbackWaveRegime(value: string | undefined): FeedbackWaveRegime | undefined {
  if (value === "two-tier" || value === "section-autonomous") return value;
  return undefined;
}

function parseThreadTarget(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return clampThreadTarget(Math.round(n));
}

let cachedPhantomThreadDistribution: Array<{ length: number; count: number }> | undefined;

function sampleXThreadTargetTweetCount(): number {
  const distribution = loadPhantomThreadDistribution();
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) {
    return weightedPick([
      { length: 2, count: 1 },
      { length: 3, count: 2 },
      { length: 4, count: 1 },
    ]);
  }
  return weightedPick(distribution);
}

function loadPhantomThreadDistribution(): Array<{ length: number; count: number }> {
  if (cachedPhantomThreadDistribution !== undefined) return cachedPhantomThreadDistribution;
  const candidates = [
    resolve(process.cwd(), "research/thread-corpus/phantom.json"),
    resolve(process.cwd(), "../research/thread-corpus/phantom.json"),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    cachedPhantomThreadDistribution = [];
    return cachedPhantomThreadDistribution;
  }
  try {
    const rows = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(rows)) {
      cachedPhantomThreadDistribution = [];
      return cachedPhantomThreadDistribution;
    }
    const counts = new Map<number, number>();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      if (record.editorial === false) continue;
      const rawLength = typeof record.tweet_count === "number"
        ? record.tweet_count
        : Array.isArray(record.tweets)
          ? record.tweets.length
          : undefined;
      if (rawLength === undefined) continue;
      const length = clampThreadTarget(rawLength);
      counts.set(length, (counts.get(length) ?? 0) + 1);
    }
    cachedPhantomThreadDistribution = [...counts.entries()].map(([length, count]) => ({ length, count }));
  } catch {
    cachedPhantomThreadDistribution = [];
  }
  return cachedPhantomThreadDistribution;
}

function clampThreadTarget(n: number): number {
  return Math.max(2, Math.min(6, n));
}

function weightedPick(distribution: Array<{ length: number; count: number }>): number {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return 3;
  let cursor = Math.random() * total;
  for (const item of distribution) {
    cursor -= item.count;
    if (cursor <= 0) return clampThreadTarget(item.length);
  }
  return clampThreadTarget(distribution[distribution.length - 1]?.length ?? 3);
}

export async function generateActorAttempt(
  card: ReleaseCard,
  opts: GenerateActorAttemptOptions,
): Promise<ActorAttemptResult> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const channels = opts.channels;
  const n = opts.n ?? 5;
  const warmupMode = opts.warmup_mode ?? "scene_rehearsal";
  const memory = buildActorMemoryPack(voice);
  const emissionPlan = buildActorEmissionPlan(channels, opts);
  const transcript = buildActorTranscript(card, channels, n, warmupMode, opts.previous_transcript, opts.director_notes, emissionPlan);
  assertLiveActorDirectorMode("Actor", opts.mode, opts.client);

  const client = opts.client ?? (new Anthropic().beta.promptCaching as unknown as AnthropicMessagesClient);
  let lastParseError: unknown;
  for (let parseAttempt = 1; parseAttempt <= ACTOR_JSON_PARSE_ATTEMPTS; parseAttempt++) {
    const resp = await createMessageWithRetry(client, {
      model: opts.model ?? DEFAULT_ACTOR_MODEL,
      max_tokens: 32000,
      // Cache the (voice-only, stable) actor system prefix. 5m ephemeral survives
      // the single-channel director-audit gap (~1-3 min), so a within-run handback
      // reads the prefix instead of re-paying it. 1h TTL (for cross-click reuse +
      // full multi-channel runs) needs an SDK upgrade — see notes.
      system: [{ type: "text", text: memory.system_prompt, cache_control: { type: "ephemeral" } }],
      messages: transcript,
    }, "Actor");
    const raw = textFromMessage(resp);
    try {
      const output = parseActorOutput(raw, channels);
      return {
        output,
        candidates: actorOutputToCandidates(output, channels, "anthropic", emissionPlan),
        emission_plan: emissionPlan,
        raw_response: raw,
        transcript_messages: [...transcript, { role: "assistant", content: raw }],
        prompt: {
          system: memory.system_prompt,
          messages: transcript,
          prompt_hash: memory.prompt_hash,
          source_index: memory.source_index,
        },
        memory,
        source: "anthropic",
      };
    } catch (err) {
      if (!isActorJsonParseError(err)) throw err;
      lastParseError = err;
      if (parseAttempt >= ACTOR_JSON_PARSE_ATTEMPTS) break;
    }
  }
  throw new Error(`Actor JSON parse failed after ${ACTOR_JSON_PARSE_ATTEMPTS} attempts: ${errorMessage(lastParseError)}`);
}

export async function auditCandidateWithDirector(
  opts: AuditCandidateWithDirectorOptions,
): Promise<DirectorAuditResult> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const memory = buildDirectorMemoryPack(voice);
  const user = buildDirectorUserMessage(opts);
  assertLiveActorDirectorMode("Director", opts.mode, opts.client);

  const client = opts.client ?? (new Anthropic().beta.promptCaching as unknown as AnthropicMessagesClient);
  const resp = await createMessageWithRetry(client, {
    model: opts.model ?? DEFAULT_DIRECTOR_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: memory.system_prompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  }, "Director");
  const raw = textFromMessage(resp);
  return parseDirectorAudit(raw, memory, user, "anthropic", opts.candidate.text, {
    channel: opts.channel,
    voice,
    ...(opts.candidate.structured ? { structured: opts.candidate.structured } : {}),
  });
}

/** Pre-warm the Director rubric cache with a minimal request. Warm failures are
 * non-fatal; audits will still run and simply miss the cache. */
export async function prewarmDirectorCache(opts: {
  voice?: CharacterSpec;
  mode?: "live" | "stub" | "auto";
  model?: string;
  client?: AnthropicMessagesClient;
}): Promise<void> {
  const voice = opts.voice ?? INFINEX_VOICE;
  const memory = buildDirectorMemoryPack(voice);
  assertLiveActorDirectorMode("Director", opts.mode, opts.client);
  const client = opts.client ?? (new Anthropic().beta.promptCaching as unknown as AnthropicMessagesClient);
  try {
    await client.messages.create({
      model: opts.model ?? DEFAULT_DIRECTOR_MODEL,
      max_tokens: 1,
      system: [{ type: "text", text: memory.system_prompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "warmup" }],
    });
  } catch {
    // Warm failures are non-fatal; audits will simply miss the cache.
  }
}

export function buildActorTranscript(
  card: ReleaseCard,
  channels: Channel[],
  n: number,
  warmupMode: ActorWarmupMode,
  previous: ActorTranscriptMessage[] | undefined,
  directorNotes: DirectorNotes | undefined,
  emissionPlan: ActorEmissionPlan = buildActorEmissionPlan(channels, {}),
): ActorTranscriptMessage[] {
  if (previous && previous.length > 0) {
    const next = [...previous];
    if (directorNotes) next.push({ role: "user", content: buildDirectorNotesMessage(directorNotes) });
    return next;
  }
  return [{ role: "user", content: buildActorAssignmentMessage(card, channels, n, warmupMode, emissionPlan) }];
}

export function buildActorAssignmentMessage(
  card: ReleaseCard,
  channels: Channel[],
  n: number,
  warmupMode: ActorWarmupMode = "scene_rehearsal",
  emissionPlan: ActorEmissionPlan = buildActorEmissionPlan(channels, {}),
): string {
  return [
    "# Assignment",
    "",
    "You are receiving a release card and must do table work, then perform all requested channels in one response.",
    "",
    `Required channels: ${channels.join(", ")}`,
    `Actor warm-up mode: ${warmupMode}`,
    `Candidates per channel: ${n} final-copy options; recommend exactly 1 favorite per channel.`,
    `Vertical flow direction: ${emissionPlan.flow_direction}`,
    `Vertical flow order for requested surfaces: ${emissionPlan.flow_order.join(" -> ")}`,
    `Feedback wave regime: ${emissionPlan.feedback_wave_regime}`,
    ...(emissionPlan.x_thread_target_tweets !== undefined
      ? [`X-thread target: ${emissionPlan.x_thread_target_tweets} tweets. This is a soft craft/cadence target; validator bounds remain 2-6 tweets and <=280 chars each.`]
      : []),
    "",
    "## Release card",
    "",
    JSON.stringify(card, null, 2),
    "",
    "## Channel reader contexts (given circumstances — who you are addressing on each surface)",
    "These are SITUATION, not register: who the reader is, what they already have, and what they came for. They do NOT tell you tempo, voice, or motor — those emerge from your table work. Derive reader_prior from the DECLARED reader below; do not invent a reader.",
    ...channels.map((channel) => `- ${channel}: ${CHANNEL_PROFILES[channel].reader_context}${CHANNEL_PROFILES[channel].cta ? ` | CTA: ${CHANNEL_PROFILES[channel].cta}` : ""}`),
    ...buildBlogChangelogScaffoldSection(card, channels),
    "",
    "## Performance constraints",
    "- Return JSON only. No prose outside the JSON.",
    ...buildWarmupModeInstructions(warmupMode),
    "- table_work.reader_prior must be DERIVED from the declared channel reader contexts above, not freely invented. State what THAT reader assumes before reading.",
    "- The same table work must govern every channel.",
    "- Generate one coherent narrative across requested surfaces. Do not write each channel as an independent announcement.",
    "- Follow the vertical flow direction: each surface expands from or compresses toward the adjacent surface in the flow order.",
    "- Phantom is craft calibration only for X-thread cadence/shape. Do not copy Phantom tone, emoji habits, slang, or looseness; keep the locked Infinex placement unchanged.",
    "- Do not name, choose, target, or declare tempo anywhere. The Director/audience reads tempo after the fact.",
    "- Do deliberately score Mirodan Working Actions. The Actor targets two layers: a playable transitive objective verb, and the Working Action/Subconscious Motif that motors it.",
    "- Channel beat plans must contain both layers. The verb is what the actor plays; the Working Action is how the verb is physically/psychologically scored.",
    "- Allowed Working Actions: pressing, wringing, gliding, floating, punching, slashing, dabbing, flicking.",
    "- Quick actions require their Sustained preparation earlier in the same channel score: pressing -> punching, wringing -> slashing, gliding -> dabbing, floating -> flicking.",
    "- A beat changes only when the local action/circumstance changes, not when a line breaks. Adjacent text spans may share the same verb and Working Action.",
    "- Never invent movement labels such as settle, land, cut-through, or reveal as Working Actions. Those may be objective verbs, not working_action values.",
    `- For each requested channel, write exactly ${n} final-copy options in performances[channel].`,
    "- Every performance option must include movement_receipt entries that map exact text spans to the Working Actions they carry.",
    "- In the JSON shape below, angle-bracket values are placeholders. Do not copy placeholder Working Actions; choose legal Working Actions from table work.",
    "- Warm-up/rehearsal sections may contain more than five fragments or passes if useful; the final performances array must still contain the requested option count.",
    "- selected_performances[channel].selected_option is 1-based: 1 selects the first option, 2 the second, and so on.",
    "- The blind Director audits every script-passing option. selected_performances is your recommendation, not a routing gate.",
    "- These writing budgets are guidance; the deterministic regex/structure gate is the formatting authority.",
    "- X: max 280 chars per candidate.",
    "- X-thread: emit `tweets`, target the assigned tweet count when present, 2-6 tweets total, <=280 chars each.",
    "- Web: emit `subheading`, `title`, and `caption`; subheading <=24 chars, title <=48 chars, caption <=44 chars.",
    "- Carousel: emit `slides`; 3-6 slides, each `name` <=40 chars and `body` <=240 chars.",
    "- In-product: one compact UI phrase.",
    "- Only assert claims supported by deployed_facts. The card's headline and title are operator INTENT, not fact: if the headline/title states a value (a number, name, or date) that deployed_facts do not support — or that a deployed_fact contradicts — defer to deployed_facts and do NOT repeat the headline's version. Receipts are traceability, not a writing target.",
    "- Do NOT invent adjacent specifics to fill a hole: no naming protocols/products/consensus-mechanisms/competitors the card never states, no comparisons to providers not in the card, no version tags. If you lack a fact you need, request it.",
    "- table_work.fact_requests is the back-edge to the grounder. List specific, answerable questions whose answers would let you write accurate copy (e.g. \"what swap providers does Swidge aggregate?\", \"are the HL spot assets wrapped, and by what?\", \"what was Infinex's previous swap/AMM product called?\"). Leave it [] if the card already supports everything. Prefer requesting a fact over writing around the hole or inventing it.",
    "- A deployed_fact may carry a basis/scope qualifier (an editorial cut, e.g. a count that is 'markets above $100k 24h volume; total is higher'). Treat such numbers as the cut they are; prefer NAMING entities (markets, providers, assets) over counting them.",
    "- Features the card marks as `changing-at-ship` are NOT yet familiar to the reader. Do not write 'the X you already use' for a feature that changes at ship.",
    "- For outward channels (x, x-thread, web, carousel), use the card's outward_product_name. Internal version tags (e.g. 'Spot V1') are changelog register and must not appear outward.",
    "- deployed_facts_used should contain exact card.deployed_facts strings that materially support claims in the final text.",
    "- not_said should use exact card.deployed_facts strings for facts intentionally left out. Do not force background facts, rail lists, provider names, or mechanics into prose just to satisfy receipt coverage.",
    "",
    "## Required JSON shape",
    "",
    `The channel_beat_plans, performances, and selected_performances objects must each contain EXACTLY these keys, one per requested channel: ${channels.map((c) => `"${c}"`).join(", ")}. Use these exact channel keys — do not substitute, add, or omit channels.`,
    "",
    "```json",
    `{`,
    `  "warmup": ${buildWarmupJsonShape(warmupMode)},`,
    `  "table_work": {`,
    `    "thesis": "what this release means",`,
    `    "through_action": "to <transitive verb> <object>",`,
    `    "obstacle": "reader prior / genre default this fights",`,
    `    "reader_prior": "what the reader assumes before reading",`,
    `    "lining": "surface: ... underneath: ...",`,
    `    "not_the_point": "mechanical framing to avoid",`,
    `    "fact_requests": [{"question": "specific answerable question for the grounder", "reason": "which claim this would unblock", "channels": ${JSON.stringify(channels)}}],`,
    `    "channel_beat_plans": {`,
    channels.map((c) => `      "${c}": ${ACTOR_BEAT_PLAN_EXAMPLE}`).join(",\n"),
    `    }`,
    `  },`,
    `  "performances": {`,
    channels.map((c) => `    "${c}": ${actorPerformanceExampleForChannel(c, emissionPlan)}`).join(",\n"),
    `  },`,
    `  "selected_performances": {`,
    channels.map((c) => `    "${c}": {"selected_option": 1, "selection_rationale": "why this option is the strongest performance"}`).join(",\n"),
    `  }`,
    `}`,
    "```",
  ].join("\n");
}

const ACTOR_BEAT_PLAN_EXAMPLE = `[{
        "verb": "to <transitive verb>",
        "working_action": "<pressing|wringing|gliding|floating|punching|slashing|dabbing|flicking>",
        "physical_score": "what the body/prose does in this beat",
        "micro_objective": "...",
        "obstacle_local": "...",
        "shadow_move": "..."
      }, {
        "verb": "to <same or changed transitive verb>",
        "working_action": "<pressing|wringing|gliding|floating|punching|slashing|dabbing|flicking>",
        "preparation_from": "<required Sustained partner if this beat uses punching|slashing|dabbing|flicking>",
        "physical_score": "what the body/prose does in this beat",
        "micro_objective": "...",
        "obstacle_local": "..."
      }]`;

const ACTOR_PERFORMANCE_EXAMPLE = `[{
      "text": "...",
      "rationale": "...",
      "movement_receipt": [{"text_span": "exact substring from text", "objective_verb": "to <verb>", "working_action": "<same legal Working Action used in this channel score>", "evidence": "why this span carries that physical action"}],
      "deployed_facts_used": [],
      "not_said": [{"fact": "...", "reason": "..."}]
    }]`;

function actorPerformanceExampleForChannel(channel: Channel, emissionPlan: ActorEmissionPlan): string {
  if (channel === "x-thread") {
    const target = emissionPlan.x_thread_target_tweets ?? 3;
    return `[{
      "tweets": ${JSON.stringify(Array.from({ length: target }, (_, i) => `tweet ${i + 1} text, <=280 chars`))},
      "rationale": "...",
      "movement_receipt": [{"text_span": "exact substring from one tweet", "objective_verb": "to <verb>", "working_action": "<same legal Working Action used in this channel score>", "evidence": "why this span carries that physical action"}],
      "deployed_facts_used": [],
      "not_said": [{"fact": "...", "reason": "..."}]
    }]`;
  }
  if (channel === "carousel") {
    return `[{
      "slides": [
        {"name": "slide title, <=40 chars", "body": "1-3 sentence slide body, <=240 chars"},
        {"name": "slide title, <=40 chars", "body": "1-3 sentence slide body, <=240 chars"},
        {"name": "slide title, <=40 chars", "body": "1-3 sentence slide body, <=240 chars"}
      ],
      "rationale": "...",
      "movement_receipt": [{"text_span": "exact substring from one slide body", "objective_verb": "to <verb>", "working_action": "<same legal Working Action used in this channel score>", "evidence": "why this span carries that physical action"}],
      "deployed_facts_used": [],
      "not_said": [{"fact": "...", "reason": "..."}]
    }]`;
  }
  if (channel === "web") {
    return `[{
      "subheading": "short category label",
      "title": "headline, <=48 chars",
      "caption": "supporting fact, <=44 chars",
      "rationale": "...",
      "movement_receipt": [{"text_span": "exact substring from subheading/title/caption", "objective_verb": "to <verb>", "working_action": "<same legal Working Action used in this channel score>", "evidence": "why this span carries that physical action"}],
      "deployed_facts_used": [],
      "not_said": [{"fact": "...", "reason": "..."}]
    }]`;
  }
  return ACTOR_PERFORMANCE_EXAMPLE;
}

function buildWarmupJsonShape(warmupMode: ActorWarmupMode): string {
  if (warmupMode === "none") {
    return `{
    "mode": "none",
    "notes": ["brief direct assignment note; no daily pages or scene rehearsal"],
    "warmed_state": "short description of the actor's direct playable state before table work"
  }`;
  }
  if (warmupMode === "scene_rehearsal") {
    return `{
    "mode": "scene_rehearsal",
    "scene_rehearsal": {
      "given_circumstances": "scene facts and pressure",
      "reader_scene_partner": "who the reader is in the scene",
      "playable_objective": "to <transitive verb> <object>",
      "false_actions_rejected": [{"action": "to <verb>", "reason": "why this played false"}],
      "rehearsal_passes": [{"pass": 1, "action": "to <verb>", "text_or_moment": "line fragment or moment rehearsed", "self_note": "what changed"}],
      "final_playable_state": "state before table work"
    },
    "notes": ["rehearsal adjustment notes"],
    "warmed_state": "short description of the actor's playable state before table work"
  }`;
  }
  return `{
    "mode": "daily_pages",
    "daily_pages": {
      "page_1_given_circumstances": "visible rehearsal notes on product world, release situation, reader prior, facts, pressure",
      "page_2_character_rehearsal": "how the character stands in this circumstance",
      "page_3_false_starts_and_adjustments": "what sounded wrong, what was rejected, how the actor warmed into the final state",
      "left_right_choices": [{"left": "one possible move", "right": "opposing possible move", "decision": "which way the actor goes and why"}],
      "what_felt_false": ["phrases, postures, claims, or energies the actor rejected"],
      "warmed_state": "daily-pages playable state"
    },
    "notes": ["daily-pages adjustment notes"],
    "warmed_state": "short description of the actor's playable state before table work"
  }`;
}

function buildWarmupModeInstructions(warmupMode: ActorWarmupMode): string[] {
  if (warmupMode === "none") {
    return [
      "- Do not write daily pages or scene rehearsal. Set warmup.mode to \"none\".",
      "- Use warmup.notes for a short direct assignment note only; then move straight into table work.",
    ];
  }
  if (warmupMode === "scene_rehearsal") {
    return [
      "- Before table work, rehearse the scene as an actor: given circumstances, reader as scene partner, playable objective, false actions rejected, rehearsal passes, final playable state.",
      "- Write scene rehearsal in first person as the actor: use `I`, `me`, and `my`, not third-person phrases like `the actor` or `the character`.",
      "- Rehearsal passes should sound like live playable adjustments: `I know...`, `I want...`, `I try...`, `I reject...`, `I change...`.",
      "- The scene rehearsal is visible actor work, not final copy.",
    ];
  }
  return [
    "- Before table work, write daily pages / actor notes to warm into the character. These are visible rehearsal notes, not final copy.",
    "- Daily pages must work through given circumstances, product world, reader prior, left/right choices, false starts, and what felt wrong before deciding the performance state.",
  ];
}

export function buildDirectorNotesMessage(notes: DirectorNotes): string {
  const preserve = notes.preserve ?? {
    through_action: true,
    beat_plan: true,
    working_actions: true,
    objective_verbs: true,
  };
  const change = notes.change ?? {};
  return [
    `# Director notes after attempt ${notes.attempt}`,
    "",
    notes.summary,
    "",
    "## Preserve unless explicitly contradicted",
    `- through_action: ${preserve.through_action !== false ? "preserve" : "may revise"}`,
    `- beat_plan: ${preserve.beat_plan !== false ? "preserve" : "may revise"}`,
    `- working_actions: ${preserve.working_actions !== false ? "preserve" : "may revise"}`,
    `- objective_verbs: ${preserve.objective_verbs !== false ? "preserve" : "may revise"}`,
    "",
    "## Change lanes",
    ...formatChangeLanes(change),
    "",
    ...(notes.feedback_wave ? formatFeedbackWave(notes.feedback_wave) : []),
    "## Notes to incorporate",
    ...notes.notes.map((note) => `- ${note}`),
    "",
    "Revise as the same Actor. Use the same actor warm-up mode from the original assignment and work through these notes in character before selecting a new favorite. Keep the same source-indexed character memory.",
    "Do not throw away table work, beat count, objective verbs, Working Actions, or preparation hierarchy unless the relevant preserve lane says `may revise` or a note explicitly diagnoses that layer as failed.",
    "Do not feed the Director's metaphor wording back as required final-copy wording. Treat metaphor/image-system notes as a drift diagnosis, then solve with fresh final copy grounded in deployed_facts.",
  ].join("\n");
}

function formatChangeLanes(change: NonNullable<DirectorNotes["change"]>): string[] {
  const lanes: Array<[keyof NonNullable<DirectorNotes["change"]>, string]> = [
    ["format", "regex/format"],
    ["copy", "copy"],
    ["facts", "facts"],
    ["voice", "voice"],
    ["movement", "movement"],
    ["metaphor_image_system", "metaphor/image-system"],
  ];
  const lines = lanes.flatMap(([key, label]) => {
    const values = change[key] ?? [];
    return values.length > 0 ? [`- ${label}: ${values.join("; ")}`] : [];
  });
  return lines.length > 0 ? lines : ["- none specified; preserve table work and make only local copy repairs."];
}

function formatFeedbackWave(wave: FeedbackWaveSummary): string[] {
  const lines: string[] = [
    "## Feedback wave",
    `- regime: ${wave.regime}`,
    `- tier: ${wave.tier}`,
    `- holistic green channels: ${wave.holistic_green_channels.length > 0 ? wave.holistic_green_channels.join(", ") : "none"}`,
    `- holistic revision channels: ${wave.holistic_revision_channels.length > 0 ? wave.holistic_revision_channels.join(", ") : "none"}`,
  ];
  if (wave.tier === "tier-1-holistic") {
    lines.push("- tier instruction: no sections are locked yet. Revise the whole channel arc until the Director/tone/content read is green.");
  } else {
    lines.push("- tier instruction: preserve locked green sections exactly unless a note says they break a neighbor. Polish revise sections neighbor-aware and keep the whole channel coherent.");
  }
  if (wave.regex_format_notes.length > 0) {
    lines.push("- regex/format notes:");
    lines.push(...wave.regex_format_notes.map((note) => `  - ${note}`));
  }
  if (wave.director_content_notes.length > 0) {
    lines.push("- Director tone/content notes:");
    lines.push(...wave.director_content_notes.map((note) => `  - ${note}`));
  }
  if (wave.locked_sections.length > 0) {
    lines.push("- locked sections:");
    lines.push(...wave.locked_sections.map((section) => `  - ${section.channel} ${section.section}: ${section.text_span ?? ""}${section.text_span ? " — " : ""}${section.reason}`));
  }
  if (wave.revise_sections.length > 0) {
    lines.push("- revise sections:");
    lines.push(...wave.revise_sections.map((section) => `  - ${section.channel} ${section.section}: ${section.text_span ?? ""}${section.text_span ? " — " : ""}${section.reason}`));
  }
  lines.push("");
  return lines;
}

export function buildDirectorUserMessage(opts: AuditCandidateWithDirectorOptions): string {
  const receipt = {
    deployed_facts_used: opts.candidate.deployed_facts_used ?? [],
    not_said: opts.candidate.not_said ?? [],
  };
  const movementReceipt = {
    movement_receipt: opts.candidate.movement_receipt ?? [],
  };
  return [
    "# Blind performance audit",
    "",
    "Classify the final prose only. Do not request or infer from actor table work.",
    "",
    "Audit mode: DRAFT GENERATION, not autonomous publishing.",
    "- Evaluate whether the copy is valid for the intended release state described by the release card.",
    "- Do not fail a candidate solely because external code/live-state confirmation is still needed before publication.",
    "- If copy would be safe only after code/live-state confirmation, put that in publication_gate_issues.",
    "- Set passed=false for factual issues only when the copy contradicts deployed_facts, invents unsupported claims, or would remain false even at the intended ship state. The release card's headline and title are operator INTENT, not fact support — judge factual claims against deployed_facts ONLY, never against the headline/title. Copy that matches the headline but states a value a deployed_fact contradicts is a hard factual fail.",
    "- INVENTS OR CONTRADICTS A FACT (hard factual fail): any claim — product/protocol names, consensus mechanisms, competitor/provider comparisons, version tags, AND any number, quantity, count, percentage, or date — that is NOT traceable to a deployed_fact, OR that CONTRADICTS a deployed_fact's value. A comparison to a provider the card never names (e.g. 'unlike Curve or Jupiter'), or a named mechanism the card never states (e.g. 'HyperBFT consensus'), is invented even if it is true in the world. A numeric/quantity value that disagrees with a deployed_fact is a contradiction EVEN IF the headline or title repeats the wrong value (the headline is intent, not fact). Add it to factual_issues AND emit a fact_request so the grounder can resolve it.",
    "- fact_requests: when a claim is unsupported but plausibly groundable, write a specific answerable question for the grounder (e.g. \"what swap providers does Swidge aggregate?\"). The grounder will answer and the Actor will regenerate. Do not silently pass an unsupported specific.",
    "- VERSION-TAG REGISTER: for outward channels (x, x-thread, web, carousel), an internal version tag such as 'V1', 'Spot V1', 'v2' on the product name is changelog register and is off-spec outward. Flag it as a voice_issue (and prefer the card's outward_product_name).",
    "- The later human ship gate owns final publication readiness.",
    "- Lining is usually hidden. Do not fail copy because the Lining is not visibly stated; fail when hidden Lining surfaces as an explicit meaning/thesis.",
    "- Drives are read from the visible result, not performed directly. Doing or Spell as visible surface can be legal for Infinex. Do not fail a single line solely because Vision is not visibly projected.",
    "- Passion/urgency/FOMO remains off-spec when foregrounded as visible surface.",
    "- For very short copy (one compact line or <=20 words), soften certainty. Do not assign 1.0 confidence to a full tempo read from a microcopy surface.",
    "- Audit the movement_receipt as a claim about the final text span. Regex has only checked impossible wiring; you judge whether the claimed Working Action is actually present in the prose.",
    "- PER-BEAT AUDIT (long-form): for blog and x-thread, do NOT audit only the whole. Classify each paragraph (blog) or each tweet (x-thread) in per_beat[], with its own pass and any issues. A slop paragraph must not hide inside a passing whole. The overall read passes only if every beat passes; surface any beat-level violation in factual_issues/voice_issues and set the relevant gate false.",
    "- READER FIT: the declared reader below is the surface's situation, not its register. If the copy's STANCE misfits that reader — e.g. persuading a logged-in user who is already ours, assuming account context for a cold prospect, or pitching basics to a reader who opted into depth — record it in reader_fit_notes (NOT voice_issues). reader_fit_notes is a flag for the operator and does NOT fail the draft. Do not down-weight tempo/register because of the channel.",
    "",
    `Channel: ${opts.channel}`,
    `Declared reader (situation): ${CHANNEL_PROFILES[opts.channel].reader_context}${CHANNEL_PROFILES[opts.channel].cta ? ` | CTA: ${CHANNEL_PROFILES[opts.channel].cta}` : ""}`,
    "",
    "## Candidate text",
    "",
    opts.candidate.text,
    "",
    "## Release card fact contract",
    "",
    JSON.stringify(opts.card, null, 2),
    "",
    "## Candidate fact receipt",
    "",
    JSON.stringify(receipt, null, 2),
    "",
    "## Candidate movement receipt",
    "",
    JSON.stringify(movementReceipt, null, 2),
    "",
    "## Required JSON shape",
    "",
    "```json",
    `{
  "passed": false,
  "copy_voice_passed": false,
  "factual_passed": false,
  "publication_gate_passed": false,
  "primary_tempo": "unknown",
  "primary_confidence": 0,
  "tempo_basis": {
    "attitude_or_state": "Stable|Near|Adream|Mobile outer|Remote outer|Awake outer|unknown",
    "variation_factors": ["exactly two Motion Factor names used to name the tempo"],
    "variation_poles": ["exactly two poles used to name the tempo"],
    "excluded_present_poles": ["present poles treated as stress/motor/context, not tempo-name factors"],
    "rival_two_factor_reads_considered": [{"tempo": "candidate tempo", "factor_shape": "two-factor shape", "reason_kept_or_rejected": "..."}]
  },
  "motion_evidence": {
    "weight": {"pole": "Strong|Light|unclear", "evidence": ["observation: ..."], "source_refs": ["source id / section for the factor mapping"]},
    "space": {"pole": "Direct|Flexible|unclear", "evidence": ["observation: ..."], "source_refs": ["source id / section for the factor mapping"]},
    "time": {"pole": "Quick|Sustained|unclear", "evidence": ["observation: ..."], "source_refs": ["source id / section for the factor mapping"]},
    "flow": {"pole": "Bound|Free|unclear", "evidence": ["observation: ..."], "source_refs": ["source id / section for the factor mapping"]}
  },
	  "working_actions": [{"action": "pressing", "evidence": "observation: ...", "source_refs": ["source id / section for the working-action table"]}],
	  "movement_receipt_fit": {"passed": false, "issues": ["receipt action absent from felt movement, or [] if the claim is present"]},
	  "drive_read": "spell|doing|passion|vision|mixed|unknown",
  "placement_read": "short placement read",
  "infinex_fit": {"legal": false, "reason": "...", "nearest_allowed_read": "..."},
  "factual_issues": [],
  "publication_gate_issues": [],
  "voice_issues": [],
  "fact_requests": [{"question": "specific answerable question for the grounder when a claim is unsupported but groundable", "reason": "which claim this would unblock"}],
  "per_beat": [{"beat": "tweet 1 | paragraph 1 | whole", "text_span": "first ~80 chars of the beat", "passed": true, "issues": []}],
  "reader_fit_notes": [],
  "notes_for_actor": []
}`,
    "```",
    "",
    "Set `passed` for draft-generation validity only: copy_voice_passed && factual_passed && infinex_fit.legal. Do not include publication_gate_passed in `passed`.",
  ].join("\n");
}

export function parseActorOutput(raw: string, channels: Channel[]): ActorOutput {
  const obj = extractJsonObject(raw);
  const warmupInput = isRecord(obj.warmup)
    ? obj.warmup
    : { mode: "daily_pages", daily_pages: obj.daily_pages, notes: [], warmed_state: isRecord(obj.daily_pages) && typeof obj.daily_pages.warmed_state === "string" ? obj.daily_pages.warmed_state : "" };
  const table = recordValue(obj.table_work, "table_work");
  const performances = recordValue(obj.performances, "performances");
  const selectedPerformances = isRecord(obj.selected_performances) ? obj.selected_performances : {};
  const channel_beat_plans = recordValue(table.channel_beat_plans, "table_work.channel_beat_plans");

  const output: ActorOutput = {
    warmup: parseWarmup(warmupInput),
    table_work: {
      thesis: stringValue(table.thesis, "table_work.thesis"),
      through_action: stringValue(table.through_action, "table_work.through_action"),
      obstacle: stringValue(table.obstacle, "table_work.obstacle"),
      reader_prior: stringValue(table.reader_prior, "table_work.reader_prior"),
      lining: stringValue(table.lining, "table_work.lining"),
      not_the_point: stringValue(table.not_the_point, "table_work.not_the_point"),
      fact_requests: parseFactRequests(table.fact_requests, channels),
      channel_beat_plans: {},
    },
    performances: {},
    selected_performances: {},
  };

  for (const channel of channels) {
    output.table_work.channel_beat_plans[channel] = parseBeatPlanArray(channel_beat_plans[channel], channel);
    output.performances[channel] = parsePerformanceArray(performances[channel], channel);
    output.selected_performances[channel] = parseSelectedPerformance(selectedPerformances[channel], channel);
  }

  return output;
}

export function actorOutputToCandidates(
  output: ActorOutput,
  channels: Channel[],
  source: "anthropic" | "stub",
  emissionPlan?: ActorEmissionPlan,
): Candidate[] {
  return channels.flatMap((channel) => {
    const plan = output.table_work.channel_beat_plans[channel] ?? [];
    const performances = output.performances[channel] ?? [];
    const selection = output.selected_performances[channel];
    const selectedOption = selection?.selected_option ?? 1;
    const selectedIndex = Math.max(0, Math.min(Math.max(performances.length - 1, 0), selectedOption - 1));
    return performances.map((candidate, index) => ({
      id: `actor-${channel}-option-${index + 1}`,
      text: candidate.text,
      ...(candidate.structured ? { structured: candidate.structured } : {}),
      channel,
      declared_beats: plan.map((beat) => ({
        hint: beat.verb,
        objective_verb: beat.verb,
        working_action: beat.working_action,
        physical_score: beat.physical_score,
        ...(beat.preparation_from ? { preparation_from: beat.preparation_from } : {}),
      })),
      movement_score: plan.map(actorBeatPlanToCandidateMovement),
      movement_receipt: candidate.movement_receipt.map(actorReceiptToCandidateReceipt),
      deployed_facts_used: candidate.deployed_facts_used,
      not_said: candidate.not_said,
      rationale: [
        emissionPlan
          ? `Vertical flow: ${emissionPlan.flow_direction} (${emissionPlan.flow_order.join(" -> ")}).`
          : "",
        `Actor option ${index + 1}${index === selectedIndex ? " (Actor recommended)" : ""}.`,
        candidate.rationale,
        formatMovementReceipt(candidate.movement_receipt),
        selection
          ? index === selectedIndex
            ? `Actor recommendation: ${selection.selection_rationale}`
            : `Actor recommended option ${selectedIndex + 1} instead: ${selection.selection_rationale}`
          : "Actor recommendation missing; parser fallback selected option 1.",
      ].filter(Boolean).join("\n\n"),
      source,
    }));
  });
}

function actorBeatPlanToCandidateMovement(beat: ActorBeatPlan): CandidateMovementScoreBeat {
  return {
    objective_verb: beat.verb,
    working_action: beat.working_action,
    physical_score: beat.physical_score,
    ...(beat.preparation_from ? { preparation_from: beat.preparation_from } : {}),
  };
}

function actorReceiptToCandidateReceipt(receipt: ActorMovementReceipt): CandidateMovementReceipt {
  return {
    text_span: receipt.text_span,
    objective_verb: receipt.objective_verb,
    working_action: receipt.working_action,
    evidence: receipt.evidence,
  };
}

function formatMovementReceipt(receipt: ActorMovementReceipt[]): string {
  if (receipt.length === 0) return "";
  return [
    "Movement receipt:",
    ...receipt.map((item) =>
      `- ${item.working_action} / ${item.objective_verb}: "${item.text_span}" — ${item.evidence}`,
    ),
  ].join("\n");
}

export interface ParseDirectorAuditContext {
  channel?: Channel;
  voice?: CharacterSpec;
  structured?: StructuredOutput;
}

export function parseDirectorAudit(
  raw: string,
  memory: DirectorMemoryPack,
  user: string,
  source: "anthropic" | "stub",
  candidateText?: string,
  ctx: ParseDirectorAuditContext = {},
): DirectorAuditResult {
  const obj = extractJsonObject(raw);
  const fit = isRecord(obj.infinex_fit) ? obj.infinex_fit : {};
  const motion = isRecord(obj.motion_evidence) ? obj.motion_evidence : {};
  const factualIssues = stringArray(obj.factual_issues);
  const publicationGateIssues = stringArray(obj.publication_gate_issues);
  const voiceIssues = stringArray(obj.voice_issues);
  const readerFitNotes = stringArray(obj.reader_fit_notes);
  const movementReceiptFit = isRecord(obj.movement_receipt_fit) ? obj.movement_receipt_fit : {};
  const legal = Boolean(fit.legal);
  let copyVoicePassed = typeof obj.copy_voice_passed === "boolean"
    ? obj.copy_voice_passed
    : Boolean(obj.passed) && legal && voiceIssues.length === 0;
  let factualPassed = typeof obj.factual_passed === "boolean"
    ? obj.factual_passed
    : factualIssues.length === 0;
  const publicationGatePassed = typeof obj.publication_gate_passed === "boolean"
    ? obj.publication_gate_passed
    : publicationGateIssues.length === 0;
  let legalEffective = legal;
  let fitReason = typeof fit.reason === "string" ? fit.reason : "";
  const primaryTempo = parseTempoName(obj.primary_tempo);
  const perBeat = parseDirectorBeatAudits(obj.per_beat);
  const factRequests = parseFactRequests(obj.fact_requests);
  const voice = ctx.voice ?? INFINEX_VOICE;

  // ── Deterministic gate 1: beat-only tempo cannot be the PRIMARY read ────────
  // 6/42 audits read primary_tempo as a beat_only_tempi entry (e.g.
  // "self-contained") and still set legal=true. A reserve/beat-only tempo as the
  // whole-copy primary read is illegal — EXCEPT single-beat microcopy (a one-line
  // in-product/modal surface), where a single contained beat can be legal; there
  // it downgrades to a voice_issue flagged for operator adjudication.
  if (primaryTempo !== "unknown" && voice.beat_only_tempi.includes(primaryTempo)) {
    if (isSingleBeatMicrocopy(ctx.channel, candidateText)) {
      voiceIssues.push(
        `primary_tempo "${primaryTempo}" is a beat-only/reserve tempo; legal here only as a single contained microcopy beat — flagged for operator adjudication.`,
      );
    } else {
      legalEffective = false;
      const beatOnlyReason = `primary_tempo "${primaryTempo}" is a beat-only/reserve tempo, not a primary allowed tempo; it cannot be the whole-copy primary read.`;
      fitReason = fitReason ? `${fitReason} ${beatOnlyReason}` : beatOnlyReason;
      voiceIssues.push(beatOnlyReason);
    }
  }

  // ── Deterministic gate 2: outward-channel version tags ──────────────────────
  if (candidateText && isOutwardChannel(ctx.channel)) {
    const tag = detectVersionTag(candidateText);
    if (tag && !voiceIssues.some((issue) => issue.includes(tag))) {
      voiceIssues.push(
        `internal version tag "${tag}" appears in an outward channel (${ctx.channel}); version tags are changelog register and off-spec outward.`,
      );
    }
  }

  // ── Deterministic gate 3: per-beat overall pass requirement ─────────────────
  // For long-form, the whole cannot pass while a beat fails.
  const failingBeats = perBeat.filter((beat) => !beat.passed);
  if (failingBeats.length > 0) {
    for (const beat of failingBeats) {
      const summary = beat.issues.length > 0 ? beat.issues.join("; ") : "beat-level violation";
      voiceIssues.push(`${beat.beat}: ${summary}`);
    }
  }

  // Re-derive copy/voice pass from the (possibly augmented) voice issues + legality.
  if (typeof obj.copy_voice_passed === "boolean") {
    copyVoicePassed = obj.copy_voice_passed && voiceIssues.length === 0 && legalEffective;
  } else {
    copyVoicePassed = copyVoicePassed && voiceIssues.length === 0 && legalEffective;
  }
  if (typeof obj.factual_passed === "boolean") {
    factualPassed = obj.factual_passed && factualIssues.length === 0;
  } else {
    factualPassed = factualIssues.length === 0;
  }

  const draftPassed = copyVoicePassed && factualPassed && legalEffective;
  return {
    passed: draftPassed,
    copy_voice_passed: copyVoicePassed,
    factual_passed: factualPassed,
    publication_gate_passed: publicationGatePassed,
    primary_tempo: primaryTempo,
    primary_confidence: softenShortCopyConfidence(
      clamp01(typeof obj.primary_confidence === "number" ? obj.primary_confidence : 0),
      candidateText,
    ),
    tempo_basis: parseTempoBasis(obj.tempo_basis),
    motion_evidence: {
      weight: parseMotionEvidence(motion.weight),
      space: parseMotionEvidence(motion.space),
      time: parseMotionEvidence(motion.time),
      flow: parseMotionEvidence(motion.flow),
    },
    working_actions: parseWorkingActions(obj.working_actions),
    movement_receipt_fit: {
      passed: typeof movementReceiptFit.passed === "boolean"
        ? movementReceiptFit.passed
        : stringArray(movementReceiptFit.issues).length === 0,
      issues: stringArray(movementReceiptFit.issues),
    },
    drive_read: typeof obj.drive_read === "string" ? obj.drive_read : "unknown",
    placement_read: typeof obj.placement_read === "string" ? obj.placement_read : "unknown",
    infinex_fit: {
      legal: legalEffective,
      reason: fitReason,
      ...(typeof fit.nearest_allowed_read === "string" ? { nearest_allowed_read: fit.nearest_allowed_read } : {}),
    },
    factual_issues: factualIssues,
    publication_gate_issues: publicationGateIssues,
    voice_issues: voiceIssues,
    reader_fit_notes: readerFitNotes,
    fact_requests: factRequests,
    per_beat: perBeat,
    notes_for_actor: stringArray(obj.notes_for_actor),
    raw_response: raw,
    prompt: {
      system: memory.system_prompt,
      user,
      prompt_hash: memory.prompt_hash,
      source_index: memory.source_index,
    },
    memory,
    source,
  };
}

function parseDirectorBeatAudits(value: unknown): DirectorBeatAudit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const beat = typeof item.beat === "string" ? item.beat : typeof item.section === "string" ? item.section : "";
    if (!beat) return [];
    return [{
      beat,
      text_span: typeof item.text_span === "string" ? item.text_span : "",
      passed: typeof item.passed === "boolean" ? item.passed : stringArray(item.issues).length === 0,
      issues: stringArray(item.issues),
    }];
  });
}

const OUTWARD_CHANNELS: Channel[] = ["x", "x-thread", "web", "carousel"];

function isOutwardChannel(channel: Channel | undefined): boolean {
  return channel !== undefined && OUTWARD_CHANNELS.includes(channel);
}

function isSingleBeatMicrocopy(channel: Channel | undefined, text: string | undefined): boolean {
  if (channel !== "in-product" && channel !== "modal") return false;
  if (!text) return true;
  const normalized = text.trim();
  return !normalized.includes("\n");
}

/** Detect an internal version tag like "Spot V1", "V2", "v1.2" as a standalone token. */
export function detectVersionTag(text: string): string | undefined {
  const match = text.match(/\bv\d+(?:\.\d+)*\b/i);
  return match ? match[0] : undefined;
}

function parseWarmup(value: unknown): ActorWarmup {
  const obj = recordValue(value, "warmup");
  const mode = parseActorWarmupMode(typeof obj.mode === "string" ? obj.mode : undefined);
  const daily = isRecord(obj.daily_pages) ? parseDailyPages(obj.daily_pages, "warmup.daily_pages") : undefined;
  const scene = isRecord(obj.scene_rehearsal) ? parseSceneRehearsal(obj.scene_rehearsal) : undefined;
  return {
    mode,
    ...(daily ? { daily_pages: daily } : {}),
    ...(scene ? { scene_rehearsal: scene } : {}),
    notes: stringArray(obj.notes),
    warmed_state: typeof obj.warmed_state === "string"
      ? obj.warmed_state
      : daily?.warmed_state ?? scene?.final_playable_state ?? "",
  };
}

export function parseActorWarmupMode(value: string | undefined): ActorWarmupMode {
  if (value === "none" || value === "daily_pages" || value === "scene_rehearsal") return value;
  return "scene_rehearsal";
}

function parseDailyPages(value: unknown, path = "daily_pages"): ActorDailyPages {
  const obj = recordValue(value, path);
  return {
    page_1_given_circumstances: stringValue(obj.page_1_given_circumstances, `${path}.page_1_given_circumstances`),
    page_2_character_rehearsal: stringValue(obj.page_2_character_rehearsal, `${path}.page_2_character_rehearsal`),
    page_3_false_starts_and_adjustments: stringValue(obj.page_3_false_starts_and_adjustments, `${path}.page_3_false_starts_and_adjustments`),
    left_right_choices: parseLeftRightChoices(obj.left_right_choices),
    what_felt_false: stringArray(obj.what_felt_false),
    warmed_state: stringValue(obj.warmed_state, `${path}.warmed_state`),
  };
}

function parseSceneRehearsal(value: unknown): ActorSceneRehearsal {
  const obj = recordValue(value, "warmup.scene_rehearsal");
  return {
    given_circumstances: stringValue(obj.given_circumstances, "warmup.scene_rehearsal.given_circumstances"),
    reader_scene_partner: stringValue(obj.reader_scene_partner, "warmup.scene_rehearsal.reader_scene_partner"),
    playable_objective: stringValue(obj.playable_objective, "warmup.scene_rehearsal.playable_objective"),
    false_actions_rejected: parseFalseActions(obj.false_actions_rejected),
    rehearsal_passes: parseRehearsalPasses(obj.rehearsal_passes),
    final_playable_state: stringValue(obj.final_playable_state, "warmup.scene_rehearsal.final_playable_state"),
  };
}

function parseFalseActions(value: unknown): ActorSceneRehearsal["false_actions_rejected"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, i) => {
    if (!isRecord(item)) return [];
    return [{
      action: stringValue(item.action, `warmup.scene_rehearsal.false_actions_rejected.${i}.action`),
      reason: stringValue(item.reason, `warmup.scene_rehearsal.false_actions_rejected.${i}.reason`),
    }];
  });
}

function parseRehearsalPasses(value: unknown): ActorSceneRehearsal["rehearsal_passes"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, i) => {
    if (!isRecord(item)) return [];
    return [{
      pass: typeof item.pass === "number" ? item.pass : i + 1,
      action: optionalStringValue(item.action),
      text_or_moment: optionalStringValue(item.text_or_moment),
      self_note: optionalStringValue(item.self_note),
    }];
  });
}

function parseLeftRightChoices(value: unknown): ActorDailyPages["left_right_choices"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, i) => {
    if (!isRecord(item)) return [];
    return [{
      left: stringValue(item.left, `daily_pages.left_right_choices.${i}.left`),
      right: stringValue(item.right, `daily_pages.left_right_choices.${i}.right`),
      decision: stringValue(item.decision, `daily_pages.left_right_choices.${i}.decision`),
    }];
  });
}

function parseBeatPlanArray(value: unknown, channel: Channel): ActorBeatPlan[] {
  if (!Array.isArray(value)) throw new Error(`ActorOutput table_work.channel_beat_plans.${channel} missing or not an array`);
  return value.map((item, i) => {
    const beat = recordValue(item, `beat ${i}`);
    return {
      verb: stringValue(beat.verb, `beat ${i}.verb`),
      working_action: parseWorkingActionName(beat.working_action, `beat ${i}.working_action`),
      physical_score: stringValue(beat.physical_score, `beat ${i}.physical_score`),
      ...(beat.preparation_from !== undefined
        ? { preparation_from: parseWorkingActionName(beat.preparation_from, `beat ${i}.preparation_from`) }
        : {}),
      micro_objective: stringValue(beat.micro_objective, `beat ${i}.micro_objective`),
      obstacle_local: stringValue(beat.obstacle_local, `beat ${i}.obstacle_local`),
      ...(typeof beat.shadow_move === "string" ? { shadow_move: beat.shadow_move } : {}),
    };
  });
}

function parsePerformanceArray(value: unknown, channel: Channel): ActorPerformanceCandidate[] {
  if (!Array.isArray(value)) throw new Error(`ActorOutput performances.${channel} missing or not an array`);
  return value.map((item, i) => {
    const candidate = recordValue(item, `candidate ${i}`);
    const structured = parseStructuredPerformance(candidate, channel, `candidate ${i}`);
    const text = structured
      ? renderStructured(structured)
      : stringValue(candidate.text, `candidate ${i}.text`);
    return {
      text,
      ...(structured ? { structured } : {}),
      rationale: typeof candidate.rationale === "string" ? candidate.rationale : "",
      movement_receipt: parseMovementReceiptArray(candidate.movement_receipt, channel, i),
      deployed_facts_used: stringArray(candidate.deployed_facts_used),
      not_said: parseNotSaid(candidate.not_said),
    };
  });
}

function parseStructuredPerformance(
  candidate: Record<string, unknown>,
  channel: Channel,
  path: string,
): StructuredOutput | undefined {
  if (channel === "x-thread") {
    const tweets = stringArray(candidate.tweets);
    if (tweets.length > 0) return { kind: "thread", tweets };
    const nested = isRecord(candidate.structured) ? stringArray(candidate.structured.tweets) : [];
    if (nested.length > 0) return { kind: "thread", tweets: nested };
    return undefined;
  }
  if (channel === "carousel") {
    const slidesInput = Array.isArray(candidate.slides)
      ? candidate.slides
      : isRecord(candidate.structured) && Array.isArray(candidate.structured.slides)
        ? candidate.structured.slides
        : [];
    if (slidesInput.length === 0) return undefined;
    const slides = slidesInput.map((slide, i) => {
      const row = recordValue(slide, `${path}.slides.${i}`);
      return {
        name: stringValue(row.name, `${path}.slides.${i}.name`),
        body: stringValue(row.body, `${path}.slides.${i}.body`),
      };
    });
    return { kind: "carousel", slides };
  }
  if (channel === "web") {
    const source = isRecord(candidate.web_card)
      ? candidate.web_card
      : isRecord(candidate.structured)
        ? candidate.structured
        : candidate;
    if (
      typeof source.subheading !== "string" &&
      typeof source.title !== "string" &&
      typeof source.caption !== "string"
    ) {
      return undefined;
    }
    return {
      kind: "web-card",
      subheading: stringValue(source.subheading, `${path}.subheading`),
      title: stringValue(source.title, `${path}.title`),
      caption: stringValue(source.caption, `${path}.caption`),
    };
  }
  return undefined;
}

function parseMovementReceiptArray(value: unknown, channel: Channel, candidateIndex: number): ActorMovementReceipt[] {
  if (!Array.isArray(value)) {
    throw new Error(`ActorOutput performances.${channel}.${candidateIndex}.movement_receipt missing or not an array`);
  }
  return value.map((item, i) => {
    const receipt = recordValue(item, `movement_receipt ${i}`);
    return {
      text_span: stringValue(receipt.text_span, `movement_receipt ${i}.text_span`),
      objective_verb: stringValue(receipt.objective_verb, `movement_receipt ${i}.objective_verb`),
      working_action: parseWorkingActionName(receipt.working_action, `movement_receipt ${i}.working_action`),
      evidence: stringValue(receipt.evidence, `movement_receipt ${i}.evidence`),
    };
  });
}

function parseSelectedPerformance(value: unknown, channel: Channel): ActorSelectedPerformance {
  if (!isRecord(value)) {
    return {
      selected_option: 1,
      selection_rationale: `No explicit selected_performances.${channel}; parser fell back to option 1.`,
    };
  }
  const selected = typeof value.selected_option === "number"
    ? value.selected_option
    : typeof value.selected_index === "number"
      ? value.selected_index + 1
      : 1;
  return {
    selected_option: Math.max(1, Math.floor(selected)),
    selection_rationale: typeof value.selection_rationale === "string" ? value.selection_rationale : "",
  };
}

const ALL_CHANNELS: Channel[] = ["x", "x-thread", "web", "in-product", "modal", "blog", "carousel"];

function isChannelName(value: unknown): value is Channel {
  return typeof value === "string" && (ALL_CHANNELS as string[]).includes(value);
}

export function parseFactRequests(value: unknown, channels?: Channel[]): FactRequest[] {
  if (!Array.isArray(value)) return [];
  const out: FactRequest[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const question = item.trim();
      if (question) out.push({ question });
      continue;
    }
    if (!isRecord(item)) continue;
    const question = typeof item.question === "string"
      ? item.question.trim()
      : typeof item.fact === "string"
        ? item.fact.trim()
        : "";
    if (!question) continue;
    const requested = Array.isArray(item.channels)
      ? item.channels.filter(isChannelName)
      : [];
    const scoped = channels ? requested.filter((c) => channels.includes(c)) : requested;
    out.push({
      question,
      ...(typeof item.reason === "string" && item.reason.trim() ? { reason: item.reason.trim() } : {}),
      ...(scoped.length > 0 ? { channels: scoped } : {}),
    });
  }
  return out;
}

function parseNotSaid(value: unknown): NotSaidFact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.fact !== "string") return [];
    return [{ fact: item.fact, reason: typeof item.reason === "string" ? item.reason : "" }];
  });
}

function parseMotionEvidence(value: unknown): MotionEvidence {
  const obj = isRecord(value) ? value : {};
  return {
    pole: typeof obj.pole === "string" ? obj.pole : "unclear",
    evidence: stringArray(obj.evidence),
    source_refs: stringArray(obj.source_refs),
  };
}

function parseWorkingActions(value: unknown): WorkingActionEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      action: typeof item.action === "string" ? item.action : "unknown",
      evidence: typeof item.evidence === "string" ? item.evidence : "",
      source_refs: stringArray(item.source_refs),
    }];
  });
}

function parseTempoBasis(value: unknown): DirectorTempoBasis {
  const obj = isRecord(value) ? value : {};
  return {
    attitude_or_state: typeof obj.attitude_or_state === "string" ? obj.attitude_or_state : "unknown",
    variation_factors: stringArray(obj.variation_factors).slice(0, 2),
    variation_poles: stringArray(obj.variation_poles).slice(0, 2),
    excluded_present_poles: stringArray(obj.excluded_present_poles),
    rival_two_factor_reads_considered: Array.isArray(obj.rival_two_factor_reads_considered)
      ? obj.rival_two_factor_reads_considered.flatMap((item) => {
          if (!isRecord(item)) return [];
          return [{
            tempo: typeof item.tempo === "string" ? item.tempo : "unknown",
            factor_shape: typeof item.factor_shape === "string" ? item.factor_shape : "unknown",
            reason_kept_or_rejected: typeof item.reason_kept_or_rejected === "string"
              ? item.reason_kept_or_rejected
              : "",
          }];
        })
      : [],
  };
}

function parseWorkingActionName(value: unknown, field: string): WorkingAction {
  if (typeof value !== "string" || !isWorkingActionName(value)) {
    throw new Error(`${field} must be one of pressing, wringing, gliding, floating, punching, slashing, dabbing, flicking`);
  }
  return value;
}

function isWorkingActionName(value: string): value is WorkingAction {
  return [
    "pressing",
    "wringing",
    "gliding",
    "floating",
    "punching",
    "slashing",
    "dabbing",
    "flicking",
  ].includes(value);
}

function parseTempoName(value: unknown): TempoName | "unknown" {
  if (typeof value !== "string") return "unknown";
  return isTempoName(value) ? value : "unknown";
}

function isTempoName(value: string): value is TempoName {
  return [
    "commanding", "practical", "self-contained", "receptive",
    "sombre", "overpowering", "diffused", "irradiant",
    "materialistic", "human", "warm", "cool",
    "unacknowledged", "acknowledged", "revealed", "concealed",
    "egocentric", "unsociable", "sociable", "altruistic",
    "acute", "doubting", "certain", "uncertain",
  ].includes(value);
}

function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error(`No JSON object found.\n---\n${text.slice(0, 300)}`);
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function recordValue(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${field} missing or not an object`);
  return value;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} missing or not a string`);
  return value;
}

function optionalStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textFromMessage(resp: { content: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage["content"] }): string {
  const block = resp.content[0];
  return block && block.type === "text" ? block.text : "";
}

function isActorJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  const message = errorMessage(err);
  return message.startsWith("No JSON object found") || message.includes("Unexpected end of JSON input");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function createMessageWithRetry(
  client: AnthropicMessagesClient,
  params: AnthropicCreateParams,
  role: "Actor" | "Director",
): Promise<{
  content: Anthropic.Beta.PromptCaching.PromptCachingBetaMessage["content"];
  usage?: Anthropic.Beta.PromptCaching.PromptCachingBetaUsage;
}> {
  const maxAttempts = Number(process.env.COMMS_ANTHROPIC_RETRY_ATTEMPTS ?? 4);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryableAnthropicError(err)) throw err;
      await sleep(retryDelayMs(attempt));
    }
  }
  throw lastError;
}

function isRetryableAnthropicError(err: unknown): boolean {
  if (!isRecord(err)) return false;
  const status = typeof err.status === "number"
    ? err.status
    : typeof err.statusCode === "number"
      ? err.statusCode
      : undefined;
  const body = isRecord(err.error) ? err.error : {};
  const type = typeof body.type === "string"
    ? body.type
    : typeof err.type === "string"
      ? err.type
      : "";
  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return status === 429 || status === 529 || Boolean(status && status >= 500) ||
    type === "overloaded_error" || message.includes("overloaded");
}

function retryDelayMs(attempt: number): number {
  const base = 1500 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertLiveActorDirectorMode(
  role: "Actor" | "Director",
  mode: "live" | "stub" | "auto" | undefined,
  client: AnthropicMessagesClient | undefined,
): void {
  if (mode === "stub") {
    throw new Error(`${role} stub mode has been removed from the actor/director pipeline. Use live mode with an injected mock client in tests.`);
  }
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(`${role} requires ANTHROPIC_API_KEY or an injected Anthropic client. The actor/director pipeline does not silently fall back to stub output.`);
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function softenShortCopyConfidence(confidence: number, text: string | undefined): number {
  if (!text) return confidence;
  const normalized = text.trim();
  if (!normalized) return confidence;
  const words = normalized.split(/\s+/).filter(Boolean).length;
  const oneLine = !normalized.includes("\n");
  if (oneLine && words <= 20) return Math.min(confidence, 0.65);
  if (oneLine && normalized.length <= 140) return Math.min(confidence, 0.75);
  return confidence;
}
