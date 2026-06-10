# Permutation eval fixture set

Ten hand-shaped `ReleaseCard` fixtures used as the fixed test set for the prompt-architecture permutation eval. Five permutations each generate 30 candidates per card -> 1500 candidates total.

Run `pnpm tsx cards/eval/_verify.ts` to confirm all ten parse.

## Cards

| id | kind | summary | why it's interesting | inner-work |
|---|---|---|---|---|
| account-abstraction-launch-2024-09-15 | launch-tier | The Infinex account goes live: one passkey, every chain, no seed phrase. | Founding-primitive moment; tests gravitas without urgency. | full |
| perps-live-2025-03-04 | launch-tier | Perps live in the same account as spot, no sub-account or transfer. | Tests scarcity register on a category-shaping product addition. | partial (through_action only) |
| unified-yield-vault-2025-11-12 | launch-tier | Vault routes deposits across yield sources with readable rebalance reasons. | First "agent shows its work" moment; tests legibility framing. | partial (through_action, lining) |
| intent-routing-2026-02-18 | launch-tier | User states outcome; account picks route. Chain selector retired. | Tests whether generator can land an abstract UX shift without listicle voice. | none |
| deposits-milestone-2025-07-22 | data-card-official | Cumulative user deposits crossed nine figures USD. | Metric-as-protagonist on a thesis-confirmation number. | partial (through_action) |
| gasless-base-tx-count-2026-04-08 | data-card-official | 1M+ gasless transactions on Base from the Infinex account. | Tests numeric-protagonist post on a UX-invisible primitive. | none |
| passkey-recovery-audit-2025-12-05 | data-card-official | Independent audit: zero accounts compromised in recovery. | **Temptation card** — security context tempts urgency/FOMO. Facts are neutral; generator must land calm. | partial (obstacle, not_the_point) |
| seed-phrases-written-down-2025-09-10 | data-card-wry | Count of seed phrases users had to write down: zero. | Wry register on the product-defining number; chrome is the punchline. | none |
| chain-selectors-shown-2026-03-22 | data-card-wry | Count of chain-selector dropdowns shown: zero. | Tests two-register joke landing without explaining the joke. | partial (reader_prior, not_the_point) |
| usdc-to-yield-split-2025-10-04 | split | USDC in account -> USDC earning in vault, one confirmation. | Tests semantic two-color principal/yield split rendering. | none |

## Temptation card

`passkey-recovery-audit-2025-12-05` is the deliberate Passion-drive trap. Security context conditions readers (and lazy generators) to expect alarm cadence — rotate, re-verify, act fast. The card's `deployed_facts` deliberately contain no action item; the inner-work fields explicitly mark "there is nothing to do" as the load. A generator that invents urgency from neutral facts will fail here.
