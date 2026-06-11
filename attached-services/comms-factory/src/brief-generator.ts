import Anthropic from "@anthropic-ai/sdk";
import { deployedFactClaims, type ReleaseCard } from "./card.js";
import {
  BRAND_BACKGROUND_STUB,
  CROP_HINT,
  CROP_SPECS,
  SCENE_MAX_CHARS,
  STANDING_BRIEF_KINDS,
  WHERE_MAX_CHARS,
  type ImageBrief,
  type ImageBriefKind,
  type OnImageText,
} from "./brief.js";
import { validate } from "./validator.js";

type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];

export interface ImageBriefMessagesClient {
  messages: {
    create: (params: AnthropicCreateParams) => Promise<{ content: Anthropic.Message["content"] }>;
  };
}

export interface GenerateImageBriefOptions {
  mode?: "live" | "stub" | "auto";
  model?: string;
  client?: ImageBriefMessagesClient;
}

export interface ImageBriefStructured {
  kind: "image-brief";
  briefs: ImageBrief[];
}

export interface ImageBriefGenerationResult {
  text: string;
  structured: ImageBriefStructured;
  source: "stub" | "anthropic";
  raw_response?: string;
}

const DEFAULT_IMAGE_BRIEF_MODEL = process.env.COMMS_IMAGE_BRIEF_MODEL ?? process.env.COMMS_ACTOR_MODEL ?? "claude-opus-4-7";

export async function generateImageBrief(
  card: ReleaseCard,
  opts: GenerateImageBriefOptions = {},
): Promise<ImageBriefGenerationResult> {
  const mode = resolveMode(opts);
  if (mode === "stub") {
    const briefs = buildStubBriefs(card);
    return {
      text: renderImageBrief(card, briefs),
      structured: { kind: "image-brief", briefs },
      source: "stub",
    };
  }

  assertLiveImageBriefMode(opts.client);
  const client = opts.client ?? (new Anthropic() as unknown as ImageBriefMessagesClient);
  const system = buildSystemPrompt();
  const user = buildUserPrompt(card);
  const resp = await createMessageWithRetry(client, {
    model: opts.model ?? DEFAULT_IMAGE_BRIEF_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const raw = textFromMessage(resp);
  const briefs = parseImageBriefResponse(raw);
  return {
    text: renderImageBrief(card, briefs),
    structured: { kind: "image-brief", briefs },
    source: "anthropic",
    raw_response: raw,
  };
}

function resolveMode(opts: GenerateImageBriefOptions): "live" | "stub" {
  if (opts.mode === "live") return "live";
  if (opts.mode === "stub") return "stub";
  if (opts.client || process.env.ANTHROPIC_API_KEY) return "live";
  return "stub";
}

function assertLiveImageBriefMode(client: ImageBriefMessagesClient | undefined): void {
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Image brief generation requires ANTHROPIC_API_KEY or an injected Anthropic client.");
  }
}

function buildSystemPrompt(): string {
  return [
    "You generate designer-facing image briefs for Infinex release packages.",
    "This is art direction, not public copy. Do not write tweets, blog prose, CTAs, or marketing claims.",
    "Ground every scene in the supplied deployed facts, product name, and feature states. Do not invent shipped facts.",
    "BE TERSE. A designer skims this. Each `scene` is at most TWO sentences and must read like a quick image direction, not a spec. No preamble, no restating the facts verbatim.",
    "Return JSON only.",
  ].join("\n");
}

function buildUserPrompt(card: ReleaseCard): string {
  return [
    `Generate ONE image-brief surface covering exactly these three kinds: ${STANDING_BRIEF_KINDS.join(", ")}.`,
    "",
    "For each kind:",
    `- scene: the image in AT MOST 2 sentences (≤${SCENE_MAX_CHARS} chars). Concrete + visual.`,
    "- subject: the shipped thing depicted (a few words).",
    "- where: a short pointer to where this lives in the app (route/screen), or null. Keep it under one line.",
    "- on_image_line: a short overlay line, or null (most product shots have none).",
    "Do NOT include background guidance or long reference notes — keep it tight.",
    "",
    "Output shape (JSON only):",
    JSON.stringify({
      briefs: STANDING_BRIEF_KINDS.map((kind) => ({ kind, scene: "...", subject: "...", where: null, on_image_line: null })),
    }),
    "",
    "Grounding:",
    JSON.stringify({
      title: card.title,
      outward_product_name: card.outward_product_name ?? null,
      feature_states: card.feature_states ?? [],
      deployed_facts: deployedFactClaims(card),
    }, null, 2),
  ].join("\n");
}

function parseImageBriefResponse(raw: string): ImageBrief[] {
  const parsed = extractJsonObject(raw);
  const rows = Array.isArray(parsed.briefs) ? parsed.briefs : [];
  const byKind = new Map<ImageBriefKind, ImageBrief>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (!isBriefKind(record.kind)) continue;
    const scene = clamp(stringValue(record.scene), SCENE_MAX_CHARS);
    const subject = stringValue(record.subject);
    const where = clamp(stringValue(record.where), WHERE_MAX_CHARS);
    if (!scene || !subject) continue;
    const onImageText = validateOnImageLine(typeof record.on_image_line === "string" ? record.on_image_line : null);
    byKind.set(record.kind, {
      kind: record.kind,
      scene,
      subject,
      ...(where ? { where } : {}),
      background: BRAND_BACKGROUND_STUB,
      on_image_text: onImageText,
      crop_specs: CROP_SPECS[record.kind],
    });
  }

  const missing = STANDING_BRIEF_KINDS.filter((kind) => !byKind.has(kind));
  if (missing.length > 0) {
    throw new Error(`Image brief response missing standing kind(s): ${missing.join(", ")}`);
  }
  return STANDING_BRIEF_KINDS.map((kind) => byKind.get(kind)!);
}

