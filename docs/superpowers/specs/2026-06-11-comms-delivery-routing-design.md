# Comms release: delivery routing (blog/web → PR, x/x-thread → Typefully)

**Date:** 2026-06-11
**Status:** Draft for review (revised after adversarial review — 29 findings raised, 9
confirmed; the confirmed cluster drove a switch from git/gh-in-pod to the GitHub REST API)
**Depends on:** `2026-06-10-comms-multichannel-release-design.md` (the "surfacing" phase) —
this phase consumes that phase's `final_by_channel` output and candidate gate. Both are
draft specs; neither is implemented yet. Surfacing must land first.
**Scope:** `overlays/comms-factory/` (Python) and `attached-services/comms-factory/` (TS:
new routes + a Typefully client + a REST emit module reusing the existing pure transforms),
**plus one additive NetworkPolicy egress hook in `contrib/chart/`** (see §0). No Centaur
application-service (`services/api`, `services/slackbot`, …) code changes.

## Goal

After the surfacing phase, an operator approves copy per channel (`final_by_channel`) and the
run ends `ready_to_ship` with **no external posting**. This phase adds delivery: each approved
channel is routed to its real destination behind a human-confirmed delivery gate.

Delivery targets (verified below):

| Format | Destination | Mechanism |
|---|---|---|
| `blog` | `apps/content-app/content/blog/{slug}.md` in `infinex-xyz/platform` | one GitHub PR (REST) |
| `web` | `FEATURES_COPY[]` in the platform features `data.ts` (same PR) | REST + `appendFeatureCopyEntry` |
| (roadmap) | roadmap `data.ts` tick (same PR, optional) | REST + `markRoadmapNodeDone` |
| `x` | Typefully draft (solo) | new `/typefully-draft` |
| `x-thread` | Typefully draft (threadified) | new `/typefully-draft` |

**Copy-only this phase (no destination exists):** `in-product` (lives in product app code),
`modal` (an ops *emergency flag*, not content — `research/release-surface-map-2026-06-05.html`,
`SESSION-STATUS-2026-06-05.md:10`). They still generate and show as ready copy; the delivery
gate renders them with a "deliver manually" note.

**Out of scope (deferred):** `carousel` (app-alert — dropped); video (Remotion renders
locally, never uploaded); image/asset hosting (blog ships the existing
`{% cloud-image src="<designer-cover-url>" %}` placeholder for a human to fill at PR review);
auto-merging any PR; auto-publishing Typefully drafts (a human publishes); self-serve
production-deploy ergonomics (separate org decision).

## Why REST, not git/gh-in-pod (the review's central finding)

The first draft wrapped the existing `emitLaunchPR` (git worktree + `git push` + `gh pr
create`) behind a clone-on-demand route. Adversarial review showed that path is structurally
fragile in-pod:

- `emitLaunchPR`'s first op is `git worktree add -b {branch} origin/main`
  (`emit-platform-pr.ts:90-97`); on any retry where the deterministic branch already exists in
  the reused clone it throws *before* `gh pr create`, so a "catch gh pr create" recovery never
  fires. The non-dry-run `finally` deletes the worktree but **not** the branch (`:160-167`).
- A replay re-push is rejected non-fast-forward: the worktree is rebuilt from `origin/main`
  and the commit gets a fresh SHA (no pinned `GIT_*_DATE`, `:139-143`), so `git push` (no
  `--force`, `:144`) fails before PR creation.
- `gh pr create` authenticates via `GH_TOKEN`/`hosts.yml`, **not** the token-in-URL remote;
  and a token-in-URL leaks into stderr/500 bodies (`http.ts:48-68` redacts by key name only).
- The clone lives in the attached pod's ephemeral `/tmp` and must survive a human-gate wait
  that suspends the run for minutes/hours (`workflow_engine.py:498`) — it won't across a pod
  restart, forcing a full re-clone of a large monorepo.

The GitHub **REST API** removes all of these: deterministic branch ref + Contents API PUT
(carries the blob `sha`, so no fast-forward problem) + Pulls API, with idempotent "already
exists" handling. It reuses the genuinely valuable parts of `emitLaunchPR` — the pure
string→string transforms `markRoadmapNodeDone` and `appendFeatureCopyEntry`
(`emit-platform-pr.ts`) and `extractChangelogTitle`/`buildPrBody` — and needs **no `git`, no
`gh`, no clone, no `/tmp`**. The existing `emitLaunchPR` + its `pnpm emit-pr` CLI stay as a
local break-glass path.

