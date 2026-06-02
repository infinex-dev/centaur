#!/usr/bin/env bash
set -euo pipefail

# Local Centaur deploy for kind/k3s with env-based secrets (no 1Password).
# Build -> load images into kind -> create/patch secrets -> helm upgrade --install.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER="${CENTAUR_KIND_CLUSTER:-centaur}"
NAMESPACE="${CENTAUR_NAMESPACE:-centaur}"
RELEASE="${CENTAUR_RELEASE:-centaur}"
CONTAINER_CLI="${CONTAINER_CLI:-podman}"      # podman | docker
CHART_DIR="${CHART_DIR:-$ROOT_DIR/contrib/chart}"
VALUES_FILE="${VALUES_FILE:-$ROOT_DIR/contrib/chart/values.local-env.yaml}"
SECRET_NAME="${CENTAUR_INFRA_SECRET_NAME:-centaur-infra-env}"
SKIP_BUILD=0
ONLY_SVC=""   # empty = all four; or one of: api slackbot agent iron-proxy

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container-cli) CONTAINER_CLI="${2:?}"; shift 2 ;;
    --cluster)       CLUSTER="${2:?}";       shift 2 ;;
    --namespace|-n)  NAMESPACE="${2:?}";     shift 2 ;;
    --release)       RELEASE="${2:?}";       shift 2 ;;
    --skip-build)    SKIP_BUILD=1;           shift ;;
    --only)          ONLY_SVC="${2:?}";       shift 2 ;;
    --help|-h)
      echo "Usage: contrib/scripts/deploy-local.sh [--container-cli podman|docker] [--cluster NAME] [--namespace NS] [--release NAME] [--skip-build] [--only api|slackbot|agent|iron-proxy]"
      echo "Required env: SLACK_BOT_TOKEN SLACK_SIGNING_SECRET OPENAI_API_KEY"
      echo "Optional env: ANTHROPIC_API_KEY AMP_API_KEY"
      echo "Container CLI defaults to podman; pass --container-cli docker to override."
      echo "--only rebuilds + reloads a single image (the rest stay as-is) for fast iteration."
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd "$CONTAINER_CLI"; require_cmd kind; require_cmd kubectl; require_cmd helm; require_cmd openssl

# kind defaults to the docker provider; with podman it must be told explicitly,
# otherwise `kind create cluster`/`kind load` look for a docker daemon that
# isn't there. Harmless when docker is the chosen CLI.
if [[ "$CONTAINER_CLI" == "podman" ]]; then
  export KIND_EXPERIMENTAL_PROVIDER=podman
fi

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
  for svc in "${SERVICES[@]}"; do
    build_image "$(image_for "$svc")" "$(dockerfile_for "$svc")" "$(target_for "$svc")"
  done
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
for svc in "${SERVICES[@]}"; do
  load_image "$(image_for "$svc")"
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
