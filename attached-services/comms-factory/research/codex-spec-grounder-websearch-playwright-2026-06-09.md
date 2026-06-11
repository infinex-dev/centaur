# Codex spec — grounder general WebSearch + browser verification (2026-06-09)

## Context

`comms-factory` pipeline lives in `src/`. The **fact-grounder** (`src/fact-grounder-llm.ts`) verifies factual claims; the **actor/director** (`src/actor-orchestrator.ts`, `src/actor-director.ts`) generate + judge copy and sometimes need to verify what the product actually shows.

Current grounder tools (`src/research-tools.ts`): `grep_platform_code`, `read_platform_file`, `lookup_partner`, `fetch_public_page` (plain HTTPS fetch, model supplies URL, SSRF-guarded), `fetch_rendered_page` (headless Chrome via the `agent-browser` CLI), `fetch_json_api` (host-gated), `infinex_web_search` (Grok via the **projectjin** CLI), `infinex_search_recent_posts`. **No general web search.**

The grounder runs a **hand-rolled Anthropic tool-use loop** (`fact-grounder-llm.ts` ~L387–500): `client.messages.create({ model, tools, system, messages })` → `parseToolUses(response.content)` reads `tool_use` blocks → executes in parallel → appends `assistant` content + `user` tool_results → loops until `done_grounding` or `maxTurns`. **A turn with zero `tool_use`/record/unverifiable blocks is treated as empty → truncate.**

`@anthropic-ai/sdk` is pinned `^0.30.0` (installed **0.30.1**) in BOTH root `package.json` and `harness/package.json` — too old to know the native `web_search` server tool.

Already shipped on branch `director-service-surface` (do not redo): a **prompt-only discovery heuristic** in the grounder system prompt (llms.txt → docs root → follow nav; a 404 triggers discovery, not immediate "unverifiable"). This spec is the **tooling** layer that the prompt now assumes.

## Goal

1. **General WebSearch** in the grounder — real search-then-fetch, NOT projectjin/Grok. Prefer Anthropic's native `web_search` server tool.
2. **Browser verification** (Playwright) available to the grounder AND the actor/director verification paths — multi-step navigate/click/read, not just single-page fetch. (Lower priority than #1, per operator: "not super important but anything where the actor/director has to verify something is important.")
3. projectjin/Grok stays **last-resort only**.

## Tasks

### A. SDK upgrade (prerequisite)
- Upgrade `@anthropic-ai/sdk` 0.30.1 → latest stable in **both** root and `harness/`.
- Fix every breaking change at all call sites. Find them: `grep -rn "messages.create\|new Anthropic\|anthropic" src harness/app harness/lib`. Known: `src/fact-grounder-llm.ts`, `src/actor-orchestrator.ts`, `src/actor-director.ts`, `src/validator-active*.ts`, `src/director*`, `harness/app/actions/emit.ts`, `harness/app/actions/generate.ts`.
- Gate: `pnpm typecheck` AND `pnpm typecheck:harness` pass; `pnpm test` run and reported.

### B. Native web_search in the grounder
- Add the native server tool (`{ type: "web_search_<date>", name: "web_search", max_uses: 5 }`) to the grounder's `messages.create` tools.
- **Adapt the hand-rolled loop — this is the subtle, must-get-right part:**
  - `parseToolUses` must IGNORE `server_tool_use` and `web_search_tool_result` blocks (only custom `tool_use` get executed by `executeToolCall`).
  - A turn that contains server-tool blocks but **no** custom `tool_use`/record/unverifiable must **NOT** be classified empty/truncated — continue the loop (append the assistant turn; if no custom tool_result is owed, send a minimal user nudge to continue) so the model can act on the search results.
  - `response.content` (including the server-tool blocks) must be appended back into `messages` intact (the API requires server_tool_use to be followed by its result).
  - Emit an `on_event` for web_search calls so the harness run-events trace shows them.
- System prompt: web_search is the **discovery** step → then `fetch_public_page` the exact URL returned. Never guess.

### C. Playwright browser verification
Pick the feasible path, in order of preference:
1. **Anthropic MCP connector** (now possible post-upgrade): pass `mcp_servers` to `messages.create` pointing at a reachable Playwright MCP endpoint. Only if a URL-reachable server is available — local stdio MCP is NOT API-connectable.
2. **Custom `browser_verify` tool** wrapping the `playwright` lib (or Playwright MCP driven in-process): navigate → optional click/fill → read text/screenshot, multi-step, read-only.
3. **Extend `fetch_rendered_page`** (existing agent-browser infra) into a multi-step interactive tool.
- Expose it to the grounder tool set AND make the actor/director verification path able to reach it. Keep SSRF/read-only guards.

## Hard constraints
- Work in the provided **git worktree on branch `grounder-websearch`**. Do NOT merge. Do NOT touch the main checkout (a dev server is running there).
- `pnpm install` in the worktree as needed.
- If a task cannot be done cleanly (e.g. the SDK upgrade cascades into wide breakage, or no reachable Playwright MCP), **STOP that task and report** — never a half-migration or a stubbed-but-broken tool. (The operator's rule: keep looking or bail, never a halfway house.)
- Report back: exact files changed, `typecheck`/`test` results, which Playwright path you chose and why, and anything left undone.

## Verification (operator will re-check)
Expect the output to be re-verified: tests re-run, diffs reviewed, the grounder loop exercised against a live reground. Do not report "done" without `pnpm typecheck`, `pnpm typecheck:harness`, and `pnpm test` evidence.
