/**
 * Caption validator. Brand-agnostic slop heuristics + Mirodan-grounded
 * voice-fit checks.
 *
 * Two layers:
 *   1. Regex-grade slop/allergen rules (cliches, listicle, antagonism, AI-slop,
 *      Kain baggage, claimed palettes, time-pressure / off-spec Drive language,
 *      plus deterministic numeric/URL claim tripwires)
 *   2. Beat-sequence audit (per declared beat: tempo-fit + preparation hierarchy)
 *
 * Layer 1 is deterministic hygiene — fast, cheap, reliable. It is not the
 * semantic fact judge. Strict receipt/fact matching remains callable for eval
 * diagnostics, but production validation must not force prose to enumerate
 * every release-card fact just to satisfy token-overlap checks.
 * Layer 2 does mechanical checks (preparation hierarchy via motor lookup,
 * off-spec regex per Drive) plus independent beat classification. The beat
 * classifier never reads the declared beat while scoring; it compares the
 * winning tempo against the declaration after classification.
 *
 * Each rule is exported individually for targeted tests + per-rule visibility.
 */

import { INFINEX_VOICE } from "./voice/infinex.js";
import {
  auditBeatsLLM as auditBeatsLLMInternal,
  auditTextLLM,
} from "./validator-llm.js";
import { checkPrepHierarchy, isQuick, isSustained } from "./voice/laban.js";
import { deployedFactClaims, type ReleaseCard } from "./card.js";
import type { Channel, StructuredOutput } from "./generator.js";
import type {
  LLMBeatAuditResult,
  LLMVoiceAuditOptions,
  LLMVoiceAuditVerdict,
} from "./validator-llm.js";
import type {
  BeatAuditResult,
  BeatSequence,
  CharacterSpec,
  PrepHierarchyFailure,
  QuickAction,
  SustainedAction,
  TempoName,
  WorkingAction,
} from "./voice/types.js";

export interface RuleFailure {
  rule: string;
  reason: string;
}

export interface RuleResult {
  passed: boolean;
  reason?: string;
}

export interface ValidationResult {
  passed: boolean;
  failures: RuleFailure[];
  beat_audit?: BeatAuditResult[];
  prep_hierarchy_failures?: PrepHierarchyFailure[];
}

export interface NotSaidFact {
  fact: string;
  reason: string;
}

export interface BlindTempoClassification {
  tempo: TempoName | "unknown";
  confidence: number;
  margin: number;
  scores: Partial<Record<TempoName, number>>;
}

// -- LAYER 1: regex-grade slop/allergen rules ---------------------------------

const CLICHE_RE =
  /\b(game[\s-]?changer|game[\s-]?changing|unlock(?:s|ing|ed)?|paradigm|in the world of|the future of|next[\s-]?gen|seamless|seamlessly|empower(?:s|ing|ed|ment)?|leverage(?!\s+ratio)|leverages|leveraging|leveraged(?!\s+(?:position|long|short|trade)))\b/i;

export function rejectCliches(s: string): RuleResult {
  const m = s.match(CLICHE_RE);
  if (m) return { passed: false, reason: `cliché "${m[0]}"` };
  return { passed: true };
}

