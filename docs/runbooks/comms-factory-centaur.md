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
PR:        https://github.com/infinex-dev/comms-factory/pull/2
PR head:   8c98f4ab67b0fac386809209df3a63547207e287
Base pin:  21d335869190bbba107f1c52263acfeb20e0963a
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
4. Clones/checks out comms-factory at PR head `8c98f4ab67b0fac386809209df3a63547207e287` unless you pass `--comms-factory-repo PATH` or `--comms-factory-ref REF`.
5. Builds/imports `comms-factory-api:8c98f4ab67b0fac386809209df3a63547207e287`.
6. Patches `centaur-infra-env` with `COMMS_FACTORY_SERVICE_TOKEN`, `LOCAL_DEV_API_KEY`, `GITHUB_TOKEN` when supplied, and a scoped `COMMS_FACTORY_CAPABILITY_API_KEY` when missing.
7. Mounts `ANTHROPIC_API_KEY` into the attached comms-factory service when present in `centaur-infra-env`; live generation still needs it.
8. Deploys Helm with the comms overlay mounted, `attachedServices.comms-factory.enabled=true`, `api.enabledTools=[comms_factory, repo_context, websearch, company_context]`, `COMMS_FACTORY_BASE_URL=http://centaur-centaur-attached-comms-factory:8080`, API-side `COMMS_FACTORY_CAPABILITY_BASE_URL=http://centaur-centaur-api:8000`, attached-service `CENTAUR_CAPABILITY_BASE_URL=http://centaur-centaur-api:8000`, aliases from `overlays/comms-factory/repo-context.aliases`, comms entries in generic `SLACK_WORKFLOW_COMMANDS`, and local default harness `claude-code` so Slack turns use Anthropic rather than Codex. When `GITHUB_TOKEN` exists, it also enables repoCache for all active non-archived repos listed in `overlays/comms-factory/repo-context.repositories.txt`.

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

`COMMS_FACTORY_CAPABILITY_API_KEY` is a separate DB-backed Centaur API key
bootstrapped with only `capabilities:comms`. The attached service receives the
same value as `CENTAUR_CAPABILITY_TOKEN`; the service uses server-configured
`CENTAUR_CAPABILITY_BASE_URL` plus this token to call
`/capabilities/catalog?profile=comms` and `/capabilities/execute`. It must not
use `LOCAL_DEV_API_KEY`, sandbox tokens, admin scopes, Slack tokens, GitHub
tokens, or direct `/tools` access for grounding.

For this dogfood deployment the attached service is treated as a privileged
internal service: `proxy.enabled: false` and optional `ANTHROPIC_API_KEY` is
mounted as raw env when present. If you adapt this pattern for a less-trusted
service, prefer leaving the proxy enabled and using placeholder-based outbound
credential injection.

## Repo capability inventory

The comms overlay carries a generated allowlist at
`overlays/comms-factory/repo-context.repositories.txt` containing active,
non-archived repositories from `infinex-xyz` and `infinex-dev`. Archived repos
are intentionally absent unless explicitly re-added for a deployment.

`repo.list_repos` exposes the configured allowlist and alias map through the
capability plane. Repo search/read callers may omit `ref`; in that case
`repo_context` resolves cached `HEAD` to a commit SHA before search/read. The
repo-cache daemon updates checkouts on its configured interval, so this means
"latest cached default checkout", not a live GitHub fetch per request. Callers
that need a specific branch, tag, PR ref, or SHA should pass that `ref`; Centaur
still resolves it to a commit SHA and pins evidence to that commit.

## Validation path

1. Render the chart with default values and with the comms overlay plus `attachedServices.comms-factory.enabled=true`.
2. Build/deploy the local stack.
3. From the API deployment, discover and call the tool and capability catalog:

```bash
kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -s http://localhost:8000/tools/comms_factory | jq

kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -s -X POST http://localhost:8000/tools/comms_factory/validate \
    -H 'Content-Type: application/json' \
    -d '{"text":"Fact A is live."}' | jq

CAP_KEY=$(kubectl get secret -n centaur centaur-infra-env \
  -o jsonpath='{.data.COMMS_FACTORY_CAPABILITY_API_KEY}' | base64 -d)
kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -s -H "X-Api-Key: $CAP_KEY" \
    http://localhost:8000/capabilities/catalog?profile=comms | jq
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
