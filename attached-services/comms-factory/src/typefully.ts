/**
 * Typefully API v2 client for the comms-factory SERVICE (drafts only — never
 * publishes). Adapted from harness/lib/typefully.ts (live-verified 2026-06-09),
 * which remains the operator-laptop break-glass twin. Differences: no media
 * support (future), share:true + scratchpad_text for review URLs/traceability,
 * TYPEFULLY_BASE_URL override for tests, typed error codes.
 * Auth: `Authorization: Bearer <TYPEFULLY_API_KEY>` — header only, never URL/argv.
 */

export interface TypefullyDraftOptions {
  title?: string;
  scratchpad?: string;
}

export interface TypefullyDraftResult {
  draftId: number;
  status: string;
  socialSetId: number;
  count: number;
  shareUrl: string | null;
  draftUrl: string;
}

function baseUrl(): string {
  return (process.env.TYPEFULLY_BASE_URL ?? "https://api.typefully.com").replace(/\/$/, "");
}

async function tf(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const key = process.env.TYPEFULLY_API_KEY?.trim();
  if (!key) throw new Error("typefully_not_configured");
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Upstream error bodies are third-party controlled and http.ts echoes error
    // messages into responses/logs unsanitized — strip the key before throwing.
    const safeDetail = detail.split(key).join("[redacted]");
    throw new Error(`typefully_http_${res.status}: ${safeDetail.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Resolve the target social set by env (numeric id or name), default "Infinex". */
async function resolveSocialSetId(): Promise<number> {
  const want = process.env.TYPEFULLY_SOCIAL_SET?.trim();
  if (want && /^\d+$/.test(want)) return Number(want);
  const data = await tf("/v2/social-sets");
  const sets = (Array.isArray(data) ? data : ((data.results as unknown[]) ?? [])) as Array<{ id: number; name?: string }>;
  const wantName = (want || "Infinex").toLowerCase();
  const match = sets.find((s) => (s.name ?? "").toLowerCase() === wantName);
  if (!match) throw new Error("typefully_social_set_not_found");
  return match.id;
}

export async function createTypefullyDraft(
  tweets: readonly string[],
  opts: TypefullyDraftOptions = {},
): Promise<TypefullyDraftResult> {
  const posts = tweets.map((t) => t.trim()).filter((t) => t.length > 0).map((text) => ({ text }));
  if (posts.length === 0) throw new Error("typefully_no_posts");
  const socialSetId = await resolveSocialSetId();
  const title = opts.title;
  const scratchpad = opts.scratchpad;
  const body = {
    platforms: { x: { enabled: true, posts } },
    share: true,
    ...(title ? { draft_title: title.slice(0, 120) } : {}),
    ...(scratchpad ? { scratchpad_text: scratchpad.slice(0, 2000) } : {}),
    // publish_at deliberately omitted → the draft stays a draft. Never auto-publish.
  };
  const draft = await tf(`/v2/social-sets/${socialSetId}/drafts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const draftId = Number(draft.id ?? draft.draft_id);
  const shareUrl =
    typeof draft.share_url === "string" ? draft.share_url
    : typeof draft.private_url === "string" ? draft.private_url
    : null;
  return {
    draftId,
    status: String(draft.status ?? "draft"),
    socialSetId,
    count: posts.length,
    shareUrl,
    draftUrl: `https://typefully.com/?a=${socialSetId}&d=${draftId}`,
  };
}
