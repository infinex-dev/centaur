# Plan — consolidate the stack & deploy comms-factory to production (@firenze)

**Goal:** get the comms-factory overlay (tools + the `comms_audit` / `comms_release`
workflows) reviewed, consolidated onto `main`, and **live in production behind the real
`@firenze` bot** — not the staging bot.

**Owner decisions already made:**
- Consolidation: **merge the stack in order** (`#1 → #2 → #4 → #5`), close `#3`.
- Today's scope: **review + merge + live deploy**.
- Comms harness: **claude-code**.
- The prod deploy path is **always** comms-factory — no `--with-comms-factory` flag; the
  overlay is intrinsic to this deployment.

---

## Current state (verified)

### The PR stack
```
main
└─ PR#1  feat: env-secret K8s production deploy workflow        (deploy-k8s-env.sh + values.production-env)
   └─ PR#2  feat(slackbot): Socket Mode for local Slack dev
      └─ PR#4  feat: generic external-service connection point   (chart: overlay/attachedServices/repoCache support)
         └─ PR#5  feat: comms-factory overlay                    ← HEAD (feat/comms-factory-overlay)
```
`PR#3` ("fold capability plane into native tool plane") is a stale parallel branch off
PR#2's base, superseded by PR#4+#5. **Close it.**

### Production today
- Base Centaur + the real `@firenze` bot are **already live** on the `centaur-system`
  cluster (registry `registry.inx.local/centaur`, slackbot on Tailscale Funnel, Traefik
  internal API ingress at `centaur.inx.local`).
- **Missing in prod: the overlay** — comms-factory tools + the comms workflows.

### The gap that makes "just run the script" not enough
`contrib/scripts/deploy-k8s-env.sh` + `contrib/chart/values.production-env.example.yaml`
build/deploy only the **4 base images** (api, slackbot, agent, iron-proxy). They contain
**no** comms-factory service build, **no** overlay image, and **none** of
`overlay` / `attachedServices` / `repoCache` / comms `enabledTools` / slackbot
`SLACK_WORKFLOW_COMMANDS`. That wiring currently exists **only** in
`deploy-local.sh --with-comms-factory` (lines 144–366). Porting it into the prod path —
unconditionally — is the core deliverable.

### Things verified that *reduce* scope
- **No overlay DB migrations** — comms workflows use the base workflow-engine tables. No
  dbmate step against prod Postgres.
- **`values.schema.json` already permits** `overlay` / `attachedServices` / `repoCache`,
  so Helm won't reject the overlay values.
- The comms-factory service combined head is pinned at
  `8c8ec37d5e4357719cd2aa105a96ef2f89e20534` (comms-factory PR#3 = Centaur integration
  rebased onto `director-service-surface`).

### Access constraint
This Mac only reaches the **local** k3s (`centaur-k3s` context, namespace `centaur`).
`registry.inx.local` (10.83.81.1) and `centaur-system` are on the internal/Tailscale net
and are **not routable from here**. Therefore **the live deploy (build/push/helm) is run by
the user from a cluster-connected box**; this plan produces a single command + secret
runsheet for that. Everything else (review, code changes, local validation, merge) is done
here.

---

## Design decisions baked into this plan

1. **Comms-factory is unconditional in the prod path** (no flag). Implementation: the prod
   deploy always builds+pushes the two comms images and always applies the overlay values.
2. **`@firenze` stays general-purpose.** The local dedicated stack whitelists
   `enabledTools` down to 4 comms tools; prod must NOT do that or it would strip every
   other tool from the live bot. So in prod: keep `enabledTools: []` (= all-minus-disabled)
   and just **remove `websearch` from `disabledTools`** so comms grounding works. The
   `comms_factory` / `repo_context` / `company_context` tools auto-load once the overlay
   image is mounted.
3. **Harness — RESOLVED (no change to prod).** `comms_release` / `comms_audit` are pure
   tool-plane + gate workflows (they call the `comms_factory` tool via `call_comms_tool`);
   they spawn **no sandbox agent and use no harness**. So `api.defaultHarness` is irrelevant
   to comms — **leave prod at `codex`, untouched.** (The claude-code choice only matters for
   the future comms→PR dogfood, which spawns a sandbox agent and is out of scope today.)
4. **Where the wiring lives.** Extend `deploy-k8s-env.sh` + add an overlay values file
   (`overlays/comms-factory/values.production.yaml`) that the prod deploy always layers in
   via `-f`. Keeps the org-specific block in the overlay, the base script just always
   includes it for this deployment.

---

## Phases

### Phase 1 — Review the stack
- `/code-review` across each PR diff (`#1`, `#2`, `#4`, `#5`) **after** Phase 2 changes
  land on PR#5 so the review covers the new prod wiring too.
- Triage findings; fix blockers.
- Close `PR#3`.

### Phase 2 — Port the overlay wiring into the prod path (core work; folds into PR#5)
0. **Harness — DONE.** Verified comms workflows use no harness (pure tool/gate). Prod
   `defaultHarness` stays `codex`. No change.
