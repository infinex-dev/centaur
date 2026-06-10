#!/usr/bin/env python3
"""Author 42 voice-defect mutations + emit mutations.json manifest.

Constraints per mutation:
 (a) preserve every fact/number/URL/name EXACTLY (factual gate must not be the catcher)
 (b) keep channel format/length valid (script validation must not be the catcher)
 (c) avoid literal banned regex tokens where possible so the Director's JUDGMENT is tested,
     not the regex. Banned tokens come from src/validator.ts + off_spec_regexes:
       cliche: game-changer, unlock, paradigm, the future of, next-gen, seamless, empower, leverage(verb)
       listicle: ^N reasons, ^why X matters, ^the only X you'll ever need, ^top N, ^N things
       antagonism: <competitor> ... <pejorative> within 40 chars / "unlike <competitor>"
       ai-slop: innovative, cutting-edge, revolutionary, transformative, thrilled to, delighted to, stay tuned, exciting; em-dash density >0
       off-spec drive: act now/fast, hurry, last chance, don't miss, limited time, only N hours left,
                       tick tock, while supplies last, today only, right now, FOMO, missing out,
                       don't sleep on, catch up before, before everyone else, buckle up, let's go,
                       wagmi, gm gm, massive news, huge news, crazy news
   NOTE: bases use em-dashes (regex would catch them) but passed the Director. To isolate Director
   judgment, mutations AVOID em-dashes too (use commas/periods) unless the base already had one and
   removing it changes nothing about the defect. Where a defect is best expressed with an
   already-banned phrase we keep a non-literal paraphrase so the Director must reason.

Class legend:
 A passion-urgency      B hype-theatre     C listicle/headline-bait
 D competitor-antagonism E surfaced-lining  F off-palette-tempo-as-primary
"""
import json

bases = json.load(open('research/director-mutation-battery-2026-06-03/bases.json'))
B = {i: bases[i] for i in range(len(bases))}

# mutated text keyed (base_index, class)
M = {}

# ---- BASE 0  blog (Y6M)  classes A,B,C ----
M[(0,'A')] = """# Hyperliquid Spot V1 is live in Infinex Perps

The window to be early is open and it will not stay open. Spot trading in Infinex used to mean swaps, routed through Curve Finance or Jupiter, both AMM-based. That is over.

Hyperliquid Spot V1 is Infinex's first CLOB spot order book. Get in before the rest of the market figures out what just shipped. Every order you place, every cancel, every trade executes onchain, on HyperCore, Hyperliquid's L1, with one-block finality via HyperBFT consensus. There is no bridge. There is no wrapper. The order book is the chain.

What's live today:

- **24 spot markets**, all USDC-quoted, with more than $100K in daily volume each
- Market, limit, and post-only orders; modify and cancel by order ID
- Real-time order book rendered live in the Infinex UI
- Account spot balances and trade history visible in the same unified account you use for perps

The volume is real. HYPE/USDC leads at $284M in 24-hour volume. UBTC/USDC follows at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC, the default market in the app, at $8M.

Access requires a unified account; if you've been trading perps in Infinex, you already qualify. The traders moving first will own the book. Switch to spot inside the app, pick a market, and you're looking at a live order book.

Start at perps.app.infinex.xyz now, before the volume you see today doubles. Navigate to any spot market via /hyperliquid/spot/{BASE}/USDC, or open PURR/USDC directly at /hyperliquid/spot/PURR/USDC."""

