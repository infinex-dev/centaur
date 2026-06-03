#!/usr/bin/env bash
set -euo pipefail

# Local Centaur deploy onto k3s running inside the podman machine VM (no docker).
# Build with podman -> import into k3s's containerd -> create/patch env secrets ->
# helm upgrade --install. Cluster bring-up + API tunnel is handled by k3s-local.sh.
#
# Required env: SLACK_BOT_TOKEN SLACK_SIGNING_SECRET SLACK_APP_TOKEN OPENAI_API_KEY
# Optional env: ANTHROPIC_API_KEY AMP_API_KEY
# Load them from .env first:  set -a; source .env; set +a

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MACHINE="${CENTAUR_PODMAN_MACHINE:-podman-machine-default}"
NAMESPACE="${CENTAUR_NAMESPACE:-centaur}"
RELEASE="${CENTAUR_RELEASE:-centaur}"
CHART_DIR="${CHART_DIR:-$ROOT_DIR/contrib/chart}"
VALUES_FILE="${VALUES_FILE:-$ROOT_DIR/contrib/chart/values.local-env.yaml}"
SECRET_NAME="${CENTAUR_INFRA_SECRET_NAME:-centaur-infra-env}"
export KUBECONFIG="${CENTAUR_KUBECONFIG:-$HOME/.kube/centaur-k3s.yaml}"
SKIP_BUILD=0
ONLY_SVC=""   # empty = all four; or one of: api slackbot agent iron-proxy
SERVICES_CSV=""
WITH_COMMS_FACTORY=0
SKIP_COMMS_FACTORY_BUILD=0
COMMS_FACTORY_GIT_URL="${COMMS_FACTORY_GIT_URL:-https://github.com/infinex-dev/comms-factory.git}"
# Open PR head for https://github.com/infinex-dev/comms-factory/pull/2.
# The PR base is pinned at 21d335869190bbba107f1c52263acfeb20e0963a;
# deploy the PR head/merge commit, not the base commit or moving main.
COMMS_FACTORY_REF="${COMMS_FACTORY_REF:-8c98f4ab67b0fac386809209df3a63547207e287}"
COMMS_FACTORY_IMAGE="${COMMS_FACTORY_IMAGE:-comms-factory-api}"
COMMS_FACTORY_TAG="${COMMS_FACTORY_TAG:-}"
COMMS_FACTORY_OVERLAY_IMAGE="${COMMS_FACTORY_OVERLAY_IMAGE:-comms-factory-centaur-overlay}"
COMMS_FACTORY_OVERLAY_TAG="${COMMS_FACTORY_OVERLAY_TAG:-local}"
COMMS_FACTORY_REPO="${COMMS_FACTORY_REPO:-}"
COMMS_FACTORY_CACHE_DIR="${COMMS_FACTORY_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/centaur/comms-factory}"
COMMS_FACTORY_DEFAULT_HARNESS="${COMMS_FACTORY_DEFAULT_HARNESS:-claude-code}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace|-n)  NAMESPACE="${2:?}";     shift 2 ;;
    --release)       RELEASE="${2:?}";       shift 2 ;;
    --skip-build)    SKIP_BUILD=1;           shift ;;
    --only)          ONLY_SVC="${2:?}";      shift 2 ;;
    --services)      SERVICES_CSV="${2:?}";  shift 2 ;;
    --with-comms-factory) WITH_COMMS_FACTORY=1; shift ;;
    --comms-factory-repo) COMMS_FACTORY_REPO="${2:?}"; shift 2 ;;
    --comms-factory-ref)  COMMS_FACTORY_REF="${2:?}"; shift 2 ;;
    --skip-comms-factory-build) SKIP_COMMS_FACTORY_BUILD=1; shift ;;
    --help|-h)
      echo "Usage: contrib/scripts/deploy-local.sh [--namespace NS] [--release NAME] [--skip-build] [--only api|slackbot|agent|iron-proxy]"
      echo "       contrib/scripts/deploy-local.sh [--services api,slackbot] [--with-comms-factory] [--comms-factory-repo PATH] [--comms-factory-ref REF]"
      echo "Deploys onto k3s inside the podman machine VM (no docker). See contrib/docs/deploy-local-runsheet.md."
      echo "Required env: SLACK_BOT_TOKEN SLACK_SIGNING_SECRET SLACK_APP_TOKEN OPENAI_API_KEY"
      echo "Optional env: ANTHROPIC_API_KEY AMP_API_KEY EXA_API_KEY COMMS_FACTORY_SERVICE_TOKEN LOCAL_DEV_API_KEY"
      echo "--only rebuilds + reimports a single Centaur image (the rest stay as-is) for fast iteration."
      echo "--services rebuilds + reimports a comma-separated subset of Centaur images."
      echo "--with-comms-factory builds/imports the pinned comms-factory image, builds/mounts the comms overlay, patches local secrets, and enables attachedServices.comms-factory."
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
COMMS_FACTORY_TAG="${COMMS_FACTORY_TAG:-$COMMS_FACTORY_REF}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd podman; require_cmd kubectl; require_cmd helm; require_cmd openssl; require_cmd python3
if [[ "$WITH_COMMS_FACTORY" == "1" && "$SKIP_COMMS_FACTORY_BUILD" != "1" && -z "$COMMS_FACTORY_REPO" ]]; then
  require_cmd git
