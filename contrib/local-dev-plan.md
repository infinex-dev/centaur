# Centaur Local-Dev → FirenzeStaging Slack Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Runtime update (the plan pivoted after it was written):** `kind` does **not** work on podman's macOS VM — a kind node is a privileged systemd container that must `mount -o remount,ro /sys`, which the VM denies even rootful with full `CAP_SYS_ADMIN`. The local runtime was switched to **k3s running natively inside the podman machine VM**: the VM *is* the node, so there's no nested-container `/sys` remount (same K3s shape as production). The committed `contrib/scripts/k3s-local.sh` + `contrib/scripts/deploy-local.sh` + `contrib/deploy-local-runsheet.md` are the source of truth. The framing below is aligned to k3s, but the **embedded kind/docker script/runsheet reproductions in Tasks 1–5 are historical** — defer to the committed scripts.

**Goal:** Stand up a dedicated **staging Slack app named `FirenzeStaging`** and run the Centaur stack **locally on the laptop wired to that bot**, so we can iterate on the bot — change code, redeploy, and `@FirenzeStaging` in Slack to see the change — without touching any production/Centaur app. The local deployment (k3s-in-podman + env secrets + tunnel) is just the plumbing that connects the running code to `FirenzeStaging`.

**The actual deliverable is the dev loop:** `FirenzeStaging` Slack app ⇄ local stack ⇄ **ngrok**. Everything else (k3s, Helm values, secret bootstrap) exists only to make that loop work. Keep it as lean as possible; drop anything not needed to mention `@FirenzeStaging` and get a reply from locally-running code.

