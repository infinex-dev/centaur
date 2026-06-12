# Video capabilities in Centaur — architecture

**Status:** decided 2026-06-10 → 2026-06-12 across four multi-agent investigations (PR157 cross-check → traceability → artifact-store prior-art research → renderer/Remotion). This document is the consolidated architecture; the investigation history that produced each decision is summarized in the Appendix.

**Goal:** produce more video content (talking-head shorts, slideshows, brand-card animations) on the prod k8s deploy box, operated from Slack, with full traceability so humans and agents can debug and improve the pipeline — porting the proven media pipeline from infinex-xyz/agents PR #157 ("daily") into centaur's native primitives.

---

## 1. Context

### What PR #157 ("daily") is

A complete autonomous short-video factory, local-first on a Mac (~$3.50/persona-day):

- **Media pipeline:** Grok news fetch (OpenRouter) → plan-then-realize script stack (story-shape → scene-plan → library-fit → opening-hook → script-copy → 22-rule humanize → visual critic) → fal MiniMax `speech-2.8-hd` voice-clone TTS → fal nano-banana-2 hero still → Kinovi Seedance audio-conditioned talking-head i2v → Remotion render (12 templates + 16 LLM-authored library TSX + a generative per-job-TSX renderer with lint/tsc/smoke/repair QA) → ffmpeg clean.
- **Autonomy layer:** per-persona `cadence.yaml` → 3 scouts (news/list/tutorial) → pure-Python 6-component ranker + LLM pick-rationale → 16-status job state machine with 25-kind `events.jsonl` vocabulary → 7 deterministic QA validators + 6 revision verbs → `auto_if_qa_passes` + daily caps → Postiz drafts. Driven by launchd + a 24-command Telegram bot.
- **Persona model:** `personas/<name>/` — hero.png face ref, voice-ref.wav (→ MiniMax `voice_id` ledger), scene backdrops, canonical outfit, motion brief, palette.

Its best code is pure and portable (state-machine graph, ranker, QA validators, planner, kinovi.py, postiz.py, the prompt stack, the Remotion TSX). Its orchestration shell does not survive the move (fcntl files-on-disk, subprocess CLI tree, launchd, Telegram, macOS-bound paths).

### What centaur already has (cross-check)

| daily concept | centaur equivalent | verdict |
|---|---|---|
| job state machine + events.jsonl | Postgres + durable workflows (`ctx.step`, replay, CRON, `wait_for_event`, child runs) | port the 16-status graph + 25-event vocabulary as overlay schema |
| launchd scheduler | workflow CRON export (timezones, misfire grace) | native |
| Telegram bot (24 commands) | slackbot generic Block-Kit gate kit + `SLACK_WORKFLOW_COMMANDS` | usable; needs the 6 workflow commands (§5) + per-verb gate buttons |
| provider keys in .env | iron-proxy HttpSecret placeholder model | native, with 2 fixes (§8) |
| Remotion | comms-factory already ships Remotion 4.0.460 (dormant brand-card composition, no /render route, no chromium in image) | productionize as Phase-1 cheap win |
| script/copy quality | comms-factory Actor/Director/validator | reusable ONLY for brand/release video + caption critique — its `/generate` hard-requires approved ReleaseCards with repo-grounded facts, impossible for external AI news → daily's prompt stack ports instead |
| scouting | comms-factory Scout = internal product/analytics proposals | different domain; daily's external-content scouts port alongside it |
| media tools | `tools/media/veo3` + nano-banana exist but disabled (and veo3 has no audio-conditioning → no lip-sync, so Kinovi stays) | add fal/kinovi/postiz/openrouter/cloudinary plugins |

### Decision (Option B — decompose)

Rejected: **A** — lift-and-shift daily as one fat attached service (fcntl state opaque to Postgres, second editorial brain, raw keys; its endgame is doing B anyway). **C** — build everything inside comms-factory in TS (persona news-shorts violate its product doctrine; full rewrite of a proven Python pipeline). **Off-the-shelf trace/artifact platforms** — Langfuse/LangSmith/ClearML need 4–6 services (ClickHouse/Redis/S3) on a one-box deploy; Phoenix is one container but stores zero media bytes; MLflow has no dedupe/per-artifact TTL/lineage DAG; any platform still needs the overlay SQL tables next to it → two systems of record. (MinIO went maintenance-only Dec 2025.)

Chosen: decompose into centaur-native parts — provider tools in the API pod, two new attached services (media-renderer, runstore), and overlay durable workflows — detailed below.

---

## 2. The architecture

