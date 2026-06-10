# GOAL — Proactive Research Lane: the Scout (seeded from the leakage investigation)

**Date:** 2026-06-01
**Status:** extraction / pre-build. Not code yet.
**Source substrate:** `~/Sites/infinex-xyz/platform/leakage/` + the extension-usage docs (`extension-users-post-feb.md`, `.tmp-extension-internal-candidates.md`, `leakage-findings-platform-side.md`). All produced by hand 2026-06-01.

---

## The core realisation

comms-factory's actor–director–grounder cast already runs a **reactive lane**: a thing ships → grounder *verifies* `deployed_facts` → actor *performs* → director *audits* `infinex_fit` → ship. "Say what shipped, truly and on-brand."

The leakage investigation is the **same cast run backwards** — a **proactive lane** that sits *above* the stack and feeds it:

> signal → **Scout** *discovers* a claim worth making → **Director** judges *brand fit of the product move* → **proposal card** (`quantitative_case` + `brand_case`) → Monday review → approve → build → emits a release event → reactive lane.

**Naming (locked 2026-06-01):** the proactive-lane discovery role is the **Scout** — a new cast member alongside Actor / Director / Grounder, *not* a mode of the grounder.

| | Reactive lane (built) | Proactive lane (this lane) |
|---|---|---|
| **Discover / verify** | **Grounder** — verifies a release's `deployed_facts`, emits `FactGroundingResult` | **Scout** — discovers a claim worth making ("$3.38M idle at 0%"). *Distinct role, distinct code.* |
| **Director** | "is this *copy* on-brand & legal?" | "is this *product move* on-brand?" — does it advance *"take responsibility for the tech, so the user only has to want"* / read as Spell→Vision? |
| **Output** | release card → comms | proposal card → Monday go/no-go |

> **Hard rule — Scout ≠ Grounder.** The grounder's job is narrow: verify a claim against sources. The Scout's is open-ended discovery. They **share a tool/source library** (the `platform-analytics` SQL source, the `projectjin` onchain tools, the method-gate rules) but **never share role, prompt, orchestration, or output type.** Bolting discovery logic into `src/fact-grounder-llm.ts` muddies a deliberately narrow role — explicitly out of bounds. The Scout lives in its own `src/scout-*.ts`. This **supersedes** the design doc's *"research mode for free (a new prompt/mode, not new code)"* framing — research mode *is* new code: the Scout. Same discipline as "never collapse generator + validator."

**The leakage run already executed this lane manually** (an Internal Scout run, by hand). Stripping it for parts = harvesting (A) the probe pipeline, (B) the method gates, (C) instance-#1 findings, then building the missing pieces (§ What's built vs to-build).

---

## The Scout — internal + external (two independent signals)

The Scout is **two independent scouts**. They answer different questions from different data and do not depend on each other; a proposal is strongest when both fire, but either can raise one alone.

- **Internal Scout** — Infinex context + Infinex *user* context. Reads our own data (`platform_v2` SQL probes §A.1–6 + the extension-usage cohort). Answers *"what are our users already doing, and where does our money leak?"* → **revealed demand.** The leakage investigation is an Internal Scout run. Inward-looking.
- **External Scout** — the whole-market onchain world; **spots movers before they become big.** Two cheap inputs, *not* a new data tier:
  - **Derived-external (free, already in hand).** The Internal Scout's own tracing/labeling (`03-labels.json` classifying destinations as `defi_protocol`/`cex`/…) *is* an external-protocol map — EtherFi/Aave/Morpho appear because our users sent there. The internal world points to the external world. Demand-weighted, but **lagging** (our users already moved).
  - **Pure-external (one cheap probe).** DeFiLlama-class revenue/fees **last week vs this week → biggest jumps → surface.** Market-wide, **leading** — catches a protocol inflecting *before our users find it*. This is the real "spot before big." One public API probe, not a sources tier.

The signal is in the **gap** between the two:

| | market jump (DeFiLlama) | no market jump |
|---|---|---|
| **our users already there** | *urgent* — they're leaving for something hot | known/mature leak (Internal Scout's core) |
| **users not there yet** | *pure get-ahead-of-it* (the anticipation play) | noise |

Internal Scout = pull from inside ("60 users already leak to lending"). External Scout = push from outside ("this primitive's fees just inflected; integrate ahead of the curve"). Both emit findings → Director brand lens → proposal card.

---

## A. The probe pipeline (Scout toolkit — shared tool library)