**Why ngrok (not Tailscale Funnel or cloudflared quick tunnels):** ngrok is **independent of any tailnet** — it needs no Tailscale ACL/Funnel permission (Funnel is blocked on the tailnet we'd otherwise use, and the admin who could enable it is gone). We have a **paid custom branded domain** (`infinex-centaur.ngrok.dev`, with wildcard `*.infinex-centaur.ngrok.dev`), so any concrete subdomain — we use `slack.infinex-centaur.ngrok.dev` — gives a **stable, predictable public URL** that exists before the tunnel runs and needs no per-subdomain reservation. That stability is what lets us **make the Slack manifest the source of truth for the Events API Request URL** (`event_subscriptions.request_url`) and have its verification **stick permanently** — set once, never re-paste, even across restarts. A rotating `*.trycloudflare.com` host can't be baked into a manifest at all (it changes every restart). ngrok terminates TLS with a valid public cert (passes Slack validation), and the paid plan serves no browser interstitial. (There's still a one-time two-phase create — see Task 5 — because Slack signs its validation challenge with a signing secret that only exists after the app is created; that's a Slack bootstrap constraint, independent of the tunnel.)

**Architecture:** Reuse the env-secret credential path introduced in `infinex-dev/centaur#1` (`ironProxy.secretSource: env`, infra creds in the `centaur-infra-env` Kubernetes Secret), but strip the internal-cluster coupling (private registry `registry.inx.local`, Traefik API ingress, the cluster's Tailscale *operator* ingress, cert-manager, hardcoded K8s-API CIDRs). Locally we build images with podman, import them into k3s running inside the podman VM, disable ingress + NetworkPolicy, and expose the Slackbot to **`FirenzeStaging`'s Events API** through `kubectl port-forward` + **`ngrok`** running on the laptop (no in-cluster ingress, no tailnet dependency). The `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` come from the `FirenzeStaging` app, not from any production Slack app — this is the isolation that makes iteration safe.

**Tech Stack:** Helm, k3s (inside the podman machine VM), podman, `kubectl`, **ngrok**, bash, OpenSSL. The Centaur stack itself is FastAPI (API) + a Hono/TypeScript slackbot + iron-proxy + an agent sandbox image.

> **Future zero-ingress option (not in this plan):** Slack Socket Mode would remove the public-URL requirement entirely (the bot dials out over a WebSocket), surviving even a fully locked-down tailnet. The slackbot is HTTP-only today (`@slack/web-api` + Hono, no `@slack/socket-mode`), so that's a code change for later — out of scope here.

---

## Prerequisites (do before Task 1)

These are environment/setup steps, not code changes — no commits.

- [ ] **Tooling installed:** `brew install just kubectl helm jq ngrok podman` and a running `podman machine` (`podman machine init && podman machine start`). No Docker — `contrib/scripts/k3s-local.sh` installs k3s natively inside the podman VM and `deploy-local.sh` builds with podman + imports into k3s. (Note: the committed `contrib/scripts/{k3s-local.sh,deploy-local.sh}` are the source of truth — they also add a `--only <svc>` single-image rebuild flag; the embedded script blocks below predate the kind→k3s pivot.)
- [ ] **ngrok authtoken configured** (one-time): sign up (free) and `ngrok config add-authtoken <token>`. Verify with `ngrok config check` → "Valid configuration file".
- [ ] **Pick the Slack subdomain:** we have the custom branded domain `infinex-centaur.ngrok.dev` with a wildcard endpoint (`*.infinex-centaur.ngrok.dev`), so any subdomain resolves with no per-subdomain reservation. Use **`slack.infinex-centaur.ngrok.dev`** for FirenzeStaging. The Slack Request URL is `https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack` — baked into the manifest in Task 5. (No tailnet, no Tailscale Funnel, no admin approval — ngrok is fully independent of the SNX/team tailnet.)
- [ ] **Centaur checkout on the PR branch:**

```bash
git clone https://github.com/infinex-dev/centaur.git
cd centaur
git fetch origin pull/1/head:pr-1-env-deploy
git checkout pr-1-env-deploy
git checkout -b feat/local-dev-env   # work branch for this plan
```

- [ ] **`FirenzeStaging` Slack app (two-phase — see Task 5):** This is a NEW, dedicated staging app — do not reuse a production Centaur app. **Phase 1 (before deploy):** create it from the Task 5 manifest with the `event_subscriptions` block commented out (api.slack.com/apps → "Create app → From a manifest"), and collect its `SLACK_BOT_TOKEN` (`xoxb-…`) + `SLACK_SIGNING_SECRET`. **Phase 3 (after deploy + ngrok are live):** re-apply the full manifest with `event_subscriptions` uncommented so Slack verifies the Request URL against the live, stable ngrok endpoint. The reason for two phases: Slack validates the baked Request URL at apply time, but the signing secret it signs the challenge with only exists once the app is created. See Task 5 for the full explanation.
- [ ] **Model key ready:** `OPENAI_API_KEY` (default harness is Codex; agent turns fail without it).

All file paths below are relative to the root of this `centaur` checkout.

---

## File Structure

| File | Responsibility |
|---|---|
| `contrib/chart/values.local-env.yaml` (create) | Helm values for local k3s: env secrets, local image names, ingress/NetworkPolicy off, small resource footprint. |
| `contrib/scripts/deploy-local.sh` (create) | One-command local deploy: build (podman) → import into k3s → create/patch secrets → `helm upgrade --install`. |
| `contrib/scripts/k3s-local.sh` (create) | Bring up / reconnect the k3s cluster inside the podman VM: install k3s if absent, write the kubeconfig, open the API SSH tunnel. |
| `contrib/scripts/tunnel-local.sh` (create) | Port-forward the slackbot service and open `ngrok` on a reserved static domain for Slack's Events API Request URL. |
| `contrib/deploy-local-runsheet.md` (create) | Human runbook: prerequisites, run order, Slack app config, teardown. |
| `contrib/slack-app-manifest.yaml` (create) | `FirenzeStaging` Slack app manifest with scopes, bot user, **and Event Subscriptions (Request URL + bot events) baked in** — create the app from a manifest in one shot. |

Each task produces one self-contained, independently reviewable file. The scripts (Tasks 2 and 3) carry runtime behavior; they are validated with `bash -n` + a live run in Task 6.

---

### Task 1: Local Helm values

**Files:**
- Create: `contrib/chart/values.local-env.yaml`

- [ ] **Step 1: Write the values file**

```yaml
# Local laptop values for Centaur on kind/k3s using env-secret credentials.
#
# Reuses the env-secret path from values.production-env.example.yaml but strips
# the internal-cluster specifics: no private registry, no Traefik/Tailscale
# operator ingress, no cert-manager, no hardcoded Kubernetes-API CIDRs. Images are
# built locally and loaded into kind. Slack reaches the slackbot via
# `kubectl port-forward` + `ngrok` (see contrib/scripts/tunnel-local.sh).

global:
  imagePullSecrets: []

secretManager:
  existingSecretName: centaur-infra-env
  envPrefix: ""

ironProxy:
  secretSource: env
  secretTtl: 10m
  image:
    repository: centaur-iron-proxy
    tag: latest
    pullPolicy: IfNotPresent

api:
  executionWorkerEnabled: true
  workflowWorkerEnabled: true
  # Warm pool keeps idle sandbox pods running; off locally for a lighter laptop
  # footprint. The first @mention then pays a one-time sandbox cold start.
  warmPoolEnabled: false
  defaultHarness: codex
  # Egress discovery defaults to on and targets the `centaur-egress` namespace,
  # which only exists on the internal cluster — disable it locally (matches
  # contrib/chart/values.dev.yaml).
  egressDiscovery:
    enabled: false
  image:
    repository: centaur-api
    tag: latest
    pullPolicy: IfNotPresent

slackbot:
  enabled: true
  image:
    repository: centaur-slackbot
    tag: latest
    pullPolicy: IfNotPresent

sandbox:
  image:
    repository: centaur-agent
    tag: latest
    pullPolicy: IfNotPresent
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "2"
      memory: 2Gi

postgres:
  enabled: true
  persistence:
    enabled: true
    size: 5Gi

# No ingress locally — the slackbot is reached via port-forward + tunnel, and the
# API via kubectl exec/port-forward.
ingress:
  enabled: false

# kind's default CNI (kindnet) does not enforce NetworkPolicy, so the egress
# lockdown is a no-op locally; disabling it also removes the need for the
# production CIDR/no-proxy values. NOTE: this means sandboxes are not network-
# isolated locally — fine for laptop testing, not for shared/production use.
networkPolicy:
  enabled: false

runnerAccess:
  enabled: false
```

- [ ] **Step 2: Lint the values against the chart schema**

Run: `helm lint contrib/chart -f contrib/chart/values.local-env.yaml`
Expected: `1 chart(s) linted, 0 chart(s) failed` (no schema errors against `contrib/chart/values.schema.json`).

- [ ] **Step 3: Render and assert the cluster-specifics are gone**

```bash
helm template centaur contrib/chart -n centaur \
  -f contrib/chart/values.local-env.yaml > /tmp/local-render.yaml
echo "--- registry refs (expect none) ---";  ! grep -i 'registry.inx.local' /tmp/local-render.yaml
echo "--- tailscale refs (expect none) ---";  ! grep -i 'tailscale'         /tmp/local-render.yaml
echo "--- ingress objects (expect none) ---"; ! grep -E '^kind: Ingress'    /tmp/local-render.yaml
echo "--- local image names (expect present) ---"; grep -E 'image: centaur-(api|slackbot|agent|iron-proxy):latest' /tmp/local-render.yaml
```

Expected: the three `!` checks print nothing and succeed; the final `grep` prints the four local image references.

- [ ] **Step 4: Commit**

```bash
git add contrib/chart/values.local-env.yaml
git commit -m "feat(local): add kind/k3s env-secret Helm values"
```

---

### Task 2: Local deploy script

**Files:**
- Create: `contrib/scripts/deploy-local.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Local Centaur deploy for kind/k3s with env-based secrets (no 1Password).
# Build -> load images into kind -> create/patch secrets -> helm upgrade --install.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER="${CENTAUR_KIND_CLUSTER:-centaur}"
NAMESPACE="${CENTAUR_NAMESPACE:-centaur}"
RELEASE="${CENTAUR_RELEASE:-centaur}"
CONTAINER_CLI="${CONTAINER_CLI:-docker}"      # docker | podman
CHART_DIR="${CHART_DIR:-$ROOT_DIR/contrib/chart}"
VALUES_FILE="${VALUES_FILE:-$ROOT_DIR/contrib/chart/values.local-env.yaml}"
SECRET_NAME="${CENTAUR_INFRA_SECRET_NAME:-centaur-infra-env}"
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container-cli) CONTAINER_CLI="${2:?}"; shift 2 ;;
    --cluster)       CLUSTER="${2:?}";       shift 2 ;;
    --namespace|-n)  NAMESPACE="${2:?}";     shift 2 ;;
    --release)       RELEASE="${2:?}";       shift 2 ;;
    --skip-build)    SKIP_BUILD=1;           shift ;;
    --help|-h)
      echo "Usage: contrib/scripts/deploy-local.sh [--container-cli docker|podman] [--cluster NAME] [--namespace NS] [--release NAME] [--skip-build]"
      echo "Required env: SLACK_BOT_TOKEN SLACK_SIGNING_SECRET OPENAI_API_KEY"
      echo "Optional env: ANTHROPIC_API_KEY AMP_API_KEY"
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd "$CONTAINER_CLI"; require_cmd kind; require_cmd kubectl; require_cmd helm; require_cmd openssl

API_IMAGE=centaur-api
SLACKBOT_IMAGE=centaur-slackbot
AGENT_IMAGE=centaur-agent
IRON_PROXY_IMAGE=centaur-iron-proxy

# 1. Ensure the kind cluster exists and is the active context.
if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  echo ">> creating kind cluster: $CLUSTER"
  kind create cluster --name "$CLUSTER"
fi
kubectl config use-context "kind-${CLUSTER}" >/dev/null

# 2. Build the four images locally.
build_image() {
  local image="$1" dockerfile="$2" target="${3:-}"
  local args=(build -t "${image}:latest" -f "$dockerfile")
  [[ -n "$target" ]] && args+=(--target "$target")
  args+=("$ROOT_DIR")
  echo ">> build ${image}:latest"
  "$CONTAINER_CLI" "${args[@]}"
}

if [[ "$SKIP_BUILD" != "1" ]]; then
  build_image "$API_IMAGE"        "$ROOT_DIR/services/api/Dockerfile"
  build_image "$SLACKBOT_IMAGE"   "$ROOT_DIR/services/slackbot/Dockerfile"
  build_image "$AGENT_IMAGE"      "$ROOT_DIR/services/sandbox/Dockerfile" sandbox
  build_image "$IRON_PROXY_IMAGE" "$ROOT_DIR/services/iron-proxy/Dockerfile"
fi

# 3. Load images into the kind node image store.
#    Docker: kind reads directly. Podman: save to an archive first.
load_image() {
  local image="${1}:latest"
  echo ">> load $image into kind/$CLUSTER"
  if [[ "$CONTAINER_CLI" == "podman" ]]; then
    local tar; tar="$(mktemp -t centaur-img-XXXX.tar)"
    podman save -o "$tar" "$image"
    kind load image-archive "$tar" --name "$CLUSTER"
    rm -f "$tar"
  else
    kind load docker-image "$image" --name "$CLUSTER"
  fi
}
for img in "$API_IMAGE" "$SLACKBOT_IMAGE" "$AGENT_IMAGE" "$IRON_PROXY_IMAGE"; do
  load_image "$img"
done

# 4. Namespace.
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

# 5. Infra secret. Create with generated infra values on first run; on later runs
#    only patch the user-supplied creds so the generated values (and the Postgres
#    password the running DB already uses) are preserved.
if ! kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" >/dev/null 2>&1; then
  echo ">> creating secret $SECRET_NAME"
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
    --from-literal=DATABASE_URL="postgresql://tempo:${POSTGRES_PASSWORD}@${RELEASE}-centaur-postgres:5432/ai_v2" \
    --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    --from-literal=IRON_MANAGEMENT_API_KEY="$(openssl rand -hex 32)" \
    --from-literal=SANDBOX_SIGNING_KEY="$(openssl rand -hex 32)" \
    --from-literal=SLACKBOT_API_KEY="$(openssl rand -hex 32)" \
    --from-literal=SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN:?set SLACK_BOT_TOKEN}" \
    --from-literal=SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:?set SLACK_SIGNING_SECRET}" \
    --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:?set OPENAI_API_KEY}" \
    --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    --from-literal=AMP_API_KEY="${AMP_API_KEY:-}"
else
  echo ">> patching user creds on existing secret $SECRET_NAME"
  kubectl -n "$NAMESPACE" patch secret "$SECRET_NAME" -p "$(cat <<JSON
{"stringData":{"SLACK_BOT_TOKEN":"${SLACK_BOT_TOKEN:?}","SLACK_SIGNING_SECRET":"${SLACK_SIGNING_SECRET:?}","OPENAI_API_KEY":"${OPENAI_API_KEY:?}"}}
JSON
)"
fi

# 6. Firewall CA secrets (mounted at /firewall-certs/ca-cert.pem). Create once;
#    regenerating would break already-running pods, so skip if present.
if ! kubectl -n "$NAMESPACE" get secret centaur-firewall-ca >/dev/null 2>&1; then
  echo ">> creating firewall CA secrets"
  TMP="$(mktemp -d)"
  openssl genrsa -out "$TMP/ca-key.pem" 4096
  openssl req -x509 -new -nodes -key "$TMP/ca-key.pem" -sha256 -days 3650 \
    -subj "/CN=centaur iron-proxy CA (local)" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign" \
    -out "$TMP/ca-cert.pem"
  kubectl -n "$NAMESPACE" create secret generic centaur-firewall-ca \
    --from-file=ca-cert.pem="$TMP/ca-cert.pem"
  kubectl -n "$NAMESPACE" create secret generic centaur-firewall-ca-key \
    --from-file=ca-cert.pem="$TMP/ca-cert.pem" \
    --from-file=ca-key.pem="$TMP/ca-key.pem"
  rm -rf "$TMP"
fi

# 7. Deploy.
helm dependency update "$CHART_DIR" >/dev/null
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" --create-namespace \
  -f "$VALUES_FILE"

# 8. Roll workloads so patched creds take effect, then wait for the API.
kubectl -n "$NAMESPACE" rollout restart \
  "deploy/${RELEASE}-centaur-api" "deploy/${RELEASE}-centaur-slackbot" 2>/dev/null || true
kubectl -n "$NAMESPACE" rollout status "deploy/${RELEASE}-centaur-api" --timeout=240s

echo ">> done. verify with:"
echo "   kubectl exec -n $NAMESPACE deploy/${RELEASE}-centaur-api -- curl -fsS http://localhost:8000/health"
```

- [ ] **Step 2: Make it executable and syntax-check it**

Run:
```bash
chmod +x contrib/scripts/deploy-local.sh
bash -n contrib/scripts/deploy-local.sh && echo "syntax OK"
command -v shellcheck >/dev/null && shellcheck contrib/scripts/deploy-local.sh || echo "shellcheck not installed (skip)"
```
Expected: `syntax OK`; shellcheck reports no errors (or is skipped if not installed).

- [ ] **Step 3: Verify the help path runs without side effects**

Run: `contrib/scripts/deploy-local.sh --help`
Expected: prints usage including the required env vars; exits 0 without touching the cluster.

- [ ] **Step 4: Commit**

```bash
git add contrib/scripts/deploy-local.sh
git commit -m "feat(local): add build+load+deploy script for kind"
```

---

### Task 3: Slack tunnel helper (ngrok)

**Files:**
- Create: `contrib/scripts/tunnel-local.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Expose the in-cluster slackbot to FirenzeStaging's Slack Events API via ngrok.
# Port-forwards the slackbot service to localhost, then runs ngrok on a RESERVED
# static domain so the public URL is stable:
#   https://<NGROK_DOMAIN>/api/webhooks/slack
# Because it's stable, that URL is baked into the FirenzeStaging manifest
# (Task 5) — nothing to re-paste between runs. ngrok needs no tailnet/Funnel.
#
# Required: NGROK_DOMAIN must be your reserved free static domain, e.g.
#   export NGROK_DOMAIN=slack.infinex-centaur.ngrok.dev

NAMESPACE="${CENTAUR_NAMESPACE:-centaur}"
RELEASE="${CENTAUR_RELEASE:-centaur}"
PORT="${PORT:-3001}"
EVENTS_PATH="${CENTAUR_SLACK_EVENTS_PATH:-/api/webhooks/slack}"
NGROK_DOMAIN="${NGROK_DOMAIN:?set NGROK_DOMAIN to your ngrok domain (e.g. slack.infinex-centaur.ngrok.dev)}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd kubectl; require_cmd ngrok

echo ">> port-forwarding svc/${RELEASE}-centaur-slackbot ${PORT}:3001"
kubectl -n "$NAMESPACE" port-forward "svc/${RELEASE}-centaur-slackbot" "${PORT}:3001" \
  >/tmp/centaur-slackbot-pf.log 2>&1 &
PF_PID=$!
trap 'kill "$PF_PID" 2>/dev/null || true' EXIT
sleep 3

if ! kill -0 "$PF_PID" 2>/dev/null; then
  echo "FATAL: port-forward failed; see /tmp/centaur-slackbot-pf.log" >&2
  cat /tmp/centaur-slackbot-pf.log >&2
  exit 1
fi

echo ">> slackbot reachable at http://localhost:${PORT}"
echo ">> Slack Request URL (baked into FirenzeStaging manifest): https://${NGROK_DOMAIN}${EVENTS_PATH}"
echo ">> starting ngrok on https://${NGROK_DOMAIN} -> localhost:${PORT}"
echo ">> leave this running for the whole Slack session; Ctrl-C tears down ngrok + port-forward."
# Foreground: ngrok holds the tunnel; the EXIT trap stops the port-forward.
ngrok http "${PORT}" --url "https://${NGROK_DOMAIN}"
```

- [ ] **Step 2: Make it executable and syntax-check it**

Run:
```bash
chmod +x contrib/scripts/tunnel-local.sh
bash -n contrib/scripts/tunnel-local.sh && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 3: Verify the static-domain guard fires**

Run: `unset NGROK_DOMAIN; contrib/scripts/tunnel-local.sh`
Expected: exits non-zero with the "set NGROK_DOMAIN…" message before touching the cluster. (On older ngrok that rejects `--url`, use `--domain "${NGROK_DOMAIN}"` instead; 3.22.x supports `--url`.)

- [ ] **Step 4: Commit**

```bash
git add contrib/scripts/tunnel-local.sh
git commit -m "feat(local): add port-forward + ngrok tunnel helper"
```

---

### Task 4: Local runbook

**Files:**
- Create: `contrib/deploy-local-runsheet.md`

- [ ] **Step 1: Write the runbook**

````markdown
# Centaur local-dev runsheet → FirenzeStaging (kind + env secrets + ngrok)

Run Centaur on a laptop kind cluster with credentials in a Kubernetes Secret
(no 1Password), exposed to the `FirenzeStaging` Slack app via ngrok on a reserved
static domain. This is the local counterpart to `contrib/deploy-env-runsheet.md`
(which targets the internal K3s cluster).

## 1. Prerequisites

```bash
brew install just kubectl helm jq kind ngrok podman   # + `podman machine start`
ngrok config add-authtoken <token>             # one-time, free signup
ngrok config check                             # -> "Valid configuration file"
```

We use the custom branded domain `infinex-centaur.ngrok.dev` (wildcard
`*.infinex-centaur.ngrok.dev`), so the subdomain `slack.infinex-centaur.ngrok.dev`
resolves with no extra reservation — no tailnet, no Tailscale Funnel, no admin
approval. The Slack Request URL is
`https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack`.

**Create `FirenzeStaging` — PHASE 1 (scopes only).** At api.slack.com/apps ->
"Create app -> From a manifest", paste `contrib/slack-app-manifest.yaml` with the
`event_subscriptions` block left commented out. Install to your workspace and
collect the Bot User OAuth Token + Signing Secret. (Event Subscriptions are added
in Phase 3 below, once the ngrok endpoint is live with the signing secret.) This
is a dedicated staging app — keep it separate from any production Centaur app.

## 2. Export credentials

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
export OPENAI_API_KEY=sk-...
export NGROK_DOMAIN=slack.infinex-centaur.ngrok.dev   # our custom ngrok subdomain
# optional: export ANTHROPIC_API_KEY=... AMP_API_KEY=...
```

## 3. Deploy

```bash
contrib/scripts/deploy-local.sh                 # podman (default)
# or: contrib/scripts/deploy-local.sh --container-cli podman
```

This creates the kind cluster (if absent), builds and loads the four images,
creates the `centaur-infra-env` + firewall CA secrets, and runs
`helm upgrade --install` with `contrib/chart/values.local-env.yaml`.

## 4. Verify (no Slack)

```bash
kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -fsS http://localhost:8000/health        # {"status":"ok"}
just smoke                                       # result_text contains ...PONG...
```

Do not continue until `just smoke` passes — it isolates the agent stack from Slack.

## 5. Expose to Slack (stable ngrok URL) + finish the app (PHASE 3)

```bash
contrib/scripts/tunnel-local.sh
# port-forwards the slackbot and runs `ngrok http 3001 --url https://$NGROK_DOMAIN`
# stable URL: https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack
```

Now that the endpoint is live at the stable URL **with the FirenzeStaging signing
secret deployed**, finish the app:
- Edit `contrib/slack-app-manifest.yaml`: set `event_subscriptions.request_url`
  to `https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack` and uncomment the
  block (subscribes to `app_mention` + `message.im`).
- In api.slack.com -> your app -> **Features -> App Manifest**, paste the full
  manifest and apply. Slack POSTs a challenge to the live ngrok URL and verifies.
- Because the reserved domain never changes, this verification is permanent — you
  won't touch Slack config again across restarts/reboots.

## 6. Test in Slack

```text
/invite @FirenzeStaging
@FirenzeStaging reply with exactly PONG
```

```bash
just logs slackbot     # expect a POST to the events path
```

## 7. Iterate (the point of all this)

Change code, then push it to the running `FirenzeStaging` bot:

```bash
contrib/scripts/deploy-local.sh --only slackbot   # or: api / agent / iron-proxy (podman-aware)
# The reserved ngrok domain is stable, so the Slack Request URL never needs re-pasting.
```

Then `@FirenzeStaging` again to exercise the new behavior. If you only touched the
slackbot, only its pod needs to roll. The reserved ngrok domain is fixed, so
nothing in Slack changes between iterations.

## Gotchas

- The ngrok domain is stable, but the laptop must be **awake, online, and running
  `tunnel-local.sh` (ngrok)** for Slack to reach the bot. If ngrok isn't running,
  Slack delivery fails and retries. (Unlike Tailscale `--bg`, the ngrok agent must
  stay in the foreground — keep the script running for the whole session.)
- Use the **fixed** `slack.infinex-centaur.ngrok.dev` subdomain across runs — the
  manifest's baked Request URL only stays valid if you keep the same host. (The
  wildcard means other subdomains also work, but Slack is pinned to this one.)
- URL verification fails on Phase-3 manifest apply -> the slackbot verifies the
  challenge signature, so the deployed `SLACK_SIGNING_SECRET` must match
  `FirenzeStaging`'s. Confirm the endpoint is live (`curl https://<domain>/api/webhooks/slack`
  returns a signature error, not a connection error) and `just logs slackbot`.
- Mention lands but nothing runs -> almost always a missing/invalid OPENAI_API_KEY,
  or an auth/allowlist rejection. Check `just logs api` and `just logs slackbot`.
- Wrong workspace / no response -> confirm the token belongs to `FirenzeStaging`
  (not a prod app) and that `FirenzeStaging` is invited to the channel.
- `networkPolicy.enabled: false` means sandboxes are not network-isolated locally.
  Acceptable for laptop testing only.

## Teardown

```bash
# Ctrl-C tunnel-local.sh to stop ngrok + the port-forward (nothing public persists)
helm uninstall centaur -n centaur
kind delete cluster --name centaur
```
````

- [ ] **Step 2: Verify it renders and links resolve**

Run:
```bash
test -f contrib/deploy-local-runsheet.md && echo "exists"
grep -q 'deploy-local.sh' contrib/deploy-local-runsheet.md && echo "references deploy script"
grep -q 'WEBHOOK PATH CAVEAT' contrib/deploy-local-runsheet.md && echo "documents webhook caveat"
```
Expected: prints `exists`, `references deploy script`, `documents webhook caveat`.

- [ ] **Step 3: Commit**

```bash
git add contrib/deploy-local-runsheet.md
git commit -m "docs(local): add kind + env-secret local runsheet"
```

---

### Task 5: `FirenzeStaging` Slack app manifest (Event Subscriptions baked in)

**Files:**
- Create: `contrib/slack-app-manifest.yaml`

> **This is the central deliverable** — the committed source of truth for the `FirenzeStaging` Slack app. Because the ngrok subdomain is **stable and predictable**, the Events API Request URL and bot events are baked straight into this manifest: `https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack`.

> **The one bootstrap wrinkle (read before running):** Slack validates `event_subscriptions.request_url` at the moment a manifest is applied by POSTing a challenge to it. The slackbot's signature middleware verifies that challenge against `SLACK_SIGNING_SECRET` — and that secret only exists *after* the app is created. So the endpoint can't pass verification until *after* you've created the app and deployed with its signing secret. This makes the flow two-phase, not one-shot:
> 1. **Create** the app from this manifest with the `settings.event_subscriptions` block **commented out** (scopes + bot user only) → Slack mints the bot token + signing secret.
> 2. Export those creds, **deploy** (Task 2) and start **ngrok** (Task 3) → the stable URL is now live and holds the correct signing secret.
> 3. **Re-apply** the full manifest (uncomment `event_subscriptions`) via the app's *Features → App Manifest* tab → Slack's challenge now verifies against the live endpoint and **sticks permanently**. Because the reserved domain never changes, this is the last time you touch Slack config.
>
> The webhook path is `/api/webhooks/slack` (plural) — confirmed from `services/slackbot/src/config.ts` (`CENTAUR_SLACK_EVENTS_PATH` default) and the fixed route in `index.ts`. No path guessing needed.

- [ ] **Step 1: Write the manifest**

```yaml
display_information:
  name: FirenzeStaging
  description: Staging instance of the Centaur agent orchestrator, run locally for development. Mention @FirenzeStaging in a thread and the locally-running stack works the task in an isolated sandbox, posting progress and the final answer back.
  background_color: "#0b0b0f"
features:
  bot_user:
    display_name: FirenzeStaging
    always_online: true
oauth_config:
  scopes:
    bot:
      # --- Required ---
      - app_mentions:read   # see @FirenzeStaging mentions
      - chat:write          # post progress + answers in-thread
      # --- DM support ---
      - im:history          # read DM messages sent to the bot
      - im:read             # access basic DM channel info
      - im:write            # open/send DMs to users
settings:
  # PHASE 1 (first create): keep the event_subscriptions block below commented
  #   out — the endpoint can't verify before the signing secret exists.
  # PHASE 3 (re-apply): uncomment and re-apply via Features -> App Manifest.
  #   The path is /api/webhooks/slack (plural) — do not change it.
  # event_subscriptions:
  #   request_url: https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack
  #   bot_events:
  #     - app_mention   # @FirenzeStaging mentions
  #     - message.im    # DMs to the bot
  interactivity:
    is_enabled: false
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

- [ ] **Step 2: Verify it is valid YAML and declares the expected scopes**

Run:
```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('contrib/slack-app-manifest.yaml')); s=d['oauth_config']['scopes']['bot']; req={'app_mentions:read','chat:write','im:history','im:read','im:write'}; assert req.issubset(set(s)), f'missing {req - set(s)}'; assert d['settings']['socket_mode_enabled'] is False; print('manifest OK:', s)"
```
Expected: `manifest OK: ['app_mentions:read', 'chat:write', 'im:history', 'im:read', 'im:write']`

- [ ] **Step 3: Commit**

```bash
git add contrib/slack-app-manifest.yaml
git commit -m "feat(local): add FirenzeStaging staging Slack app manifest (mentions + DMs)"
```

---

### Task 6: End-to-end local verification

This task has no new files — it runs the artifacts from Tasks 1-5 against the real k3s cluster (in the podman VM) and confirms a Slack round-trip. Treat each step's "Expected" as the assertion.

**Files:**
- (none — verification only)

- [ ] **Step 1: Clean deploy from scratch**

```bash
helm uninstall centaur -n centaur 2>/dev/null || true   # clean slate (k3s cluster itself persists)
export SLACK_BOT_TOKEN=xoxb-...        # real values
export SLACK_SIGNING_SECRET=...
export OPENAI_API_KEY=sk-...
contrib/scripts/deploy-local.sh
```
Expected: brings up k3s (via `k3s-local.sh`) if needed, then ends with `rollout status` succeeding for `deploy/centaur-centaur-api` and the "done" hint printed.

- [ ] **Step 2: API health**

Run: `kubectl exec -n centaur deploy/centaur-centaur-api -- curl -fsS http://localhost:8000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 3: Agent turn without Slack**

