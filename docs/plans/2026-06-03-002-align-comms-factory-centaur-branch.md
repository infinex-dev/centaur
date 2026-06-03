---
title: "refactor: Align comms-factory branch with Centaur extension boundaries"
type: refactor
status: completed
date: 2026-06-03
---

# refactor: Align comms-factory branch with Centaur extension boundaries

## Summary

Keep the current `feat/comms-factory-centaur-integration` branch as one branch, but reshape it so the generic Centaur platform work remains in base Centaur while the Infinex/comms-factory capability is packaged as an overlay deployment. Centaur already has workflows; this plan preserves workflow-based comms approval flows and focuses on correcting packaging, docs, service auth, and scope boundaries.

The intended review story should be:

1. Centaur gains reusable attached-service and Slack workflow-interactivity primitives.
2. Comms-factory demonstrates those primitives through a canonical overlay bundle.
3. Base Centaur does not auto-load Infinex-specific tools, workflows, commands, or private deployment references.

## Problem Frame

The current branch correctly uses Centaur workflows for comms approval gates. The issue is not that workflows were added: workflows are an existing Centaur primitive documented in `docs/pages/extend/workflows.mdx`, `README.md`, and `AGENTS.md`.

The drift is that org-specific comms code and docs are added directly to base Centaur:

- `tools/comms_factory/`
- `workflows/comms_audit.py`
- `workflows/comms_release.py`
- `workflows/comms_shared.py`
- `docs/runbooks/comms-factory-centaur.md`
- comms-specific local deploy/Justfile helpers
- public overlay docs referencing `infinex-dev/comms-factory` and pinned commits

This conflicts with the documented extension model in `docs/pages/extend/tools.mdx`, `docs/pages/extend/workflows.mdx`, and `docs/pages/extend/overlay.mdx`, which says organization-specific tools and workflows should live in overlays.

## Requirements

- R1. Keep `attachedServices` as a generic Centaur Helm primitive.
- R2. Keep Slack interactivity, modal, Socket Mode, and workflow-event dispatch as generic Centaur platform support.
- R3. Preserve comms-factory workflows as workflow-based approval gates; do not replace them with bespoke Slack state machines.
- R4. Ensure base Centaur does not auto-discover comms-factory tools/workflows by default.
- R5. Package comms-factory as an overlay deployment on this branch rather than a separate PR.
- R6. Remove private Infinex/comms-factory refs from generic public docs; keep them only in clearly deployment-specific docs if needed.
- R7. Clarify and enforce the `COMMS_FACTORY_SERVICE_TOKEN` / `COMMS_FACTORY_BASE_URL` contract.
- R8. Decide and document whether attached services receive raw env credentials or route through iron-proxy placeholders.
- R9. Recheck comms gate authority inside workflows, not only in Slackbot parsing.
- R10. Keep the branch testable locally with the comms-factory dogfood path.
- R11. Document `api.enabledTools` / `api.disabledTools` as production exposure controls for discovered tools.
- R12. Propagate Socket Mode operational constraints from the implementation plan into public docs: `SLACK_APP_TOKEN`, local/staging usage, and single-replica requirement.

## Scope Boundaries

### In scope

- Reorganizing files on the same branch.
- Updating generic docs and comms-specific runbooks.
- Moving comms tool/workflows into a top-level overlay location.
- Keeping or adapting `just comms-factory-up` so it builds/mounts the comms overlay.
- Adding focused tests for discovery boundaries, Slack interactivity, service auth, and workflow gate validation.

### Out of scope

- Replacing Centaur's workflow engine.
- Creating a separate PR.
- Implementing the WIP Apps platform.
- Adding external auto-publishing for comms copy.
- Porting comms-factory TypeScript into the Centaur API image.

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| Keep comms orchestration as Centaur workflows. | Workflows are an existing Centaur primitive for long-running tasks, human gates, sleeps, events, and tool calls. |
| Move comms tool/workflows out of base discovery paths. | Docs say org-specific tools/workflows live in overlays so base Centaur stays reusable. |
| Keep `attachedServices` generic. | Running heavier runtimes beside the API is reusable beyond comms-factory. |
| Treat attached services as lower-level than Apps. | `docs/pages/extend/apps.mdx` is explicitly WIP; `attachedServices` should not imply Apps are implemented. |
| Keep comms deploy support on the branch as an example helper. | User asked not to split PRs; branch can still dogfood comms if helper builds/mounts the overlay. |
| Validate gates in workflow state as well as Slackbot. | `/workflows/events` is an API surface; workflow correctness should not depend only on Slackbot being the caller. |

