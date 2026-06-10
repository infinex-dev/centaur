---
title: "feat: Route comms-factory grounding through Centaur capabilities"
type: refactor
status: completed
date: 2026-06-03
origin: "Centaur PR1 service API + capability-plane integration"
---

# feat: Route comms-factory grounding through Centaur capabilities

## PR1 Implementation Directive

This plan is explicitly scoped to **infinex-dev/comms-factory PR 1** (`feat/centaur-service-api`). Do not treat this as a follow-up PR, roadmap note, or post-merge cleanup. The PR1 service API should not be considered complete until `/ground` and the production grounding path use the Centaur capability-plane contract described here.

The implementation target for PR1 is:

- keep the service API endpoints already introduced in PR1,
- replace PR1's current local `/ground` self-search semantics with `ground_from_capabilities`,
- route production research tool execution through scoped Centaur `/capabilities`,
- remove production reliance on local platform checkout, `gh`, ProjectJin, `agent-browser`, and direct JSON API allowlists,
- preserve Actor/Director/ReleaseCard invariants already present in PR1.

If time or contract readiness forces a smaller landing, the acceptable PR1 fallback is a **mocked capability-plane executor plus service contract/tests** that make local-infra execution opt-in dev-only. It is not acceptable for PR1 to ship a production `/ground` path that silently depends on local `PLATFORM_ROOT`, `gh`, ProjectJin, or browser binaries.

## Summary

Move comms-factory PR1 from **service API with local research execution** to **service API with Centaur-owned capabilities**.

PR1 already adds the attached-service HTTP surface (`/health`, `/validate`, `/audit`, `/ground`, `/build-card`, `/generate`). The remaining comms-factory-side work for PR1 is to keep the existing grounder reasoning loop and logical Anthropic tool names, but replace physical execution of repo/web/browser/search tools with a scoped Centaur `/capabilities` executor.

The intended boundary is:

| Concern | Owner |
|---|---|
| Decide which evidence is needed | comms-factory grounder |
| Logical tool names and prompt behavior | comms-factory |
| Execute repo search/read/ref discovery | Centaur capability plane |
| Execute web/browser/search/X capabilities | Centaur capability plane |
| Enforce repo/tool/network permissions | Centaur |
| Normalize typed capability errors and evidence provenance | Centaur |
| Interpret evidence into verified facts | comms-factory |
| Build ReleaseCard / Actor / blind Director / validation | comms-factory |
| Human ship gate and workflow durability | Centaur workflow/Slack overlay |

## Problem Frame

Today the PR1 service API can be wrapped by Centaur, but `/ground` still calls the old in-process `groundFacts()` path. That path physically executes capabilities in comms-factory:

- `src/fact-grounder/sources/platform-code.ts` uses `PLATFORM_ROOT`, local grep, `git grep`, `git show`, and module-global active ref state.
- `src/fact-grounder/sources/branch-discovery.ts` shells out to local `gh`, `git ls-remote`, and branch fetches.
- `src/fact-grounder/sources/projectjin-research.ts` shells out to a local ProjectJin CLI.
- `src/fact-grounder/sources/rendered-page.ts` shells out to local `agent-browser`.
- `src/research-tools.ts` directly fetches allowlisted JSON APIs and dispatches all research tool execution locally.
- `harness/app/actions/research.ts` performs branch discovery/fetch preflight locally before calling `groundFacts()`.

That duplicates Centaur's role and makes the service hard to run cleanly as an attached Kubernetes service. The attached service should not need mounted platform checkouts, GitHub CLI auth, ProjectJin, browser binaries, or broad Centaur API/tool tokens.

## Requirements