const LISTICLE_RES: RegExp[] = [
  /^\s*\d+\s+reasons?\b/i,
  /^\s*why\s+.+\s+matters?\b/i,
  /^\s*the\s+only\s+.+\s+you['’]?ll\s+ever\s+need\b/i,
  /^\s*top\s+\d+\s+/i,
  /^\s*\d+\s+things?\s+(?:you|to)\b/i,
];

export function rejectListicleVoice(s: string): RuleResult {
  for (const re of LISTICLE_RES) {
    const m = s.match(re);
    if (m) return { passed: false, reason: `listicle voice "${m[0].trim()}"` };
  }
  return { passed: true };
}

const ANTAGONISM_RES: RegExp[] = [
  /\b(coinbase|binance|kraken|bybit|okx|kucoin)\b[^.]{0,40}\b(slow|bad|broken|crooked|trash|garbage|cex|centralized)\b/i,
  /\b(slow|bad|broken|crooked|trash|garbage)\b[^.]{0,40}\b(coinbase|binance|kraken|bybit|okx|kucoin)\b/i,
  /\bunlike\s+(?:coinbase|binance|kraken|bybit|okx|kucoin)\b/i,
  /\b(?:metamask|phantom|rainbow|rabby)\b[^.]{0,40}\b(slow|bad|broken|clunky|scam)\b/i,
];

export function rejectAntagonism(s: string): RuleResult {
  for (const re of ANTAGONISM_RES) {
    const m = s.match(re);
    if (m) return { passed: false, reason: `antagonism toward competitor: "${m[0]}"` };
  }
  return { passed: true };
}

const AI_SLOP_VAGUE_NOUNS_RE =
  /\b(innovative|cutting[\s-]?edge|revolutionary|transformative|users\s+(?:will|can)\s+(?:appreciate|benefit|enjoy)|exciting(?:\s+(?:news|update|announcement))?|thrilled\s+to|delighted\s+to|stay\s+tuned)\b/i;

const EM_DASH_RE = /—/g;
const EM_DASH_CHAR_WINDOW = 280;
const EM_DASH_MAX_PER_WINDOW = 0; // Zero-tolerance per operator 2026-05-25. Em-dashes are AI-slop signature.

export function rejectAIslop(s: string): RuleResult {
  const m = s.match(AI_SLOP_VAGUE_NOUNS_RE);
  if (m) return { passed: false, reason: `AI-slop vague noun "${m[0]}"` };
  const emCount = (s.match(EM_DASH_RE) ?? []).length;
  if (emCount > 0) {
    const windows = Math.max(1, Math.ceil(s.length / EM_DASH_CHAR_WINDOW));
    const perWindow = emCount / windows;
    if (perWindow > EM_DASH_MAX_PER_WINDOW) {
      return {
        passed: false,
        reason: `em-dash density ${emCount} in ${s.length} chars (> ${EM_DASH_MAX_PER_WINDOW}/${EM_DASH_CHAR_WINDOW})`,
      };
    }
  }
  return { passed: true };
}

const KAIN_BAGGAGE_RES: RegExp[] = [
  /\b(degen\s+army|synthetic\s+everything|the\s+spartan\s+council)\b/i,
];

export function rejectKainBaggage(s: string): RuleResult {
  for (const re of KAIN_BAGGAGE_RES) {
    const m = s.match(re);
    if (m) return { passed: false, reason: `Kain-era baggage "${m[0]}"` };
  }
  return { passed: true };
}

const CLAIMED_PALETTE_RE = /#(?:2E5CFF|1BE3C2|AB9FF2|6E54FF|97FCE4|F5B82E)\b/i;

export function rejectClaimedPalettes(s: string): RuleResult {
  const m = s.match(CLAIMED_PALETTE_RE);
  if (m) {
    return {
      passed: false,
      reason: `mentions claimed competitor palette "${m[0]}" — see visual-vocabulary.md §06`,
    };
  }
  return { passed: true };
}

// Visual-design slop genus. Catches the 2024-era AI-design vocabulary that
// impeccable.style flagged as slop: morphism trend bingo, purple gradients,
// hype-driven, futuristic-UI. We reject these in copy because they signal a
// visual register that fights the Spell-Vision drive (Stable + Flow + Penetrating).
const VISUAL_SLOP_RE =
  /\b(?:glass|neu|clay)morphism\b|\b(?:holographic|iridescent)\s+gradient\b|\bpurple\s+gradient\b|\bhype[\s-]?driven\b|\bfuturistic\s+(?:ui|visuals?|design|interface)\b|\bvaporwave\b/i;

export function rejectVisualSlop(s: string): RuleResult {
  const m = s.match(VISUAL_SLOP_RE);
  if (m) return { passed: false, reason: `visual-design slop "${m[0]}"` };
  return { passed: true };
}

// -- Off-spec Drive language (from CharacterSpec.off_spec_regexes) -----------
// For Infinex this rejects time-pressure vocabulary when it foregrounds
// Passion as the visible projection. Passion still exists as hidden lining.

export function rejectOffSpecDrive(s: string, voice: CharacterSpec = INFINEX_VOICE): RuleResult {
  for (const r of voice.off_spec_regexes) {
    const m = s.match(r.re);
    if (m) return { passed: false, reason: `${r.name}: "${m[0]}" — ${r.reason}` };
  }
  return { passed: true };
}

// -- Blog changelog format gate ---------------------------------------------

export interface ChangelogFormatOptions {
  channel?: Channel;
  card?: ReleaseCard;
}

type ReleaseCardWithCategory = ReleaseCard & { category?: unknown };

function isChangelogProductUpdateCard(card: ReleaseCard): boolean {
  const category = (card as ReleaseCardWithCategory).category;
  if (typeof category === "string") {
    return category === "changelog" || category === "changelogs";
  }
  return card.kind === "data-card-official" ||
    card.kind === "data-card-wry" ||
    card.kind === "launch-tier" ||
    card.kind === "split";
}

export function auditChangelogFormat(text: string, opts: ChangelogFormatOptions): RuleFailure[] {
  if (opts.channel !== "blog" || !opts.card || !isChangelogProductUpdateCard(opts.card)) return [];

  const failures: RuleFailure[] = [];
  const frontmatter = splitYamlFrontmatter(text);

  if (!frontmatter.yaml) {
    failures.push({
      rule: "changelog-format",
      reason: "missing YAML frontmatter block",
    });
  } else {
    for (const field of ["title", "date", "coverImage"]) {
      if (!hasFrontmatterField(frontmatter.yaml, field)) {
        failures.push({
          rule: "changelog-format",
          reason: `frontmatter missing required field: ${field}`,
        });
      }
    }

    const category = frontmatterScalar(frontmatter.yaml, "category");
    if (category !== "changelogs") {
      failures.push({
        rule: "changelog-format",
        reason: "frontmatter category must be changelogs",
      });
    }
  }

  auditChangelogBodyOpening(frontmatter.body, failures);
  auditChangelogComingUp(frontmatter.body, failures);

  const toggleFailure = auditToggleBalance(text);
  if (toggleFailure) failures.push(toggleFailure);

  return failures;
}

function splitYamlFrontmatter(text: string): { yaml?: string; body: string } {
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match || match.index !== 0) return { body: text };
  return {
    yaml: match[1] ?? "",
    body: text.slice(match[0].length),
  };
}