```
        Slack workspace
          │  ▲
  "@bot video <brief>"   gate msgs (thumbs + per-verb reject buttons) ·
          │  │           `video runs` replies · weekly digest
          ▼  │
     ┌───────────┐
     │ slackbot  │  (existing pod — generic gate kit, workflow commands; no new TS)
     └─────┬─────┘
           │ spawn / message / execute / workflow events
           ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ API POD (existing control plane — all of this runs in-process)              │
 │                                                                             │
 │   workflow engine (durable, Postgres-checkpointed, CRON, child runs)        │
 │    ╔═ overlay video workflows (.py, mounted like comms-factory's) ════════╗ │
 │    ║  video_release · video_persona_day(CRON) · retention_sweep(CRON)     ║ │
 │    ║  video_weekly_eval(CRON) · revision/experiment child runs            ║ │
 │    ╚═══════════════════════════════════════════════════════════════════ ═╝ │
 │   tools plane (/tools/{name}/{method} — auto-discovered plugins)           │
 │    ├─ existing: slack · websearch · repo_context · comms_factory …         │
 │    ╔═ new: openrouter · fal_tts · nano_banana · kinovi · postiz ═══════ ══╗ │
 │    ║   cloudinary · video_runs · video_personas  (async, HttpSecret)      ║ │
 │    ╚══════════════════════════════════════════════════════════════════ ══╝ │
 │    ╔═ record_artifact() helper: metadata row→SQL · bytes→runstore ════ ═══╗ │
 │    ╚══════════════════════════════════════════════════════════════════ ══╝ │
 └──┬───────────────┬────────────────────┬───────────────────────┬────────────┘
    │ SQL           │ via iron-proxy     │ HTTP (async job API)  │ HTTP PUT/GET blobs
    ▼               ▼                    ▼                       ▼
 ┌──────────┐  ┌────────────┐   ╔══════════════════╗   ╔═════════════════════════╗
 │ Postgres │  │ iron-proxy │   ║ media-renderer   ║   ║ runstore                ║
 │          │  │  (MITM,    │   ║ (new pod)        ║   ║ (new pod)               ║
 │ existing:│  │  real keys │   ║ Remotion+chrome  ║   ║ blob API · thumbnailer  ║
 │ wf_runs  │  │  injected) │   ║ +ffmpeg+tsc      ║   ║ htmx UI (grid/timeline) ║
 │ wf_ckpts │  └─────┬──────┘   ║ emptyDir scratch ║   ║                         ║
 │ wf_events│        ▼          ║ (discarded)      ║   ║ PVC 30–50Gi:            ║
 │ ╔══════╗ │   fal.run         ╚════════╤═════════╝   ║  blobs/<aa>/<sha> (CAS, ║
 │ ║runs  ║ │   kinovi.ai                │ pulls inputs/ ║ dedupe, 30d window,    ║
 │ ║events║ │   openrouter.ai            └─pushes outputs►║ write-time byte budget)║
 │ ║artifa║ │   postiz                     (CAS refs)   ╚═══════════╤═════════════╝
 │ ╚══════╝ │   api.cloudinary ──► centaur-video/delivery/          │ UI via
 │ (4 new   │                     (public finals, POST-approval     ▼ port-forward /
 │  overlay │                      only)                       API-proxy browser
 │  tables) │
 └──────────┘
      ▲
      │ call video_runs timeline|get_artifact(thumb=true)|lineage|annotate …
 ┌────┴────────────┐                          ┌────────────────────────────┐
 │ sandbox pods    │ (existing — egress is    │ comms-factory (existing    │
 │ (agent harness) │  api:8000 only; agents   │ pod) — brand-card video    │
 └─────────────────┘  inspect via the tool)   │ lane + validator reuse     │
                                              └────────────────────────────┘
```

**Census of what's new:** 2 pods (runstore, media-renderer), ~8 tool plugins (6 provider + `video_runs` + `video_personas`), a handful of overlay workflow files, 4 overlay tables (3 runstore pipeline tables + 1 persona/config table), one chart upgrade (PVC/probes/securityContext for attached services + 2 NetworkPolicy edges: renderer→runstore, ingress→runstore UI later). Everything else is centaur as it runs today.

### Data planes — where everything lives

| Data | Home | Lifecycle |
|---|---|---|
| job state, events, recipe snapshots, all planning/script/QA JSON | Postgres (3 runstore tables; JSON ≤100KB inline in `artifacts.payload`) | keep forever |
| thumbnails / waveforms / frame-0 previews of every media artifact (≤50KB, derived server-side by runstore) | runstore CAS | keep forever — runs stay visually browsable after media expiry |
| full-res intermediates (vo mp3s, hero png, seedance mp4, scene frames, generative smoke frames) + the final until approval | runstore CAS | 30-day window; pin-on-label → keep 1yr (as proxies / under a pin byte-budget) |
| render working set (`remotion-public/`, scaffolded generative project, node build cache) | media-renderer emptyDir | ephemeral — discarded after each job; reconstructible from CAS refs |
| approved finals (+ cover/slides) | Cloudinary `centaur-video/delivery/` (public CDN) | post-approval only; approved-but-never-posted jobs' delivery assets deleted after N days |
| persona props (handle, accent, palette, font, motion brief, voice_id ledger, cadence) | Postgres (the persona/config overlay table) | durable |
| persona assets (hero.png, voice-ref.wav, scene refs) | runstore CAS | durable (`keep` class, pinned-permanent by `video_personas`) |