- **R1.** Production service grounding must not require `PLATFORM_ROOT`, `gh`, local git fetches, ProjectJin CLI, `agent-browser`, or service-local JSON API allowlists.
- **R2.** Existing logical grounder tool names remain stable where practical: `grep_platform_code`, `read_platform_file`, `fetch_rendered_page`, `infinex_web_search`, etc.
- **R3.** The grounder LLM loop remains inside comms-factory; Centaur only executes capabilities and returns normalized results.
- **R4.** `CapabilityPlaneExecutor` calls Centaur `/capabilities/execute` with job/thread/stage/request IDs and scoped auth supplied by env, never broad Centaur `/tools` credentials.
- **R5.** Centaur typed failures become model-visible `UNAVAILABLE:` / `ERROR:` tool result content and trace events, not unhandled crashes or fake evidence.
- **R6.** Typed `EvidenceItem v1` records from Centaur are preserved separately from concise model-visible text so ReleaseCard facts can cite stable evidence IDs.
- **R7.** `/ground` accepts a versioned `ground_from_capabilities` contract and rejects/blocks missing capability-plane config unless operator facts are sufficient.
- **R8.** `/audit` remains Director-blind and does not self-ground.
- **R9.** `/generate` remains grounded: generated copy may only assert `ReleaseCard.deployed_facts`, returns `no_external_posting: true`, and does not publish externally.
- **R10.** Harness and scripts remain usable locally through an explicit mock/local capability plane; local legacy executors may remain as dev fixtures only when explicitly enabled.
- **R11.** Docs/env examples describe Centaur as capability owner and mark local infra vars as fallback/dev-only.
- **R12.** Tests prove grounding can run against a mocked Centaur capability server without local platform checkout, GitHub CLI, ProjectJin, or browser binary.

## Scope Boundaries

In scope for PR1:

- comms-factory PR1 service API contract updates.
- Capability-plane executor and research-tool execution seam.
- Production `/ground` behavior changed from local self-search to capability-aware grounding.
- Grounder/harness/script refactors needed to remove production local infra assumptions.
- Docs and tests for the comms-factory side of the boundary.

Out of scope for PR1:

- Implementing Centaur `/capabilities` itself.
- Centaur workflow/slack overlay implementation except contract assumptions documented here.
- A full async `plan_grounding` / `resume_with_tool_results` protocol. MVP remains synchronous comms-factory → Centaur capability calls during the normal grounder loop.
- Side-effecting capabilities such as posting to X/Slack/web.
- Rewriting Actor/Director architecture or changing ReleaseCard claim boundaries.
- Removing local source modules if they are still useful as explicit dev/test fixtures; production entrypoints must stop importing/executing them by default.

## Assumptions

- Centaur exposes `GET /capabilities/catalog?profile=comms` and `POST /capabilities/execute` with `CapabilityResult v1` and `EvidenceItem v1`.
- The attached service receives a scoped token in `CENTAUR_CAPABILITY_TOKEN` and a capability base URL in `CENTAUR_CAPABILITY_BASE_URL` or an equivalent env var.
- The token has `capabilities:comms` or narrower read-only capability scopes, and no direct `/tools` permissions.
- Capability execution is synchronous for PR1; long-running browser/deep research can be bounded or surfaced as unavailable/deferred.
- `lookup_partner` can remain a static comms-factory registry for PR1 unless Centaur supplies a registry capability in time.

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| Introduce a `CapabilityPlaneExecutor` rather than replacing the grounder loop. | Keeps prompt/tool behavior stable while moving physical execution to Centaur. |
| Preserve logical tool schemas in `buildResearchTools()` / `buildGrounderTools()`. | Reduces regression risk in the grounder prompt and existing tests. |
| Carry typed evidence out-of-band from model-visible strings. | The LLM needs concise text; ReleaseCard/fact receipts need stable provenance. |
| Make local infra execution opt-in fallback only. | Avoids accidental production reliance on `PLATFORM_ROOT`, `gh`, ProjectJin, or browser binaries. |
| Keep Director audit blind. | Existing safety invariant: Director judges against supplied facts/context and asks humans on gaps; it does not self-ground. |
| Use mocked Centaur fixtures for PR1 tests. | Allows comms-factory PR1 and Centaur PR to progress independently. |
| Guard the execution boundary mechanically. | Matches `docs/solutions/best-practices/guard-the-primitive-and-execution-boundary-2026-06-01.md`: production runtime capabilities must exist where the service actually runs. |

