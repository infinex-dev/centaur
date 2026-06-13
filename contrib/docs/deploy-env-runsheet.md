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
  --from-literal=GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
  --from-literal=TYPEFULLY_API_KEY="${TYPEFULLY_API_KEY:-}" \
  --from-literal=DISPLAYDEV_API_KEY="${DISPLAYDEV_API_KEY:-}" \
  | kubectl apply -f -
```

> `GITHUB_TOKEN`, `TYPEFULLY_API_KEY`, and `DISPLAYDEV_API_KEY` are the comms
> delivery-routing tokens — see "Comms delivery routing (phase 2)" below for what
> each unlocks and the GITHUB_TOKEN scope requirement. All three are optional; omit
> any you have not provisioned yet (`--from-literal=…="${VAR:-}"` writes an empty
> string, which the service reports as a disabled capability — the corresponding
> delivery buttons simply don't appear). `GITHUB_TOKEN` is also read by the
> read-only repo-cache; the comms pod shares the same key (see below).

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

## Comms delivery routing (phase 2)

After a comms release reaches `ready_to_ship`, the delivery phase routes each
approved channel to its real destination behind a human-confirmed gate:
blog/web → a platform PR (GitHub REST), x/x-thread → Typefully drafts, and an
optional display.dev draft-review loop for the blog. All of it is **additive and
opt-in** — a deploy with none of the tokens below behaves exactly as before
(the delivery gate never appears).

### Tokens (all optional, all in `centaur-infra-env`)

The comms-factory service reports each as a capability on `GET /health`
(`capabilities: {platform_pr, typefully, display}` — booleans computed from env
presence, never the values). The Centaur workflow probes that once per run and
only renders a delivery group's buttons when its token is present. An absent
token = a hidden button, never a hard failure.

| Secret key | Unlocks | Notes |
|---|---|---|
| `GITHUB_TOKEN` | blog/web → platform PR ("Preview platform PR" / "Create PR") | **Shared with the read-only repo-cache.** Must be a fine-grained PAT with **Contents: Read and write + Pull requests: Read and write** on `infinex-xyz/platform`. See the scope note below. |
| `TYPEFULLY_API_KEY` | x / x-thread → Typefully drafts | v2 Bearer key. Drafts only — never auto-published. Pair with `TYPEFULLY_SOCIAL_SET` (below). |
| `DISPLAYDEV_API_KEY` | the blog draft-review loop on display.dev (`sk_live_…`) | Read from env by the `dsp` CLI in-pod (no on-disk login session). When absent, blog skips straight to the delivery PR. |

**GITHUB_TOKEN scope — important.** The token is reused from the existing
repo-cache secret, upgraded by the operator to Contents+PR write. There is no
"PRs only" GitHub permission (opening a PR requires `Contents: write` to create
the `cf-emit/*` head branch; forking is org-disabled). The "never lands code"
guarantee comes from **platform `main`'s branch protection** (a `pull_request`
ruleset enforced for everyone + required checks/signatures), not from the token:
any write token can only open PRs that a human merges. Caveats accepted by the
operator (2026-06-12): the token is fine-grained PAT-wide, so its Contents:write
applies to every repo on its access list; and the repo-cache pod now mounts a
write-capable token.

### NetworkPolicy egress (the one base-chart change)

The comms pod is default-deny egress except api:8000. The delivery path needs
outbound HTTPS to `api.github.com`, Typefully, and display.dev, so the chart
adds a per-attached-service `egressPorts` knob, set for comms-factory in
`overlays/comms-factory/values.production.yaml`:

```yaml
attachedServices:
  comms-factory:
    egressPorts:
      - 443
```

This renders an **internet-only** egress rule (`ipBlock: 0.0.0.0/0` excepting
the three RFC-1918 ranges, so in-cluster services on 443 stay unreachable). It
is opt-in: an attached service that sets no `egressPorts` gets no 443 rule.

### Env knobs (non-secret, in the attached-service `env:`)

| Env var | Default | Purpose |
|---|---|---|
| `TYPEFULLY_SOCIAL_SET` | `Infinex` | The Typefully social set to create drafts in — numeric id or name. Point it at a private test set for non-production drafting. |
| `COMMS_PLATFORM_REPO` | `infinex-xyz/platform` | Target repo for emitted PRs. The escape hatch for a staging/fork target if org fork policy ever changes; leave unset in production. |

### Reviewer emails for the display.dev loop

The blog review loop publishes a **private** display.dev artifact shared with an
explicit reviewer allowlist (the `--share` list is emails, not Slack IDs). Two
ways to supply them:

- **Workflow input** `reviewer_emails: ["a@x.com", "b@x.com"]` (API-started runs).
- **Slack brief syntax** — add a `reviewers:` line to the brief, parsed inline
  the same way channel selection is: `comms release for blog: <brief>. reviewers: a@x.com, b@x.com`.
  Explicit workflow input wins; malformed addresses are dropped. When neither
  yields an email, the loop is skipped (a context note says so) and the blog goes
  straight to the delivery PR.

### After patching tokens

Secrets are read from `envFrom` at startup and do **not** hot-reload. Restart the
attached service after adding or changing any delivery token:

```bash
kubectl -n centaur-system rollout restart deploy/centaur-centaur-attached-comms-factory
```

Then confirm the capabilities flipped (from inside the API pod, no key needed):

```bash
kubectl exec -n centaur-system deploy/centaur-centaur-api -- \
  curl -fsS http://centaur-centaur-attached-comms-factory:8080/health | jq .capabilities
```

### Outward-write etiquette

Delivery performs real external writes — all reversible, all human-gated:

- **PRs are never auto-merged.** Every emitted PR opens on `cf-emit/<slug>-<run_id>`
  with body "human-approve, DO NOT merge" and receives platform's automatic AI
  content review. A human merges (or closes) it. The emit path is idempotent: a
  re-run with the same `run_id` short-circuits to the existing PR rather than
  opening a second one.
- **Typefully creates drafts only** — a human publishes from the Typefully
  workspace. (No idempotency key exists, so a crash between the API call and the
  durable checkpoint can leave a duplicate *draft* — low stakes; delete the extra
  by hand.)
- **display.dev artifacts are private and torn down** on every non-approval exit
  (`dsp delete`); on approval the artifact is retained as the review record until
  the PR merges, after which the operator may delete it.
- When validating against the real `infinex-xyz/platform`, **close the test PR
  unmerged and delete its branch** (`gh pr close <url> --delete-branch`) and remove
  any test Typefully drafts and the display artifact afterward.
