# Bank deposits — get the in-app "What's New" popup live (handoff)

**Date:** 2026-06-10
**Goal:** the **"What's new" popup** (bottom of the app sidebar) shows **"Fiat bank deposits live via Bridge.xyz"** — **today**.

> **UPDATE 2026-06-11 — superseded by platform `docs/content-pipeline.md` (platform PR #14812), which is now the canonical reference.** Two corrections to this doc:
> 1. **"Deploy `apps/web-app` from current `main`" only updates the TEST env.** web-app ships as part of "platform" (`deploy-platform.yaml`) and platform envs are branch-mapped: `main` → platform-test, `prod` → platform-prod. Production users get new bundled content on the **next platform release (`prod` branch update)** — there is no standalone prod web-app deploy off `main`.
> 2. The website's news pages are **statically rendered, not request-time SSR** — they're fresh on merge because the website **auto-deploys straight to prod** on any `main` push that affects it (content-app is a workspace dep, so content changes always trigger it). Same net effect for merges; different mechanism. It matters for scheduled posts: a future `publishedFrom` needs a website deploy **after** the publish time to appear on infinex.xyz (the web-app, by contrast, filters at read time in the browser).
>
> comms-factory's emit PRs now state these go-live semantics in the PR body (`src/emit-platform-pr.ts`).

---

## TL;DR for engineers

> The changelog content is already merged (`#14754`). The in-app popup reads **build-bundled** content (`@infinex/public-site-content`, a `workspace:*` package), so it only refreshes when **web-app is rebuilt + redeployed**.
>
> **Action: deploy `apps/web-app` from current `main`. That's the whole fix. No new PR required.**

The website (`/news`) already shows bank deposits because `public-website` (Next SSR) reads the same content **at request time**. `web-app` (Vite SPA) bakes it into the build, which is why the app still tops out at #62 — it hasn't redeployed since the post merged on 2026-06-09.

---

## Why the app lags the website (one paragraph)

Both surfaces read the **same** content package. The difference is *when*:

| Surface | App | Reads content | Freshness |
|---|---|---|---|
| `/news` | `apps/public-website` (Next SSR) | at request time | updates within minutes of merge ✅ |
| in-app "What's new" popup | `apps/web-app` (Vite SPA) | **bundled at build time** | only updates on web-app **redeploy** ❌ |

Verified source: `apps/web-app/src/api/content/contentKeyMap.ts` → `recentChangelogPosts` reads `blogContent.collections.blog.all()` (the bundled package), filtered to `category: 'changelogs' && published`, newest 7. Bank deposits qualifies (category `changelogs`, `published: true`, dated 2026-06-09).

---

## The one required action

**Trigger a production deploy of `apps/web-app` off current `main`.**

- `web-app`'s dep is `"@infinex/public-site-content": "workspace:*"` → the build runs content-app's `prepare:pkg` and re-bundles the latest blog `.md` files. **No version bump, no extra PR.**
- After deploy, the popup auto-appears (desktop) ~3s after app load.

### Acceptance check (post-deploy)
- Desktop app → bottom of sidebar → **"What's new"** popout shows **"Fiat bank deposits live via Bridge.xyz"** as the latest entry.
- Clicking it opens the changelog dialog with the post body.
- "Full changelog" link still goes to the website (expected).

### Known, non-blocking caveats
- **Desktop popup only.** Below the `lg` breakpoint there's no popout; mobile shows the changelog as a home-page CTA (`ChangelogCta`), same data source.
- **Per-user dismissal.** If a user already dismissed the current "What's new", it won't re-pop for them (`useIsWhatsNewAlertDismissed`). New/undismissed users see it.
- **30-day window.** Auto-show requires the latest changelog be < 30 days old. Bank deposits (2026-06-09) is well inside it.

---

## The PRs in flight — what actually gates "What's New"

| PR | What it is | Gates the What's New popup? |
|---|---|---|
| **#14754** *(MERGED)* | The bank-deposits changelog post (`apps/content-app/content/blog/fiat-bank-deposits-live-via-bridge-xyz.md`) + roadmap tick. | **Yes — and it's already done.** This is the content the popup shows. |
| **#14765** *(OPEN)* | "Mark Lighter perps as live on the roadmap" — 1-line roadmap (`public-website`) tick for #62 Lighter. | **No.** Roadmap-only, unrelated to bank deposits or the popup. Merge on its own schedule. |
| **internalNumber field** *(staged, NOT pushed)* | comms-factory change: adds an admin-only `internalNumber` Keystatic field + tags bank deposits as **#63**, so the changelog number is tracked internally without showing on the website. Branch `cf/internal-changelog-number` off `origin/main`, worktree `/tmp/cf-internalnum-54120`. | **No.** Internal numbering only. Orthogonal to the popup. Push when ready (note: its schema must merge before the harness emits `internalNumber` on future launches). |

**Net:** Only **#14754 (done)** is load-bearing for the popup. The popup's remaining blocker is **a web-app deploy**, not any of the open PRs.

---

## What is NOT involved
- **The swipeable "What's New" carousel** (`WhatsNewDialog`, fed by the `app-alert` collection) is **dead/unused** in the app (content abandoned at #57). Not needed for this and not what's missing.
- No `emergencyAnnouncement` flag (that's an ops banner for emergencies, not changelogs).
- No content-package version bump (it's `workspace:*`).
