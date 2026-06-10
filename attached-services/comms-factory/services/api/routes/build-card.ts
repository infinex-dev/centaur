import { safeParseReleaseCard, type ReleaseCard } from "../../../src/card.js";
import { assertRecord, HttpError, requiredString, stringArray, type JsonResponse, type RequestContext } from "../http.js";

export function handleBuildCard(ctx: RequestContext): JsonResponse {
  const body = assertRecord(ctx.body);
  const brief = requiredString(body, "brief");
  const approvedFacts = normalizeFacts(body.facts ?? body.approved_facts ?? body.deployed_facts);
  if (approvedFacts.length === 0) {
    throw new HttpError(400, "missing_approved_facts", "at least one approved fact is required");
  }
  const card = buildReleaseCard(body, brief, approvedFacts);
  const parsed = safeParseReleaseCard(card);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_release_card", "built ReleaseCard failed schema validation", parsed.error.flatten());
  }
  return {
    body: {
      ok: true,
      operation: "build-card",
      release_card: parsed.data,
      deployed_facts: parsed.data.deployed_facts,
    },
  };
}

export function normalizeFacts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const facts: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) facts.push(item.trim());
    else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const text = record.fact ?? record.text ?? record.claim;
      if (typeof text === "string" && text.trim()) facts.push(text.trim());
    }
  }
  return facts;
}

function buildReleaseCard(body: Record<string, unknown>, brief: string, deployedFacts: string[]): ReleaseCard {
  const audience = stringArray(body.channels ?? body.audience, ["x"]);
  return {
    kind: "launch-tier",
    id: typeof body.id === "string" && body.id.trim() ? body.id.trim() : `card-${Date.now()}`,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : brief.slice(0, 80),
    ship_date: typeof body.ship_date === "string" && body.ship_date.trim() ? body.ship_date.trim() : new Date().toISOString().slice(0, 10),
    audience: audience.map((item) => (item === "tweet" ? "x" : item)) as ReleaseCard["audience"],
    deployed_facts: deployedFacts,
    headline: typeof body.headline === "string" && body.headline.trim() ? body.headline.trim() : brief.slice(0, 120),
    tier_reason: typeof body.tier_reason === "string" && body.tier_reason.trim() ? body.tier_reason.trim() : "operator-approved comms release",
  };
}