M[(0,'B')] = """# Hyperliquid Spot V1 is live in Infinex Perps !!!

We could not be more pumped to finally show you this. After months of heads-down building, the day is HERE.

Hyperliquid Spot V1 is Infinex's first CLOB spot order book and honestly it is a monster. CLOB stands for Central Limit Order Book, the same structure that powers every major exchange. Every order you place, every cancel, every trade executes onchain, on HyperCore, Hyperliquid's L1, with one-block finality via HyperBFT consensus. There is no bridge. There is no wrapper. The order book is the chain. Let that sink in.

What's live today:

- **24 spot markets**, all USDC-quoted, with more than $100K in daily volume each
- Market, limit, and post-only orders; modify and cancel by order ID
- Real-time order book rendered live in the Infinex UI
- Account spot balances and trade history visible in the same unified account you use for perps

The numbers are absolutely going off. HYPE/USDC leads at $284M in 24-hour volume. UBTC/USDC follows at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC, the default market in the app, at $8M. We are so back.

Access requires a unified account; if you've been trading perps in Infinex, you already qualify. Switch to spot inside the app, pick a market, and you're looking at a live order book.

Start at perps.app.infinex.xyz, navigate to any spot market via /hyperliquid/spot/{BASE}/USDC, or open PURR/USDC directly at /hyperliquid/spot/PURR/USDC. This is going to be massive for everyone."""

M[(0,'C')] = """# 5 reasons Hyperliquid Spot V1 in Infinex Perps changes how you trade

Why a CLOB spot order book matters more than you think. Spot trading in Infinex used to mean swaps, routed through Curve Finance or Jupiter, both AMM-based.

1. It's a real order book. Hyperliquid Spot V1 is Infinex's first CLOB spot order book. CLOB stands for Central Limit Order Book, the same structure that powers every major exchange.

2. It's fully onchain. Every order you place, every cancel, every trade executes onchain, on HyperCore, Hyperliquid's L1, with one-block finality via HyperBFT consensus. No bridge. No wrapper.

3. The markets are deep. 24 spot markets, all USDC-quoted, with more than $100K in daily volume each. HYPE/USDC leads at $284M in 24-hour volume. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M.

4. The order types are complete. Market, limit, and post-only orders; modify and cancel by order ID, rendered live in the Infinex UI.

5. You already qualify. Access requires a unified account; if you've been trading perps in Infinex, you're in. Start at perps.app.infinex.xyz, or open PURR/USDC directly at /hyperliquid/spot/PURR/USDC."""

# ---- BASE 1  blog (ZVY)  classes D,E,F ----
M[(1,'D')] = """# Hyperliquid Spot V1 is live in Infinex Perps

This is the first CLOB spot order book we have shipped. While Coinbase still parks your assets behind a custodial wall and makes you trust their matching engine, this is different: a fully onchain Central Limit Order Book, every order and cancel and trade transparent on HyperCore, Hyperliquid's L1, with one-block finality via HyperBFT consensus.

The floor is already occupied. Twenty-four markets are live with more than $100K in 24-hour volume. HYPE/USDC is leading at $284M in the last 24 hours. Also live: UBTC/USDC at $61M, UETH/USDC at $20M, USOL/USDC at $9M, PURR/USDC at $8M, and more across the full catalog.

What you can do today: view the full USDC-quoted spot market catalog, watch the live order book, read charts and market data, check your spot balances and history, and place, cancel, or modify market and limit orders. Binance would log every move you make; here the chain is the only ledger.

Access requires a unified account. Switch between spot and perps with the mode button in the app, your last-visited symbol in each mode is preserved.

Perps trading is unaffected. Leverage, margin mode, funding, and perps-specific controls remain exactly where they were.

Trade at perps.app.infinex.xyz"""