## Verified mechanics this design is built on

Read from the code, not assumed:

- **`emitLaunchPR` is complete, tested, and invoked only by a local-dev CLI** — exported
  (`src/emit-platform-pr.ts:61`) and driven by `scripts/emit-pr.ts` (`pnpm emit-pr
  --package=<file> [--platform-root] [--branch] [--live]`, `package.json:14`) against a
  developer's local checkout. No deployed route/workflow calls it; `cmdShip` (`src/cli.ts:441`)
  is a `TODO` stub. The new REST `/emit` mirrors the CLI's contract (`--branch` ↔ deterministic
  branch, `--live` ↔ real emit, `--package` ↔ `buildLaunchPackage`); the CLI is kept as
  break-glass.
- **It writes exactly three surfaces**: blog md → `apps/content-app/content/blog`
  (`emit-platform-pr.ts:13`), roadmap tick → `apps/public-website/src/app/(site)/roadmap/data.ts`
  (`:11`), feature card → `apps/public-website/src/app/(site)/features/data.ts` (`:12`). No
  `in-product`, `modal`, or carousel slot exists.
- **`LaunchPackage`** (`:16-21`): `{changelogSlug, changelogMd, roadmapTick?, featureCard?:
  {dataTsEntry}}`. `appendFeatureCopyEntry` and `markRoadmapNodeDone` are **pure string→string**
  (parse TS, splice) — directly reusable on file content fetched via the Contents API.
- **The service image is `node:22-slim`** (no git/gh) — REST needs neither; it adds only an
  HTTP call (the service already calls Anthropic over HTTPS). Use global `fetch` or
  `@octokit/rest`.
- **Egress is default-deny in production.** `-default-deny` covers all pods
  (`contrib/chart/templates/networkpolicy.yaml:6-13`); `allow-dns` opens only port 53. The
  attached-service policy (`networkpolicy.yaml:169-217`) grants the comms pod egress **only to
  api:8000** plus an iron-proxy rule gated on `$proxyEnabled` — and comms sets
  `proxy.enabled:false` (`values.production.yaml:32-33`), so even that is omitted. **There is no
  port-443 internet egress for this pod**, so REST to `api.github.com` / Typefully is blocked
  until the chart opens it — unlike repo-cache (`egressPorts:[443]`, `values.yaml:144-145`) and
  slackbot/API (`networkpolicy.yaml:271-273,154-156`).
- **`GITHUB_TOKEN` exists but is read-scoped** (in `centaur-infra-env`, feeds repo-cache,
  `values.production.yaml:76-78`) and is **not** in the comms service `secretEnv` (`:47-57`).
  Emit needs push + PR scope → a **separate** `COMMS_GITHUB_TOKEN`.
- **`TYPEFULLY_API_KEY` is not in the pod** (external bot `.env`,
  `research/channel-surface-grounding-2026-06-03.md:19`). x-thread has no native posting API —
  Typefully only.
- **The attached-service Helm template already passes arbitrary `env`/`secretEnv`**
  (`attached-services.yaml:58-71`, per-key `optional`) — new tokens need no template change
  (but the NetworkPolicy hook does).
- **The workflow runs in the API pod, not the comms pod.** `comms_release.py` imports
  `api.workflow_engine` and `get_tool_manager` (`comms_shared.py:285`); `os.getenv` there reads
  the **API pod** env. So the workflow **cannot** see the comms pod's token env — button
  visibility must be probed, not read (see §4).
- **Gate mechanics** (from surfacing spec, re-verified): events are first-write-wins per
  `(event_type, correlation_id)` (`workflow_engine.py:2777-2779`); fresh `gate_version` per
  round; refs need `requester_user_id`/`approver_user_ids` or the base 400s; every gate exit
  leaves a terminal buttonless message. `ctx.step` checkpoints **after** the fn returns
  (`workflow_engine.py:378-383`) — a crash between an external call and the checkpoint re-runs
  the step on resume (idempotency matters; see §4).
- **web copy is structured, never operator-edited.** Per surfacing spec, structured channels
  (`web`, `x-thread`) are pick-or-retry (no edit button), so `final_by_channel["web"]` keeps a
  `candidate_id`, and the chosen candidate's structured fields live under `candidate.structured`
  (`generator.ts:122`; `.text` is the joined rendering, `:133`, unsuitable for the data.ts
  entry). The mapper reads `candidate.structured` via `candidate_id`.