## Target Capability Mapping

| Logical comms tool | Centaur capability | Notes |
|---|---|---|
| `grep_platform_code` | `repo.search` | Include repo, query/pattern, ref, path/glob, max results. |
| `read_platform_file` | `repo.read_file` / `repo.read_range` | Prefer range when `startLine` / `endLine` present. |
| branch/ref discovery | `repo.discover_refs` or future launch-source capability | PR1 may pass ref/run context directly if Centaur overlay already resolved it. |
| `fetch_public_page` | `web.fetch` or `web.fetch_text` | Centaur owns SSRF/network policy. |
| `fetch_infinex_page` | `web.fetch` | URL/domain policy lives in capability catalog. |
| `fetch_json_api` | `web.fetch_json` | Centaur owns allowlist; comms can still require HTTPS before sending. |
| `fetch_rendered_page` | `browser.render` | Return unavailable if not in catalog. |
| `infinex_web_search` | `web.search` | Keep concise summary + citation text for model. |
| `infinex_search_recent_posts` | `x.search_recent` | Optional for PR1; unavailable should not crash. |
| `lookup_partner` | static local registry initially | Candidate for `registry.lookup_partner` in a later Centaur capability. |

## Implementation Units

### U1. Add capability-plane client and executor seam

**PR1 requirement:** This unit must land in PR1 before `/ground` is considered production-ready.

**Goal:** Introduce an injected executor that can call Centaur capabilities while keeping existing logical tool names.

**Requirements:** R2, R3, R4, R5, R10, R12

**Dependencies:** None

**Files:**

- Create `src/capability-plane.ts`
- Modify `src/research-tools.ts`
- Modify `src/fact-grounder-llm.ts`
- Add `src/__tests__/capability-plane.test.ts`
- Update `src/__tests__/fact-grounder-llm.test.ts`

**Approach:**

- Define types for the Centaur contract:
  - `CapabilityExecuteRequest`
  - `CapabilityResult`
  - `EvidenceItem`
  - `CapabilityError`
  - `CapabilityPlaneConfig`
- Add a `CapabilityPlaneExecutor` class/function that:
  - maps logical tool names to capability names,
  - builds deterministic request IDs from job/stage/turn/tool-use ID,
  - sends `POST /capabilities/execute`,
  - includes `job_id`, `thread_key`, `stage`, `request_id`, `capability`, `input`, and trace/requester metadata,
  - sends bearer auth from env/config without logging it,
  - returns Anthropic tool-result content (`UNAVAILABLE`, `ERROR`, or concise success text),
  - preserves returned `EvidenceItem[]` in a side channel for the grounder result.
- Add a generic executor type to `src/research-tools.ts`, e.g. `ResearchToolExecutor`, without changing `buildResearchTools()`.
- Keep existing local switch implementation behind an explicit `LocalResearchToolExecutor` for tests/dev fallback.

**Patterns to follow:**

- Active validator injected executor: `src/validator-active.ts`
- Existing tool schemas and caps: `src/research-tools.ts`
- Existing grounder trace events: `src/fact-grounder-llm.ts`
- Service HTTP redaction style: `services/api/http.ts`

**Test scenarios:**

- `grep_platform_code` maps to `repo.search` with expected input.
- `read_platform_file` with line range maps to `repo.read_range`; without line range maps to `repo.read_file`.
- A successful `CapabilityResult` becomes concise model-visible content and stores evidence IDs/provenance.
- `{ok:false, retryable:true}` becomes `UNAVAILABLE:` or `ERROR:` content and is not treated as evidence.
- Transport errors redact bearer tokens in thrown/logged errors.
- Request metadata includes job ID, thread key, stage, capability, and request ID.
- Existing local executor remains callable only when explicitly selected.