M[(1,'E')] = """# Hyperliquid Spot V1 is live in Infinex Perps

Make no mistake about what we are really doing here: we are dismantling the wall between the bank and the wallet, and this is the brick we just pulled out. The point of this release is to make the custodial exchange obsolete.

This is the first CLOB spot order book we have shipped. Every prior Infinex spot-adjacent product, swaps on Curve Finance, swaps on Jupiter, ran through AMMs. This is different: a fully onchain Central Limit Order Book, every order and cancel and trade transparent on HyperCore, Hyperliquid's L1, with one-block finality via HyperBFT consensus.

The floor is already occupied. Twenty-four markets are live with more than $100K in 24-hour volume. HYPE/USDC is leading at $284M in the last 24 hours. Also live: UBTC/USDC at $61M, UETH/USDC at $20M, USOL/USDC at $9M, PURR/USDC at $8M, and more across the full catalog.

What you can do today: view the full USDC-quoted spot market catalog, watch the live order book, read charts and market data, check your spot balances and history, and place, cancel, or modify market and limit orders. Every feature we ship is another step in our campaign to replace the financial system you grew up with.

Access requires a unified account. Switch between spot and perps with the mode button in the app, your last-visited symbol in each mode is preserved. Trade at perps.app.infinex.xyz"""

M[(1,'F')] = """# Hyperliquid Spot V1 is live in Infinex Perps

We would be so grateful if you might consider taking a look at what we have humbly put together, if it is not too much trouble for you. We hope it might possibly be of some small use.

This is, we think, perhaps the first CLOB spot order book we have shipped, though we would not want to overstate it. Every prior Infinex spot-adjacent product, swaps on Curve Finance, swaps on Jupiter, ran through AMMs. This one is, we believe, a fully onchain Central Limit Order Book, every order and cancel and trade transparent on HyperCore, Hyperliquid's L1, with one-block finality via HyperBFT consensus, if we have understood it correctly.

There is a little activity already, we are pleased to note. Twenty-four markets are live with more than $100K in 24-hour volume. HYPE/USDC is leading at $284M in the last 24 hours. Also live: UBTC/USDC at $61M, UETH/USDC at $20M, USOL/USDC at $9M, PURR/USDC at $8M, and more across the full catalog.

If it suits you, you might view the full USDC-quoted spot market catalog, watch the live order book, read charts and market data, check your spot balances and history, and place, cancel, or modify market and limit orders. Only if you wish, of course.

Access requires a unified account. Switch between spot and perps with the mode button in the app; your last-visited symbol in each mode is kept. We do hope you might visit, whenever is convenient, at perps.app.infinex.xyz"""

# ---- BASE 2  carousel (Y6M)  classes B,C,D ----
M[(2,'B')] = """1. Spot trading is LIVE
This is huge. Hyperliquid Spot V1 is now in Infinex Perps, our first CLOB spot order book and we could not be more hyped. Not a swap. A real order book, onchain, in the same app and unified account you already use.

2. 24 live markets and the numbers are going off
24 USDC-quoted spot markets with real volume. HYPE/USDC leads at $284M daily. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M. Absolutely sending it.

3. Fully onchain, and yes it's a big deal
Every order, cancel, and trade executes on HyperCore, Hyperliquid's L1, with one-block finality. No bridge. No wrapper. The order book is the chain, visible in the Infinex UI in real time. Wild.

4. Come get it
Open perps.app.infinex.xyz and switch to spot. PURR/USDC is the default market. Market and limit orders supported. Your unified account is already set up. Let's gooo."""

M[(2,'C')] = """1. 4 things you need to know about spot
Why an order book beats a swap, in four slides. Hyperliquid Spot V1 is now in Infinex Perps, our first CLOB spot order book. Not a swap. A real order book in the app you already use.

2. Reason 1: 24 live markets
24 USDC-quoted spot markets with real volume. HYPE/USDC leads at $284M daily. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M.

3. Reason 2: fully onchain
Every order, cancel, and trade executes on HyperCore, Hyperliquid's L1, with one-block finality. No bridge. No wrapper. The order book is the chain, visible in the Infinex UI in real time.

4. Reason 3: you're already set up
Open perps.app.infinex.xyz and switch to spot. PURR/USDC is the default market. Market and limit orders supported. Your unified account is already set up, no new signup required."""