fi

# 1. Ensure the k3s cluster is up and the API is reachable from the Mac.
"$ROOT_DIR/contrib/scripts/k3s-local.sh"

# Map a service name to its image + Dockerfile (+ optional build target).
SERVICES=(api slackbot agent iron-proxy)
if [[ -n "$ONLY_SVC" && -n "$SERVICES_CSV" ]]; then
  echo "FATAL: use either --only or --services, not both" >&2
  exit 2
fi
if [[ -n "$ONLY_SVC" ]]; then
  printf '%s\n' "${SERVICES[@]}" | grep -qx "$ONLY_SVC" \
    || { echo "FATAL: --only must be one of: ${SERVICES[*]}" >&2; exit 2; }
  SERVICES=("$ONLY_SVC")
elif [[ -n "$SERVICES_CSV" ]]; then
  IFS=',' read -r -a requested_services <<< "$SERVICES_CSV"
  SERVICES=()
  for svc in "${requested_services[@]}"; do
    svc="$(echo "$svc" | xargs)"
    printf '%s\n' api slackbot agent iron-proxy | grep -qx "$svc" \
      || { echo "FATAL: --services entries must be from: api slackbot agent iron-proxy" >&2; exit 2; }
    SERVICES+=("$svc")
  done
fi

image_for()      { case "$1" in api) echo centaur-api ;; slackbot) echo centaur-slackbot ;; agent) echo centaur-agent ;; iron-proxy) echo centaur-iron-proxy ;; esac; }
dockerfile_for() { case "$1" in api) echo "$ROOT_DIR/services/api/Dockerfile" ;; slackbot) echo "$ROOT_DIR/services/slackbot/Dockerfile" ;; agent) echo "$ROOT_DIR/services/sandbox/Dockerfile" ;; iron-proxy) echo "$ROOT_DIR/services/iron-proxy/Dockerfile" ;; esac; }
target_for()     { case "$1" in agent) echo sandbox ;; *) echo "" ;; esac; }

# Resolve the comms-factory source without accidentally building moving upstream
# main. If COMMS_FACTORY_REPO/--comms-factory-repo is supplied, use that checkout
# as-is. Otherwise clone/fetch the reviewed source ref into a local cache.
resolve_comms_factory_repo() {
  if [[ -n "$COMMS_FACTORY_REPO" ]]; then
    [[ -f "$COMMS_FACTORY_REPO/services/api/Dockerfile" ]] \
      || { echo "FATAL: comms-factory repo missing services/api/Dockerfile: $COMMS_FACTORY_REPO" >&2; exit 2; }
    echo "$COMMS_FACTORY_REPO"
    return
  fi

  if [[ ! -d "$COMMS_FACTORY_CACHE_DIR/.git" ]]; then
    echo ">> cloning comms-factory into $COMMS_FACTORY_CACHE_DIR" >&2
    rm -rf "$COMMS_FACTORY_CACHE_DIR"
    git clone "$COMMS_FACTORY_GIT_URL" "$COMMS_FACTORY_CACHE_DIR" >/dev/null
  fi
  echo ">> checking out comms-factory ref $COMMS_FACTORY_REF" >&2
  git -C "$COMMS_FACTORY_CACHE_DIR" fetch --no-tags origin "$COMMS_FACTORY_REF" >/dev/null 2>&1 || true
  git -C "$COMMS_FACTORY_CACHE_DIR" checkout --quiet "$COMMS_FACTORY_REF"
  echo "$COMMS_FACTORY_CACHE_DIR"
}

