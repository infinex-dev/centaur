---
title: "feat: Slack Socket Mode for the slackbot (staging/local, env-gated)"
type: feat
status: completed
date: 2026-06-03
---

# feat: Slack Socket Mode for the slackbot (staging/local, env-gated)

## Overview

Add Slack **Socket Mode** as an env-gated ingest path to `services/slackbot`, so the
**staging** bot (a separate Slack app that already exists) and local dev can receive Slack
events over an outbound WebSocket instead of a public HTTP Request URL. This removes the
public tunnel + Request URL + signing-secret juggling for non-prod.

**Production is unchanged.** Prod stays on the existing HTTP Events API + signature path.
The socket path is off unless `SLACK_SOCKET_MODE` is set, so the prod release renders
byte-identical to today.

The event-processing core is already transport-agnostic (`processSlackEvent`,
`normalizeSlackEnvelope`, `CentaurHandoff.emit`, `parseSlackBody`). The work is: extract the
body→result core out of the two Hono wrappers so it is callable with a plain payload, add a
`SocketModeClient` lifecycle module that runs alongside the Hono server in the same process,
and wire config + chart values behind a flag.

---

## Problem Frame

Today every Slack route in `services/slackbot/src/index.ts` is HTTP-only and guarded by
`slackSignatureMiddleware`:

```
app.post(config.CENTAUR_SLACK_EVENTS_PATH, slackSignatureMiddleware, slackHandler)   // index.ts:139
app.post('/api/slack/events',   slackSignatureMiddleware, slackHandler)              // :140
app.post('/api/slack/actions',  slackSignatureMiddleware, slackHandler)              // :141
app.post('/api/slack/options',  slackSignatureMiddleware, slackHandler)              // :142
app.post('/api/slack/commands', slackSignatureMiddleware, slackCommandHandler)       // :143
app.post('/api/webhooks/slack', slackSignatureMiddleware, slackHandler)              // :144
```

Receiving these in staging/local used to require a public Request URL and a local tunnel.
Socket Mode lets the
bot dial out over `wss://` using an app-level token (`xapp-…`, scope `connections:write`),
needing no inbound ingress at all. `contrib/local-dev-plan.md` already flags Socket Mode as
the intended future zero-ingress path.

The processing core is **not** bound to Hono — only the two thin wrappers are:

- `processSlackEvent(envelope: SlackEnvelope): Promise<void>` — `index.ts:493` — no `c.` reference.
- `normalizeSlackEnvelope({ envelope, botUserId, client })` — `src/slack/normalize.ts:35` — pure.
- `CentaurHandoff.emit(normalized)` — `src/centaur/handoff.ts` — pure `fetch`.
- `parseSlackBody(rawBody, contentType): SlackEnvelope | null` — `index.ts:697` — pure.
- `slackHandler = async (c) => …` — `index.ts:106` — only Hono touch: `c.get('slackRawBody')` (107), `c.req.header('content-type')` (107), `c.json(...)` (108/109/132/136), `runInBackground(c, …)` (130/135).
- `slackCommandHandler = async (c) => …` — `index.ts:574` — only Hono touch: `c.get('slackRawBody')` (575) and `c.json(...)` returning ephemeral bodies (576–619).

---

## Requirements Trace

- R1. Staging/local can receive Slack events with **no public Request URL** (WebSocket only).
- R2. Production HTTP ingest is **unchanged** — same routes, same `slackSignatureMiddleware`, same observable behavior when the flag is off.
- R3. The mode is **env-gated** (`SLACK_SOCKET_MODE` + `SLACK_APP_TOKEN`); a single release can opt in via values without code changes.
- R4. App-mention/message events processed via the socket follow the **identical** path as HTTP (dedup → `processSlackEvent` → normalize → handoff).
- R5. Slash-command (`/website-feedback`) responses still reach the user — the ephemeral body is delivered via Socket Mode `ack(body)`.
- R6. Socket events are correctly treated as **pre-authenticated** (no signature verification), and `slackSignatureMiddleware` is never invoked on that path.
- R7. The constraint that only **one replica** may run Socket Mode (in-memory `EventDeduper` is per-process) is enforced/documented so staging doesn't double-deliver.

---

## Scope Boundaries

