# Video capabilities build — execution handoff

You are implementing a planned, reviewed multi-week program: porting the infinex-xyz/agents PR #157 "daily" short-video pipeline onto centaur (provider tools + an air-gapped media-renderer + a runstore artifact store + overlay durable workflows, operated from Slack).

## Where you are
- **Worktree:** this checkout, branch `feat/video-capabilities`, based on `main` (which already has comms-factory vendored — the plan extends it).
- **Do not touch** the sibling `../centaur` checkout (a different branch, unrelated work).

## Read first, in order
1. `CLAUDE.md` and `AGENTS.md` (repo root) — the canonical dev guide, commands, and the hard rules below.
2. `docs/plans/2026-06-12-001-feat-video-capabilities-build-plan.md` — **THE PLAN. Your source of truth.** 22 units (U1–U22) across 5 phases, each with files, patterns to follow, test scenarios, and verification. Read it in full before writing code.
3. `docs/plans/PLAN-2026-06-11-video-capabilities.md` — the architecture/origin doc the plan references (the "why" behind every decision; consult when a unit's rationale is unclear).

## Source material (pinned)
The pipeline being ported lives in infinex-xyz/agents, branch `feat/daily-harness-autonomy-plan`, **pinned commit `09787d358ae871c3673c2ff8fd9b8bd7415ecfa6`**. Clone it read-only before porting any unit:
```
git clone https://github.com/infinex-xyz/agents.git /tmp/agents-pr157 && \
  git -C /tmp/agents-pr157 checkout 09787d358ae871c3673c2ff8fd9b8bd7415ecfa6
```
When you vendor code (U13 prompts/validators, U14 Remotion templates, kinovi/postiz clients), put the source SHA in the module docstring.

## How to execute
- Use the **executing-plans** workflow (or `/ce-work` on the plan path). Work **unit by unit in dependency order** — the plan's mermaid graph and each unit's `Dependencies` field are authoritative. Check off `- [ ]` boxes as you complete units.
- **Start with Phase A spikes (U1, U2, U3)** — they de-risk everything downstream and produce artifacts the later units consume (the iron-proxy user-agent fix, the Remotion image recipe, the capacity/arch audit). Then **Phase B (U4, U5)** — the unbackfillable capture contract (migrations + producer return contract); get these right before any production rows are written.
- One PR per phase to `main` (Phase A spikes can be a docs/config PR; Phase B is the migrations PR; etc.). Conventional commits. End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Request review before each phase merges.

## Non-negotiable process rules (from CLAUDE.md — violating these breaks prod or wastes days)
- **Test locally E2E before pushing — always.** `just build-one <svc>` → `just deploy` → real request. Tools hot-reload, so tool-plugin changes can be `curl`-tested from inside the API deploy without a rebuild.
- **Never touch the deploy box.** Prod changes reach it via `git push` → GitHub Actions. SSH in only to read logs, never to mutate.
- **Grow the podman VM disk BEFORE building the renderer image** (`podman machine set --disk-size N`, VM stopped) — the chromium-class image will trip kubelet disk-pressure GC otherwise. This is U1/U3 work; do not skip it.
- **k3s ENFORCES NetworkPolicy** locally (prod CNIs may not) — test the renderer→runstore carve-out and the air-gap with enforcement ON at least once per service-introducing unit (U9/U10/U14).
- **Secrets don't hot-reload** — after patching a k8s Secret, `kubectl rollout restart` the consumer.
- Images must import into k3s containerd under the `k8s.io` namespace as `docker.io/library/centaur-<svc>:latest` or pods `ImagePullBackOff`.
- E2E gate-driving recipe (lift verbatim for U15/U21/U22 workflow tests): drive gates headlessly via `POST /workflows/events` with the compact-ref payload; `SLACKBOT_API_KEY` required (localhost bypass does NOT cover `/workflows/*`); `slack.user_id` must match the input `user_id`; first-write-wins on consumed correlations.

## Decide with the human BEFORE U15/U21 (4 open questions, in the plan's "Deferred to Implementation")
These block the talking-head workflow units; surface them and get answers first:
1. **Rating-capture UX** — base gate modal is single-input; pick button-row vs modal convention vs drop-it (changes gate layout + the U5 event payload).
2. **`video runs` reply format vs Slack's 50-block cap** — truncation / pagination / compact table.
3. **E2E provisioning + spend** — who provisions fal/kinovi/openrouter/cloudinary dev keys for local k3s, whether a Postiz instance exists anywhere, the accepted per-run E2E spend, and whether a stub-provider cheap-mode is a planned artifact.
4. **Phase-C byte home for brand-card mp4s** — accept the brand-card lane as untraced until runstore lands (and scope R4's "day one" to the talking-head lane), or pull a minimal runstore slice forward.

## Governance invariants (default OFF unless the human explicitly overrides — see R7/§9)
- The ffmpeg clean chain (pixel disruption + iPhone-stock codec posture) ports IN FULL — distribution-critical, not a governance item.
- OFF by default: the exiftool Apple-Keys atom injection (false "shot on iPhone" provenance) + CompressorName patch; `isAiGenerated` ships honest (`true`); human ship gate before every Postiz draft; never auto-post.
- LLM-authored TSX executes ONLY in the air-gapped renderer (no secrets, egress only to runstore).

## When you finish a phase
Update `CLAUDE.md` with durable learnings (the chart volume/probe pattern, the NP carve-out pattern, the Remotion-in-k8s recipe) per the repo's living-document rule, and consider seeding `docs/solutions/`.

Start by reading the three docs above, then report your plan for Phase A before running it.
