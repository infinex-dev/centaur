# Plan — fold comms-factory into the centaur repo (monorepo migration)

**Goal:** stop the two-repo dance. Vendor the **entire** comms-factory project into the
centaur repo as a clean copy, build + deploy it from in-repo source (no external clone, no
pinned ref, no rebase handoffs), and archive `infinex-dev/comms-factory`.

**Decisions already made:**
- **Whole project** moves in (not just the service slice, not a Python rewrite).
- **Clean copy** — no git history; comms-factory repo gets archived as the historical record.

**Why this is simpler:** today the deploy clones `infinex-dev/comms-factory` at a pinned SHA
(`8c8ec37`), and changes require the PR#2-onto-director rebase dance
(`handoff-comms-factory-rebase.md`). After this, comms-factory builds from centaur's own tree
at centaur's own SHA — one repo, one version, one CI, one deploy.

---

## What's actually moving (verified)

- **714 git-tracked files, ~88 MB** (the 506 MB `harness/` du is almost all gitignored
  `node_modules`/build junk — only 71 files tracked). A `git archive` clean copy brings only
  the tracked tree.
- It's a **Node 22 / pnpm 10.30.1** TypeScript project (~34k LOC) with a **React 19 UI**,
  a `harness/`, `research/` (349 files / 34 MB — the bulk of the weight), `eval/`, `cards/`,
  `skills/`, `drafts/`, `public/`, `docs/`.
- The **deployed slice** is `services/api/` (server.ts + 5 routes) wrapping `src/` (the engine).
  Its Dockerfile build context is the **project root** — it copies
  `package.json pnpm-lock.yaml tsconfig.json src services/api config third_party` and runs
  `tsx services/api/server.ts`.
- The **Centaur-side integration already lives in centaur** at `overlays/comms-factory/`
  (Python: the `comms_factory` thin-client tool, `comms_release`/`comms_audit` workflows,
  repo-context config, the overlay Dockerfile). That stays. It calls the TS service over HTTP.

### Source ref to import
Import comms-factory at **PR#3 head = `8c8ec37`** (`refs/pull/3/head` — the combined
director-service-surface + Centaur integration branch, confirmed = what prod runs). It
already contains both the latest functionality and the `/tools` integration, so no rebase is
needed before the move — the import makes `handoff-comms-factory-rebase.md` moot. Re-confirm
the PR#3 head at execution time in case it advances before the freeze.

---

## Placement

Three folders, three concepts — the network boundary is visible in the tree. The standalone
TS **service** (own image + Pod) lives apart from the Centaur integration **glue** (mounted
Python). It is NOT nested in the overlay, because it deploys and runs independently.

```
centaur/
├── services/                       ← base first-party platform services (unchanged)
├── attached-services/              ← NEW container: standalone org services (own image + Pod)
│   └── comms-factory/              ← the vendored TS product, self-contained build context
│       ├── package.json  pnpm-lock.yaml  tsconfig.json
│       ├── src/  services/api/  config/  third_party/   (+ harness/ research/ eval/ UI …)
│       └── services/api/Dockerfile  ← attached-service image, context = attached-services/comms-factory/
└── overlays/comms-factory/         ← UNCHANGED: Centaur integration glue only
    ├── tools/                      ← Python comms_factory thin-client tool
    ├── workflows/                  ← comms_release / comms_audit
    ├── Dockerfile                  ← the overlay image (mounts tools/ + workflows/)
    └── repo-context.*
```
`attached-services/` mirrors the Helm chart's `attachedServices` vocabulary and is the
container where future standalone org services land (`attached-services/<name>/`); future
Centaur glue lands under `overlays/<name>/`. The TS project stays self-contained, so its
Dockerfile needs no path rewrites (build context = `attached-services/comms-factory/`).

---

## Phases