§A.1–6 are **Internal Scout** probes (our data); §7–8 are shared enrichment used by both scouts. Every probe hits `mysql_platform_v2_prod` (SQL half) or `projectjin` MCP tools (onchain half). **The onchain half already exists** as tools — today registered for the grounder; the Scout shares the *tool library*, not the grounder's role — (`infinex_get_portfolio`, `infinex_evm_call_rpc`, `infinex_get_transaction_history`, `infinex_web_search`). The SQL half is unlocked by this morning's unbuilt `platform-analytics` source.

**0. Master internal/bot/team exclusion filter — every probe inherits it (NULL-safe).** The prior form silently dropped ~71% of rows (MySQL three-valued logic; email NULL for wallet-only signups). This is a *correctness gate* → goes in `config/platform-data-rules.json`:
```sql
COALESCE(u.is_cwg,0)=0
AND COALESCE(u.email,'') NOT LIKE '%@core.infinex.%'
AND COALESCE(u.suspected_bot,0)=0
AND COALESCE(u.role,'user')='user'
```

**1. L2 capital-outflow by destination** (`transfer` JOIN `user`) → the "label-me" list:
```sql
SELECT to_address, chain,
  SUM(CAST(NULLIF(amount_usd,'') AS DECIMAL(30,2))) AS usd,
  COUNT(*) sends, COUNT(DISTINCT sender) senders
FROM transfer t JOIN user u ON ...
WHERE created_at>='2026-02-01' AND status='success' AND is_move=0
  AND to_address_type IN ('address','addressbook','ens')
  AND /* master filter */
GROUP BY to_address, chain ORDER BY usd DESC
```
`to_address_type='address'`=external; `is_move=0` excludes swidge mirror. `withdrawal_v2` is EMPTY post-Feb — use `transfer`.

**2. L2 outflow-by-chain** — same spine, `GROUP BY chain`. Surfaces consolidate-to-ETH-mainnet-to-exit (68% on Ethereum).

**3. L1 activity-leakage by dApp** (`connect_transaction`, uses `requested_at`) → vertical-demand ranking, `COUNT(DISTINCT user)` per dApp since cutoff.

**4. Swidge self-vs-external split** (`swidge_order_v1`) — bucket same-chain/cross-chain/external, *netting own addresses*. `requested_at`/`filled_at` (no `created_at`); `status='filled'`; `*_usd` is **÷1e6 fixed-point**. Proves swidge ~96% internal plumbing, not leak.

**5. Per-user net-flow leaderboard** — outflow per user + balance-band trajectory (`bmax` lifetime-max vs `brec` recent). `brec << bmax` ⇒ leaking. No USD-inflow ledger exists — band trajectory is the only proxy.

**6. Cohort builder** — SQL on `connect_transaction` JOIN `connect_dapp` (filter category=yield/defi), group by user → `cohort.tsv` shape (`username \t evm_smart_account_address`). The cohort is SQL output, not manual curation.

**7. Portfolio snapshot probe** — `infinex_get_portfolio(addr)` per cohort address → live positions + idle balances (DeBank-backed, **EVM-only — Solana yield invisible**). Pure API, zero LLM. Parse → aggregate (the `parsed.json` shape: per_user, proto_rows, idle_stable_by_user, summary).

**8. Address classifier** — `classify_address(addr, chain) → LabelEntry`. A deterministic decision tree, reconstructable from the `methods_used` log on every label: `eth_getCode` (EOA vs contract) → bytecode pattern + collector one-hop → `get_transaction_history` sweep analysis → Etherscan name-tag → web-search fallback for unlabeled high-$. **Deterministic cases (Etherscan name-tag hit) need no LLM; LLM only for the tail.** Label schema: `{address, chain, classification, entity_name, subtype, confidence, is_contract, collector_address, methods_used, evidence, usd, sends, senders, source, verdict}`. Taxonomy: `cex | smart_account_wallet | self_custody_eoa | btc_destination | market_maker | bridge | defi_protocol | unknown`.

**Address-format preconditions (probe correctness):** `user.evm_*_address` is varbinary → `LOWER(CONCAT('0x',HEX(col)))`; Solana cols are base58, **never `LOWER()`**; Infinex smart accounts have `0x0000…` vanity prefix; nearIntents BTC destinations are `bc1q…` (BTC explorer, not Etherscan). All already in this morning's correction catalog.

