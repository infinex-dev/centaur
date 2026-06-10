# Generalized partner-API grounding + harness approval gate

**Date:** 2026-06-01
**Status:** approved (built same session)
**Origin:** debugging "grounder won't surface Collector Crypt's Pokemon/One Piece/sports-card breakdown." Six nested fixes got the data out of the branch *docs*; this spec removes the deeper over-specialization: live partner-API grounding was hardcoded per-partner (Hyperliquid only).

## Problem

The grounder reaches a partner's live data only when the prompt contains a hand-written recipe (Hyperliquid: exact endpoint, body, interpretation rule) AND the host is in a 3-entry `fetch_json_api` allowlist (`api.hyperliquid.xyz`, two Polymarket hosts). Every *new* launch partner — Collector Crypt being the first phygital/NFT case — starts with zero live-data capability and falls back to whatever `.md` an engineer happened to write. That doesn't scale to autonomy: each partner needs hand-wiring.

## Principle

**The integration code is the recipe.** When we build a partner into Infinex, our branch code calls that partner's API — real base URL, real read endpoints, real params. The grounder already discovers the host (e.g. `api.collectorcrypt.com`). It should grep the branch for that host / its client, learn the read calls our own code makes, replay them, and record what they expose. Hyperliquid stops being a special case and becomes one worked example of the general move. No per-partner recipe.

## Decisions (locked)

1. **Allowlist = hosts we integrate.** Drop the hardcoded list as the *gate*. A host is auto-callable if a grep of the resolved branch confirms we reference it (code or docs). Base list (hyperliquid/polymarket) kept only as always-on extras. Operator-approved hosts also pass. Unknown host not in our code → not auto-called → approval gate.
2. **Read-only, no secrets.** Grounder may replay only read/inspect calls; never mutating; never sends platform credentials. Auth-required read it can't satisfy → fall back to docs (or gate).
3. **Approval gate — harness asker, async (no pause/resume).** Every intended `fetch_json_api` call is classified. Read-only + in-code/approved host → call now, autonomously. Else → don't call; emit a structured `approval_request {host,url,reason}`. The harness (localhost:3210) shows a pending-approvals panel; operator approves → host persists in `approved_api_hosts`; a re-run executes the now-approved calls. Slack later = a second asker on the same seam.

## Components

**`src/research-tools.ts`**
- `ApiApprovalRequest { host; url; reason }`; `ResearchToolResult.approvalRequest?`.
- `gateJsonApiHost(input, {ref, approvedHosts})`: https-only; allow if base-allowlisted ∪ approvedHosts ∪ `hostAppearsInBranch(host, ref)` (grep); else return content `APPROVAL_NEEDED: …` + `approvalRequest`. Move host-gate out of the inner switch into the wrapper so it can emit the request.
- `executeResearchToolCall(name, input, id, ref?, approvedHosts?)` — optional 5th param (backward-compatible; `validator-active.ts` uses it as a default executor).

**`src/fact-grounder-llm.ts`**
- `FactGroundingOptions.approvedHosts?`; `FactGroundingResult.approval_requests?`; `GrounderTraceEvent` gains `approval_request`.
- Loop collects `approvalRequest`s from tool results into the return.
- Prompt: reframe `fetch_json_api` as the general technique (discover host → grep branch for call sites → replay read endpoints → record exposed categories/counts/numbers); read-only/no-secrets rule; on `APPROVAL_NEEDED`, don't retry.

**`harness/`**
- `schema.sql`: `approved_api_hosts(host PK, approved_at, approved_by)`, `pending_api_requests(id, card_id, host, url, reason, status, created_at, resolved_at)`.
- `lib/types.ts`: `PendingApiRequest`, `ApprovedApiHost`.
- `lib/queries.ts`: `listApprovedApiHosts()`, `listPendingApiRequests(cardId)`; include in `getCardDetail`.
- `app/actions/research.ts`: load approved hosts → `groundFacts({approvedHosts})`; persist `approval_requests` as pending rows (dedupe by host).
- `app/actions/api-approvals.ts`: `approveApiHost(host)` (insert approved + mark requests), `rejectApiRequest(id)`.
- `components/PendingApiPanel.tsx` + render on card page (mirrors fact approve/reject).

## Out of scope (noted for later)
Mid-run pause/resume; the Slack asker; using platform secrets for authed partner APIs. The decision seam exists now so these slot in without rework.
