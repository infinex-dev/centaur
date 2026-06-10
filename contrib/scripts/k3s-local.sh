#!/usr/bin/env bash
set -euo pipefail

# Bring up (and connect to) a local k3s cluster running NATIVELY inside the
# podman machine VM -- no docker, no kind. k3s runs on the VM's own kernel, so
# the VM *is* the node; this avoids the nested-container /sys remount that makes
# `kind` impossible on podman's macOS VM. Idempotent: safe to re-run every session.
#
# What it guarantees on exit:
#   - the podman machine is running
#   - k3s is installed and the node is Ready
#   - ~/.kube/centaur-k3s.yaml exists and an SSH tunnel exposes the k3s API on
#     127.0.0.1:6443 so kubectl/helm on the Mac can reach it
#
# Env overrides: CENTAUR_PODMAN_MACHINE, CENTAUR_KUBECONFIG

MACHINE="${CENTAUR_PODMAN_MACHINE:-podman-machine-default}"
KUBECONFIG_PATH="${CENTAUR_KUBECONFIG:-$HOME/.kube/centaur-k3s.yaml}"
API_PORT=6443   # k3s.yaml hardcodes 127.0.0.1:6443; keep the local end matching

log() { echo ">> $*"; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd podman; require_cmd ssh; require_cmd kubectl; require_cmd nc

# 1. Machine running.
if ! podman machine inspect "$MACHINE" --format '{{.State}}' 2>/dev/null | grep -q running; then
  log "starting podman machine $MACHINE"
  podman machine start "$MACHINE"
fi

# 2. k3s installed in the VM (one-time). The k3s installer layers an SELinux
#    policy via rpm-ostree, which aborts if any enabled repo 404s -- the stock
#    image ships a dead fedora-39 podman-next copr repo, so disable it first.
#    rpm-ostree layered packages need a reboot to activate, hence the restart.
if ! podman machine ssh "$MACHINE" 'test -x /usr/local/bin/k3s' 2>/dev/null; then
  log "installing k3s inside $MACHINE (one-time)"
  podman machine ssh "$MACHINE" '
    repo=/etc/yum.repos.d/rhcontainerbot-podman-next-fedora.repo
    [ -f "$repo" ] && sed -i "s/^enabled=1/enabled=0/" "$repo"
    curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --disable servicelb --write-kubeconfig-mode 644" sh -'
  log "rebooting machine to activate the k3s-selinux policy layer"
  podman machine stop "$MACHINE"
  podman machine start "$MACHINE"
fi

# 2b. Disable k3s's NetworkPolicy controller (idempotent). The API creates a
#     per-sandbox egress NetworkPolicy unconditionally (services/api/api/sandbox/
#     kubernetes.py) that only allows egress to the API + iron-proxy -- no DNS. In
#     prod/kind the CNI doesn't enforce egress so it's a no-op, but k3s ships an
#     enforcing controller, which blocks the sandbox from reaching CoreDNS and the
#     codex/claude harness fails with "failed to lookup address information". This
#     restores the prod-like "egress lockdown is a no-op locally" behavior.
#     Local-only; touches no app code, chart, or prod cluster.
if ! podman machine ssh "$MACHINE" 'sudo grep -qs "^disable-network-policy: true" /etc/rancher/k3s/config.yaml' 2>/dev/null; then
  log "disabling k3s network-policy controller (local sandboxes are not network-isolated)"
  podman machine ssh "$MACHINE" '
    sudo mkdir -p /etc/rancher/k3s
    echo "disable-network-policy: true" | sudo tee -a /etc/rancher/k3s/config.yaml >/dev/null
    sudo systemctl restart k3s'
fi

# 3. Wait for k3s active + node Ready (checked inside the VM).
log "waiting for k3s node to be Ready"
podman machine ssh "$MACHINE" '
  for _ in $(seq 1 40); do
    if systemctl is-active --quiet k3s && /usr/local/bin/k3s kubectl get nodes 2>/dev/null | grep -q " Ready "; then
      exit 0
    fi
    sleep 3
  done
  echo "FATAL: k3s did not become Ready" >&2; exit 1'

# 4. Kubeconfig onto the Mac (server is already https://127.0.0.1:6443, and the
#    k3s API cert includes 127.0.0.1 as a SAN, so the tunnel below validates).
mkdir -p "$(dirname "$KUBECONFIG_PATH")"
podman machine ssh "$MACHINE" 'cat /etc/rancher/k3s/k3s.yaml' > "$KUBECONFIG_PATH"
chmod 600 "$KUBECONFIG_PATH"
KUBECONFIG="$KUBECONFIG_PATH" kubectl config rename-context default centaur-k3s >/dev/null 2>&1 || true

# 5. SSH tunnel Mac:6443 -> VM:6443 (podman machine doesn't forward the API port).
#    Skip if something is already listening locally (an existing tunnel).
if nc -z 127.0.0.1 "$API_PORT" 2>/dev/null; then
  log "k3s API already reachable on 127.0.0.1:$API_PORT (tunnel up)"
else
  ssh_port="$(podman machine inspect "$MACHINE" --format '{{.SSHConfig.Port}}')"
  ssh_ident="$(podman machine inspect "$MACHINE" --format '{{.SSHConfig.IdentityPath}}')"
  log "opening k3s API tunnel on 127.0.0.1:$API_PORT (ssh port $ssh_port)"
  ssh -fN -i "$ssh_ident" -p "$ssh_port" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ExitOnForwardFailure=yes \
    -L "${API_PORT}:127.0.0.1:6443" "core@127.0.0.1"
fi

log "k3s ready. Connect with:  export KUBECONFIG=$KUBECONFIG_PATH"
KUBECONFIG="$KUBECONFIG_PATH" kubectl get nodes