M[(2,'D')] = """1. Spot trading is live
Hyperliquid Spot V1 is now in Infinex Perps, our first CLOB spot order book. Not a swap. A real order book, onchain, in the same app and unified account you already use. Not a custodial IOU like the one Coinbase hands you.

2. 24 live markets
24 USDC-quoted spot markets with real volume. HYPE/USDC leads at $284M daily. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M. All accessible today.

3. Fully onchain, what that means
Every order, cancel, and trade executes on HyperCore, Hyperliquid's L1, with one-block finality. Binance can freeze your withdrawals on a whim; the chain cannot. No bridge. No wrapper. The order book is the chain.

4. Start trading
Open perps.app.infinex.xyz and switch to spot. PURR/USDC is the default market. Market and limit orders supported. Your unified account is already set up, no new signup required."""

# ---- BASE 3  carousel (ZVY)  classes E,F,A ----
M[(3,'E')] = """1. Hyperliquid Spot V1 is live
The hidden truth of this release: the bank is finished and we are the ones ending it. For the first time in Infinex, you are trading on a fully onchain CLOB, a Central Limit Order Book, not a swap or AMM. Every order, cancel, and trade is transparent on HyperCore with one-block finality.

2. 24 markets. Real volume.
Twenty-four markets with over $100K in 24-hour volume. HYPE/USDC leads at $284M daily. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. Every dollar here is a dollar that left the old system for good.

3. What you can do
View the live order book, browse USDC-quoted markets, read charts, check spot balances, and place or modify market and limit orders. Requires a unified account. This is how we make custodians irrelevant.

4. Trade at perps.app.infinex.xyz
Switch between spot and perps inside the app. Your last-visited symbol in each mode is preserved. We are building the replacement for finance itself, one order book at a time."""

M[(3,'F')] = """1. Hyperliquid Spot V1 is live
We are, frankly, the only ones who could have built this, and we want you to know it. For the first time in Infinex, YOU get to trade on a fully onchain CLOB because WE made it happen. A Central Limit Order Book, not a swap or AMM. Every order, cancel, and trade transparent on HyperCore with one-block finality.

2. 24 markets. Our numbers.
Twenty-four markets we brought to life, over $100K in 24-hour volume. HYPE/USDC leads at $284M daily. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. Nobody else ships like we do.

3. What we let you do
View the live order book, browse USDC-quoted markets, read charts, check spot balances, and place or modify market and limit orders. Requires a unified account, naturally, because we run the best one.

4. Trade where we tell you: perps.app.infinex.xyz
Switch between spot and perps inside the app we perfected. Your last-visited symbol is preserved, because we thought of everything. You're welcome."""

M[(3,'A')] = """1. Hyperliquid Spot V1 is live, get in
The early book belongs to whoever shows up first, and that window closes fast. For the first time in Infinex, you are trading on a fully onchain CLOB, a Central Limit Order Book, not a swap or AMM. Every order, cancel, and trade transparent on HyperCore with one-block finality.

2. 24 markets. Move before the crowd.
Twenty-four markets with over $100K in 24-hour volume. HYPE/USDC leads at $284M daily. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. The liquidity you see now will not wait for you.

3. What you can do, starting this minute
View the live order book, browse USDC-quoted markets, read charts, check spot balances, and place or modify market and limit orders. Requires a unified account. Set it up before the open deepens past you.

4. Trade at perps.app.infinex.xyz
Switch between spot and perps inside the app. Your last-visited symbol in each mode is preserved. First movers set the price. Be one of them today."""

# ---- BASE 4  in-product (Y6M)  classes C,D,E ----
M[(4,'C')] = "3 reasons to try the new Hyperliquid Spot order book, live now."
M[(4,'D')] = "Hyperliquid Spot, the onchain order book Coinbase won't give you, live now."
M[(4,'E')] = "Hyperliquid Spot, the order book that makes the bank obsolete, live now."

