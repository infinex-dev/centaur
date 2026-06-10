# Handoff prompt — dogfood comms-factory: Centaur opens GitHub PRs (web-app copy + self)

> Paste below the line into a fresh agent session started in the centaur repo (`/Users/rambo/.superset/projects/centaur`). Investigation + design first; this is a build task, but most of the machinery already exists — the work is *composition*, not new infrastructure.

---

## Goal

Dogfood the comms-factory by closing the loop from **copy generation → a real GitHub PR**. Two targets:
1. **Web app copy** — Centaur generates grounded, on-voice copy via comms-factory and opens a PR against `infinex-xyz/platform` (the web app) updating the actual product copy.
2. **Changes to itself** — Centaur opens a PR against its own repo `infinex-dev/centaur` (self-modification dogfood — e.g. updating its own docs/marketing copy).

The point: prove the comms-factory produces copy good enough to ship as a reviewable PR, and prove Centaur can drive a generate→edit→PR loop end to end.

## What already exists (do NOT rebuild these)

- **Copy generation** — the `comms_factory` overlay tool (`overlays/comms-factory/tools/comms_factory/client.py`): `validate / audit / ground / build_card / generate`. Grounds on `repo_context` + `websearch`. Already deployed and working (validated E2E).
- **Gated generation workflow** — `overlays/comms-factory/workflows/comms_release.py`: brief → ground → facts gate → ReleaseCard gate → candidate gate → `ready_to_ship` (terminal at line ~547, `no_external_posting: True` — today it just marks copy ready in Slack).
- **PR creation in the sandbox** — Centaur's coding agents already open PRs. `services/sandbox/SYSTEM_PROMPT.md` (lines ~66-67, ~174): `git-branch <org/repo>` makes a writable clone at `~/branches/<org>/<repo>`; the agent commits, pushes, and runs `gh pr create`. `services/sandbox/git-branch.sh` is the helper.
- **GitHub auth in the sandbox** — `services/sandbox/entrypoint.sh:212-216`: when `GITHUB_TOKEN` is set it configures `git` credential helper + `gh auth login --with-token`. So `git push` / `gh pr create` work from inside a sandbox.
- **Repo mounts** — the repo-cache (`contrib/chart/templates/repo-cache.yaml`) clones configured repos read-only into `~/github/<org>/<repo>` for sandboxes; `git-branch` turns one into a writable branch. Configured repos come from `overlays/comms-factory/repo-context.repositories.txt` (currently `infinex-xyz/platform`, `infinex-xyz/agent-platform`).

## Guardrail framing (important — keep R1 intact)

comms-factory's hard rule is **no auto-post to X / web / in-product** (`comms_release` returns `no_external_posting: True`). **A pull request does not violate this** — a PR is a *proposal* gated by human review + merge, not auto-publishing. So the dogfood path is compliant *as long as it stops at "PR opened"* and never merges or deploys on its own. State this explicitly in whatever you build; the PR + review IS the ship gate.

## What to build — recommended shape

**Shape A — skill-driven agent (do this first; agent-native, no new plumbing).**
A single Centaur sandbox agent composes the two existing capabilities. Add an overlay skill (overlays carry `.agents/skills/`) — e.g. `overlays/comms-factory/.agents/skills/comms-to-pr/SKILL.md` — that guides the agent to:
1. Take a request (`@centaur ship copy for <feature> on the web app: <brief>`).
2. Generate grounded, on-voice copy via the `comms_factory` tool (validate → ground → build_card → generate), surfacing the candidate in Slack for approval.
3. `git-branch <target org/repo>` (web app or centaur itself), locate the copy, apply the approved text, commit on the agent branch.
4. `gh pr create` and post the PR URL back to Slack. **Stop there.**

This needs no workflow→agent spawning — it's one agent using `comms_factory` as a tool plus the existing git-branch/gh flow.

**Shape B — productionized workflow (later).** Extend `comms_release` so that after `ready_to_ship`, a new "ship to PR" gate hands the approved `final_copy` + a target spec (repo + file location) to a coding-agent execution that opens the PR. This requires a way for a workflow to spawn/drive a sandbox agent execution — check whether `workflow_engine` / the API exposes that (it has `ctx.call_tool`, `ctx.step`, `ctx.wait_for_event`; agent-spawning may need a tool or the `/agent/*` API). Do this only after Shape A proves the loop.

## Gaps to close (investigate + configure)

1. **Target repos must be in the repo-cache** so the sandbox can `git-branch` them:
   - `infinex-xyz/platform` — already cached (in `repo-context.repositories.txt`). ✓
   - `infinex-dev/centaur` (itself) — **NOT cached; add it** so self-PRs work.
2. **GitHub token write/PR scope** — verify the `GITHUB_TOKEN` the sandbox gets can **push branches + open PRs** on the targets. The read-only repo-cache/clone token may not be sufficient; the comms research key (`bundle:research`) is read-only and unrelated. Confirm which token reaches the sandbox `entrypoint.sh` and that it has `repo`/PR scope on `infinex-xyz/platform` and `infinex-dev/centaur`. This is the most likely blocker.
3. **Where the web-app copy lives** — investigate `infinex-xyz/platform`: is product copy in i18n/locale files, MDX/content, or inline component strings? The agent needs to know where to apply generated copy. Capture the convention in the skill so the agent targets the right files.
4. **The skill itself** — write `comms-to-pr/SKILL.md` with: the generate→approve→git-branch→edit→PR steps, the copy-location convention, the R1 guardrail (PR not publish), and a clear `description:` trigger so it activates on copy-shipping requests.

## Verify (a real PR, to a safe target)

- End-to-end on the local stack (`just comms-factory-up` from `feat/comms-factory-overlay`): `@centaur` ship a small copy change → confirm grounded copy is generated, a branch is pushed, and a **draft** PR opens against the target with the PR URL posted to Slack. Use a low-stakes copy string first.
- Run the self-target too (a doc/copy tweak PR to `infinex-dev/centaur`) to prove the "changes to itself" path.
- Confirm nothing merges or posts externally — the loop stops at "PR opened."

## Context / where things live

- Centaur repo: `/Users/rambo/.superset/projects/centaur`, branch `feat/comms-factory-overlay` (the comms overlay lives here; PR #5). The generic connection point is the base branch `feat/external-service-connection-point` (PR #4).
- Web app: `infinex-xyz/platform`. Centaur ("itself"): `infinex-dev/centaur`.
- The comms overlay: `overlays/comms-factory/` (tools, workflows, repo-context config). Sandbox/PR mechanics: `services/sandbox/{SYSTEM_PROMPT.md,git-branch.sh,entrypoint.sh}`.
- Deploy/config: `contrib/scripts/deploy-local.sh` (the `--with-comms-factory` path builds repoCache from `repo-context.repositories.txt`); `contrib/chart/templates/repo-cache.yaml`.

## Why this matters

This is the real test of the comms-factory overlay: not just "copy appears in Slack," but "copy ships as a reviewable PR to the product." It also exercises the full Centaur stack (Slack → workflow/agent → comms-factory tool → sandbox git/PR) on a genuine, useful task — and the self-PR path is Centaur improving its own copy, the tightest dogfood there is.
