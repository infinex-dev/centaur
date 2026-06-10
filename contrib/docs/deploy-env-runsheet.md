# Centaur env-secret Kubernetes deployment runsheet

This runsheet documents the manual one-time cluster setup for the Infinex
cluster. Ongoing image build, push, and Helm deploys are handled by
`contrib/scripts/deploy-k8s-env.sh`.

## Cluster assumptions

- Namespace: `centaur-system`
- Egress discovery namespace: `centaur-egress`
- Release: `centaur`
- Registry prefix: `registry.inx.local/centaur`
- Internal URL: `https://centaur.inx.local`
- Slackbot Tailscale host label: `centaur-slack`
- Traefik Ingress class: `traefik`
- Traefik namespace: `kube-system`
- Tailscale Ingress class: `tailscale`
- Tailscale operator namespace: `tailscale`
- cert-manager ClusterIssuer: `step-ca-acme`
- Traefik load balancer IP: `10.83.81.1`
- Kubernetes API service IP: `10.43.0.1`
- Kubernetes API endpoint IP: `10.83.80.4`

## One-time setup

Create the namespaces:

```bash
kubectl create namespace centaur-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace centaur-egress --dry-run=client -o yaml | kubectl apply -f -
```

Create the infra Secret. Placeholder values are acceptable for the initial
control-plane setup, but real Slack and model credentials must be patched before
running Slack or agent smoke tests.

```bash
POSTGRES_PASSWORD="$(openssl rand -hex 32)"
SLACKBOT_API_KEY="$(openssl rand -hex 32)"

kubectl -n centaur-system create secret generic centaur-infra-env \
  --from-literal=DATABASE_URL="postgresql://tempo:${POSTGRES_PASSWORD}@centaur-centaur-postgres:5432/ai_v2" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=IRON_MANAGEMENT_API_KEY="$(openssl rand -hex 32)" \
  --from-literal=SANDBOX_SIGNING_KEY="$(openssl rand -hex 32)" \
  --from-literal=SLACKBOT_API_KEY="$SLACKBOT_API_KEY" \
  --from-literal=SLACK_BOT_TOKEN="placeholder-slack-bot-token" \
  --from-literal=SLACK_SIGNING_SECRET="placeholder-slack-signing-secret" \
  --from-literal=OPENAI_API_KEY="placeholder-openai-api-key"
```

Create the firewall CA Secrets:

```bash
TMPDIR="$(mktemp -d)"
CA_KEY="$TMPDIR/ca-key.pem"
CA_CERT="$TMPDIR/ca-cert.pem"

openssl genrsa -out "$CA_KEY" 4096
openssl req -x509 -new -nodes \
  -key "$CA_KEY" -sha256 -days 3650 \
  -subj "/CN=centaur iron-proxy CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign" \
  -out "$CA_CERT"

kubectl -n centaur-system create secret generic centaur-firewall-ca \
  --from-file=ca-cert.pem="$CA_CERT"

kubectl -n centaur-system create secret generic centaur-firewall-ca-key \
  --from-file=ca-cert.pem="$CA_CERT" \
  --from-file=ca-key.pem="$CA_KEY"

rm -rf "$TMPDIR"
```

Manually add `centaur.inx.local` to `kube-system/coredns-custom`, in the
`infinex.server` hosts block:

```text
10.83.81.1  centaur.inx.local
```

Then reload CoreDNS:

```bash
kubectl -n kube-system rollout restart deployment/coredns
kubectl -n kube-system rollout status deployment/coredns --timeout=90s
```

Verify DNS from inside the cluster:

```bash
kubectl -n centaur-system run dns-check --rm -i --restart=Never \
  --image=busybox:1.36 -- nslookup centaur.inx.local
```

Create the TLS certificate with cert-manager. The Helm chart references this
pre-created Secret from the Ingress.

```bash
kubectl -n centaur-system apply -f - <<'YAML'
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: centaur-inx-local
spec:
  commonName: centaur.inx.local
  dnsNames:
    - centaur.inx.local
  issuerRef:
    kind: ClusterIssuer
    name: step-ca-acme
  secretName: centaur-inx-local-tls
YAML
```

Wait for the certificate Secret:

```bash
kubectl -n centaur-system wait certificate/centaur-inx-local \
  --for=condition=Ready --timeout=120s

kubectl -n centaur-system get secret centaur-inx-local-tls
```

Enable Tailscale prerequisites for the Slackbot Funnel ingress:

- MagicDNS and HTTPS must be enabled on the tailnet.
- The Tailscale policy must allow the Kubernetes operator proxy tag to use
  Funnel. The operator default proxy tag is usually `tag:k8s`.

Example policy fragment:

```json
"nodeAttrs": [
  {
    "target": ["tag:k8s"],
    "attr": ["funnel"]
  }
]
```

## Patch real credentials later

When real values are available, patch the existing Secret instead of recreating
it:

```bash
kubectl -n centaur-system create secret generic centaur-infra-env \
  --dry-run=client -o yaml \
  --from-literal=SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN" \
  --from-literal=SLACK_SIGNING_SECRET="$SLACK_SIGNING_SECRET" \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
  --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
  --from-literal=AMP_API_KEY="${AMP_API_KEY:-}" \
  | kubectl apply -f -
```

Restart workloads after patching credentials:

```bash
kubectl -n centaur-system rollout restart deploy/centaur-centaur-api deploy/centaur-centaur-slackbot
```

## Ongoing deploy

Build, push, and deploy with Podman:

```bash
contrib/scripts/deploy-k8s-env.sh \
  --registry registry.inx.local/centaur \
  --namespace centaur-system \
  --release centaur \
  --host centaur.inx.local \
  --ingress-class traefik \
  --ingress-controller-namespace kube-system \
  --slackbot-tailscale-host centaur-slack \
  --insecure-registry
```

`--insecure-registry` is only needed when Podman does not trust the internal
registry certificate. Remove it once the registry CA is trusted by Podman.

## Verify deployment

```bash
kubectl get pods -n centaur-system
kubectl get ingress,certificate -n centaur-system
kubectl get pods -n tailscale | grep centaur-centaur-slackbot

kubectl exec -n centaur-system deploy/centaur-centaur-api -- \
  curl -fsS http://localhost:8000/health

kubectl exec -n centaur-system deploy/centaur-centaur-api -- \
  curl -fsS http://localhost:8000/health/ready | jq

curl -k https://centaur.inx.local/health
```
