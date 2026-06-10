---
title: "feat: Self-derived repo routing for the comms grounder (route-before-grep)"
type: feature
status: active
date: 2026-06-10
---

# feat: Self-derived repo routing for the comms grounder

## Overview

The comms-factory fact-grounder (`fact-grounder-llm.ts`) is an agentic Sonnet loop that issues
**broad, blind `grep_platform_code` queries** across the allowlisted repos and, when grep does not
immediately hit, **falls back to a partner's public docs**. That fallback is where soft facts come
from — e.g. grounding Hyperliquid's generic "40x" gitbook cap instead of how Infinex's own product
actually sources leverage, and a muddled "USDT-denominated" margining claim recorded at 0.95.

This plan gives the grounder a **route-before-grep** step backed by a **manifest that comms-factory
derives itself** from the repos it already syncs — no hand-maintained nav doc, no dependency on
another team. The manifest auto-classifies each repo by structure and applies a per-repo extractor,
because the three allowlisted repos are not the same shape.

This is the **small extract** of the (now-stale, capability-plane-era) Jeff plan
`2026-06-03-005-jeff-style-multi-repo-support-persona-plan.md`: keep "route → navigate → targeted,
cited search"; drop the support persona, `repo-mgmt`, capability plane, and investigation notes.

## Problem Frame

