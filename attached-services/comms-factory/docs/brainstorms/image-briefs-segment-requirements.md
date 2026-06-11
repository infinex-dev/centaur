# Image Briefs Segment — Requirements

**Date:** 2026-06-10
**Status:** Requirements (brainstorm output, pre-plan)
**Related:** `research/surface-image-crop-grounding-2026-06-10.md`, `docs/solutions/workflow-issues/postmortem-launch-day-2026-06-09.md`

## Problem

Comms-factory produces validated copy for every surface (X-thread, web, in-product, mobile, blog, carousel) but produces **nothing for the images** those surfaces need. Images get commissioned ad-hoc, off-pipeline. The launch-day failures that follow:

1. **Wrong crop ships** — no one specified the per-surface frame, so a cover authored for one surface gets center-cropped wrong on another (the bank-deposits X-thread image; see crop grounding doc).
2. **On-image words are unguarded** — text on a hero image never passes the voice/slop pipeline the rest of the copy does.
3. **Every launch reinvents** what images to even make.

## Goal

A new output segment — **Image Briefs** — emitted per launch alongside the copy channels. Per launch it produces ~3 structured art-direction briefs (one per standing image kind), each carrying: what the image depicts (grounded in the launch's real facts), the per-surface crop spec it must satisfy, and the validated on-image text. **The brief is the deliverable**; a human designer (or a later image-gen step) makes the pixels.

## Decisions locked (this brainstorm)

- **Artifact class — distinct from copy channels.** It is NOT a "channel" in the channel-profile sense (it carries no length / reader-context / CTA register). It's an art-direction artifact. Surfaced in the harness as a sibling segment alongside the channels, but modeled as its own type.
- **Output — brief only (v1).** No pixel generation. Image-gen (gemini-imagegen / Nano Banana Pro / Higgsfield) is an explicitly deferred phase-2, out of scope now.
- **Standing image kinds (the reusable templates), 3 by default:**
  1. **Hero / cover** — brand cover image. Lands on the changelog header, gets center-cropped into the news card, and is reused as the X-thread attached media.
  2. **In-app mobile shot** — the feature running in the mobile app, composited on an Infinex background.
  3. **Feature-detail / UI close-up** — tight crop on the specific UI element that shipped.
  Operator can add/drop per launch (e.g. a bespoke X-thread image); 3 is the default, not a hard cap.
- **On-image text — first-class copy.** Generated on-voice and run through the slop validator like any caption. The brief carries the *approved* line (or an explicit "no text"), never a raw unguarded string.
- **Crop specs embedded.** Each brief embeds the grounded per-surface frame + safe-area from the crop grounding doc — e.g. hero authored at ~1.71:1 with subject inside the center ~83%×89% box. This is the direct completion of today's grounding work.

## Brief template structure (per image)

Each brief is a filled template with fixed slots:

- **kind** — `hero` | `in-app-mobile` | `feature-detail`
- **scene** — templatized description with launch-specific slots filled from grounded facts (e.g. "in-app mobile showing `{feature}` on an Infinex background")
- **subject** — the concrete shipped thing depicted (feature / UI), grounded
- **background / style** — brand-locked; read from brand-factory's locked spec, NOT decided here
- **on_image_text** — `{ line: <validated copy>, validatorResult }`; may be empty
- **dimensions + safe_area** — per intended surface, from the crop grounding
- **reference notes** — optional operator/designer pointers

## Grounding

Briefs ground on the **same launch facts as the copy** (the `ReleaseCard` / grounder output). The in-app and feature-detail scenes must describe the *actual* shipped feature, not a guess. Reuses the grounder — no new fact source.

## Relationship to the existing pipeline

- **Reuses:** grounder (facts); generator + validator (for the on-image text only).
- **New:** the brief artifact type; the standing-kind templates; the crop-spec embedding; the harness segment surface.
- **Does NOT:** decide visual specs (palette / type / background are brand-factory's); generate pixels (v1); become a copy-channel; add a Remotion template family.

## Non-goals (v1)

- Image generation (pixels) — deferred phase-2.
- Bespoke per-launch kinds beyond add/drop of the 3 standing ones.
- Deciding brand visual specs (owned by brand-factory).

## Success criteria

- On the next launch the segment emits 3 briefs (hero, in-app, feature-detail), each with: a grounded scene, the correct per-surface dimensions/safe-area, and a validated on-image line (or explicit "no text").
- A designer can execute any brief **without follow-up questions**.
- The same templates produce structurally identical briefs launch-over-launch — consistency is the point.
- No on-image line ships that fails the slop validator.

## Open questions for planning

- Exact harness surface (new tab vs section in the emission view) and whether briefs persist as a new artifact in the harness DB or render from the card.
- How the brief references brand background/style tokens (path into brand-factory's locked spec).
- Phase-2 image-gen interface (if/when) — which generator, and whether drafts attach to the brief for ship-gate review.
