# Agent tool access

How a separate-service agent (one that runs outside Centaur's runtime, like
comms-factory) gets read-only access to Centaur-owned tools.

There is **no capability plane**. Agents call the native tool plane directly:

```
POST {CENTAUR_BASE_URL}/tools/{tool}/{method}
Authorization: Bearer <scoped key>
Content-Type: application/json

<the tool method's input args as raw JSON>   # NOT wrapped in any envelope
```

The response is the `tool_result.v1` envelope (see below).

## 1. Get a scoped key (named scope bundle)

Access is curated and least-privilege. Instead of `tools:*`, an agent gets a
**named scope bundle** that expands into a fixed set of `tools:` scopes at key
load time. Bundles live in `services/api/api/api_keys.py` (`SCOPE_BUNDLES`):

```python
SCOPE_BUNDLES = {
    "research": (
        "tools:repo_context",
        "tools:websearch",
        "tools:web_fetch",
        "tools:browser",
        "tools:twitter",
        "tools:company_context",
    ),
}
```

Create a key with a bundle by passing the `bundle:<name>` token — it expands and
deduplicates into concrete `tools:` scopes (`_normalize_scopes`):

- Service keys: add a `ServiceAPIKeySpec(..., scopes=("bundle:research",))` to
  `_SERVICE_API_KEYS` and set its env var. It is bootstrapped on startup.
- Admin-created keys: `POST /admin/api-keys` accepts `bundle:<name>` scopes.

A new agent = a bundled key. **No per-agent server code, no registry edits.**

To add a new tool to an existing bundle, edit that bundle's tuple. To offer a
new curated set, add a new bundle. The bundle never grants `tools:*` or
unbundled tools (e.g. `tools:slack`) — `services/api/tests/test_check_scope.py`
asserts this.

## 2. Call tools with the shared client

TypeScript agents use `@centaur/api-client`:

```ts
import { CentaurClient } from "@centaur/api-client";

const centaur = new CentaurClient({
  apiUrl: process.env.CENTAUR_BASE_URL!,
  apiKey: process.env.CENTAUR_TOKEN!,   // the scoped bundle key
});

const result = await centaur.callTool(
  "repo_context",
  "search",
  { query: "deploy", repo: "infinex-platform" },
  {
    idempotencyKey: `${jobId}:${stage}:repo_context:${toolUseId}`, // optional
    trace: { jobId, stage, threadKey, traceId },                   // optional
  },
);

if (!result.ok) {
  // typed transport/tool error — never thrown:
  //   "unavailable" (HTTP >= 500 / network) → retryable
  //   "forbidden"   (403)
  //   "invalid_json"(non-JSON body)
  //   tool-level errors carry result.error.code with result.ok === false
} else {
  for (const ev of result.evidence) {
    // ev.id is a stable, citable evidence id with provenance
  }
}
```

`callTool` sends the optional `Idempotency-Key` and `X-Centaur-Job-Id` /
`X-Centaur-Stage` / `X-Centaur-Thread-Key` / `X-Centaur-Trace` headers, and
returns the parsed envelope. It never throws on transport failure — branch on
`result.ok` / `result.error.code`.

Polyglot (non-TypeScript) agents generate a client from Centaur's
`/openapi.json` against the same envelope contract.

## The `tool_result.v1` envelope

Defined in `centaur_sdk/evidence.py` (Python) and mirrored in
`packages/api-client/src/types.ts` (TS):

```jsonc
{
  "schema_version": "centaur.tool_result.v1",
  "ok": true,
  "content": "model-visible summary (evidence ids, concise refs)",
  "text": "alias of content",
  "output": { /* full structured tool output */ },
  "evidence": [
    {
      "schema_version": "centaur.evidence_item.v1",
      "id": "ev_…",                 // stable id
      "source": "repo.search",
      "source_ref": "repo@sha:path:start-end",
      "title": null, "url": null, "quote": null,
      "retrieved_at": "…Z",
      "metadata": { /* provenance */ }
    }
  ],
  "error": null,                     // { code, message } when ok=false
  "retryable": false
}
```

**Evidence is separate from model-visible text.** Freeform tool text is context;
only a typed `EvidenceItem` is claim-supporting proof. Read-only calls are
at-most-once: the tool route accepts an `Idempotency-Key` but currently ignores
it, so use bounded client-side retries on `retryable` errors (re-running a
read-only call is safe).

## Guardrails

- Curated, least-privilege scope bundles — never `tools:*`, admin, sandbox, or
  cross-service tokens for a research agent.
- Read-only research only; no side-effecting tools in a research bundle.
- Credentials for upstreams (GitHub, search providers, …) are injected by
  iron-proxy at the Centaur boundary — the agent never holds them.
