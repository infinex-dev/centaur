/**
 * Surface model for the package-review UI.
 *
 * The design system (Claude Code Design v3) renders each candidate as a
 * presentational *surface*. The pipeline now natively persists the seven
 * channels (x, x-thread, web, in-product, modal, blog, carousel) and a typed
 * `structured_json` payload (StructuredOutput: web-card | carousel | thread)
 * for the structured channels. This module maps a stored candidate onto its
 * presentational surface and parses that payload, with a heuristic
 * tweet-boundary split as a FALLBACK ONLY for an `x` candidate whose text
 * reads like a thread but carries no structured payload.
 */

import type { Channel, HarnessCandidate } from './types';

export type SurfaceKind = Channel;

/** StructuredOutput as persisted by the pipeline (src/generator.ts). */
export type StructuredOutput =
  | { kind: 'web-card'; subheading: string; title: string; caption: string }
  | { kind: 'carousel'; slides: { name: string; body: string }[] }
  | { kind: 'thread'; tweets: string[]; media?: (string | null)[] };

export interface SurfaceMeta {
  glyph: string;
  label: string;
  role: string;
  /** Soft char budget for the primary text body. */
  limit: number | null;
}

export const SURFACE_META: Record<SurfaceKind, SurfaceMeta> = {
  x: { glyph: '𝕏', label: 'X', role: 'shortest public announcement', limit: 280 },
  'x-thread': { glyph: '≣', label: 'X thread', role: 'expanded public narrative', limit: 280 },
  web: { glyph: '▭', label: 'Web', role: 'feature card', limit: 220 },
  'in-product': { glyph: '◧', label: 'In-product', role: '“What’s new” microcopy', limit: 90 },
  modal: { glyph: '▢', label: 'Modal', role: 'in-app dialog', limit: 400 },
  blog: { glyph: '¶', label: 'Blog', role: 'long-form post', limit: null },
  carousel: { glyph: '⬚', label: 'Carousel', role: 'numbered slides', limit: 240 },
  'image-brief': { glyph: '▧', label: 'Image brief', role: 'art-direction for the designer', limit: null },
};

/** Order surfaces appear in filters / grids. */
export const SURFACE_ORDER: SurfaceKind[] = [
  'x',
  'x-thread',
  'web',
  'in-product',
  'modal',
  'blog',
  'carousel',
  'image-brief',
];

/**
 * Presentational surface for a candidate. The channel IS the surface now that
 * the pipeline emits all seven; we only special-case an `x` candidate that has
 * no structured payload but whose text splits into multiple tweets — render it
 * as a thread so the boundaries stay visible.
 */
export function surfaceOfCandidate(c: HarnessCandidate): SurfaceKind {
  if (c.channel === 'x' && !c.structured_json && splitTweets(c.text).length > 1) {
    return 'x-thread';
  }
  return c.channel;
}

/**
 * Parse a candidate's typed StructuredOutput payload. Returns null when there
 * is no structured payload (single-string channels, or not-yet-emitted).
 */
export function parseStructured(structuredJson: string | null | undefined): StructuredOutput | null {
  if (!structuredJson) return null;
  try {
    const obj = JSON.parse(structuredJson) as Record<string, unknown>;
    if (
      obj.kind === 'web-card' &&
      typeof obj.subheading === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.caption === 'string'
    ) {
      return { kind: 'web-card', subheading: obj.subheading, title: obj.title, caption: obj.caption };
    }
    if (obj.kind === 'thread' && Array.isArray(obj.tweets)) {
      const tweets = obj.tweets.filter((t): t is string => typeof t === 'string');
      const media = Array.isArray(obj.media)
        ? obj.media.map((m) => (typeof m === 'string' ? m : null))
        : undefined;
      return { kind: 'thread', tweets, ...(media ? { media } : {}) };
    }
    if (obj.kind === 'carousel' && Array.isArray(obj.slides)) {
      const slides = obj.slides.flatMap((s) => {
        if (!s || typeof s !== 'object') return [];
        const row = s as Record<string, unknown>;
        if (typeof row.name !== 'string' || typeof row.body !== 'string') return [];
        return [{ name: row.name, body: row.body }];
      });
      return { kind: 'carousel', slides };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Flat-text rendering of a StructuredOutput, used as the pick's `final_text`
 * when the operator edits a structured surface. The validator, history guard,
 * Slack ship, and recent-copy corpus all read flat text, so structured edits
 * must round-trip to a coherent string — not just sit in structured_json.
 */
export function flattenStructured(s: StructuredOutput): string {
  if (s.kind === 'web-card') return [s.subheading, s.title, s.caption].filter(Boolean).join('\n');
  if (s.kind === 'thread') return s.tweets.join('\n\n');
  return s.slides.map((sl) => `${sl.name}\n${sl.body}`).join('\n\n');
}

/**
 * Heuristic tweet-boundary split for X candidates with NO stored structure.
 * Recognises explicit "n/" numbering and blank-line separated blocks. Fallback
 * only — when a candidate has a real `structured_json` thread, that wins.
 */
export function splitTweets(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [trimmed];

  const numbered = trimmed.split(/\n(?=\s*\d+\s*\/\s*\d*\s)/);
  if (numbered.length > 1) {
    return numbered.map((t) => t.replace(/^\s*\d+\s*\/\s*\d*\s*/, '').trim()).filter(Boolean);
  }

  const blocks = trimmed.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1 && blocks.length <= 12) return blocks;

  return [trimmed];
}
