/**
 * Brand tokens — STUB.
 *
 * Per CLAUDE.md: "Don't render before brand-locked. Remotion compositions read
 * from brand-factory's locked spec; until Infinex is at `voiced`, the renderer
 * stays as a TODO stub."
 *
 * This file is the BRIDGE. It exposes a brand-tokens shape that mirrors what
 * brand-factory's eventual `BRAND.md` / `04-identity/locked/` output will
 * provide. Templates read FROM HERE, not from brand-factory directly. When
 * brand-factory ships Infinex at `voiced`, swap the STUB implementation for a
 * loader that reads from brand-factory/brands/<brand>/. Single file to swap.
 *
 * Composition templates MUST read tokens from `getBrandTokens(brand)` — never
 * hardcode hex values or font names. The whole point of the abstraction is
 * that a render is brand-agnostic at the template layer; only the tokens
 * change per brand.
 */

export interface TempoSignature {
  duration_ms: number;
  easing: string; // cubic-bezier string
  weight_in: number; // font-weight at entry
  weight_out: number; // font-weight at hold
  blur_in_px: number;
  translate_in_px: number;
  opacity_curve: string; // semantic curve name (slow-rise | cut | analytic | lift | warm-in)
  hold_ms: number;
  description: string;
}

export interface BrandTokens {
  name: string; // canonical brand name
  handle: string; // X handle, e.g. "@infinex"
  palette: {
    accent: string; // primary brand color (hex)
    bg: string; // background
    text: string; // primary text
    muted: string; // secondary / chrome text
    divider: string; // borders / dividers
  };
  type: {
    headline_family: string; // CSS font-family, e.g. "Inter Variable, system-ui, sans-serif"
    body_family: string;
    mono_family: string;
  };
  motion: {
    // Animation timing primitives. Renderer uses these as the global beat.
    enter_duration_frames: number; // entry animation length
    hold_duration_frames: number; // beat hold before next move
    exit_duration_frames: number;
    fps: number;
    // Per-tempo motion signatures. Optional — only populated for brands whose
    // Laban placement is locked. A composition selects a signature by name
    // (sombre | commanding | practical | irradiant | sociable for Infinex).
    // Sustained-prep → Quick-release shape is encoded in the prep+release
    // duration_ms / easing / weight / blur / opacity_curve fields.
    tempo_signatures?: Record<string, TempoSignature>;
  };
  geometry: {
    // For the data-card-official format. SQUARE 1080x1080 is the X video
    // default that doesn't get cropped to vertical in-feed.
    width: number;
    height: number;
    safe_area_margin: number; // px from edge
  };
  logo_lockup?: {
    // Optional. If present, renderer can place the mark in the card.
    svg_path?: string; // path under brand-stub-assets/
    wordmark_text?: string; // text-only fallback
  };
}

// -- Stub implementations -----------------------------------------------------

const INFINEX_TOKENS: BrandTokens = {
  name: "Infinex",
  handle: "@infinex",
  palette: {
    // The three official foundation colors per Infinex Brand Guidelines (Oct 2025):
    //   Cantaloup #FE6F39, Black #101114, White #ECEEF1.
    accent: "#FE6F39",
    bg: "#101114",
    text: "#ECEEF1",
    muted: "#9ba0a6",
    divider: "rgba(236,238,241,0.08)",
  },
  type: {
    headline_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    body_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    mono_family: "ui-monospace, SF Mono, monospace",
  },
  motion: {
    // Global beat. Compositions that don't reference tempo_signatures still work.
    enter_duration_frames: 24, // 0.8s at 30fps
    hold_duration_frames: 90, // 3s hold
    exit_duration_frames: 18,
    fps: 30,
    // 5 locked Infinex tempi — Sustained-prep → Quick-release motor pairs.
    // See memory/infinex-5-tempi-locked.md and infinex-drive-spell-not-passion.md.
    // Generators pick a tempo per beat; compositions read durations + easing here.
    tempo_signatures: {
      sombre: {
        duration_ms: 900,
        easing: "cubic-bezier(.16,1,.3,1)",
        weight_in: 800,
        weight_out: 800,
        blur_in_px: 12,
        translate_in_px: 0,
        opacity_curve: "slow-rise",
        hold_ms: 1400,
        description: "Heavy held weight, slow crossfade. Type lands with mass.",
      },
      commanding: {
        duration_ms: 420,
        easing: "cubic-bezier(.7,0,.3,1)",
        weight_in: 800,
        weight_out: 800,
        blur_in_px: 0,
        translate_in_px: 0,
        opacity_curve: "cut",
        hold_ms: 900,
        description: "Single decisive cut. Block typography. No flourish.",
      },
      practical: {
        duration_ms: 620,
        easing: "cubic-bezier(.4,0,.2,1)",
        weight_in: 600,
        weight_out: 600,
        blur_in_px: 4,
        translate_in_px: 8,
        opacity_curve: "analytic",
        hold_ms: 1100,
        description: "Underlines and reveals. Side-by-side comparison.",
      },
      irradiant: {
        duration_ms: 780,
        easing: "cubic-bezier(.22,.61,.36,1)",
        weight_in: 500,
        weight_out: 500,
        blur_in_px: 8,
        translate_in_px: -16,
        opacity_curve: "lift",
        hold_ms: 1200,
        description: "Upward drift, lighter weight, gentle glow. Future-vision.",
      },
      sociable: {
        duration_ms: 560,
        easing: "cubic-bezier(.4,0,.2,1)",
        weight_in: 600,
        weight_out: 600,
        blur_in_px: 4,
        translate_in_px: 0,
        opacity_curve: "warm-in",
        hold_ms: 1000,
        description: "Mention-pill chrome. Partner credit. Ecosystem warmth.",
      },
    },
  },
  geometry: {
    width: 1080,
    height: 1080,
    safe_area_margin: 60,
  },
  logo_lockup: {
    // Combination mark = icon + INFINEX wordmark. Cantaloup variant for dark bg.
    // Guidelines: minimum clear-space = height of logomark on all sides.
    svg_path: "brand-assets/infinex/logo/infinex-combination-mark.svg",
    wordmark_text: "INFINEX",
  },
};

