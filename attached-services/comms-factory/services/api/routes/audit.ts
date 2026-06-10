import { auditTextHybrid, validate } from "../../../src/validator.js";
import type { ReleaseCard } from "../../../src/card.js";
import { safeParseReleaseCard, deployedFactClaims } from "../../../src/card.js";
import { assertRecord, optionalString, requiredString, type JsonResponse, type RequestContext } from "../http.js";

export async function handleAudit(ctx: RequestContext): Promise<JsonResponse> {
  const body = assertRecord(ctx.body);
  const text = requiredString(body, "text");
  const surface = optionalString(body, "surface") ?? "tweet";
  const voiceId = optionalString(body, "voice_id") ?? "infinex";
  const card = parseFactSource(body.fact_source ?? body.card ?? body.release_card);

  const deterministic = validate(text, { ...(card ? { card } : {}) });
  if (!deterministic.passed) {
    return {
      body: {
        ok: true,
        operation: "audit",
        light: "red",
        axes: {
          voice: { light: "red", issues: deterministic.failures },
          fact: { light: card ? "red" : "amber", status: card ? "violated" : "needs_confirmation", claims: [] },
        },
        deterministic,
        notes: deterministic.failures.map((failure) => `${failure.rule}: ${failure.reason}`),
        questions: card ? [] : factQuestions(text, surface),
        no_self_grounding: true,
      },
    };
  }

  if (!card) {
    return {
      body: {
        ok: true,
        operation: "audit",
        light: "amber",
        axes: {
          voice: { light: "green", issues: [] },
          fact: { light: "amber", status: "needs_confirmation", claims: [] },
        },
        deterministic,
        notes: ["Deterministic validation passed. Fact axis needs supplied facts or human confirmation; audit did not self-ground."],
        questions: factQuestions(text, surface),
        no_self_grounding: true,
      },
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      body: {
        ok: true,
        operation: "audit",
        light: "amber",
        axes: {
          voice: { light: "amber", issues: [] },
          fact: { light: "green", status: "grounded", claims: card.deployed_facts },
        },
        deterministic,
        notes: ["Deterministic validation passed against supplied facts. Director LLM audit was not run because ANTHROPIC_API_KEY is not configured."],
        questions: [],
        surface,
        voice_id: voiceId,
        no_self_grounding: true,
      },
    };
  }

  const hybrid = await auditTextHybrid(text, {
    card,
    llm_opts: {
      surface,
      deployed_facts: deployedFactClaims(card),
      fact_context: deployedFactClaims(card).join("\n"),
    },
  });
  const light = hybrid.passed ? "green" : "red";
  return {
    body: {
      ok: true,
      operation: "audit",
      light,
      axes: {
        voice: { light, issues: hybrid.llm?.voice_issues ?? [] },
        fact: { light, status: hybrid.passed ? "grounded" : "violated", claims: card.deployed_facts },
      },
      deterministic,
      director: hybrid,
      notes: hybrid.reason ? [hybrid.reason] : ["Director audit passed."],
      questions: [],
      surface,
      voice_id: voiceId,
      no_self_grounding: true,
    },
  };
}

function parseFactSource(value: unknown): ReleaseCard | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const deployedFacts = Array.isArray(record.deployed_facts)
    ? record.deployed_facts.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const candidate = {
    kind: "launch-tier",
    id: "audit-fact-source",
    title: "Audit fact source",
    ship_date: new Date().toISOString().slice(0, 10),
    audience: ["x"],
    headline: "Audit fact source",
    tier_reason: "supplied for audit",
    ...record,
    deployed_facts: deployedFacts.length ? deployedFacts : record.deployed_facts,
  };
  const parsed = safeParseReleaseCard(candidate);
  return parsed.success ? parsed.data : undefined;
}

function factQuestions(text: string, surface: string): Array<{ id: string; question: string; assumption_being_tested: string }> {
  return [
    {
      id: "facts-1",
      question: `What deployed facts support the claims in this ${surface} copy?`,
      assumption_being_tested: text.slice(0, 240),
    },
  ];
}