# 2. Build with podman, then import into k3s's containerd. The chart references
#    bare names (centaur-api:latest, IfNotPresent), which containerd resolves to
#    docker.io/library/centaur-api:latest -- so the image MUST be imported under
#    that exact name and into the k8s.io namespace, or pods ImagePullBackOff.
build_and_import() {
  local image="$1" dockerfile="$2" target="${3:-}" context="${4:-$ROOT_DIR}" tag="${5:-latest}"
  local args=(build -t "${image}:${tag}" -f "$dockerfile")
  [[ -n "$target" ]] && args+=(--target "$target")
  args+=("$context")
  echo ">> build ${image}:${tag} (podman)"
  podman "${args[@]}"
  echo ">> import ${image}:${tag} into k3s"
  podman machine ssh "$MACHINE" \
    "podman tag localhost/${image}:${tag} docker.io/library/${image}:${tag} \
     && podman save docker.io/library/${image}:${tag} | k3s ctr -n k8s.io images import -" >/dev/null
}

if [[ "$SKIP_BUILD" != "1" ]]; then
  for svc in "${SERVICES[@]}"; do
    build_and_import "$(image_for "$svc")" "$(dockerfile_for "$svc")" "$(target_for "$svc")"
  done
fi

if [[ "$WITH_COMMS_FACTORY" == "1" && "$SKIP_COMMS_FACTORY_BUILD" != "1" ]]; then
  comms_repo="$(resolve_comms_factory_repo)"
  build_and_import "$COMMS_FACTORY_IMAGE" "$comms_repo/services/api/Dockerfile" "" "$comms_repo" "$COMMS_FACTORY_TAG"
fi
if [[ "$WITH_COMMS_FACTORY" == "1" && "$SKIP_BUILD" != "1" ]]; then
  build_and_import \
    "$COMMS_FACTORY_OVERLAY_IMAGE" \
    "$ROOT_DIR/overlays/comms-factory/Dockerfile" \
    "" \
    "$ROOT_DIR/overlays/comms-factory" \
    "$COMMS_FACTORY_OVERLAY_TAG"
fi

# 3. Namespace.
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

# 4. Infra secret. Create with generated infra values on first run; on later runs
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
    --from-literal=SLACK_APP_TOKEN="${SLACK_APP_TOKEN:?set SLACK_APP_TOKEN}" \
    --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:?set OPENAI_API_KEY}" \
    --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    --from-literal=AMP_API_KEY="${AMP_API_KEY:-}" \
    --from-literal=GITHUB_TOKEN="${GITHUB_TOKEN:-}"
else
  user_cred_patch="$(python3 - <<'PY'
import json
import os

keys = [
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_APP_TOKEN",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "AMP_API_KEY",
    "EXA_API_KEY",
    "GITHUB_TOKEN",
]
values = {key: os.environ[key] for key in keys if os.environ.get(key)}
print(json.dumps({"stringData": values}) if values else "")
PY
)"
  if [[ -n "$user_cred_patch" ]]; then
    echo ">> patching user creds on existing secret $SECRET_NAME"
    kubectl -n "$NAMESPACE" patch secret "$SECRET_NAME" -p "$user_cred_patch"
  else
    echo ">> keeping existing user creds on secret $SECRET_NAME (no matching env vars set)"
  fi
fi

secret_key_value() {
  local key="$1"
  kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o "jsonpath={.data.${key}}" 2>/dev/null | base64 -d 2>/dev/null || true
}

