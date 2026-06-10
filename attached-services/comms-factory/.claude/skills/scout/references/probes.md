# Scout probe library

Ready-to-run SQL against `platform_v2` (via `execute_sql`). Every probe inherits the **master filter** below. All proven in the 2026-06-01 leakage run.

## Master internal/bot/team filter (NULL-safe — wrap EVERY probe)

A prior version (`NOT (u.is_cwg=1 OR u.email LIKE '%@core.infinex.%')`) silently dropped ~71% of rows: MySQL three-valued logic makes `NULL NOT LIKE …` → NULL → row excluded, and email is NULL for wallet-only signups. Always COALESCE:

```sql
COALESCE(u.is_cwg,0)=0
AND COALESCE(u.email,'') NOT LIKE '%@core.infinex.%'
AND COALESCE(u.suspected_bot,0)=0
AND COALESCE(u.role,'user')='user'
```

Before applying it on a high-stakes run, enumerate exclusion candidates separately (see Gate 6) — team members on personal email (`is_cwg=1`) and real users with `infinex.`-forwarding addresses are both edge cases the filter alone gets wrong.

## Schema preconditions (correctness, not style)

- `transfer` is the **live outflow spine**. `withdrawal_v2` is EMPTY post-Feb (deprecated) — never query it.
- `transfer.amount_usd` is a clean real-USD string → `CAST(NULLIF(amount_usd,'') AS DECIMAL(30,2))`. Trustworthy only for stablecoins (Gate 2).
- `swidge_order_v1.*_usd` is **÷1e6 fixed-point** — divide. Timestamps are `requested_at`/`filled_at` (no `created_at`); `status='filled'`.
- `connect_transaction` uses `requested_at`.
- `user.evm_*_address` is varbinary → `LOWER(CONCAT('0x', HEX(col)))`. Solana cols are base58 — **never `LOWER()`** (corrupts the address). Infinex smart accounts have a `0x0000…` vanity prefix. nearIntents BTC destinations are `bc1q…` (BTC explorer, not Etherscan).
- `is_move=0` excludes internal/swidge-mirror movements. `to_address_type='address'` = external counterparty.

---

## P1 — L2 capital-outflow by destination (the "label-me" list)

```sql
SELECT t.to_address, t.chain,
  SUM(CAST(NULLIF(t.amount_usd,'') AS DECIMAL(30,2))) AS usd,
  COUNT(*) AS sends, COUNT(DISTINCT t.sender) AS senders
FROM transfer t JOIN user u ON t.from_user_id = u.id
WHERE t.created_at >= '2026-02-01' AND t.status = 'success' AND t.is_move = 0
  AND t.to_address_type IN ('address','addressbook','ens')
  AND COALESCE(u.is_cwg,0)=0 AND COALESCE(u.email,'') NOT LIKE '%@core.infinex.%'
  AND COALESCE(u.suspected_bot,0)=0 AND COALESCE(u.role,'user')='user'
GROUP BY t.to_address, t.chain
ORDER BY usd DESC
LIMIT 200;
```
Feed the top rows to `classify-address.md` to build the gravity-well map. (Adjust `from_user_id`/`sender` column names to the live schema if they differ — confirm with a quick `DESCRIBE transfer` if unsure.)

## P2 — L2 outflow by chain

P1's spine with `GROUP BY t.chain`. Surfaces the consolidate-to-ETH-mainnet-to-exit pattern (~68% on Ethereum = classic CEX-offramp / cold-storage).

## P3 — L1 activity-leakage by dApp (revealed demand)

```sql
SELECT d.name AS dapp, COUNT(DISTINCT c.user_id) AS users, COUNT(*) AS txs
FROM connect_transaction c
JOIN connect_dapp d ON c.dapp_id = d.id
JOIN user u ON c.user_id = u.id
WHERE c.requested_at >= '2026-02-01'
  AND COALESCE(u.is_cwg,0)=0 AND COALESCE(u.email,'') NOT LIKE '%@core.infinex.%'
  AND COALESCE(u.suspected_bot,0)=0 AND COALESCE(u.role,'user')='user'
GROUP BY d.name
ORDER BY users DESC, txs DESC;
```
Cluster results into verticals post-hoc (lending: Aave+Morpho+Sky+Ether.Fi; DEX: Uniswap+Jupiter+KyberSwap; perps: Synthetix+Hyperliquid+Aster). The #1 vertical by distinct users is the #1 build candidate. Funds stay custodied — only the behaviour leaves. (Confirm `connect_transaction`/`connect_dapp` join columns against the live schema.)

## P4 — Swidge self-vs-external split

`swidge_order_v1`, `status='filled'`, `*_usd ÷ 1e6`, bucket same-chain (rotation) / cross-chain (self-bridge) / external, **netting the user's own addresses**. Only ~68/149k post-Feb have a cleared `result_to_address` (labeling viable for those). Proves swidge is ~96% internal plumbing, not a leak — run it before calling swidge volume a "leak".

## P5 — Per-user net-flow leaderboard

Outflow per user (P1 spine, `GROUP BY from_user_id`) + balance-band trajectory: `bmax` (lifetime-max band) vs `brec` (recent band). `brec << bmax` ⇒ leaking. There is **no USD-inflow ledger** — band trajectory is the only proxy. Tag funds/MMs separately (Gate 7).

## P6 — Cohort builder

```sql
SELECT u.username, LOWER(CONCAT('0x', HEX(u.evm_smart_account_address))) AS account
FROM connect_transaction c
JOIN connect_dapp d ON c.dapp_id = d.id
JOIN user u ON c.user_id = u.id
WHERE c.requested_at >= '2026-02-01'
  AND d.category IN ('yield','defi','lending')
  AND COALESCE(u.is_cwg,0)=0 AND COALESCE(u.email,'') NOT LIKE '%@core.infinex.%'
  AND COALESCE(u.suspected_bot,0)=0 AND COALESCE(u.role,'user')='user'
GROUP BY u.id;
```
Outputs the `username \t account` cohort (the `cohort.tsv` shape) → feed to P7.

## P7 — Portfolio snapshot (onchain, no LLM)

For each cohort account: `projectjin --agent --json tool call infinex_get_portfolio --input '{"address":"<account>"}'`. Parse `positions` + `tokenBalances`; use `usdValue.net`. Separate stable vs non-stable, deployed vs **idle** (idle stablecoin balance is usually the real asset — Gate 8). DeBank-backed → **EVM-only, Solana yield invisible**.