function buildStubBriefs(card: ReleaseCard): ImageBrief[] {
  const product = card.outward_product_name?.trim() || card.title.trim();
  const route = findRoute(card);

  const sceneByKind: Record<ImageBriefKind, string> = {
    hero: clamp(`${product} as the launch cover on an Infinex background. Show the product moment, not abstract decoration.`, SCENE_MAX_CHARS),
    "in-app-mobile": clamp(`${product} running in the Infinex mobile app — a real screen, product-proof. Phone framed on an Infinex background.`, SCENE_MAX_CHARS),
    "feature-detail": clamp(`Tight crop on the ${product} UI that shipped: the actual control, number, or screen.`, SCENE_MAX_CHARS),
  };

  return STANDING_BRIEF_KINDS.map((kind) => ({
    kind,
    scene: sceneByKind[kind],
    subject: product,
    ...(route && kind !== "hero" ? { where: clamp(route, WHERE_MAX_CHARS) } : {}),
    background: BRAND_BACKGROUND_STUB,
    on_image_text: validateOnImageLine(kind === "hero" ? product : null),
    crop_specs: CROP_SPECS[kind],
  }));
}

/** First app route/URL in the deployed facts, for a "where to find it" pointer. */
function findRoute(card: ReleaseCard): string | null {
  for (const fact of deployedFactClaims(card)) {
    const m = fact.match(/https?:\/\/\S+|\/[a-z0-9/_<>-]+\/[a-z0-9/_<>-]+/i);
    if (m) return m[0].replace(/[.,)]+$/, "");
  }
  return null;
}

function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  // Trim to the last sentence end within budget, else the last word boundary.
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function validateOnImageLine(line: string | null): OnImageText {
  const candidate = line?.trim() ?? "";
  if (!candidate) return { line: null, validated: null, failures: [] };
  const result = validate(candidate);
  if (result.passed) return { line: candidate, validated: true, failures: [] };
  return {
    line: null,
    validated: false,
    failures: result.failures.map((f) => `${f.rule}: ${f.reason}`),
  };
}

const KIND_HEADING: Record<ImageBriefKind, string> = {
  hero: "HERO / COVER",
  "in-app-mobile": "IN-APP MOBILE",
  "feature-detail": "FEATURE DETAIL",
};

/** Designer-facing surface text. Tweet-length per image: a crop hint, the
 *  ≤2-sentence scene, the on-image line, and (optionally) where to find it. */
export function renderImageBrief(card: ReleaseCard, briefs: ImageBrief[]): string {
  const product = card.outward_product_name?.trim() || card.title.trim();
  const parts: string[] = [`Image brief — commission 3: ${product}`];
  for (const brief of briefs) {
    const onImage = brief.on_image_text.line ? `On image: “${brief.on_image_text.line}”` : "On image: none";
    parts.push(
      "",
      `${KIND_HEADING[brief.kind]} · ${CROP_HINT[brief.kind]}`,
      brief.scene,
      onImage,
      ...(brief.where ? [`Find it: ${brief.where}`] : []),
    );
  }
  parts.push("", "Background: Infinex-branded (brand spec pending).");
  return parts.join("\n");
}

function isBriefKind(value: unknown): value is ImageBriefKind {
  return typeof value === "string" && (STANDING_BRIEF_KINDS as string[]).includes(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in image brief response.\n---\n${text.slice(0, 300)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function textFromMessage(resp: { content: Anthropic.Message["content"] }): string {
  const block = resp.content[0];
  return block && block.type === "text" ? block.text : "";
}

async function createMessageWithRetry(
  client: ImageBriefMessagesClient,
  params: AnthropicCreateParams,
): Promise<{ content: Anthropic.Message["content"] }> {
  const maxAttempts = Number(process.env.COMMS_ANTHROPIC_RETRY_ATTEMPTS ?? 4);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryableAnthropicError(err)) throw err;
      await sleep(1500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500));
    }
  }
  throw lastError;
}

function isRetryableAnthropicError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  const status = typeof record.status === "number"
    ? record.status
    : typeof record.statusCode === "number"
      ? record.statusCode
      : undefined;
  const type = typeof record.type === "string" ? record.type : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return status === 429 || status === 529 || Boolean(status && status >= 500) ||
    type === "overloaded_error" || message.includes("overloaded");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