**Derived-external (free):** the §A.8 label output (`03-labels.json` shape), aggregated by `classification`/`entity_name`, already *is* an external-protocol demand map — no extra probe. This is the External Scout's lagging, demand-weighted input.

**9. DeFiLlama revenue-delta probe (External Scout, pure-external).** Public DeFiLlama API (`/overview/fees`, `/summary/...`) — pull protocol revenue/fees for two windows (last week vs prior), compute deltas, rank biggest jumps. No auth, no `platform_v2`. The leading signal: a protocol inflecting before our users touch it. Cross-reference against the derived-external map to land in the right cell of the gap table above. (Goes through `fetch_json_api` once `api.llama.fi` is added to `FACT_GROUNDER_JSON_API_ALLOWLIST` — or its Scout equivalent.)

---

## B. The method gates (what makes the numbers trustworthy)

These extend `config/platform-data-rules.json` from *SQL-landmine linting* to *research-method discipline*. They are the proactive-lane equivalent of the validator.

1. **Two-layer decomposition.** Always split **L1 activity-leakage** (funds stay custodied, behaviour leaves → lever = build native feature) from **L2 capital-outflow** (capital exits → lever = retention/off-ramp). Tag every proposal with its layer.
2. **Verified-vs-estimated valuation (load-bearing).** Tag every figure `hard` (stablecoins=$1, BTC/native), `medium` (diffuse token sends), `artifact` (exclude). **Rule: when one row ≥~40% of a headline, independently value it (units × verified market price) before publishing.** `transfer.amount_usd` is trustworthy only for stablecoins. — The $59.3M→$28.7M self-correction (a ~12,000× sETHFI mispricing + DISNEY junk = $30.6M phantom) is why price-verification must be *baked into* the grounder, not bolted on.
3. **Concentration check after any filter swing.** $143M swidge "leak" = 3 accounts / 2 Solana addresses; $24M ether.fi headline = 1 user. Any aggregate that moves materially after a correction gets a concentration check before it's trusted.
4. **Cohort gating on incentive-end-date.** Anchor on 2026-02-01 (incentive end). Fee-per-whale collapsed ~5× post-incentive; pre-cutoff data calibrates to a population the system won't see.
5. **Breadth-first user ranking.** Rank by distinct-dApp count, not tx count, for lock-in analysis (tx count is gamed by one high-frequency integration).
6. **Enumerate exclusion candidates in a separate file before filtering.** The 80-candidate pass classified A (confident-internal, cut) / B (is_cwg on personal email, confirm) / C (matched `%infinex%` but real user, keep) / D (bots) — caught real users with `infinex.` forwarding addresses who'd otherwise be wrongly excluded.
7. **Two-population tagging.** Separate retail/power-user churn (→ product/yield lever) from fund/MM treasury ops (→ OTC/treasury-terms lever). Label by email domain (wintermute.com, bodhi.ventures…).
8. **Snapshot-vs-flow awareness.** Live position scans read $0 for cyclers — the asset is often the *idle balance*, not the deployed position.
9. **Adversarial label verification on high-$ labels** (11/12 passed). Deposit-forwarder one-hop trace: never web-search a leaf deposit address; trace its sweep-to collector first.