## Open verifications (must resolve before/within implementation — local `infinex-xyz/platform` checkout is ABSENT)

1. **Real `FEATURES_COPY` entry schema.** Test fixture assumes `{title; description?}`
   (`emit-platform-pr.test.ts` `featuresFixture`), but generator copy targets `feature-card-alt`
   (`generator.ts:262`) with subheading/title/caption. Confirm the live field names before
   finalizing the web→`dataTsEntry` mapper.
2. **`FEATURES_DATA_PATH` is the rendered file.** emit targets `…/features/data.ts`; recon
   found feature copy also in `_components/feature-card-alt/data.ts`. Confirm the PR edits the
   file the site renders.
3. **`COMMS_GITHUB_TOKEN`** with PR + contents write scope on `infinex-xyz/platform`,
   provisioned as a secret (separate from the read-only cache token).
4. **Typefully draft API** — endpoint, auth header, threadify field — confirmed against current
   docs; `TYPEFULLY_API_KEY` provisioned.

blog + x + x-thread are fully specified and shippable without #1–#2; **web** rides the same PR
and lands once #1–#2 are confirmed (its mapper + a round-trip test are the only web-specific
code).

## Design

### 0. NetworkPolicy egress hook (`contrib/chart/`) + tokens

- Add a per-attached-service egress allowance for port 443 to
  `contrib/chart/templates/networkpolicy.yaml` — e.g. an `egress.allowInternet` /
  `egressPorts` flag on `attachedServices.<name>` (mirroring the repo-cache policy), set for
  comms-factory in `overlays/comms-factory/values.production.yaml`. Without it the entire
  delivery path (GitHub + Typefully REST) is network-blocked. **Considered alternative:** mount
  the repo-cache PVC into comms — rejected (read-only, wrong pod, no push).
- Add to the comms service `secretEnv`: `COMMS_GITHUB_TOKEN` and `TYPEFULLY_API_KEY`, both
  `optional: true` so a deploy without them is valid (the capabilities probe then hides the
  buttons — §4).
- Document the egress hook + both tokens in the deploy runsheet. **No `git`/`gh` image change**
  (REST needs neither).

### 1. Typefully client + `/typefully-draft` route

