#!/usr/bin/env bash
set -euo pipefail

# Local Centaur deploy onto k3s running inside the podman machine VM (no docker).
# Build with podman -> import into k3s's containerd -> create/patch env secrets ->
# helm upgrade --install. Cluster bring-up + API tunnel is handled by k3s-local.sh.
#
# Required env: SLACK_BOT_TOKEN SLACK_SIGNING_SECRET OPENAI_API_KEY
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace|-n)  NAMESPACE="${2:?}";     shift 2 ;;
    --release)       RELEASE="${2:?}";       shift 2 ;;
    --skip-build)    SKIP_BUILD=1;           shift ;;
    --only)          ONLY_SVC="${2:?}";      shift 2 ;;
    --help|-h)
      echo "Usage: contrib/scripts/deploy-local.sh [--namespace NS] [--release NAME] [--skip-build] [--only api|slackbot|agent|iron-proxy]"
      echo "Deploys onto k3s inside the podman machine VM (no docker). See contrib/deploy-local-runsheet.md."
      echo "Required env: SLACK_BOT_TOKEN SLACK_SIGNING_SECRET OPENAI_API_KEY"
      echo "Optional env: ANTHROPIC_API_KEY AMP_API_KEY"
      echo "--only rebuilds + reimports a single image (the rest stay as-is) for fast iteration."
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd podman; require_cmd kubectl; require_cmd helm; require_cmd openssl

# 1. Ensure the k3s cluster is up and the API is reachable from the Mac.
"$ROOT_DIR/contrib/scripts/k3s-local.sh"

# Map a service name to its image + Dockerfile (+ optional build target).
SERVICES=(api slackbot agent iron-proxy)
if [[ -n "$ONLY_SVC" ]]; then
  printf '%s\n' "${SERVICES[@]}" | grep -qx "$ONLY_SVC" \
    || { echo "FATAL: --only must be one of: ${SERVICES[*]}" >&2; exit 2; }
  SERVICES=("$ONLY_SVC")
fi

image_for()      { case "$1" in api) echo centaur-api ;; slackbot) echo centaur-slackbot ;; agent) echo centaur-agent ;; iron-proxy) echo centaur-iron-proxy ;; esac; }
dockerfile_for() { case "$1" in api) echo "$ROOT_DIR/services/api/Dockerfile" ;; slackbot) echo "$ROOT_DIR/services/slackbot/Dockerfile" ;; agent) echo "$ROOT_DIR/services/sandbox/Dockerfile" ;; iron-proxy) echo "$ROOT_DIR/services/iron-proxy/Dockerfile" ;; esac; }
target_for()     { case "$1" in agent) echo sandbox ;; *) echo "" ;; esac; }

# 2. Build with podman, then import into k3s's containerd. The chart references
#    bare names (centaur-api:latest, IfNotPresent), which containerd resolves to
#    docker.io/library/centaur-api:latest -- so the image MUST be imported under
#    that exact name and into the k8s.io namespace, or pods ImagePullBackOff.
build_and_import() {
  local image="$1" dockerfile="$2" target="${3:-}"
  local args=(build -t "${image}:latest" -f "$dockerfile")
  [[ -n "$target" ]] && args+=(--target "$target")
  args+=("$ROOT_DIR")
  echo ">> build ${image}:latest (podman)"
  podman "${args[@]}"
  echo ">> import ${image}:latest into k3s"
  podman machine ssh "$MACHINE" \
    "podman tag localhost/${image}:latest docker.io/library/${image}:latest \
     && podman save docker.io/library/${image}:latest | k3s ctr -n k8s.io images import -" >/dev/null
}

if [[ "$SKIP_BUILD" != "1" ]]; then
  for svc in "${SERVICES[@]}"; do
    build_and_import "$(image_for "$svc")" "$(dockerfile_for "$svc")" "$(target_for "$svc")"
  done
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
helm dependency update "$CHART_DIR" >/dev/null
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" --create-namespace \
  -f "$VALUES_FILE"

# 7. Roll workloads so patched creds take effect, then wait for the API.
kubectl -n "$NAMESPACE" rollout restart \
  "deploy/${RELEASE}-centaur-api" "deploy/${RELEASE}-centaur-slackbot" 2>/dev/null || true
kubectl -n "$NAMESPACE" rollout status "deploy/${RELEASE}-centaur-api" --timeout=300s

echo ">> done. verify with:"
echo "   kubectl exec -n $NAMESPACE deploy/${RELEASE}-centaur-api -- curl -fsS http://localhost:8000/health"
