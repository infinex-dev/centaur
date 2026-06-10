/**
 * Programmatic Remotion renderer.
 *
 * Takes a release card + a Pick (the orchestrator's chosen caption) + a brand
 * slug, and renders mp4 + poster png to disk.
 *
 * Pipeline contract: release card -> generator -> orchestrator -> renderer (this).
 *
 * Brand tokens come from src/brand-stub.ts (stub until brand-factory ships).
 * Composition selection routes by card.kind:
 *   - data-card-official → DataCardOfficial composition (built)
 *   - data-card-wry / launch-tier / split → TODO (return error)
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { copyFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReleaseCard } from "../card.js";
import { getBrandTokens } from "../brand-stub.js";

export interface RenderOptions {
  card: ReleaseCard;
  caption: string; // the orchestrator's Pick text
  brandSlug: string; // "infinex" | "cream" | "projectjin" | "nigel"
  outDir: string; // where to write final.mp4 + poster.png
  composition?: "data-card-official"; // only one wired so far
  poster?: boolean; // also render still poster.png (default true)
  backgroundImagePath?: string; // absolute path to a product screenshot; will be served via Remotion staticFile
}

export interface RenderResult {
  mp4Path: string;
  posterPath?: string;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the Remotion entry — Root.tsx exports the composition registry.
const ENTRY_POINT = pathResolve(__dirname, "Root.tsx");

// Bundle is cached per public-dir to avoid re-bundling between renders that
// share the same static assets. Different bg images → different cache key.
const bundleCache: Map<string, string> = new Map();

// Project-local public dir for Remotion staticFile() lookups.
// Stable brand assets live under public/brand-assets/ (git-tracked); ephemeral
// per-render bg images get copied into public/_bg/ at render time.
const PUBLIC_DIR = pathResolve(__dirname, "../../public");
const BG_SUBDIR = "_bg";

async function getBundleUrl(publicDirKey: string): Promise<string> {
  const cached = bundleCache.get(publicDirKey);
  if (cached) return cached;
  const bundleLocation = await bundle(ENTRY_POINT, () => undefined, {
    publicDir: PUBLIC_DIR,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          ".js": [".js", ".tsx", ".ts"],
        },
      },
    }),
  });
  bundleCache.set(publicDirKey, bundleLocation);
  return bundleLocation;
}

export async function render(opts: RenderOptions): Promise<RenderResult> {
  const compId = opts.composition ?? "data-card-official";
  if (compId !== "data-card-official") {
    throw new Error(`composition "${compId}" not yet built; only data-card-official is wired`);
  }

  const tokens = getBrandTokens(opts.brandSlug);
  const { headline, metric, metricLabel } = resolveCardSlots(opts.card);

  // If background image provided, copy it into Remotion's public dir so
  // staticFile() can find it. Land under public/_bg/ to keep ephemeral
  // renders out of the git-tracked brand-assets tree.
  let bgRelPath: string | undefined;
  if (opts.backgroundImagePath) {
    const bgDir = pathResolve(PUBLIC_DIR, BG_SUBDIR);
    mkdirSync(bgDir, { recursive: true });
    const bgFilename = basename(opts.backgroundImagePath);
    const dest = pathResolve(bgDir, bgFilename);
    copyFileSync(opts.backgroundImagePath, dest);
    bgRelPath = `${BG_SUBDIR}/${bgFilename}`;
  }

  const inputProps = {
    headline,
    ...(metric !== undefined ? { metric } : {}),
    ...(metricLabel !== undefined ? { metric_label: metricLabel } : {}),
    caption: opts.caption,
    ...(bgRelPath !== undefined ? { background_image_path: bgRelPath } : {}),
    brand: tokens,
  };

  mkdirSync(opts.outDir, { recursive: true });

  const bundleUrl = await getBundleUrl(bgRelPath ?? "_nobg");
  const composition = await selectComposition({
    serveUrl: bundleUrl,
    id: compId,
    inputProps,
  });

  const mp4Path = pathResolve(opts.outDir, "final.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleUrl,
    codec: "h264",
    outputLocation: mp4Path,
    inputProps,
  });

  let posterPath: string | undefined;
  if (opts.poster !== false) {
    posterPath = pathResolve(opts.outDir, "poster.png");
    await renderStill({
      composition,
      serveUrl: bundleUrl,
      output: posterPath,
      inputProps,
      // Capture at the hold midpoint — past the entry animation, before exit.
      frame: Math.floor(tokens.motion.enter_duration_frames + tokens.motion.hold_duration_frames / 2),
    });
  }

  return {
    mp4Path,
    ...(posterPath !== undefined ? { posterPath } : {}),
    durationFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
  };
}

/**
 * Map ReleaseCard fields → composition slots (headline, metric, metricLabel)
 * based on card.kind. Each kind has different load-bearing fields per
 * `src/card.ts`.
 */
function resolveCardSlots(card: ReleaseCard): { headline: string; metric?: string; metricLabel?: string } {
  switch (card.kind) {
    case "data-card-official":
    case "data-card-wry": {
      const value = String(card.value);
      const unit = card.unit ?? "";
      return {
        headline: card.title,
        metric: `${value}${unit}`,
        metricLabel: card.metric,
      };
    }
    case "launch-tier":
      return { headline: card.headline };
    case "split":
      return { headline: `${card.from} → ${card.to}` };
  }
}