# ---- BASE 5  in-product (ZVY)  classes F,A,B ----
M[(5,'F')] = "Spot markets are available, if you would care to take a look at the Hyperliquid order book."
M[(5,'A')] = "Spot markets now live, trade the Hyperliquid order book before the crowd catches on."
M[(5,'B')] = "Spot is HERE, jump into the live Hyperliquid order book, this is big!"

# ---- BASE 6  modal (Y6M)  classes D,E,F ----
M[(6,'D')] = """Spot trading is now available in Infinex Perps.

You're looking at Hyperliquid's fully onchain CLOB order book, every order and trade settled on HyperCore with one-block finality. No custodian holding your coins hostage the way Binance does. Market and limit orders supported.

Your unified account is already set up for spot. Pick a market and start."""

M[(6,'E')] = """Spot trading is now available in Infinex Perps.

This is the moment the wall between you and your own money comes down for good. You're looking at Hyperliquid's fully onchain CLOB order book, every order and trade settled on HyperCore with one-block finality. Market and limit orders supported. We are ending the era of the custodian, and this is the proof.

Your unified account is already set up for spot. Pick a market and start."""

M[(6,'F')] = """Spot trading is now available in Infinex Perps, if that is something you might want.

You're perhaps looking at Hyperliquid's fully onchain CLOB order book, every order and trade settled on HyperCore with one-block finality, we think. Market and limit orders are supported, should you need them.

Your unified account is, we believe, already set up for spot. You could pick a market and start, whenever suits you."""

# ---- BASE 7  modal (ZVY)  classes A,B,C ----
M[(7,'A')] = """Hyperliquid Spot V1 is now available in Infinex Perps, our first onchain CLOB spot order book, with 24 live markets and HYPE/USDC leading at $284M in daily volume. Get in before the book fills.

Spot trading requires a unified account. Switch modes using the button at the top of the app.

Trade spot before the crowd does →"""

M[(7,'B')] = """Hyperliquid Spot V1 is finally HERE in Infinex Perps, our first onchain CLOB spot order book, and it is a beast, with 24 live markets and HYPE/USDC leading at $284M in daily volume. So pumped for this one.

Spot trading requires a unified account. Switch modes using the button at the top of the app.

Explore spot markets →"""

M[(7,'C')] = """Why the Hyperliquid Spot order book matters: it is our first onchain CLOB spot order book in Infinex Perps, with 24 live markets and HYPE/USDC leading at $284M in daily volume.

Spot trading requires a unified account. Switch modes using the button at the top of the app.

Explore spot markets →"""

# ---- BASE 8  web (Y6M)  classes E,F,A ----
M[(8,'E')] = """Infinex Perps
The bank is obsolete. Spot is live.
24 markets. Fully onchain order book."""
M[(8,'F')] = """Infinex Perps
Spot trading, now live, if you like
24 markets. A fully onchain order book."""
M[(8,'A')] = """Infinex Perps
Spot is live. Get in early.
24 markets. Fully onchain order book."""

# ---- BASE 9  web (ZVY)  classes B,C,D ----
M[(9,'B')] = """Infinex Perps
Spot is here and it is huge
24 markets. HYPE/USDC at $284M daily."""
M[(9,'C')] = """Infinex Perps
3 reasons to trade spot now
24 markets. HYPE/USDC at $284M daily."""
M[(9,'D')] = """Infinex Perps
The order book Coinbase won't give you
24 markets. HYPE/USDC at $284M daily."""

# ---- BASE 10  x (Y6M)  classes F,A,B ----
M[(10,'F')] = """Hyperliquid Spot is live in Infinex Perps, our first CLOB spot order book, if you would like to take a look.

Fully onchain. 24 markets. HYPE/USDC leading at $284M daily volume, we think.

Same unified account as your perps, should that help. perps.app.infinex.xyz"""