**Known gaps to inherit (state them, don't hide them):** no USD-inflow ledger in this DB (net-flow is band-proxy only); DeBank is EVM-only (Solana yield — Kamino/marginfi/Jupiter-lend — unmeasured); balances are banded not exact; off-platform commingling invisible.

---

## C. Instance #1 — the first proposal cards (corrected $)

The ranked capturable-value list IS the first Monday-review batch. `brand_case` sketched against the super-objective; director would author the real one.

| Rank | Proposal | `quantitative_case` | `brand_case` (sketch) |
|---|---|---|---|
| 1 | **Default-on yield on idle balances** (Aave/Sky/Morpho/Maple under the hood) | "$3.38M sits idle at 0%; lending is the #1 vertical users leave the UI for (Aave 43, Morpho 7, Sky 6, Ether.Fi 6 ≈ 60 ext users). Make idle earn by default." | Textbook super-objective — Infinex takes responsibility for the yield plumbing; the user only has to *want* a return. |
| 2 | **Native fiat off-ramp + reason-to-stay** | "Users cash out ~$6.44M/4mo (~$19M/yr) to CEXes in stablecoins, Binance-led ($3.17M). The #1 *real* exit." | Absorb the exit the user currently manages via Binance. |
| 3 | **Native ETH liquid staking** (stETH/weETH-style) | "Only broad-demand yield primitive: ether.fi weETH 17 wallets + Lido ~10. Rest is whale-concentrated." | One-tap staking, no bridge. |
| 4 | **Embedded / AA wallet parity** | "$2.26M migrates to embedded AA wallets (Bankr/Privy/ZeroDev/Safe) — AA-native users Infinex should own." | These users already chose the AA thesis Infinex is built on. |
| 5 | **Native lending/yield + spot DEX aggregation (L1)** | "Top connect verticals leave only the UI (Uniswap 16, Jupiter 14); native routing keeps session + fees on-platform." | Don't make users leave to swap. |
| 6 | **Native BTC hold/yield** | "Users exit the ecosystem entirely for ~$1.25–1.69M of BTC via NEAR Intents." | Hold BTC without leaving. |
| — | **Token-claim manager** (extension) | "Magna: 26 users, 235 claim txs — a recurring high-frequency job for airdrop-eligible users." | Own the claim flow. |
| — | **AI agent tx co-pilot** (extension) | "Venice: highest tx density of any external dApp (27.7 txs/user, 9 users) — AI-power users signing through the extension." | Novel surface; unserved. |
| ✗ | **Perps — DEFEND, don't build** | "Synthetix 18 / Hyperliquid 8 / Aster 5, but only ~$0.83M L2. Infinex already ships perps — this is a UX/discovery gap, not a product gap." | n/a — defend existing. |
| ✗ | **MM/treasury terms** (separate lever) | "Wintermute $1.36M, Bodhi $0.71M drain via treasury ops, not churn." | OTC/treasury terms, not consumer features. |

**The Explorer cohort is a cross-cutting asset:** 14 power users running 8–28 dApps through the extension ($3K–$1M+ balances) = the highest-conversion audience for *every* native launch. They already use the extension as their signing layer.

---

## D. Throwaway (keep the technique, discard the rows)

- The v1 headline ("$24M→ether.fi Cash", "$59.3M total") — phantom from the sETHFI mispricing + DISNEY junk. Keep the one-hop forwarder-trace *technique*; discard the dollar conclusions.
- Hand-traced sETHFI forwarder chains (specific `0xe405c5…` etc.) — one-off manual cross-validation.
- The $143M swidge artifact / DISNEY burn / `210`/`hatchy` rows — keep concentration-check + value-the-big-row, discard the rows.
- Per-user leaderboards with emails/handles — PII snapshot; the *query shape* is reusable, the rows are not.
- MegaETH airdrop-farmer labels — expire with that campaign.

---

## What's built vs. to-build

| Piece | State |
|---|---|
| Onchain enrichment (portfolio snapshot, address RPC, tx history, web search) | **Built** — shared `projectjin` tool library |
| SQL probe access to `platform_v2` | **Designed, not built** — `platform-analytics` source (`DESIGN-2026-06-01-platform-analytics-grounding-source.md`) + `PLATFORM_V2_READONLY_URL` |
| Method gates as machine-readable rules | **Partial** — `config/platform-data-rules.json` exists for SQL landmines; extend with §B gates |
| `classify_address()` routine + cohort→snapshot→parse orchestration | **Exists as a hand-run pipeline; needs code** |
| **Internal Scout** role (own prompt/orchestration/output; emits a finding, not a card) | **New** — `src/scout-internal-*.ts`, replaces the superseded "research mode" framing |
| **External Scout** role (spot-before-big) | **New** — `src/scout-external-*.ts`; inputs = reuse the §A.8 label aggregation (derived-external, free) + one DeFiLlama revenue-delta probe (§A.9, cheap). Not the market-data tier first assumed. |
| Director's **product-proposal brand lens** (judge an *integration* against super-objective, not copy) | **New — the genuinely missing piece** |
| **Proposal-card** type (sibling to release card; `quantitative_case` + `brand_case`) + Monday-review surface | **New** |

**De-risking:** every probe in §A is proven, every gate in §B is battle-tested (including its own failure modes), and §C is instance-#1 output that already exists. The lane is mostly assembly of existing parts + the new abstractions: the **Scout** (internal + external), the product-proposal lens, and the proposal card. Both scouts are near-term: the Internal Scout's substrate is proven, and the External Scout reduces to reusing the §A.8 label aggregation (free) plus one DeFiLlama revenue-delta probe (§A.9, cheap) — not the market-data tier first assumed.