**Verification:**

- Unit tests can exercise executor behavior without `PLATFORM_ROOT`, `gh`, ProjectJin, or browser binaries.

---

### U2. Refactor research tool execution to route through the injected executor

**PR1 requirement:** This unit must land in PR1 for the production service path. Any remaining local executor must be explicit local-dev fallback only.

**Goal:** Move physical research execution out of `src/research-tools.ts` production path while preserving logical Anthropic tool definitions.

**Requirements:** R1, R2, R3, R5, R10

**Dependencies:** U1

**Files:**

- Modify `src/research-tools.ts`
- Modify `src/fact-grounder-llm.ts`
- Modify `src/__tests__/fact-grounder-llm.test.ts`

**Approach:**

- Keep `buildResearchTools()` and `buildGrounderTools()` stable.
- Replace `executeResearchToolCall()` as the default production path with an injected `tool_executor` or executor factory.
- Move the current switch body into a named local fallback module/function, not the default service path.
- Add `FactGroundingOptions.tool_executor` or equivalent to mirror `ActiveValidationOptions.tool_executor`.
- Include capability evidence accumulation in `FactGroundingResult` without changing the fact text contract.
- Do not call `setActivePlatformRef()` in production capability mode.

**Patterns to follow:**

- `src/validator-active.ts` uses `tool_executor` cleanly.
- `src/fact-grounder-llm.ts` already has `on_event` tracing for tool calls/results.

**Test scenarios:**

- `groundFacts()` uses the injected executor for research calls.
- Tool results are appended as Anthropic `tool_result` blocks exactly as before.
- `record_fact`, `mark_unverifiable`, and `done_grounding` behavior is unchanged.
- Existing operator facts still become deployed facts.
- Missing repo/search capability leads to unverifiable/blocking behavior, not hallucinated facts.

**Verification:**

- Grounder tests pass with a fake capability executor and no local platform checkout.

---

### U3. Add versioned service `/ground` capability-aware contract

**PR1 requirement:** This is the central PR1 contract change. PR1's `/ground` route must expose `ground_from_capabilities` semantics rather than ambiguous local self-search semantics.

**Goal:** Make PR1 `/ground` accept capability-plane context and run grounding against Centaur capabilities.

**Requirements:** R4, R5, R6, R7, R12

**Dependencies:** U1, U2

**Files:**

- Modify `services/api/routes/ground.ts`
- Modify `services/api/server.test.ts`
- Modify `services/api/http.ts` only if request parsing/redaction needs shared helpers.
- Update `docs/SPEC-director-as-service.md`

**Approach:**

- Accept a versioned request shape with fields such as:
  - `schema_version: "comms_factory.ground_from_capabilities.v1"`
  - `mode: "ground_from_capabilities"`
  - `brief`
  - `job_id`
  - `workflow_run_id`
  - `thread_key`
  - `requester_user_id`
  - `approver_user_ids`
  - `stage`
  - `gate_version`
  - `capability_plane` with endpoint reference and `auth: {type:"bearer_env", env:"CENTAUR_CAPABILITY_TOKEN"}`
  - `constraints`
- Build `CapabilityPlaneExecutor` from that request/env.
- Reject or return a clear blocked response when capability config is missing and operator facts are insufficient.
- Return evidence/provenance alongside facts:
  - `facts`
  - `deployed_facts`
  - `unverifiable`
  - `evidence`
  - `progress`
- Preserve service auth behavior from `services/api/http.ts`.

**Patterns to follow:**

- Existing route simplicity in `services/api/routes/ground.ts`
- Existing API tests in `services/api/server.test.ts`
- Redaction in `services/api/http.ts`

**Test scenarios:**

