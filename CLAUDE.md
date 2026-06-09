# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Centaur is a self-hosted platform for shared AI agents: you mention a bot in Slack (or call the API), and an agent runs real work inside an isolated Kubernetes sandbox with API-mediated tools and credential boundaries.

**`AGENTS.md` is the canonical developer guide** — it covers the request flow, service interface contracts, durable workflows, sandbox internals, security model, and full E2E testing recipes in depth. Read it before any non-trivial change. This file is the quick orientation; AGENTS.md is the reference.

## Commands

Local dev runs on **Kubernetes via Helm**, driven by `just` (`brew install just`).

```bash
just up                 # bootstrap-secrets + build (all images, parallel) + deploy
just build-one <svc>    # rebuild one image: api | iron-proxy | slackbot | agent(=sandbox)
just deploy             # helm upgrade --install with contrib/chart/values.dev.yaml
just status             # kubectl get all -n centaur
just logs <component>   # tail+follow a deploy (api, slackbot, …)
just shell <component>  # shell into a deploy
just smoke              # full spawn→message→execute→poll PONG E2E check
just down / reinstall   # tear down / down+up
```

Lint & test (Python 3.11+, `uv`, `ruff` line-length=100). Each service has its own `pyproject.toml`/`ruff.toml`; run from repo root:

```bash
uv run ruff check .                 # lint
uv run ruff format .                # format
uv run pytest                       # all tests
uv run pytest path/to/test_x.py::test_name   # single test
```

`services/slackbot` is Next.js + Slack Bolt and uses **`pnpm` only** (single `pnpm-lock.yaml`).

Migrations use dbmate against both core and overlay migration sets:

```bash
./scripts/dbmate new <name>         # new core migration
./scripts/dbmate --set overlay new <name>
./scripts/dbmate up                 # apply (status / migrate also available)
```

## Architecture (the big picture)

The end-to-end flow crosses several services that each speak a defined interface, so layers can be swapped independently:

```
Slack/API → API (control plane) → Kubernetes sandbox Pod → iron-proxy → outside world
                ↓
          Postgres (source of truth) + tool/workflow registry
```

- **`services/api`** — FastAPI control plane. Owns runtime assignment, durable execution, workflows, auth, and durable state. Key internals: `runtime_control.py`, `workflow_engine.py`, `warm_pool.py`, routers in `api/routers/`, sandbox backend in `api/sandbox/`.
- **`services/slackbot`** — Next.js + Slack Bolt event listener (pnpm). Stays thin: persists input via `spawn → message → execute`, streams/replays from the durable events endpoint.
- **`services/sandbox`** — the agent container image (`centaur-agent:latest`). One conversation = one Pod running a harness CLI (amp / claude-code / codex). `harness_session.py` translates the canonical wire format into each harness's quirks.
- **`services/firewall`** (iron-proxy) — mitmproxy addon. Sandboxes only ever see **placeholder** credentials; iron-proxy MITMs outbound HTTPS and swaps in real secrets bound to specific hosts/headers.
- **`tools/`** — 60+ auto-discovered Python tool plugins. **`workflows/`** — auto-discovered durable workflow definitions.

Three protocol boundaries to keep straight (details in AGENTS.md → Service Interface Contracts):

1. **Client → API**: durable control-plane REST. `spawn` pins a runtime and returns `assignment_generation`; `message` writes a transcript event; `execute` enqueues an execution; events are tailed/replayed from `GET /agent/threads/{thread_key}/events`. Postgres is the source of truth — clients fall back to durable terminal state when the live stream is gone.
2. **API → Sandbox**: stdin/stdout NDJSON in **Anthropic message format** — the canonical protocol regardless of which harness runs inside.
3. **Sandbox → API**: agents call tools over REST (**not MCP**) via `curl $CENTAUR_API_URL/tools/<tool>/<method>`, using the `call` helper (`call <tool> <method> '{json}'`). The `CENTAUR_API_KEY` is an auto-issued, short-lived `sbx1.*` token.

### Plugins (no core changes needed)

- **Tools**: a directory under a `tools.toml` `plugin_dirs` entry with `client.py` (class + `_client()` factory) + `pyproject.toml`. Public methods become `POST /tools/{name}/{method}`; `_`-prefixed methods are excluded. Auto-discovered on startup, **hot-reloaded** on file change. In `client.py`: **no `load_dotenv()`** — get secrets via `secret()` from `centaur_sdk.tool_sdk`. Only `cli.py` calls `load_dotenv()`.
- **Workflows**: one Python file exporting `WORKFLOW_NAME`, async `handler(params, ctx)`, optional `Input` dataclass. The handler IS the workflow — `ctx.step(name, fn)` checkpoints to Postgres and is skipped (cached) on replay, so branching/loops/sleeps work as plain Python.

### Overlays

Orgs extend the base repo **without forking** via an **ordered overlay**. The base repo stays generic; org-specific behavior is layered in from an outside checkout/image. The intended deployment shape is base repo and overlay side by side:

```
your-deployment/
├── centaur/              # this repo
└── centaur-overlay/      # org tools, workflows, skills, personas, prompt overlay
```

How it works:

- The overlay is delivered as an **image** (or prompt content) mounted at `/app/overlay/org`. Its `tools/`, `workflows/`, `.agents/skills/`, persona prompts, and `services/sandbox/SYSTEM_PROMPT.md` are loaded **after** the base repo content.
- **Later entries win on name collision** — that's the whole mechanism: an overlay can override a base tool/workflow/persona just by reusing its name. Keep base names stable so overlays can target them.
- The Helm chart wires this through an `overlay:` block (`overlay.image.repository` / `.tag` / `.sourcePath: /overlay`). Org services run as `attachedServices.<name>` (own image, service port, `env`/`secretEnv`, and an optional `serviceKey` declaring the Centaur callback API key the service uses to call `/tools`); `api.enabledTools` selects which tools are live and `api.defaultHarness` sets the harness.
- Overlays carry their **own dbmate migration set** (`./scripts/dbmate --set overlay …`) with a separate migrations table, so an overlay can add tables to the shared Postgres DB without version collisions.

