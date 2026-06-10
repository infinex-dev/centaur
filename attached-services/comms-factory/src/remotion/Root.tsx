/**
 * Remotion root — registers compositions.
 *
 * Each card kind from `card.ts` maps to a Composition here. The renderer at
 * `src/remotion/render.ts` selects by `card.kind`.
 *
 * Pipeline contract: release card → generator → orchestrator's Pick →
 * renderer (this) → mp4 + poster png.
 *
 * Currently only `data-card-official` is wired. Other card kinds (data-card-wry,
 * launch-tier, split) return TODO from the renderer.
 */
import React from "react";
import { Composition, registerRoot } from "remotion";
import { DataCardOfficial, dataCardOfficialDefaults, dataCardOfficialSchema } from "./data-card-official/Composition.js";
import { getBrandTokens } from "../brand-stub.js";

// Default tokens for the Composition's design-time preview. The renderer
// overrides these per-render via inputProps.
const PREVIEW_BRAND = "infinex";
const previewTokens = getBrandTokens(PREVIEW_BRAND);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="data-card-official"
        component={DataCardOfficial}
        durationInFrames={previewTokens.motion.enter_duration_frames + previewTokens.motion.hold_duration_frames + previewTokens.motion.exit_duration_frames}
        fps={previewTokens.motion.fps}
        width={previewTokens.geometry.width}
        height={previewTokens.geometry.height}
        schema={dataCardOfficialSchema}
        defaultProps={dataCardOfficialDefaults}
      />
    </>
  );
};

registerRoot(RemotionRoot);
