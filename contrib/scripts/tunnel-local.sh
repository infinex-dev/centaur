#!/usr/bin/env bash
set -euo pipefail

# Expose the in-cluster slackbot to FirenzeStaging's Slack Events API via ngrok.
# Port-forwards the slackbot service to localhost, then runs ngrok on a RESERVED
# static domain so the public URL is stable:
#   https://<NGROK_DOMAIN>/api/webhooks/slack
# Because it's stable, that URL is baked into the FirenzeStaging manifest
# (Task 5) — nothing to re-paste between runs. ngrok needs no tailnet/Funnel.
#
# Required: NGROK_DOMAIN must be your reserved free static domain, e.g.
#   export NGROK_DOMAIN=slack.infinex-centaur.ngrok.dev

NAMESPACE="${CENTAUR_NAMESPACE:-centaur}"
RELEASE="${CENTAUR_RELEASE:-centaur}"
PORT="${PORT:-3001}"
EVENTS_PATH="${CENTAUR_SLACK_EVENTS_PATH:-/api/webhooks/slack}"
NGROK_DOMAIN="${NGROK_DOMAIN:?set NGROK_DOMAIN to your ngrok domain (e.g. slack.infinex-centaur.ngrok.dev)}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing command: $1" >&2; exit 1; }; }
require_cmd kubectl; require_cmd ngrok

echo ">> port-forwarding svc/${RELEASE}-centaur-slackbot ${PORT}:3001"
kubectl -n "$NAMESPACE" port-forward "svc/${RELEASE}-centaur-slackbot" "${PORT}:3001" \
  >/tmp/centaur-slackbot-pf.log 2>&1 &
PF_PID=$!
trap 'kill "$PF_PID" 2>/dev/null || true' EXIT
sleep 3

if ! kill -0 "$PF_PID" 2>/dev/null; then
  echo "FATAL: port-forward failed; see /tmp/centaur-slackbot-pf.log" >&2
  cat /tmp/centaur-slackbot-pf.log >&2
  exit 1
fi

echo ">> slackbot reachable at http://localhost:${PORT}"
echo ">> Slack Request URL (baked into FirenzeStaging manifest): https://${NGROK_DOMAIN}${EVENTS_PATH}"
echo ">> starting ngrok on https://${NGROK_DOMAIN} -> localhost:${PORT}"
echo ">> leave this running for the whole Slack session; Ctrl-C tears down ngrok + port-forward."
# Foreground: ngrok holds the tunnel; the EXIT trap stops the port-forward.
ngrok http "${PORT}" --url "https://${NGROK_DOMAIN}"
