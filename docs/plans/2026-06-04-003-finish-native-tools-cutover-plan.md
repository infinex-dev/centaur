---
title: "refactor: Finish the native-tools cutover (dogfood readiness)"
type: refactor
status: active
date: 2026-06-04
companions:
  - docs/plans/2026-06-04-001-refactor-fold-capabilities-into-tools-plan.md
  - docs/plans/2026-06-04-002-feat-comms-factory-native-tools-plan.md
target_repos:
  - centaur (infinex-dev/centaur) — PR #3 feat/comms-factory-centaur-integration
  - comms-factory (infinex-dev/comms-factory) — PR #2 feat/capability-plane-grounding
---

# refactor: Finish the native-tools cutover (dogfood readiness)

> Plans 001 (centaur fold) and 002 (comms-factory swap) are implemented and merged-ready.
> The argument-parity blocker is **fixed** (comms-factory#2). What remains is small,
> mostly centaur-side config + a verification dogfood.

## What's already done

- **comms-factory#2:** executor renamed off the capability-plane vocabulary
  (`CapabilityPlaneExecutor` → `CentaurResearchExecutor`, `src/capability-plane.ts` →
  `src/centaur-research.ts`); calls native `/tools/{tool}/{method}` via a vendored
  `CentaurToolsClient`; `mapLogicalToolToTool` emits **each method's exact arg names**
  (the tool plane rejects unknown kwargs); web/page fetches route through the Exa-backed
  `websearch.search`; `fetch_json_api` is unmapped → `UNAVAILABLE`. 240 tests + typecheck green.
- **centaur#3:** `tool_result.v1` envelope + `EvidenceItem`; `/tools` emits the envelope
  (`tool_envelope.py`), `repo_context` emits evidence natively and `websearch`/`twitter`/
  `company_context` are projected; `research` scope bundle; `CentaurClient.callTool`;
  `/capabilities` plane deleted; comms overlay points at native tools.

## Correcting two assumptions from earlier drafts

- **There is no `web_fetch` or `browser` tool to build.** The only web tool is `websearch`
  (Exa), method `search`, which returns page contents. The old `capability_registry`
  entries for `web.fetch`/`browser.render` pointed at "deployment-provided when available"
  tools that were never built. comms-factory now routes page fetches through `websearch.search`.
- **Evidence parity is largely implemented, not pending** — `tool_envelope.py` already
  projects `web.search_result` / `x.post` / `company_context.document`. This unit is
  *verify*, not *build*.

## Remaining work

- [ ] **U1. Trim the `research` scope bundle to real tools** *(centaur)*
  `SCOPE_BUNDLES["research"]` grants `tools:web_fetch` and `tools:browser` for tools that
  don't exist. Reduce to `tools:repo_context, tools:websearch, tools:twitter,
  tools:company_context`. File: `services/api/api/api_keys.py`; assert in
  `tests/test_check_scope.py` / `test_api_keys.py`.

- [ ] **U2. Decide + wire the dogfood tool set** *(centaur)*
  `contrib/scripts/deploy-local.sh` enables `repo_context, websearch, company_context,
  comms_factory`. Add `twitter` if `infinex_search_recent_posts` is in scope for the first
  dogfood; otherwise document it (and `fetch_json_api`) as `UNAVAILABLE`/degraded. Assert
  the comms key authorizes exactly the enabled research set and **not** `tools:slack`/`tools:*`.

- [ ] **U3. Verify evidence parity** *(centaur)*
  Confirm `websearch.search` and `twitter.search_tweets` yield `evidence[]` with stable IDs +
  provenance via the envelope projection, matching the capability-era `evidence_types`
  (`web.search_result`, `x.post`). Add per-tool assertions where missing.

- [ ] **U4. End-to-end dogfood** *(both)*
  `deploy-local.sh … WITH_COMMS_FACTORY=1`, scoped `research` token, run `comms release <brief>`.
  Expect: grounding via `repo_context.search`/`read_file` + `websearch.search` with evidence in
  `deployed_facts`; **no** `tool_argument_validation_failed` in logs; `/audit` blind;
  `no_external_posting: true`; zero `/capabilities` traffic.

### Optional / deferred

- [ ] **Cross-repo rename of the `/ground` request contract.** comms-factory's `/ground` still
  speaks `comms_factory.ground_from_capabilities.v1` + a `capability_plane` config block + error
  codes (`capability_plane_not_configured`, etc.), and the centaur comms overlay
  (`overlays/comms-factory/workflows/comms_shared.py`, its client + tests) sends that shape.
  Renaming it (e.g. `ground_from_tools` / `centaur_tools` block) is a **coordinated two-repo
  change**; do it only if the capability vocabulary on the wire is worth the churn.
- [ ] **Generic `Idempotency-Key` on `/tools`** (capability-era U5) if the first dogfood needs
  replay; otherwise read-only calls are at-most-once with bounded client retries.
- [ ] **Adopt the shared `@centaur/api-client`** in comms-factory (it vendors a local client now).

## Sources & References

- comms-factory#2 (arg parity + rename), centaur#3 (fold into tools).
- Arg validation (rejects unknown kwargs): `services/api/api/tool_manager.py` `_tool_arg_validation_error`.
- Web tool: `tools/research/websearch` (Exa; methods `search`, `deep_research`). No `web_fetch`/`browser`.
- Evidence projection: `services/api/api/tool_envelope.py`. Scope bundles: `services/api/api/api_keys.py`.
- Dogfood deploy: `contrib/scripts/deploy-local.sh`.
