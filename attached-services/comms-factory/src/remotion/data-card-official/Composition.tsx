/**
 * data-card-official — the workhorse release-card composition.
 *
 * Format: SQUARE 1080x1080 (X feed default; doesn't get cropped to vertical).
 * Duration: ~5s total (enter + hold + exit per brand motion tokens).
 *
 * Layout — overlaid on platform screenshot bg:
 *   - Background: optional product screenshot (faded / scrim)
 *   - Top-left: wordmark + accent bar (small, doesn't compete with bg)
 *   - Bottom: caption block (lead beat) with semi-opaque chrome panel
 *   - Bottom-right: handle
 *
 * Without a background image, falls back to pure-color composition (current
 * test renders).
 *
 * Brand-agnostic: reads ALL color / type / motion / geometry from BrandTokens.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { z } from "zod";

export const dataCardOfficialSchema = z.object({
  headline: z.string(),
  metric: z.string().optional(),
  metric_label: z.string().optional(),
  caption: z.string(),
  background_image_path: z.string().optional(), // optional staticFile path
  brand: z.object({
    name: z.string(),
    handle: z.string(),
    palette: z.object({
      accent: z.string(),
      bg: z.string(),
      text: z.string(),
      muted: z.string(),
      divider: z.string(),
    }),
    type: z.object({
      headline_family: z.string(),
      body_family: z.string(),
      mono_family: z.string(),
    }),
    motion: z.object({
      enter_duration_frames: z.number(),
      hold_duration_frames: z.number(),
      exit_duration_frames: z.number(),
      fps: z.number(),
    }),
    geometry: z.object({
      width: z.number(),
      height: z.number(),
      safe_area_margin: z.number(),
    }),
    logo_lockup: z
      .object({
        wordmark_text: z.string().optional(),
        svg_path: z.string().optional(),
      })
      .optional(),
  }),
});

export type DataCardOfficialProps = z.infer<typeof dataCardOfficialSchema>;

export const dataCardOfficialDefaults: DataCardOfficialProps = {
  headline: "Spot Hyperliquid, native in Infinex",
  metric: "100+",
  metric_label: "markets",
  caption: "Today: spot Hyperliquid is live in Infinex. Same account, same passkey, the orderbook where your portfolio already lives.",
  brand: {
    name: "Infinex",
    handle: "@infinex",
    palette: { accent: "#FE6F39", bg: "#101114", text: "#ECEEF1", muted: "#9ba0a6", divider: "rgba(236,238,241,0.08)" },
    type: {
      headline_family: "Inter Variable, -apple-system, system-ui, sans-serif",
      body_family: "Inter Variable, -apple-system, system-ui, sans-serif",
      mono_family: "ui-monospace, SF Mono, monospace",
    },
    motion: { enter_duration_frames: 24, hold_duration_frames: 90, exit_duration_frames: 18, fps: 30 },
    geometry: { width: 1080, height: 1080, safe_area_margin: 60 },
    logo_lockup: {
      svg_path: "brand-assets/infinex/logo/infinex-combination-mark.svg",
      wordmark_text: "INFINEX",
    },
  },
};

export const DataCardOfficial: React.FC<DataCardOfficialProps> = ({
  headline,
  metric,
  metric_label,
  caption,
  background_image_path,
  brand,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, type: typeTokens, motion, geometry, logo_lockup } = brand;
  const margin = geometry.safe_area_margin;

  // Entry: spring-bounce in
  const enterT = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.6 },
    durationInFrames: motion.enter_duration_frames,
  });
  const exitStart = motion.enter_duration_frames + motion.hold_duration_frames;
  const exitT = interpolate(frame, [exitStart, exitStart + motion.exit_duration_frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enterT * (1 - exitT);
  const translateY = (1 - enterT) * 40 - exitT * 30;

  // Caption staggers slightly
  const captionEnterT = spring({
    frame: frame - 8,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.5 },
    durationInFrames: motion.enter_duration_frames,
  });
  const captionOpacity = captionEnterT * (1 - exitT);
  const captionTranslateY = (1 - captionEnterT) * 24 - exitT * 16;

  // Background gentle parallax + Ken Burns
  const bgScale = interpolate(frame, [0, exitStart + motion.exit_duration_frames], [1.05, 1.12]);
  const bgOpacity = interpolate(enterT, [0, 1], [0, 1]) * (1 - exitT * 0.5);

  // Accent bar grows in
  const accentBarWidth = interpolate(enterT, [0, 1], [0, 240]);

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: typeTokens.body_family, overflow: "hidden" }}>
      {/* Background: optional product screenshot with Ken Burns + scrim */}
      {background_image_path ? (
        <>
          <AbsoluteFill style={{ opacity: bgOpacity, transform: `scale(${bgScale})` }}>
            <Img
              src={staticFile(background_image_path)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
          {/* Scrim. Platform-as-protagonist: keep the middle band light so the
              UI reads. Top fade anchors the mark; deep bottom anchors caption. */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, rgba(16,17,20,0.55) 0%, rgba(16,17,20,0.08) 28%, rgba(16,17,20,0.08) 55%, rgba(16,17,20,0.88) 80%, rgba(16,17,20,0.96) 100%)`,
            }}
          />
        </>
      ) : null}

      {/* Top-left: combination mark (or text wordmark fallback) + accent bar */}
      <div
        style={{
          position: "absolute",
          top: margin,
          left: margin,
          opacity,
          transform: `translateY(${translateY * 0.3}px)`,
        }}
      >
        {logo_lockup?.svg_path ? (
          // Combination mark is self-contained brand chrome; no accent bar.
          <Img
            src={staticFile(logo_lockup.svg_path)}
            style={{ height: 40, width: "auto", display: "block" }}
          />
        ) : (
          // Text-wordmark fallback gets the accent bar as a brand-presence cue.
          <>
            <div
              style={{
                fontFamily: typeTokens.mono_family,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: palette.muted,
              }}
            >
              {logo_lockup?.wordmark_text ?? brand.name.toUpperCase()}
            </div>
            <div
              style={{
                marginTop: 12,
                width: accentBarWidth,
                height: 4,
                background: palette.accent,
              }}
            />
          </>
        )}
      </div>

      {/* Bottom block: kicker (metric) + headline + caption + handle. */}
      <div
        style={{
          position: "absolute",
          bottom: margin,
          left: margin,
          right: margin,
          opacity: captionOpacity,
          transform: `translateY(${captionTranslateY}px)`,
        }}
      >
        {/* Metric kicker — mono uppercase, paired with a cantaloup hairline */}
        {metric && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 28,
                height: 2,
                background: palette.accent,
              }}
            />
            <div
              style={{
                fontFamily: typeTokens.mono_family,
                fontSize: 18,
                fontWeight: 600,
                color: palette.text,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {metric}
              {metric_label && (
                <span style={{ color: palette.muted, fontWeight: 500, marginLeft: 10 }}>
                  {metric_label}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Headline */}
        <div
          style={{
            fontFamily: typeTokens.headline_family,
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: palette.text,
            maxWidth: "94%",
          }}
        >
          {headline}
        </div>

        {/* Caption */}
        <div
          style={{
            fontFamily: typeTokens.body_family,
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.4,
            color: palette.muted,
            marginTop: 16,
            maxWidth: "92%",
          }}
        >
          {caption}
        </div>

        {/* Handle + accent dot — bottom-right of caption block */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 22,
          }}
        >
          <div
            style={{
              fontFamily: typeTokens.mono_family,
              fontSize: 18,
              fontWeight: 500,
              color: palette.muted,
              letterSpacing: "0.08em",
            }}
          >
            {brand.handle}
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: palette.accent,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