Evidence gathered this session (live run `wfr_8bb2bcde00c74b4a`, brief *"Infinex perps are powered
by Hyperliquid with up to 50x leverage on majors"*):

- The grounder grep is blind: it searches broad terms with no map of where features live, so it
  often bails to provider docs. Facts 3–5 all came from `hyperliquid.gitbook.io`, not Infinex code.
- **fact_5** ("USDC margining, USDT-denominated linear contracts" @ 0.95) is garbled and overconfident.
- The **50x↔40x** conflict: the grounder grounded Hyperliquid's *doc* cap (40), never Infinex's own
  perps source.
- Company-level context is thin: nothing routes the grounder to Infinex's positioning/architecture
  docs; it only greps code for the named feature.

### Key de-risk findings (read-only, this session)

1. **`repo_context.search` glob harvesting works and is commit-pinned.** `path_glob:"apps/**/package.json"`
   returned `infinex-xyz/platform@31a6cac6…:apps/perps-app/package.json:2 — "name": "@infinex-private/perps-app"`.
   `path_glob:"**/*.md"` over `context` returned md files with SHA + line ranges. Both extractor
   primitives are proven.
2. **The leverage cap is NOT a repo constant.** It is `maxLeverage: number` inside Hyperliquid's
   `meta`/`universe` API response type (`packages/perps/src/exchanges/hyperliquid/types.ts:55-58`),
   fetched live from `infoUrl: https://api.hyperliquid.xyz/info`. **Infinex's repo defers to the HL
   API for this fact.**
3. **Platform packages barely self-describe.** Only **11 of 113** `package.json`s carry a
   `description`; the code extractor needs a README/H1 fallback.
4. **`context` is richly self-describing.** Canon docs carry YAML frontmatter
   (`description`, `tags`, `type`, `last_updated`) — a ready-made topic index.

**Reframed rule (important):** the goal is not "prefer the repo's number over the partner's doc."
It is **route to the owning package, read the integration code, and ground from whatever the code
proves is the real source of truth** — an in-repo constant, OR a partner API the code calls, OR a
doc. For leverage, that means: route to `packages/perps`, see `maxLeverage` comes from the HL
`/info` universe, then read that live per-asset cap (40x on majors) — confirming the brief's "50x"
is wrong and that the cap is per-asset.

## Goals

- Replace blind grep with a routed first step derived from repo structure.
- Derive the routing manifest **inside comms-factory**, from repos it already syncs, with zero
  external curation and auto-refresh.
- Auto-classify each repo so adding/removing a repo needs no per-repo config.
- Feed code repos and the knowledge repo into grounding for **different** purposes.

## Non-Goals

- No support/research persona, `repo-mgmt`, writable clones, or investigation notes (Jeff plan scope).
- No capability plane (deleted in the native-tools cutover).
- No hand-maintained nav/`codebase-map.md` doc (that was the rejected "rely on other people" option).
- No new infra: reuse repoCache (already hourly), `repo_context`, and the existing allowlist.
- Do not change base Centaur. This lives entirely in the comms-factory service + the comms overlay.

## Requirements

- **R1.** comms-factory builds a routing manifest from the allowlisted repos using only
  `repo_context` reads (commit-pinned), with no externally-maintained map.
- **R2.** The manifest builder classifies each repo by structure and applies the matching extractor.
- **R3.** Manifest refreshes off the repoCache cadence (hourly) and is cached; a refresh failure
  degrades to today's blind-grep behavior, never worse.
- **R4.** The grounder consults the manifest before broad grep and routes `grep_platform_code`
  (`glob`) into the owning package; it then follows the integration code to the true source of each
  fact (in-repo / partner API / doc).
- **R5.** The knowledge-repo index feeds product/company **narrative** grounding, not config-number
  grounding, and skips persona/agent docs to avoid instruction bleed.
- **R6.** Extractors exclude vendor/build/min-js noise (`node_modules`, `public/charting_library`,
  `dist`, `*.min.js`).

## Design

### Repo classification (self-running, no config)

On manifest build, probe each allowlisted repo once and pick a type:

- **`code-monorepo`** — has `pnpm-workspace.yaml` / `apps/*` with `package.json`
  (→ `infinex-xyz/platform`, `infinex-xyz/agent-platform`).
- **`knowledge`** — dominated by `.md`, frontmatter present, no workspace
  (→ `infinex-xyz/context`).

### Per-repo extractors

**Approach A — `platform` (code-monorepo) → route config facts**
Harvest `{apps,packages,workers}/*/package.json`:
- key = `name` + path (e.g. `@infinex-private/perps-app` → `apps/perps-app`).
- blurb = `description` if present (~11/113) **else** the package README's first H1/line **else** the
  dir name.
- Use: keyword-match the brief's feature noun → owning package → grep there → **follow the
  integration code to the real source** (constant, partner API, or doc).

**Approach B — `agent-platform` (code-monorepo) → same extractor, free**
Identical pnpm/turbo `apps/`+`packages/` shape; the Approach-A extractor runs unchanged. Lower comms
relevance, included so new code repos "just work."

**Approach C — `context` (knowledge) → route narrative & company facts**
Harvest `**/*.md`, parse YAML frontmatter → `{description, tags, type}` (fall back to H1 when absent):
- yields a topic→doc index: `ARCHITECTURE.md` (product features/flows), `LANDSCAPE.md`
  (competitive/market positioning), `CHANGELOG.md` (decisions), `VISION`/`ROADMAP`, `docs/{research,specs,designs}`.
- **skip** persona/agent docs (e.g. `IDENTITY.md` = "Nell" persona) to avoid instruction bleed.
- Use: the *"what is Infinex / how do we talk about this"* layer — route the grounder to read these
  for framing, never to grep for a number. Fixes the thin-company-context gap.

### The split

- **Code repos (A+B):** answer *"what is the authoritative value, and where does it really come from"*.
- **Knowledge repo (C):** answers *"what is this product/company and how is it positioned"*.

### Grounder wiring

In `buildGrounderSystemPrompt()` add a routed first step (the only static text; all knowledge is in
the manifest data):

> Before broad search, consult the routing manifest: match the brief's feature to its owning package
> and grep **there** first. Read the integration code to learn the real source of each fact — an
> in-repo constant, a partner API the code calls, or a doc — and ground from that source, not from a
> generic provider doc. For product framing, read the routed `context` docs.

The manifest slice is injected into the grounder run (system prompt or the seed user message) by the
`/ground` route from the cached manifest.

## Implementation Units

### Unit 1 — Manifest builder in the comms-factory service

**Files:**
- `attached-services/comms-factory/src/fact-grounder/sources/repo-manifest.ts` (new)
- `attached-services/comms-factory/src/centaur-research.ts` (reuse `repo_context` client / `resolveRepos`)
- `attached-services/comms-factory/src/__tests__/repo-manifest.test.ts` (new)

**Work:**
- `classifyRepo(repo)` — structure probe → `code-monorepo` | `knowledge`.
- `extractCodeManifest(repo)` — glob `{apps,packages,workers}/*/package.json`, parse `name` +
  `description`, README-H1 fallback; exclude vendor/build noise.
- `extractKnowledgeManifest(repo)` — glob `**/*.md`, parse frontmatter `{description,tags,type}` /
  H1 fallback; skip persona/agent docs.
- `buildManifest()` — fan out across allowlisted repos; return `{repo, type, entries:[{label, path, blurb}]}`.
- Cache in-process with a TTL aligned to repoCache (default hourly); failure → empty manifest (caller
  degrades gracefully).

**Test scenarios:**
- platform → code entries incl. `apps/perps-app` with package name; description-less packages get a
  fallback blurb; `public/charting_library` excluded.
- context → knowledge entries incl. `ARCHITECTURE.md`/`LANDSCAPE.md` with frontmatter description;
  `IDENTITY.md` persona skipped.
- classification picks the right extractor for each repo without per-repo config.
- manifest build failure returns empty and does not throw.

### Unit 2 — Route slice + grounder prompt wiring

**Files:**
- `attached-services/comms-factory/src/routes/ground.ts` (inject manifest slice)
- `attached-services/comms-factory/src/fact-grounder-llm.ts` (`buildGrounderSystemPrompt` route step)
- `attached-services/comms-factory/src/__tests__/fact-grounder-routing.test.ts`

**Work:**
- Select the manifest slice relevant to the brief (keyword overlap on label/blurb/tags), cap size.
- Pass it into `groundFacts` (new optional `routing_manifest` field) and render it in the system
  prompt with the routed-first-step + follow-the-integration-code rule.
- Keep it advisory: if the slice is empty, the prompt reverts to current behavior.

**Test scenarios:**
- A perps brief yields a slice naming `packages/perps` / `apps/perps-app` and the prompt instructs
  grep there first.
- Empty manifest → prompt identical to today (no regression).
- Prompt never embeds persona-doc content from `context`.

## Validation

### Unit tests
```sh
pnpm --filter comms-factory test src/__tests__/repo-manifest.test.ts
pnpm --filter comms-factory test src/__tests__/fact-grounder-routing.test.ts
```

### Local E2E (per CLAUDE.md: build + deploy + real request)
```sh
./contrib/scripts/deploy-local.sh --only api --with-comms-factory   # rebuild comms-factory image
```
Then re-run the perps brief in Slack and inspect grounded facts:
- Expect the grounder to grep `packages/perps`/`apps/perps-app`, discover `maxLeverage` comes from
  the HL `/info` universe, and ground the **live per-asset cap (40x majors)** — flagging "50x" as
  wrong — instead of trusting the gitbook doc.
- Expect framing facts routed from `context` (ARCHITECTURE/LANDSCAPE), improving company context.

### Dynamic proof
Edit one `package.json`/frontmatter entry in a synced repo (no redeploy); after the next manifest
refresh, the routed slice reflects it — proving the manifest is self-derived and live.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Grep noise (vendored min-js) pollutes the manifest. | Extractor excludes `node_modules`, `public/charting_library`, `dist`, `*.min.js`. |
| Description-less packages route poorly. | README-H1 / dir-name fallback; blurb is a hint, not a gate. |
| Manifest stale between syncs. | Commit-pinned reads; hourly refresh; a stale entry degrades to blind grep, never worse. |
| Over-routing makes the grounder ignore valid external facts. | Routing is advisory + "follow the integration code to the true source" — partner API/doc remains valid when the code points there. |
| Instruction bleed from `context` persona docs. | Knowledge extractor skips persona/agent docs; only frontmatter description/tags are surfaced. |
| Manifest slice bloats the prompt. | Keyword-select + size cap; only the relevant rows are injected. |

## Open Questions

- Cache the manifest in-process per service instance, or persist to Postgres for cross-instance reuse?
- Should the knowledge slice be injected always (company framing) or only when the brief lacks
  product context?
- Keyword routing vs. a tiny embedding match for feature→package — start with keyword; revisit only
  if routing misses.

## Recommended MVP Cut

1. Unit 1 manifest builder with the two extractors + classification (the whole novel mechanism).
2. Unit 2 advisory prompt wiring.
3. Validate on the perps brief; confirm it follows `packages/perps` → HL `/info` for the real cap.

Defer Postgres persistence, embedding-based routing, and any always-on knowledge injection until the
perps-brief E2E proves the routed grep pays off.
