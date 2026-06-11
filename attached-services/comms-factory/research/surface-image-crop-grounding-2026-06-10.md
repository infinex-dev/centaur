# Infinex Surface Image Crop Grounding
**Date**: 2026-06-10  
**Grounded Against**: `origin/main` SHA `4782dafa2f` (platform monorepo)  
**Context**: Faithful image preview frames for comms harness must match platform rendering rules exactly.

---

## 1. Surface Dimensions & Rendering Table

| Surface | Container (W×H) | Image Frame (W×H or aspect) | object-fit / crop | Safe Area | Desktop vs Mobile | Source |
|---------|-----------------|------------------------------|-------------------|-----------|-------------------|--------|
| **SURFACE 1: In-app "What's New" popup (Recent Updates sidebar)** | Cards list in dialog | 114×80px | `object-cover` center-crop | Full 114×80 visible | Desktop only | packages/web-shared/src/components/content-shared/changelog-popout/RecentChangelogCards.tsx:33–36 |
| **SURFACE 2a: News Index—Card Cover** | 309×180px per card | 309×180px | `object-cover` center-crop | Full frame visible | Both: 1 col mobile, 2 cols @sm, 3 cols @md | packages/web-shared/src/components/content-shared/blog/components/PostCard.tsx:43–48 |
| **SURFACE 2b: News Index—Grid Layout** | max-width 1040px grid | 3-column layout @md | n/a grid-level | Cards in viewport | Responsive: grid-cols-1, sm:grid-cols-2, md:grid-cols-3 | packages/web-shared/src/components/content-shared/blog/components/NewsClient.tsx:140 |
| **SURFACE 3: Individual News Post—Detail Page** | Main article 7xl | (no cover image rendered) | n/a | Inline images max-width | Desktop: full width; mobile: px-6 | packages/web-shared/src/components/content-shared/blog/slug/components/StandardPostLayout.tsx:20–49 |
| **SURFACE 3b: News Post—Inline Images ({% cloud-image %})** | Full-width inline | w-full h-auto | `object-contain` (not crop) | Letterboxed safe | Both: constrained by parent width | packages/web-shared/src/components/content-shared/infinex-markdoc/InfinexMarkdoc.tsx:62, CloudImage.tsx:32 |
| **SURFACE 4: Twitter LINK UNFURL (og:image)** | API endpoint | 1200×630px fixed | n/a — generated title card | **uploaded cover NOT shown** | n/a (API response) | apps/public-website/src/app/api/og/route.tsx:56–57 |
| **SURFACE 5: Twitter ATTACHED MEDIA (Typefully thread image)** | X timeline | single image ~1.91:1 | center-crop to fill | center ~89% vertical | desktop crops to ~1.91:1; mobile tap shows full | X summary_large_image / attached-media behavior (external) |

---

## 2. Per-Surface Crop & Gotchas

### SURFACE 1: In-App "What's New" Recent Updates Card (114×80px)

**File**: `packages/web-shared/src/components/content-shared/changelog-popout/RecentChangelogCards.tsx`  
**Line 33**: `<div className="h-20 w-[114px] shrink-0 overflow-hidden rounded-xl">`  
**Line 35**: `className="size-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"`

**Rendering rules:**
- Container: 114px wide × 80px tall (`h-20` = 5rem = 80px in Tailwind)
- Image display: `object-cover` → **center-crop**
- Aspect ratio: **1.425:1** (114÷80)
- Overflow: `hidden` + `rounded-xl` (rounded corners ~8px)
- Desktop-only: appears in sidebar popout (sidebar is hidden on mobile)
- On hover: scales 1.1× (zoom effect)

**Gotcha**: Images taller than 1.425:1 will have top/bottom cropped. Images wider than 1.425:1 will have left/right cropped. **Optimal upload: 114×80 or 228×160 (2x) portrait-ish or square; avoid extreme landscapes.**

---

### SURFACE 2a: News Index Card Cover (309×180px)

**File**: `packages/web-shared/src/components/content-shared/blog/components/PostCard.tsx`  
**Line 43**: `<div className="relative h-[180px] overflow-hidden rounded-t-2xl rounded-b-lg">`  
**Line 47**: `width={309} height={180} className="size-full object-cover ..."`

**Rendering rules:**
- Container: 309px wide × 180px tall
- Image display: `object-cover` → **center-crop**
- Aspect ratio: **1.717:1** (309÷180)
- Rounded corners: `rounded-t-2xl` (top, ~16px), `rounded-b-lg` (bottom, ~8px)
- Overflow: `hidden`
- On hover: scales 1.1× (zoom effect)

