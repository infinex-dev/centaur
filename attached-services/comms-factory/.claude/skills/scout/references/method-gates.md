# Scout method gates

The disciplines that make a Scout number trustworthy. Apply before any figure lands in a brief. These exist because the 2026-06-01 run hit every one of these traps; they are the scar tissue.

## Correctness gates (non-negotiable)

**G0 — Execution boundary.** SQL runs through the `mysql_platform_v2_prod` MCP, a *session* tool. If `execute_sql` isn't available, it isn't attached to this workspace — STOP and ask the operator to attach it in superset. Never silently skip a probe and present a partial brief as complete.

**G1 — NULL-safe master filter.** Wrap every probe (see `probes.md`). The non-COALESCE form silently drops ~71% of rows.

**G2 — Verified-vs-estimated valuation (load-bearing).** Tag every figure: `hard` (stablecoins=$1, BTC/native at spot), `medium` (diffuse token sends — residual mispricing risk), `artifact` (exclude). **When one row is ≥~40% of a headline, independently value it (units × verified market price) before publishing.** `transfer.amount_usd` is trustworthy only for stablecoins. The first run published $59.3M; ~$30.6M was phantom — one token mispriced ~12,000× plus a junk "DISNEY" balance. A confident wrong number is worse than an unknown.

**G3 — Unit/format traps.** `swidge *_usd ÷ 1e6`; never `LOWER()` a base58 (Solana) address; `withdrawal_v2` is empty (use `transfer`). (Full list in `probes.md`.)

## Interpretation gates

**G4 — Concentration check after any swing.** When a filter/correction moves a number materially, check concentration before trusting it. The $143M "swidge leak" was 3 accounts / 2 Solana addresses; a $24M "ether.fi" headline was 1 user. Report "$X across N senders (top-3 = Y%)", never just "$X".

**G5 — Two-layer decomposition.** Split **L1 activity-leakage** (funds stay custodied, behaviour leaves the UI → lever = build a native feature) from **L2 capital-outflow** (capital physically exits → lever = retention / off-ramp). Tag every finding with its layer; they imply different builds.

**G6 — Enumerate exclusions before filtering.** On a high-stakes run, pull exclusion candidates into a list first and classify: confident-internal (cut), `is_cwg=1` on personal email (confirm), matched `%infinex%` but real user (keep), suspected bot. Prevents cutting real users with `infinex.`-forwarding addresses.

**G7 — Two-population tagging.** Separate retail/power-user churn (→ product/yield lever) from fund/MM treasury ops (→ OTC/treasury-terms lever) by email domain (wintermute.com, bodhi.ventures, …). They are not the same signal.

**G8 — Snapshot-vs-flow.** Live position scans read $0 for cyclers (flat at snapshot time). The asset is often the **idle balance**, not the deployed position.

**G9 — Breadth-first ranking.** Rank users by distinct-dApp count, not tx count, for lock-in analysis — tx count is gamed by one high-frequency integration.

**G10 — Label discipline.** Adversarially re-verify high-$ destination labels. Deposit-forwarder one-hop trace: never web-search a leaf deposit address; trace its sweep-to collector first, then name-tag the collector.

## Caveats to carry into every brief (what the data can't see)

- No USD-inflow ledger — net-flow is a band-trajectory proxy only.
- DeBank is EVM-only — Solana yield (Kamino/marginfi/Jupiter-lend) is unmeasured.
- Balances are banded, not exact.
- Off-platform commingling is invisible.