The unlock vs the local `runs/` folder: there is **no persistent run directory**. Idempotency = Postgres checkpoints + a manifest of CAS refs; a dead render pod means the workflow re-dispatches and the renderer re-pulls into fresh scratch. But the *record* (every stage output + provenance) is durable in runstore — strictly more than the folder gave (SQL queryability across runs, lineage edges, per-artifact cost), never less.

---

## 3. runstore — the artifact/trace store

One bespoke attached service (`attached-services/runstore`; e.g. FastAPI + Pillow/ffmpeg). Industry research consensus it implements: metadata in Postgres + bytes in a content-addressed store ("claim check" pattern), sha256 dedupe as the bloat control, the event log as the lineage record, "filesystem + index" at this scale (~20 jobs/day). **Honest scope: a build, not an install — ~2.5–4k lines, ~3.5–5 weeks including the attached-services chart work (built once, shared with media-renderer); the Phase 2/3 windows in §10 absorb this.**

**The schema is the contract, not the HTTP API:** metadata reads/writes happen in the **API pod** via the overlay SQL helper (existing asyncpg pool) — so a down runstore degrades to "thumbnails late", never "provenance lost", and no runstore→Postgres NetworkPolicy edge exists. runstore itself serves: blob PUT/GET/DELETE/stat (range requests for video), server-side thumbnail/waveform derivation, and the UI. **Division of labor, precisely:** runstore's blob PUT returns `{sha256, bytes, thumb_sha256}` and enforces the byte budget at write time against its own CAS accounting (refusing when over; it owns the filesystem and touches blob mtime on dedupe-hit PUTs); `record_artifact` (API pod) then does all Postgres writes — the artifact row including thumb_sha256, and budget/alert figures read from `SUM(bytes)` of live rows; the renderer's outputs flow back through its job response so the workflow records their rows; `retention_sweep` (API pod) selects expirable/unreferenced blobs under a Postgres advisory lock and calls runstore's DELETE endpoint, which honors the GC grace window.

### Tables (overlay dbmate, `--set overlay`)

Three pipeline tables below, plus a 4th overlay table (persona/config — props, cadence, voice_id ledger) described in §4.

- **`runs`** — job identity: `job_id` (stable logical video id, **decoupled from workflow run_id**; revision verbs are child workflow runs against the same job), workflow-run linkage, persona, run_date, format, status (the 16-status graph, transitions validated in the workflow), candidate provenance (source/keyword/url/topic), recipe_id / recipe_hash / recipe_snapshot (frozen config), voice_id, pose_slug, postiz_post_id (the performance-loop join key), **variant_of** (self-FK, set by experiment fan-out), labels/ratings, final_artifact_id, total_cost_usd.
- **`events`** — the 25-kind vocabulary + `provider-call-failed`, **with contracted payload schemas per kind** (a failed provider call has no artifact row; the event carries its provenance: provider, model, params_hash, error, latency, cost). Indexed `(persona, kind, created_at)` — the ranker's 30-day feedback walk and the unbounded blacklist replay become single SQL queries. **Gate→events double-emit is one ctx.step doing both writes, with a test asserting every gate resolution lands an events row** (else the ranker's feedback_penalty ships at constant 0.0, daily's documented gap).
- **`artifacts`** — one row per stage output: job_id, run_id, persona + run_date (denormalized), stage, kind, name, scheme-prefixed `ref` (`cas:` / `cloudinary:` / `expired`), sha256, **thumb_sha256** (counted as a live CAS reference), bytes, mime, inline `payload` JSONB for ≤100KB JSON (larger JSON → CAS, retention class preserved); **provenance:** producer, provider, model, provider_job_id, params + params_hash, prompt_sha, **template_id + template_sha** (workflow_version hashes only the handler file — template provenance must be explicit), seed, cost_usd, tokens, latency_ms; **`input_artifact_ids[]`** (GIN) lineage edges; variant; superseded_by; retention; expires_at. `UNIQUE(job_id, stage, name) WHERE superseded_by IS NULL` — revision chains coexist with stable addressing. Candidates are candidate-kind artifacts on scout runs; the planner records the picked candidate's artifact_id as a lineage input of the job's first artifact (the pick→job edge).

