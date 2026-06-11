import Anthropic from '@anthropic-ai/sdk';
import { safeParseReleaseCard, type ReleaseCard } from '@pipeline/card';
import { buildDeployedFacts, type VerifiedFact } from '@pipeline/fact-grounder-llm';
import type { HarnessCard, HarnessFact } from './types';

const DEFAULT_MODEL = process.env.HARNESS_CARD_BUILDER_MODEL ?? 'claude-sonnet-4-6';
const MAX_RETRIES = 2;

const SYSTEM_PROMPT = `You assemble comms-factory ReleaseCard JSON from a brief and a list of verified facts.

RULES:
- Use only claims present in deployed_facts. Do not invent or embellish.
- Preserve mechanics facts. If deployed_facts include a flow/mechanics fact, the ReleaseCard must keep it verbatim.
- For deposits, onramps, offramps, stablecoin orchestration, or bridge-like flows, do not build a pure partner/status card. Prefer kind="split" when source and destination mechanics are known.
- Return a single JSON object. No markdown fences, no prose, no extra text before or after the object.
- Choose exactly one kind: data-card-official | data-card-wry | launch-tier | split

SCHEMA (all fields required unless marked optional):
{
  "id":             string   — slug, e.g. "hyperliquid-spot-2026-05-20"
  "title":          string   — short human title
  "ship_date":      string   — YYYY-MM-DD format only
  "audience":       array    — MUST be a JSON array of strings, e.g. ["web", "x", "x-thread", "blog", "carousel"]
                              valid values: "web", "x", "x-thread", "telegram", "in-product", "modal", "blog", "carousel", "email", "press", "internal"
                              NEVER a plain string — always an array
  "deployed_facts": array    — copy verbatim from the supplied deployed_facts list
  "kind":           string   — one of the four kinds above
  "category":       string   — OPTIONAL editorial genus, orthogonal to kind.
                              "thesis" when the brief is a positioning/thesis piece rather than a release
                              event: no launch, no CTA, longer essay-form output, aura/credibility content.
                              Thesis audience should be ["blog", "x-thread", "x"] unless the brief says otherwise.
                              Omit for normal release/changelog cards.

  // kind=data-card-official requires: metric (string), value (string|number)
  // kind=data-card-official optional: unit (string), delta (string)
  // kind=data-card-wry requires: metric (string), value (string|number), joke_angle (string)
  // kind=data-card-wry optional: unit (string)
  // kind=launch-tier requires: headline (string), tier_reason (string)
  // kind=launch-tier optional: subhead (string)
  // kind=split requires: from (string), to (string), split_semantics (string)
}

BRIDGE / DEPOSIT GUIDANCE:
- If the facts say fiat enters and crypto/stablecoins are delivered to a wallet/app destination, choose kind="split".
- Set from to the source rail/user input, e.g. "fiat bank deposit" or "ACH/wire deposit".
- Set to to the destination, e.g. "USDC in Infinex" or "crypto destination wallet".
- split_semantics should name the mechanism, e.g. "fiat-to-stablecoin deposit rail".

EXAMPLE output for a launch-tier card:
{"id":"hyperliquid-spot-2026-05-20","title":"Spot trading live on Hyperliquid","ship_date":"2026-05-20","audience":["web","x"],"deployed_facts":["Hyperliquid spot CLOB is live"],"kind":"launch-tier","headline":"Spot trading, now live.","tier_reason":"First spot CLOB markets enabled on Hyperliquid via Infinex"}`;

export async function buildReleaseCardFromFacts(
  card: HarnessCard,
  facts: HarnessFact[],
): Promise<ReleaseCard> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required to build a release card in the harness.');
  }

  const verifiedFacts = facts.map(toVerifiedFact);
  const deployedFacts = buildDeployedFacts(verifiedFacts);
  if (deployedFacts.length === 0) {
    throw new Error('At least one approved or edited fact is required before building a release card.');
  }

  const client = new Anthropic();

  const firstUserMessage = JSON.stringify(
    { brief: card.brief, voice: card.voice, created_at: card.created_at, deployed_facts: deployedFacts },
    null,
    2,
  );

  // Multi-turn conversation built up across retries
  const turns: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: firstUserMessage },
  ];

  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: turns,
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.Messages.TextBlock).text)
      .join('\n')
      .trim();

    let json: unknown;
    try {
      json = extractJsonObject(text);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Card builder failed after ${MAX_RETRIES + 1} attempts: ${lastError}`);
      }
      turns.push({ role: 'assistant', content: text });
      turns.push({ role: 'user', content: `JSON parse failed: ${lastError}\n\nReturn corrected JSON only, no prose.` });
      continue;
    }

    const result = safeParseReleaseCard(json);
    if (result.success) return result.data;

    lastError = result.error.errors
      .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');

    if (attempt === MAX_RETRIES) {
      throw new Error(`Card builder schema validation failed after ${MAX_RETRIES + 1} attempts:\n${lastError}`);
    }

    turns.push({ role: 'assistant', content: text });
    turns.push({
      role: 'user',
      content: `Schema validation failed. Fix these errors and return corrected JSON only:\n${lastError}`,
    });
  }

  throw new Error('Card builder: unreachable');
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('Card builder did not return a JSON object.');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }

  throw new Error('Card builder did not return a complete JSON object.');
}

function toVerifiedFact(fact: HarnessFact): VerifiedFact {
  return {
    category: fact.category as VerifiedFact['category'],
    claim: fact.claim,
    value: fact.value,
    source: fact.source as VerifiedFact['source'],
    source_ref: fact.source_ref,
    confidence: fact.confidence,
    verified_at: fact.verified_at,
  };
}
