# Remotion-in-cluster image recipe (U3 spike → U14 input)

Deliverable of plan unit U3. The media-renderer (U14) is an **air-gapped** pod that
renders Remotion compositions and executes LLM-authored TSX — so its image must bake
everything (no runtime downloads) and run under the cluster's hardened pod security.
This doc is the measured recipe U14 builds from.

Spiked 2026-06-13 on local k3s (native inside the podman VM).

> **ARCH CAVEAT — read first.** Every timing/size here is **arm64** (Apple Silicon VM).
> **Prod is amd64** (`.github/workflows/publish-images.yml` builds on ubuntu-latest →
> linux/amd64). The Dockerfile below is arch-portable *when built natively on the target
> arch* (CI builds amd64 natively, so it fetches the amd64 Chrome Headless Shell). Re-measure
> sizes and render wall-clock on amd64 before sizing prod requests/limits.

## Recommendation: purpose-built `node:22` base (candidate B), NOT the sandbox base

| | (A) sandbox-base-derived | (B) purpose-built node:22 |
|---|---|---|
| Base | `centaur-agent:latest` (Ubuntu 24.04 + full agent toolchain) | `node:22-bookworm-slim` |
| Final image size (arm64) | **6.89 GB** | **1.64 GB** |
| Build wall-clock | 70s *on top of* the 5.9GB base (+~4min to export the base back from containerd if pruned) | **112s** clean (`--no-cache`), incl. 88MB Chrome shell download |
| Renders correctly under hardened pod | yes | yes |
| Attack surface for LLM-TSX execution | carries gh/uv/bun/git + agent entrypoint the renderer never needs | minimal — node + chrome + ffmpeg + fonts only |

**Pick B.** It is ~4× smaller (faster cold image pull, less disk-pressure risk — the 5.9GB
agent image already tripped kubelet GC once per CLAUDE.md), and it gives the air-gapped pod
the smallest possible attack surface, which matters precisely because this is the one pod that
executes LLM-authored code. This **overrides the origin doc's pre-spike assumption** ("the image
can start from the sandbox base"; PLAN-2026-06-11 §4 Ops) — that assumption predated this
measurement; the size + security delta settles it for B. The only thing the sandbox base gave
"for free" (ffmpeg + node) is two `apt-get`/base lines in B, so nothing is lost.

## The Dockerfile (candidate B — the U14 starting point)

```dockerfile
# media-renderer base. Build NATIVELY on the target arch (CI = amd64) so
# ensureBrowser() fetches the matching Chrome Headless Shell.
FROM node:22-bookworm-slim

# Chrome Headless Shell runtime libs + ffmpeg + fonts (incl. CJK + emoji so
# non-latin captions don't render tofu). dumb-init for clean PID1 signal handling.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig fonts-liberation fonts-noto-core fonts-noto-cjk fonts-noto-color-emoji \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libatspi2.0-0 libx11-6 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libgbm1 libcairo2 libpango-1.0-0 \
    libasound2 libxshmfence1 libx11-xcb1 libxcb1 libexpat1 \
    ca-certificates procps dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

WORKDIR /app/remotion

# Deps first (layer cache); exact lockfile install. Pin Remotion 4.0.460 in U14
# to match comms-factory (daily's project pins 4.0.458 — see version note below).
COPY remotion-app/package.json remotion-app/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Pre-bake Chrome Headless Shell at BUILD time (NO runtime download — the pod is
# air-gapped) and HARD-FAIL the build if the binary isn't present + executable.
# NOTE: the binary is named `headless_shell`, NOT `chrome-headless-shell`.
RUN node --input-type=module -e "import {ensureBrowser} from '@remotion/renderer'; await ensureBrowser(); console.log('ensured');" \
    && CHROME="$(find /app/remotion/node_modules/.remotion -type f -name 'headless_shell' | head -1)" \
    && test -n "$CHROME" && test -x "$CHROME" && "$CHROME" --version

COPY remotion-app/ ./
RUN chown -R node:node /app/remotion
USER node
ENV HOME=/tmp
ENTRYPOINT ["dumb-init", "--"]
CMD ["sleep", "infinity"]   # U14 replaces with the job-API server
```

