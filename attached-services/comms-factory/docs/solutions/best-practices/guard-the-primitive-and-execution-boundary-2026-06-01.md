---
title: Agent tool design over dynamic surfaces — guard the primitive, and enumerate the execution boundary
date: 2026-06-01
category: best-practices
module: fact-grounder
problem_type: best_practice
component: tooling
severity: high
related_components:
  - database
  - development_workflow
applies_when:
  - Designing a tool an agent can call against a live data surface (SQL, shell, filesystem, HTTP API)
  - Choosing between a query-template whitelist and an open query primitive
  - Prototyping with session-scoped tools (MCP servers, IDE plugins, session creds) before handing off to a standalone process
  - Designing least-privilege read access for an analytics DB that feeds public-facing output
tags:
  - fact-grounder
  - platform-analytics
  - agent-tool-design
  - sql-guard
  - execution-boundary
  - mcp
  - open-primitive
  - least-privilege
---

# Agent tool design over dynamic surfaces — guard the primitive, and enumerate the execution boundary

## Context

The comms-factory fact-grounder (`src/fact-grounder-llm.ts`, tools registered in `src/research-tools.ts`, sources under `src/fact-grounder/sources/`) verifies claims in release copy against real sources, which execute **in-process** (`execFile`/`fetch`). It could ground categorical facts (code, partner registry, pages) but had no way to verify **quantitative** platform metrics — user counts, swap volumes, APY — which live in `platform_v2`, a MySQL analytics DB.

Designing that new grounding source surfaced two paired design failure modes. They are orthogonal in subject (one is API-surface design, one is runtime topology) but share an origin, cross-reference each other, and are triggered by the same moment — "I'm adding a DB-backed grounding source to an LLM pipeline" — so they are documented together.

The `platform_v2` landmines this design guards against were hardened during the earlier **leakage investigation** in the platform repo (session history), where the DB was queried interactively via a `mysql_platform_v2_prod` MCP server. That investigation produced the companion correction catalog (see Related). Critically, the investigation ran *entirely inside a Claude Code session* — which is exactly why it never hit Technique B's boundary problem, and exactly why this design did.

---

## Guidance

### Technique A — "Guard the primitive, don't cage it"

**Trigger:** You are about to whitelist a set of pre-approved operation templates to "keep the agent safe."

**Failure mode avoided:** A static template whitelist on a dynamic surface. You cannot enumerate in advance which fact a release card will assert, so a whitelist permits only pre-templated questions — which defeats the purpose of grounding against live data. Worse than no grounder: the first unanticipated metric passes *unverified*, creating false confidence.

**The pattern:** Expose ONE open primitive with full analyst parity, wrapped in a mechanical guard layer — enforced by code, not by the LLM.

```ts
// src/fact-grounder/sources/platform-analytics.ts (shape)
export const platformDataTool = {
  name: "query_platform_data",
  description: "Run a read-only SQL query against platform_v2 analytics.",
  guard(sql: string): GuardResult {
    // 1. Hard gate: single SELECT only (no INSERT/UPDATE/DELETE/DROP/UNION tricks)
    if (!isSingleSelect(sql)) return { block: true, reason: "non-SELECT statement" };
    // 2. Mechanical linter: read config/platform-data-rules.json and block/warn on known
    //    landmines — NULL-unsafe filters, ×1e6 unscaled amounts, LOWER() on base58
    //    addresses, banded SUM() across fee tiers, actual_gas_cost_usd, deprecated tables.
    const warnings = lintAgainstRules(sql, loadRules());
    // 3. Inject default LIMIT + enforce a max-row cap to bound cost
    const safeSql = injectLimit(sql, { default: 100, max: 500 });
    return { block: false, safeSql, warnings };
  },
  async run(sql, conn) {
    const { block, safeSql, warnings, reason } = this.guard(sql);
    if (block) throw new GroundingError(reason);
    const rows = await conn.query(safeSql);
    return { rows, source_ref: safeSql, warnings }; // source_ref = exact SQL, reproducible
  },
};
```

Safety comes from **guard + reproducibility (`source_ref`) + the existing downstream validator/ship-gate** — not from removing capability. The guard config (`config/platform-data-rules.json`) is the machine-readable form of the correction catalog: **the catalog IS the linter's ruleset.** Wire them to each other; don't maintain two independent lists.

### Technique B — "Enumerate the execution boundary before designing around any session tool"

**Trigger:** You are about to design a feature that calls a tool you are currently using in an interactive session — an MCP server, IDE plugin, session credential, browser automation.

**Failure mode avoided:** A design that works perfectly in the interactive session and silently breaks headless/CI/cron, because the session tool does not exist in the standalone runtime. The failure is not an error — the tool simply isn't found — so it degrades silently and you discover it in production.

**The load-bearing question:** *Is this tool attached wherever the code will actually run?*

All session, `platform_v2` was queried via the `mysql_platform_v2_prod` MCP. That MCP is a Claude Code session tool. It does **not** exist inside comms-factory's `pnpm tsx` Node runtime — which has no DB driver and no connection. comms-factory's production surfaces (Slack bot, MCP server, any CI/cron) carry none of the session's MCPs. The runtime needs its own connection:

