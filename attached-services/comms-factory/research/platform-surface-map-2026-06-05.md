# Platform surface map: comms → PR (2026-06-05)

Where each launch surface lives in the Infinex platform repo (`~/Sites/infinex-xyz/platform`), how a new entry is added, and — critically — **what is a code-PR vs a runtime flag/ops action.** Feeds Codex package 2 (the one-button PR-emission feature).

## The big simplification

**One changelog blog file drives three surfaces.** A markdown post in `apps/content-app/content/blog/` with `category: 'changelogs'` auto-populates:
- the blog page at `/news/{slug}`,
- the in-app **"What's new"** popout (desktop, bottom-left sidebar — `ChangelogSidebarPopout`),
- the mobile home **CTA** (`ChangelogCta`, shows if < 30 days old),

all sourced from the post's `title`/frontmatter via `useRecentChangelogPosts()`. Dismissal persists 30 days (`useIsWhatsNewAlertDismissed`). So **blog + what's-new entry + in-product CTA = one file, not three edits.**

## Surface table

| Surface | Path | Format / schema | How to add | PR or flag? |
|---|---|---|---|---|
| **Blog** | `apps/content-app/content/blog/{slug}.md` | Frontmatter: `title`, `date` (ISO), `published`, `pinned`, `category`, `coverImage{src,alt,height,width}` + Markdoc body | New `.md` file; Keystatic collection auto-indexes; route `/news/{slug}` | **Code PR** |
| **What's-new popout + mobile CTA** | (same blog file) | `category: 'changelogs'` | automatic from the changelog blog post | **Free** (rides blog) |
| **Carousel** (app-alert "What's new") | `apps/content-app/content/app-alert/` | YAML frontmatter — **schema TBC** (operator's June-3 grounding: condensed changelog companion, numbered 1:1) | New app-alert entry — *confirm this is the carousel, then grab schema* | **Code PR** (likely) |
| **Web feature card** | `apps/public-website/src/app/(site)/features/data.ts` | object in `FEATURES_COPY[]` (hero / 2-col / 3-col) | append object; renders `/features` | **Code PR** (optional) |
| **Roadmap** | `apps/public-website/src/app/(site)/roadmap/data.ts` | `TreeNode {id, name, status, children}`, status `done\|in_progress\|planned` | edit item status (see diff) | **Code PR** |
| **Modal** | feature flag `emergencyAnnouncement`; rendered `apps/web-app/src/components/layouts/SidebarPageLayout.tsx` + `PublicPageLayout.tsx` | flag payload `{message, linkHref?, linkText?, displayWhenLoggedOut, isEmergency}` | flip/replace the flag | **Flag/ops — NOT a code PR.** Emergency-only; single key ⇒ adding **replaces** current. Recommend excluding from launch PR. |
| **Fiat on-ramp enabled** | feature flag `enableBridgeBankDeposits` | boolean flag | flip the flag | **Flag/ops — not a file** |
| **X thread** | Typefully (no native API) | — | manual paste | **Manual** |

## The actual one-button PR (content set)

1. **Changelog blog `.md`** → `apps/content-app/content/blog/{slug}.md` (`category: 'changelogs'`) — drives blog + what's-new + CTA.
2. *(optional)* **App-alert / carousel entry** → `apps/content-app/content/app-alert/` (pending schema confirm).
3. *(optional)* **Feature card** → `apps/public-website/src/app/(site)/features/data.ts`.
4. **Roadmap tick** → `apps/public-website/src/app/(site)/roadmap/data.ts`.

Excluded from the PR (handle via ops): modal (emergency flag), on-ramp enablement (flag flip), X thread (Typefully).

## Roadmap diff (the 8th item)

Target: `Onramp (bank account)` under `TradFi & CEX`, currently `in_progress`.

```diff
  // apps/public-website/src/app/(site)/roadmap/data.ts — under "TradFi & CEX"
-     { id: id(), name: 'Onramp (bank account)', status: 'in_progress' },
+     { id: id(), name: 'Onramp (bank account)', status: 'done' },
```

**Child → `done` is unambiguous.** The **parent (`TradFi & CEX`) is a caveat:** it has an explicit `status` and its *other* children (`Onramp (credit card)`, `Infinex card`, `Virtual accounts`, `Pay with Infinex`, `Fund from CEX`) are still `in_progress`/`planned`. Setting the parent `done` would wrongly imply the whole category shipped. **Confirm render semantics** (auto-derive parent-tick from any-child-done = operator's convention → leave parent alone; vs explicit → don't set `done`). Do NOT blindly flip the parent.

## Open confirmations
1. Carousel = app-alert collection (vs the changelog-blog popout)? Then capture app-alert frontmatter schema.
2. Roadmap parent status: auto-derived or explicit?
3. Modal excluded from the auto-PR (leave the emergency flag alone)?

## Files cited
- Blog: `apps/content-app/content/blog/`, `apps/content-app/keystatic.collections.tsx`, `apps/public-website/src/app/(site)/news/page.tsx`
- App-alert: `apps/content-app/content/app-alert/`
- What's-new in-app: `apps/web-app/src/components/layouts/components/nav-v3/SidebarNav.tsx` (`ChangelogSidebarPopout`), `apps/web-app/src/pages/app/home-v3/HomePageV3.tsx` (`ChangelogCta`), `useRecentChangelogPosts` / `useIsWhatsNewAlertDismissed`
- Modal: `apps/web-app/src/components/layouts/SidebarPageLayout.tsx`, `PublicPageLayout.tsx` (`emergencyAnnouncement` flag)
- Features: `apps/public-website/src/app/(site)/features/data.ts`, `components/FeatureSection.tsx`
- Roadmap: `apps/public-website/src/app/(site)/roadmap/data.ts`, `types.ts`
