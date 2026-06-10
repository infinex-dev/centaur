# HL-spot fact enrichment — answers to operator triage holes (2026-06-03)

Source card: `research/grounded-hl-spot-2026-06-03.json` · Triage: `research/operator-review-triage-2026-06-03.md`
Live-class numbers re-pulled `2026-06-03` via `POST https://api.hyperliquid.xyz/info {"type":"spotMetaAndAssetCtxs"}`.
Enriched card: `research/grounded-hl-spot-2026-06-03-enriched.json` (original untouched).

---

## 1. Wrapped assets (the "no bridge, no wrapper" hole)

**Headline:** HL spot assets like **UBTC / UETH / USOL ARE wrapped representations** — minted 1:1 by the **Unit (HyperUnit) tokenization layer**, not native BTC/ETH/SOL. So "no wrapper" is **false** as a blanket claim. What is *truthfully* claimable is about the **Infinex custody/UX**, not the asset chemistry: the user never leaves the unified account, never hand-bridges, never approves a wrapper contract — the trade is USDC-quoted CLOB inside the app. Frame it as a *UX* claim ("one account, no manual bridging, no chain-hopping"), never an *asset-nature* claim ("these are real native BTC").

**Evidence:**
- Unit is "a decentralized asset tokenization protocol exclusively for the Hyperliquid L1" that locks native BTC/ETH/SOL with **Guardians (2-of-3 MPC/TSS threshold signers)** and **mints uAssets (uBTC/uETH/uSOL) on Hyperliquid**; the reverse path burns the uAsset and releases the L1 asset. Source: https://docs.hyperunit.xyz/ , https://www.blocmates.com/articles/unit-the-asset-tokenization-layer-on-hyperliquid , https://oakresearch.io/en/analyses/innovations/hyper-unit-hidden-engine-powering-hyperliquid
- The U-prefix on the tokens is literal in the live HL API: token names `UBTC` (idx 197), `UETH` (idx 221), `USOL` (idx 254) are distinct tokens, not `BTC`/`ETH`/`SOL`. `USDH`, `USDT0`, `USDE` are stable representations; non-U markets (`PURR`, `HYPE`) are HL-native.
- Unit markets the experience as assets arriving "native" into Hyperliquid (i.e. *feels* like holding the coin), but mechanically they are wrapped/minted claims backed by Guardian-held reserves — a custodial-federated wrapper, distinct from native L1 ownership.

**Copy implications:**
- CAN say: "no chain-hopping," "no manual bridge step," "one unified account," "USDC in, spot out." These describe the Infinex/HL UX truthfully.
- CANNOT say: "no wrapper," "real native BTC," "your actual coins." UBTC/UETH/USOL are Unit-wrapped, Guardian-custodied representations.
- AVOID implying self-custody of the underlying L1 asset — Unit's Guardian federation holds the reserves.
- If a "no bridge" line is wanted, scope it to the user action ("you don't bridge — we route it"), not to the asset's existence.

---

## 2. Unified-account change (ships WITH spot — treat as new)