Run: `CENTAUR_NAMESPACE=centaur CENTAUR_RELEASE=centaur just smoke`
Expected: result JSON with `"status":"completed"` and `result_text` containing `PONG`.

- [ ] **Step 4: Idempotency check (re-run deploy)**

```bash
EXISTING=$(kubectl -n centaur get secret centaur-infra-env -o jsonpath='{.data.POSTGRES_PASSWORD}')
contrib/scripts/deploy-local.sh --skip-build
AFTER=$(kubectl -n centaur get secret centaur-infra-env -o jsonpath='{.data.POSTGRES_PASSWORD}')
[ "$EXISTING" = "$AFTER" ] && echo "POSTGRES_PASSWORD preserved" || echo "FAIL: secret regenerated"
```
Expected: `POSTGRES_PASSWORD preserved` (re-running patches user creds only, never rotates the DB password).

- [ ] **Step 5: Slack round-trip**

```bash
contrib/scripts/tunnel-local.sh   # leave running; starts ngrok on $NGROK_DOMAIN
```
Then complete Phase 3 (runbook §5: uncomment `event_subscriptions` with your
`https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack` URL and re-apply the
manifest), invite the bot, and post `@FirenzeStaging reply with exactly PONG`.
Expected: Slack verifies the Request URL against the live ngrok endpoint; the bot
replies in-thread; `just logs slackbot` shows a `POST` to `/api/webhooks/slack`.

