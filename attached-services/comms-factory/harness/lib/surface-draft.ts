import type { StructuredOutput } from './surfaces';

export interface SurfaceDraftPayload {
  structured: StructuredOutput | null;
  text: string;
  baseText?: string;
  baseStructuredJson?: string | null;
}

interface SurfaceDraftBase {
  baseText: string;
  baseStructuredJson: string | null;
}

const DESIGNER_PLACEHOLDER_RE = /<designer-[^>]+>/;
const CLOUDINARY_URL_RE = /https:\/\/res\.cloudinary\.com\//;

export function surfaceDraftPayload(
  working: { structured: StructuredOutput | null; text: string },
  base: SurfaceDraftBase,
): SurfaceDraftPayload {
  return {
    ...working,
    ...base,
  };
}

export function shouldRestoreSurfaceDraft(
  saved: SurfaceDraftPayload,
  currentText: string,
): boolean {
  if (!saved.text || saved.text === currentText) return false;

  // New-format drafts know which server value they were based on. If the final
  // pick changed underneath them, do not let stale localStorage shadow it.
  if (saved.baseText !== undefined) return saved.baseText === currentText;

  // Legacy drafts did not store a base. Avoid the known stale-image case:
  // placeholder copy from before asset placement shadowing a patched pick.
  if (DESIGNER_PLACEHOLDER_RE.test(saved.text) && !DESIGNER_PLACEHOLDER_RE.test(currentText)) {
    return false;
  }
  if (!CLOUDINARY_URL_RE.test(saved.text) && CLOUDINARY_URL_RE.test(currentText)) {
    return false;
  }

  return true;
}