### Phase 0 — Freeze & prep
- Announce a freeze on `infinex-dev/comms-factory` so nothing diverges during the move.
- Confirm `8c8ec37` is the canonical state to import (it's what prod runs). Any open
  comms-factory PRs (#1/#2/#3 there) are abandoned by the move — note this.

### Phase 1 — Clean copy the tree in
- `mkdir -p attached-services/comms-factory` then
  `git -C <comms-factory> archive 8c8ec37 | tar -x -C attached-services/comms-factory/` —
  exports only tracked files at the PR#3 head (no `.git`, respects `.gitignore`). All 714
  files / 88 MB, brought in full (no prune — confirmed bring-it-all).
- Merge comms-factory's ignore patterns into centaur's `.gitignore`, **scoped to
  `attached-services/comms-factory/`** (`node_modules/`, `dist/`, `.next/`, `out/`,
  `*.tsbuildinfo`, `eval/runs/`, `.remotion*/`, etc.) so the build junk never gets committed.

### Phase 2 — Integrate tooling so centaur CI doesn't break
- **Node/pnpm:** keep `comms-factory/` as a **standalone pnpm project** (its own
  `pnpm-lock.yaml`), NOT merged into the slackbot workspace. Centaur now has **two Node
  projects** (slackbot + comms-factory) — document the exception (CLAUDE.md currently says
  "pnpm only for services/slackbot, single lockfile").
- **Python lint:** comms-factory ships 11 `.py` files (scripts/eval). Ensure centaur's
  root `ruff` either covers them cleanly or **excludes `comms-factory/`** so the existing
  lint job stays green.
- **CI:** add a comms-factory job (`pnpm install --frozen-lockfile`, `pnpm typecheck`,
  `pnpm test` / `service:test`) OR, minimum, scope existing jobs to exclude `comms-factory/`
  so the import doesn't red-X CI. Decide depth of CI integration.

### Phase 3 — Rewire build + deploy to in-repo source (the actual simplification)
- **`deploy-k8s-env.sh` / `deploy-local.sh`:** delete the clone/pin path
  (`COMMS_FACTORY_REF`, `COMMS_FACTORY_GIT_URL`, `resolve_comms_factory_repo`, the
  `~/.cache/centaur/comms-factory` clone). Build the service image directly:
  context = `attached-services/comms-factory/`,
  dockerfile = `attached-services/comms-factory/services/api/Dockerfile`, tag = centaur's `$TAG`.
  The Python overlay image already builds in-repo.
- Drop every `COMMS_FACTORY_REF` pin (deploy scripts, docs). The comms image version is now
  just centaur's git SHA.
- Re-derive the prod overlay values (the work reverted from the old plan) but pointing at the
  in-repo-built image tag — no external pin. (`overlays/comms-factory/values.production.yaml`
  + the prod deploy layering, now trivial since there's no clone.)

### Phase 4 — Verify
- Build the service image from the in-repo app locally (`podman build -f
  attached-services/comms-factory/services/api/Dockerfile attached-services/comms-factory/`).
- `deploy-local.sh` (now building in-repo) → E2E: `@bot comms generate <brief>` reaches the
  facts gate; no external auto-post.
- Run comms-factory's own suites in CI (`services/api/server.test.ts`, grounder/research tests).

### Phase 5 — Decommission & document
- Archive `infinex-dev/comms-factory` (README → "moved into centaur/comms-factory").
- Update `handoff-comms-factory-rebase.md` (now moot) and the old
  `prod-comms-factory-deploy.md` (deploy section superseded by in-repo build).
- Update centaur `CLAUDE.md` / `AGENTS.md`: the comms-factory service lives in-repo at
  `attached-services/comms-factory/` (with `overlays/comms-factory/` as its Centaur glue),
  two Node projects, build path, no external pin. Document the `attached-services/` convention.

---

## Risks / call-outs
- **Repo weight:** +88 MB to centaur history (mostly `research/` data), brought in full per
  decision. Irreversible in history once committed — accepted as the cost of one repo.
- **Second Node/React toolchain** in a Python-first repo — new CI surface, larger clones,
  contradicts the current "pnpm only for slackbot" rule. Acceptable for one-repo simplicity,
  but document it.
- **The TS↔Centaur HTTP hop stays.** This move co-locates the source; it does NOT collapse
  the attached-service boundary. comms-factory still runs as its own Pod and still calls
  Centaur `/tools` over HTTP. Collapsing that (or a Python rewrite) is a *separate, later*
  decision — explicitly out of scope here.
- **Relationship to the prod-deploy stack:** the Python overlay (PR#5) and the prod deploy
  path are unaffected in spirit; only the *image source* changes (in-repo vs cloned). Sequence
  this migration as its own PR; it supersedes the reverted Phase 2 deploy-script clone logic.

## Out of scope (explicitly)
- Collapsing the attached service into native Python tools (the "rewrite" option we did NOT pick).
- The comms→PR dogfood loop (`handoff-comms-dogfood-pr.md`).