function hasFrontmatterField(yaml: string, field: string): boolean {
  return new RegExp(`^${escapeRegExp(field)}\\s*:`, "mi").test(yaml);
}

function frontmatterScalar(yaml: string, field: string): string | undefined {
  const match = yaml.match(new RegExp(`^${escapeRegExp(field)}\\s*:\\s*([^#\\r\\n]+)`, "mi"));
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  return raw.replace(/^["']|["']$/g, "");
}

function auditChangelogBodyOpening(body: string, failures: RuleFailure[]): void {
  const lines = body.replace(/^\s+/, "").split(/\r?\n/);
  const firstIndex = lines.findIndex((line) => line.trim().length > 0);
  const first = firstIndex >= 0 ? lines[firstIndex]?.trim() : undefined;
  if (!first || !/^###\s+\S/.test(first)) {
    failures.push({
      rule: "changelog-format",
      reason: "body must open with a ### heading",
    });
    return;
  }

  const next = lines.slice(firstIndex + 1).find((line) => line.trim().length > 0)?.trim();
  if (!next || !/^\{%\s*cloud-image\b/i.test(next)) {
    failures.push({
      rule: "changelog-format",
      reason: "body opening heading must be followed by a cloud-image tag",
    });
  }
}

function auditChangelogComingUp(body: string, failures: RuleFailure[]): void {
  const headingRe = /^###\s+Coming up\s*$/gim;
  const heading = headingRe.exec(body);
  if (!heading) {
    failures.push({
      rule: "changelog-format",
      reason: "missing ### Coming up section",
    });
    return;
  }

  const comingSection = body.slice(heading.index);
  if (!ROADMAP_LINK_RE.test(comingSection)) {
    failures.push({
      rule: "changelog-format",
      reason: "Coming up section must include a roadmap link",
    });
  }
}

const ROADMAP_LINK_RE = /\[[^\]]*roadmap[^\]]*\]\([^)]*roadmap[^)]*\)|https?:\/\/[^\s)]+roadmap[^\s)]*/i;

function auditToggleBalance(text: string): RuleFailure | undefined {
  const tagRe = /\{%\s*(\/?)toggle\b[^%]*%\}/gi;
  let depth = 0;
  let opens = 0;
  let closes = 0;
  let unpairedClose = false;
  for (const match of text.matchAll(tagRe)) {
    if (match[1] === "/") {
      closes += 1;
      if (depth === 0) {
        unpairedClose = true;
      } else {
        depth -= 1;
      }
    } else {
      opens += 1;
      depth += 1;
    }
  }
  if (!unpairedClose && depth === 0) return undefined;
  return {
    rule: "changelog-format",
    reason: `Markdoc toggle tags are unbalanced (${opens} opening, ${closes} closing)`,
  };
}

function claimAuditText(text: string, opts: { channel?: Channel; card?: ReleaseCard }): string {
  if (opts.channel !== "blog" || !opts.card || !isChangelogProductUpdateCard(opts.card)) return text;
  const frontmatter = splitYamlFrontmatter(text);
  return frontmatter.body
    .replace(/\{%\s*cloud-image\b[^%]*%\}/gi, " ")
    .replace(/\{%\s*toggle\b([^%]*)%\}/gi, (_tag, attrs: string) => ` ${toggleTitle(attrs)} `)
    .replace(/\{%\s*\/toggle\s*%\}/gi, " ")
    .replace(/\[([^\]]*roadmap[^\]]*)\]\([^)]*roadmap[^)]*\)/gi, "$1");
}

