# Commit And Push Guide

Use this when a human or agent needs to save work locally or push it to GitHub.

Local commits and GitHub pushes are separate operations:

```text
edit files -> stage files -> local commit -> push commit to GitHub
```

## Current Remote

```bash
git remote -v
```

Expected remote for this repo:

```text
origin  https://github.com/infinex-dev/comms-factory.git
```

GitHub repo:

```text
https://github.com/infinex-dev/comms-factory
```

## Before Editing

Check where you are and what is already dirty:

```bash
git status --short --branch
git branch -vv
```

Rules:

- Do not revert or delete files you did not create.
- Do not run `git reset --hard`, `git checkout -- .`, or broad clean commands unless the human explicitly asks.
- Treat `.env`, `harness/.env.local`, `harness/harness.db`, `.next/`, `dist/`, and generated research reports as local state unless explicitly told otherwise.
- Prefer staging explicit paths, not `git add .`, when the tree has unrelated local work.

## Branches

Create a working branch before a meaningful change:

```bash
git switch -c <short-topic-name>
```

Examples:

```bash
git switch -c director-service-audit
git switch -c pipeline3-grounder-fix
git switch -c docs-handoff-update
```

If you are already on the right branch, do not create another branch just to
commit a tiny docs fix.

## Stage Files

Stage only the files that belong to your change:

```bash
git add README.md docs/ARCHITECTURE.md src/actor-memory.ts
```

Inspect exactly what will be committed:

```bash
git diff --cached --stat
git diff --cached --name-only
git diff --cached
```

If a file was staged by mistake:

```bash
git restore --staged <path>
```

That unstages the file without deleting the work.

## Pre-Commit Checks

Run the checks that match the change size.

For most code changes:

```bash
pnpm test
pnpm typecheck
```

For harness changes:

```bash
pnpm typecheck:harness
pnpm build:harness
```

For docs-only changes, at minimum:

```bash
git diff --cached --check
```

Before any GitHub push, run:

```bash
git diff --cached --check
git diff --cached --name-only -z | xargs -0 rg -n --no-heading "sk-ant-|BEGIN (RSA|OPENSSH|PRIVATE)|api[_-]?key\s*[:=]|webhook\s*[:=]|mysql://[^\s]+:[^\s]+@" || true
```

The secret scan is a tripwire, not a proof. Read any matches. Code that redacts
`parsed.password = ""` is fine; a real token or webhook URL is not.

## Local Commit

Commit locally after staging and checks:

```bash
git commit -m "Short imperative summary"
```

Good examples:

```bash
git commit -m "Vendor canonical Mirodan source bundle"
git commit -m "Add Pipeline 3 proof banner"
git commit -m "Document Director service handoff"
```

If this workstation's SSH signing key blocks non-interactive commits, either ask
the human to unlock the signing key or, for agent-created commits, use:

```bash
git commit --no-gpg-sign -m "Short imperative summary"
```

Mention unsigned commits in the handoff if signing is normally expected.

## Push To GitHub

After a local commit, push the current branch:

```bash
git push -u origin HEAD
```

If the branch already tracks a remote branch:

```bash
git push
```

To intentionally update GitHub `main` from your current branch:

```bash
git push origin HEAD:main
```

Only do that when the human clearly wants the current branch to become `main`.
Otherwise push a topic branch and open a PR.

## Create A PR

After pushing a topic branch:

```bash
gh pr create --fill
```

If the PR needs a precise description, write it yourself:

```bash
gh pr create \
  --title "Add Director service audit surface" \
  --body "Summary:
- Adds standalone /director harness page
- Keeps Director context-dumb and generation-free
- Adds tests for light rollup"
```

## Existing GitHub Repo Creation

This repo already exists. Do not recreate it.

If working in a fresh local clone that somehow has no remote:

```bash
git remote add origin https://github.com/infinex-dev/comms-factory.git
```

Then push:

```bash
git push -u origin HEAD
```

## What Not To Commit

Do not commit:

- `.env`
- `harness/.env.local`
- `harness/harness.db`, `*.db-wal`, `*.db-shm`
- `.next/`
- `node_modules/`
- `dist/`, `.remotion/`, render outputs
- local scratch files like `_dirtest.ts`
- generated research HTML/JSON reports unless they are explicitly part of the deliverable
- unrelated handover notes unless the human asks to publish them

## Repo-Specific Notes

- `third_party/mirodan/` is intentionally committed. Actor/Director memory needs
  those canonical sources in a fresh clone.
- The Mirodan PDF is about 50 MB. GitHub accepts it but may warn that Git LFS is
  recommended. Do not remove it without replacing the source-index mechanism.
- `src/actor-memory.ts` must not point at `/Users/opaque/Downloads` or other
  machine-local paths.
- The harness default path is Pipeline 3. Keep `HARNESS_GENERATOR_ARCH=actor`
  unless testing legacy rollback.
- Never auto-post. Ship gate remains human-approved.

## Handoff Note Template

When reporting back after a commit/push, include:

```text
Commit: <sha> <subject>
Branch: <branch>
Pushed: yes/no, <remote branch or PR URL>
Checks: <commands run and pass/fail>
Not included: <known local/untracked files intentionally left out>
```
