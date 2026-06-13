# Video capacity & enforcement audit (U1)

Findings record for plan unit U1 of `docs/plans/2026-06-12-001-feat-video-capabilities-build-plan.md`.
Started 2026-06-13. Local = the dev Mac's podman-VM k3s; prod = the deploy box (audit deferred, see checklist).

## Local capacity (dev Mac)

| Item | Before | After (2026-06-13) |
|---|---|---|
| Podman VM disk | 160G, 127G used (80%), 33G free | **200G, 121G used (61%), 79G free** |
| Dangling podman build images | 9.1GB reclaimable | pruned → 3.1GB |
| VM resources | 6 CPU / 8GiB RAM | unchanged |
| Host Mac free disk | ~59G | **the real ceiling** — VM raw file is ~137G and can grow to 200G as the guest fills; watch host headroom during image-heavy phases |

- VM 6cpu/8Gi means local cannot run the full prod shape (renderer ~2cpu/4Gi + warm pool + stack) at production sizing — local spikes size pods down and that's fine; prod sizing comes from the deploy-box audit.
- **Gotcha (CLAUDE.md-worthy):** `podman machine set --disk-size N` grows only the virtual disk. On an already-provisioned Fedora CoreOS machine the guest partition/FS does NOT auto-grow on boot; finish online with:
  `podman machine ssh "sudo growpart /dev/vda 4 && sudo xfs_growfs /"`
- VM restart invalidates the k3s SSH tunnel (port changes — it moved to 61445 this time); `contrib/scripts/k3s-local.sh` is the idempotent restore (re-fetches kubeconfig, reopens tunnel). All centaur pods recovered post-restart; Postgres PVC data intact.

## NetworkPolicy enforcement

- **Local k3s does NOT currently enforce NetworkPolicy**: `k3s-local.sh` step 2b idempotently writes `disable-network-policy: true` into `/etc/rancher/k3s/config.yaml` (sandbox-DNS workaround). CLAUDE.md's "k3s ENFORCES NetworkPolicy" describes stock k3s, not this machine's steady state.
- Spike protocol for enforcement-ON windows (U2 provider spike, U3/U14 air-gap verification):
  1. `podman machine ssh "sudo sed -i '/disable-network-policy/d' /etc/rancher/k3s/config.yaml && sudo systemctl restart k3s"`
  2. Run the enforcement-dependent tests (sandbox DNS is broken during the window — codex-style harnesses fail; keep it short, coordinate with anyone using the shared stack).
  3. Re-run `contrib/scripts/k3s-local.sh` (re-adds the disable line + restarts k3s) to restore steady state.
- **Open question the prod audit must answer:** whether the deploy box's CNI enforces NetworkPolicy at all. The air-gap posture for media-renderer (zero egress except runstore) is a runtime control only if enforcement is real on prod.

## CPU architecture

- CI (`.github/workflows/publish-images.yml`) builds on ubuntu-latest with default platform → **prod images are linux/amd64**.
- Local spikes run **arm64** (Apple Silicon VM). The U3/U14 image recipe must bake Remotion's Chrome Headless Shell **per target arch** and verify the binary exists at image build time. Local render timings are arm64 numbers; treat as directional for prod.

## Prod deploy-box audit — DEFERRED checklist

Run read-only on the deploy box (or via logs/CI artifacts) before Phase D deploy:

- [ ] NP enforcement: `kubectl get pods -n kube-system` (which CNI/NP controller), `cat /etc/rancher/k3s/config.yaml` (any `disable-network-policy`)
- [ ] Capacity vs planned additions (renderer ~2cpu/4Gi requests/limits, runstore PVC 30–50Gi, 2 new images): `kubectl describe nodes | grep -A8 'Allocated resources'`, `df -h`
- [ ] Arch confirm: `uname -m` (expected x86_64 per CI)
- [ ] Overlay migrations table: `schema_migrations_overlay` row count / existence (comms-factory prod deploy was still pending as of 2026-06-10, so U4 likely numbers from 001 cleanly)
- [ ] Postgres PVC/WAL/backup headroom (~+10–15GB/yr per origin §8)

## External accounts & keys

| Item | Status (2026-06-13) |
|---|---|
| Provider dev keys (local) | Provisioned as k8s secret `video-provider-keys` in ns `centaur`: `FAL_KEY`, `KINOVI_API_KEY`, `OPENROUTER_API_KEY`, `POSTIZ_API_KEY`, `POSTIZ_BASE_URL`. Long-term home should be 1Password (`op://` refs) when tools land in U7/U8 — local `op` CLI not installed yet. |
| Cloudinary | Already in 1Password: `op://Employee/Cloudinary/{api_key,api_secret}`, cloud `infinex`. Plan/credit headroom question pending with account owner (draft below). |
| Postiz | **A hosted instance exists**: daily ran against `https://api.postiz.com` (org hosted plan; PR157 `.env.example` notes it also holds the approved TikTok app). Resolves the "does Postiz exist anywhere" part of plan Open Question 3. |
| Kinovi | Account owner is Phoenix (per PR157 `.env.example`). |
| Remotion company license | Email draft below — pending send by a human. |

### Remotion license email (draft — send from an org address to hi@remotion.dev)

> Subject: Company license question — self-hosted renderMedia usage
>
> Hi Remotion team,
>
> We're <org legal name>, a company of <N> employees. We self-host Remotion (pinned 4.0.460) for internal video rendering on our own Kubernetes infrastructure — one existing product renders brand-card animations, and we're adding a second internal pipeline rendering short-form videos (CPU rendering via renderMedia, no Remotion Lambda, no Cloud Run).
>
> Could you confirm: (1) whether a single company license covers both products/pipelines under the same legal entity, (2) which plan fits self-hosted renderMedia at roughly <X> renders/day, and (3) whether any license already exists on file for our organization?
>
> Thanks!

