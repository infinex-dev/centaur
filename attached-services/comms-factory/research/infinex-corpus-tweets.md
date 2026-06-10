# Infinex tweets corpus

Harvested 2026-05-18 from on-disk feed data. 52 stratified samples drawn from a 300-tweet window spanning 2025-12-17 → 2026-04-15. No fresh fetches (X.com returns HTTP 402 to unauthenticated WebFetch).

## Source files used
- `research/wave-1.5-tweets/infinex.full.json` (primary — 300-tweet payload, all metadata)
- `research/wave-1.5-tweets/infinex.api.md` (newest 100 only — used to cross-check formatting)
- `research/wave-1.5-tweets/infinex.md` (empty stub — 0 posts in the 7-day window the script saw)

## Stratification breakdown
- Sales / positioning (Sonar Sale, INX TGE day, sale extension push): 11
- Errata / apology / repair (the "We got the sale wrong" thread + repair-window posts): 5
- Announcements (product ships — Perps, Lighter, Houdini, MegaETH, hardware wallets, agent stuff): 14
- Threads — multi-tweet feature explainers (extension launch, Houdini privacy, kain podcast unrolls): 9
- Replies — community / peer / KOL: 6
- One-liners / vibes / cultural posts: 5
- Cultural — Lunar New Year red packets, "Tick, tock", "Times change. Privacy doesn't.": 2

Skipped: retweets (RT @…) unless they carried Infinex's own commentary, which in this window they didn't. Skipped Patron Draw / Cash Draw recurring boilerplate posts after sampling one (high-volume, low-signal).

## Surface-shift notes (for downstream)

The most obvious register shifts in Infinex's tweet voice across this window:

- **Announcement voice** — declarative, often a single-noun lead ("INX is here.", "The Infinex Sale is live.", "Tick, tock.", "Times change. Privacy doesn't."). Short opening sentence, line break, then a list-of-features or a quote-pull. Uses arrow `→` and `↓` as connective tissue. Sentence-case headers. Confident, but not consumer-fintech upbeat the way Phantom is — it's flatter, more declarative, more "we already won" than "come find out."
- **Thread voice / explainer voice** — multi-tweet podcast unrolls (Kain on @theblondebroker, on @VirtualBacon, on Proof of Story) follow a strict shape: anchor tweet with a quote-pull, then 5-7 reply tweets each leading with a Kain quote, each ~250 chars. The reply tweets break Twitter's "thread" convention — no 1/n numbering — and treat the chain like an aphorism reel rather than a narrative. Voice is *certain-pessimist* ("The altcoin market is structurally broken", "Everyone is building for AI. Not everyone is built for AI.").
- **Errata / apology voice** — exactly one post in this window: the 2026-01-05 "We got the sale wrong" tweet (635 likes, 410k impressions). Register shift is total — no emojis, no arrows, no hype furniture, no quote-pulls. Plain prose, blunt admission, parallel-construction summary of who hates what ("Retail hates the lock. Whales hate the cap. Everyone hates the complexity."), then the tweet truncates mid-sentence at "To our". The corresponding blog post ("From mindshare to slop") is its closest tonal cousin. This is *founder-voice surfacing through the brand account* — not the brand account speaking. Different person at the keyboard.
- **Sales-positioning voice** — Sonar Sale (Dec 27 → Jan 10) is the highest-density slug in the window. Posts come in `⏰ N HOURS LEFT` countdown shape, often piggybacked on a `@pendle_fi` reply chain (a thread Infinex was running through Pendle's account, presumably for cross-distribution). Voice mixes Bauhaus-clean information design ("📍 Now → Registration open / 📍 Jan 3-6 → Infinex Sale / 📍 Jan 7-13 → Final allocation / 📍 Late Jan → TGE") with a candid undertone ("Haven't become an Infinex Patron because you don't like NFTs?"). The "Oversubscribed." tweet 2 hours before close is the purest distillation of the voice — one word, sentence period, gone.
- **Reply voice** — terse, often single line, often inside-joke-y or sphinx-like ("Working on it", "Down the Rabbithole 🐇", "We call this a skill-horizon.", "I've been waiting for years for this.", "Luckily, we have one"). Closer to Phantom's "shitposter-on-main" register than the announcement voice is — but Infinex's reply voice is more *sphinx-as-flex* than *shitposter-as-equal*. Doesn't punch down.
- **Cultural posts** — Lunar New Year Red Packets, the "Times change. Privacy doesn't." reel, "馬年吉祥 🧧". Voice goes warm-and-wide, never twee. The cultural posts read closest to the announcement voice with the volume turned down.

Not present in this window: thread-numbered listicles, "FYI," opener, ghost emoji or any mascot anchor, exchange-potshots at named competitors (no Coinbase/Binance/Kraken pejoratives anywhere). Infinex doesn't antagonize.

A peer-to-Phantom A/B note: Phantom's announcement voice is more upbeat-consumer ("FYI, GameStop is now live for trading in Phantom 🎮"), Infinex's is more flatly-declarative-pro ("Stock perps are now live on Infinex."). Phantom signs off with ghost-emoji + product name; Infinex signs off with a `→` link or nothing at all. Phantom's compliance-disclaimer register is a separate within-account register; Infinex never deploys formal compliance voice in this window because their product doesn't ship under perps-issuer registration — Hyperliquid does, and the disclaimer lives upstream.

## Samples

| # | Stratum | Date | Text |
|---|---|---|---|
| IT001 | errata-apology | 2026-01-05 | We got the sale wrong.<br><br>We tried to balance existing Patron holders, new participants, and fair distribution all at once and the result was a sale that (almost) nobody wanted to participate in.<br><br>Retail hates the lock.<br>Whales hate the cap.<br>Everyone hates the complexity.<br><br>To our [API truncated at 280 chars; thread continued; X.com returned HTTP 402 to unauth fetch — full continuation not captured] |
| IT002 | errata-repair | 2026-01-05 | Kain is live on FOMO Hour to go over the Infinex sale changes. |
| IT003 | errata-repair | 2026-01-07 | A thread and an olive branch to the Yappers from Kain. |
| IT004 | errata-repair | 2026-01-09 | @nikitabier we're being botted into oblivion here. please fix this |
| IT005 | errata-repair | 2026-01-10 | @pendle_fi The sale is closed but the job's not finished.<br><br>For those new to Infinex → here's what we've built so far. |
| IT006 | sales-positioning | 2025-12-25 | Infinex Sale registration opens Dec 27th.<br><br>3x boost when you share your registration.<br>10x for Patrons who share. |
| IT007 | sales-positioning | 2025-12-27 | The Infinex Sale is open for registration.<br><br>5% of INX supply at $99.99M FDV. 1-year lock, with early unlock option.<br><br>Orders between $200 min, $2,500 max.<br><br>Allocation by chance, with boosts available.<br><br>Sale runs 3-6 Jan.<br><br>[thread] |
| IT008 | sales-positioning | 2025-12-27 | The Infinex Sale is the lowest price INX has ever been sold.<br><br>To take part:<br><br>1. Verify through Sonar (https://t.co/v4VV2VgrGK)<br>2. Connect your Infinex account<br>3. Register and share for your boost<br><br>INX is for everyone → |
| IT009 | sales-positioning | 2025-12-27 | Infinex Sale timeline:<br><br>📍 Now → Registration open<br>📍 Jan 3-6 →Infinex Sale<br>📍 Jan 7-13 → Final allocation<br>📍 Late Jan → TGE |
| IT010 | sales-positioning | 2025-12-27 | Why the 1-year lock for the Infinex Sale?<br><br>We lowered the sale price and unlock price to maximise distribution. But we still want conviction. |
| IT011 | sales-positioning | 2026-01-02 | The Infinex sale starts in 24 hours.<br><br>Share your registration card below 👀 |
| IT012 | sales-positioning | 2026-01-02 | Haven't become an Infinex Patron because you don't like NFTs?<br><br>The Infinex sale is your chance to get INX, fungibly. |
| IT013 | sales-positioning | 2026-01-03 | The Infinex Sale is live. |
| IT014 | sales-positioning | 2026-01-09 | ⏰ 23 HOURS LEFT<br><br>Tomorrow is the last opportunity to join the Infinex sale. A new kind of crypto app that feels like a CEX but is self-custodial.<br><br>This is the lowest price INX has ever been sold.<br><br>Closes Sat 5pm AEST · 2pm SGT · 6am UTC · 1am EST |
| IT015 | sales-positioning | 2026-01-10 | @pendle_fi ⏰ 2 HOURS LEFT<br><br>Oversubscribed. |
| IT016 | sales-positioning | 2026-01-10 | @pendle_fi ⏰ 1 HOUR LEFT<br><br>Last orders. |
| IT017 | announcement | 2025-12-22 | Stock perps are now live on Infinex.<br><br>Trade XYZ100 → top 100 US company index. 20x leverage. 24/7.<br><br>Plus TSLA. NVDA. AAPL. GOOGL. HOOD. 19 markets total.<br><br>You can find them in your Infinex Perps dashboard under HIP-3.<br><br>Powered by @HyperliquidX and provided by @tradexyz. |
| IT018 | announcement | 2025-12-22 | For now, these HIP-3 markets have lower Hyperliquid fees.<br><br>◀️ Standard HL: 0.045% + 0.05% builder = 0.095%<br>▶️ HIP-3: 0.009% + 0.05% builder = 0.059%<br><br>Same builder fee. Lower total cost. More crates per dollar 👀<br><br>h/t @KookCapitalLLC → bug fixed |
| IT019 | announcement | 2025-12-23 | LIT pre-market is live on Infinex Perps.<br><br>3x leverage. Live now, before TGE.<br><br>Soon → full Infinex Perps x @Lighter_xyz integration. |
| IT020 | announcement | 2025-12-29 | Silver is live on Infinex Perps.<br><br>Go long or short the second largest asset in the world with 10x leverage.<br><br>→ |
| IT021 | announcement | 2026-01-08 | The Infinex extension is live.<br><br>You can use your whole portfolio in one tab. Connect anywhere across any chain.<br><br>↓ |
| IT022 | announcement | 2026-01-30 | INX is here. |
| IT023 | announcement | 2026-01-30 | Official INX contracts:<br><br>Ethereum 0xdeF1b2D939EdC0E4d35806c59b3166F790175afe<br>Solana inxKXw9V2NDZE7hDijzpJaKKUb97NEPJDTCEEiYg4yY<br>BSC 0x45f55B46689402583073ff227B6ac20520052a24 |
| IT024 | announcement | 2026-01-30 | Where to trade $INX:<br><br>ONCHAIN<br>➞ Infinex - buy INX directly on the platform<br>➞ Ethereum<br>➞ Solana (Provided by Sunrise)<br>➞ BSC<br><br>CEX<br>➞ Coinbase<br>➞ Kraken<br>➞ KuCoin<br>➞ HTX<br>➞ Bitvavo<br>➞ LBank<br>➞ Bybit<br>➞ Binance<br>➞ Gate |
| IT025 | announcement | 2026-02-09 | Infinex 🤝 MegaETH ⚡️<br><br>@MegaETH is now live on Infinex. Day 1.<br><br>You can now bridge to MegaETH through Swidge, and use onchain apps with the Infinex Extension. |
| IT026 | announcement | 2026-02-13 | MegaETH support, bulk move, hardware wallet support and more 🤫<br><br>Here's what's shipped over the past few weeks👇 |
| IT027 | announcement | 2026-02-13 | Hardware wallet support is live.<br><br>You can now connect your @Trezor or @Ledger to Infinex. View those assets in your portfolio. Send and move them, and approve transactions on your device. |
| IT028 | announcement | 2026-02-16 | Infinex is a non-custodial superapp.<br><br>One account. Every chain. Trading, DeFi, wallet, privacy.<br><br>You keep your keys. We handle the complexity. |
| IT029 | announcement | 2026-02-16 | We've already shipped enough to fill two whitepapers.<br><br>CoinGecko did a deep dive on what's live today.<br><br>→ |
| IT030 | announcement | 2026-03-06 | Private Send beta is live for all users.<br><br>Send crypto. Without exposing your financial history.<br><br>Incognito Mode, powered by @HoudiniSwap 🔮<br><br>How it works ↓ |
| IT031 | announcement | 2026-03-30 | Infinex Perps just got an upgrade. @Lighter_xyz is now live.<br><br>Their Commodities Challenge is running right now. 100K LIT prize pool. Gold. Oil. Palladium.<br><br>Trade it all on Infinex. No new account needed. |
| IT032 | thread-anchor | 2026-02-16 | A few months from now, you (or more likely your agent) will mostly use one app.<br><br>You won't think about which chain your coins are on. You won't have a different extension for each wallet. You won't copy-paste addresses or fight with bridges.<br><br>You'll just use crypto, without an [truncated at 280] |
| IT033 | thread-anchor | 2026-02-16 | TGE was the beginning.<br><br>Still to come: Agent infrastructure. Mobile. Infinex Card. Prediction markets. And much more.<br><br>Full roadmap → |
| IT034 | thread-anchor | 2026-03-10 | Recently @kaiynne sat down with @VirtualBacon to talk about why the altcoin market is structurally broken, how agentic loops are changing everything, and why Infinex is building for a world where your agent manages your crypto.<br><br>Full interview and 🧵↓ |
| IT035 | thread-body | 2026-03-10 | The altcoin market is structurally broken<br><br>Perps are the baseline now. Not spot. The UNI fee switch ran from $5 to $10 on pure perp activity, then round-tripped to $3. Zero spot buying.<br><br>Kain's take: There will not be a broad market-agnostic rally in alts ever again |
| IT036 | thread-body | 2026-03-10 | The only tokens that will outperform next cycle are the ones that figure out how to make people want to hold spot again.<br><br>Staking, tokenomics redesign, real yield. Whatever the mechanism, the projects that solve spot holding will go from 90% down to 500x up.<br><br>Everything else s [truncated] |
| IT037 | thread-body | 2026-03-10 | What this looks like in practice:<br><br>- Smart DCA that only buys the dip<br>- Sentiment-driven trading via Grok<br>- Auto-rebalancing lending positions based on yield delta<br>- Liquidation protection that sells in the right order<br><br>You describe the strategy, then your agent executes it |
| IT038 | thread-body | 2026-03-25 | Infinex spent three years solving crypto UX. Then agents changed the question entirely.<br><br>Now it's not about better buttons, it's about having an agent that uses 20+ DEX integrations, every API, and your entire transaction history to work for you. |
| IT039 | thread-body | 2026-03-25 | Every form factor of interaction with technology just got nuked by agents.<br><br>Kain: "No one is going to do all of their own crypto stuff anymore."<br><br>Go back to your wallet in 2021. Pick a random transaction. Tell me why you did it. You can't, but an agent never forgets. |
| IT040 | thread-body | 2026-03-25 | Kain's hot take: eight more months of sideways, capitulation by year-end, four-year cycle validated again.<br><br>2018 built DeFi. 2022 built the infrastructure layer. 2026 builds the agent layer.<br><br>"The noise floor drops. You can really focus on what's actually needed." |
| IT041 | thread-anchor | 2026-04-14 | "Build for the agent six months from now. Not the agent today."<br><br>@kaiynne sat down with @RobertSagurton to talk about how the old world doesn't exist anymore, and what it takes to build for the new one. |
| IT042 | reply-community | 2026-01-03 | @waleswoosh We're like Moby Dick. |
| IT043 | reply-community | 2026-01-30 | @solana I've been waiting for years for this. |
| IT044 | reply-community | 2026-01-30 | Our founder has frontrun us again.<br><br>We call this a skill-horizon. |
| IT045 | reply-peer | 2026-02-09 | @megaeth Down the Rabbithole 🐇 |
| IT046 | reply-community | 2026-02-03 | @0xNairolf Working on it |
| IT047 | reply-community | 2026-03-04 | @CryptoKaleo Luckily, we have one |
| IT048 | one-liner | 2026-02-03 | Everyone is building for AI.<br><br>Not everyone is built for AI.<br><br>🦞 |
| IT049 | one-liner | 2026-02-23 | How many wallets are you managing right now? |
| IT050 | one-liner | 2026-01-29 | Tick, tock. |
| IT051 | cultural | 2026-02-25 | 馬年吉祥 🧧<br><br>This Lunar New Year we're celebrating onchain.<br><br>We're teaming up with @coinbase_au to bring Red Packets to the Infinex community - an ancient tradition of sharing good fortune, now on @base.<br><br>Claim yours 👇<br><br>We've loaded $888 USDC - because 8 is [truncated] |
| IT052 | cultural | 2026-03-02 | Times change. Privacy doesn't. |