- `/ground` with capability-plane config calls mocked Centaur capabilities and returns grounded facts plus evidence IDs.
- `/ground` with missing capability-plane config returns `blocked`/clear error rather than local fallback in service mode.
- `/ground` never requires `PLATFORM_ROOT` in capability mode.
- Tokens are not echoed in errors/log-like responses.
- Old `/ground` semantics are either explicitly rejected in production service mode or treated as local-dev fallback only.

**Verification:**

- `pnpm service:test` covers the capability-aware route contract with mocks.

---

### U4. Remove local branch/ref discovery from production harness and service paths

**Goal:** Stop service/harness production paths from shelling out to local `gh`/`git` for branch discovery and ref fetching.

**Requirements:** R1, R4, R10, R12

**Dependencies:** U1, U2, U3

**Files:**

- Modify `harness/app/actions/research.ts`
- Modify `scripts/ground-once.ts`
- Modify `scripts/discover-sources.ts`
- Modify `src/fact-grounder-llm.ts`
- Optional new `src/fact-grounder/run.ts`
- Update `src/__tests__/fact-grounder-llm.test.ts`

**Approach:**

- Extract shared branch-aware grounding orchestration, e.g. `groundBriefWithCapabilities()`.
- Replace harness preflight calls to `extractFeatureSubject`, `discoverSources`, and `fetchRef` with capability-plane source discovery or a supplied run context.
- If Centaur PR1 does not yet have a source-discovery capability, accept `ref` / source context from the Centaur workflow request and use repo capabilities directly.
- Keep legacy `branch-discovery.ts` exported only for explicit local/dev script usage, and mark it deprecated in docs/comments.
- Remove module-global `setActivePlatformRef()` from production grounder path.

**Patterns to follow:**

- Current harness persistence in `harness/app/actions/research.ts`
- Existing `FactGroundingOptions.ref` behavior in `src/fact-grounder-llm.ts`

**Test scenarios:**

- Harness research action can run with mocked capability executor and no `PLATFORM_ROOT`.
- Service `/ground` does not import or call `branch-discovery.ts`.
- Concurrent grounding requests do not share module-global active ref state.
- If source discovery is unavailable, output is blocked/degraded or uses explicitly supplied ref; it does not shell out to local `gh`.

**Verification:**

- `pnpm typecheck:harness` and harness tests/build stay green.

---

### U5. Move non-repo research capabilities to Centaur and preserve graceful degradation

**Goal:** Route rendered browser, public page, JSON API, web search, and recent-post search through capabilities instead of local binaries/direct network code in production.

**Requirements:** R1, R2, R5, R10, R12

**Dependencies:** U1, U2

**Files:**

- Modify `src/research-tools.ts`
- Modify or deprecate production imports from:
  - `src/fact-grounder/sources/projectjin-research.ts`
  - `src/fact-grounder/sources/rendered-page.ts`
  - `src/fact-grounder/sources/public-page.ts`
  - `src/fact-grounder/sources/infinex-pages.ts`
- Update `src/__tests__/fact-grounder-llm.test.ts`
- Add/extend `src/__tests__/capability-plane.test.ts`

**Approach:**

- Map existing logical tools to capability names from the target mapping section.
- Preserve cheap comms-side validation where useful:
  - reject non-HTTPS URLs before sending `fetch_public_page` / `fetch_json_api`,
  - strip credentials from URLs,
  - clamp output length.
- Let Centaur own SSRF controls, browser availability, search provider credentials, and JSON host allowlists in production.
- Preserve current behavior where unavailable optional tools produce `UNAVAILABLE:` content so the grounder moves on or marks facts unverifiable.

**Patterns to follow:**

- Current `ProjectjinUnavailableError` / `AgentBrowserUnavailableError` handling in `src/research-tools.ts`
- Existing URL/JSON allowlist tests in `src/__tests__/fact-grounder-llm.test.ts`

**Test scenarios:**

- `fetch_rendered_page` maps to `browser.render` and unavailable result becomes `UNAVAILABLE:`.
- `infinex_web_search` maps to `web.search` and includes citations/evidence IDs.
- `infinex_search_recent_posts` maps to `x.search_recent` when available; missing capability does not crash.
- `fetch_json_api` rejects non-HTTPS before calling Centaur.
- Capability errors are never converted into successful evidence.

