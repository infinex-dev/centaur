---
type: launch # launch | explainer | weekly-update
release_id: "hyperliquid-spot-2026-05-20"
release_kind: "launch-tier"
status: draft # draft | reviewed | approved
ship_date: "2026-05-20"
owner: "<human owner>"

audience:
  - "web"
  - "x"
touchpoints:
  - "web"
  - "x"
  - "telegram"
  - "website-blog"
  - "website-modal"
  - "email"
  - "press"

canonical_url: "https://infinex.xyz/news/hyperliquid-spot-2026-05-20"
slug: "hyperliquid-spot-2026-05-20"
tags:
  - <tag>
related_posts: []

deployed_facts:
  - "Infinex previously offered swap-routing spot (swidge) but no CLOB spot order book — this launch is the first CLOB spot on Infinex"
  - "spot CLOB trading venue provider: Hyperliquid"
  - "Hyperliquid market type for spot trading: CLOB (Central Limit Order Book) — same architecture as perps"
  - "21 Hyperliquid spot markets have >$100K 24h volume; 298 exist on-chain but most had zero or negligible volume — do not use 298 as a market count in copy"
  - "Hyperliquid spot market: HYPE/USDC — $97.57M 24h volume (highest; native HL token, no U-prefix)"
  - "Hyperliquid spot market: UBTC/USDC (Unit Bitcoin, wrapped BTC) — $26.91M 24h volume"
  - "Hyperliquid spot market: UZEC/USDC (Unit Zcash, wrapped ZEC) — $8.39M 24h volume"
  - "Hyperliquid spot market: UETH/USDC (Unit Ethereum, wrapped ETH) — $4.21M 24h volume"
  - "Hyperliquid spot market: USOL/USDC (Unit Solana, wrapped SOL) — $2.73M 24h volume"
  - "Hyperliquid spot market: PURR/USDC — $2.34M 24h volume"
  - "Hyperliquid spot UI: Spot and Perps are distinct sub-accounts with separate balances; Deposit, Withdraw, Transfer between them are distinct in-product actions"
  - "Hyperliquid official X/Twitter handle: @HyperliquidX"
  - "perps trading venue provider: Hyperliquid"

proof_links:
  product: "<url>"
  docs: "<url>"
  source: "<url>"

non_assertable_context:
  reader_prior: "<what the reader probably assumes before this>"
  through_action: "to <verb> <object>"
  obstacle: "<what makes the announcement hard to understand or believe>"
  not_the_point: "<boring framing to avoid>"
---

# Spot CLOB trading live on Hyperliquid via Infinex

<Dek / standfirst: 1-2 factual sentences under the headline. This is the TL;DR.>

## Fact Box

| Field | Value |
|---|---|
| Live date | 2026-05-20 |
| Product / surface | Spot CLOB trading live on Hyperliquid via Infinex |
| Supported assets / chains / markets | <from deployed_facts, or "not announced"> |
| Fees / limits / regions | <from deployed_facts, or "not announced"> |
| User action | <what a user can do now> |

## What shipped

<2-4 short paragraphs. Explain the actual change. No launch throat-clearing.>

## How it works

<2-4 short paragraphs. Explain the mechanism using only deployed_facts.>

## What to know

- <constraint, risk, availability detail, or "not announced">
- <constraint, risk, availability detail, or "not announced">
- <constraint, risk, availability detail, or "not announced">

## What happens next

<Only name future work if it is committed in deployed_facts. Otherwise: "More details will be published as they ship.">

## FAQ

### <Question a real user will ask>

<Answer from deployed_facts. If not known, say what is not announced.>

### <Question a real user will ask>

<Answer from deployed_facts. If not known, say what is not announced.>

---

## Touchpoint Adaptations

These are adaptations of the canonical page, not separate source material.

### X

<One post, <=280 chars. Fact first. Link to canonical page.>

### Telegram

<One short paragraph. Slightly more conversational than X. Link to canonical page.>

### Website Modal

Headline: <80 chars>
Body: <140 chars>
CTA: <2-4 words>

### Email

Status: draft only / not sendable until marketing email infrastructure exists.

Subject: <50 chars>
Preheader: <90 chars>
Body:
<Short email. One fact-led opening, 1-2 bullets if needed, one CTA to canonical page.>

### Press

Press path: no-pitch | reactive-only | pitch
Angle: <why a journalist would care, if relevant>
Quote needed: yes | no
Notes: <embargo, partner approval, compliance constraints>

---

## For AI Agents

- Markdown: `https://infinex.xyz/news/hyperliquid-spot-2026-05-20.md`
- Facts: `<deployed_facts manifest URL>`
- Ask: `https://infinex.xyz/news/hyperliquid-spot-2026-05-20?ask=<question>`
- Related: `<related post URL>`

## Human Review Checklist

- [ ] Every asserted claim appears in `deployed_facts`.
- [ ] Unknowns are named as "not announced" rather than invented.
- [ ] X, Telegram, modal, email draft, and press all point back to the same canonical page.
- [ ] Email remains draft only / not sendable until bulk stream + updates.infinex.xyz infrastructure exists.
- [ ] No auto-posting. Human approval required per touchpoint.
- [ ] Validator passes for public short copy.
- [ ] Partner/compliance approval captured if needed.
