---
title: Comms Factory Centaur Integration Runbook
---

# Comms Factory Centaur Integration

This branch dogfoods comms-factory as a canonical overlay deployment. Base
Centaur provides generic attached-service and Slack workflow-interactivity
primitives; the comms overlay contributes the `comms_factory` tool and the
`comms_audit` / `comms_release` approval workflows from `overlays/comms-factory`.

## Source lock

Build the comms-factory API image from the reviewed PR source, not moving
upstream `main`:

```text
PR:        https://github.com/infinex-dev/comms-factory/pull/1
PR head:   21d335869190bbba107f1c52263acfeb20e0963a
Base pin:  3a01b3337692c64133185560b66706a28b703c4e
```

Once the PR is accepted, update deployments to the accepted merge commit. The
base pin documents what the service branch was created from; it does not contain
the Centaur service API Dockerfile.

## Local startup

From the Centaur checkout, run:

```bash
just comms-factory-up
```

This command:

1. Ensures the local Podman-backed k3s cluster is reachable.
2. Builds/imports Centaur `api` and `slackbot` images.
3. Builds/imports the Centaur comms overlay image from `overlays/comms-factory`.
4. Clones/checks out comms-factory at PR head `21d335869190bbba107f1c52263acfeb20e0963a` unless you pass `--comms-factory-repo PATH` or `--comms-factory-ref REF`.
5. Builds/imports `comms-factory-api:21d335869190bbba107f1c52263acfeb20e0963a`.
6. Patches `centaur-infra-env` with `COMMS_FACTORY_SERVICE_TOKEN` and `LOCAL_DEV_API_KEY` when missing.
7. Mounts `ANTHROPIC_API_KEY` into the attached comms-factory service when present in `centaur-infra-env`; `ground` and live generation need it.
8. Deploys Helm with the comms overlay mounted, `attachedServices.comms-factory.enabled=true`, `api.enabledTools=[comms_factory]`, `COMMS_FACTORY_BASE_URL=http://centaur-centaur-attached-comms-factory:8080`, comms entries in generic `SLACK_WORKFLOW_COMMANDS`, and local default harness `claude-code` so Slack turns use Anthropic rather than Codex.

Useful variants:

```bash
# Build from an existing local comms-factory checkout instead of the cached clone.
just comms-factory-up --comms-factory-repo /path/to/comms-factory

# Reuse an already imported comms-factory image while rebuilding Centaur api/slackbot.
just comms-factory-up --skip-comms-factory-build

# Use a different reviewed source ref/tag intentionally.
just comms-factory-up --comms-factory-ref <sha-or-tag>
```

## Service auth contract

`COMMS_FACTORY_BASE_URL` is deployment config for the API/tool side. It points at
the internal attached-service ClusterIP URL.

`COMMS_FACTORY_SERVICE_TOKEN` is raw internal bearer auth. The local helper
creates or reuses one value and injects it into both the API pod environment
(where the tool reads it) and the attached comms-factory service environment
(where the service validates it). This internal ClusterIP call does not use the
Centaur tool `secret(...)` placeholder/iron-proxy replacement path.

For this dogfood deployment the attached service is treated as a privileged
internal service: `proxy.enabled: false` and optional `ANTHROPIC_API_KEY` is
mounted as raw env when present. If you adapt this pattern for a less-trusted
service, prefer leaving the proxy enabled and using placeholder-based outbound
credential injection.

## Validation path

1. Render the chart with default values and with the comms overlay plus `attachedServices.comms-factory.enabled=true`.
2. Build/deploy the local stack.
3. From the API deployment, discover and call the tool:

```bash
kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -s http://localhost:8000/tools/comms_factory | jq

kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -s -X POST http://localhost:8000/tools/comms_factory/validate \
    -H 'Content-Type: application/json' \
    -d '{"text":"Fact A is live."}' | jq
```

4. Launch a Slack workflow with a mention. These commands are available only in
   the comms dogfood deployment because it configures generic
   `SLACK_WORKFLOW_COMMANDS` entries for them; default base Slackbot behavior
   sends the text to the generic agent workflow.
   - `@centaur comms audit tweet: Fact A is live.`
   - `@centaur comms generate for x, web: Fact A launch brief...`
5. Click at least one button or submit one modal and confirm the waiting workflow
   resumes through `/workflows/events`.

The MVP never publishes to X, web, or in-product surfaces. `Mark ready` only
posts final copy back to Slack and returns `no_external_posting: true` in the
workflow output.
