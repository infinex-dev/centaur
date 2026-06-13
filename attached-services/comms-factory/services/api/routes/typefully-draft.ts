import { createTypefullyDraft } from "../../../src/typefully.js";
import {
  assertRecord,
  HttpError,
  log,
  optionalString,
  requiredString,
  stringArray,
  type JsonResponse,
  type RequestContext,
} from "../http.js";

export async function handleTypefullyDraft(ctx: RequestContext): Promise<JsonResponse> {
  const body = assertRecord(ctx.body);
  if (!process.env.TYPEFULLY_API_KEY?.trim()) {
    return { body: { ok: false, error: "typefully_not_configured" } };
  }
  const channel = requiredString(body, "channel");
  const tweets = stringArray(body.tweets);
  const text = optionalString(body, "text");
  const posts = tweets.length > 0 ? tweets : text ? [text] : [];
  if (posts.length === 0) throw new HttpError(400, "missing_text", "text or tweets is required");
  // Hoisted consts: under exactOptionalPropertyTypes, repeated optionalString()
  // calls in a conditional spread type as `string | undefined` (calls aren't
  // narrowed) — consts narrow correctly.
  const title = optionalString(body, "title");
  const scratchpad = optionalString(body, "scratchpad");
  try {
    const draft = await createTypefullyDraft(posts, {
      ...(title ? { title } : {}),
      ...(scratchpad ? { scratchpad } : {}),
    });
    return {
      body: {
        ok: true,
        channel,
        draft_id: draft.draftId,
        share_url: draft.shareUrl,
        draft_url: draft.draftUrl,
        count: draft.count,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message
      : typeof error === "string" ? error
      : JSON.stringify(error)?.slice(0, 200) ?? "unknown_error";
    if (
      message.startsWith("typefully_not_configured") ||
      message.startsWith("typefully_social_set_not_found")
    ) {
      return { body: { ok: false, error: "typefully_not_configured" } };
    }
    log("warn", "typefully_draft_failed", { channel, detail: message.slice(0, 200) });
    return { body: { ok: false, error: "typefully_draft_failed" } };
  }
}