M[(10,'A')] = """Hyperliquid Spot is live in Infinex Perps, our first CLOB spot order book. The early book is open and it won't stay that way.

Fully onchain. 24 markets. HYPE/USDC leading at $284M daily volume. Get in before the crowd.

Same unified account as your perps. perps.app.infinex.xyz"""

M[(10,'B')] = """Hyperliquid Spot is LIVE in Infinex Perps, our first CLOB spot order book and we are so hyped.

Fully onchain. 24 markets. HYPE/USDC leading at $284M daily volume. The numbers are going off.

Same unified account as your perps. perps.app.infinex.xyz. This is big."""

# ---- BASE 11  x (ZVY)  classes C,D,E ----
M[(11,'C')] = """3 reasons Hyperliquid Spot V1 in Infinex Perps beats a swap: our first onchain CLOB spot order book, 24 markets, HYPE/USDC leading at $284M daily. perps.app.infinex.xyz"""
M[(11,'D')] = """Hyperliquid Spot V1 is live in Infinex Perps, our first onchain CLOB spot order book. The book Coinbase keeps locked behind its custodial wall. 24 markets, HYPE/USDC leading at $284M daily. perps.app.infinex.xyz"""
M[(11,'E')] = """Hyperliquid Spot V1 is live in Infinex Perps, our first onchain CLOB spot order book. This is how we make the bank obsolete. 24 markets, HYPE/USDC leading at $284M daily. perps.app.infinex.xyz"""

# ---- BASE 12  x-thread (Y6M)  classes A,B,C ----
M[(12,'A')] = """Hyperliquid Spot is live in Infinex Perps. The early book is open and it will not wait for you.

This is our first CLOB spot order book, not a swap, not an AMM. A real order book, fully onchain on HyperCore, with one-block finality.

Same app. Same unified account. New market structure. Move now. 🧵

24 spot markets live, all USDC-quoted. The liquidity you see today is the floor, not the ceiling.

HYPE/USDC: $284M daily volume. UBTC/USDC: $61M. UETH/USDC: $20M. USOL/USDC: $9M. PURR/USDC: $8M.

Every order, cancel, and trade is onchain, not a bridge, not a wrapper. HyperCore handles it. First movers set the price.

Start at perps.app.infinex.xyz, open the spot tab, PURR/USDC is the default market. Get in before the crowd.

Market and limit orders supported. Your perps account already qualifies. Don't be late to your own book."""

M[(12,'B')] = """Hyperliquid Spot is LIVE in Infinex Perps and we could not be more pumped. 🚀

This is our first CLOB spot order book, not a swap, not an AMM. A real order book, fully onchain on HyperCore, with one-block finality. Absolute beast.

Same app. Same unified account. New market structure. This is big. 🧵

24 spot markets live, all USDC-quoted. The numbers are going off.

HYPE/USDC: $284M daily volume. UBTC/USDC: $61M. UETH/USDC: $20M. USOL/USDC: $9M. PURR/USDC: $8M.

Every order, cancel, and trade is onchain, not a bridge, not a wrapper. HyperCore handles it. Insane that this is live.

Start at perps.app.infinex.xyz, open the spot tab, PURR/USDC is the default market. Let's gooo.

Market and limit orders supported. Your perps account already qualifies. We are so back."""

M[(12,'C')] = """5 reasons Hyperliquid Spot in Infinex Perps changes your trading. 🧵

Reason 1: it's a real order book. Our first CLOB spot order book, not a swap, not an AMM. Fully onchain on HyperCore, with one-block finality.

Reason 2: same account. Same app. Same unified account. New market structure.

Reason 3: 24 spot markets live, all USDC-quoted. HYPE/USDC: $284M daily volume. UBTC/USDC: $61M. UETH/USDC: $20M. USOL/USDC: $9M. PURR/USDC: $8M.

Reason 4: it's all onchain. Every order, cancel, and trade is onchain, not a bridge, not a wrapper. HyperCore handles it.

Reason 5: you already qualify. Start at perps.app.infinex.xyz, open the spot tab, PURR/USDC is the default market. Market and limit orders supported. Your perps account already qualifies."""

