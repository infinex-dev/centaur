# Codex spec — Package 2-B: platform PR-emission backend

Build the backend that emits a **review-ready PR** to the Infinex platform from an approved comms package. The harness "Emit PR" button (built separately) calls this. It **opens a PR for human approval — never merges, never auto-posts.**

## Ground rules
- **Work in a dedicated git worktree** so you can't collide with concurrent work. From the comms-factory repo: `git worktree add ../cf-pkg2b -b pkg2-b-emission`. Do ALL edits + commits there. Commit your work as one commit when done + tests pass; the operator merges the branch. Do not touch the main checkout.
- TypeScript (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess). `pnpm test` + `pnpm typecheck` green.
- **No `gh pr merge`, no push to `main`, no auto-post. Ever.** Open PR only.

## What to build
`src/emit-platform-pr.ts` (+ CLI `scripts/emit-pr.ts`) exporting:

```ts
emitLaunchPR(pkg: LaunchPackage, opts: EmitOpts): Promise<{ prUrl: string | null; plannedDiff: string }>
```
- `LaunchPackage = { changelogSlug: string; changelogMd: string; roadmapTick?: { nodeName: string; parentName?: string }; featureCard?: { dataTsEntry: string } }`
- `EmitOpts = { platformRoot?: string; dryRun?: boolean; branch?: string }`

### The git-safe flow (the operator's "stash so we don't fuck ourselves")
1. Platform clone at `process.env.PLATFORM_ROOT ?? ~/Sites/infinex-xyz/platform`.
2. `git fetch origin main`. Create the PR branch **off `origin/main`** in a **throwaway worktree** of the platform clone (`git -C <platform> worktree add /tmp/cf-emit-<ts> -b <branch> origin/main`) — so the operator's existing platform working tree is **never touched / stashed / clobbered**.
3. Write the changelog to `apps/content-app/content/blog/<changelogSlug>.md`.
4. Roadmap tick: read `apps/public-website/src/app/(site)/roadmap/data.ts`, find the `TreeNode` by `nodeName` (and `parentName`), set `status: 'done'`, reorder it above its `in_progress` siblings — **structured TreeNode edit, not a text patch** (parse → mutate → re-serialize, or a precise AST/structured replace). Unit-test this.
5. Optional `featureCard` → append to `FEATURES_COPY[]` in `apps/public-website/src/app/(site)/features/data.ts`.
6. Commit on the PR branch in the throwaway worktree; `git push -u origin <branch>`; `gh pr create --title <changelog title> --body <summary + "human-approve, DO NOT merge">`. Return `prUrl`.
7. Clean up the throwaway worktree. **Never merge.**

### `dryRun: true` (default the harness uses for preview)
Do steps 1–5 in the throwaway worktree, compute `git diff` as `plannedDiff`, **skip push + PR create**, return `{ prUrl: null, plannedDiff }`, remove the worktree. This lets the harness preview the exact changes before the operator approves the real emit.

## Tests
- Roadmap structured-edit: given a sample `data.ts`, ticks the named node + reorders, leaves siblings intact. +/- cases.
- `emitLaunchPR({...}, { dryRun: true })`: produces a non-empty `plannedDiff` containing the new blog file + the roadmap status change, and makes **no** network/`gh` calls.

## Acceptance
- Real run opens a PR off latest `main` and returns its URL; dry-run returns the planned diff with no GitHub calls; the platform clone's existing working tree is untouched; roadmap-edit test passes; **no code path can merge or push to main.**
