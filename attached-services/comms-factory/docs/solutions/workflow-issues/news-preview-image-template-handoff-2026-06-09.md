---
module: harness/news-preview
tags:
  - harness
  - news-preview
  - cloudinary
  - images
  - platform-pr
problem_type: workflow-issue
---

# News preview image template handoff - 2026-06-09

## Context

PR context: https://github.com/infinex-xyz/platform/pull/14754

Today's bank deposit changelog exposed two separate image-slot problems:

1. `coverImage` is metadata/top-of-page art, not a body image. In the harness preview it currently reads like a large article image, which made review confusing. Next time, the cover should appear as a compact top thumbnail/control near the page metadata, similar to a dropdown/header preview. It should not appear in the main article body.
2. The article body image is the `{% cloud-image ... /%}` block. For this launch it should sit directly below `### Fund Infinex from your bank`, before the first paragraph.
3. We do not yet have a concrete image template that reflects the actual rendered web dimensions. That led to a cover asset that was visually too wide for the surface being reviewed.

## Tomorrow's Work

1. Audit the platform article renderer for actual production image treatment:
   - `coverImage` display surface: width, height, object-fit/crop behavior, desktop/mobile treatment.
   - body `{% cloud-image %}` display surface: width, max-width, margins, aspect-ratio behavior, desktop/mobile treatment.

2. Update the harness news preview so slots match production intent:
   - Render `coverImage` as a small top metadata/thumbnail affordance, not as a full article body image.
   - Render body images only from `{% cloud-image %}` blocks, in markdown order.
   - Preserve click-to-replace affordances for both slots.

3. Define reusable image specs for designers/operators:
   - Cover slot target dimensions and safe area.
   - Inline body image target dimensions and safe area.
   - Mobile constraints and any crop rules.

4. Add regression coverage:
   - `news-render` should prove the cover slot is separate from body HTML.
   - preview HTML should place inline image immediately after the requested heading when the markdown does.
   - image-slot metadata should expose width/height expectations once the template spec exists.

## Acceptance Check

For the next changelog run, preview review should answer these without guesswork:

- Which image is the cover/top metadata art?
- Which image appears in the article body?
- What exact size/aspect ratio should each image be created at?
- Does the local preview match the production web layout closely enough to catch "too wide" before opening a platform PR?