**Verification:**

- Tests prove no ProjectJin/browser binary is required for production capability-mode execution.

---

### U6. Preserve fact receipts, ReleaseCard boundaries, and active validator invariants

**Goal:** Carry capability evidence through grounding/card/generation without widening what Actor or Director may claim.

**Requirements:** R6, R8, R9

**Dependencies:** U1, U2, U3

**Files:**

- Modify `src/fact-grounder-llm.ts`
- Modify `src/card.ts` only if evidence metadata needs schema support.
- Modify `services/api/routes/build-card.ts` if route should accept evidence.
- Modify `services/api/routes/generate.ts` if response should echo fact receipts.
- Update `src/__tests__/validator-active.test.ts`
- Update `services/api/server.test.ts`

**Approach:**

- Extend `FactGroundingResult` with optional `evidence` / `fact_receipts` while keeping `facts` and `deployed_facts` stable.
- When the LLM records facts, associate them with evidence IDs where possible from the preceding tool result.
- Ensure `buildDeployedFacts()` still emits the claim boundary used by Actor/generate.
- Keep `/audit` blind: no capability executor is passed to Director audit route.
- Ensure `/generate` still requires approved facts/card and returns `no_external_posting: true`.

**Patterns to follow:**

- `src/card.ts` ReleaseCard schema
- `src/validator-active.ts` fact allowance checks
- Existing `/generate` approval tests in `services/api/server.test.ts`

**Test scenarios:**

- Grounding result includes evidence IDs/provenance without changing deployed fact text.
- Generated candidates include/echo fact receipts when available.
- Active validator still cannot expand beyond `ReleaseCard.deployed_facts`.
- `/audit` does not receive or call capability-plane config.
- `/generate` rejects unapproved facts/cards as before.

**Verification:**

- Existing Actor/Director tests continue to pass.

---

### U7. Update docs, env, and local development story

**Goal:** Make the new runtime boundary explicit so future operators do not reinstall local infra into the attached service.

**Requirements:** R1, R10, R11, R12

**Dependencies:** U1-U6

**Files:**

- Modify `.env.example`
- Modify `README.md`
- Modify `docs/ARCHITECTURE.md`
- Modify `docs/TESTING.md`
- Modify `docs/SPEC-director-as-service.md`

**Approach:**

- Add envs for capability mode:
  - `CENTAUR_CAPABILITY_BASE_URL`
  - `CENTAUR_CAPABILITY_TOKEN`
  - optional timeout/retry limits.
- Mark legacy envs as local-dev fallback only:
  - `PLATFORM_ROOT`
  - `PROJECTJIN_BIN` / `PROJECTJIN_CLI`
  - local `agent-browser`
  - `FACT_GROUNDER_JSON_API_ALLOWLIST` if Centaur owns JSON fetch in production.
- Document how to run tests with a mocked capability plane.
- Document that service production mode does not need local platform checkout, `gh`, ProjectJin, browser binary, Slack tokens, GitHub tokens, or broad Centaur `/tools` access.
- Cross-reference the execution-boundary learning: `docs/solutions/best-practices/guard-the-primitive-and-execution-boundary-2026-06-01.md`.

**Test scenarios:**

- Docs examples use scoped capability token/env, not local CLIs.
- `.env.example` contains no real secret-like values.
- Testing docs show `pnpm service:test`, `pnpm test`, `pnpm typecheck`, and harness validation.

**Verification:**

- A reviewer can understand the two-repo boundary from docs alone.

## Deferred to Implementation