- **Not** enabling Socket Mode in production. Prod stays HTTP Events API + signature. The plan only makes it *possible* to opt in per-release; the prod values file is left default-off.
- **Not** migrating the outbound Slack Web API calls (`/api/slack/messages`, streaming, etc., `index.ts:146`–`415`) — those are unrelated HTTP endpoints and stay as-is.
- **Not** adding multi-replica Socket Mode coordination (shared dedup store / leader election). Single replica only; multi-replica is explicitly out of scope.
- **Not** adding `@slack/bolt`. `@slack/socket-mode` + the existing `@slack/web-api` is sufficient.
- **Not** changing the Slack app manifest for the **production** app. Socket Mode is enabled only on the **existing separate staging Slack app**.

### Deferred to Follow-Up Work

- Provisioning the `SLACK_APP_TOKEN` secret into the staging secret store (`secretManager`) — operational step, tracked with the staging deploy rather than this PR.

---

## Context & Research

### Relevant Code and Patterns

- `services/slackbot/src/index.ts`
  - `slackSignatureMiddleware` — `:90` (reads raw body, calls `verifySlackSignature`, sets `slackRawBody`). Registered **per-route**, not global (`:139`–`:144`) — so the socket path bypasses it for free.
  - `slackHandler` — `:106`; `slackCommandHandler` — `:574`.
  - `processSlackEvent` — `:493`; dedup via `deduper.checkAndRemember` + `slackDedupKey` (`:112`–`:133`); `ackWithReaction` — `:536`.
  - `runInBackground` — `:677`; `getExecutionContext` returns `null` fallback and `void guarded` (`:686`) when there is no Hono execution context — so background work degrades gracefully off the HTTP path.
  - `parseSlackBody` — `:697`; `parseSlackCommandBody` (used at `:575`).
  - Server entrypoint: `export default { port: config.PORT, fetch: app.fetch }` — `:419`–`:422`.
- `src/slack/normalize.ts:35` — `normalizeSlackEnvelope`; only processes `event_callback` message/app_mention (`:40`, `:103`).
- `src/slack/dedup.ts` — in-memory `EventDeduper` (per-process).
- `src/slack/signature.ts:7` — `verifySlackSignature`.
- `src/centaur/handoff.ts` — `CentaurHandoff.emit`.
- `src/config.ts` — `EnvSchema` (`:3`–`:54`); `SLACK_SIGNING_SECRET` is already `.optional()` (`:8`).
- Tests to preserve/extend: `src/index.test.ts`, `test/emulate/slack-e2e.test.ts`, `src/slack/normalize.test.ts`, `src/slack/dedup.test.ts`, `src/centaur/handoff.test.ts`.

### Chart / Deploy

- `services/slackbot/Dockerfile` — `CMD ["bun", "src/index.ts"]` (no change needed; socket starts inside that process).
- `contrib/chart/templates/workloads.yaml:472`–`553` — slackbot container. Env via `secretKeyRef` (`SLACK_BOT_TOKEN` `:482`, `SLACK_SIGNING_SECRET` `:487`) and the `.Values.slackbot.extraEnv` loop (`:531`–`534`). Probes hit `/health` (`:538`–`545`) — the Hono server must keep running.
- `HTTPS_PROXY`/`NO_PROXY` egress lockdown (`:519`–`526`) applies in prod; harmless locally because `values.local-env.yaml:77` disables NetworkPolicy.
- `contrib/chart/values.yaml:144`–`153` — `slackbot.replicaCount: 1`, `extraEnv: {}`. Single replica is already the default.
- `contrib/chart/values.local-env.yaml:42`–`47` — local slackbot block. `contrib/chart/values.dev.yaml:15` — non-prod (staging) slackbot block.

### External References

- `@slack/socket-mode` `SocketModeClient`: construct with `{ appToken }`, listen via `.on('slack_event', …)` or per-type events, each handler receives `{ ack, body, event }`; call `await ack()` (events) or `ack(responseBody)` (slash commands) then do async work; `.start()` opens the WS via `apps.connections.open`.

---

## Key Technical Decisions