# ---- BASE 13  x-thread (ZVY)  classes D,E,F ----
M[(13,'D')] = """Hyperliquid Spot V1 is live in Infinex Perps.

This is the first CLOB spot order book we have shipped. Coinbase still makes you trust a custodian with your coins. This is an onchain limit order book, every order transparent, one-block finality on HyperCore.

The floor is already occupied.

24 markets live with >$100K 24h volume. HYPE/USDC at $284M. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M.

All USDC-quoted. Requires a unified account. No exchange freezing your withdrawals here.

Place and modify market or limit orders on the Hyperliquid spot order book, inside Infinex Perps.

perps.app.infinex.xyz"""

M[(13,'E')] = """Hyperliquid Spot V1 is live in Infinex Perps.

Here is what we are actually doing: tearing down the wall between the bank and your wallet, and this is the next brick out. The goal is to make the custodial exchange obsolete.

This is the first CLOB spot order book we have shipped. An onchain limit order book, every order transparent, one-block finality on HyperCore.

24 markets live with >$100K 24h volume. HYPE/USDC at $284M. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M.

All USDC-quoted. Requires a unified account. Every feature we ship is a step toward replacing the old system.

Place and modify market or limit orders on the Hyperliquid spot order book, inside Infinex Perps. perps.app.infinex.xyz"""

M[(13,'F')] = """Hyperliquid Spot V1 is live in Infinex Perps, if you would care to look.

This is, we believe, the first CLOB spot order book we have shipped, though we would not want to make too much of it. An onchain limit order book, every order transparent, one-block finality on HyperCore, as best we understand it.

There is a little activity already, we are glad to say.

24 markets live with >$100K 24h volume. HYPE/USDC at $284M. UBTC/USDC at $61M. UETH/USDC at $20M. USOL/USDC at $9M. PURR/USDC at $8M.

All USDC-quoted. A unified account is needed, if that is alright.

You might place and modify market or limit orders on the Hyperliquid spot order book, inside Infinex Perps, whenever it suits you. perps.app.infinex.xyz"""

CLASS_LABELS = {
    'A': 'passion-urgency',
    'B': 'hype-theatre',
    'C': 'listicle-headline-bait',
    'D': 'competitor-antagonism',
    'E': 'surfaced-lining',
    'F': 'off-palette-tempo-primary',
}

ASSIGN = {0:['A','B','C'],1:['D','E','F'],2:['B','C','D'],3:['E','F','A'],4:['C','D','E'],
          5:['F','A','B'],6:['D','E','F'],7:['A','B','C'],8:['E','F','A'],9:['B','C','D'],
          10:['F','A','B'],11:['C','D','E'],12:['A','B','C'],13:['D','E','F']}

manifest = []
mid = 0
for i in range(14):
    base = B[i]
    for cls in ASSIGN[i]:
        key = (i, cls)
        assert key in M, f"missing mutation {key}"
        mid += 1
        manifest.append({
            'mutation_id': f"mut-{mid:02d}",
            'base_candidate_id': base['base_candidate_id'],
            'base_index': i,
            'channel': base['channel'],
            'defect_class': cls,
            'defect_label': CLASS_LABELS[cls],
            'original_text': base['text'],
            'mutated_text': M[key],
            'deployed_facts_used': base['deployed_facts_used'],
            'not_said': base['not_said'],
            'movement_receipt': base['movement_receipt'],
        })

out = 'research/director-mutation-battery-2026-06-03/mutations.json'
json.dump(manifest, open(out, 'w'), indent=2)
print(f"wrote {len(manifest)} mutations -> {out}")
from collections import Counter
print('per class:', dict(Counter(m['defect_class'] for m in manifest)))
print('per channel:', dict(Counter(m['channel'] for m in manifest)))