## Existing Patterns to Follow

- Overlay discovery: `docs/pages/extend/overlay.mdx`
- Tool plugin contract: `docs/pages/extend/tools.mdx`
- Workflow contract: `docs/pages/extend/workflows.mdx`
- Current workflow examples: `services/api/api/workflows/agent_turn.py`, `services/api/api/workflows/slack_thread_turn.py`
- Workflow API/event mechanics: `services/api/api/workflow_engine.py`, `services/api/api/routers/workflows.py`
- Slack handoff client pattern: `services/slackbot/src/centaur/handoff.ts`
- API-to-slackbot helper pattern: `services/api/api/slackbot_client.py`
- Helm component patterns: `contrib/chart/templates/workloads.yaml`, `contrib/chart/templates/networkpolicy.yaml`, `contrib/chart/templates/_helpers.tpl`

## Implementation Units

### Unit 1 — Keep attached services generic

**Files**

- `contrib/chart/templates/attached-services.yaml`
- `contrib/chart/templates/networkpolicy.yaml`
- `contrib/chart/templates/_helpers.tpl`
- `contrib/chart/values.yaml`
- `contrib/chart/values.schema.json`
- `docs/pages/extend/overlay.mdx`
- `docs/pages/extend/apps.mdx`

**Plan**

- Keep `attachedServices` as an internal Deployment + ClusterIP Service + NetworkPolicy renderer.
- Ensure defaults render no attached services.
- Ensure no public ingress is created for attached services.
- Update generic docs to use a neutral example such as `example-processor` rather than `infinex-dev/comms-factory`.
- Add a note that `attachedServices` is a chart-level primitive, not the WIP Apps platform.

**Test scenarios**

- Default chart render has no attached-service resources.
- Chart render with one attached service includes Deployment, Service, and NetworkPolicy.
- API NetworkPolicy permits API → attached service on the configured port.
- Attached-service NetworkPolicy permits ingress only from API and egress only to allowed proxy/service paths when proxy is enabled.

### Unit 2 — Package comms-factory as an overlay

**Files**

Move from:

- `tools/comms_factory/**`
- `workflows/comms_audit.py`
- `workflows/comms_release.py`
- `workflows/comms_shared.py`
- `services/api/tests/test_comms_workflows.py`

Move to:

- `overlays/comms-factory/Dockerfile`
- `overlays/comms-factory/tools/comms_factory/**`
- `overlays/comms-factory/workflows/comms_audit.py`
- `overlays/comms-factory/workflows/comms_release.py`
- `overlays/comms-factory/workflows/comms_shared.py`
- `overlays/comms-factory/tests/test_comms_workflows.py`

**Plan**

- Keep workflow names `comms_audit` and `comms_release`.
- Keep tool name `comms_factory`.
- Add an overlay Dockerfile that copies the overlay to `/overlay`.
- Ensure base Centaur no longer loads comms-factory from `/app/tools` or `/app/workflows` by default.
- Ensure local comms deployment mounts the overlay through `overlay.image.*` or an equivalent local image path.

**Test scenarios**

- Default tool discovery does not include `comms_factory`.
- Default workflow discovery does not include `comms_audit` or `comms_release`.
- With the comms overlay mounted, tool discovery includes `comms_factory`.
- With the comms overlay mounted, workflow discovery includes `comms_audit` and `comms_release`.
- Moved comms workflow tests still validate gate correlation IDs and no external publishing.

### Unit 3 — Fix comms service config and secret contract

**Files**

- `overlays/comms-factory/tools/comms_factory/client.py`
- `overlays/comms-factory/tools/comms_factory/pyproject.toml`
- `contrib/scripts/deploy-local.sh`
- `docs/runbooks/comms-factory-centaur.md`

**Plan**

