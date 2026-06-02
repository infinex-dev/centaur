# Centaur local-dev runsheet → FirenzeStaging (kind + env secrets + ngrok)

Run Centaur on a laptop kind cluster with credentials in a Kubernetes Secret
(no 1Password), exposed to the `FirenzeStaging` Slack app via ngrok on a reserved
static domain. This is the local counterpart to `contrib/deploy-env-runsheet.md`
(which targets the internal K3s cluster).

## 1. Prerequisites

```bash
brew install just kubectl helm jq kind ngrok podman
podman machine init                            # one-time (skip if already created)
podman machine start                           # must be running before deploy
ngrok config add-authtoken <token>             # one-time, free signup
ngrok config check                             # -> "Valid configuration file"
```

We build with **podman** (no Docker on these machines). `deploy-local.sh` defaults
to podman and exports `KIND_EXPERIMENTAL_PROVIDER=podman` so kind uses podman too;
pass `--container-cli docker` only if you actually have Docker. Note the repo's
`just build` / `just build-one` recipes hardcode `docker build`, so on a podman-only
box use `deploy-local.sh` (and `--only` for single-image rebuilds) instead of those.

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
# or: contrib/scripts/deploy-local.sh --container-cli docker
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
# Rebuild + reload + redeploy just the service you changed (podman-aware path):
contrib/scripts/deploy-local.sh --only slackbot   # or: api / agent / iron-proxy
# The reserved ngrok domain is stable, so the Slack Request URL never needs re-pasting.
```

`--only` rebuilds and reloads that single image (the heavy agent/sandbox image is
left untouched when you're only tweaking the slackbot), then re-runs Helm and rolls
the api + slackbot pods. Use `deploy-local.sh` with no `--only` to rebuild all four.
(`just build-one` is Docker-only, so prefer `deploy-local.sh --only` on podman.)

Then `@FirenzeStaging` again to exercise the new behavior. The reserved ngrok domain
is fixed, so nothing in Slack changes between iterations.

## Gotchas

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
helm uninstall centaur -n centaur
kind delete cluster --name centaur
```
