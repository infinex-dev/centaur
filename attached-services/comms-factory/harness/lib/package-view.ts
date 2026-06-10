/**
 * Package-review derivations: turn a CardDetailView into the surface-centric
 * shape the design's Package / Failures / Corpus tabs consume.
 *
 * A "surface" is the presentational unit the operator ships (X tweet, X
 * thread, web card, …). The pipeline persists all seven channels natively, so
 * the surface is the channel (with the one fallback where an `x` candidate
 * with no structured payload but multi-tweet text is shown as a thread — see
 * surfaceOfCandidate). Surfaces with no candidates are reported "missing", not
 * faked.
 */

import type { CardDetailView, HarnessCandidate } from './types';
import { CHANNELS } from './queries';
import { surfaceOfCandidate, type SurfaceKind } from './surfaces';

export type SurfaceState = 'shippable' | 'blocked' | 'missing';

export interface SurfaceRow {
  surface: SurfaceKind;
  state: SurfaceState;
  /** The best (latest passing, else latest) candidate for this surface. */
  candidate: HarnessCandidate | null;
  /** All candidates that resolved to this surface, newest attempt first. */
  candidates: HarnessCandidate[];
  /** Human reason when blocked. */
  blockReason: string | null;
}

export interface PackageView {
  rows: SurfaceRow[];
  shippable: number;
  total: number;
  blockedSurfaces: SurfaceKind[];
}

function candidatePasses(c: HarnessCandidate): boolean {
  if (!c.validation_passed) return false;
  if (c.director_passed === false) return false;
  if (c.active_validation_passed === false) return false;
  return true;
}

function blockReasonFor(c: HarnessCandidate | null): string | null {
  if (!c) return null;
  if (!c.validation_passed) {
    const fails = safeParse<Array<{ rule: string; reason: string }>>(c.validation_failures_json, []);
    return fails[0] ? `Format / regex — ${fails[0].reason}` : 'Format / regex failure.';
  }
  if (c.director_passed === false) return 'Director — content/tone not publication-ready.';
  if (c.active_validation_passed === false) return 'LLM auditor — voice/fact issue.';
  return null;
}

export function buildPackageView(detail: CardDetailView): PackageView {
  const all = CHANNELS.flatMap((ch) => detail.candidates_by_channel[ch]);

  const bySurface = new Map<SurfaceKind, HarnessCandidate[]>();
  for (const c of all) {
    const surf = surfaceOfCandidate(c);
    const bucket = bySurface.get(surf) ?? [];
    bucket.push(c);
    bySurface.set(surf, bucket);
  }

  const rows: SurfaceRow[] = [];
  for (const [surface, candidates] of bySurface) {
    candidates.sort((a, b) => b.attempt - a.attempt || b.created_at.localeCompare(a.created_at));
    const passing = candidates.find(candidatePasses) ?? null;
    const best = passing ?? candidates[0] ?? null;
    const state: SurfaceState = passing ? 'shippable' : best ? 'blocked' : 'missing';
    rows.push({
      surface,
      state,
      candidate: best,
      candidates,
      blockReason: state === 'blocked' ? blockReasonFor(best) : null,
    });
  }

  rows.sort((a, b) => a.surface.localeCompare(b.surface));
  const shippable = rows.filter((r) => r.state === 'shippable').length;
  return {
    rows,
    shippable,
    total: rows.length,
    blockedSurfaces: rows.filter((r) => r.state === 'blocked').map((r) => r.surface),
  };
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
