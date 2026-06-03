# Centaur Local-Dev → FirenzeStaging Slack Bot

> Historical note: the original local-dev plan used a public Slack Events API Request URL. That approach has been superseded for local development. Local and staging Slack ingest now use **Slack Socket Mode**.

## Current local-dev shape

```text
FirenzeStaging Slack app
  ⇄ Socket Mode WebSocket using SLACK_APP_TOKEN (xapp-..., connections:write)
local slackbot pod
  ⇄ local Centaur API
local sandbox pods
```

Local development does **not** require local tunnels, public ingress, or a Slack Request URL.

## Requirements

- Dedicated staging Slack app: `FirenzeStaging`.
- Socket Mode enabled on that staging app only.
- App-level token with `connections:write`, stored as `SLACK_APP_TOKEN`.
- Bot token stored as `SLACK_BOT_TOKEN`.
- Signing secret stored as `SLACK_SIGNING_SECRET` for the existing HTTP fallback routes and production parity.
- Local chart values enable `slackbot.socketMode.enabled: true` with `replicaCount: 1`.

## Local workflow

1. Export credentials or put them in `.env`:

   ```bash
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   SLACK_APP_TOKEN=xapp-...
   SLACK_SOCKET_MODE=1
   OPENAI_API_KEY=...
   # optional: ANTHROPIC_API_KEY=..., AMP_API_KEY=...
   ```

2. Deploy the local stack:

   ```bash
   contrib/scripts/deploy-local.sh
   ```

3. Iterate on the slackbot only:

   ```bash
   just slackbot-socket-mode
   ```

4. Watch for the Socket Mode connection:

   ```text
   slack_socket_mode_connected
   ```

5. Mention the staging bot in Slack and confirm an incoming frame:

   ```text
   slack_socket_mode_event_received
   ```

## Slack app setup

In the staging Slack app:

- Enable **Socket Mode**.
- Create an app-level token with `connections:write`.
- Enable **Event Subscriptions**.
- Subscribe to bot events needed for testing, especially `app_mention` and the relevant `message.*` events.
- Reinstall the app to the workspace after changing scopes or events.
- Invite `@FirenzeStaging` to the channel.

`message.channels` lets Slack deliver public-channel message events for channels the bot is in. Centaur still only hands off actionable mentions, so ordinary channel chatter does not trigger agent runs.

## Verification

```bash
just smoke
kubectl logs -n centaur deploy/centaur-centaur-slackbot -f
kubectl logs -n centaur deploy/centaur-centaur-api -f
```

Healthy signals:

- `slack_socket_mode_connected`
- `slack_socket_mode_event_received`
- `workflow_run_enqueued`
- `sandbox_spawned`
- `execute_started`
- `execute_completed`

If the bot receives events but does not reply, inspect API logs for harness failures. For Anthropic local testing, set `CENTAUR_DEFAULT_HARNESS=claude-code` and start a new Slack thread so the assignment is not pinned to a previous runtime.