if [[ "$WITH_COMMS_FACTORY" == "1" ]]; then
  COMMS_FACTORY_SERVICE_TOKEN_VALUE="${COMMS_FACTORY_SERVICE_TOKEN:-$(secret_key_value COMMS_FACTORY_SERVICE_TOKEN)}"
  if [[ -z "$COMMS_FACTORY_SERVICE_TOKEN_VALUE" ]]; then
    COMMS_FACTORY_SERVICE_TOKEN_VALUE="local-comms-$(openssl rand -hex 24)"
  fi
  LOCAL_DEV_API_KEY_VALUE="${LOCAL_DEV_API_KEY:-$(secret_key_value LOCAL_DEV_API_KEY)}"
  if [[ -z "$LOCAL_DEV_API_KEY_VALUE" ]]; then
    LOCAL_DEV_API_KEY_VALUE="aiv2_local_$(openssl rand -hex 24)"
  fi
  COMMS_FACTORY_CAPABILITY_API_KEY_VALUE="${COMMS_FACTORY_CAPABILITY_API_KEY:-$(secret_key_value COMMS_FACTORY_CAPABILITY_API_KEY)}"
  if [[ -z "$COMMS_FACTORY_CAPABILITY_API_KEY_VALUE" ]]; then
    COMMS_FACTORY_CAPABILITY_API_KEY_VALUE="aiv2_comms_cap_$(openssl rand -hex 24)"
  fi
  echo ">> patching comms-factory local secret keys on $SECRET_NAME"
  kubectl -n "$NAMESPACE" patch secret "$SECRET_NAME" -p "$(cat <<JSON
{"stringData":{"COMMS_FACTORY_SERVICE_TOKEN":"${COMMS_FACTORY_SERVICE_TOKEN_VALUE}","LOCAL_DEV_API_KEY":"${LOCAL_DEV_API_KEY_VALUE}","COMMS_FACTORY_CAPABILITY_API_KEY":"${COMMS_FACTORY_CAPABILITY_API_KEY_VALUE}"}}
JSON
)" >/dev/null
fi

# 5. Firewall CA secrets (mounted at /firewall-certs/ca-cert.pem). Create once;
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

# 6. Deploy.
EXTRA_VALUES_ARGS=()
COMMS_VALUES_FILE=""
if [[ "$WITH_COMMS_FACTORY" == "1" ]]; then
  COMMS_VALUES_FILE="$(mktemp)"
  trap '[[ -n "${COMMS_VALUES_FILE:-}" ]] && rm -f "$COMMS_VALUES_FILE"' EXIT
  COMMS_REPO_LIST_FILE="$ROOT_DIR/overlays/comms-factory/repo-context.repositories.txt"
  COMMS_REPO_ALIASES_FILE="$ROOT_DIR/overlays/comms-factory/repo-context.aliases"
  COMMS_REPO_ALIASES="$(grep -Ev '^($|#)' "$COMMS_REPO_ALIASES_FILE" | paste -sd, -)"
  COMMS_REPO_CACHE_VALUES=""
  if [[ -n "${GITHUB_TOKEN:-$(secret_key_value GITHUB_TOKEN)}" ]]; then
    COMMS_REPOSITORIES_YAML="$(awk 'NF && $1 !~ /^#/ { print "    - " $1 }' "$COMMS_REPO_LIST_FILE")"
    COMMS_REPO_CACHE_VALUES="$(cat <<REPOYAML
repoCache:
  enabled: true
  repositories:
$COMMS_REPOSITORIES_YAML
  githubToken:
    existingSecretName: $SECRET_NAME
    secretKey: GITHUB_TOKEN
REPOYAML
)"
  else
    echo ">> GITHUB_TOKEN not found; comms repoCache remains disabled and repo capabilities will stay unavailable"
  fi
  cat > "$COMMS_VALUES_FILE" <<YAML
$COMMS_REPO_CACHE_VALUES

overlay:
  image:
    repository: $COMMS_FACTORY_OVERLAY_IMAGE
    tag: $COMMS_FACTORY_OVERLAY_TAG
    pullPolicy: IfNotPresent
    sourcePath: /overlay

