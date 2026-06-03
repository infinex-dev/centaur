---
title: Comms Factory Centaur Integration Runbook
---

# Comms Factory Centaur Integration

Centaur integrates comms-factory as an internal attached service plus the
`comms_factory` tool and `comms_audit` / `comms_release` workflows.

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
3. Clones/checks out comms-factory at PR head `21d335869190bbba107f1c52263acfeb20e0963a` unless you pass `--comms-factory-repo PATH` or `--comms-factory-ref REF`.
4. Builds/imports `comms-factory-api:21d335869190bbba107f1c52263acfeb20e0963a`.
5. Patches `centaur-infra-env` with `COMMS_FACTORY_SERVICE_TOKEN` and `LOCAL_DEV_API_KEY` when missing.
6. Deploys Helm with `attachedServices.comms-factory.enabled=true` and `COMMS_FACTORY_BASE_URL=http://centaur-centaur-attached-comms-factory:8080`.

Useful variants:

```bash
# Build from an existing local comms-factory checkout instead of the cached clone.
just comms-factory-up --comms-factory-repo /path/to/comms-factory

# Reuse an already imported comms-factory image while rebuilding Centaur api/slackbot.
just comms-factory-up --skip-comms-factory-build

# Use a different reviewed source ref/tag intentionally.
just comms-factory-up --comms-factory-ref <sha-or-tag>
```

## Validation path

1. Render the chart with default values and with `attachedServices.comms-factory.enabled=true`.
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

4. Launch a Slack workflow with a mention:
   - `@centaur comms audit tweet: Fact A is live.`
   - `@centaur comms generate for x, web: Fact A launch brief...`
5. Click at least one button or submit one modal and confirm the waiting workflow
   resumes through `/workflows/events`.

The MVP never publishes to X, web, or in-product surfaces. `Mark ready` only
posts final copy back to Slack and returns `no_external_posting: true` in the
workflow output.