const CREAM_TOKENS: BrandTokens = {
  name: "Cream of the Crop",
  handle: "@creamofthecrop",
  palette: {
    accent: "#EAB308", // canonical cream-yellow placeholder; swap when locked
    bg: "#0d0e10",
    text: "#fef3c7",
    muted: "#a8a29e",
    divider: "#292524",
  },
  type: {
    headline_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    body_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    mono_family: "ui-monospace, SF Mono, monospace",
  },
  motion: {
    enter_duration_frames: 18, // faster — pert intimacy register
    hold_duration_frames: 70,
    exit_duration_frames: 14,
    fps: 30,
  },
  geometry: { width: 1080, height: 1080, safe_area_margin: 60 },
  logo_lockup: { wordmark_text: "CREAM" },
};

const PROJECTJIN_TOKENS: BrandTokens = {
  name: "ProjectJin",
  handle: "@projectjin",
  palette: {
    accent: "#22c55e", // operational green placeholder
    bg: "#0a0e0a",
    text: "#e7e8ea",
    muted: "#94a3b8",
    divider: "#2a2d33",
  },
  type: {
    headline_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    body_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    mono_family: "ui-monospace, SF Mono, monospace",
  },
  motion: {
    enter_duration_frames: 20, // operational, brisk
    hold_duration_frames: 75,
    exit_duration_frames: 16,
    fps: 30,
  },
  geometry: { width: 1080, height: 1080, safe_area_margin: 60 },
  logo_lockup: { wordmark_text: "PROJECTJIN" },
};

const NIGEL_TOKENS: BrandTokens = {
  name: "Nigel",
  handle: "@nigel",
  palette: {
    accent: "#f97316", // pub-orange placeholder
    bg: "#0d0e10",
    text: "#e7e8ea",
    muted: "#8e9197",
    divider: "#2a2d33",
  },
  type: {
    headline_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    body_family: "Inter Variable, -apple-system, system-ui, sans-serif",
    mono_family: "ui-monospace, SF Mono, monospace",
  },
  motion: {
    enter_duration_frames: 30, // slower — pub-fixture patience
    hold_duration_frames: 105, // longer hold — dispassionate register
    exit_duration_frames: 22,
    fps: 30,
  },
  geometry: { width: 1080, height: 1080, safe_area_margin: 60 },
  logo_lockup: { wordmark_text: "NIGEL" },
};

const STUBS: Record<string, BrandTokens> = {
  infinex: INFINEX_TOKENS,
  "cream-of-the-crop": CREAM_TOKENS,
  cream: CREAM_TOKENS,
  projectjin: PROJECTJIN_TOKENS,
  nigel: NIGEL_TOKENS,
};

/**
 * Get brand tokens for a brand slug.
 *
 * STUB IMPLEMENTATION — returns hardcoded values until brand-factory ships
 * Infinex at `voiced` status. When that happens, replace this body with:
 *
 *   const path = `brand-factory/brands/${slug}/BRAND.md` (or .json)
 *   return loadBrandTokens(path);
 *
 * The signature stays the same. Templates don't change. One-file swap.
 */
export function getBrandTokens(slug: string): BrandTokens {
  const tokens = STUBS[slug.toLowerCase()];
  if (!tokens) {
    throw new Error(
      `brand tokens for "${slug}" not found. Available stubs: ${Object.keys(STUBS).join(", ")}. ` +
        `When brand-factory ships, this lookup will fall through to brand-factory/brands/<slug>/.`,
    );
  }
  return tokens;
}

export const BRAND_TOKENS_ARE_STUB = true;