- [ ] **Step 6: Commit a short verification note**

```bash
cat >> contrib/deploy-local-runsheet.md <<'NOTE'

## Verified
- k3s clean deploy + API health + `just smoke` PONG
- deploy re-run preserves POSTGRES_PASSWORD (user-cred patch only)
- live Slack @mention round-trip via stable ngrok static domain
NOTE
git add contrib/deploy-local-runsheet.md
git commit -m "docs(local): record local-dev verification results"
```

---

## Self-Review

**Spec coverage** (against the five "what has to change to support local" blockers identified for PR #1):
1. Private-registry images → Task 1 (local image names, `IfNotPresent`) + Task 2 (podman build + import into k3s, no push). ✓
2. Traefik API ingress → Task 1 (`ingress.enabled: false`). ✓
3. Tailscale Slackbot ingress → Task 1 (in-cluster ingress off) + Task 3 (port-forward + laptop-side `ngrok`, no tailnet dependency). ✓
4. Hardcoded K8s-API egress CIDRs + NetworkPolicy → Task 1 (`networkPolicy.enabled: false`, with documented caveat). ✓
5. Secret bootstrap without 1Password (incl. firewall CA) → Task 2 (env-mode `centaur-infra-env` + firewall CA, idempotent). ✓
Plus: the webhook path is settled as `/api/webhooks/slack` (plural) from `services/slackbot/src/config.ts` + `index.ts` — baked into the Task 5 manifest, no UI guessing; and the missing-in-repo Slack manifest → Task 5 (ships `contrib/slack-app-manifest.yaml` with scopes, DM scopes, and Event Subscriptions). The ngrok reserved-static-domain stable URL is what makes baking the Request URL into the manifest viable — and ngrok needs no tailnet/Funnel permission, sidestepping the blocked Tailscale Funnel entirely; the two-phase create/re-apply flow handles the signing-secret bootstrap (documented in the prerequisites and Task 5). ✓

**Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N". Every code step contains complete file content or exact commands.

**Type/name consistency:** release `centaur`; namespace `centaur`; secret `centaur-infra-env`; firewall secrets `centaur-firewall-ca` / `centaur-firewall-ca-key`; images `centaur-{api,slackbot,agent,iron-proxy}:latest`; workloads `deploy/centaur-centaur-api`, `deploy/centaur-centaur-slackbot`; service `svc/centaur-centaur-slackbot`; postgres host `centaur-centaur-postgres`. These are consistent across Tasks 1-6 and match the `{release}-centaur-{component}` naming used in `contrib/deploy-env-runsheet.md`. Slack scopes/events in Task 5's manifest match those documented in Tasks 3 and 4 (`app_mentions:read`, `chat:write`, `im:*`; events `app_mention`, `message.im`).

**Open assumptions to validate during execution (not blockers):**
- `api.warmPoolEnabled`, `ironProxy.secretTtl`, and `sandbox.resources` keys are taken from `values.production-env.example.yaml`; `helm lint` in Task 1 Step 2 will fail fast if any key is rejected by `values.schema.json`.
- k3s ships a default `local-path` StorageClass for the Postgres PVC; if a cluster lacks one, set `postgres.persistence.enabled: false` for ephemeral local data.
