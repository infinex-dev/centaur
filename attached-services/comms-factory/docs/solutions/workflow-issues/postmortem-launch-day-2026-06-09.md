# Post-mortem — bank-deposits launch day (2026-06-09 → 06-10)

## TL;DR

Two things bit on launch day. They look unrelated but they're **the same bug class**:

> **The harness preview did not match the production surface.**

- **(a) In-app "What's New" didn't go live.** The website showed the bank-deposits changelog; the app didn't. Not a comms bug — the app bundles changelog content at *build time*, the website reads it at *request time*. The fix is a `web-app` redeploy, nothing in this repo.
- **(b) The image looked right in preview, cropped wrong in the wild.** Dimensions were technically fine, but Twitter / website / in-app each crop to a different safe-area, and the harness had no preview that showed the *actual displayed* frame. So "looks fine here" → "only half of it shows on Twitter."

Both = we shipped against a preview that wasn't telling the truth about the real surface.

---

## Incident (a) — in-app popup not live

**Symptom.** Bank-deposits changelog (PR #14754, merged 06-09) live on `/news`, absent from the desktop app's "What's New" popup.

**Root cause.** `public-website` (Next, SSR) reads content at request time → updates the moment the post merges. `web-app` (Vite SPA) consumes the same content via `@infinex/public-site-content` (`workspace:*`), which only re-bundles **on redeploy**. The app hadn't been deployed since before the merge.

**Fix.** No code. Deploy `apps/web-app` from current main; the bundle picks up the latest blog markdown.

> **Correction 2026-06-11** (per platform `docs/content-pipeline.md`, PR #14812 — now the canonical pipeline reference): a `main` deploy only refreshes the **test** web-app. Platform envs are branch-mapped (`main` → test, `prod` → production), so the production popup updates on the **next platform release (`prod` branch update)**. Also: the website is statically rendered, not request-time SSR — it's fresh on merge because it auto-deploys straight to prod on content-affecting `main` pushes.

**Status.** ⚠️ **STILL OPEN.** This is the one outstanding launch-day action. Acceptance: desktop sidebar → "What's new" shows *"Fiat bank deposits live via Bridge.xyz"* as the latest entry.

**Caveat for next time.** This is structural, not a one-off — every launch that relies on the in-app popup lags production until the next platform release. By design (content rides in the app bundle), not a bug. comms-factory's emit PRs now state per-surface go-live semantics in the PR body (`src/emit-platform-pr.ts`); the handoff doc (`research/whats-new-inapp-handoff-2026-06-10.md`) has the full surface map.

---

## Incident (b) — image cropping invisible until live

**Symptom.** Image asset was the right intrinsic dimensions; only a slice of the width actually rendered on the live surface. Twitter card and website crop differently, and the harness preview matched neither.

**Two root causes, both now addressed at the infra level:**

1. **Upload was broken.** `pnpm cloudinary:upload` shelled out to platform's `@infinex/scripts`, which failed `ERR_MODULE_NOT_FOUND` (platform repo has no node_modules; inherited PATH leaked the harness tsx resolver). → **Fixed** `0a4a860`: direct signed Cloudinary REST upload, self-contained in the harness, with a PNG/JPEG intrinsic-size reader.
2. **Preview conflated cover vs body.** `coverImage` rendered as a big body image, so review couldn't tell the social-card image from an inline one. → **Fixed** `aae5385`: `news-render` separates cover (metadata/thumbnail slot) from body `cloud-image` blocks; click-to-upload per slot; `news-image-patch` + `news-render` + `thread-media` test suites.

**What's still missing — the actual ask.** None of the above shows you *what each surface will crop to before you ship.* That's the gap the operator named: **per-surface visual preview templates.** See "Forward work" below.

**Status.** Upload + slot-separation infra committed. Per-surface crop preview = not built.

---

## What got built on 06-09 (context)

Heavy day — 18 commits. Beyond the two incidents:

- **Inline surface editing + operator handback** (`308a268`): grounder→actor→director re-run with a **reground gate** (halts if facts can't be verified; operator vouches or cancels). Autosave so edits survive reload.
- **Typefully ship path** (`02d7863`, `08f1a83`, …): blog → paste-ready X Article (rich HTML), send thread to Typefully as a v2 draft, draft link back in the ship panel.
- **Edit each final pick at the ship gate** (`9eb6bb9`).
- **Operator image upload + inline candidate edit** (`aae5385`).

Uncommitted-but-ready: the new test files (`news-render.test.ts`, `cloudinary-upload.test.ts`, etc.), dev utilities (`restart.ts`, `pick-revision` API), and the SurfaceEditor upload trigger (dormant, pending reconciliation with the Typefully work).

---

## Forward work — per-surface preview templates (the real deliverable)

The lesson generalizes to a build: **the harness should render each pick inside a faithful frame of the surface it ships to**, so the operator sees the truth before the ship gate, not after the tweet.

Surfaces to template (each needs *real* production crop rules, grounded — not guessed):

| Surface | What to preview | Where the truth lives |
|---|---|---|
| **Twitter/X card** | summary_large_image crop (2:1, ~1200×628), safe area, where the title/handle overlay sits | X card spec + how Typefully renders the attached media |
| **Website `/news`** | cover thumbnail crop + inline body image max-width/margins, desktop **and** mobile | platform `public-website` news-page renderer CSS |
| **In-app "What's New"** | popup card dimensions, cover crop, desktop-only popout | platform `web-app` What's-New component CSS |

**Method (per the channel-grounding memory — don't imagine the dimensions, read them):** audit the platform renderer for each surface, capture the actual `width` / `max-width` / `object-fit` / media queries, and drive the harness preview frames from those numbers. Same discipline as "ground channel abstractions vs real surfaces" — verify output shape against where copy/images actually land before building the preview.

**Acceptance.** On the next changelog run, the operator can look at one screen and see: this is what Twitter crops to, this is the website desktop frame, this is mobile, this is the in-app popup — and catch "too wide / face cut off / text in the dead zone" *before* the ship gate.

---

## Open items

1. ⚠️ **Deploy `apps/web-app`** — unblocks incident (a). External to this repo; only outstanding launch-day action.
2. **Build per-surface preview templates** — incident (b)'s real fix; grounded against platform renderer CSS.
3. **Commit the dormant test files + SurfaceEditor upload trigger** once reconciled with the Typefully branch.