**Grid context** (NewsClient.tsx:140):
- Mobile: `grid-cols-1` (1 card per row)
- Small screens @sm (640px+): `sm:grid-cols-2` (2 cards per row)
- Medium screens @md (768px+): `md:grid-cols-3` (3 cards per row)
- Container max-width: 1040px (SectionContainer.tsx)
- Padding: `px-2` mobile, `sm:px-6`, `lg:px-16`

**Gotcha**: Images taller than 1.717:1 (portrait) crop top/bottom. Images wider than 1.717:1 (landscape) crop left/right. **Optimal: 309×180 or wider landscape (e.g., 618×360).**

---

### SURFACE 2b: News Index—Responsive Grid

**File**: `packages/web-shared/src/components/content-shared/blog/components/NewsClient.tsx:140`

```
"grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:gap-8"
```

**Responsive breakpoints** (standard Tailwind):
- **Mobile (0–639px)**: 1 column, gap-4 (1rem)
- **Small (640px+)**: 2 columns, gap-6 (1.5rem)
- **Medium (768px+)**: 3 columns, gap-8 (2rem)
- **Large (1024px+)**: 3 columns, larger gap, larger gutters in NewsClient (`lg:px-16`)

**Gotcha**: Card sizes remain 309×180 fixed across breakpoints. On mobile, a single card fills ~90% of viewport width (px-2 gutters = 4px+body margin). No image scaling per breakpoint—same 309×180 crop applied everywhere.

---

### SURFACE 3: Individual News Post Detail Page

**File**: `packages/web-shared/src/components/content-shared/blog/slug/components/StandardPostLayout.tsx`