Build/import mechanism (reuse `contrib/scripts/deploy-local.sh`'s pattern):
`podman build` on the Mac → `podman save … | k3s ctr -n k8s.io images import -` inside the VM,
under `docker.io/library/<name>:<tag>`, chart refs bare name + `IfNotPresent`.

## Hardened pod security — what works (the compensating-control finding)

Chrome runs fine under the **full hardened posture** the air-gap threat model requires. Verified
from `/proc` during live renders:

- `securityContext`: `runAsNonRoot: true`, `capabilities.drop: [ALL]`, `allowPrivilegeEscalation: false`, **`seccompProfile: {type: RuntimeDefault}}`** — **no seccomp/caps denials, no crashes.** RuntimeDefault is sufficient; no custom seccomp profile needed. (One benign log line under multi-process: `InitializeSandbox() called with multiple threads in process gpu-process` — informational, render unaffected.)
- `@remotion/renderer` passes **`--no-sandbox --disable-setuid-sandbox` by default** — no `chromiumOptions` needed (required since caps are dropped).
- It also passes **`--disable-dev-shm-usage` by default** → Chromium uses `/tmp`, not `/dev/shm`. Measured `/dev/shm` use across a full 60s render: **0 bytes**. So the classic "64Mi /dev/shm crashes Chromium" trap **does not apply at this Remotion version**. Still mount a Memory-medium emptyDir at `/dev/shm` (cheap insurance) but sizing is a non-issue; **`/tmp` must be writable** (Chrome profile + frame jpegs live there) — mount an emptyDir at `/tmp` for the renderer, sized for frame spillage.
- GPU: software ANGLE/SwiftShader auto-selected (`--use-angle=swiftshader-webgl`); no `--gl` flag needed, no GPU required.

Working pod spec (verbatim, the U14 baseline):

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000          # `node` user in node:22 base
  runAsGroup: 1000
  allowPrivilegeEscalation: false
  capabilities: { drop: ["ALL"] }
  seccompProfile: { type: RuntimeDefault }
volumeMounts:
  - { name: dshm, mountPath: /dev/shm }
  - { name: scratch, mountPath: /tmp }      # frame jpegs + chrome profile
volumes:
  - name: dshm
    emptyDir: { medium: Memory, sizeLimit: 512Mi }
  - name: scratch
    emptyDir: {}                            # size for frame spillage; U14 'remotion-public/' staging also here
```

## Render performance (arm64, directional)

Composition: daily's `DailyNews` (vendored from PR157 `remotion/`), 1080×1920 portrait @30fps.
Pod: cpu req=limit **2**, mem req=limit **4Gi**. concurrency=2.

| Render | Frames | Render phase | Stitch phase | Total wall | Effective fps | Peak mem |
|---|---|---|---|---|---|---|
| 2-scene smoke | 150 (5s) | 8.2s | 2.8s | ~12s | ~18 fps | — |
| **Full 7-scene** | **1800 (60s)** | **122.2s** | **37.1s** | **160.6s** | **~14.7 fps** | **~1.16 GB** |

- bundle() ≈ 1.1s, selectComposition ≈ 0.2s (negligible vs render).
- Heavier templates (list/stat/CJK+emoji card) render slower than simple cover/card — the 7-scene mix is the realistic number, not the smoke render.
- Output verified: `ffprobe` → h264 1080×1920 + aac, 60.03s, 12.8MB. (pix_fmt came out `yuvj420p` full-range; U14's ffmpeg clean chain re-encodes to `yuv420p` anyway.)
- CJK + emoji rendered without tofu thanks to `fonts-noto-cjk` + `fonts-noto-color-emoji` — keep both in the image.
- **`--concurrency` is hard-capped by the pod's CPU limit — this is the key tuning rule.** Remotion uses `os.availableParallelism()` (cgroup-quota-aware, *not* `os.cpus().length`), so under `resources.limits.cpu: 2` the max usable `--concurrency` is **2**; passing `--concurrency 4` is **rejected outright**: `Error: Maximum for --concurrency is 2 (number of cores on this system)`. Sweet spot = `concurrency == CPU limit`: on a 450-frame config, **c2 was ~27% faster than c1** (14.65 vs 11.51 fps) — the second core earns its keep. To render faster you must raise the CPU limit AND concurrency *together*; U14 should set `concurrency = floor(limits.cpu)` and size the limit against amd64 prod, not guess a fixed number. (Cleaner uncontended sweep number: 15s/450f at c2 ≈ 14.6 fps; the 60s figure above ran under shared-node contention so it's a pessimistic lower bound.)

## Operational findings that bind U14's design

1. **Renders MUST be driven async (fire-and-poll), never over one long synchronous channel.** The `kubectl exec` streaming session (and by analogy any single long-held request) **severs at ~4–5 min** in this tunneled k3s; the sever SIGKILLs the in-pod subtree, orphaning Chrome children. Confirmed NOT an OOM (cgroup `oom_kill 0`, peak 1.16GB << 4Gi). This matches the plan's async-tools decomposition: U14's job API must be submit→poll (`POST /render` → job_id, `GET /jobs/{id}`), with the workflow polling via `ctx.sleep` — exactly U14's spec. A 60s render at ~160s wall already exceeds many sync timeouts.
2. **A one-off cold-start hang was observed and did NOT reproduce.** The first warmup render (launched moments after the VM's post-disk-grow restart) sat at `about:blank`, 0% CPU, ~19 min, no progress. A clean re-test on a freshly recreated pod rendered Cover-still (5s), a 2-scene video (12s), and the full 60s video (160s) without issue. Treat as cold-start/VM-settling flakiness, not a systemic block — but U14 should set a render-job watchdog (kill + re-dispatch on no-frame-progress within N minutes; renders are spend-free per the plan's flow-gap-9 re-dispatch contract).
3. **Single-node binpacking unit = 4Gi/render.** This node has 7.7GiB allocatable; baseline stack reserves ~4.2GiB → **only one 4Gi render pod fits locally at a time** (a second stays `Pending: Insufficient memory`). Moot on multi-node amd64 prod, but size prod nodes as `4Gi × max-concurrent-renders + system overhead`, and bound the render queue accordingly (U14's bounded-queue + 429 contract).

## Version note

daily's `remotion/` project pins **Remotion 4.0.458** (used for this spike — what the source
ships). comms-factory pins **^4.0.460**. U14 should standardize on **4.0.460** to match the
existing prod product and the company-license posture; the API surface used here
(`bundle`/`selectComposition`/`renderMedia`/`ensureBrowser`) is stable across that patch range.
