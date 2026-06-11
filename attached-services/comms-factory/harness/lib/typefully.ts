/**
 * Typefully API v2 client — create a DRAFT thread (never publish). Server-only;
 * reads TYPEFULLY_API_KEY from the env (harness/.env.local, gitignored).
 *
 * Contract verified 2026-06-09 against the live API:
 *  - auth: `Authorization: Bearer <key>`  (NOT the v1 `X-API-KEY` — v1 dies 2026-06-15)
 *  - create draft: POST /v2/social-sets/{id}/drafts
 *  - thread: platforms.x.posts[] — one {text} per tweet, in order
 *  - media: POST /media/upload -> raw-byte PUT to presigned URL -> GET /media/{id}
 *  - media attach: posts[].media_ids[] references uploaded media ids
 *  - DRAFT-ONLY: omit `publish_at` → status "draft". We never set publish_at.
 */

const BASE = 'https://api.typefully.com';
const MEDIA_READY_TIMEOUT_MS = 30_000;
const MEDIA_READY_POLL_MS = 800;

async function tf(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) {
    throw new Error('TYPEFULLY_API_KEY is not set — add it to harness/.env.local and restart the dev server.');
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Typefully ${init?.method ?? 'GET'} ${path} → HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Resolve the target social set by env (id or name) or default to "Infinex". */
async function resolveSocialSetId(): Promise<number> {
  const want = process.env.TYPEFULLY_SOCIAL_SET?.trim();
  if (want && /^\d+$/.test(want)) return Number(want);
  const data = await tf('/v2/social-sets');
  const sets = (Array.isArray(data) ? data : (data.results as unknown[]) ?? []) as Array<{ id: number; name?: string }>;
  const wantName = (want || 'Infinex').toLowerCase();
  const match = sets.find((s) => (s.name ?? '').toLowerCase() === wantName) ?? sets[0];
  if (!match) throw new Error('No Typefully social sets found for this API key.');
  return match.id;
}

export interface TypefullyDraftResult {
  id: number;
  status: string;
  socialSetId: number;
  count: number;
  mediaCount: number;
  /** Link to open the draft in Typefully (private_url: ?d={id}&a={social_set}). */
  url: string | null;
}

export interface TypefullyThreadPostInput {
  text: string;
  mediaUrls?: (string | null | undefined)[];
}

interface TypefullyPostBody {
  text: string;
  media_ids?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Typefully response missing ${field}.`);
  return value;
}

function mediaFileName(url: string, index: number): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
  } catch {
    // Fall through to the generic filename below; downloadMedia validates the URL.
  }
  return `thread-media-${index + 1}.png`;
}

async function downloadMedia(url: string, index: number): Promise<{ fileName: string; bytes: ArrayBuffer }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid media URL for tweet ${index + 1}: ${url}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported media URL protocol for tweet ${index + 1}: ${parsed.protocol}`);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Media download failed for tweet ${index + 1} (${res.status}).`);
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error(`Media download was empty for tweet ${index + 1}.`);
  return { fileName: mediaFileName(url, index), bytes };
}

async function createTypefullyMediaUpload(
  socialSetId: number,
  fileName: string,
): Promise<{ mediaId: string; uploadUrl: string }> {
  const slot = await tf(`/v2/social-sets/${socialSetId}/media/upload`, {
    method: 'POST',
    body: JSON.stringify({ file_name: fileName }),
  });
  return {
    mediaId: asString(slot.media_id, 'media_id'),
    uploadUrl: asString(slot.upload_url, 'upload_url'),
  };
}

async function putTypefullyMedia(uploadUrl: string, bytes: ArrayBuffer): Promise<void> {
  // Typefully's presigned S3 URL is signed for raw bytes. Do not add
  // Content-Type, Authorization, or custom headers here.
  const res = await fetch(uploadUrl, { method: 'PUT', body: bytes });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Typefully media PUT failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

async function waitForTypefullyMedia(socialSetId: number, mediaId: string): Promise<void> {
  const deadline = Date.now() + MEDIA_READY_TIMEOUT_MS;
  let lastStatus = 'unknown';

  while (Date.now() < deadline) {
    const data = await tf(`/v2/social-sets/${socialSetId}/media/${mediaId}`);
    lastStatus = typeof data.status === 'string' ? data.status : 'unknown';
    if (lastStatus === 'ready') return;
    if (lastStatus === 'failed') {
      const reason = typeof data.error_reason === 'string' ? `: ${data.error_reason}` : '';
      throw new Error(`Typefully media processing failed for ${mediaId}${reason}`);
    }
    await sleep(MEDIA_READY_POLL_MS);
  }

  throw new Error(`Typefully media ${mediaId} was not ready after ${MEDIA_READY_TIMEOUT_MS / 1000}s (last status: ${lastStatus}).`);
}

async function uploadTypefullyMediaFromUrl(
  socialSetId: number,
  mediaUrl: string,
  tweetIndex: number,
): Promise<string> {
  const media = await downloadMedia(mediaUrl, tweetIndex);
  const slot = await createTypefullyMediaUpload(socialSetId, media.fileName);
  await putTypefullyMedia(slot.uploadUrl, media.bytes);
  await waitForTypefullyMedia(socialSetId, slot.mediaId);
  return slot.mediaId;
}

export async function createTypefullyThreadDraft(
  tweets: Array<string | TypefullyThreadPostInput>,
  opts: { title?: string } = {},
): Promise<TypefullyDraftResult> {
  const inputPosts = tweets
    .map((t) => (typeof t === 'string' ? { text: t } : t))
    .map((post) => ({
      text: post.text.trim(),
      mediaUrls: (post.mediaUrls ?? []).filter((u): u is string => typeof u === 'string' && u.trim().length > 0),
    }))
    .filter((post) => post.text.length > 0);
  if (inputPosts.length === 0) throw new Error('No tweets to send to Typefully.');

  const socialSetId = await resolveSocialSetId();
  const posts: TypefullyPostBody[] = [];
  let mediaCount = 0;
  for (const [i, post] of inputPosts.entries()) {
    const mediaIds: string[] = [];
    for (const url of post.mediaUrls) {
      mediaIds.push(await uploadTypefullyMediaFromUrl(socialSetId, url, i));
    }
    mediaCount += mediaIds.length;
    posts.push({ text: post.text, ...(mediaIds.length > 0 ? { media_ids: mediaIds } : {}) });
  }

  const body = {
    platforms: { x: { enabled: true, posts } },
    share: false,
    ...(opts.title ? { draft_title: opts.title.slice(0, 120) } : {}),
    // publish_at deliberately omitted → the draft stays a draft. Never auto-publish.
  };
  const draft = await tf(`/v2/social-sets/${socialSetId}/drafts`, { method: 'POST', body: JSON.stringify(body) });
  const id = Number(draft.id ?? draft.draft_id);
  const url = typeof draft.private_url === 'string' ? draft.private_url : null;
  return { id, status: String(draft.status ?? 'draft'), socialSetId, count: posts.length, mediaCount, url };
}