**Key finding**: **NO cover image is rendered on the post detail page itself.** The `coverImage` prop is passed but not used in the layout (line 15 declares it, but it's never rendered in JSX).

However, inline images (body content) are rendered via InfinexMarkdoc:

**File**: `packages/web-shared/src/components/content-shared/infinex-markdoc/InfinexMarkdoc.tsx`  
**Line 62** (CloudImage wrapper):
```jsx
<div className="relative mt-8 overflow-hidden rounded-3xl">
  <CloudImage {...props} ImageComponent={ImageComponent} />
</div>
```

**Line 32** (Image tag generic):
```jsx
<div className="relative mt-8 overflow-hidden rounded-3xl">
  {ImageComponent ? (
    <ImageComponent {...imageProps} />
  ) : (
    <img {...imageProps} />
  )}
</div>
```

**CloudImage.tsx:32** ({% cloud-image %} shortcode):
```jsx
className: 'w-full h-auto rounded-3xl object-contain',
```

**Inline image rendering rules:**
- Display: `w-full h-auto` → **full-width, height scales to maintain aspect**
- Crop behavior: `object-contain` → **letterbox (no crop, fits entirely)**
- Aspect ratio: **preserved** (not constrained)
- Corners: `rounded-3xl` (~24px)
- Margins: `mt-8` (2rem = 32px top)
- Page layout: `max-w-7xl` (80rem = 1280px), `px-6` mobile, `lg:px-0`

**Gotcha**: Inline images are NOT cropped—they're letterboxed. Aspect ratio is preserved. This is **opposite to card images** which use `object-cover`. A tall vertical image will appear with side margins on desktop; a wide landscape will fill the width and have top/bottom margins.

---

### SURFACE 4: Twitter LINK UNFURL — generated OG card (1200×630px) — UPLOADED IMAGE NOT SHOWN

**CRITICAL CORRECTION.** When you post the `/news` *link* to X, the unfurled card is **NOT your uploaded cover image**. `og/route.tsx` composites a **fixed branded template (`og-template.png`) + the post title text** — it takes only a `?title=` query param (route.tsx:27); there is no image param. So the cover image you upload has **zero bearing** on the link-unfurl card. No crop concern here for the cover; the only "safe area" is the title text box (left-padded 80px, right-padded 320px to clear the template's right-side graphic).

This means link-unfurl was **not** the launch-day crop culprit. See SURFACE 5.

**File**: `apps/public-website/src/app/api/og/route.tsx`  
**Lines 56–57**: ImageResponse dimensions

```javascript
return new ImageResponse(
  // JSX content
  {
    width: 1200,
    height: 630,
    fonts: [...]
  }
);
```

**Metadata declaration** (`apps/public-website/src/app/(site)/news/[slug]/utils.ts:15–19`):
```javascript
image: {
  url: `/api/og?title=${encodeURIComponent(title)}`,
  alt: title,
  type: 'image/png',
}
```

**Metadata structure** (`apps/public-website/src/utils/getMetadata.ts:27–41`):
```javascript
openGraph: {
  ...
  images: opts.image ?? { url, alt, type },
},
twitter: {
  card: 'summary_large_image',  // <-- Card type
  ...
  images: opts.image ?? { url, alt, type },
}
```

**OG/Twitter card rendering:**
- **Fixed size**: 1200×630px (Vercel @ImageResponse)
- **Aspect ratio**: **1.905:1** (1200÷630 ≈ 1.9:1)
- **Twitter card type**: `summary_large_image`
- **External constraint** (Twitter/X display): Summary_large_image displays at ~1200×628 center-cropped (native 2:1 ratio approximation)
- **Content placement** (from og/route.tsx): Title text overlaid on base template image (og-template.png) with padding `80px 320px 80px 80px` (top, right, bottom, left)

**Gotcha**: This is a title card, not a photo. The only failure mode is a long title getting `lineClamp: 4`-truncated or colliding with the template's right-side graphic (right padding is 320px). The uploaded cover image is irrelevant here.

---

### SURFACE 5: Twitter ATTACHED MEDIA — the Typefully thread image (THE LAUNCH-DAY CULPRIT)

**This is where the cover image actually lands on X and where launch-day cropping happened.** When the comms harness sends a thread to Typefully and an image is attached to a tweet, X renders it as attached media — **not** as an og card. Single-image attached media on the X timeline is shown at roughly **1.91:1 (≈16:9), center-cropped** in the feed on web/desktop; on mobile the in-feed crop is similar but tapping opens the full uncropped image.

**Behavior (external — X platform, not our code):**
- Single image, in-feed (web/desktop): center-cropped to ~1.91:1. A **tall** image loses top/bottom; a **very wide** image loses left/right.
- This crop is applied to the *uploaded* image, so its source aspect matters directly — unlike the link unfurl.
- "Only a certain width was shown" on launch day = a non-1.91:1 source image center-cropped into the ~1.91:1 in-feed frame.

**Gotcha**: keep the subject in the **central ~89% vertical band** so the in-feed center-crop doesn't decapitate it. This is the *widest* of all the crop targets, so it crops top/bottom hardest.

---

## 3. Mismatches & Risks

### A. Aspect Ratio Disagreement Across Surfaces

These are the surfaces where the **uploaded cover image** is actually displayed and cropped:

| Surface | Aspect Ratio | Crop axis | Implications |
|---------|--------------|-----------|--------------|
| In-app sidebar card (SURFACE 1) | 1.425:1 (narrowest) | crops L/R off wide images | Wide landscapes lose their sides |
| News index card (SURFACE 2a) | 1.717:1 | center-crop | Tall images lose top/bottom; wide lose sides |
| Twitter attached media (SURFACE 5) | ~1.91:1 (widest) | crops top/bottom off tall images | Tall/portrait images get decapitated |
| Inline body images (SURFACE 3b) | Any | none (letterbox) | Safe — `object-contain`, never cropped |
| Twitter link unfurl (SURFACE 4) | n/a | n/a | Uploaded cover NOT shown — generated title card |

**The squeeze**: the uploaded image is center-cropped into three *different* frames — 1.425:1 (sidebar), 1.717:1 (news card), and ~1.91:1 (X attached media). The **narrowest** (1.425) crops the **sides**; the **widest** (1.91) crops the **top/bottom**. A single image has to keep its subject inside the *intersection* of all three crops.

### B. Safe Zones for a Single Image

Author the cover at the **middle** ratio and protect the center:
1. **Upload at ~1.71:1** — e.g. **1200×700px** (or **2400×1400px** for Retina). This is between the 1.425 and 1.91 extremes, so neither crop is severe.
2. **Subject-safe zone**: a 1.71:1 source shown in the 1.425:1 sidebar loses ~**8% off each side**; shown in the ~1.91:1 X frame loses ~**5% off top and bottom**. So keep faces / numbers / logos inside the **central ~83% horizontal × ~89% vertical** box. The conservative "center 60%" rule clears all of it.
3. **Inline body images (SURFACE 3b)** are always safe — `object-contain`, no crop, any aspect.
4. **Link unfurl (SURFACE 4)** needs nothing from the image — just a title that doesn't overrun 4 lines.

**Real launch-day root cause**: the cover/attached image was authored for one surface's aspect and center-cropped hard by another — almost certainly a wider-than-1.91 or taller-than-1.43 source losing its edges on the X thread image. NOT an og-card mismatch (the og card never shows the uploaded image).

---

## 4. For the Harness Build: Preview Frame CSS

To build faithful preview frames in the comms harness, replicate these exact CSS rules:

### Preview Template 1: In-App Sidebar Card
```html
<div style="width: 114px; height: 80px; overflow: hidden; border-radius: 8px;">
  <img src="[image-url]" style="width: 100%; height: 100%; object-fit: cover;" />
</div>
```
- **Frame**: 114×80px
- **Crop**: center
- **Aspect**: 1.425:1

### Preview Template 2: News Index Card
```html
<div style="width: 309px; height: 180px; overflow: hidden; border-radius: 16px 16px 8px 8px;">
  <img src="[image-url]" style="width: 100%; height: 100%; object-fit: cover;" />
</div>
```
- **Frame**: 309×180px
- **Crop**: center
- **Aspect**: 1.717:1
- **Note**: Asymmetric border-radius (16px top, 8px bottom)

### Preview Template 3: News Index—Mobile (1 column, viewport-width)
```html
<div style="width: calc(100% - 4px); max-width: 350px; margin: 0 2px;">
  <div style="width: 100%; height: auto; aspect-ratio: 309/180; overflow: hidden; border-radius: 16px 16px 8px 8px;">
    <img src="[image-url]" style="width: 100%; height: 100%; object-fit: cover;" />
  </div>
</div>
```
- **Frame**: responsive, 309px aspect ratio locked
- **Mobile viewport**: ~350px available width (px-2 gutters)
- **Result**: ~345×201px rendered

### Preview Template 4: Twitter/OG Image
```html
<div style="width: 1200px; height: 630px; background: url('[og-template-base]'); background-size: cover;">
  <div style="padding: 80px 320px; font-size: 64px; font-weight: 600; color: #EDEEF0; line-height: 1; word-wrap: break-word;">
    {title}
  </div>
</div>
```
- **Frame**: 1200×630px fixed
- **Aspect**: 1.905:1
- **Safe text area**: left-padded (80px), right-padded (320px)—effective text box ~880px wide × 470px tall

### Preview Template 5: Inline Image (Article Body)
```html
<div style="width: 100%; max-width: 1280px; margin: 32px auto; overflow: hidden; border-radius: 24px;">
  <img src="[image-url]" style="width: 100%; height: auto; object-fit: contain;" />
</div>
```
- **Frame**: responsive, width: 100%
- **Crop**: none (object-contain = letterbox)
- **Aspect**: preserved
- **Max width**: 1280px (page max-w-7xl)

---

## 5. Summary: Key Dimensions & References

### Quick Reference Table

| Item | Dimension | File:Line | Notes |
|------|-----------|-----------|-------|
| Sidebar card frame | 114×80px (1.425:1) | RecentChangelogCards.tsx:33 | Center-crop, rounded-xl |
| News card frame | 309×180px (1.717:1) | PostCard.tsx:43 | Center-crop, rounded-t-2xl/rounded-b-lg |
| News grid (mobile) | 1 col | NewsClient.tsx:140 | grid-cols-1 |
| News grid (small) | 2 cols @640px+ | NewsClient.tsx:140 | sm:grid-cols-2 |
| News grid (medium) | 3 cols @768px+ | NewsClient.tsx:140 | md:grid-cols-3 |
| Article page max-width | 1280px (7xl) | StandardPostLayout.tsx:25 | Content width constraint |
| Inline image width | 100% / max 1280px | CloudImage.tsx:32 | object-contain, no crop |
| OG image frame | 1200×630px (1.905:1) | og/route.tsx:56 | Dynamic via Vercel ImageResponse |
| OG card type | summary_large_image | getMetadata.ts:33 | Twitter card declaration |
| OG image URL | `/api/og?title=[encoded]` | [slug]/utils.ts:15 | Dynamic generation per post |

### Major Mismatch Finding

The **uploaded cover image** is center-cropped into three different frames, and the link-unfurl card doesn't use it at all:

| Where the cover shows | Frame aspect | Crops |
|---|---|---|
| In-app sidebar | 1.425:1 | sides of wide images |
| News index card | 1.717:1 | mild both axes |
| X thread attached media | ~1.91:1 | top/bottom of tall images |
| X link unfurl | — | does not show the cover (generated title card) |

The span from **1.425:1 (sidebar) to 1.91:1 (X media)** is the whole problem: an image authored to fill one fills neither of the others. Author at the middle (~1.71:1) and keep the subject in the center ~83%×89% box and it survives all of them. **Launch-day cropping was the X attached-media path (SURFACE 5), not the og link card (SURFACE 4)** — a crucial correction, because no amount of cover-image tuning changes what the link unfurl shows.

---

## 6. Git References

- **Platform Monorepo SHA**: `4782dafa2f` (origin/main as of 2026-06-10)
- All file paths relative to: `~/Sites/infinex-xyz/platform/`
- All line numbers accurate as of origin/main commit `4782dafa2f`