- **Extract a transport-agnostic core, don't duplicate logic.** Refactor `slackHandler`/`slackCommandHandler` so the dedup + dispatch + command logic lives in plain functions callable with `(rawBody, contentType)` and returning a plain result. Both the Hono wrapper and the socket handler call the same core. This keeps the prod path's behavior identical and avoids drift.
- **Run Socket Mode in the same process as Hono, gated at startup.** After `export default` (`index.ts:419`), `if (config.SLACK_SOCKET_MODE) startSocketMode(...)`. The HTTP server (and `/health` probe) stays up. No Dockerfile/CMD change.
- **Slash commands use `ack(body)`.** The HTTP path returns the ephemeral JSON synchronously (`index.ts:578`–`619`); the socket path must pass that same body into `ack()` or the user sees nothing. This is the single highest-risk semantic difference.
- **`url_verification` is dead on the socket path** — there is no Request URL, so that branch (`index.ts:109`) simply isn't reachable via Socket Mode.
- **No signature verification on the socket path.** Socket frames are pre-authenticated by the app token; `slackSignatureMiddleware` stays per-route on HTTP only (`:139`–`144`), untouched. `SLACK_SIGNING_SECRET` is not required when running socket-only.
- **Single replica enforced by convention.** Keep `replicaCount: 1` wherever Socket Mode is enabled; the in-memory `EventDeduper` would not dedup across replicas, causing double handoffs.
- **App token is a secret.** Wire `SLACK_APP_TOKEN` via `secretKeyRef` (optional) gated on the socket flag, mirroring `SLACK_BOT_TOKEN`; the gate flag `SLACK_SOCKET_MODE` is a plain env value.

---

## Open Questions

### Resolved During Planning

- *Does the socket path need its own signature handling?* No — pre-authenticated over the WS; bypasses `slackSignatureMiddleware` cleanly (R6).
- *Same process or sidecar?* Same process, gated at startup — keeps `/health` alive and avoids chart/Dockerfile churn.
- *Which env is "staging"?* The chart has no `staging` values file; non-prod is `values.dev.yaml` (and local is `values.local-env.yaml`). Socket Mode is enabled per-release via a values override, so whichever release fronts the staging Slack app opts in.

### Deferred to Implementation

- Exact `SocketModeClient` event-name surface (`slack_event` umbrella vs per-type `message`/`app_mention`/`slash_commands`/`interactive`) and the precise envelope shape each delivers — confirm against the installed `@slack/socket-mode` version when wiring `socket-mode.ts`.
- Whether `interactive`/`options` socket events need any handling beyond the existing no-op (today `normalizeSlackEnvelope` ignores non-`event_callback`).
- Reconnect/backoff logging detail — start with the client's built-in reconnect; add structured logging if staging shows flakiness.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
                      ┌─────────────────────────── slackbot process ───────────────────────────┐
 HTTP (prod)          │                                                                          │
 Slack Events API ───▶│ slackSignatureMiddleware ─▶ slackHandler(c) ──┐                          │
 (Request URL)        │ slackCommandHandler(c) ───────────────────────┤                          │
                      │                                                ├─▶ handleSlackEventBody(  │
 WebSocket (staging)  │                                                │     rawBody, contentType)│
 wss:// via xapp- ───▶│ SocketModeClient.on(evt) ─▶ await ack()/ack(b) ┘   ── dedup ──▶ process   │
   (socket-mode.ts)   │                                                    SlackEvent ─▶ normalize│
                      │                                                    ─▶ handoff.emit         │
                      │ Hono server (export default) keeps /health alive ◀── k8s probes           │
                      └──────────────────────────────────────────────────────────────────────────┘
                 SLACK_SOCKET_MODE unset  ⇒  only the HTTP arm runs  (= production today)
