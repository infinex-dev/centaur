# Infinex changelog template — earmarked cohort + house format (2026-06-05)

Derived from the **cohort** that shares the changelog metadata + hallmarks (not a single exemplar). This is the format the PR-emission feature (package 2) must encode, and the spec our keystone is checked against.

## Earmarked cohort (the template set)
All `category: changelogs`, numbered (`№ NN`):
- `62-lighter.md` (2026-03-03) — tightest current match
- `61-incognito-mode.md` (2026-02-16)
- `60-inx-is-here.md` (2026-01-30)
- `59-hardware-wallet-support-bulk-move.md` (2026-01-27)
- `56-hip-3-perps-extension-updates.md` (2025-12-19)
- `52-perps-advanced-orders-plus-faster-swidge.md` (2025-11-14)

**Anchor on the recent three (60 / 61 / 62)** for the *current* convention.

## Tier 1 — universal (every cohort member)
- `category: changelogs`
- `coverImage` (`src`, `alt`, `height`, `width`)
- numbered title `№ NN - <Feature>`  ·  **we publish WITHOUT the number** (internal-only `№ 63`, deliberate divergence — see note)
- `published: true`, `pinned: false`, `date`
- body opens with a heading + hero `{% cloud-image %}` (no intro paragraph)
- ~150–435 words (tight, feature-focused)

## Tier 2 — strong convention (recent: 60/61/62/59; absent in 52/56)
- opens with `###` (52 used `##`)
- `---` horizontal-rule dividers between sections (NB: `---` hyphens, a rule — not an em-dash)
- `{% toggle title="…" defaultOpen=false %}…{% /toggle %}` for minor/grouped items
- ends with `### Coming up` + roadmap link

## Tier 3 — optional (1–2 members)
- `subtitle` (61, 62)
- `typefullyUrl` (61) — links the X thread on Typefully
- `appAlert` (56) — relationship to the in-app alert collection

## Deviations / non-cohort lookalikes
- Within cohort: `52` opens `##`, no Coming-up, bullets not toggles; `56` has `appAlert`, no explicit Coming-up.
- News-category lookalikes (`sonar-sale`, `craterun-is-coming-back`, `wallet-import`) share *some* hallmarks (cloud-image, dividers) but lack `### Coming up` and run longer — **not** the changelog template.
- Podcast/news long-form (`uneasy-money-*`, `why-privacy-matters`, `the-roadmap…`) are a different shape entirely (intro prose, `##`, callouts/tables/video-embed, 600–1700 words).

## Our keystone vs the template
`drafts/bridge-launch-changelog-2026-06-05.md` matches the recent-3 convention: `###` open, hero `{% cloud-image %}`, `---` dividers, `{% toggle %}`, `### Coming up` + roadmap, `category: changelogs`, ~280 words. **Sole deliberate divergence:** number not published (kept internal as a YAML comment + filename `63-bank-deposits.md`).

## Note on the number
The `№ NN` title is the one Tier-1 hallmark we're dropping from publication. Every existing changelog publishes it; ours won't. Operator's call (de-number going forward). Tracked internally only.
