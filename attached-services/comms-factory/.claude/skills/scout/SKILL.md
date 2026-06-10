---
name: scout
description: >-
  Internal Scout — answer a product/opportunity question by querying Infinex's own platform_v2
  analytics + onchain data, applying battle-tested method gates, and writing a netflow/leakage brief.
  Use this WHENEVER the operator wants to "scout out" something about Infinex users or money flow —
  e.g. "scout out where money goes when it leaves Infinex", "what are extension users actually doing",
  "where are our users leaking to", "which dApps are our users using externally", "run an internal
  scout on lending", "who are our highest-value users and what are they doing elsewhere", or any
  question of the form "what are our users doing / where does our money go / what should we build to
  capture X". Reach for it even when the operator doesn't say the word "scout" but is clearly asking a
  revealed-demand question about Infinex's own users or capital outflow. This is the Internal Scout of
  the proactive research lane; it is NOT the grounder (which verifies release copy) — never bolt this
  into fact-grounder code.
---

# Scout (Internal)

You are running the **Internal Scout**: pointing Infinex's own data at a product/opportunity question to surface *revealed demand* — what our users already do, and where our money already leaks. The output is a **netflow/leakage brief** the operator reviews to decide what to build. This is the hand-run leakage investigation (2026-06-01) turned into a repeatable procedure, so each run is cheap — the probes are pre-written and the landmines are pre-mapped. Don't re-derive SQL or re-discover the traps; that's what burned tokens the first time.

Full architectural context: `GOAL-proactive-research-lane-2026-06-01.md` in the repo root. You don't need to read it to run — this skill is self-contained — but read it if the operator asks how the Scout fits the larger lane (Scout → Director brand lens → proposal card → Monday review).

## How SQL and onchain access work here

- **SQL** runs against `platform_v2` via the **`mysql_platform_v2_prod` MCP** (`execute_sql` tool). It is a *session* tool. If you don't see it, it isn't attached to this workspace — STOP and tell the operator to attach it in superset (this is the known execution boundary; see `references/method-gates.md`). Do not silently skip verification.
- **Onchain enrichment** (labeling destinations, reading portfolios) runs via the **`projectjin` CLI** (on PATH at `~/.local/bin/projectjin`), through Bash. Recipe in `references/classify-address.md`.

## The run flow

1. **Interpret the question** into one or more probes. Most questions map to a small set; pick the minimum that answers it. The probe library (ready-to-run SQL, master filter baked in) is in `references/probes.md`:
   - "where does money go / leak when it leaves" → P1 outflow-by-destination (+ classify) , P2 outflow-by-chain
   - "what are users doing externally / which dApps" → P3 L1 activity-leakage by dApp
   - "is swidge a real leak" → P4 swidge self-vs-external split
   - "who's leaking / highest-value users" → P5 per-user net-flow leaderboard
   - "what are they holding / deployed vs idle" → P6 cohort builder + P7 portfolio snapshot
2. **Load the gates.** Read `references/method-gates.md` BEFORE running. These are the disciplines that make the numbers trustworthy — the first run published a $59.3M headline that was a ~12,000× token-mispricing artifact; the gates exist to stop that reaching a brief. The NULL-safe master filter and the ÷1e6 / base58 traps are non-negotiable correctness gates.
3. **Run the SQL probe(s)** via `execute_sql`. Apply the master internal/bot/team filter to *every* probe.
4. **Enrich if the question needs destinations or holdings** — classify outflow destinations (`references/classify-address.md`) and/or snapshot portfolios. Deterministic labels (Etherscan name-tag hit) need no LLM; only the tail does.
5. **Aggregate, applying the gates** — two-layer L1/L2 split, verified-vs-estimated tagging, concentration check on any big/swung number.
6. **Write the brief** to `scout/<question-slug>-<YYYY-MM-DD>/REPORT.md` using `references/report-template.md`, and drop raw query outputs alongside it. Headline number first, caveats second. End with the proposal seeds (the one-line `quantitative_case` per finding) — that's what graduates toward a proposal card.
7. **Summarise in chat headline-first**: the single biggest finding, then the ranked seeds, then the path to the file. Don't dump the brief into chat.

## Guardrails that matter most

- **Verify, don't assume.** If a number looks huge, it's probably an artifact until proven — value the dominant row independently before it lands. (Gate 2.)
- **State what the data can't see.** No USD-inflow ledger (net-flow is band-proxy); DeBank is EVM-only (Solana yield invisible); balances are banded. Always carry these caveats into the brief.
- **This is discovery, not verification.** You are allowed to run open SQL the operator didn't pre-template — that's the point. Safety is the read-only DB + the gates + the reproducible SQL recorded in the brief, not a restricted query menu.
- **Scope to the question.** Don't run all six probes by reflex; run what answers what was asked, and say what you didn't cover.
