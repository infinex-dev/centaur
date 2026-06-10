# Testing And Verification

Use this before pushing or handing the repo to another engineer.

## Root Pipeline

```bash
pnpm test
pnpm typecheck
```

What this covers:

- release-card schema behavior
- deterministic validator rules and claim tripwires
- generator contracts
- legacy orchestrator behavior
- active validator glue
- fact-grounder helpers
- Centaur native-tools client (`callTool`) transport, typed errors, and redaction
- logical-tool → native `{tool, method}` mapping, error handling, and evidence capture
- Actor/Director contracts and retry behavior
- repo-local Mirodan source index: chapters 1-4, combined reference, PDF, and
  source-location note must all exist under `third_party/mirodan/`

Actor/Director tests use injected clients or parsing fixtures. They should not
require a live API key.

## Harness

```bash
pnpm typecheck:harness
pnpm build:harness
```

What this covers:

- Next.js type generation
- server action imports across the `@pipeline/*` alias
- UI and persistence type compatibility
- production build sanity for the local harness app

## Service API

```bash
pnpm service:test
```

What this covers:

- service auth gates
- blind `/audit`
- versioned `/ground` capability contract blocking behavior
- operator-facts-only grounding path
- `/build-card` and `/generate` fact gates

## Local Smoke Test

With `.env` configured:

```bash
pnpm db:init
pnpm dev:harness
```

Open `http://localhost:3210`.

Smoke path:

1. Create a card from a short release brief.
2. Run the grounder.
3. Approve at least one fact.
4. Build and approve the release card.
5. Run generator.
6. Confirm the Pipeline 3 proof banner is present and passing.
7. Open an attempt and confirm Actor prompt, source index, transcript, table
   work, Director audit, and candidates are visible.
8. Approve or edit one candidate and confirm a final pick appears in Ship.

## CLI Pipeline 3 Smoke Test

```bash
pnpm generate:actor -- --card=cards/hyperliquid-spot-unified-2026-05-29.json --channels=x,web
```

This path bypasses the harness DB. Use it when debugging the core Actor/Director
loop or when the local SQLite native dependency is stale.

## No-Secret Check

Before pushing:

```bash
git check-ignore -v .env harness/.env.local harness/harness.db harness/harness.db-wal
git status --short
```

Expected:

- env files and DB files are ignored;
- generated `.next/`, `dist/`, and Remotion outputs are ignored;
- no API keys or local DB files are staged.

## Known Live Dependencies

Production attached-service runs need:

- `ANTHROPIC_API_KEY`
- network access to Anthropic
- `CENTAUR_BASE_URL` (Centaur native tool plane; a mock `/tools` server for local dev)
- `CENTAUR_TOKEN` scoped to a read-only research tool bundle (never a broad/admin token)

Production grounding should not need `PLATFORM_ROOT`, GitHub CLI auth, ProjectJin,
agent-browser, local JSON API allowlists, Slack tokens, GitHub tokens, or a
broad/admin Centaur token.

Local-dev fallback runs may intentionally use local source modules and their envs
(`PLATFORM_ROOT`, `PROJECTJIN_BIN`, etc.). Tests should not require those live
dependencies unless a test is explicitly marked as an integration test.
