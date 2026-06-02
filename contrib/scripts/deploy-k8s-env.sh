#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${CENTAUR_NAMESPACE:-centaur-system}"
RELEASE="${CENTAUR_RELEASE:-centaur}"
REGISTRY="${REGISTRY:-}"
TAG="${TAG:-}"
CONTAINER_CLI="${CONTAINER_CLI:-podman}"
VALUES_FILE="${VALUES_FILE:-$ROOT_DIR/contrib/chart/values.production-env.example.yaml}"
CHART_DIR="${CHART_DIR:-$ROOT_DIR/contrib/chart}"
SECRET_NAME="${CENTAUR_INFRA_SECRET_NAME:-centaur-infra-env}"
IMAGE_PULL_SECRET="${IMAGE_PULL_SECRET:-}"
INGRESS_HOST="${INGRESS_HOST:-}"
INGRESS_CLASS="${INGRESS_CLASS:-}"
INGRESS_CONTROLLER_NAMESPACE="${INGRESS_CONTROLLER_NAMESPACE:-}"
SLACKBOT_TAILSCALE_HOST="${SLACKBOT_TAILSCALE_HOST:-}"
INSECURE_REGISTRY="${INSECURE_REGISTRY:-0}"
SKIP_BUILD=0
SKIP_PUSH=0
SKIP_DEPLOY=0

usage() {
  cat <<'EOF'
Usage: contrib/scripts/deploy-k8s-env.sh --registry REGISTRY [options]

Ongoing deployment script for env-secret based Centaur installs.
Uses podman by default to build and push images, then runs helm upgrade --install.

Options:
  --registry REGISTRY       Registry/repository prefix, e.g. registry.local/centaur
  --tag TAG                 Image tag (default: current git short SHA)
  --namespace NAME          Kubernetes namespace (default: centaur-system)
  --release NAME            Helm release name (default: centaur)
  --values FILE             Helm values file (default: contrib/chart/values.production-env.example.yaml)
  --container-cli NAME      Container CLI (default: podman; set docker if needed)
  --image-pull-secret NAME  Set global.imagePullSecrets[0].name
  --host HOST               Override ingress.api.host
  --ingress-class NAME      Override ingress.api.className
  --ingress-controller-namespace NAME
                            Allow ingress traffic from this controller namespace
  --slackbot-tailscale-host HOST
                            Override ingress.slackbot.host for Tailscale
  --insecure-registry       Push with Podman's TLS verification disabled
  --skip-build              Do not build images
  --skip-push               Do not push images
  --skip-deploy             Do not run Helm
  --help                    Show this help

Environment equivalents:
  REGISTRY, TAG, CENTAUR_NAMESPACE, CENTAUR_RELEASE, VALUES_FILE,
  CONTAINER_CLI, IMAGE_PULL_SECRET, INGRESS_HOST, INGRESS_CLASS,
  INGRESS_CONTROLLER_NAMESPACE, SLACKBOT_TAILSCALE_HOST, INSECURE_REGISTRY

Example:
  contrib/scripts/deploy-k8s-env.sh \
    --registry registry.inx.local/centaur \
    --host centaur.inx.local \
    --ingress-class traefik \
    --ingress-controller-namespace kube-system
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry)
      REGISTRY="${2:?--registry requires a value}"
      shift 2
      ;;
    --tag)
      TAG="${2:?--tag requires a value}"
      shift 2
      ;;
    --namespace|-n)
      NAMESPACE="${2:?--namespace requires a value}"
      shift 2
      ;;
    --release)
      RELEASE="${2:?--release requires a value}"
      shift 2
      ;;
    --values|-f)
      VALUES_FILE="${2:?--values requires a value}"
      shift 2
      ;;
    --container-cli)
      CONTAINER_CLI="${2:?--container-cli requires a value}"
      shift 2
      ;;
    --image-pull-secret)
      IMAGE_PULL_SECRET="${2:?--image-pull-secret requires a value}"
      shift 2
      ;;
    --host)
      INGRESS_HOST="${2:?--host requires a value}"
      shift 2
      ;;
    --ingress-class)
      INGRESS_CLASS="${2:?--ingress-class requires a value}"
      shift 2
      ;;
    --ingress-controller-namespace)
      INGRESS_CONTROLLER_NAMESPACE="${2:?--ingress-controller-namespace requires a value}"
      shift 2
      ;;
    --slackbot-tailscale-host)
      SLACKBOT_TAILSCALE_HOST="${2:?--slackbot-tailscale-host requires a value}"
      shift 2
      ;;
    --insecure-registry)
      INSECURE_REGISTRY=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-push)
      SKIP_PUSH=1
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "FATAL: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd "$CONTAINER_CLI"
require_cmd helm