### Cloudinary headroom question (draft — for the account owner)

> Our video pipeline will use Cloudinary (cloud `infinex`) for post-approval delivery only — roughly 600MB/day of mp4 uploads if everything ships (~215GB/yr cumulative). Two asks: (1) does the current plan's storage/bandwidth/credit headroom cover that, and (2) can we agree two lifecycle rules — delete delivery assets of approved-but-never-posted jobs after N days, and downgrade old posted assets to a 360p proxy after ~180d?

## U2 spike findings — provider × MITM

iron-proxy `header_allowlist` fix (add `user-agent`) landed in the working tree with a config-render regression test (91 tests pass). Takes effect after `just build-one api` (the base yaml is bundled into the api image; per-sandbox proxy ConfigMaps render from it).

**Spike ran 2026-06-13** from a scratch pod (`u2-spike`, since deleted) routing all egress through the existing `centaur-api-proxy` MITM (HTTPS_PROXY + the firewall CA), enforcement OFF but traffic *forced* through the proxy via HTTPS_PROXY so the MITM path is what's exercised. Cheap/read-only endpoints only (~$0.01 of fal TTS; **no** Kinovi i2v job, which is the ~$0.50 call). Note: the deployed proxy did NOT yet carry the U2 UA fix during the spike (it's working-tree only), so both Kinovi cases had UA stripped.

| Provider | Auth OK through MITM | Large multipart body OK | Notes |
|---|---|---|---|
| openrouter.ai | **200** GET /api/v1/models (487KB) | n/a (JSON) | auth header forwarded cleanly |
| queue.fal.run (TTS) | **200** submit + status COMPLETED + result | n/a | end-to-end TTS works; see fal URL contract below |
| rest.alpha.fal.ai → v3b.fal.media (storage) | **200** initiate | **200** — 25MB wav PUT in **7s** | the #1 plan risk (large bodies through MITM) — **CLEARED** |
| kinovi.ai (read endpoint) | **404** "Task not found" (reachable, not blocked) | — | see Kinovi finding below |
| api.postiz.com | **201** multipart mp4 upload (returns asset id) | **yes** (video/mp4 multipart) | auth = bare `Authorization: <key>` (no Bearer) |
| api.cloudinary.com | not spiked (key in 1Password, no local `op` CLI) | — | defer to U8; the signing-exception tool, not placeholder-swapped |

**Big result:** the MITM passes auth for every provider tested AND streams a 25MB body (PUT) and a multipart mp4 (POST) without trouble. The large-multipart-through-MITM risk (plan Risks table, "iron-proxy can't stream large multipart bodies") is **cleared** for the fal/Postiz shapes. (Cloudinary `upload_large` chunked still unproven — U8.)

**fal URL contract (binding on U7) — surfaced by a spike bug:** fal's submit response returns `status_url` and `response_url`, and their path **differs from the submit path** — submit goes to `queue.fal.run/fal-ai/minimax/speech-2.8-hd` but status/result come back as `queue.fal.run/fal-ai/minimax/requests/{request_id}[/status]` (the model suffix collapses to the app id `minimax`). Hand-reconstructing the poll URL from the submit path yields **405**. The `fal_tts`/`fal_image` tools MUST poll the `status_url`/`response_url` returned in the submit body, never reconstruct them. Submit body keys: `status, request_id, response_url, status_url, cancel_url, logs, metrics, queue_position` (note `cancel_url` — the U21 cancel-cascade kill path for in-flight fal jobs).

**Kinovi UA finding (contradicts a plan premise):** the plan/origin says "Kinovi is Cloudflare-fronted and 403s without a browser UA". The spike's read-only `GET /api/v1/jobs/recordInfo` returned a normal application **404 "Task not found"** both with and without a browser UA (and with UA stripped by the un-fixed proxy in both cases) — **no Cloudflare 403/challenge observed** on the reachable endpoint. Conclusion: the UA-allowlist fix is retained as a low-cost precaution (PR157's client deliberately sets a browser UA on every call, and the protected endpoint may be `createTask`, which the spike did not hit to avoid spend), but **the spike could not reproduce a UA-gated 403**. Validate against `createTask` when a real i2v job is run in U8/U15. PR157 endpoints: `GET /api/v1/jobs/recordInfo?taskId=`, `POST /api/v1/jobs/createTask`, base `https://kinovi.ai/api/v1`, auth `Authorization: Bearer`.

**Result-TTL (the U5 park-horizon input):** a TTL probe was recorded for the completed fal TTS job — `status_url` (auth'd, queue.fal.run) + `audio_url` (public CDN, v3b.fal.media), epoch 1781317339 (2026-06-13T02:22Z). **Re-fetch both later** to measure how long fal keeps (a) the queue result fetchable and (b) the CDN asset live — this bounds U5's "park on budget refusal" horizon. Not yet re-measured (needs a later check). audio_url: `https://v3b.fal.media/files/b/0a9e12fb/aj7LfgWYbGqQu4-w9avSQ_speech.mp3`.

**Enforcement-ON / air-gap check — correctly deferred:** U2's question ("do providers work through the MITM") is answered with enforcement OFF because traffic was forced through the proxy. The prod-fidelity check that a pod *cannot* reach external hosts *except* through the proxy (the air-gap) belongs to the renderer/runstore units (U9/U10/U14), which is where a coordinated enforcement-ON local window should happen. No enforcement flip or api roll was needed for Phase A.
