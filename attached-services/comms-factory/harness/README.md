# comms-factory harness

Local operator workbench for Pipeline 3.

The harness is a Next.js app on `http://localhost:3210`. It wraps the pipeline
in `../src/`, persists every stage to local SQLite, and gives the operator a
place to approve, edit, reject, retry, and ship copy.

It is a training/debug instrument, not the permanent production product.

## Run

From repo root:

```bash
pnpm --dir harness install
pnpm db:init
pnpm dev:harness
```

Or from this directory:

```bash
pnpm install
pnpm db:init
pnpm dev
```

Open `http://localhost:3210`.

## Environment

Copy the example and fill in local values:

```bash
cp .env.example .env.local
```

Minimum live setup:

```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key>
HARNESS_GENERATOR_ARCH=actor
```

Pipeline 3 actor/director runs require a live API key. The legacy generator can
be forced into stub mode with `HARNESS_ALLOW_STUB_GENERATOR=1`, but Pipeline 3
does not silently fall back to fake Actor/Director output.

## Workflow

1. Create a card from a release brief.
2. Run the grounder and approve/edit/reject facts.
3. Build and approve the release card.
4. Run generator. By default this uses Pipeline 3:
   `orchestrateActorDirectorWithRetries()`.
5. Review Pipeline 3 proof, live run events, Actor table work, prompt/source
   index, Director audits, candidates, and final picks.
6. Approve/edit/reject/retry candidates.
7. Approve final picks at the ship gate. No auto-posting.

## Important Files

| Path | Purpose |
|---|---|
| `app/page.tsx` | Queue, agreement dashboard, positioning spine |
| `app/cards/[id]/page.tsx` | Four-stage card detail workflow |
| `app/director/page.tsx` | Standalone Director console |
| `app/actions/research.ts` | Card creation, grounder run, fact decisions |
| `app/actions/card.ts` | Release-card build/edit/approval |
| `app/actions/director.ts` | Director-as-service harness action |
| `app/actions/generate.ts` | Pipeline 3 run and persistence |
| `app/actions/ship.ts` | Final picks and ship destinations |
| `lib/schema.sql` | Authoritative local SQLite schema |
| `lib/queries.ts` | Read model for UI pages |
| `components/AttemptPanel.tsx` | Actor/Director attempt visibility |
| `components/CandidateCard.tsx` | Candidate review and audit details |

## Local State

Ignored by git:

- `.env.local`
- `harness.db`
- `harness.db-wal`
- `.next/`

The DB stores prompts, transcripts, operator edits, facts, and copy candidates.
Treat it as sensitive local state.

## Current Status

Working:

- branch-aware grounder action
- fact decisions and release-card editor
- Pipeline 3 default generation path
- Actor attempts, warmups, transcripts, source indexes, run events
- blind Director audits and split gates
- Pipeline 3 proof banner
- candidate decisions, edit diffs, semantic edit capture
- final picks and local ship gate
- positioning rollup from latest Actor table work

Still local/MVP:

- no auth
- no production DB
- no deployed service transport
- no Slack or MCP surface
- no multi-user workflow
