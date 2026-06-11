/**
 * Per-tweet image attachment for X-thread picks. Images are an operator
 * delivery-time asset (like the blog cover): uploaded to Cloudinary, stored as
 * a `media` array parallel to `tweets` inside the pick's structured payload.
 * They do NOT embed in the thread text (Typefully ships text); the URLs are
 * kept so the push-via-Typefully path can attach them.
 */
import { parseStructured } from './surfaces';

/** Media URLs (or null) parallel to a thread's tweets; [] if not a thread. */
export function threadMedia(structuredJson: string | null | undefined): (string | null)[] {
  const s = parseStructured(structuredJson);
  return s?.kind === 'thread' ? (s.media ?? []) : [];
}

/** Set the image URL for tweet `index` in a thread's structured payload. */
export function setThreadMedia(structuredJson: string, index: number, url: string): string {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(structuredJson) as Record<string, unknown>;
  } catch {
    throw new Error('setThreadMedia: structured payload is not valid JSON');
  }
  if (obj.kind !== 'thread' || !Array.isArray(obj.tweets)) {
    throw new Error('setThreadMedia: not a thread payload');
  }
  if (index < 0 || index >= obj.tweets.length) {
    throw new Error(`setThreadMedia: no tweet at index ${index}`);
  }
  const media: (string | null)[] = Array.isArray(obj.media) ? obj.media.slice() : [];
  while (media.length < obj.tweets.length) media.push(null);
  media[index] = url;
  obj.media = media;
  return JSON.stringify(obj);
}