- Treat `COMMS_FACTORY_BASE_URL` as deployment config, not a secret.
- Treat `COMMS_FACTORY_SERVICE_TOKEN` as service auth and ensure both API/tool side and attached service side receive compatible values.
- Declare the token contract in the tool metadata or in deployment docs, depending on whether it is resolved through Centaur's secret mechanism or injected as API config.
- Decide the `ANTHROPIC_API_KEY` model for the attached service:
  - preferred: attached service uses iron-proxy/placeholder flow for model calls;
  - acceptable if explicit: attached services are privileged internal services that may receive raw env secrets.
- Make the runbook honest about whichever model is selected.

**Test scenarios**

- Tool returns `comms_factory_base_url_not_configured` when base URL is absent.
- Tool includes `Authorization: Bearer ...` when `COMMS_FACTORY_SERVICE_TOKEN` is configured.
- Tool error paths redact service token values.
- Local deploy creates/passes the same service token to the API/tool side and attached service side when auth is enabled.

### Unit 4 — Keep Slack interactivity generic; make comms launch optional

**Files**

- `services/slackbot/src/index.ts`
- `services/slackbot/src/slack/interactivity.ts`
- `services/slackbot/src/slack/socket-mode.ts`
- `services/slackbot/src/centaur/workflow-events.ts`
- `services/slackbot/src/config.ts`
- `services/slackbot/src/*.test.ts`

**Plan**

- Keep generic Slack action/modal parsing.
- Keep Socket Mode interactive/options parity.
- Keep workflow event dispatch to `/workflows/events`.
- Avoid unconditional base Slack parsing for `comms audit`, `comms generate`, or `comms release`.
- Choose one branch-local approach:
  1. gate comms parsing behind deployment-specific workflow launch config, or
  2. generalize workflow launch commands via config, or
  3. move comms command routing into the comms overlay/deployment path if Slackbot can be configured for it.

**Test scenarios**

- Slack interaction with a valid compact ref dispatches a workflow event.
- Slack interaction with invalid/missing ref returns safe Slack-visible feedback.
- Socket Mode interactive frames use the same interaction handler as HTTP actions.
- Default Slackbot behavior does not special-case comms commands unless enabled/configured.
- When comms command support is enabled/configured, `comms audit` starts `comms_audit` and `comms generate/release` starts `comms_release`.

### Unit 5 — Validate comms gate authority inside workflows

**Files**

- `overlays/comms-factory/workflows/comms_shared.py`
- `overlays/comms-factory/workflows/comms_audit.py`
- `overlays/comms-factory/workflows/comms_release.py`
- `overlays/comms-factory/tests/test_comms_workflows.py`

**Plan**

- Add workflow-side validation after `ctx.wait_for_event(...)` resumes.
- Validate expected gate stage.
- Validate expected gate version.
- Validate Slack user is requester or an approved approver.
- Validate action is allowed for the current gate.
- Decide whether invalid events fail the workflow, mark abandoned/rejected, or wait for a new valid event. Prefer explicit rejected/stale handling for MVP so operators see why a click did not proceed.

**Test scenarios**

- Correct stage/version/user/action proceeds.
- Wrong stage is rejected as stale/invalid.
- Wrong gate version is rejected as stale/invalid.
- Unauthorized Slack user is rejected.
- Unsupported action for a gate is rejected.

### Unit 6 — Clean docs and local deployment story

**Files**

- `.env.example`
- `Justfile`
- `contrib/scripts/deploy-local.sh`
- `contrib/docs/deploy-local-runsheet.md`
- `contrib/docs/deploy-env-runsheet.md`
- `docs/runbooks/comms-factory-centaur.md`
- `docs/plans/comms-factory-centaur-integration.md`
- `docs/pages/extend/overlay.mdx`
- `docs/pages/extend/tools.mdx`
- `docs/pages/quickstart.mdx`
- `docs/pages/architecture.mdx`
- `docs/pages/deploying-in-production.mdx`

**Plan**