```bash
# .env — runtime-native connection, present wherever the grounder actually runs
PLATFORM_V2_READONLY_URL=<runtime-native-readonly-platform-v2-url>
```

Recommended: a **dedicated read-only user on the read replica** — least privilege, no write risk, no load on the primary — not the MCP's own credentials copied over. The session MCP stays useful for *prototyping* correction rules during development; the production code path never touches it.

---

## Why This Matters

Both failure modes share one shape: **a design that looks correct in the context where it was designed breaks in the context where it runs.** Technique A breaks across the *question space* (works for anticipated queries, fails for novel ones); Technique B breaks across the *runtime boundary* (works in-session, fails headless).

Concrete stakes, from the leakage investigation that seeded this (session history): the first internal-user filter tried was NULL-unsafe (`NOT (u.is_cwg = 1 OR u.email LIKE '%@core.infinex.%')`). It silently dropped ~71% of rows — every wallet-only signup with a NULL email — and a follow-on guess wrongly blamed `suspected_bot`. Fixing it moved "external swidge volume" from $680K to $143.2M, which then turned out to be 99% three accounts wash-trading Solana memecoins. Correct-syntax SQL, confidently wrong number, twice. Technique A's linter exists to catch exactly that class before a number reaches public comms. The leakage handoff even carried a "confirm `mysql_platform_v2_prod` is attached" note — confirming session attachment — which is precisely *not* the same as runtime availability. That note is Technique B's trap in miniature.

---

## When to Apply

**Technique A (guard, don't cage):**
- Any agent-callable tool over a dynamic surface (SQL, shell, filesystem, HTTP API)
- When the surface's query space is open — the agent must *discover* what to ask, not pick from a menu
- When "safety" is being expressed as capability removal rather than behavioral constraint

**Technique B (enumerate the boundary first):**
- Any handoff from interactive-agent prototyping to a standalone/cron/CI process
- MCP server features being promoted to a production pipeline stage
- Same anti-pattern class as the operator's "enumerate first, status second" rule for multi-env CLIs — list what survives the boundary before designing around the active cursor

---

## Examples

**Technique A — before (caged):**
```ts
const ALLOWED_QUERIES = {
  userCount: "SELECT COUNT(*) FROM users WHERE created_at > ?",
  swapVolume24h: "SELECT SUM(volume_usd) FROM swaps WHERE created_at > NOW() - INTERVAL 1 DAY",
};
// grounder intent-matches into ALLOWED_QUERIES
```
A release card asserting "top 10 vaults by APY this week" has no matching template → the grounder skips verification or errors. Neither is acceptable.

**Technique A — after (open primitive + guard):** the agent writes the SQL that answers the actual question; the guard ensures single-SELECT, lints for known landmines, injects LIMIT; `source_ref` records the exact SQL. Any fact a card can assert, the grounder can verify — bounded by the guard, traceable by the trace.

**Technique B — before (session-boundary trap):** "the grounder will call `query_platform_data` → MCP routes to `mysql_platform_v2_prod`." Production runtime: MCP not present → call fails silently → grounder skips verification.

**Technique B — after (runtime-native):** prototype via MCP while iterating rules; production reads `PLATFORM_V2_READONLY_URL` and opens a `mysql2` connection directly. Boundary question answered up front: "Is the MCP present in the `pnpm tsx` runtime?" → No → the runtime owns its connection.

**Bonus that fell out:** once the primitive is open, "research mode" — run the grounder with a free-text question instead of a release card and emit the `FactGroundingResult` as a brief — is free composability. The leakage HTML report is an un-automated version of exactly that output.

---

## Related

- **Correction catalog (the linter's ruleset):** `~/Sites/infinex-xyz/platform/docs/solutions/best-practices/platform-v2-analytics-correction-catalog-2026-06-01.md` — the 10 hardened `platform_v2` landmines that `config/platform-data-rules.json` encodes.
- **Predecessor method doc:** `~/Sites/infinex-xyz/platform/docs/solutions/best-practices/platform-v2-quantitative-grounding-and-onchain-method-2026-06-01.md` — captures the same session's quantitative-grounding + onchain-labeling method (the *what*); this doc captures the *design principles* (the *how*). Read together.
- **Design spec:** `DESIGN-2026-06-01-platform-analytics-grounding-source.md` (this repo).
- `methodology-ground-on-dated-strata` (memory) — thread the source ref explicitly; Next bundling breaks module-globals — a runtime-boundary cousin of Technique B.
- `methodology-lean-upstream-fat-downstream` (memory) — the open primitive is lean upstream; the guard layer is the downstream fattening.
- `methodology-multi-system-convergence-isnt-truth` / `hyperliquid-spotmeta-ctxs-trap` (memory) — the NULL-email silent drop is the DB analog of correct-systems-converging-on-a-wrong-number; this doc is a concrete cross-domain instance.
