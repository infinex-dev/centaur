---
title: "feat: Image Briefs / art-direction segment"
type: feat
status: active
date: 2026-06-10
origin: docs/brainstorms/image-briefs-segment-requirements.md
---

# feat: Image Briefs / art-direction segment

## Overview

Add a new output artifact — **Image Briefs** — emitted per launch alongside the copy channels. Per launch the system produces ~3 structured art-direction briefs (kinds: `hero`, `in-app-mobile`, `feature-detail`), each carrying a grounded scene description, per-surface crop specs (from the launch-day grounding work), and a validated on-image text line. The brief is the deliverable; a human designer (or a later image-gen phase) makes the pixels.

This is a **sibling** to the 7-channel copy pipeline, not a new channel. It shares the grounder's facts and the validator's slop rules, but has its own builder, persistence, and harness surface.

## Problem Frame

comms-factory produces validated copy for every surface but **nothing for the images** those surfaces need. Images are commissioned ad-hoc, off-pipeline — which on launch day produced: wrong crops (no per-surface frame specified — see `research/surface-image-crop-grounding-2026-06-10.md`), unguarded on-image words, and per-launch reinvention of what images to make. (See origin: `docs/brainstorms/image-briefs-segment-requirements.md`.)

## Requirements Trace

- R1. Per launch, emit ~3 briefs for the standing kinds `hero` / `in-app-mobile` / `feature-detail` (operator may add/drop; 3 is default, not a cap).
- R2. Each brief is a filled template (consistent structure launch-over-launch): `kind`, `scene`, `subject`, `background/style`, `on_image_text`, `dimensions + safe_area`, `reference_notes`.
- R3. On-image text is first-class copy — generated on-voice and run through the slop validator; the brief carries the approved line (or explicit "no text").
- R4. Each brief embeds the grounded per-surface crop spec + safe-area from `research/surface-image-crop-grounding-2026-06-10.md`.
- R5. Briefs ground on the same launch facts as copy (reuse the grounder; no new fact source).
- R6. Surfaced in the harness as a sibling segment; a designer can execute a brief without follow-up questions.
- R7. No on-image line ships that fails the slop validator.

## Scope Boundaries

- **No pixel generation in v1.** Image-gen (gemini-imagegen / Nano Banana Pro / Higgsfield) is deferred phase-2.
- Briefs do **not** become a copy-channel and do **not** enter the 7-channel orchestration loop.
- comms-factory does **not** decide brand visual specs (palette/type/background) — those are brand-factory's, read once Infinex is `voiced`.
- No new Remotion template family.

## Context & Research

### Relevant Code and Patterns

- **StructuredOutput + Channel** — `src/generator.ts:110` (`Channel`), `:121-124` (`StructuredOutput` union: `web-card` | `carousel` | `thread`), `:127` (`STRUCTURED_CHANNELS`). Image-brief is a **separate** top-level type, NOT a member of `StructuredOutput`.
- **ReleaseCard** — `src/card.ts:156-171` (discriminated union over `kind`); base fields incl. `deployed_facts`, `product_page_url`, inner-work fields (`src/card.ts:51-118`). Cards carry no per-asset fields; assets are computed downstream. Briefs hang off the card in a new harness table, not in the card schema.
- **Generator** — per-channel config `CHANNEL_GENERATION_PROFILES` (`src/generator.ts:263-307`); `generateForChannels()` computes InnerWork once then fans Stage B (`src/generator.ts:386`). On-image text reuses this infrastructure as short copy.
- **Validator** — `validate()` (`src/validator.ts:1010`) runs the slop rule set; `containsUrl`/`x-opening-link` just landed. On-image text validates through `validate()`.
- **Orchestrator** — channel loop `src/orchestrator.ts:153`; picks one-per-channel. Briefs get a **parallel** step, not a channel iteration.
- **Harness UI** — channel tabs `harness/app/cards/[id]/page.tsx:39-47` (`CHANNEL_LABEL`); review tabs `harness/components/design/PackageTabs.tsx:60-66`; surface preview already renders crop frames (`harness/components/design/SurfacePreview.tsx`).
- **Harness DB** — `harness/lib/schema.sql` (`candidates` `:243-259` carries `structured_json`; `final_picks` `:364-374`). Migration pattern: `harness/lib/db.ts` `addColumnIfMissing()`.
- **Grounder** — `src/fact-grounder-llm.ts:59-77` (`VerifiedFact { category, claim, value, source, source_ref, confidence }`, `FactGroundingResult`). Briefs filter existing facts; no grounder change.

