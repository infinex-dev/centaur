# Channel ↔ real-platform-surface grounding — 2026-06-03

Reality-check of the 7 comms-factory channels (5 existing + 2 proposed) against the
actual Infinex monorepo (`~/Sites/infinex-xyz/platform`). Question being answered:
*"where would you actually put each line — is this real or imagined?"*

Verdict up front: **all 7 map to a real surface, but 3 are mis-shaped in our pipeline.**
The channel as a *situation* is real everywhere; two of our channel *output shapes*
(a single string) are wrong, and one publishing path doesn't exist as platform code.

| comms channel | real surface (file home) | real shape | verdict |
|---|---|---|---|
| **web** | `apps/public-website/.../_components/feature-card-alt/data.ts` | `{ subheading, title, caption }` triple, hardcoded, rendered in a homepage carousel | **mis-shaped** — we model it as one ≤140 string; reality is a 3-part struct, ~13/28-43/20-39 chars |
| **in-product** | inline JSX + const files (`SubmitButton.tsx`, `DepositDialog.tsx`, …) | single short label/headline | **good** — single ≤80 string is correct |
| **modal** | `@infinex/ui` `Dialog` (`Content`+`Footer`); many examples | title + body (30-147 chars) + CTA label | **good** — our ≤250 is generous but right shape |
| **carousel** | **`apps/content-app/content/app-alert/<NN-slug>.yaml` + `slides/N/content.md`** (rendered by `WhatsNewDialog`, the "What's new" CTA) | `slides[]`; slide = `{ name (title), body (1-3 sentences, condensed), slideImage, patronEarlyAccess }` | **real, NOT net-new** — it's the `app-alert` collection: a *separately authored, condensed companion* to the changelog, numbered to match (54-infinex-extension ↔ blog № 54) |
| **blog** | `apps/content-app/content/blog/*.md` (Keystatic, Markdoc, 400-600w) **or** `apps/public-website/content/changelog/*.md` (plain MD, 200-500w) | numbered `№ NN` markdown + frontmatter + sections + "Coming up" | **good** — brief "blog like our changelogs" → the changelog .md format |
| **x** (solo) | `workers/main/src/lib_v2/social/twitter/api.ts` `postTweetToTwitter(text)`; Zod `.max(280)` | single string ≤280 | **good** |
| **x-thread** | **no platform API.** Threads ship via **Typefully** (`infinex-twitter-bot/.env` `TYPEFULLY_API_KEY`; blog frontmatter `typefullyUrl: typefully.com/t/...`) | array of ≤280 tweets | **copy is real to generate; native posting is net-new** — publishing path is Typefully, not platform `postTweet` (that's a user-facing single-tweet feature, not the marketing thread path) |

## The three divergences that matter

### 1. `web` is a struct, not a blob
Real feature card (`feature-card-alt/data.ts:27`):
```ts
subheadings: { first: { children: 'Perpetual Futures', tone: 'orange' } },
title: 'Trade perps with /up to 50x leverage.',   // '/' = responsive line-break
caption: '...supporting fact...',
```
Measured budgets across all 6 live cards: subheading ~12-29, title ~28-43, caption ~20-39.
Our `web` channel emits one ≤140 string. To actually drop into the site it should emit
`{ subheading, title, caption }`. The 140 budget is ~2× the real max and the wrong unit.
Copy is **hardcoded in `data.ts`** — shipping = a code change, not a CMS entry.

### 2. `carousel` = the `app-alert` "What's new" surface (condensed companion to the changelog)
CORRECTION: not `WalletImportQuickTourDialog` (that's a one-off wallet tour). The real
carousel is the **"What's new"** popout (`WhatsNewDialog`, swipeable Carousel + page dots),
fed from the `app-alert` collection: `apps/content-app/content/app-alert/<NN-slug>.yaml`
(slide titles + images) plus `slides/N/content.md` (the condensed body per slide). It is a
**separately authored, shortened version of the changelog** — numbered 1:1 with the
changelog (`54-infinex-extension` ↔ blog № 54; the blog's `appAlert:` frontmatter is the
Keystatic relationship between them). Real slide (alert № 54, slide 1):
- name: `Monad now live`
- body: `Monad is now live on Infinex. Deposit, send, and swidge to and from Monad, buy MON, and connect to Monad apps using the new Infinex Extension.`
So "condense the changelog to a carousel" = author a new `app-alert` (e.g. `NN-hyperliquid-spot`)
with N slides each `{ name, body (1-3 sentences) }`, mirroring the changelog sections.
The only ready code-record of past carousels is the `app-alert/` directory itself.

### 3. `x-thread` has no native posting path
`postTweetToTwitter` takes a single `text: string`, no `in_reply_to_tweet_id`, and the
`twitter_post` DB table has no thread/parent columns. Threads are composed and published
through **Typefully** (API key present in the bot env; published threads back-linked from
blog frontmatter as `typefullyUrl`). So generating thread copy is fine and useful, but
"ship the thread" = push to Typefully / hand to a human, not call the platform API.

## Grounded facts for THIS launch (card 01KT5FTDJVCCE8ZG5DX4CXAG15)
Grounded against branch `spot-integration` → `research/grounded-hl-spot-2026-06-03.json`
(23 facts, 1 correctly-excluded: Infinex Pro). Load-bearing deployed_facts:
- Hyperliquid **Spot V1** inside **Infinex Perps** (`perps.app.infinex.xyz`); venue = Hyperliquid.
- **Fully onchain CLOB** spot order book on HyperCore; **Infinex's first CLOB spot order book** (conf 0.92).
- **USDC-only** quote; **unified account only** (other modes blocked).
- Order types: market, limit, post-only (+cancel/modify/batch). **No** trigger/TWAP/scale; no leverage/margin/funding (spot).
- Users: view USDC spot catalog, **real-time order book**, charts, balances/history; place/cancel/modify orders.
- UI: **"Switch to Spot" / "Switch to Perps"** toggle; last symbol per mode preserved.
- Route: `perps.app.infinex.xyz/hyperliquid/spot/{BASE}/{QUOTE}` (default `PURR/USDC`); **rendered live** (order book panel verified).
- Liquidity context (live-class, ~0.9 conf): 24 spot markets >$100K 24h vol; top **HYPE/USDC $284M**, UBTC $61M, UETH $20M.
- Hyperliquid X: **@HyperliquidX**.
- **not_said:** Infinex Pro (not announced).

## Implication for the build
- `web` and `carousel` should be **structured** channels (typed objects), not `string[]`.
- `x-thread` should be `Tweet[]` (string[]) — that part of the earlier plan was right —
  with the ship target documented as Typefully, not platform `postTweet`.
- `in-product`, `modal`, `x`, `blog` are already correctly shaped.

Sources: `apps/public-website/.../feature-card-alt/{data.ts,index.tsx}`,
`apps/web-app/.../WalletImportQuickTourDialog.tsx`, `packages/ui/components/carousel/`,
`apps/content-app/content/blog/54-extension-gas-account.md`,
`apps/public-website/content/changelog/43-*.md`,
`workers/main/src/lib_v2/social/twitter/api.ts`,
`packages/main-service-contract/src/v2/server/social/postTweet.ts`,
`infinex-twitter-bot/.env`.
