---
title: Comms Factory Centaur Integration Runbook
---

# Comms Factory Centaur Integration

Centaur integrates comms-factory as an internal attached service plus the
`comms_factory` tool and `comms_audit` / `comms_release` workflows.

## Source lock

Build the comms-factory API image only from:

```text
https://github.com/infinex-dev/comms-factory/commit/3a01b3337692c64133185560b66706a28b703c4e
```

Do not build from a moving branch for this integration; later upstream commits
may change service contracts.

## Local values sketch

```yaml
attachedServices:
  comms-factory:
    enabled: true
    image:
      repository: comms-factory-api
      tag: 3a01b3337692c64133185560b66706a28b703c4e
      pullPolicy: IfNotPresent
    service:
      port: 8080
    secretEnv:
      COMMS_FACTORY_SERVICE_TOKEN:
        secretName: centaur-infra-env
        key: COMMS_FACTORY_SERVICE_TOKEN

api:
  # COMMS_FACTORY_SERVICE_TOKEN is loaded through the chart's envFrom infra Secret.
  extraEnv:
    COMMS_FACTORY_BASE_URL: http://centaur-centaur-attached-comms-factory:8080
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