`src/typefully.ts` — thin client reading `TYPEFULLY_API_KEY` from env (endpoint/auth/threadify
pinned per open-verification #4):
- `createDraft({content, threadify}) → {id, share_url}`.
- solo `x`: `content = final_by_channel["x"].text`, `threadify=false`.
- `x-thread`: rebuild the tweet array from the chosen candidate's `candidate.structured.tweets`
  (via `candidate_id`), join with the Typefully thread delimiter (4 newlines), `threadify=true`
  (or post the structured tweets per the confirmed API). Fall back to `.text` only if structured
  is unavailable.

`POST /typefully-draft` (registered in `services/api/http.ts`): `{channel, text|tweets}` →
`{ok, share_url, draft_id}` or `{ok:false, error:"typefully_not_configured"}` when the key is
absent.

### 2. REST `/emit` route + LaunchPackage mapper

`src/github-emit.ts` + route `POST /emit` (`services/api/routes/emit.ts`): body
`{release_card, final_by_channel, candidates, dry_run, branch, run_id}`. Auth via
`COMMS_GITHUB_TOKEN` in the `Authorization` header only — **never** in a URL or argv (so it
cannot leak into logs/errors). Absent token → `{ok:false, error:"github_not_configured"}`.

**Mapper `buildLaunchPackage(card, final_by_channel, candidates)`** (reused unchanged from the
git-path design):
- `changelogSlug` — from `card.slug` if present, else slugify the card title (deterministic).
- `changelogMd` — `final_by_channel["blog"].text` (the actor fills the house changelog
  scaffold). Omitted if blog not approved.
- `featureCard.dataTsEntry` — built by `featureCardEntry(candidate.structured)` (subheading/
  title/caption → real `FEATURES_COPY` fields, **PROVISIONAL** pending open-verification #1),
  from the web candidate looked up by `candidate_id`. Omitted if web not approved.
- `roadmapTick` — only if the card carries a roadmap node reference; else omitted (no guessing).

**REST emit flow** (deterministic branch `cf-emit/{slug}-{run_id}`; export and reuse the pure
helpers `markRoadmapNodeDone`, `appendFeatureCopyEntry`, `extractChangelogTitle`, `buildPrBody`,
`ensureTrailingNewline` from `emit-platform-pr.ts`):
1. **Pre-flight idempotency** — `GET /repos/infinex-xyz/platform/pulls?head=infinex-xyz:{branch}
   &state=open`. If a PR exists, return `{ok:true, pr_url, planned_diff:null}` immediately
   (handles double-click and crash-retry — the failure modes that broke the git path). This is
   at the **route layer, before any mutation**.
2. Resolve base: `GET …/git/ref/heads/main` → base sha.
3. **dry-run path** (`dry_run:true`): fetch current contents of the files to be changed,
   compute the transformed content in-memory, return a unified diff as `planned_diff` — **no
   ref/branch/PR created**.
4. **real path** (`dry_run:false`): create branch ref `refs/heads/{branch}` from base sha
   (`POST …/git/refs`; 422 "Reference already exists" → branch already there, continue —
   idempotent). For each target file: `GET …/contents/{path}?ref={branch}` → base64 + blob sha
   (blog is a create, no sha); apply the matching transform; `PUT …/contents/{path}` with
   `{message, content(base64), branch, sha?}` (the blob `sha` makes the update a clean
   replace — no fast-forward concept). Then `POST …/pulls` (head=branch, base=main, title via
   `extractChangelogTitle`, body via `buildPrBody`); 422 "A pull request already exists" → fetch
   and return it.
5. Errors: 401/403 (token absent/underscoped) → `{ok:false, error:"github_permission_denied"}`
   (distinct from `github_not_configured`); all error bodies/logs are scrubbed of the token (it
   is only ever a header, so it never appears in git/process output). Other 4xx/5xx →
   `{ok:false, error:"github_emit_failed", status}`.

Returns `{ok, pr_url, planned_diff}`.

### 3. Python thin-client methods (`tools/comms_factory/client.py`)

- `capabilities()` → `GET /health` returning `{platform_pr: bool, typefully: bool}` (see §4).
- `emit_platform_pr(release_card, final_by_channel, candidates, *, dry_run, branch, run_id)` →
  `POST /emit`.
- `typefully_draft(channel, *, text=None, tweets=None)` → `POST /typefully-draft`.
All follow the existing `_post`/`_get` envelope + redaction pattern.

### 4. Delivery gate in `comms_release.py`

**Capabilities probe (fixes the cross-pod env problem).** The workflow (API pod) cannot read
the comms pod's token env. Extend the TS service `GET /health` to report
`capabilities: {platform_pr: <COMMS_GITHUB_TOKEN present>, typefully: <TYPEFULLY_API_KEY
present>}` (booleans computed from `process.env`, **no values leaked**). The workflow calls
`capabilities()` once (a durable `ctx.step`) before rendering the gate and gates each group's
buttons on `destination_non_empty AND capabilities[group]`.

After the candidate gate marks copy ready, **if any approved channel has a real destination AND
its capability is reported true**, post a delivery gate; otherwise fall through to the existing
`ready_to_ship` message unchanged (delivery is additive — a run with only `in-product`/`modal`
approved, or with tokens absent, behaves exactly as today).

Destination groups from `final_by_channel`:
- `platform_pr` = approved {blog, web} (+ optional roadmap from card)
- `typefully` = approved {x, x-thread}
- `copy_only` = approved {in-product, modal} and any channel with no destination

Round-based gate (surfacing spec's loop discipline — fresh `Gate(ctx.run_id, "deliver",
round_n, inp.user_id, approver_user_ids)` per round; terminal buttonless state on every exit;
bounded loop, e.g. 12 rounds). Buttons appear only when the group is non-empty **and** its
capability is true:
- **"Preview platform PR"** → `emit_platform_pr(dry_run=True)` → post chunked `planned_diff` →
  re-render adding **"Create PR"** (primary) + **"Cancel PR"**, keeping other groups' buttons.
- **"Create PR"** → `emit_platform_pr(dry_run=False, branch=f"cf-emit/{slug}-{run_id}")`
  (durable step `emit_pr`) → post `pr_url`; drop the platform buttons.
- **"Create Typefully drafts"** → per X channel, `typefully_draft(...)` (durable steps
  `typefully_{channel}`) → post share URLs; drop the typefully buttons.
- **"Finish"** → terminal; ship summary.

Each external call is a durable `ctx.step`; replay does not re-deliver: the PR path's route-level
pre-flight (`pulls?head=…`) short-circuits to the existing PR, and Contents PUTs carry the blob
sha (idempotent replace). `copy_only` channels render once with: *"<channel>: no automated
destination — copy is ready above; deliver manually."*

Confirmation discipline: the PR path is preview→confirm (it opens a PR on a real repo).
Typefully creates a **draft** (a human still publishes) → single confirm. Nothing auto-publishes
or auto-merges.

### 5. Ship result

Workflow result gains:
```python
"deliveries": {
    "platform_pr": {"status": "created|skipped|failed", "url": str | None},
    "typefully": [{"channel": str, "status": "...", "url": str | None}],
    "copy_only": [str],
},
```
`no_external_posting` flips to `false` once any delivery is created (else stays `true`). Every
delivery-gate exit (Finish, abandon, loop exhaustion) carries the current `deliveries` so a
created PR/draft is never lost from the durable result.

## Tests

TS (`attached-services/comms-factory`):
- Typefully client: solo vs thread payload; `typefully_not_configured` when key absent (mock
  HTTP).
- REST `/emit` (mock the GitHub HTTP boundary): dry-run returns `planned_diff` with no
  ref/PR created; happy path creates branch+contents+PR; **pre-flight existing-PR short-circuits
  to the URL with no mutation** (double-click / crash-retry); 422-on-ref-create and
  422-on-PR-create both resolve idempotently; absent token → `github_not_configured`; 403 →
  `github_permission_denied` with **no token substring in body/logs**.
- `buildLaunchPackage`: blog-only, blog+web, web `candidate.structured`→`dataTsEntry`,
  missing channels omitted.
- `featureCardEntry` round-trips through `appendFeatureCopyEntry` into a fixture data.ts (shape
  per confirmed open-verification #1).
- `/health` reports `capabilities` booleans from env without leaking values.

Python:
- `capabilities()` probe; delivery gate shown only when destination + capability true; tokens
  absent → fall through to `ready_to_ship` (today's behavior).
- "Preview platform PR" → dry-run posts diff → "Create PR" posts url; `deliveries` populated.
- "Create Typefully drafts" posts per-channel share URLs.
- `copy_only` channels render the manual note, never sent to a destination.
- Replay does not re-deliver (durable step cached + route pre-flight); deterministic branch
  asserted.
- Every delivery-gate exit leaves a terminal buttonless message; bounded-loop exhaustion carries
  `deliveries`.
- Client: `emit_platform_pr`/`typefully_draft`/`capabilities` post the documented envelopes.

## Limitations (accepted this phase)

- **`in-product`/`modal` have no automated destination** — copy shown, delivery manual (modal
  is an ops flag by design).
- **web delivery gated on the live `FEATURES_COPY` schema** (#1–#2); blog/x/x-thread don't
  depend on it.
- **Blog cover image is a placeholder** filled by a human at PR review; no asset hosting.
- **Typefully drafts are not auto-published**; a human publishes (and may paste `typefullyUrl`
  back into the blog).
- **PR is never auto-merged.**
- **Typefully has no idempotency key** — a crash between the Typefully API call and the
  `ctx.step` checkpoint can create a second *draft* (not a published post; low stakes) on
  resume. Noted, not solved (the GitHub path is idempotent via the pre-flight + blob sha).

## Risks

- **First outward-writing code from the comms service** (a real repo + a SaaS). Gated: human
  preview/confirm; tokens `optional` and absent by default; PRs/drafts only, never merge/publish;
  blast radius is one PR branch + Typefully drafts, both reversible.
- **NetworkPolicy egress** widens the comms pod to port 443. Scope it as narrowly as the chart
  allows; it is the one base-chart (`contrib/chart`) change and is called out in scope.
- **Token scope separation** — keep `COMMS_GITHUB_TOKEN` (write) distinct from the read-only
  cache token so PR rights don't broaden grounding's reach; token is header-only (never argv/URL).
- **Schema drift (web)** lives in another repo; the round-trip test + open-verification #1
  contain it. blog/x/x-thread carry no cross-repo schema risk.
- **Blast radius**: TS service (2 routes + Typefully client + REST emit module reusing pure
  transforms), overlay Python (3 client methods + delivery gate), one `contrib/chart`
  NetworkPolicy hook + secret wiring. Base application services and the generation library
  untouched; `emitLaunchPR`/`pnpm emit-pr` retained as break-glass.