`ctx.step` checkpoint values are always `{artifact_id, sha256}` — bytes never enter checkpoints; no payload double-write. `record_artifact(...)` is one helper call, idempotent on (job_id, stage, name, sha256); **checkpoint provider_job_id before fetching provider bytes** so a store outage never re-spends provider dollars.

### CAS + retention

- Flat `blobs/<aa>/<sha256>` on one 30–50Gi RWO PVC. Dedupe = file-exists (identical hero/vo across revision chains store once).
- **Byte budget enforced in code at write time** (runstore refuses PUTs over budget; Slack alert at 80% from the Postgres-side accounting) — k3s local-path does **not** enforce PVC capacity; the budget is the real bound.
- **Two retention classes:** `keep` (all JSON + thumbnails + clean-chain evidence + persona assets, ~0.5–1MB/run) and `window` (every full-res binary + the final until approval, fixed **30d** — covers the ranker's feedback horizon and late performance signals). **Pin-on-label** flips an artifact's lineage chain to keep-1yr on: qa-fail, gate-reject, **any terminal-failure status** (crashed runs are the eval corpus), experiment-baseline, or `annotate()` — **never on routine degraded.json noise** (cover truncation fires per-scene on the normal path) — pinned media stored as 360/720p proxies or under an explicit pin byte-budget surfaced in the weekly digest.
- Expiry = **tombstone**: bytes unlinked, row keeps metadata + thumb (integration test: a tombstoned run still renders its thumb strip). Final.uncleaned is **not archived** — replaced by clean-chain evidence (3 frame-pairs + ffmpeg pass logs); exception: on QA-fail the full-res uncleaned blob is kept just 7d for debugging while the rest of the failed chain pins to keep-1yr as proxies.
- **Two-phase GC** (nightly sweep + write-time backstop): the sweep selects blobs that are unreferenced AND past a 48h grace window under a Postgres advisory lock, then calls runstore's DELETE; `record_artifact` inserts the metadata row before the blob counts as live, and runstore touches mtime on dedupe-hit PUTs (closes the sweep-vs-dedupe race and the crash-between-PUT-and-row orphan).
- Scheme-prefixed refs keep an R2/S3 escape hatch open with zero schema change.

### Surfaces

1. **Web UI** (htmx, served by runstore): runs grid (persona/date, status + cost + thumb strip) and **per-job timeline — ships with runstore in Phase 2, first view built** (inline thumbs/audio/video via range requests, provenance panel per artifact, clickable lineage edges); compare view lands in Phase 3 (params diff + scorecard delta + side-by-side thumbs). v1 access = port-forward or proxied through the API pod; ingress + auth for the UI is explicit later chart work.
2. **`video_runs` tool** (thin client in API pod — the only path sandboxed agents have, since sandbox egress is api:8000 only): `timeline | get_artifact | search | lineage | compare | annotate`. `get_artifact(thumb=true)` returns content_base64 (≤50KB) or registers a short-TTL attachment so **agents can see pixels**, not just JSON — the visual bisect ("hero clean, seedance warped → blame i2v") works for agents too.
3. **Slack**: gate previews and `video runs` replies upload thumb bytes directly as files (no public-URL dance).

---

## 4. media-renderer — generic composition service

One attached service (`attached-services/media-renderer`): Node 22 + Remotion (pinned 4.0.460, matching comms-factory) + **Chrome Headless Shell pre-baked** (Remotion ≥4.0.137 auto-downloads it at install — pin it in the image; no runtime downloads in an air-gapped pod) + ffmpeg + tsc.

**Air-gapped:** zero provider secrets; egress only to runstore (one NetworkPolicy edge) to pull inputs. Inputs come from the CAS, never from the internet — which also restores the strongest security posture for executing LLM-authored code (below).

**Generic job API:** `POST /render {composition_id, props, assets: [CAS refs], mode: typecheck|smoke|stills|full}` → async job; pull assets into emptyDir `publicDir` → `bundle()` + render → outputs (mp4 / stills / smoke frames / typecheck log) back to runstore → scratch discarded.

**Compositions are code, baked into the image** under `compositions/<product>/`:
- `daily-news/` — vendored from `daily/remotion/`: 12 templates (incl. SceneTH talking-head), 16 frozen library components, shared.tsx, DailyNews router, Cover (~4,600 lines TSX).
- `brand-card/` — comms-factory's data-card composition (same Remotion version). Post-Phase-2 migration target: Phase 1 runs it inside comms-factory's own pod; §10 Phase 3 migrates it here.
- Future products add composition dirs via PR + image rebuild.

**Personas are pure data, never code** (verified: `Root.tsx` Cover already takes `persona: {handle, accent, face_src, font_stack}` as inputProps; palettes flow `personas.yaml → config → props`): props live in the persona/config overlay table, assets (hero.png, voice-ref.wav, scenes) in runstore CAS, managed by a `video_personas` tool (Slack file upload → attachment → CAS — small files only, a few MB, which persona refs satisfy; attachments are BYTEA/in-memory per §8; voice_id ledger row updated by the fal_tts tool's re-clone-on-4xx). Adding a persona = rows + 3 uploads; the renderer image never changes.

**Generative TSX lifecycle** (daily's `--renderer generative` path — TSX is data fed to a fixed compiler, exactly as daily's bridge.mjs already treats it):
1. **Birth (API pod):** the LLM step emits SceneNN.tsx strings → recorded immediately as runstore artifacts (kind=generative_tsx, keep-forever text, provenance: prompt_sha/model/beat-plan lineage; repair attempts chain via superseded_by). `lint.py` runs here as a pre-filter before any TSX leaves the workflow.
2. **Execution (renderer):** staged into emptyDir scratch (`<job>/src/generated/…` + scaffolded root/index/common from the fixed `common-template.tsx`); bridge subcommands map 1:1 to job-API modes (typecheck → smoke → full; bridge's `preview` = `full`, `stills` kept for slideshows); QA evidence (typecheck.log, smoke frames→thumbs, motion.json, repairs.json) flows back as artifacts.
3. **Never in the image.** Library self-growth = human-reviewed promotion: proven generated components get PR'd into `compositions/daily-news/library/`; failed TSX = pinned artifacts (daily's `.quarantine/` equivalent).

**Security unblock:** the earlier "defer generative" caution assumed lint-as-only-gate in a pod with egress/secrets. The air-gapped renderer (no secrets, egress only to runstore) contains LLM-authored code execution; lint demotes to defense-in-depth. The generative lane is shippable.

**Remotion stays** (researched 2026-06): Revideo drifted to commercial Midrender (OSS unmaintained, different generator-function API, still Chromium underneath); Motion Canvas can't render headless (open issue); editly/MoviePy = no React model, full rewrite; hosted APIs are cloud-only. The only consideration is the **company license** (free ≤3 employees; "Automators" $0.01/render with $100/mo minimum covers self-hosted renderMedia; "Creators" $25/seat/mo). It's per-company and comms-factory already ships Remotion in prod — **verify with hi@remotion.dev whether a license exists / one covers both products**. (The `@remotion/licensing` telemetry package, ≥4.0.237, counts renders but does not auto-bill yet.)

**Ops:** the image can start from the sandbox base, which already ships ffmpeg + Node + chromium (`services/sandbox/Dockerfile`), + Remotion + Chrome Headless Shell; /dev/shm via Memory-medium emptyDir (64Mi default crashes Chromium); `--concurrency` = Chromium tabs, tune to pod CPU limits (~2cpu/4Gi requests/limits, Guaranteed-ish); bounded render queue in the service (not unbounded child fan-out); compositor warmup frames are structural; GPU is off by default in headless (fine for these templates); clean chain ships **without** exiftool provenance spoofing (§9).

---

## 5. Workflows — the pipeline as durable code

Overlay workflow files (Python, mounted like comms-factory's; Postgres-checkpointed `ctx.step`, replay-safe):

- **`video_release`** — the per-video pipeline: scout/brief → **ported script stack** (story-shape → scene-plan → library-fit → opening-hook → script-copy → humanize → visual-critic as ctx.step LLM calls via the openrouter tool; daily's prompts + treatment registry port verbatim — comms-factory's Actor cannot emit the treatment-typed scene schema the renderers consume) → **script gate** (before any media spend) → TTS → hero → seedance (async tools, ctx.sleep polling, 30–60s granularity, iteration-named steps) → render (runstore refs → media-renderer) → **ported QA validators** (with `treatment` added to QaFinding — the value is in-hand at daily's qa.py:140 — so "which treatment fails most" is a GROUP BY) → **final-cut gate** (thumbs + per-verb reject buttons + optional 1–5 rating) → on approve: cloudinary tool uploads to delivery, postiz tool drafts behind the **ship gate** ("ship" = the Postiz post decision, always human; never auto-post).
- **Revision verbs** = child workflow runs against the same `job_id`; regenerated artifacts supersede within the job; `timeline(job_id)` shows the full chain.
- **Variants without redeploys** — `video_release.Input` takes `recipe_overrides`/`prompt_overrides`, merged → snapshotted → hashed into recipe_hash; `video experiment <job_id> --override …` fans out a variant child job (`runs.variant_of` links it); adopting the winner is the PR.
- **`video_persona_day`** (per-persona CRON) — cadence from Postgres → daily's 3 scouts (Grok via openrouter tool) → ported ranker (6 components: fit / novelty / source-quality / recent-posts / format-mix / feedback-penalty; pure SQL-backed) → LLM picker → fan out video_release child runs → `auto_if_qa_passes` per format with daily cap counters. **Precondition for enabling auto per format: the `video_gate_agreement` view** (confusion matrix of operator decision × QA verdict per persona/stage/recipe_hash/format — comms-factory's ≥80% agreement bar).
- **`retention_sweep`** (CRON) + **`video_weekly_eval`** (CRON) — the digest posts to Slack: QA pass rates by validator/treatment, rejections by blamed stage, cost per persona-day, agreement rates, pin-budget consumption, top/bottom thumbnails. The trace plane has a standing reader from day one.

**Operator surface (Slack):** `video <brief>` (anchored regex so conversational mentions still reach the agent lane) · `video runs [persona|date|job]` · `video status` · `video revise <verb> <job-id>` (works post-completion — spawns a child run) · `video cancel <run-id>` · `video experiment …`. Structured rejection labels = **one reject button per revision verb + "other"** (the base gate modal is a single text input and overlays can't inject TS — per-verb buttons + workflow-side verb→blamed_stage mapping is the zero-base-change capture path; optional note via the existing modal). Rationale for shipping all six commands at deploy time: Slack has no cancel wiring today and gate buttons die when runs complete, so `cancel` and post-completion `revise` can't be added later as afterthoughts; without `auto_if_qa_passes` operators face ~3 gates per video.

---

## 6. Provider tools (API pod, behind iron-proxy)

All new media tools are **async with explicit `timeout_s`** and split submit/poll driven by `ctx.sleep` — never blocking poll loops (a verbatim port of kinovi's 30-min sync loop would exhaust the API pod's shared thread pool and stall every tool platform-wide; veo3 as shipped dies at the 120s default — fix before enabling).

| tool | provider / hosts | notes |
|---|---|---|
| `openrouter` | openrouter.ai | Grok news scouts + script-stack LLM calls |
| `fal_tts` | fal.run, queue.fal.run | MiniMax speech-2.8-hd voice-clone; re-clone-on-4xx against the voice_id ledger |
| `nano_banana` | fal.run | hero stills |
| `kinovi` | kinovi.ai | Seedance i2v (audio-conditioned talking head — the capability Veo3 lacks) |
| `postiz` | org Postiz instance | drafts only, behind ship gate; honest `isAiGenerated` |
| `cloudinary` | api.cloudinary.com | delivery uploads; use chunked `upload_large` (single sync upload caps ~100MB plan-dependent; finals at 20–100MB sit near the line); iron-proxy is a pass-through (needs `allow_chunked_body` for multipart video) |
| `veo3` / `google_nano_banana` | (existing, disabled) | enable after adding timeout_s + async; Google-flavored alternates (rename the existing google plugin to avoid colliding with the fal `nano_banana`) |

Secrets via `[tool.centaur].secrets` HttpSecret manifests (op:// 1Password or env) — placeholder credentials in process, real keys injected by iron-proxy per host. **Exception — cloudinary is the one tool with a live secret in the API pod:** its API requires local request signing (there is no bearer header to placeholder-swap), so the real `api_secret` is held in-process (op://) and iron-proxy only audits/passes the traffic. Bounded blast radius — an asset-upload key, not a model key; same posture comms-factory uses for its Anthropic key. **Two firewall facts:** add `user-agent` to iron-proxy's `header_allowlist` (Kinovi is Cloudflare-fronted and 403s without a browser UA), and spike large multipart bodies (wav/png/mp4 to fal/Postiz/Cloudinary) through the MITM in week 1.

Cloudinary account facts (verified in org repos): cloud name `infinex`, creds at `op://Employee/Cloudinary/{api_key,api_secret}`, video/audio first-class (`video` resource type), server-signs/client-uploads pattern already shipped in platform. **Confirm plan/credit headroom with the account owner against the real delivery scale** (~600MB/day across formats if everything ships ≈ 215GB/yr cumulative; the trace plane itself costs ~$5–30/mo of storage vs ~$525/mo provider spend). Delivery is the only Cloudinary usage (one folder), with two lifecycle rules: approved-but-never-posted jobs' delivery assets deleted after N days; a downgrade rule for old posted assets (e.g. 360p proxy after ~180d) to be agreed with the account owner.

---

## 7. The improvement loop

What makes the trace plane an eval corpus rather than hoarding:

1. **Labels at capture time (Phase 0 — unbackfillable):** per-verb gate rejection (`{blamed_stage, verb, note}` event payload), optional 1–5 rating on approve, operator script edits persisted as `operator_edit` artifacts, `annotate()` for post-hoc blame (also pins the lineage chain).
2. **Lineage + provenance per artifact** → the visual bisect: pull script.final + critic verdict + hero thumb + seedance thumb + motion params + QA report for a bad run, walk `input_artifact_ids` edges, localize the failing stage with zero re-spend. Same data over `video_runs` makes it agent-executable.
3. **Variants + template provenance** (`template_id/template_sha`, recipe_hash) → "did Tuesday's prompt change make things worse" is a GROUP BY; A/B via experiment child jobs; compare view diffs params/scorecards/thumbs.
4. **Regression with a comparator:** per-run scorecard view (QA findings by validator+severity+treatment, caption violations, degraded count, per-stage cost/latency, gate rating); golden replay defaults to text-stages-only (daily's workshop cut — no media spend), full-media opt-in.
5. **Feedback closes:** gate decisions double-emitted into `events` feed the ported ranker's feedback_penalty; `postiz_post_id` + a metrics-pull workflow later emits `performance-observed` back into the same tables.
6. **A standing reader:** the weekly digest answers "is it getting better?" unprompted.

---

## 8. Verified infra constraints (load-bearing facts)

- **Attachments are BYTEA-in-Postgres** (base64 JSON, in-memory buffering; slack tool only dereferences centaur URLs) → never route video bytes through them; runstore CAS is the byte plane. No base-`attachments` entanglement (base retention sweeper is age-only/all-or-nothing — parking keep-forever bytes there would forbid `CENTAUR_RETENTION_ATTACHMENTS_TTL_DAYS` org-wide).
- **Attached services have NO direct 443 egress** under NetworkPolicy (api:8000 + optional iron-proxy only); the prod values file is k3s-shaped → **verify enforcement on the deploy box** (week-1 spike). Renderer pulls from runstore in-cluster, so it needs no external egress at all. Chromium doesn't trust the MITM CA (`NODE_EXTRA_CA_CERTS` is Node-only) — never route renders through iron-proxy.
- **Chart work (build once, serves both new pods):** attached-services.yaml needs volumes/PVC + emptyDir (incl. Memory `/dev/shm`) + liveness/readiness probes + per-service securityContext (`--no-sandbox` under dropped caps) + fsGroup; NetworkPolicy carve-outs (renderer→runstore; ingress→runstore UI later); ingress/auth for the runstore UI. PVC precedent exists in-repo: copy the volumeClaimTemplates pattern from `KUBERNETES_SANDBOX_STATE_VOLUME_ENABLED` (`api/sandbox/kubernetes_agent_sandbox.py`).
- **Workflow worker concurrency defaults to 2** in the single BestEffort API replica — bump `WORKFLOW_WORKER_CONCURRENCY` via `api.extraEnv`, set `api.resources`; long tool calls must be ctx.sleep-polled, not slot-pinning.
- **Capacity:** deploy box already runs api/postgres/slackbot/iron-proxy/comms-factory + a 5-pod warm pool (2cpu/4Gi limits each); audit free CPU/RAM/disk before first deploy; grow the local podman VM disk before the first local image build (renderer image est. ~1.5–2.5GB; disk-pressure GC is a known local failure mode). Budget Postgres PVC/WAL/backup headroom (est. ~+10–15GB/yr — size during the capacity audit).

---

## 9. Governance (decide explicitly; defaults chosen)

- **exiftool iPhone-provenance forgery + x264 CompressorName patch: OFF / not ported.** Platform-policy evasion under org identity; requires an explicit, logged org-policy override to ever enable.
- **Postiz `isAiGenerated`: honest.** daily hardcodes `False`; the port flips it and surfaces AI-content labeling.
- **Human gate before any Postiz draft, even in the autonomy lane** (auto_if_qa_passes skips the *final-cut* gate for low-risk formats only after the agreement bar, never the ship decision; hard daily caps + periodic audit). In the auto lane, a QA-pass under the agreement bar counts as the "approval" that permits the Cloudinary delivery upload; the ship gate before Postiz remains human-only.
- **LLM-authored TSX executes only in the air-gapped renderer**; lint is defense-in-depth, not the boundary.

---

## 10. Phasing

- **Week 1 — spikes (parallel):** (a) NetworkPolicy enforcement on the prod box; (b) fal/Kinovi/Postiz/Cloudinary auth + large multipart bodies through iron-proxy (with the user-agent allowlist fix); (c) Remotion Chrome-Headless-Shell in-cluster (/dev/shm, --no-sandbox, fonts, warmup).
- **Phase 0 — ships WITH the first pipeline PR (the unbackfillable part):** 4 overlay migrations (runs/events/artifacts + persona/config) with pinned DDL + per-kind event payload contracts; `record_artifact()` helper + producer return contract (provenance, cost, provider_job_id-before-fetch); per-verb gate label capture; provider-call-failed events.
- **Phase 1 (≈wk 1–2) — brand-card lane + tool plane:** productionize comms-factory's dormant brand-card renderer inside its own pod (/render route + chromium/ffmpeg image layer + render gate in comms_release) → animated brand cards ship; fix + enable `veo3`/`google_nano_banana`; land the `openrouter`/`fal_tts`/`nano_banana`/`kinovi`/`postiz`/`cloudinary` plugins. Honest framing: raises output, de-risks little on the talking-head lane — that's the spikes' job.
- **Phase 2 (≈wk 3–7) — talking-head lane:** chart upgrades (volumes/probes/securityContext/NP edges); **runstore** (CAS + byte budget + two-phase GC + server-side thumbs + JSON API + `video_runs` tool + **timeline UI**); **media-renderer** (generic job API + vendored compositions + generative bridge); script-stack port (~1 week — daily's prompts + planners are verbatim-portable); `video_release` workflow with script + final-cut gates; persona props/assets CRUD (`video_personas`); the 6 workflow commands (§5); the `video_gate_agreement` view ships here too, and `auto_if_qa_passes` enables per low-risk format only once its ≥80% bar is met. Operator-triggered talking-head shorts ship. (The runstore build dominates this phase — see §3 honest scope; the window absorbs it.)
- **Phase 3 (≈wk 7–11) — autonomy + eval machinery:** cadence in Postgres; scouts/ranker/picker ports; `video_persona_day` CRON with child fan-out + caps; revision verbs as child runs; compare view; variant fan-out + golden replay; retention sweep + weekly digest CRONs; migrate brand-card rendering from comms-factory's pod into media-renderer.
- **Phase 4 (optional):** `performance-observed` ingestion (Postiz metrics → events → ranker); R2 offload if the CAS budget sustains pressure; tighten iron-proxy's domain allowlist to the specific media hosts (fal.run, kinovi.ai, openrouter.ai, api.cloudinary.com, Postiz); Phoenix bolt-on via OTel export if span-level LLM tracing is ever missed.

Content output rises at ~wk 2 (brand cards), ~wk 6–7 (on-demand talking-heads from Slack), ~wk 10–11 (autonomous persona-days; throughput bounded by render-queue depth + provider spend).

**Open items to close early:** Cloudinary plan/credit headroom (account owner); Remotion company license (hi@remotion.dev — per-company; comms-factory already ships it); NetworkPolicy enforcement verification; deploy-box capacity audit.

---

## Appendix — investigation history & key files

**How these decisions were made (2026-06-10 → 06-12):** (1) 9-agent workflow: 5 deep-read maps of PR157 + centaur → Option-B design → infra/security/product adversarial reviews (produced the verified constraints in §8 and governance flags in §9). (2) Traceability investigation: daily's `runs/` folder shown to be the eval substrate (revision verbs = artifact deletion + re-run; workshop A/B needs retained fixtures; ranker walks retained events) → capture-time contract (provenance/labels/lineage/variants) validated by two adversarial reviews. (3) Artifact-store prior-art research (LLM observability, ML trackers, orchestrators, media/blob engineering) → runstore design, simplicity + requirements adversarial reviews (byte-budget-in-code, two-phase GC, schema-as-boundary, per-verb labels, variant_of, agent pixel path). (4) Renderer research: Remotion licensing + alternatives (Revideo/Motion Canvas/editly/hosted APIs) + generative-TSX lifecycle mapping.

Superseded along the way (kept here so old references aren't confusing): "discard intermediates / ephemeral-only scratch" → runstore archive; "Cloudinary authenticated archive zone + T0–T5 retention tiers + video_blobs BYTEA table + 5 tables" → runstore's 3 pipeline tables (+1 persona/config) + CAS + 2 classes; "renderer pulls inputs from media hosts with narrow egress" → renderer pulls from runstore, fully air-gapped; "defer generative TSX" → shippable in the air-gapped renderer; "upload final to Cloudinary before the gate" → post-approval only.

**Key files — PR157** (`/tmp/agents-pr157`, branch `feat/daily-harness-autonomy-plan`): `daily/daily_core/core/state.py` (state machine + events), `candidates/{scout,ranker,picker,planner}.py`, `jobs/{qa,revise,draft}.py`, `render/kinovi.py`, `render/treatments.py`, `render/generative/` + `renderers/generative.py`, `remotion/render.mjs` + `generative/bridge.mjs` + `src/{templates,library}/`, `bot/postiz.py`, `prompts/`, `personas.yaml`.

**Key files — centaur:** `services/api/api/workflow_engine.py` (ctx.step/sleep/wait_for_workflow/CRON, worker concurrency), `tool_manager.py` (120s default, async tools), `routers/attachments.py` + `db/migrations/007_attachments.sql` (BYTEA), `api/retention.py` (base sweeper), `contrib/chart/templates/{attached-services,networkpolicy}.yaml`, `services/iron-proxy/iron-proxy.yaml` (header_allowlist), `tools/media/veo3`, `overlays/comms-factory/workflows/comms_shared.py` (gate kit), `attached-services/comms-factory/src/remotion/` + `services/api/server.ts`.
