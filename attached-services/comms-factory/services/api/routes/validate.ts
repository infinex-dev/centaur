import { validate } from "../../../src/validator.js";
import type { ReleaseCard } from "../../../src/card.js";
import { safeParseReleaseCard } from "../../../src/card.js";
import { assertRecord, HttpError, optionalString, requiredString, stringArray, type JsonResponse, type RequestContext } from "../http.js";

export function handleValidate(ctx: RequestContext): JsonResponse {
  const body = assertRecord(ctx.body);
  const text = requiredString(body, "text");
  const card = parseOptionalCard(body.card ?? body.release_card);
  const result = validate(text, {
    ...(card ? { card } : {}),
    ...(typeof body.fact_contract === "string" ? { fact_contract: body.fact_contract as "tripwire" | "strict" | "off" } : {}),
    ...(Array.isArray(body.deployed_facts_used) ? { deployed_facts_used: stringArray(body.deployed_facts_used) } : {}),
    ...(Array.isArray(body.not_said) ? { not_said: body.not_said as never } : {}),
  });
  return {
    body: {
      ok: true,
      operation: "validate",
      text_chars: text.length,
      surface: optionalString(body, "surface"),
      ...result,
    },
  };
}

function parseOptionalCard(value: unknown): ReleaseCard | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = safeParseReleaseCard(value);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_release_card", "supplied ReleaseCard failed schema validation", parsed.error.flatten());
  }
  return parsed.data;
}
