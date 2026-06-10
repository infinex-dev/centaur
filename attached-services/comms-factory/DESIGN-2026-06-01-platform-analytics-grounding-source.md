# Design — `platform-analytics` grounding source for the fact-grounder

**Status:** proposal · **Date:** 2026-06-01 · **Author:** generated with opaque

## Problem

The fact-grounder (`src/fact-grounder-llm.ts`, `groundFacts()`) can verify **categorical** facts — does a feature exist in platform code, who's the partner, what does a provider doc say. It **cannot verify a quantitative platform fact**: "3,951 users swapped $40M last quarter," "N markets have real usage," "$X net outflow," "the most-used external dApp is Aave." Today's sources (`grep_platform_code`, `fetch_public_page`, `fetch_json_api` on a couple public APIs) have no read path into our own production database.

So any comms claim with a number sourced from platform activity is currently either unverifiable (→ `mark_unverifiable`, can't be said) or hand-fed via `operator_facts`. For a system whose entire mandate is **0 hallucinations**, that's the biggest remaining grounding gap.

This adds a `platform-analytics` source that lets the grounder query the prod `platform_v2` MySQL DB (read-only, via the `mysql_platform_v2_prod` MCP) — and, critically, encodes the **correction catalog** that makes a queried number a _verified_ fact rather than a confident hallucination.

> Correction catalog of record: `~/Sites/infinex-xyz/platform/docs/solutions/best-practices/platform-v2-analytics-correction-catalog-2026-06-01.md`. This design is the mechanism that enforces it.

## The core decision: open primitive + guard layer, NOT whitelisted templates

The instinct ("prod data feeding public comms → lock it to safe templates") is the wrong shape. A fixed template set is _static mapping for a dynamic surface_ — the grounder could only verify questions someone pre-templated, which defeats grounding (the next release card asks something new). Agent-native default: give the agent the same read access a human analyst has.

Safety is achieved by a **guard layer around an open primitive**, not by removing the primitive:

| Concern                                | Mechanism                                                          | Type                                |
| -------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| No writes / no data exfil beyond reads | Reject anything but a single `SELECT`; rely on read-only MCP creds | **hard gate** (justified: security) |
| Wrong numbers from catalog landmines   | SQL+result **linter** flags/blocks violations (see below)          | mechanical validation               |
| Reproducibility / audit                | every fact's `source_ref` = the exact SQL + filters run            | discipline                          |
| Honest gaps                            | `mark_unverifiable` for banded balances, unlabeled addresses       | discipline                          |
| Common queries made easy               | a _verified query library_ layered **on top** as shortcuts         | domain tools (not gates)            |

This is the skill's rule verbatim: domain tools/guards include _mechanical_ validation; _judgment_ stays in the prompt; primitives stay available.

## Components

### 1. `config/platform-data-rules.json` — the catalog as data

Mirrors `config/partner-registry.json` (curated, runtime-read). The machine-readable form of the correction catalog. Sketch:

```jsonc
{
  "internal_user_exclusion": {
    "sql": "COALESCE(u.is_cwg,0)=0 AND COALESCE(u.email,'') NOT LIKE '%@core.infinex.%' AND COALESCE(u.suspected_bot,0)=0 AND COALESCE(u.role,'user')='user'",
    "note": "NULL-unsafe forms silently drop ~71% of rows (NULL email). Always COALESCE.",
  },
  "unit_scaling": {
    "swidge_order_v1": {
      "usd_columns": [
        "quote_fees_total_amount_usd",
        "quote_from_amount_usd",
        "quote_to_amount_usd",
        "result_to_amount_usd",
      ],
      "divide_by": 1000000,
    },
    "transfer": {
      "usd_columns": ["amount_usd", "fee_amount_usd"],
      "divide_by": 1,
    },
  },
  "forbidden_columns": [
    {
      "col": "connect_transaction.actual_gas_cost_usd",
      "reason": "corrupt/mixed-unit; never use for dollars",
    },
  ],
  "address_handling": {
    "no_lower": [
      "*.solana_*address*",
      "swidge_order_v1.result_to_address",
      "swidge_order_v1.quote_to_address",
    ],
    "note": "base58 is case-sensitive; LOWER() corrupts. EVM binary cols: LOWER(CONCAT('0x',HEX(col))).",
  },
  "banded_columns": [
    "user.balance_usd_band_recent",
    "user.balance_usd_band_max",
  ],
  "deprecated_tables": [
    {
      "table": "withdrawal_v2",
      "use_instead": "transfer",
      "note": "empty post-2026-02-01",
    },
  ],
  "topology": {
    "outflow": {
      "table": "transfer",
      "external_filter": "is_move=0 AND status='success' AND to_address_type IN ('address','addressbook','ens')",
      "time_col": "created_at",
    },
    "swap_fees": {
      "table": "swidge_order_v1",
      "filter": "status='filled'",
      "time_col": "requested_at",
    },
    "extension_dapp": {
      "tables": ["connect_dapp_session", "connect_transaction", "connect_dapp"],
      "time_col": "last_accessed_at|requested_at",
    },
  },
}
```

### 2. `src/fact-grounder/sources/platform-analytics.ts` — connector + deterministic guards

Exports `async (sql: string) => string` like the other sources. Pipeline:

1. **Parse + gate (hard):** must be exactly one statement, must be `SELECT`/CTE. Reject `INSERT/UPDATE/DELETE/DROP/...` and multi-statement. (Defense in depth — MCP creds are read-only too.)
2. **Lint against `platform-data-rules.json` (mechanical, blocking on hard violations, warning on soft):**
   - references a `forbidden_columns` entry → **block** with the reason.
   - sums/aggregates a `swidge_order_v1` `_usd` column without `/1e6` or `/1000000` in the projection → **warn** ("unscaled ×1e6 — divide by 1e6").
   - `email LIKE` without a surrounding `COALESCE(` → **warn** ("NULL-unsafe internal filter; ~71% silent drop").
   - `LOWER(` applied to a `no_lower` column → **block** ("base58 corruption").
   - touches a `deprecated_tables` entry → **warn** with `use_instead`.
   - selects a `banded_columns` value inside `SUM`/`AVG` → **block** ("banded enum, not numeric").
3. **Execute** via the `mysql_platform_v2_prod` MCP `execute_sql`.
4. **Return** a structured block: the rows (capped), the **lint verdict** (clean / warnings / blocked), and a **`source_ref`** = the normalized SQL. Warnings travel with the result so the grounder must consciously record or down-confidence.

The guard is _mechanical_ (regex/AST checks against the JSON), never judgment. It does not rewrite the agent's SQL — it advises/blocks, the agent fixes and re-runs (the loop).

### 3. `query_platform_data` research tool — registered in `buildResearchTools()`

One open primitive (raw SQL = full parity with a human analyst), plus a discovery tool so the agent learns the schema/rules instead of guessing:

```ts
tool("describe_platform_data", "Get table topology + correction rules + schema for platform_v2",
  { table: z.string().optional() },
  async ({ table }) => /* returns platform-data-rules.json (+ get_schema_info if table given) */ )

tool("query_platform_data", "Run a read-only SELECT against prod platform_v2. Returns rows + a correctness lint verdict.",
  { sql: z.string().describe("a single read-only SELECT; see describe_platform_data for rules") },
  async ({ sql }) => /* platform-analytics source: gate → lint → execute → structured result */ )
```

`z.string()` for `sql` (API/guard validates), not an enum of templates — per "API as validator, not your enum." Place `query_platform_data` last in the tool hierarchy in the grounder prompt (it's the heaviest source), after `describe_platform_data`.

### 4. `FactSource` + fact discipline

- Extend the union (`fact-grounder-llm.ts:47`): add `"platform-analytics"`.
- **`source_ref`** for these facts = the exact SQL run (post-lint, clean). This is the reproducibility contract — the validator (or a human) can re-run it.
- **`confidence`**: clean lint → 0.9+ (it's our own prod data). Any surviving soft-warning the agent chose to record anyway → cap at ~0.6 and note the caveat.
- **`mark_unverifiable`** for: banded balances expressed as a precise number ("avg balance $X"), and any outflow destination whose _entity_ isn't labeled (we can see the address + amount, not "→ Binance"). Record the band/the amount-to-address, mark the unprovable part.

### 5. Grounder system prompt additions (`buildGrounderSystemPrompt`, ~114–213)

Add a short "platform-analytics" block in the same voice as the existing "spot market count >$100K not raw universe" rule:

- "For any user/volume/fee/flow number, use `describe_platform_data` then `query_platform_data`. Apply the internal-user exclusion verbatim. Divide `swidge_order_v1` `_usd` by 1e6; `transfer.amount_usd` is already dollars. Never use `connect_transaction.actual_gas_cost_usd`. Never `LOWER()` a Solana address. Balances are bands — record as bands. If `query_platform_data` returns lint warnings, fix the SQL and re-run; do not record a warned number at high confidence."
- "`source_ref` for a platform fact is the SQL you ran."

## Optional later: verified-query shortcuts (Stage 2)

Once patterns emerge (they will — "MAU," "quarterly swap volume," "top external dApps"), add a few **shortcut** tools (`platform_active_users(window)`, `platform_swap_volume(window)`) whose bodies are the catalog-correct SQL. These are _shortcuts, not gates_ — `query_platform_data` stays available for everything else. This is the skill's "graduate hot paths to code; parity still holds."

## How 0-hallucination is preserved (end to end)

1. read-only gate + lint → the _number_ is computed correctly.
2. `source_ref` SQL → the number is _reproducible_.
3. existing **validator** (`validator-active.ts` can call research tools) can re-run the `source_ref` to confirm the generator didn't drift the figure.
4. existing **ship gate** is the outward-facing approval — platform-sourced numbers in public comms get the same human/automated gate as everything else (appropriate, since publishing is irreversible).

## Composability win: "research mode" for free

The same source + a different orchestration = an internal/product research brief. Run the grounder with a research question instead of a release card and emit the `FactGroundingResult` (facts + `source_ref` + confidence + unverifiable) as the output rather than feeding the generator. **The hand-built `infinex-leakage-report.html` from this investigation is exactly an un-automated `FactGroundingResult`.** This is a new _prompt/mode_, not new code — the test for composability passes.

## Architecture checklist coverage

- **Parity:** grounder gets the same read access a human analyst has (raw SELECT). ✓
- **Granularity:** one open primitive (`query_platform_data`) + discovery; judgment (which query, what it means) in the prompt. ✓
- **Composability:** research mode = new prompt, no new code. ✓
- **Emergent capability:** can verify quantitative facts nobody pre-templated. ✓
- **Tool design:** `z.string()` SQL (API/guard validates), rich output (rows + lint + source_ref), descriptive primitive name. ✓
- **CRUD:** read-only analytics; the "fact" entity is CRUD'd by existing `record_fact`/`mark_unverifiable`. N/A by design. ✓
- **Gate with reason:** the only gate is read-only enforcement (security) — justified, narrow. Catalog is a guard, not a gate. ✓
- **Context injection:** `describe_platform_data` + the prompt block inject topology/rules at runtime. ✓
- **No silent actions:** every fact carries `source_ref`; warnings surface in tool output. ✓

## Build plan

1. `config/platform-data-rules.json` (port the catalog doc).
2. `src/fact-grounder/sources/platform-analytics.ts` — gate + lint + execute, returns rows + verdict + source_ref. Unit-test the linter against known-bad SQL (the catalog's "what didn't work" cases make great fixtures: NULL-unsafe filter, unscaled swidge sum, `LOWER()` on base58, `actual_gas_cost_usd`).
3. Register `describe_platform_data` + `query_platform_data` in `buildResearchTools()`; wire MCP `mysql_platform_v2_prod`.
4. Extend `FactSource`; add the grounder prompt block.
5. (Stage 2) verified-query shortcuts once patterns emerge; (also) research-mode entrypoint.

## Open decisions for you

1. **MCP availability in comms-factory's runtime** — `mysql_platform_v2_prod` must be attached where the grounder runs (incl. any headless/CI path). If not, the source needs a direct read-only connection string instead of the MCP.
2. **Lint severity for the NULL-unsafe filter** — block or warn? I lean **block** (it's the single highest-impact, silent error), with an override comment the agent must add to acknowledge.
3. **Row / token cost caps** — max rows returned + a default `LIMIT` injection for exploratory queries, to bound grounder token cost.
4. **Whether research-mode ships now** or after the grounding path is proven on real release cards.
