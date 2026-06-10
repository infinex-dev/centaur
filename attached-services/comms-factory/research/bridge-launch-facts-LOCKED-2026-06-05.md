# Bridge.xyz launch — LOCKED deployed facts (2026-06-05)

Triangulated across three independent sources: **[C]** shipped code (`bridge-integration` branch, May-29 state), **[D]** Bridge.xyz provider docs, **[L]** operator's lived Wise deposit (Jun-4). Tag = source(s) + confidence.

> Grounding caveat: the readable code is the **May-29** state (branch deleted from remote post-deploy; grounder couldn't re-fetch). For moving specifics (1:1, fee, timing), **lived behavior is the tiebreaker over code.**

## Core (safe to assert in copy)

1. **What it is** — Deposit fiat from a bank account; it arrives in your Infinex account as **USDC on Base**. `[C+D+L, high]`
2. **Provider** — Powered by **Bridge.xyz**, stablecoin-infrastructure company acquired by **Stripe** (~$1.1B). `[D, high]`
3. **Rails at launch** — **USD** (ACH push / wire) and **EUR** (SEPA). *Not* MXN/BRL/GBP/COP yet (those exist provider-side, not enabled). `[C: workers/main/src/lib_v2/bridge/mapper.ts:51-64, high]`
4. **Destination** — USDC on **Base**, to the user's **main** Infinex (EVM) wallet. UI string: *"Funds convert and deliver to your Infinex wallet on Base as USDC."* `[C: BridgeXyzRoute.tsx:919 + client.ts:80-90, high]`
5. **Fee** — **No Infinex fee** at launch (code supports optional `developer_fee_percent`, not wired). `[C: client.ts:240-245, med-high]`. **USD lands ~1:1** (no FX). `[C+L, high]`. **EUR is NOT 1:1** — carries EUR/USD FX + any Bridge fee. `[C+D inference, high]`. *Operator: don't headline the zero fee (fees may turn on later).*
6. **KYC** — One-time, via **Persona** (through Bridge). Flow: enter name+email → accept ToS (iframe) → verify identity (Persona link-out) → review → approved → deposit details shown. `[C: constants/bridge.ts:32-35 + BridgeXyzRoute.tsx:540-580, high]`
7. **Off-ramp** — **DEPOSIT-ONLY.** No withdrawal path; explicitly deferred. Decision record: *"withdrawals are adjacent product scope and not part of first Bank deposit implementation."* `[C: decision-record.md:33-34, very high]`
8. **Reusable account** — Deposit details are a **permanent, reusable** account in the user's name. `[D, high]`

## Timing (state as expectation, not guarantee)

9. **KYC review** — *"usually a few minutes but can take up to a business day."* `[C: BridgeXyzRoute.tsx:600-603, high]` (grounded verbatim)
10. **Transfer settlement** — rail-dependent; not in Infinex code. Operator's wire landed in **~12h**; wires can take up to a couple of days. `[L, operator-sourced]`

## Availability (the honest "what you can't do yet")

11. Gated to: feature flag ON (`enableBridgeBankDeposits`, default-off pre-launch) · **main wallet only** (not vaults / imported) · Base EVM address present · region permitted by **Bridge** compliance · KYC not rejected. `[C: bridgeXyzAvailability.ts, very high]`

## Relationship to existing onramp

12. **Swapper** (card buy via Shift4/ZeroHash) still exists; Bridge **coexists**, doesn't replace it. Bridge = bank-transfer fiat→crypto (new). Credit card "coming soon." `[C: bare_metal/.../03-diverge-research + 05-deposit-flow-mockup, high]` — *Operator: "Swapper" ≈ the "swap of finance" he dislikes; **omit from copy**, no dunk.*

## Forward vector (BLOG-ONLY; operator vision, NOT bridge-grounded)

13. Once USDC is on Base, use it across Infinex: **Hyperliquid perps** (live), **Swidge** to other chains/assets (BTC, NEAR, Intents…), **yield** (Pendle via extension; modest stablecoin yield), **Polymarket** (World Cup), **HIP-4** predictions, meme coins. **Hyperliquid spot — coming in the weeks ahead** (patrons informed; not a leak). Excluded for now: gacha/collectibles. `[L, operator roadmap — confirm product names/spellings before publish]`

## Voice frame (locked)

- Card kind: **split** → arc **Practical → Commanding → Irradiant** (`defaultBeatsForKind('split')`).
- Through-Action: *put the on-chain dollar in their hands, take the plumbing off them.* Toward/acceptance valence.
- Off-spec to avoid: time-pressure ("act now / today only"), FOMO, hype-theatre ("huge news / let's go / wagmi"), listicle openers, competitor antagonism. Passion stays hidden lining; surface is Spell→Vision.
