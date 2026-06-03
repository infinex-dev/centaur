# Centaur local-dev runsheet (k3s-in-podman + Socket Mode)

Run Centaur on a local **k3s cluster running natively inside the podman machine VM**
(no docker), with credentials in a Kubernetes Secret (no 1Password). The
your dedicated local/dev Slack app reaches the local slackbot through **Slack Socket Mode**:
the slackbot pod opens an outbound WebSocket to Slack, so local development does not
need a public tunnel or an Events API Request URL.

## 1. Prerequisites

```bash
brew install just kubectl helm jq podman
podman machine init --cpus 4 --memory 8192     # one-time (skip if already created)
podman machine start                           # must be running
```

Disk size depends on your machine. The Centaur images are large, especially the
agent/sandbox image, so grow the podman VM disk if k3s reports disk pressure.

`contrib/scripts/k3s-local.sh` handles cluster setup on first deploy and reconnects
future sessions. It installs k3s inside the podman VM, waits for the node to be
Ready, writes `~/.kube/centaur-k3s.yaml`, and opens an SSH tunnel so `kubectl` and
`helm` on the Mac reach the k3s API on `127.0.0.1:6443`.

## 2. Configure a local/dev Slack app

At https://api.slack.com/apps, create or open a dedicated local/dev app. Do not
reuse the production Centaur app.

1. Open **App Manifest**, set the editor to JSON, and paste
   `contrib/manifests/slack-app-manifest.json`.
2. Ensure **Socket Mode** is enabled.
3. In **Basic Information → App-Level Tokens**, create an app-level token with
   `connections:write`. It should start with `xapp-`.
4. In **Event Subscriptions**, ensure the bot events you need are enabled, including
   `app_mention` and the relevant `message.*` events.
5. Reinstall the app to the workspace after changing scopes or events.
6. Invite the local/dev bot user to the test channel.

## 3. Export credentials

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
export SLACK_APP_TOKEN=xapp-...
export SLACK_SOCKET_MODE=1
export OPENAI_API_KEY=sk-...
# optional: export ANTHROPIC_API_KEY=... AMP_API_KEY=...
```

`SLACK_SIGNING_SECRET` is still kept in the local secret because the production HTTP
path and local HTTP fallback routes still exist, but local Slack ingest uses Socket
Mode.

## 4. Deploy

```bash
set -a; source .env; set +a            # or export the vars from step 3
contrib/scripts/deploy-local.sh
```

On first run this brings up k3s in the podman VM, builds the images with podman,
imports them into k3s containerd, creates the `centaur-infra-env` and firewall CA
secrets, and runs `helm upgrade --install` with
`contrib/chart/values.local-env.yaml`.

For slackbot-only iteration, use:

```bash
just slackbot-socket-mode
```

That rebuilds and redeploys only the slackbot, waits for rollout, and tails logs.
Look for:

```text
slack_socket_mode_connected
```

## 5. Verify without Slack

```bash
kubectl exec -n centaur deploy/centaur-centaur-api -- \
  curl -fsS http://localhost:8000/health
just smoke
```

Do not debug Slack until the local stack passes this smoke test.

## 6. Test in Slack

```text
/invite @<your local bot>
@<your local bot> reply with exactly PONG
```

Watch logs:

```bash
kubectl logs -n centaur deploy/centaur-centaur-slackbot -f
kubectl logs -n centaur deploy/centaur-centaur-api -f
```

Expected slackbot signals:

```text
slack_socket_mode_connected
slack_socket_mode_event_received
```

Expected API signals include `workflow_run_enqueued`, `sandbox_spawned`,
`execute_started`, and `execute_completed`.

## Gotchas

- **No incoming `slack_socket_mode_event_received`:** check Socket Mode, Event
  Subscriptions, bot scopes, app reinstall status, and whether the bot is invited to
  the channel.
- **Bot receives events but does not reply:** check API logs for harness failures.
  For local Anthropic testing, set `CENTAUR_DEFAULT_HARNESS=claude-code` on the API
  deployment and start a new Slack thread.
- **`users.profile.get` missing scope:** add `users.profile:read` if requester
  profile lookup matters, then reinstall the Slack app.
- **Local images must be imported into k3s under the `docker.io/library` name.**
  `deploy-local.sh` handles this.
- **Disk pressure:** grow the podman VM disk if pods are stuck Pending or images are
  garbage-collected.
- **k3s API tunnel:** if `kubectl` hangs after a reboot or new shell, run
  `contrib/scripts/k3s-local.sh` to reconnect.
- **NetworkPolicy locally:** `k3s-local.sh` disables k3s network-policy enforcement
  for laptop testing so sandboxes can resolve DNS and reach model providers.

## Teardown

```bash
helm uninstall centaur -n centaur
pkill -f '6443:127.0.0.1:6443' || true
# To remove k3s entirely from the VM:
# podman machine ssh podman-machine-default 'sudo /usr/local/bin/k3s-uninstall.sh'
```