if [[ -z "$REGISTRY" ]]; then
  echo "FATAL: --registry or REGISTRY is required" >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  require_cmd git
  TAG="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
fi

if [[ ! -f "$VALUES_FILE" ]]; then
  echo "FATAL: values file not found: $VALUES_FILE" >&2
  exit 1
fi

API_IMAGE="${API_IMAGE:-$REGISTRY/centaur-api}"
SLACKBOT_IMAGE="${SLACKBOT_IMAGE:-$REGISTRY/centaur-slackbot}"
AGENT_IMAGE="${AGENT_IMAGE:-$REGISTRY/centaur-agent}"
IRON_PROXY_IMAGE="${IRON_PROXY_IMAGE:-$REGISTRY/centaur-iron-proxy}"

build_image() {
  local image="$1"
  local dockerfile="$2"
  local target="${3:-}"
  local args=(build -t "$image:$TAG" -f "$dockerfile")
  if [[ -n "$target" ]]; then
    args+=(--target "$target")
  fi
  args+=("$ROOT_DIR")
  "$CONTAINER_CLI" "${args[@]}"
}

push_image() {
  local image="$1"
  local args=(push)
  if [[ "$INSECURE_REGISTRY" == "1" ]]; then
    args+=(--tls-verify=false)
  fi
  args+=("$image:$TAG")
  "$CONTAINER_CLI" "${args[@]}"
}

if [[ "$SKIP_BUILD" != "1" ]]; then
  build_image "$API_IMAGE" "$ROOT_DIR/services/api/Dockerfile"
  build_image "$SLACKBOT_IMAGE" "$ROOT_DIR/services/slackbot/Dockerfile"
  build_image "$AGENT_IMAGE" "$ROOT_DIR/services/sandbox/Dockerfile" sandbox
  build_image "$IRON_PROXY_IMAGE" "$ROOT_DIR/services/iron-proxy/Dockerfile"
fi

if [[ "$SKIP_PUSH" != "1" ]]; then
  push_image "$API_IMAGE"
  push_image "$SLACKBOT_IMAGE"
  push_image "$AGENT_IMAGE"
  push_image "$IRON_PROXY_IMAGE"
fi

if [[ "$SKIP_DEPLOY" == "1" ]]; then
  echo "Built/pushed images with tag $TAG; skipping Helm deploy"
  exit 0
fi

require_cmd kubectl
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

helm dependency update "$CHART_DIR" >/dev/null

helm_args=(
  upgrade --install "$RELEASE" "$CHART_DIR"
  --namespace "$NAMESPACE"
  --create-namespace
  -f "$VALUES_FILE"
  --set "secretManager.existingSecretName=$SECRET_NAME"
  --set "ironProxy.secretSource=env"
  --set "api.image.repository=$API_IMAGE"
  --set-string "api.image.tag=$TAG"
  --set "slackbot.image.repository=$SLACKBOT_IMAGE"
  --set-string "slackbot.image.tag=$TAG"
  --set "sandbox.image.repository=$AGENT_IMAGE"
  --set-string "sandbox.image.tag=$TAG"
  --set "ironProxy.image.repository=$IRON_PROXY_IMAGE"
  --set-string "ironProxy.image.tag=$TAG"
)

if [[ -n "$IMAGE_PULL_SECRET" ]]; then
  helm_args+=(--set "global.imagePullSecrets[0].name=$IMAGE_PULL_SECRET")
fi

if [[ -n "$INGRESS_HOST" ]]; then
  tls_secret="${INGRESS_HOST//./-}-tls"
  helm_args+=(--set "ingress.api.host=$INGRESS_HOST")
  helm_args+=(--set "ingress.api.tls[0].hosts[0]=$INGRESS_HOST")
  helm_args+=(--set "ingress.api.tls[0].secretName=$tls_secret")
fi

if [[ -n "$INGRESS_CLASS" ]]; then
  helm_args+=(--set "ingress.api.className=$INGRESS_CLASS")
fi

if [[ -n "$INGRESS_CONTROLLER_NAMESPACE" ]]; then
  helm_args+=(
    --set "networkPolicy.apiIngressSourceNamespaces[0]=$INGRESS_CONTROLLER_NAMESPACE"
  )
fi

if [[ -n "$SLACKBOT_TAILSCALE_HOST" ]]; then
  helm_args+=(--set "ingress.slackbot.host=$SLACKBOT_TAILSCALE_HOST")
  helm_args+=(--set "ingress.slackbot.tls[0].hosts[0]=$SLACKBOT_TAILSCALE_HOST")
fi

helm "${helm_args[@]}"

echo "Deployed $RELEASE to namespace $NAMESPACE with image tag $TAG"