function toggleTitle(attrs: string): string {
  const match = attrs.match(/\btitle=(?:"([^"]*)"|'([^']*)')/i);
  return match?.[1] ?? match?.[2] ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -- Claim contract (from release-card deployed_facts) -----------------------

export interface ClaimContractOptions {
  card: ReleaseCard;
  deployed_facts_used?: string[];
  not_said?: NotSaidFact[];
}

export type FactContractMode = "tripwire" | "strict" | "off";

export function auditClaimContract(text: string, opts: ClaimContractOptions): RuleFailure[] {
  const failures: RuleFailure[] = [];
  const deployedFacts = new Set(opts.card.deployed_facts);
  const usedReceipt = opts.deployed_facts_used;
  const notSaidReceipt = opts.not_said;

  const missingUsedReceipt = !Array.isArray(usedReceipt);
  const missingNotSaidReceipt = !Array.isArray(notSaidReceipt);
  if (missingUsedReceipt) {
    failures.push({
      rule: "fact-contract",
      reason: "candidate omitted deployed_facts_used receipt",
    });
  }
  if (missingNotSaidReceipt) {
    failures.push({
      rule: "fact-contract",
      reason: "candidate omitted not_said receipt",
    });
  }
  if (missingUsedReceipt || missingNotSaidReceipt) return failures;

  const used = usedReceipt;
  const notSaid = notSaidReceipt;
  const notSaidFacts = new Set(notSaid.map((item) => item.fact));

  for (const fact of used) {
    if (!deployedFacts.has(fact)) {
      failures.push({
        rule: "fact-contract",
        reason: `deployed_facts_used contains non-card fact: "${fact}"`,
      });
      continue;
    }
    if (!factAppearsInText(text, fact)) {
      failures.push({
        rule: "fact-contract",
        reason: `declared deployed fact does not appear plausibly in text: "${fact}"`,
      });
    }
    if (notSaidFacts.has(fact)) {
      failures.push({
        rule: "fact-contract",
        reason: `fact appears in both deployed_facts_used and not_said: "${fact}"`,
      });
    }
  }

  for (const item of notSaid) {
    if (!deployedFacts.has(item.fact)) {
      failures.push({
        rule: "fact-contract",
        reason: `not_said contains non-card fact: "${item.fact}"`,
      });
    }
    if (!item.reason.trim()) {
      failures.push({
        rule: "fact-contract",
        reason: `not_said entry missing reason for fact: "${item.fact}"`,
      });
    }
  }

  for (const fact of deployedFactClaims(opts.card)) {
    if (!used.includes(fact) && !notSaidFacts.has(fact)) {
      failures.push({
        rule: "fact-contract",
        reason: `card fact is neither deployed nor accounted for in not_said: "${fact}"`,
      });
    }
  }

  failures.push(...auditUnsupportedClaims(text, opts.card));

  return failures;
}

export function auditClaimTripwires(text: string, card: ReleaseCard): RuleFailure[] {
  const failures: RuleFailure[] = [];
  const factText = deployedFactClaims(card).join("\n");

  for (const url of extractUrls(text)) {
    const allowedInFacts = factText.includes(url);
    const allowedProductUrl = card.product_page_url === url;
    if (!allowedInFacts && !allowedProductUrl) {
      failures.push({
        rule: "unsupported-claim",
        reason: `URL is not in deployed_facts or product_page_url: "${url}"`,
      });
    }
  }

  for (const token of extractClaimNumbers(text)) {
    if (!factText.includes(token)) {
      failures.push({
        rule: "unsupported-claim",
        reason: `numeric claim is not in deployed_facts: "${token}"`,
      });
    }
  }

  return dedupeFailures(failures);
}

export function auditUnsupportedClaims(text: string, card: ReleaseCard): RuleFailure[] {
  const failures: RuleFailure[] = [];
  const factText = deployedFactClaims(card).join("\n");

  for (const url of extractUrls(text)) {
    const allowedInFacts = factText.includes(url);
    const allowedProductUrl = card.product_page_url === url;
    if (!allowedInFacts && !allowedProductUrl) {
      failures.push({
        rule: "unsupported-claim",
        reason: `URL is not in deployed_facts or product_page_url: "${url}"`,
      });
    }
  }

  for (const token of extractClaimNumbers(text)) {
    if (!factText.includes(token)) {
      failures.push({
        rule: "unsupported-claim",
        reason: `numeric claim is not in deployed_facts: "${token}"`,
      });
    }
  }

  for (const claim of extractReadinessClaims(text)) {
    if (!normalizeForFactMatch(factText).includes(normalizeForFactMatch(claim))) {
      failures.push({
        rule: "unsupported-claim",
        reason: `readiness claim is not in deployed_facts: "${claim}"`,
      });
    }
  }

  for (const sentence of extractAssertiveClaimSentences(text)) {
    if (!isClaimSupportedByFacts(sentence, deployedFactClaims(card))) {
      failures.push({
        rule: "unsupported-claim",
        reason: `assertive claim is not supported by deployed_facts: "${sentence}"`,
      });
    }
  }

  return dedupeFailures(failures);
}

function extractUrls(text: string): string[] {
  return text.match(/\bhttps?:\/\/[^\s)]+/gi) ?? [];
}

// Structural list/carousel ordinals are not factual claims. renderStructured()
// prefixes carousel slides with "${i + 1}. " at line-start; strip only that
// deterministic prefix before scanning for real numeric claims in the copy body.
const LIST_ORDINAL_PREFIX_RE = /^[ \t]*\d{1,2}\.(?=[ \t])/gm;

function extractClaimNumbers(text: string): string[] {
  return text.replace(LIST_ORDINAL_PREFIX_RE, "").match(/\b(?:\$?\d[\d,.]*(?:\.\d+)?%?|\d+x|\d+\+)\b/gi) ?? [];
}

const READINESS_CLAIM_RE =
  /\bready\s+to\s+(?:trade|use|swap|bridge|deposit|withdraw|claim|ship|go)\b/gi;

function extractReadinessClaims(text: string): string[] {
  return text.match(READINESS_CLAIM_RE) ?? [];
}

const ASSERTIVE_CLAIM_RE =
  /\b(?:now\s+live|is\s+live|are\s+live|goes?\s+live|ships?|shipped|launch(?:es|ed)?|integrat(?:es|ed|ion)|support(?:s|ed|ing)?|available|ready\s+to\s+(?:trade|use|swap|bridge|deposit|withdraw|claim|ship|go)|settles?|reduces?|requires?|no\s+new\s+wallet|required|two\s+clicks?|markets?|account|passkey|first|only|fastest|largest|native)\b/i;

function extractAssertiveClaimSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .filter((sentence) => ASSERTIVE_CLAIM_RE.test(sentence) || extractClaimNumbers(sentence).length > 0);
}

function isClaimSupportedByFacts(sentence: string, facts: string[]): boolean {
  return facts.some((fact) => factAppearsInText(sentence, fact) || factAppearsInText(fact, sentence));
}

function dedupeFailures(failures: RuleFailure[]): RuleFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.rule}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function factAppearsInText(text: string, fact: string): boolean {
  const normalizedText = normalizeForFactMatch(text);
  const normalizedFact = normalizeForFactMatch(fact);
  if (!normalizedFact) return true;
  if (normalizedText.includes(normalizedFact)) return true;

  const factTokens = meaningfulTokens(fact);
  if (factTokens.length < 3) return normalizedText.includes(normalizedFact);
  const textTokens = new Set(meaningfulTokens(text));
  const hits = factTokens.filter((token) => textTokens.has(token)).length;
  return hits / factTokens.length >= 0.55;
}

function normalizeForFactMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9+.%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "is",
  "it",
  "no",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function meaningfulTokens(s: string): string[] {
  return normalizeForFactMatch(s)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

// -- LAYER 2: beat-sequence audit + preparation hierarchy --------------------

/**
 * Naive paragraph-splitter — beats are paragraph-delimited by default.
 * Generator outputs use blank lines between beats.
 */
function splitIntoBeats(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Check preparation hierarchy across a beat sequence.
 *
 * Pulls the motor pair for each declared beat and runs
 * `checkPrepHierarchy` (Mirodan §1.7). Returns the indices of canonical
 * Sustained→Quick beats whose Quick action lacks its required Sustained prep.
 */
export function auditPrepHierarchy(
  beats: BeatSequence,
  voice: CharacterSpec = INFINEX_VOICE,
): PrepHierarchyFailure[] {
  // Build motor sequence — only canonical Sustained→Quick tempi contribute.
  // Both-Sustained tempi (Human, Warm, Acknowledged, Concealed, Doubting,
  // Certain) fire no Quick action — nothing to prep.
  // Both-Quick tempi (Materialistic, Cool, Acute, Uncertain, Unacknowledged,
  // Revealed) handle prep INTERNALLY in the character's inner state per
  // Mirodan §1.7 — the prep is invisible, not a beat-sequence concern.
  // Only Sus→Q tempi (Commanding, Practical, etc) carry the visible prep→release
  // arc that this audit enforces.
  const motors: WorkingAction[] = [];
  const motor_to_beat_index: number[] = [];
  beats.beats.forEach((b, i) => {
    if (!b.tempo) return; // no declared tempo (two-call path) → no prep-hierarchy concept
    const t = voice.tempi[b.tempo];
    if (!t) return;
    if (!isSustained(t.motor[0]) || !isQuick(t.motor[1])) return;
    motors.push(t.motor[0]); // sustained prep
    motor_to_beat_index.push(i);
    motors.push(t.motor[1]); // quick release
    motor_to_beat_index.push(i);
  });

  const failingMotorIndices = checkPrepHierarchy(motors);
  const failures: PrepHierarchyFailure[] = [];
  for (const motorIdx of failingMotorIndices) {
    const beatIdx = motor_to_beat_index[motorIdx] ?? -1;
    const motor = motors[motorIdx];
    if (!motor) continue;
    failures.push({
      beat_index: beatIdx,
      quick_action: motor as QuickAction,
      required_prep: prepFor(motor as QuickAction),
      found_prep: null,
    });
  }
  return failures;
}

function prepFor(q: QuickAction): SustainedAction {
  return ({ punching: "pressing", slashing: "wringing", dabbing: "gliding", flicking: "floating" } as const)[q];
}

/**
 * Blind-classify a paragraph by comparing it against every available tempo in
 * the selected voice. The declared beat is intentionally not an input.
 *
 * This is deterministic, not an LLM judge. It is weaker than Nigel's Sonnet
 * Track 5b classifier, but it has the same separation: generated intent is
 * checked by an independent classifier, not by the generator's rationale.
 */
export function classifyTempoBlind(
  paragraph: string,
  voice: CharacterSpec = INFINEX_VOICE,
): BlindTempoClassification {
  const normalized = normalizeForTempoMatch(paragraph);
  const textTokens = new Set(meaningfulTokens(paragraph));
  const scores: Partial<Record<TempoName, number>> = {};

  // Score only against main_tempi. Reserve / beat-only tempi are explicitly
  // out-of-rotation for primary classification — operator decision 2026-05-15.
  // A standalone paragraph that reads as a reserve tempo classifies as `unknown`.
  const mainTempoSet = new Set<TempoName>(voice.main_tempi);
  for (const [tempoName, tempo] of Object.entries(voice.tempi) as Array<[TempoName, NonNullable<CharacterSpec["tempi"][TempoName]>]>) {
    if (!tempo) continue;
    if (!mainTempoSet.has(tempoName)) continue;
    let score = 0;

    for (const anchor of tempo.vocab_anchor ?? []) {
      const normalizedAnchor = normalizeForTempoMatch(anchor);
      if (!normalizedAnchor) continue;
      if (normalized.includes(normalizedAnchor)) {
        score += anchor.includes(" ") ? 5 : 3;
        continue;
      }
      const anchorTokens = meaningfulTokens(anchor);
      const hits = anchorTokens.filter((token) => textTokens.has(token)).length;
      if (anchorTokens.length > 0) score += (hits / anchorTokens.length) * 1.5;
    }

    for (const shape of tempo.opening_shapes ?? []) {
      const normalizedShape = normalizeForTempoMatch(shape);
      if (normalizedShape && normalized.includes(normalizedShape)) score += 2;
    }

    for (const move of tempo.signoff_moves ?? []) {
      const normalizedMove = normalizeForTempoMatch(move);
      if (normalizedMove && normalized.includes(normalizedMove)) score += 2;
    }

    for (const motor of tempo.motor) {
      if (textTokens.has(motor)) score += 1.25;
    }

    const exampleTokens = new Set((tempo.example_lines ?? []).flatMap((line) => meaningfulTokens(line)));
    const overlap = Array.from(exampleTokens).filter((token) => textTokens.has(token)).length;
    if (exampleTokens.size > 0) {
      score += Math.min(4, (overlap / Math.min(exampleTokens.size, 30)) * 10);
    }

    if (score > 0) scores[tempoName] = Number(score.toFixed(3));
  }

  const ranked = Object.entries(scores)
    .map(([tempo, score]) => ({ tempo: tempo as TempoName, score: score ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 1.5) {
    return { tempo: "unknown", confidence: 0, margin: 0, scores };
  }

  const runnerUp = ranked[1]?.score ?? 0;
  const margin = Number((top.score - runnerUp).toFixed(3));
  const rawConfidence = Math.min(0.99, top.score / (top.score + runnerUp + 4));

  // Cap heuristic confidence on short copy. Per the 2026-05-27 Mirodan audit
  // (research/audit-mirodan-2026-05-27.md, P0 #3): "two-factor reads on 5-12
  // word web copy cannot be 1.00 confident." Short copy carries insufficient
  // signal for a confident two-factor Variation read; the LLM judge handles
  // these. Threshold: < 3 beats AND < 20 words → cap at 0.6.
  const beatCount = paragraph.split(/\n\n+/).filter((p) => p.trim().length > 0).length || 1;
  const wordCount = paragraph.split(/\s+/).filter(Boolean).length;
  const isShortCopy = beatCount < 3 && wordCount < 20;
  const cappedConfidence = isShortCopy ? Math.min(rawConfidence, 0.6) : rawConfidence;
  const confidence = Number(cappedConfidence.toFixed(3));

  if (confidence < 0.32 || margin < 0.5) {
    return { tempo: "unknown", confidence, margin, scores };
  }

  return { tempo: top.tempo, confidence, margin, scores };
}

function normalizeForTempoMatch(s: string): string {
  return normalizeForFactMatch(s);
}

/**
 * Audit a generated post's beats against the declared beat sequence.
 */
export function auditBeats(
  text: string,
  beats: BeatSequence,
  voice: CharacterSpec = INFINEX_VOICE,
): BeatAuditResult[] {
  const paragraphs = splitIntoBeats(text);
  const results: BeatAuditResult[] = [];

  for (let i = 0; i < beats.beats.length; i++) {
    const declared = beats.beats[i];
    if (!declared) continue;
    const paragraph = paragraphs[i];
    if (!paragraph) {
      results.push({
        beat_index: i,
        ...(declared.tempo !== undefined ? { declared_tempo: declared.tempo } : {}),
        passed: false,
        reason: "missing paragraph for declared beat",
      });
      continue;
    }
    // The generator no longer declares a tempo per beat (Mirodan: tempo
    // emerges from the verb under inner work; audience perceives it). If a
    // declared tempo IS present (legacy single-call path), surface it for
    // diagnostics but do not gate on it. The acceptance criterion is
    // membership in voice.tempi — i.e., is the classified tempo inside the
    // voice's locked palette?
    const classification = classifyTempoBlind(paragraph, voice);
    // Pass criterion: heuristic deferral OR in-palette read.
    // - "unknown" classification → heuristic could not read (typical for
    //   Laban-pure voices without brand-vocab); defer to validator-llm.
    // - Any non-unknown classification IS in-palette by construction
    //   (classifier restricts to voice.main_tempi at line 527).
    // The heuristic blind classifier is informational; the LLM judge is the
    // authoritative tempo gate. See research/pre-mortem-non-canon-contamination-2026-05-28.md
    // (Option C: cap heuristic confidence, prefer LLM judgment).
    const inPalette =
      classification.tempo === "unknown" ||
      voice.tempi[classification.tempo] !== undefined;
    const passed = inPalette;
    const result: BeatAuditResult = {
      beat_index: i,
      ...(declared.tempo !== undefined ? { declared_tempo: declared.tempo } : {}),
      classified_tempo: classification.tempo,
      classified_confidence: classification.confidence,
      passed,
    };
    if (classification.tempo === "unknown") {
      result.reason = `heuristic blind classifier deferred (confidence ${classification.confidence}, margin ${classification.margin}) — defer to validator-llm`;
    } else if (declared.tempo && classification.tempo !== declared.tempo) {
      result.reason = `audience read ${classification.tempo} (legacy path declared ${declared.tempo})`;
    }
    results.push(result);
  }

  return results;
}

/**
 * Nigel-style LLM beat audit.
 *
 * This is the production-parity path: a separate Sonnet validator call reads
 * each beat blind to the generator's declared tempo, emits
 * `independent_classification`, and this glue compares declared vs classified.
 *
 * The deterministic `auditBeats()` above remains as a cheap fallback and for
 * unit tests; it should not be confused with Nigel's second-model validator.
 */
export async function auditBeatsLLM(
  text: string,
  beats: BeatSequence,
  opts: Omit<LLMVoiceAuditOptions, "declared_tempo"> = {},
): Promise<LLMBeatAuditResult[]> {
  return auditBeatsLLMInternal(text, beats, opts);
}

// -- hybrid (regex + LLM composition) ----------------------------------------

/**
 * Compose deterministic regex with the Sonnet LLM judge.
 *
 * Codex's review (2026-05-15) flagged that `auditTextLLM()` standalone may
 * rationalize generic slop ("game-changer", "next-gen", etc.) as
 * character-coherent because the decontaminated prompt forbids ban lists.
 *
 * Hybrid path: deterministic hygiene is the hard pre-filter. If a hygiene
 * rule or numeric/URL tripwire fails, we short-circuit. Candidates that
 * survive hygiene are sent to the LLM for character and semantic fact judgment.
 *
 * Regex catches taste-independent garbage. LLM catches character drift and
 * paraphrased fact support.
 */
export type HybridValidationVerdict = {
  passed: boolean;
  deterministic: ValidationResult;
  llm?: LLMVoiceAuditVerdict;
  /**
   * Top-line reason for the verdict — either the first regex rule that fired,
   * or a summary from the LLM judge, or `null` on pass.
   */
  reason: string | null;
};

export async function auditTextHybrid(
  text: string,
  opts: {
    voice?: CharacterSpec;
    beats?: BeatSequence;
    card?: ReleaseCard;
    channel?: Channel;
    deployed_facts_used?: string[];
    not_said?: NotSaidFact[];
    llm_opts?: Omit<LLMVoiceAuditOptions, "voice">;
  } = {},
): Promise<HybridValidationVerdict> {
  const detOpts: Parameters<typeof validate>[1] = {};
  if (opts.beats !== undefined) detOpts.beats = opts.beats;
  if (opts.voice !== undefined) detOpts.voice = opts.voice;
  if (opts.card !== undefined) detOpts.card = opts.card;
  if (opts.channel !== undefined) detOpts.channel = opts.channel;
  if (opts.deployed_facts_used !== undefined) detOpts.deployed_facts_used = opts.deployed_facts_used;
  if (opts.not_said !== undefined) detOpts.not_said = opts.not_said;
  const deterministic = validate(text, detOpts);

  // Short-circuit on deterministic hygiene failure — don't pay for an LLM call.
  if (!deterministic.passed) {
    const first = deterministic.failures[0];
    return {
      passed: false,
      deterministic,
      reason: first ? `${first.rule}: ${first.reason}` : "deterministic-fail",
    };
  }

  // Regex clean — now ask the LLM judge.
  const llmOpts: LLMVoiceAuditOptions = { ...(opts.llm_opts ?? {}) };
  if (opts.voice !== undefined) llmOpts.voice = opts.voice;
  const llm = await auditTextLLM(text, llmOpts);

  if (!llm.passed) {
    return {
      passed: false,
      deterministic,
      llm,
      reason: llm.feedback || "llm-judge-fail",
    };
  }

  return {
    passed: true,
    deterministic,
    llm,
    reason: null,
  };
}

// -- composite ---------------------------------------------------------------

type Rule = { name: string; fn: (s: string) => RuleResult };

export const RULES: Rule[] = [
  { name: "cliches", fn: rejectCliches },
  { name: "listicle-voice", fn: rejectListicleVoice },
  { name: "antagonism", fn: rejectAntagonism },
  { name: "ai-slop", fn: rejectAIslop },
  { name: "kain-baggage", fn: rejectKainBaggage },
  { name: "claimed-palettes", fn: rejectClaimedPalettes },
  { name: "visual-slop", fn: rejectVisualSlop },
  // off-spec-drive handled in validate() — it's voice-dependent, can't be static
];

// -- structured-channel shape gate (regex-grade, deterministic) ---------------
// Per-segment length + count limits for STRUCTURED_CHANNELS (web/carousel/x-thread).
// Slop RULES still run on the candidate's readable `.text`; this gate enforces the
// shape the real surface requires. Budgets mirror the platform surfaces:
//   web-card → feature-card-alt; carousel → app-alert "What's new"; thread → X.
/**
 * Internal version tags ("V1", "Spot V1", "v2.1") are changelog register and
 * must not appear in outward channels (x, x-thread, web, carousel). Cheap
 * deterministic check; the Director also catches register drift the regex can't.
 */
export function rejectOutwardVersionTag(s: string): RuleResult {
  const match = s.match(/\bv\d+(?:\.\d+)*\b/i);
  if (match) {
    return { passed: false, reason: `outward channel contains internal version tag "${match[0]}" — version tags are changelog register, banned outward` };
  }
  return { passed: true };
}

/** A URL or bare domain (e.g. "infinex.xyz/news"). t.co links count too. */
export function containsUrl(text: string): boolean {
  if (/\bhttps?:\/\/\S+/i.test(text)) return true;
  return /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:xyz|com|io|gg|org|net|app|co|fi|eth)\b(?:\/\S*)?/i.test(text);
}

export function structureIssues(structured: StructuredOutput): string[] {
  const issues: string[] = [];
  const over = (label: string, text: string, max: number): void => {
    if (text.length > max) issues.push(`${label}: ${text.length} > ${max} chars`);
  };
  switch (structured.kind) {
    case "thread": {
      const t = structured.tweets;
      if (t.length < 2) issues.push(`thread has ${t.length} tweets (min 2)`);
      if (t.length > 6) issues.push(`thread has ${t.length} tweets (max 6)`);
      t.forEach((tw, i) => over(`tweet ${i + 1}`, tw, 280));
      // X penalizes reach when tweet 1 carries a link; links go in a later tweet.
      if (t[0] && containsUrl(t[0])) {
        issues.push("tweet 1 contains a link; X penalizes reach — move the link to a later tweet");
      }
      break;
    }
    case "carousel": {
      const s = structured.slides;
      if (s.length < 3) issues.push(`carousel has ${s.length} slides (min 3)`);
      if (s.length > 6) issues.push(`carousel has ${s.length} slides (max 6)`);
      s.forEach((sl, i) => {
        over(`slide ${i + 1} name`, sl.name, 40);
        over(`slide ${i + 1} body`, sl.body, 240);
      });
      break;
    }
    case "web-card": {
      over("subheading", structured.subheading, 24);
      over("title", structured.title.replace(/\s*\/\s*/g, " "), 48);
      over("caption", structured.caption, 44);
      break;
    }
  }
  return issues;
}

export function validate(
  s: string,
  opts: {
    beats?: BeatSequence;
    voice?: CharacterSpec;
    card?: ReleaseCard;
    channel?: Channel;
    deployed_facts_used?: string[];
    not_said?: NotSaidFact[];
    fact_contract?: FactContractMode;
  } = {},
): ValidationResult {
  const voice = opts.voice ?? INFINEX_VOICE;
  const failures: RuleFailure[] = [];
  for (const rule of RULES) {
    const r = rule.fn(s);
    if (!r.passed) failures.push({ rule: rule.name, reason: r.reason ?? "failed" });
  }
  // Voice-specific off-spec drive language check.
  const offSpec = rejectOffSpecDrive(s, voice);
  if (!offSpec.passed) failures.push({ rule: "off-spec-drive", reason: offSpec.reason ?? "failed" });
  const formatOpts: ChangelogFormatOptions = {};
  if (opts.channel !== undefined) formatOpts.channel = opts.channel;
  if (opts.card !== undefined) formatOpts.card = opts.card;
  if (opts.card) {
    failures.push(...auditChangelogFormat(s, formatOpts));
  }
  const factText = opts.card ? claimAuditText(s, formatOpts) : s;
  if (opts.card && opts.fact_contract !== "off") {
    failures.push(...auditClaimTripwires(factText, opts.card));
  }
  if (opts.card && opts.fact_contract === "strict") {
    const claimOpts: ClaimContractOptions = { card: opts.card };
    if (opts.deployed_facts_used !== undefined) {
      claimOpts.deployed_facts_used = opts.deployed_facts_used;
    }
    if (opts.not_said !== undefined) {
      claimOpts.not_said = opts.not_said;
    }
    failures.push(...auditClaimContract(factText, claimOpts));
  }

  const result: ValidationResult = {
    passed: failures.length === 0,
    failures,
  };

  // Beat-sequence audit only when beats are declared.
  if (opts.beats) {
    const prep = auditPrepHierarchy(opts.beats, voice);
    const beatAudit = auditBeats(s, opts.beats, voice);
    if (prep.length > 0) {
      result.prep_hierarchy_failures = prep;
      for (const p of prep) {
        failures.push({
          rule: "prep-hierarchy",
          reason: `beat ${p.beat_index} fires ${p.quick_action} without ${p.required_prep} prep — degrades to ${p.required_prep}`,
        });
      }
      result.passed = false;
    }
    const beatFailures = beatAudit.filter((b) => !b.passed);
    if (beatFailures.length > 0) {
      result.beat_audit = beatAudit;
      for (const b of beatFailures) {
        failures.push({
          rule: "beat-tempo-fit",
          reason: `beat ${b.beat_index} (declared ${b.declared_tempo}): ${b.reason ?? "tempo mismatch"}`,
        });
      }
      result.passed = false;
    } else {
      result.beat_audit = beatAudit;
    }
  }

  return result;
}