- Make root `.env.example` generic; remove deployment-specific names such as `FirenzeStaging`.
- Keep `just comms-factory-up` only if it clearly builds/mounts the comms overlay and is documented as overlay/deployment-specific.
- Keep private upstream refs in `docs/runbooks/comms-factory-centaur.md` only if this repo intentionally carries the dogfood runbook; otherwise move them to an overlay/deployment repo.
- Update the existing comms plan doc so it says comms-factory is an overlay consumer of generic attached-services + workflow-interactivity primitives.
- Document tool exposure controls:
  - `api.enabledTools: []` means all discovered tools are eligible unless disabled.
  - non-empty `api.enabledTools` allowlists tool names.
  - `api.disabledTools` removes tools from exposure and should take precedence when both lists mention a name.
  - overlays may still shadow tools before the final exposure filter is applied.
  - production deployments with many built-in tools should prefer explicit allowlists or deny high-risk/write-capable tools.
- Propagate Socket Mode docs from `docs/plans/2026-06-03-001-feat-slack-socket-mode-plan.md` into public/operator docs:
  - quickstart/bootstrap docs include `SLACK_APP_TOKEN` when local/dev Socket Mode is enabled.
  - architecture docs describe HTTP Events API for production and Socket Mode as local/staging/no-public-ingress ingest.
  - production docs keep Socket Mode default-off and warn not to enable it on the production Slack app unless intentionally replacing Request URLs.
  - docs explain `slackbot.socketMode.enabled` requires `slackbot.replicaCount: 1` because Socket Mode uses one WebSocket consumer and current dedupe is in-process.

**Test scenarios**

- Generic quickstart docs do not require comms-factory.
- Comms runbook still gives a complete path for local dogfood.
- Public extension docs no longer contain private upstream commit SHAs.
- Tool docs explain `api.enabledTools` / `api.disabledTools`, including allowlist/denylist precedence.
- Quickstart mentions `SLACK_APP_TOKEN` when Socket Mode is enabled by default for local/dev.
- Architecture/production docs explain Socket Mode scope and the single-replica constraint.

## Test Matrix

| Area | Commands / checks |
|---|---|
| Helm | `helm lint contrib/chart`; render default values; render with one attached service; render with comms overlay values; render Socket Mode enabled with one replica and verify multi-replica fails. |
| API tool discovery | tests covering `CENTAUR_ENABLED_TOOLS`, `CENTAUR_DISABLED_TOOLS`, default absence of comms tool, overlay presence of comms tool. |
| Workflow discovery | tests or local smoke confirming default absence of comms workflows and overlay presence when mounted. |
| Comms workflows | moved comms workflow unit tests, plus new stale/unauthorized gate tests. |
| Slackbot | existing Slackbot tests plus Socket Mode interaction/options tests and comms command gating tests. |
| Local dogfood | `just comms-factory-up` or equivalent, then validate `comms_factory/validate` and a Slack-launched comms workflow. |

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Moving comms files breaks imports from `workflows.comms_shared`. | Preserve overlay package layout so API loads files the same way under the overlay workflow directory, or adjust imports consistently in the overlay. |
| Tests become awkward because overlay files are outside base import paths. | Add test path setup for `overlays/comms-factory` or keep overlay tests colocated and run them explicitly. |
| Local dogfood becomes harder. | Keep `just comms-factory-up`, but make it build both the attached service image and the comms overlay image. |
| Attached service secret model remains ambiguous. | Make one explicit decision in docs and tests: proxy placeholders or privileged raw env. |
| Reviewers think Apps have shipped. | Add clear docs language: attachedServices is not Apps; Apps remains WIP. |

## Review Checklist

- [ ] Base Centaur still supports generic attached services.
- [ ] Base Centaur still supports generic Slack workflow interactivity.
- [ ] Base Centaur does not auto-load comms tool/workflows by default.
- [ ] Comms-factory can still be dogfooded from this branch through an overlay path.
- [ ] Generic public docs have no private Infinex/comms-factory commit refs.
- [ ] Comms service token/auth path is explicit and tested.
- [ ] Workflow gate validation is not solely dependent on Slackbot.
- [ ] Socket Mode remains single-replica guarded and documented in public/operator docs.
- [ ] Tool allow/deny exposure controls are documented for production operators.

## Suggested Sequencing

1. Generic docs cleanup for attached services vs Apps, tool allow/deny, and Socket Mode constraints.
2. Move comms tool/workflows into `overlays/comms-factory`.
3. Update local comms deploy to build/mount the overlay.
4. Fix comms service token/auth contract.
5. Gate or generalize Slackbot comms command parsing.
6. Add workflow-side gate validation.
7. Run focused tests and local comms dogfood.