attachedServices:
  comms-factory:
    enabled: true
    image:
      repository: $COMMS_FACTORY_IMAGE
      tag: $COMMS_FACTORY_TAG
      pullPolicy: IfNotPresent
    service:
      port: 8080
    proxy:
      enabled: false
    env:
      CENTAUR_CAPABILITY_BASE_URL: http://${RELEASE}-centaur-api:8000
    secretEnv:
      COMMS_FACTORY_SERVICE_TOKEN:
        secretName: $SECRET_NAME
        key: COMMS_FACTORY_SERVICE_TOKEN
      ANTHROPIC_API_KEY:
        secretName: $SECRET_NAME
        key: ANTHROPIC_API_KEY
        optional: true
      CENTAUR_CAPABILITY_TOKEN:
        secretName: $SECRET_NAME
        key: COMMS_FACTORY_CAPABILITY_API_KEY

api:
  defaultHarness: $COMMS_FACTORY_DEFAULT_HARNESS
  enabledTools:
    - comms_factory
    - repo_context
    - websearch
    - company_context
  extraEnv:
    COMMS_FACTORY_BASE_URL: http://${RELEASE}-centaur-attached-comms-factory:8080
    COMMS_FACTORY_CAPABILITY_BASE_URL: http://${RELEASE}-centaur-api:8000
    REPO_CONTEXT_REPOSITORY_ALIASES: $COMMS_REPO_ALIASES

slackbot:
  extraEnv:
    SLACK_WORKFLOW_COMMANDS: '[{"match":"^comms\\\\s+audit\\\\b[:\\\\s-]*(.*)$","workflow":"comms_audit","input":{"text":"\$1"},"triggerSuffix":":comms_audit"},{"match":"^comms\\\\s+(?:generate|release)\\\\b[:\\\\s-]*(.*)$","workflow":"comms_release","input":{"brief":"\$1"},"triggerSuffix":":comms_release"}]'
YAML
  EXTRA_VALUES_ARGS=(-f "$COMMS_VALUES_FILE")
fi

helm dependency update "$CHART_DIR" >/dev/null
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" --create-namespace \
  -f "$VALUES_FILE" "${EXTRA_VALUES_ARGS[@]}"

# 7. Roll workloads so patched creds take effect, then wait for the API.
rollout_targets=("deploy/${RELEASE}-centaur-api" "deploy/${RELEASE}-centaur-slackbot")
if [[ "$WITH_COMMS_FACTORY" == "1" ]]; then
  rollout_targets+=("deploy/${RELEASE}-centaur-attached-comms-factory")
fi
kubectl -n "$NAMESPACE" rollout restart "${rollout_targets[@]}" 2>/dev/null || true
kubectl -n "$NAMESPACE" rollout status "deploy/${RELEASE}-centaur-api" --timeout=300s
if [[ "$WITH_COMMS_FACTORY" == "1" ]]; then
  kubectl -n "$NAMESPACE" rollout status "deploy/${RELEASE}-centaur-attached-comms-factory" --timeout=300s
fi

echo ">> done. verify with:"
echo "   kubectl exec -n $NAMESPACE deploy/${RELEASE}-centaur-api -- curl -fsS http://localhost:8000/health"
if [[ "$WITH_COMMS_FACTORY" == "1" ]]; then
  echo "   API_KEY=\$(kubectl get secret -n $NAMESPACE $SECRET_NAME -o jsonpath='{.data.LOCAL_DEV_API_KEY}' | base64 -d)"
  echo "   CAP_KEY=\$(kubectl get secret -n $NAMESPACE $SECRET_NAME -o jsonpath='{.data.COMMS_FACTORY_CAPABILITY_API_KEY}' | base64 -d)"
  echo "   kubectl exec -n $NAMESPACE deploy/${RELEASE}-centaur-api -- curl -fsS -H \"X-Api-Key: \$API_KEY\" http://localhost:8000/tools/comms_factory/validate -H 'Content-Type: application/json' -d '{\"text\":\"Fact A is live.\"}'"
  echo "   kubectl exec -n $NAMESPACE deploy/${RELEASE}-centaur-api -- curl -fsS -H \"X-Api-Key: \$CAP_KEY\" http://localhost:8000/capabilities/catalog?profile=comms"
fi