- Exact final capability names if Centaur lands `web.fetch`, `web.fetch_json`, `browser.render`, `x.search_recent`, or source-discovery under different names.
- Whether `lookup_partner` stays local for PR1 or gets a Centaur registry capability immediately.
- Whether `/ground` should preserve legacy local mode behind an explicit request flag or remove it entirely from service routes.
- Whether `FactGroundingResult` evidence metadata belongs directly on facts, beside facts, or in a separate receipts object.
- How much harness local mode should keep using legacy modules versus a local mock Centaur capability server.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Grounder quality regresses because tool outputs change shape. | Preserve logical tool names and produce concise model-visible strings matching current style. |
| Capability errors are treated as evidence. | Store evidence only from `CapabilityResult.evidence`; error text is model-visible unavailable/error content only. |
| Silent degradation hides missing capabilities. | Trace every capability call and test blocked/unverifiable paths. |
| Attached service gets broad Centaur access. | Token is env-only, scoped to capabilities, and never sent through request payloads or logs. |
| Director starts self-grounding by accident. | Do not pass capability executor/config to `/audit`; add tests. |
| Local dev becomes painful. | Provide mocked capability plane and explicit local fallback mode. |
| Concurrent requests share active refs. | Remove module-global `setActivePlatformRef()` from production path; pass ref/context per request. |
| Two PRs drift. | Duplicate contract fixtures in comms-factory tests and document expected Centaur schema. |

## PR1 Completion Gate

PR1 is not complete if any of these remain true:

- `/ground` production mode still calls local repo/browser/search infrastructure by default.
- Service docs or `.env.example` imply production requires `PLATFORM_ROOT`, `gh`, ProjectJin, or `agent-browser`.
- Capability errors can be mistaken for claim-supporting evidence.
- The attached service needs broad Centaur `/tools`, admin, Slack, or GitHub credentials to ground facts.
- Director audit can self-ground.
- Tests cannot exercise grounding with a mocked Centaur capability plane.

## Verification Strategy

Minimum checks before PR1 is considered capability-ready:

```bash
pnpm service:test
pnpm test
pnpm typecheck
pnpm typecheck:harness
pnpm build:harness
```

Targeted proof points:

- Unit test: `CapabilityPlaneExecutor` maps every logical research tool to the expected capability request.
- Unit test: capability errors become `UNAVAILABLE:` / `ERROR:` and do not create evidence.
- Grounder test: full tool loop runs with mocked capability responses and no local infra env.
- Service test: `/ground` accepts `ground_from_capabilities` and returns facts + evidence.
- Service test: `/audit` remains blind and does not self-ground.
- Service test: `/generate` still rejects unapproved facts/cards and returns `no_external_posting: true`.
- Harness validation: research action no longer shells out to `gh` / fetches local refs in production capability mode.
- Docs check: no production docs instruct operators to mount platform repo or install ProjectJin/browser binaries.

## Post-Deploy Monitoring & Validation

For the Centaur-attached service deployment:

- **Logs to watch:** service logs containing `ground_from_capabilities`, capability request IDs, `UNAVAILABLE`, `ERROR`, `blocked`, `unverifiable`, `Director`, `no_external_posting`.
- **Centaur logs to watch:** `capability_execute_started`, `capability_execute_completed`, backing tool `tool_call_started`, `tool_call_completed`, and error codes such as `capability_unavailable`, `capability_forbidden`, `repo_denied`, `repo_unavailable`.
- **Healthy signals:** grounding requests produce evidence IDs, facts/card/candidate gates appear, `/generate` returns candidates with `no_external_posting: true`, and no local-infra missing binary errors appear.
- **Failure signals:** repeated missing capability catalog, 401/403 from Centaur capabilities, local `PLATFORM_ROOT`/`gh`/ProjectJin/browser errors in service logs, facts approved with empty evidence for evidence-required claims, or Director self-grounding attempts.
- **Mitigation:** block the release workflow at facts gate, fall back to operator facts for urgent manual runs, or temporarily enable explicit local-dev fallback only outside production.
- **Validation window:** first 3 dogfood comms release runs after deployment, owned by the comms/agent operator running PR1 validation.
