import { z } from "zod";

/**
 * Image briefs — art-direction suggestions for the designer, emitted per launch
 * alongside the copy channels. NOT a copy-channel: a brief carries no length/CTA
 * register; it describes WHAT image to commission, the per-surface crop it must
 * survive, and any validated on-image text. The brief is the deliverable; a
 * human designer (or a later image-gen phase) makes the pixels.
 *
 * Three standing kinds (reusable templates, consistent launch-over-launch):
 *   - hero          : brand cover. Lands on the changelog header, gets
 *                     center-cropped into the news card, and reused as the X
 *                     attached-media image. The crop-sensitive one.
 *   - in-app-mobile : the feature running in the mobile app on an Infinex
 *                     background. Body/inline image — letterboxed, not cropped.
 *   - feature-detail: tight crop on the specific UI element that shipped. Also
 *                     a body/inline image.
 *
 * Crop specs are sourced from research/surface-image-crop-grounding-2026-06-10.md.
 */

export const ImageBriefKind = z.enum(["hero", "in-app-mobile", "feature-detail"]);
export type ImageBriefKind = z.infer<typeof ImageBriefKind>;

export const STANDING_BRIEF_KINDS: ImageBriefKind[] = ["hero", "in-app-mobile", "feature-detail"];

export const CropSpec = z.object({
  /** Where this image is displayed (e.g. "news card cover", "X attached media"). */
  surface: z.string(),
  /** Target/authoring frame, e.g. "1200×700" or "309×180". */
  frame: z.string(),
  /** Aspect ratio label, e.g. "1.71:1". */
  aspect: z.string(),
  /** "center-cover" (gets cropped to fill) or "contain" (letterboxed, no crop). */
  crop: z.enum(["center-cover", "contain"]),
  /** Plain-language safe-area guidance for the designer. */
  safe_area: z.string(),
});
export type CropSpec = z.infer<typeof CropSpec>;

export const OnImageText = z.object({
  /** The validated on-image line, or null for "no text". */
  line: z.string().nullable(),
  /** Whether `line` passed the slop validator (null when there is no line). */
  validated: z.boolean().nullable(),
  /** Validator failure reasons, if any (kept for operator visibility). */
  failures: z.array(z.string()).default([]),
});
export type OnImageText = z.infer<typeof OnImageText>;

/** Hard length ceiling for a brief scene — keep it tweet-length so a designer
 *  can read it at a glance, not a wall of text. */
export const SCENE_MAX_CHARS = 240;
/** Length ceiling for the "where to find it in the app" pointer. */
export const WHERE_MAX_CHARS = 100;

export const ImageBrief = z.object({
  kind: ImageBriefKind,
  /** The image in ≤2 sentences. Concrete + visual, tweet-length (≤SCENE_MAX_CHARS). */
  scene: z.string().max(SCENE_MAX_CHARS),
  /** The concrete shipped thing depicted (feature / UI), grounded in the card. */
  subject: z.string(),
  /** Short pointer to where in the app this lives (route/screen), or omitted. */
  where: z.string().max(WHERE_MAX_CHARS).optional(),
  /** Brand background/style. Stubbed until brand-factory has Infinex at `voiced`. */
  background: z.string(),
  on_image_text: OnImageText,
  crop_specs: z.array(CropSpec),
});
export type ImageBrief = z.infer<typeof ImageBrief>;

/** One-line crop hint per kind for the rendered brief (the full per-surface
 *  detail lives in CROP_SPECS; the designer-facing surface stays terse). */
export const CROP_HINT: Record<ImageBriefKind, string> = {
  hero: "1.71:1 landscape — keep the subject centred (gets cropped 3 ways)",
  "in-app-mobile": "inline, any aspect — not cropped",
  "feature-detail": "inline, any aspect — not cropped",
};

/**
 * Per-surface crop specs the commissioned image must survive. Grounded numbers
 * from research/surface-image-crop-grounding-2026-06-10.md. The hero is the
 * crop-sensitive one (one image is center-cropped into three different frames);
 * in-app/feature-detail are body images and are letterboxed, never cropped.
 */
export const CROP_SPECS: Record<ImageBriefKind, CropSpec[]> = {
  hero: [
    {
      surface: "author target (one image for all three crops below)",
      frame: "1200×700 (retina 2400×1400)",
      aspect: "1.71:1",
      crop: "center-cover",
      safe_area: "keep faces / numbers / logos inside the centre ~83% horizontal × ~89% vertical",
    },
    {
      surface: "website news card cover",
      frame: "309×180",
      aspect: "1.717:1",
      crop: "center-cover",
      safe_area: "near-full frame shown; mild edge crop",
    },
    {
      surface: "X attached media (Typefully thread)",
      frame: "~1.91:1",
      aspect: "1.91:1",
      crop: "center-cover",
      safe_area: "widest crop — loses top/bottom of a tall image; keep subject vertically centred",
    },
    {
      surface: 'in-app "What\'s New" sidebar',
      frame: "114×80",
      aspect: "1.425:1",
      crop: "center-cover",
      safe_area: "narrowest crop — loses the sides of a wide image; keep subject horizontally centred",
    },
  ],
  "in-app-mobile": [
    {
      surface: "website news post body (inline)",
      frame: "full width, max ~1280 wide",
      aspect: "any (authored)",
      crop: "contain",
      safe_area: "letterboxed, never cropped — any aspect is safe",
    },
  ],
  "feature-detail": [
    {
      surface: "website news post body (inline)",
      frame: "full width, max ~1280 wide",
      aspect: "any (authored)",
      crop: "contain",
      safe_area: "letterboxed, never cropped — tight crop on the UI element itself",
    },
  ],
};

/**
 * Scene templates per kind. `{subject}` is filled from the card; the rest is the
 * standing, reusable instruction so the same kinds of images come back every
 * launch. Brand background/palette is deliberately a slot (read from
 * brand-factory once Infinex is `voiced`), not hard-coded here.
 */
export const KIND_TEMPLATES: Record<ImageBriefKind, string> = {
  hero: "Brand cover for the launch: {subject}, presented on an Infinex-branded background. Landscape, authored at ~1.71:1. This single image is reused across the website news card, the X thread, and the in-app sidebar — keep the focal subject centred.",
  "in-app-mobile": "The feature in use: {subject} running in the Infinex mobile app, composited on an Infinex-branded background. A product-proof shot — show the real screen, not a mock.",
  "feature-detail": "A tight close-up on the specific UI that shipped: {subject}. Crop in on the element itself (the new control / number / flow) so a reader sees exactly what's new.",
};

/** Brand background/style is brand-factory's call; stubbed until Infinex is `voiced`. */
export const BRAND_BACKGROUND_STUB =
  "TODO: Infinex brand background/palette — read from brand-factory's locked spec once Infinex is at `voiced` status. Until then: Infinex-branded background, designer's discretion.";
