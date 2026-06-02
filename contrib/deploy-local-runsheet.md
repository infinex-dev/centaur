# Centaur local-dev runsheet → FirenzeStaging (k3s-in-podman + env secrets + ngrok)

Run Centaur on a local **k3s cluster running natively inside the podman machine VM**
(no docker), with credentials in a Kubernetes Secret (no 1Password), exposed to the
`FirenzeStaging` Slack app via ngrok on a reserved static domain. This is the local
counterpart to `contrib/deploy-env-runsheet.md` (which targets the internal K3s
cluster) — same K3s shape, just hosted in your laptop's podman VM.

## 1. Prerequisites

```bash
brew install just kubectl helm jq ngrok podman
podman machine init --cpus 4 --memory 8192     # one-time (skip if already created)
podman machine start                           # must be running
ngrok config add-authtoken <token>             # one-time, free signup
ngrok config check                             # -> "Valid configuration file"
```

Disk size depends on your machine: the default is fine for a roomy or dedicated VM.
Only if your podman VM is also packed with other projects' images do the centaur
images (~8GB; the agent/sandbox image alone is ~6GB) risk tipping it into
`disk-pressure` — see the Gotchas for how to grow it then (no need to plan for it
up front).

`contrib/scripts/k3s-local.sh` handles the rest of cluster setup on first deploy (and
reconnects every session): it installs k3s **natively inside the podman VM**, waits for
the node to be Ready, writes `~/.kube/centaur-k3s.yaml`, and opens an SSH tunnel so
`kubectl`/`helm` on the Mac reach the k3s API on `127.0.0.1:6443`. No docker, no kind —
k3s runs on the VM's own kernel, so the VM *is* the node (same shape as production).
`deploy-local.sh` runs it for you; run it standalone any time to reconnect (e.g. after a
reboot).

We use the custom branded domain `infinex-centaur.ngrok.dev` (wildcard
`*.infinex-centaur.ngrok.dev`), so the subdomain `slack.infinex-centaur.ngrok.dev`
resolves with no extra reservation — no tailnet, no Tailscale Funnel, no admin
approval. The Slack Request URL is
`https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack`.

**Create `FirenzeStaging` — PHASE 1 (scopes only).** At api.slack.com/apps ->
"Create app -> From a manifest", set the editor toggle to **JSON** and paste
`contrib/slack-app-manifest.json` (it has no `event_subscriptions` — that is added
in Phase 3, once the ngrok endpoint is live with the signing secret). Install to
your workspace and collect the Bot User OAuth Token + Signing Secret. This is a
dedicated staging app — keep it separate from any production Centaur app.

(The manifest is JSON, not YAML: Slack's manifest editor parses JSON, and a YAML
paste fails with `Expecting 'STRING'...got 'INVALID'`. Copy from the file —
`pbcopy < contrib/slack-app-manifest.json` — rather than from chat, to avoid
smart-quote/em-dash corruption.)

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
set -a; source .env; set +a            # or export the vars from step 2
contrib/scripts/deploy-local.sh
```

On first run this brings up k3s in the podman VM (via `k3s-local.sh`), then builds the
four images with podman, imports them into k3s's containerd, creates the
`centaur-infra-env` + firewall CA secrets, and runs `helm upgrade --install` with
`contrib/chart/values.local-env.yaml`.

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
secret deployed**, finish the app. In api.slack.com -> your app -> **Features ->
App Manifest** (JSON), add an `event_subscriptions` key inside `settings` and apply:

```json
"event_subscriptions": {
  "request_url": "https://slack.infinex-centaur.ngrok.dev/api/webhooks/slack",
  "bot_events": ["app_mention", "message.im"]
}
```

Slack POSTs a challenge to the live ngrok URL and verifies it against the deployed
signing secret. Because the reserved domain never changes, this verification is
permanent — you won't touch Slack config again across restarts/reboots.

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
# Rebuild + reimport + redeploy just the service you changed:
contrib/scripts/deploy-local.sh --only slackbot   # or: api / agent / iron-proxy
# The reserved ngrok domain is stable, so the Slack Request URL never needs re-pasting.
```

`--only` rebuilds and reimports that single image (the heavy agent/sandbox image is
left untouched when you're only tweaking the slackbot), then re-runs Helm and rolls
the api + slackbot pods. Use `deploy-local.sh` with no `--only` to rebuild all four.

Then `@FirenzeStaging` again to exercise the new behavior. The reserved ngrok domain
is fixed, so nothing in Slack changes between iterations.

## Gotchas

- **The k3s API reaches you over a per-session SSH tunnel.** k3s lives in the podman
  VM; the tunnel (Mac:6443 → VM:6443) is set up by `k3s-local.sh` and does not survive
  a VM reboot or a new shell — if `kubectl` hangs, just re-run
  `contrib/scripts/k3s-local.sh` to reconnect (idempotent). k3s itself auto-starts on
  VM boot, so the cluster and your workloads persist.
- **Local images must be imported into k3s under the `docker.io/library` name.** The
  chart uses bare `centaur-*:latest` (IfNotPresent), which containerd resolves to
  `docker.io/library/centaur-*:latest` in the `k8s.io` namespace. `deploy-local.sh`
  does this (tag → `podman save` → `k3s ctr -n k8s.io images import`); if you load
  images by hand, match that name and namespace or pods `ImagePullBackOff`.
- **Disk-pressure → pods stuck Pending / ImagePullBackOff.** The images (especially the
  ~6GB agent/sandbox image) plus everything else in the VM can push the disk past k3s's
  15% imagefs threshold, which taints the node *and* garbage-collects the imported
  images. Grow the disk without recreating the machine:
  `podman machine stop <m> && podman machine set --disk-size 160 <m> && podman machine start <m>`,
  then inside the VM `sudo growpart /dev/vda 4 && sudo xfs_growfs /`.
- **Webhook path caveat:** the Slack Events Request URL path is
  `/api/webhooks/slack` (plural `webhooks`) — the slackbot's fixed route and the
  `CENTAUR_SLACK_EVENTS_PATH` default in `services/slackbot/src/config.ts`. Do not
  drop the `s` or change the path, or Slack's challenge POST 404s and verification
  fails.
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
helm uninstall centaur -n centaur            # remove the app, keep the cluster
pkill -f '6443:127.0.0.1:6443' || true       # close the k3s API tunnel
# k3s keeps running in the VM for next time. To remove it from the VM entirely:
# podman machine ssh podman-machine-default 'sudo /usr/local/bin/k3s-uninstall.sh'
```