```

Event ack mapping:

| Slack delivery | HTTP path returns | Socket path does |
|---|---|---|
| `url_verification` | `c.json({challenge})` (`:109`) | n/a (no Request URL) |
| event_callback (dup) | `c.json({ok,duplicate})` (`:132`) | `await ack()`, skip |
| event_callback (new) | `c.json({ok})` after bg work (`:135/136`) | `await ack()`, then bg `processSlackEvent` |
| slash command | `c.json({response_type:'ephemeral', text})` (`:578`–`619`) | `ack(sameBody)` |

---

## Implementation Units

- [ ] U1. **Add Socket Mode config**

**Goal:** Introduce the gate flag and app token to `config.ts`.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `services/slackbot/src/config.ts`
- Test: `services/slackbot/src/index.test.ts` (or a `config.test.ts` if preferred)

**Approach:**
- Add to `EnvSchema` (`:3`–`:54`): `SLACK_APP_TOKEN: z.string().optional()` and `SLACK_SOCKET_MODE` as a boolean gate. Match the codebase's existing string-handling idiom — e.g. a `z.string().optional().transform(v => v === '1' || v === 'true')` or `z.coerce.boolean().default(false)`. Keep `SLACK_SIGNING_SECRET` optional (already is).

**Patterns to follow:**
- Existing optional/transform fields in `EnvSchema` (`SLACK_FEEDBACK_COMMANDS` `:25`, the `.optional()` tokens `:6`–`:11`).

**Test scenarios:**
- Happy path: `SLACK_SOCKET_MODE=1` → config flag is `true`; unset → `false` (prod default).
- Edge case: `SLACK_SOCKET_MODE=true` and `SLACK_SOCKET_MODE=0`/`false`/empty parse to the expected booleans.
- Happy path: `SLACK_APP_TOKEN` present is surfaced; absent is `undefined`.

**Verification:**
- `loadConfig` returns the new fields; existing config tests still pass.

---

- [ ] U2. **Extract transport-agnostic cores from the Hono wrappers**

**Goal:** Make event and command processing callable with a plain `(rawBody, contentType)` so both HTTP and Socket Mode share one implementation, with **zero behavior change** on the HTTP path.

**Requirements:** R2, R4, R5

**Dependencies:** None

**Files:**
- Modify: `services/slackbot/src/index.ts`
- Test: `services/slackbot/src/index.test.ts`, `services/slackbot/test/emulate/slack-e2e.test.ts`

**Approach:**
- Extract from `slackHandler` (`:106`–`137`) a function like `handleSlackEventBody(rawBody, contentType): { kind: 'challenge'|'ok'|'duplicate'|'invalid', body }` (or similar) containing the parse → dedup → `runInBackground(processSlackEvent)` logic. The Hono `slackHandler` becomes a thin shim: read `c.get('slackRawBody')` + content-type, call the core, map the result to `c.json(...)`.
- Extract from `slackCommandHandler` (`:574`–`621`) a function like `handleSlackCommandBody(rawBody): Promise<commandResponseBody>` returning the ephemeral JSON object (and any status). The Hono wrapper maps it to `c.json(...)`.
- For background scheduling, keep `runInBackground(c, …)` on the HTTP path. For the socket path the core should accept an optional scheduler (default `void promise.catch(...)`) so it does not depend on a Hono `Context` — leverage the existing `getExecutionContext` null-fallback semantics (`:689`).

**Execution note:** Characterization-first — this is the only prod-touching refactor. Confirm `src/index.test.ts` and `test/emulate/slack-e2e.test.ts` pass before and after; treat any diff in HTTP responses as a regression.

**Patterns to follow:**
- Keep the existing dedup/log/alert calls (`slackDedupKey` `:112`, `deduper.checkAndRemember` `:118`, `notifyDuplicateSlackAlert` `:130`) inside the extracted core unchanged.

**Test scenarios:**
- Happy path: `url_verification` body → core returns challenge; HTTP wrapper still responds `{challenge}`.
- Happy path: new event_callback → core schedules `processSlackEvent` and returns ok; duplicate → returns duplicate without scheduling.
- Edge case: invalid/empty body → `invalid` result → HTTP 400 (matches `:108`).
- Happy path (command): supported command + text → returns ephemeral "Created …"; unsupported command, disallowed channel, missing `LINEAR_API_KEY`, empty text → each returns the correct ephemeral body (mirrors `:577`–`603`).
- Integration: full `slack-e2e` suite passes unchanged (proves the HTTP path is untouched).

**Verification:**
- All existing slackbot tests pass with no assertion changes; HTTP responses are byte-identical.

---

- [ ] U3. **Add `socket-mode.ts` connection + event routing**

**Goal:** New module that opens the Socket Mode WS and routes events/commands into the U2 cores with correct ack semantics.

**Requirements:** R1, R4, R5, R6

**Dependencies:** U1, U2

**Files:**
- Create: `services/slackbot/src/slack/socket-mode.ts`
- Modify: `services/slackbot/package.json` (add `@slack/socket-mode`)
- Test: `services/slackbot/src/slack/socket-mode.test.ts`

**Approach:**
- Export e.g. `startSocketMode({ appToken, handleEvent, handleCommand }): SocketModeClient`. Construct `new SocketModeClient({ appToken })`, register handlers, `.start()`.
- For event-type frames: `await ack()` immediately, then call the U2 event core (which schedules `processSlackEvent` in the background). Reconstruct a `SlackEnvelope`-shaped object from the socket `body` so the existing dedup + `processSlackEvent` work unchanged.
- For `slash_commands` frames: call the U2 command core, then `ack(commandResponseBody)` so the ephemeral message is delivered (R5).
- For `interactive`/`options` frames: `ack()` and no-op for now (matches current HTTP no-op via `normalizeSlackEnvelope`), with a TODO to revisit.
- No signature check anywhere here (R6).
- Add structured logs for connect/disconnect; rely on the client's built-in reconnect initially.

**Patterns to follow:**
- Envelope shape consumed by `parseSlackBody`/`processSlackEvent` (`index.ts:697`, `:493`); command payload shape from `parseSlackCommandBody` (`:575`).
- Logging helpers `logWarn`/`logError` already used in `index.ts`.

**Test scenarios:**
- Happy path: an `app_mention`/`message` frame → `ack()` is called once → the event core is invoked with the reconstructed envelope.
- Happy path (command): a `slash_commands` frame for `/website-feedback` → `ack(body)` is called with the ephemeral response object from the command core.
- Edge case: a duplicate event frame → `ack()` still called, `processSlackEvent` not scheduled twice (dedup via shared core).
- Edge case: `interactive`/`options` frame → `ack()` called, no handoff.
- Error path: handler throws → error is logged, `ack()` still resolves (don't wedge the socket).

**Verification:**
- Unit tests pass with a mocked `SocketModeClient`/ack; `@slack/socket-mode` resolves in `bun install`.

---

- [ ] U4. **Start Socket Mode alongside the Hono server, behind the flag**

**Goal:** Wire startup so `SLACK_SOCKET_MODE` boots the socket client in the same process while the HTTP server keeps serving `/health`.

**Requirements:** R1, R2, R3, R7

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `services/slackbot/src/index.ts`
- Test: `services/slackbot/src/index.test.ts`

**Approach:**
- After `export default { port, fetch }` (`:419`), add a guarded start: if `config.SLACK_SOCKET_MODE` is true, require `config.SLACK_APP_TOKEN` (fail fast with a clear log if missing), then `startSocketMode({ appToken, handleEvent: <U2 core>, handleCommand: <U2 core> })`.
- Do not gate the HTTP routes on the flag — they remain registered so HTTP keeps working (and `/health` stays up for k8s probes). When the flag is off, this block is inert (R2).

**Patterns to follow:**
- The `process.env.NODE_ENV === 'development'` guard at `:417` as a model for a side-effecting startup branch.

**Test scenarios:**
- Happy path: flag on + token present → `startSocketMode` invoked once at boot.
- Error path: flag on + token missing → logs a clear error and does **not** crash the HTTP server.
- Happy path: flag off → `startSocketMode` not called; module export and routes unchanged (R2).

**Verification:**
- With the flag off, `import`-ing the module has no socket side effects and all existing tests pass.

---

- [ ] U5. **Chart wiring for opt-in Socket Mode (staging/local), prod default-off**

**Goal:** Let a release enable Socket Mode via values without touching code, while the prod release stays HTTP.

**Requirements:** R2, R3, R7

**Dependencies:** U1

**Files:**
- Modify: `contrib/chart/values.yaml` (default `slackbot.socketMode.enabled: false`)
- Modify: `contrib/chart/templates/workloads.yaml` (conditional `SLACK_SOCKET_MODE` + `SLACK_APP_TOKEN`)
- Modify: `contrib/chart/values.local-env.yaml` and/or `contrib/chart/values.dev.yaml` (enable for staging/local)
- Modify: `.env.example` (document `SLACK_SOCKET_MODE`, `SLACK_APP_TOKEN`)
- Test: none (chart values) — verify via `helm template` rendering.

**Approach:**
- Add `slackbot.socketMode.enabled: false` to `values.yaml:144`–`153`.
- In `workloads.yaml` slackbot env (`:476`–`534`), add a conditional block: when `.Values.slackbot.socketMode.enabled`, render `SLACK_SOCKET_MODE` (value `"1"`) and a `SLACK_APP_TOKEN` `secretKeyRef` (mirror `SLACK_BOT_TOKEN` at `:482`, `optional: true`). Keep it off when the value is false so the prod render is unchanged (R2).
- Enable in `values.local-env.yaml` (and the staging release's values, likely `values.dev.yaml`); keep `replicaCount: 1` there (R7).
- Note in `values.local-env.yaml` that Socket Mode removes the need for local tunnels.

**Patterns to follow:**
- `secretKeyRef` blocks at `workloads.yaml:482`–`496`; the `runtimeErrorAlertChannel` conditional at `:527`–`530`; the `extraEnv` range at `:531`–`534`.

**Test scenarios:**
- Test expectation: none (declarative chart values). Validate by rendering: with the flag off, the slackbot Deployment env is identical to current `main`; with it on, exactly `SLACK_SOCKET_MODE` + `SLACK_APP_TOKEN` are added.

**Verification:**
- `helm template` diff vs `main` is empty for a default (prod) render; the staging/local render shows only the two added env entries; `replicaCount` stays 1.

---

- [ ] U6. **Document the Slack app + token setup**

**Goal:** Capture the exact manifest/token steps so staging is reproducible.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `contrib/local-dev-plan.md` (or a short `docs/` note) and `.env.example`
- Test: none (docs).

**Approach:** Document:
1. Use the **existing separate staging Slack app** (never toggle the prod app — enabling Socket Mode disables the prod Request URL).
2. App manifest: `settings.socket_mode_enabled: true`.
3. Create an **app-level token**, scope `connections:write` → `xapp-…` → set as `SLACK_APP_TOKEN`.
4. Subscribe to the same bot events the bot already uses (`app_mention`, `message.*`) plus `commands` if testing slash commands.
5. Env: `SLACK_SOCKET_MODE=1`, `SLACK_APP_TOKEN=xapp-…`, keep existing `SLACK_BOT_TOKEN`; `SLACK_SIGNING_SECRET` optional when socket-only.

**Test scenarios:**
- Test expectation: none — documentation only.

**Verification:**
- A new operator can enable staging Socket Mode from the doc alone.

---

## System-Wide Impact

- **Interaction graph:** Only `index.ts` (the two wrappers + startup) and a new `socket-mode.ts` change in code. `processSlackEvent`, `normalizeSlackEnvelope`, `handoff`, `dedup`, `signature` are unmodified.
- **Error propagation:** Socket handler errors must be caught and logged without wedging the WS (`ack()` must still resolve). Mirrors the existing `runInBackground` guard (`:678`).
- **State lifecycle risks:** `EventDeduper` is in-memory/per-process — multiple replicas with Socket Mode would each open a connection and double-deliver. Enforced by `replicaCount: 1` (R7).
- **API surface parity:** HTTP routes and their responses are unchanged; the socket path reuses the same cores so behavior stays in parity.
- **Integration coverage:** `test/emulate/slack-e2e.test.ts` proves the HTTP path; new `socket-mode.test.ts` proves the socket path with mocks.
- **Unchanged invariants:** All six Slack HTTP routes (`:139`–`144`), `slackSignatureMiddleware`, the Dockerfile `CMD`, `/health` probes, and the prod chart render. The flag-off path is identical to today.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| The `index.ts` extract-method refactor (U2) regresses the prod HTTP path | Pure extract-method; gate on existing `index.test.ts` + `slack-e2e.test.ts` passing unchanged (characterization-first). |
| Slash-command replies vanish on socket because body wasn't passed to `ack()` | Explicit `ack(body)` in U3 + a dedicated test asserting the ephemeral body is passed. |
| Multi-replica double-delivery via per-process dedup | Keep `replicaCount: 1` wherever socket is on; documented in U5/U6 (R7). |
| Accidentally enabling Socket Mode on the prod Slack app disables its Request URL | Use the separate staging app only; prod values default-off; documented in U6. |
| `@slack/socket-mode` event surface differs from assumptions | Confirm event names/envelope shape against the installed version while wiring U3 (deferred Open Question). |
| Outbound `wss://` blocked by prod egress lockdown | Non-issue for staging/local (NetworkPolicy disabled locally `:77`); not enabling in prod. |

---

## Sources & References

- Investigation report (this session) — handler coupling, ack semantics, blast radius.
- Code: `services/slackbot/src/index.ts` (`:90`, `:106`, `:139`–`144`, `:419`, `:493`, `:574`, `:677`, `:697`), `src/slack/normalize.ts:35`, `src/centaur/handoff.ts`, `src/config.ts`, `src/slack/dedup.ts`, `src/slack/signature.ts`.
- Deploy: `services/slackbot/Dockerfile`, `contrib/chart/templates/workloads.yaml:472`–`553`, `contrib/chart/values.yaml:144`, `contrib/chart/values.local-env.yaml:42`/`:77`, `contrib/chart/values.dev.yaml:15`.
- `contrib/local-dev-plan.md` — flags Socket Mode as the intended zero-ingress path.