1. **`deploy-k8s-env.sh`** — always build+push two extra images to `$REGISTRY`:
   - `comms-factory-api` from the pinned comms-factory ref (`COMMS_FACTORY_REF=8c8ec37…`),
   - `comms-factory-centaur-overlay` from `overlays/comms-factory/Dockerfile`.
   Always patch `COMMS_FACTORY_SERVICE_TOKEN` + `COMMS_FACTORY_CAPABILITY_API_KEY` onto
   `centaur-infra-env` (generate if absent; mirror deploy-local.sh lines 214–232).
   Always layer the overlay values file into the `helm upgrade`.
2. **`overlays/comms-factory/values.production.yaml`** (new) — the prod analog of the
   block deploy-local.sh generates (lines 278–348), with prod-registry image repos and
   `existingSecretName: centaur-infra-env` refs:
   - `overlay.image` → `$REGISTRY/comms-factory-centaur-overlay`
   - `attachedServices.comms-factory`: image `$REGISTRY/comms-factory-api`, `service.port: 8080`,
     `serviceKey` `{name: service:comms-factory, scopes: [bundle:research], envVar: COMMS_FACTORY_CAPABILITY_API_KEY}`,
     `env` `{CENTAUR_BASE_URL: http://centaur-centaur-api:8000, CENTAUR_TIMEOUT_MS: "90000"}`,
     `secretEnv` `{COMMS_FACTORY_SERVICE_TOKEN, ANTHROPIC_API_KEY (optional), CENTAUR_TOKEN←COMMS_FACTORY_CAPABILITY_API_KEY}`
   - `repoCache`: enabled, repositories `infinex-xyz/platform` + `infinex-xyz/agent-platform`,
     `githubToken {existingSecretName: centaur-infra-env, secretKey: GITHUB_TOKEN}`
   - `api.extraEnv`: `COMMS_FACTORY_BASE_URL`, `CENTAUR_BASE_URL`,
     `REPO_CONTEXT_REPOSITORY_ALIASES` (from `repo-context.aliases`)
   - `slackbot.extraEnv.SLACK_WORKFLOW_COMMANDS` (the comms_audit / comms_release triggers)
3. **`values.production-env.example.yaml`** — remove `websearch` from `disabledTools`
   (keep `enabledTools: []`). Document why (comms grounding).
4. **Validate locally — no prod access:**
   - `helm template centaur contrib/chart -f values.production-env.example.yaml -f overlays/comms-factory/values.production.yaml` renders clean.
   - `deploy-local.sh --with-comms-factory` (or `just comms-factory-up`) still green E2E on
     the local k3s — proves the overlay block is correct before it reaches prod.

### Phase 3 — Merge in order
- Rebase as needed; ensure CI (lint + test) green at each step.
- Merge `#1 → #2 → #4 → #5` to `main` sequentially.

### Phase 4 — Live prod deploy (user runs from a cluster-connected box)
1. **Secrets** — patch `centaur-infra-env` (namespace `centaur-system`) with real values:
   `GITHUB_TOKEN` (PR/`repo` scope — repoCache clone + sandbox `git-branch`/`gh pr create`),
   `EXA_API_KEY` (websearch grounding), `ANTHROPIC_API_KEY` (claude-code comms),
   and the two comms tokens (auto-generated by the script if absent).
2. **Deploy — single command:**
   ```bash
   contrib/scripts/deploy-k8s-env.sh \
     --registry registry.inx.local/centaur \
     --namespace centaur-system --release centaur \
     --host centaur.inx.local --ingress-class traefik \
     --ingress-controller-namespace kube-system \
     --slackbot-tailscale-host centaur-slack \
     --insecure-registry      # only if podman doesn't trust the internal registry CA yet
   ```
   (comms-factory build/push/overlay now happen unconditionally inside the script.)
3. **Smoke via the real `@firenze`:**
   - `@firenze comms generate <small low-stakes brief>` → confirm grounded copy reaches the
     **facts gate** in Slack.
   - Confirm **no external auto-post** — the loop stops at the gate (R1 holds).
   - `kubectl exec -n centaur-system deploy/centaur-centaur-api -- curl -fsS http://localhost:8000/health`
   - `kubectl -n centaur-system rollout status deploy/centaur-centaur-attached-comms-factory`

---

## Rollback
- The deploy is a `helm upgrade`; `helm rollback centaur <prev-revision> -n centaur-system`
  reverts the release. The overlay is additive (new attached service + tools); rolling back
  removes the comms tools/workflows without touching base Centaur.
- Secret patches are additive keys; no base credential is overwritten.

## Risks / open items
- **Harness global-default** (decision #3 / Phase 2 step 0) — must resolve before deploy.
- **GITHUB_TOKEN scope** — repoCache + sandbox PRs need `repo`/PR scope on the target repos;
  a read-only token silently breaks the dogfood PR path (not the comms gate itself).
- **websearch credit** — `EXA_API_KEY` must be funded or grounding degrades to repo-only.
- **`--insecure-registry`** — drop once podman trusts the internal registry CA.

## Out of scope (explicitly not today)
- The comms→PR dogfood loop (separate handoff: `handoff-comms-dogfood-pr.md`).
- Rebasing the comms-factory service PR itself (separate handoff:
  `handoff-comms-factory-rebase.md`) — we deploy the already-pinned combined head.