An overlay deploys locally through `contrib/scripts/deploy-local.sh`'s generic attached-service support: build the overlay image, enable the attached service + overlay tools, and bootstrap the service's `serviceKey`. Read `contrib/scripts/deploy-local.sh` to see exactly what an overlay deploy patches in.

## Conventions

- All imports at the top of the file, never inside functions. **Absolute imports only** (`from api.X`, `from centaur_sdk.X`).
- `asyncpg` for Postgres, `pgvector` for embeddings.
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

## Critical workflow rules

- **Test locally before pushing — always.** Testing means actually running the affected service and proving the change works E2E (`just build-one <svc>` → `just deploy` → real request), not just lint/reasoning. Tools hot-reload, so for tool changes just `curl` the method from inside the API deploy.
- **Never touch the deploy box for testing.** The deploy box is **production**; changes reach it via `git push` → GitHub Actions auto-deploy. SSH in only to read logs for debugging, or for emergency intervention the user explicitly asks for. All E2E validation happens on the local stack.
- When you need the **Vercel Chat SDK** (`@chat-adapter/*`), read its source at `~/github/vercel/chat` — never dig through `node_modules`.

## Debugging the Kubernetes stack

Everything runs in the `centaur` namespace. Start here:

```bash
just status                                    # kubectl get all -n centaur
just logs <component>                          # tail+follow a deploy (api, slackbot, iron-proxy, …)
just shell <component>                         # shell into a deploy
kubectl get pods -n centaur -l centaur-agent=true        # live sandbox pods
kubectl describe pod -n centaur <pod>          # ImagePullBackOff / scheduling / taints
kubectl exec -n centaur <sandbox-pod> -- curl -s http://api:8000/health
```

Most API calls are easiest from **inside the API deploy** (localhost bypass — no API key needed):

```bash
kubectl exec -n centaur deploy/centaur-centaur-api -- curl -s http://localhost:8000/health
```

`just smoke` runs the full `spawn → message → execute → poll` loop and asserts a `PONG` result — the fastest "is the whole stack alive" check. Note `/agent/*` requires an API key from outside the API pod; `smoke` pulls the bootstrapped `SLACKBOT_API_KEY` from the `centaur-infra-env` secret automatically.

**Logs.** Every service writes single-line JSON to stdout (`timestamp`, `level`, `service`, `event`, optional `thread_key`). For raw pod logs use `kubectl logs`. When the optional observability stack is up, query VictoriaLogs with LogsQL (examples in AGENTS.md → Observability), e.g. filter by `thread_key:<id>`, `_stream:{service="api"} AND level:error`, or the firewall's `event:proxy_audit` outbound audit trail. The API emits `tool_call_started` / `tool_call_completed` / `warm_container_claimed`; the firewall emits an audit event per outbound sandbox request.

**Secrets don't hot-reload into running pods.** Patching a Kubernetes Secret does NOT update a running pod's env (env is read from `envFrom` at startup). After changing a secret you must `kubectl rollout restart deploy/centaur-centaur-api`. A sandbox 401 to an upstream usually means a bad/placeholder key reached the firewall; an `insufficient_quota` means the key is valid but the upstream account is out of credit (account-side, not a stack bug).

## Local-environment gotchas (this machine)

Local Kubernetes runs on **podman** via **k3s installed natively inside the podman VM** — not kind, not docker (kind-on-podman cannot work on this Mac; docker/Colima works but the team rejected it). The VM *is* the node, matching production's shape. `contrib/scripts/k3s-local.sh` does idempotent bring-up; `contrib/scripts/deploy-local.sh` builds with podman, imports images into k3s, then runs secrets + helm. Specific traps:

- **k3s API access needs an SSH tunnel** to the VM's `:6443` — podman doesn't forward arbitrary ports, and the SSH port can change on VM restart (re-read it from `podman machine inspect`).
- **Images must be imported into k3s containerd** under `docker.io/library/centaur-<svc>:latest` in the **`k8s.io`** namespace, or pods `ImagePullBackOff`. The chart uses bare `centaur-<svc>:latest` / `IfNotPresent`.
- **Disk pressure is real.** The VM is ~80% full of unrelated rootless podman storage (don't delete it). The 5.9GB `centaur-agent` image can trip the kubelet disk-pressure taint and get GC'd → grow the disk first (`podman machine set --disk-size N`). api+slackbot+iron-proxy fit fine.
- **k3s ENFORCES NetworkPolicy** (kind/prod CNIs don't). The API unconditionally creates a per-sandbox egress policy allowing only API:8000 + iron-proxy:8080 — no port 53, so sandboxes can't reach CoreDNS and DNS-dependent harnesses (e.g. codex) fail with `EAI_AGAIN`. Local-only fix: `disable-network-policy: true` in `/etc/rancher/k3s/config.yaml` inside the VM, then restart k3s.
- There is **no `/capabilities` plane** — it was deleted. The agent access surface is native tools + scope bundles. Web search is Exa via `websearch.search` (no `web_fetch` / browser tool). `/tools` rejects unknown kwargs.

## Keeping this file current

This is a living document. When you discover something future-Claude would want to know — a new command, an architectural shift, a non-obvious gotcha, or a correction to something here that turned out wrong — **update this CLAUDE.md in the same change** rather than letting it drift. Keep it concise: capture the durable insight and defer depth to `AGENTS.md`. If a section here contradicts the code you're looking at, trust the code and fix the doc.
