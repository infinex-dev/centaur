# Scout: where does money go when it leaves Infinex?
2026-06-01 · Internal Scout · cohort gate: post-2026-02-01
> Run against this morning's **captured** leakage data (`~/Sites/infinex-xyz/platform/leakage/`), not a fresh pull — live SQL is blocked until the `mysql_platform_v2_prod` MCP is attached to this project. Numbers are the corrected (post-valuation-gate) figures.

## Headline
The #1 *real* exit is CEX cash-out in stablecoins — **~$6.44M/4mo (~$19M/yr), Binance-led ($3.17M)** — and the deepest retention lever is **yield on $3.38M of idle balances**, which is *also* the #1 thing users leave the UI to do (lending). [confidence: hard / medium]

## 1. Capturable value, ranked
| # | opportunity | layer | quantitative_case | disp. |
|---|---|---|---|---|
| 1 | Default-on yield on idle balances | L1 | $3.38M idle at 0%; lending = #1 vertical left for (≈60 users) | build |
| 2 | Native fiat off-ramp | L2 | ~$6.44M/4mo (~$19M/yr) CEX cash-out, Binance-led | build |
| 3 | Native ETH liquid staking | L1 | only broad-demand yield primitive (weETH 17, Lido ~10) | build |
| 4 | Embedded / AA wallet parity | L2 | $2.26M to Bankr/Privy/ZeroDev/Safe | build |
| 5 | Native lending + spot DEX aggregation | L1 | DEX 35 users (Uniswap 16, Jupiter 14, KyberSwap 5) | build |
| 6 | Native BTC hold/yield | L2 | ~$1.25M BTC exit via NEAR Intents | build |
| 7 | Perps | L2 | Synthetix 18/HL 8/Aster 5 but only ~$0.83M — UX gap, not product gap | **defend** |
| 8 | MM/treasury terms | L2 | Wintermute $1.36M, Bodhi $0.71M — treasury ops, not churn | monitor |

## 2. L1 — activity leakage (funds stay custodied, behaviour leaves)
Lending leads by distinct users (Aave 43 > Morpho 7 > Sky 6 > Ether.Fi 6), then DEX (Uniswap 16, Jupiter 14, KyberSwap 5), then perps (Synthetix 18, Hyperliquid 8). The #1 vertical by breadth = the #1 native-feature candidate. Funds never leave custody — only the session and the fees do.

## 3. L2 — capital outflow, gravity wells (corrected $)
| destination class | $ | addrs |
|---|---|---|
| market_maker | $144.2M | 6 | ← **EXCLUDED** (swidge-solver artifact; Gate 4 concentration: 6 addrs, not retail exit) |
| smart_account_wallet | $26.2M | 36 | (of which ether.fi Cash $23.9M — separated; embedded-AA subset ≈$2.26M) |
| cex | $6.44M | 37 |
| self_custody_eoa | $5.36M | 32 |
| btc_destination | $1.25M | 13 |
| unknown | $1.47M | 21 |
| bridge | $0.18M | 2 |
| defi_protocol | $0.06M | 1 |

## 4. Method, verified vs estimated, and what the data can't see
- **Probes**: P1 (transfer outflow-by-destination) + classify_address; P3 (connect_transaction dApp leakage); P5 (per-user net-flow); P6+P7 (cohort + portfolio snapshot). Full SQL in each ProposalCard's `probes_run`.
- **Valuation (Gate 2)**: stablecoin/CEX figures are `hard`; idle-balance and token-y figures `medium`. The v1 "$59.3M / $24M→ether.fi" headline was an **artifact** (~12,000× sETHFI mispricing + DISNEY junk = $30.6M phantom) — excluded. `market_maker $144M` excluded as swidge-solver flow (Gate 4).
- **Can't see**: no USD-inflow ledger (net-flow is band-proxy); DeBank EVM-only (Solana yield invisible); balances banded; off-platform commingling invisible.

## Proposal seeds (→ Director brand-case → Monday review)
Each row above is a `ProposalCard` in `proposals.json`, validated against `src/scout/card.ts` (8/8). Next step is the Director's `brand_case` pass — e.g. #1 (idle yield) is a textbook super-objective fit: Infinex takes responsibility for the yield plumbing so the user only has to *want* a return. #7 (perps) is explicitly **defend, don't build**.