### Institutional Learnings

- `docs/solutions/workflow-issues/postmortem-launch-day-2026-06-09.md` — the crop bug this segment closes; the brief's crop-spec preview reuses the same per-surface frames the post-mortem proposed.
- Memory `channel-profiles-situation-not-register` — do not stamp voice/tempo onto a surface; the brief's scene/crop fields are situational, not register. On-image text is the only voiced field.
- Memory `voice-spec-laban-pure` — keep brand vocab out of the spine; brand background is a downstream token, stubbed here.

### External References

- None needed — all patterns exist locally (grounder, generator, validator, harness surfaces). External research skipped.

## Key Technical Decisions

- **Sibling artifact, not a channel** (Rationale: keeps the 7-channel emission clean; briefs ship to a designer, never auto-post; they have no length/CTA register).
- **New `image_briefs` table; on-image text reuses `candidates`** (Rationale: a brief is per-(card, kind), not per-channel, so `final_picks` doesn't fit; but on-image text IS real copy, so it lives as a `candidates` row and validates identically — `on_image_text_candidate_id` FK).
- **Scene = template + fact-fill (deterministic); on-image text = generated + validated** (Rationale: the scene's value is consistency, so it's a fixed template with launch slots filled from grounded facts; only the words are voiced copy needing generation + the slop gate).
- **Crop specs are data, sourced from the grounding doc** (Rationale: numbers are already grounded; encode them as a constant keyed by kind→surface so the brief and the harness preview read one source of truth).
- **Brand background is a stub until `voiced`** (Rationale: hard constraint in CLAUDE.md; v1 brief is fully useful with a brand-agnostic scene + locked crop specs; background/palette is the one field gated on brand-factory).

## Open Questions

### Resolved During Planning

- **Harness surface?** → A sibling "Image Briefs" tab in `PackageTabs.tsx` rendering a brief-card grid (one card per kind), NOT a per-channel layout. *(default — flagged)*
- **Persistence?** → New `image_briefs` table (UNIQUE `card_id, kind`); on-image text persisted as a `candidates` row referenced by FK. *(default — flagged)*
- **Brand-token path?** → `background.style` carries a `"TODO: awaiting brand-factory voiced status"` stub; once voiced, read tokens from brand-factory's locked spec. v1 ships without it. *(default — flagged)*
- **How many kinds?** → 3 standing kinds by default, operator can add/drop. Generation iterates a `STANDING_BRIEF_KINDS` list so adding a 4th (e.g. bespoke X image) is a one-line change.

### Deferred to Implementation

- Exact `ImageBrief` field names and the on-image-text generation prompt — settle against real generator signatures in `ce:work`.
- Whether on-image text validates with `channel: "x"`-style context or a dedicated brief context — decide when wiring `validate()` (the rule set is channel-agnostic except the new `x-opening-link`, which should NOT apply to on-image text).
- Whether the scene fact-fill needs an LLM pass for phrasing or pure string templating suffices — discover when filling the first real card.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
ReleaseCard + FactGroundingResult
        │
        ▼
buildImageBriefs(card, facts)               ← src/brief-generator.ts (sibling to generateForChannels)
        │   for each kind in STANDING_BRIEF_KINDS:
        │     scene    = fillTemplate(KIND_TEMPLATES[kind], factsFor(card, facts))   // deterministic
        │     subject  = pick grounded subject (feature/UI) from facts
        │     onImage  = generate short line  ──► validate()  ──► {line | "no text", validatorResult}
        │     crop     = CROP_SPECS[kind]      // from surface-image-crop-grounding-2026-06-10.md
        │     background = BRAND_STUB          // TODO until voiced
        ▼
ImageBrief[]  ──► persist (image_briefs table; on-image text as a candidates row)
        ▼
Harness "Image Briefs" tab ──► brief cards (scene, subject, on-image line, crop-frame preview per surface)
        ▼
Designer executes brief  (pixels = out of scope v1)
```

Directional type shape (names to finalize in `ce:work`):

```
type ImageBriefKind = "hero" | "in-app-mobile" | "feature-detail"
type CropSpec   = { surface: string; width: number; height: number; aspect: string; safeArea: string }
type OnImageText = { line: string | null; validation: ValidationResult | null }
type ImageBrief = {
  kind: ImageBriefKind
  scene: string            // template filled from grounded facts
  subject: string          // grounded shipped thing
  background: string       // BRAND_STUB until voiced
  onImageText: OnImageText
  cropSpecs: CropSpec[]
  referenceNotes?: string
}
```

## Implementation Units

- [ ] **Unit 1: Brief domain types + standing-kind templates + crop-spec constants**

**Goal:** The vocabulary every other unit imports: kinds, the `ImageBrief` shape, the 3 standing-kind scene templates, and the crop-spec table sourced from the grounding doc.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Create: `src/brief.ts`
- Create: `src/__tests__/brief.test.ts`

**Approach:**
- Define `ImageBriefKind`, `ImageBrief`, `CropSpec`, `OnImageText` (Zod schema + inferred type, mirroring `src/card.ts` style).
- `STANDING_BRIEF_KINDS: ImageBriefKind[] = ["hero", "in-app-mobile", "feature-detail"]`.
- `KIND_TEMPLATES` — per kind, a scene template string with `{slot}` placeholders (e.g. hero: brand cover; in-app-mobile: "the {feature} running in the mobile app on an Infinex background"; feature-detail: "tight crop on {ui_element}").
- `CROP_SPECS: Record<ImageBriefKind, CropSpec[]>` — encode the grounded numbers (hero authored ~1.71:1, subject center ~83%×89%; in-app/feature-detail per their surfaces). One source of truth, re-used by the harness preview.

**Patterns to follow:** `src/card.ts` (Zod discriminated schema + exported type); the crop numbers in `research/surface-image-crop-grounding-2026-06-10.md`.

**Test scenarios:**
- Happy path: `ImageBrief` schema parses a fully-populated brief for each kind.
- Edge case: `on_image_text.line = null` ("no text") parses and is valid.
- Happy path: `CROP_SPECS` has an entry for every kind in `STANDING_BRIEF_KINDS`, and hero's authored aspect is ~1.71:1 (guards against the grounding numbers drifting silently).
- Edge case: a `KIND_TEMPLATES` entry with an unfilled `{slot}` is detectable (template fill leaves no stray braces).

**Verification:** Types compile; `brief.test.ts` green; crop constants match the grounding doc.

- [ ] **Unit 2: Brief builder (`buildImageBriefs`) — scene fill + grounded subject + crop attach**

**Goal:** Turn a `ReleaseCard` + `FactGroundingResult` into `ImageBrief[]` with scene, subject, background stub, and crop specs filled — everything except the generated on-image text (Unit 3).

**Requirements:** R1, R2, R4, R5

**Dependencies:** Unit 1

**Files:**
- Create: `src/brief-generator.ts`
- Create: `src/__tests__/brief-generator.test.ts`

**Approach:**
- `buildImageBriefs(card, facts)` iterates `STANDING_BRIEF_KINDS`.
- Fill the scene template from grounded facts (`VerifiedFact.claim`/`value`) + card title; choose the `subject` from the highest-confidence capability/product fact.
- Attach `CROP_SPECS[kind]`; set `background` to the brand stub constant.
- Leave `onImageText` as a placeholder to be filled by Unit 3 (or accept an injected text fn for testability).

**Execution note:** Execution target: external-delegate (mechanical builder code; Codex per the work-split convention).

**Patterns to follow:** `generateForChannels()` fan-out shape (`src/generator.ts:386`); grounder fact filtering against `VerifiedFact` (`src/fact-grounder-llm.ts:59-77`).

**Test scenarios:**
- Happy path: a card + facts produces exactly 3 briefs, kinds in order, each with crop specs and a filled scene (no stray `{slot}`).
- Edge case: facts lacking a clear subject → subject falls back to the card title, never empty.
- Edge case: empty/low-confidence facts → builder still returns 3 briefs (degrade, don't throw) with a flagged thin subject.
- Integration: scene slots are filled from the actual grounded fact values, not placeholders (assert a known fact value appears in the scene).

**Verification:** `buildImageBriefs` returns 3 well-formed briefs for a representative card; tests green.

- [ ] **Unit 3: On-image text generation + validation**

**Goal:** Generate the on-image line as voiced short copy and run it through the slop validator; attach the approved line (or explicit "no text") + the `ValidationResult` to each brief.

**Requirements:** R3, R7

**Dependencies:** Unit 2

**Files:**
- Modify: `src/brief-generator.ts`
- Modify: `src/__tests__/brief-generator.test.ts`
- (Possibly) Modify: `src/generator.ts` (expose a short-copy generation entry if not already reusable)

**Approach:**
- For each brief, generate a short on-image line (≤ a tight char budget) reusing the generator's voiced-copy path; some kinds may legitimately produce "no text".
- Validate the line via `validate()` with the brand-agnostic slop rules; the new `x-opening-link` rule must NOT apply here (on-image text isn't an X post) — pass no `channel: "x"` context.
- Reject + regenerate (bounded, mirror the existing feedback-wave cap of 3) on validator failure; if still failing, surface the failure on the brief rather than silently shipping.

**Execution note:** Start with a failing test asserting a cliché on-image line is rejected (R7), then implement.

**Patterns to follow:** the generator→validator feedback wave (memory `emission-architecture-vertical-flow-feedback-wave`, cap 3); `validate()` usage in `src/actor-orchestrator.ts:608`.

**Test scenarios:**
- Happy path: a clean line passes and is attached with `validation.passed = true`.
- Error path: a line containing a cliché ("game-changer") fails validation and does not become the final line.
- Edge case: a kind that yields "no text" stores `line: null` with no validation failure.
- Edge case: a line containing a real link is NOT auto-failed by `x-opening-link` (on-image text is not an X post) — but IS still subject to the URL-not-in-facts rule.
- Integration: build → generate → validate round-trip leaves every brief with either a passing line or `null`, never an unvalidated string.

**Verification:** No brief ships an unvalidated or slop-failing line; tests green.

- [ ] **Unit 4: Harness persistence — `image_briefs` table + queries**

**Goal:** Persist briefs per card, reusing `candidates` for on-image text; expose read/write queries.

**Requirements:** R2, R3, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `harness/lib/schema.sql`
- Modify: `harness/lib/db.ts` (migration via `addColumnIfMissing`/table-create pattern)
- Modify: `harness/lib/queries.ts`
- Create: `harness/lib/image-briefs.test.ts`

**Approach:**
- `image_briefs` table: `id`, `card_id` FK, `kind` (CHECK in the 3 kinds), `brief_json`, `on_image_text_candidate_id` FK→candidates (nullable), `created_at`. `UNIQUE(card_id, kind)`.
- Queries: `getImageBriefs(cardId)`, `saveImageBrief(brief)` (upsert on `card_id,kind`).
- On-image text stored as a `candidates` row (channel sentinel e.g. `image-brief:<kind>` or a dedicated column) so it carries `validation_passed`/`validation_failures_json` like any candidate.

**Patterns to follow:** `candidates`/`final_picks` DDL (`harness/lib/schema.sql:243-374`); existing query helpers in `harness/lib/queries.ts`.

**Test scenarios:**
- Happy path: save 3 briefs for a card → `getImageBriefs` returns 3 in kind order.
- Edge case: re-saving the same `(card_id, kind)` upserts (no duplicate row).
- Edge case: a brief with `on_image_text_candidate_id = null` round-trips.
- Integration: on-image text candidate row is retrievable with its validation result via the FK.

**Verification:** Round-trip persistence works; migration applies cleanly to an existing harness DB.

- [ ] **Unit 5: Harness action — generate + persist briefs, wired into emission**

**Goal:** A server action that builds + persists briefs for a card, callable from the harness emission flow.

**Requirements:** R1, R3, R5, R6

**Dependencies:** Units 2, 3, 4

**Files:**
- Create: `harness/app/actions/image-briefs.ts`
- Modify: `harness/lib/emit-process.ts` (invoke brief build alongside channel emission, using the already-grounded facts)
- Create: `harness/lib/image-briefs-action.test.ts`

**Approach:**
- Reuse the card's existing `FactGroundingResult` (do not re-ground) → `buildImageBriefs` → on-image generation/validation → `saveImageBrief`.
- Runs after/parallel to channel generation; failure to build briefs must not block copy emission (briefs are additive).

**Execution note:** Execution target: external-delegate.

**Patterns to follow:** `harness/app/actions/generate.ts` / `emit.ts`; the emission flow in `harness/lib/emit-process.ts`.

**Test scenarios:**
- Happy path: action on a grounded card persists 3 briefs.
- Error path: a brief-build error is caught and surfaced; channel picks still persist.
- Integration: action reuses the existing grounder facts (asserts no second grounder call).

**Verification:** Triggering emission yields 3 persisted briefs without disturbing the copy channels.

- [ ] **Unit 6: Harness UI — "Image Briefs" sibling segment + brief cards with crop preview**

**Goal:** A sibling tab rendering one card per brief kind: scene, subject, on-image line (with validation state), and a per-surface crop-frame preview.

**Requirements:** R2, R4, R6

**Dependencies:** Units 4, 5

**Files:**
- Modify: `harness/components/design/PackageTabs.tsx` (add `briefs` tab)
- Modify: `harness/app/cards/[id]/page.tsx` (fetch briefs, build view model)
- Create: `harness/components/design/ImageBriefCard.tsx`
- Create: `harness/components/design/ImageBriefCard.test.tsx` (or a render/unit test)

**Approach:**
- New tab at the Package level rendering a grid of `ImageBriefCard`s.
- Each card shows scene + subject + on-image line (+ a slop-fail badge if it failed), and reuses `SurfacePreview.tsx`'s crop-frame rendering to show how the intended image crops on each surface (the post-mortem's "see the crop before ship" idea, now per-brief).
- Read-only v1 (no pixel upload here; upload already exists elsewhere). Operator can edit the on-image line via the existing edit affordance pattern if cheap.

**Execution note:** Visual pass — candidate for the Claude Code Design step per the work-split convention (memory `work-split-convention-multi-agent`).

**Patterns to follow:** `PackageTabs.tsx:60-66` tab list; `harness/app/cards/[id]/page.tsx:39-47,130-132` channel VM; `SurfacePreview.tsx` crop frames.

**Test scenarios:**
- Happy path: a card with 3 briefs renders 3 brief cards under the new tab.
- Edge case: a brief with `line: null` renders a clear "no on-image text" state, not an empty box.
- Edge case: a brief whose on-image line failed validation shows the failure badge.
- Test expectation: crop-preview geometry is covered by `SurfacePreview`'s own tests; this unit asserts the right specs are passed in.

**Verification:** The Image Briefs tab shows 3 faithful brief cards with crop previews for a real card.

## System-Wide Impact

- **Interaction graph:** New `buildImageBriefs` consumes grounder facts + card; hooks into `emit-process.ts` after channel generation. No change to the channel orchestration loop.
- **Error propagation:** Brief-build failures are isolated — they surface on the brief/segment but never block copy emission (briefs are additive, Unit 5).
- **State lifecycle risks:** `image_briefs` upsert keyed on `(card_id, kind)`; re-emitting a card replaces briefs idempotently. On-image text candidate rows should be cleaned/replaced on re-gen to avoid orphans.
- **API surface parity:** On-image text validates through the same `validate()` as all copy — parity preserved; the new `x-opening-link` rule is explicitly excluded for on-image text.
- **Unchanged invariants:** `StructuredOutput`, `Channel`, the 7-channel orchestration, `final_picks`, and the ship gate are untouched. Briefs are orthogonal and never auto-post.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Brand not `voiced` → background/style undefined | Stub the field; v1 brief is useful with brand-agnostic scene + locked crop specs. Background is the only blocker for phase-2 pixels. |
| Crop numbers drift from the grounding doc | Encode once in `CROP_SPECS` (Unit 1) with a test asserting hero ~1.71:1; harness preview reads the same constant. |
| On-image text generation over-fires "no text" or slop | Bounded regen (cap 3) + surface failures rather than ship; test the cliché-rejection path. |
| Scope creep into pixel generation | Phase-2 is an explicit non-goal; the artifact ends at the brief. |
| Briefs muddy the copy pipeline | Kept a sibling: separate type, table, action, and tab — no channel-loop entry. |

## Documentation / Operational Notes

- Update `CLAUDE.md` Status/Pending once landed (image-briefs segment added; phase-2 pixel-gen still pending brand `voiced`).
- The crop-spec constant should cite `research/surface-image-crop-grounding-2026-06-10.md` as its source.

## Sources & References

- **Origin document:** `docs/brainstorms/image-briefs-segment-requirements.md`
- Crop grounding: `research/surface-image-crop-grounding-2026-06-10.md`
- Post-mortem (crop bug this closes): `docs/solutions/workflow-issues/postmortem-launch-day-2026-06-09.md`
- Key code: `src/generator.ts:110-127`, `src/card.ts:156-171`, `src/orchestrator.ts:153`, `src/fact-grounder-llm.ts:59-77`, `harness/lib/schema.sql:243-374`, `harness/components/design/PackageTabs.tsx:60-66`, `harness/app/cards/[id]/page.tsx:39-47`
- Work-split convention: memory `work-split-convention-multi-agent`
