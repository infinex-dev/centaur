import { orchestrateActorDirectorWithRetries } from "../../../src/actor-orchestrator.js";
import { safeParseReleaseCard, deployedFactClaims } from "../../../src/card.js";
import type { ReleaseCard } from "../../../src/card.js";
import type { Channel } from "../../../src/generator.js";
import { validate, type NotSaidFact } from "../../../src/validator.js";
import { assertRecord, boundedInteger, HttpError, stringArray, type JsonResponse, type RequestContext } from "../http.js";

// The route-level generation contract. Mirrors the full Channel union
// (src/generator.ts) — CHANNEL_GENERATION_PROFILES covers every member, so the
// allowlist exists only to 400 typos early. Mirrored Python-side as
// GENERATED_CHANNELS in overlays/comms-factory/workflows/comms_shared.py.
export const CHANNELS = new Set<string>([
  "x",
  "x-thread",
  "web",
  "carousel",
  "modal",
  "in-product",
  "blog",
]);

export async function handleGenerate(ctx: RequestContext): Promise<JsonResponse> {
  const body = assertRecord(ctx.body);
  const rawCard = body.release_card ?? body.card;
  const parsed = safeParseReleaseCard(rawCard);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_release_card", "generate requires a valid approved ReleaseCard", parsed.error.flatten());
  }
  const card = parsed.data;
  if (!Array.isArray(card.deployed_facts) || card.deployed_facts.length === 0) {
    throw new HttpError(400, "missing_deployed_facts", "ReleaseCard.deployed_facts is required");
  }
  if (!hasApprovedFacts(body, card)) {
    throw new HttpError(400, "release_card_not_approved", "generate requires an approved ReleaseCard/facts gate");
  }

  const channels = normalizeChannels(body.channels, card);
  const events: unknown[] = [];
  const runOptions: Parameters<typeof orchestrateActorDirectorWithRetries>[2] = {
    maxAttempts: boundedInteger(body, "max_attempts", 3, 1, 3),
    mode: "live",
    onEvent: (event) => {
      events.push(event);
    },
  };
  runOptions.n = boundedInteger(body, "n", 5, 1, 10);
  const result = await orchestrateActorDirectorWithRetries(card, channels, runOptions);

  const candidates = result.attempts.flatMap((attempt) =>
    attempt.records.map((record) => ({
      ...record.candidate,
      validation: record.script_validation,
      director_audit: record.director_audit,
    })),
  );
  const deterministic = candidates.map((candidate) => ({
    id: candidate.id,
    channel: candidate.channel,
    validation: validateCandidate(candidate.text, card, candidate.deployed_facts_used, candidate.not_said),
  }));
  return {
    body: {
      ok: true,
      operation: "generate",
      candidates,
      picks: result.picks,
      selection_rationales: result.selection_rationales,
      exhausted: result.exhausted,
      deterministic,
      ...(Array.isArray(body.fact_receipts) ? { fact_receipts: body.fact_receipts } : {}),
      progress: { events },
      no_external_posting: true,
    },
  };
}

function validateCandidate(text: string, card: ReleaseCard, deployedFactsUsed: string[] | undefined, notSaid: NotSaidFact[] | undefined): ReturnType<typeof validate> {
  const opts: Parameters<typeof validate>[1] = { card };
  if (deployedFactsUsed !== undefined) opts.deployed_facts_used = deployedFactsUsed;
  if (notSaid !== undefined) opts.not_said = notSaid;
  return validate(text, opts);
}

function hasApprovedFacts(body: Record<string, unknown>, card: ReleaseCard): boolean {
  if (body.approved === true || body.facts_approved === true) return true;
  if (!Array.isArray(body.approved_facts)) return false;
  const approvedFacts = stringArray(body.approved_facts);
  if (approvedFacts.length === 0) return false;
  const approved = new Set(approvedFacts);
  return deployedFactClaims(card).every((fact) => approved.has(fact));
}

export function normalizeChannels(value: unknown, card: ReleaseCard): Channel[] {
  const raw = value === undefined ? card.audience : value;
  const requested = stringArray(raw);
  const normalized = requested.map((item) => (item === "tweet" ? "x" : item));
  const unsupported = normalized.filter((item) => !CHANNELS.has(item));
  if (unsupported.length > 0) {
    throw new HttpError(400, "unsupported_channels", `unsupported generation channel(s): ${[...new Set(unsupported)].join(", ")}`);
  }
  const channels = normalized.filter((item) => CHANNELS.has(item)) as Channel[];
  if (channels.length === 0) throw new HttpError(400, "missing_channels", "at least one generation channel is required");
  return [...new Set(channels)];
}