**Headline:** Hyperliquid's **Unified Account mode** gives **a single balance per asset that simultaneously collateralizes cross-margin positions AND serves as the spot balance** in that asset (one USDC pool funds perps margin and spot buys). Our spot launch **requires** it (`unifiedAccount` only; `disabled`/`dexAbstraction`/`portfolioMargin` are blocked). Because it ships alongside spot, copy must treat it as a **new capability the reader is gaining**, not "the unified account you already use." This is structurally identical to **Infinex's own account-upgrade narrative** (the July '24 "Account Update Available" framing, and the live `migrate7702` / "Pectrify" upgrade flow): *"a framework for upgrading your Infinex Account… next time you login you'll see an option to update."*

**Evidence:**
- HL definition (verbatim): unified account = "single balance for each asset. This balance collateralizes all cross margin positions in that asset and is unified with spot balance in that asset." "Recommended for most users." Other modes: Standard (separate perp/spot balances), DEX Abstraction ("to be discontinued"), Portfolio Margin (most capital-efficient, unifies HYPE/BTC/USDH/USDC). Unified + portfolio margin capped at 50k user actions/day. Source: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/account-abstraction-modes
- Rollout: enabled in early 2026 as an opt-in capital-efficiency upgrade merging spot+perp balances. Source: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/account-abstraction-modes , https://chainstack.com/hyperliquid-hyperbft-sub-accounts-spot-perp-accounting/
- Card already encodes the requirement (grounded fact: "unifiedAccount only — other modes blocked").
- Infinex 7702 / upgrade-narrative exemplar (the analogy to mirror): `apps/public-website/content/changelog/account-update.md` — "Today we're excited to release… a framework for upgrading your Infinex Account, and the first update that adds new onchain capabilities… Next time you login to Infinex, you will see an option to update." Live code: `apps/web-app/src/components/features/pectrify/` ("Pectrify" = Pectra/EIP-7702 EOA→smart-account migration; `trpc.send.migrate7702` mutation). EIP-7702 shipped in Ethereum's Pectra upgrade (May 2025); it upgrades an existing EOA in place, same address, gaining smart-account features — exactly the "your account just got more capable" framing.

**Copy implications:**
- DO frame unified account as *new* — "spot and perps now share one balance" / "one account, both books" — an upgrade the reader receives, not a thing they already had.
- DON'T write "the unified account you already use" — that presumes prior state.
- The 7702 launch is the proven house pattern: capability arrives, account upgrades in place, same identity, more power. Borrow that arc, not the literal "7702" jargon (banned register, internal).
- Note for accuracy: unified account is *required* for our spot — if the reader isn't on it, accessing spot involves switching modes. Don't imply zero friction.

---

## 3. Previous Infinex swap/AMM product = **Swidge**

**Headline:** The prior product is **Swidge** (swap + bridge, one verb). It is an **aggregator across 28 distinct providers** (29 enum entries; `nearIntents` + `oneClickNearIntents` both display as "Near Intents"), supporting **100,000+ tokens across 25+ networks**, max $1M/tx. The spot-CLOB contrast line is: *Swidge = aggregated AMM/DEX/intent routing for any-to-any swaps; HL spot = a real central limit order book with live bids/asks.*

**Evidence — authoritative provider census from Infinex's own monorepo** (`packages/actions/src/swidge.ts` `swidgeProviderName` enum + `packages/web-shared/src/components/swidge/quotes/constants.ts` `PROVIDER_DISPLAY_NAMES`):

> Mayan, Jupiter, Li.Fi, Relay, 1inch, 1inch Fusion, Enso, Bebop, Bluefin, Uniswap, Cowswap, Stargate, Near Intents (nearIntents + oneClickNearIntents), deBridge, Oogabooga, JupiterZ, Pyth Express Relay, Pyth Express Relay (Via Jupiter), Across, XSwap, Renegade, Okx, Gas.zip, KyberSwap, Titan, DFlow, Valiant, Houdini

That is **28 distinct named providers** (operator's "~20+" is correct, actual count is higher).
- Public-facing numbers: "100,000+ tokens across 25+ networks," "25+ Swidge providers," max $1,000,000/tx, Patrons pay no fee (except ETH mainnet gas). Source: https://support.infinex.xyz/en/articles/10336734-how-to-swidge
- Launch framing: "Infinex Launches 'Swidge' to Enable Free Cross-Chain Swaps." Source: https://www.blocmates.com/news-posts/infinex-launches-swidge-to-enable-free-cross-chain-swaps , https://infinex.xyz/news/swidge-is-now-live-and-free

**Copy implications:**
- Name **Swidge** explicitly when contrasting. The Director run invented "Curve / Jupiter" comparisons (Jupiter is in fact one of Swidge's 28 routes, but naming two random AMMs misrepresents the product) — replace with Swidge.
- Accurate contrast: "Swidge aggregates 28 swap/bridge routes for any-token-to-any-token. Spot is different: a live order book — set your price, see the depth." (CLOB vs aggregated-AMM is the real distinction.)
- Safe count claim: "28 swap/bridge providers" (code-verified) or the public "25+." Prefer naming the *kind* (CLOB vs AMM/aggregator) over the count.

---

## 4. Onchain vs offchain — HL CLOB is fully onchain

**Headline:** **Yes — fully onchain.** Order placement, **matching, settlement, cancels, and liquidations all happen onchain on HyperCore (HL's L1)**, ordered by **HyperBFT consensus** (a HotStuff variant) with **one-block finality**, ~200k orders/sec. HL explicitly "does not rely on the crutch of off-chain order books." This is sourced, not assumed.

**Evidence (HL official docs):**
- "HyperCore include[s] fully onchain perpetual futures and spot order books… with one-block finality inherited from HyperBFT" and "200k orders / second." Source: https://hyperliquid.gitbook.io/hyperliquid-docs/about-hyperliquid
- HyperCore "does not rely on the crutch of off-chain order books"; "core design principle is full decentralization with one consistent order of transactions achieved through HyperBFT consensus"; HyperBFT = "a variant of HotStuff consensus… optimized for end-to-end latency." Matching-engine state lives in HyperCore (onchain). Source: https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/overview

**Copy implications:**
- CAN say: "a real order book, fully onchain," "every order, cancel, and trade settles onchain," "one-block finality." All sourced.
- CAN contrast with off-chain-matched venues ("not an off-chain matching engine bolted to a settlement layer").
- "HyperBFT" / "HotStuff" are **internal/jargon register** — true but banned in outward channels per triage 1.4. Keep the *property* ("onchain, one-block finality"), drop the *consensus name* in tweets/blog body.
- "200k orders/sec" is a provider spec, fine for a technical blog beat, overkill for a tweet.

---

## 5. Market census (corrected join + live snapshot)

**Headline:** There are **301 total HL spot markets**. The card's **"24"** was an **editorial cut: markets ≥ $100k 24h volume** — on today's snapshot that cut yields **23** (volume drifts; the count is live-class, not a fact). Top market is **HYPE/USDC**. The original card's named markets were correct (the index-misalignment trap was avoided in the card; my first naive pass hit it and showed "WOW/USDC $290M" — the *correct* join `ctx.coin → universe.name` reassigns that volume to HYPE/USDC).

**Top markets by 24h notional volume (live-class, dated 2026-06-03, `spotMetaAndAssetCtxs`, joined `ctx.coin → universe.name`):**

| Rank | Market | 24h notional vol |
|---|---|---|
| 1 | HYPE/USDC | $290.7M |
| 2 | UBTC/USDC | $70.6M |
| 3 | UETH/USDC | $20.1M |
| 4 | UZEC/USDC | $16.9M |
| 5 | USOL/USDC | $9.7M |
| 6 | KNTQ/USDC | $9.1M |
| 7 | PURR/USDC | $7.8M |
| 8 | USDT0/USDC | $6.3M |
| 9 | XMR1/USDC | $4.2M |
| 10 | USDH/USDC | $3.8M |
| 11 | UPUMP/USDC | $1.4M |
| 12 | UFART/USDC | $1.1M |

- **301 total markets**; **23 ≥ $100k**; **12 ≥ $1M** (today). Numbers will move — all volumes are dated snapshots.

**The join trap (method note for the card/grounder):** `spotMetaAndAssetCtxs` returns `[meta, ctxs]`. `meta.universe` has 301 entries; `ctxs` has 370 (extra non-canonical entries). They are **NOT positionally aligned** — joining by array index gives wrong volumes (naive index join labeled HYPE's $290M as "WOW/USDC"). Correct join: `ctx.coin == universe.name`, then translate the `@N`/canonical `name` to a human pair via `universe.tokens=[baseIdx,quoteIdx]` → `meta.tokens[idx].name`.

**Copy implications:**
- DON'T assert "24 markets" as a flat fact. If counting, qualify: "20+ markets with real daily volume" (≥$100k cut). Prefer **naming** the liquid markets (HYPE, UBTC, UETH, USOL) over counting — named entities are stronger and don't go stale the way a count does.
- HYPE/USDC is the clear protagonist if a data-card needs a hero number ($290.7M 24h, dated).
- Every volume line must be tagged live-class/dated in deployed_facts; a tweet shipping a stale number is the failure mode.
- Product note (echoes triage 1.4): default market should be the highest-volume one (HYPE/USDC), not PURR (PURR is the test default).

---

## 6. Audience per channel ("who is the audience here?")

**Headline:** The channel-surface grounding (`research/channel-surface-grounding-2026-06-03.md`) carries **length + real surface + output shape per channel, but NOT a reader-context/audience field** — it's **empty for every channel**. The operator's "who is the audience?" gripe is unanswerable from current channel metadata; the comms profiles deliberately strip reader-context (per memory: "Channel profiles = situation, not register" — but situation *should* include reader-context, and it currently doesn't carry an explicit audience).

**Evidence:**
- The channel↔surface table has columns: comms channel, real surface (file home), real shape, verdict. There is **no audience/reader-context column**. Each row tells you *where the line lands* and *its shape*, never *who reads it there*.
- Implicit audience by surface (derivable, not stated):
  - **web** (`feature-card-alt/data.ts`, homepage carousel) → cold/prospective visitors, top-of-funnel, never-used-Infinex. Highest "who is this for" ambiguity — the operator's gripe was on **blog**, but web is the more under-specified surface.
  - **blog / changelog** (`content-app/content/blog`, `public-website/content/changelog`) → existing/semi-engaged users reading "what shipped"; changelog skews to current users, marketing blog skews wider. Operator flagged blog as over-indexing on "live" without a reader model — correct: the changelog reader already uses the app, doesn't need "it's live" hype.
  - **carousel** (`app-alert` "What's new" `WhatsNewDialog`) → **logged-in active users** seeing it on next app open. Most clearly defined audience (in-app, already a user).
  - **in-product / modal** (`@infinex/ui` Dialog, inline JSX) → users mid-action; highest intent, lowest patience.
  - **x (solo)** / **x-thread (Typefully)** → public timeline; mixed prospective + crypto-native + existing. Thread = engaged enough to expand; solo = scroll-past.

**Copy implications:**
- The triage's "Director has no reader-model check" (Bucket 2) is the right diagnosis — and it traces to a **missing field upstream**. The channel-surface doc and the comms channel profiles should carry an explicit `reader_context` per channel (cold prospect / active user / mid-action / public timeline). Without it, "who is the audience" can't be enforced.
- Concretely: **blog/changelog reader already uses Infinex** → don't sell "it's live," tell them *what's new and what to do*. **web reader is cold** → that's where "what this is / why care" belongs.
- This is a structural gap to feed back, not something the card can fix per-run. Recommend adding `reader_context` to the channel profile schema (string per channel; today it is absent).

---

### Method note (compoundable)
Two reusable techniques surfaced: (1) **derive the partner-product census from our own integration code, not the partner's marketing** — the 28 Swidge providers came from `packages/actions/src/swidge.ts`, authoritative and current, vs the support doc's "and many more." Same pattern as the grounder's "integration code is the recipe." (2) **Re-derive every live-class number through the documented join trap before trusting a prior snapshot** — the index-join misalignment is a standing trap on `spotMetaAndAssetCtxs`; a naive re-pull reproduced "WOW/USDC $290M" and only the `ctx.coin → universe.name` join recovered the truth.
