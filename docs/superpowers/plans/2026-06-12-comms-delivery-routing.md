# Comms Delivery Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route each approved channel from a `ready_to_ship` comms release
(`final_by_channel`, shipped in PR #20) to its real destination behind a human-confirmed
delivery gate: blog/web → platform PR via GitHub REST; x/x-thread → Typefully drafts;
optional display.dev draft-review loop for blog; one additive NetworkPolicy 443 egress
hook in `contrib/chart/`.

**Architecture:** The TS attached service (`attached-services/comms-factory/`) gains the
outward-writing routes (`/emit`, `/typefully-draft`, `/display/*`) plus a capabilities
probe on `GET /health`; all external calls are REST with header-only tokens (no git/gh in
the pod). The Python overlay (`overlays/comms-factory/`) gains thin-client methods and a
new `workflows/comms_delivery.py` module holding the delivery gate + blog review loop,
spliced into `comms_release.py` after the candidate gate. One chart change: a generic
`attachedServices.<name>.egressPorts` NetworkPolicy hook (mirrors `repoCache.egressPorts`).

**Tech Stack:** Node 22 + tsx + vitest (standalone pnpm project — `--ignore-workspace`),
GitHub REST API (global `fetch`), Typefully API v2, `@displaydev/cli` (`dsp`), Python 3.11
+ pytest + httpx, Helm chart templates.

**Spec:** `docs/superpowers/specs/2026-06-11-comms-delivery-routing-design.md`
(adversarially reviewed — design decisions are settled; encode, don't relitigate).
**Handoff:** `docs/superpowers/plans/2026-06-12-comms-delivery-routing.handoff.md`
(its "Environment facts" override any contradicting docs).

## Stage A checklist (planning session)
- [x] Spec read end-to-end
- [x] Spec "Open verifications" resolved (live `FEATURES_COPY` schema in
      `infinex-xyz/platform`, via GitHub API — no local checkout exists)
- [x] Operator prerequisites collected: tokens + test destinations (answers below)
- [x] Task-by-task TDD plan written below (superpowers:writing-plans)
- [x] Document review run on the plan (6-persona ce-doc-review, 2026-06-12: 31 raw
      findings → 5 auto-fixes + 24 reviewed fixes applied + 3 deferred to
      "Deferred / Open Questions" below; zero spec contradictions)
- [x] Operator approval received 2026-06-12 ("approve, but answer OQs first" — all
      three Open Questions answered + encoded: token reuse w/ branch-protection
      guarantee, copy-only Phase 0, brief-parsed reviewers) → Stage B may begin

## Resolved open verifications (2026-06-12, read live from `infinex-xyz/platform@main`)

1. **`FEATURES_COPY` entry schema — RESOLVED.** Live type in
   `apps/public-website/src/app/(site)/features/data.ts`:
   ```ts
   type FeatureCopyOptions = {
     title: string;
     description?: string;
     featureImage?: { desktop: string; mobile: string };
     twoCols?: TwoColImageProps[];
     threeCols?: ThreeColImageProps;
   };
   export const FEATURES_COPY: FeatureCopyOptions[] = [ … ];
   ```
   A minimal `{title, description}` entry is valid (matches the existing
   `emit-platform-pr.test.ts` `featuresFixture`, src/__tests__/emit-platform-pr.test.ts:607-618).
   The generator's structured web fields (`subheading`/`title`/`caption`,
   generator.ts:278-282) were shaped after the **homepage** feature-card-alt component —
   a different surface. Mapper decision (encoded in Task 4): `title ← structured.title`
   with the `' / '` line-break marker stripped (precedent: `renderStructured`,
   generator.ts:134), `description ← structured.caption`, `subheading` has no slot and is
   dropped. Image fields omitted (human adds at PR review — same policy as blog cover).
2. **`FEATURES_DATA_PATH` is the rendered file — CONFIRMED.** `features/page.tsx` imports
   `FEATURES_COPY` from `./data`. The recon's rival
   `_components/feature-card-alt/data.ts` exports `ALT_FEATURES_COPY` (homepage carousel;
   requires local SVG imports + mandatory images — not text-appendable; NOT the target).
   Note: `coingecko/page.tsx` also imports the same `FEATURES_COPY`, and entries feed the
   features page's JSON-LD — an appended entry shows in three places, all tolerant of
   missing images. **Web delivery is unblocked; it ships in the same PR as blog.**
3. **GitHub token — resolved: upgrade the existing infra `GITHUB_TOKEN`** (fine-grained
   PAT, Contents+PR write added; "PRs only, never lands code" is enforced by platform's
   verified `main` branch protection, not the token — see Operator decisions below).
   ⚠️ Deviation from spec rule #3's separate-token requirement, operator-confirmed.
4. **Typefully — key available.** `TYPEFULLY_SOCIAL_SET` convention kept (id or name,
   default `"Infinex"`). Workspace sharing across pipelines: operator-approved.
5. **display.dev — key available.** `@displaydev/cli@0.26.0` natively reads
   `DISPLAYDEV_API_KEY` from env (verified by inspecting the published package — also
   honors `DISPLAYDEV_SKIP_BROWSER`), so in-pod auth needs no argv key and no disk
   session. Reviewer mapping: **explicit `reviewer_emails` workflow input** (operator
   decision — no Slack profile lookup).
6. **`/display/revise` confirmed missing** — `handleGenerate` never wires
   `seed_transcript`/`seed_notes` (routes/generate.ts:40-47); the seed path exists as
   `ActorDirectorRetryOptions.seed_transcript/.seed_notes`
   (src/actor-orchestrator.ts:219-220, consumed at :257-258; real entrypoint is
   `orchestrateActorDirectorWithRetries(card, channels, opts)`, :247-251 — there is no
   bare `orchestrateActorDirector`). `blog` is already in the route `CHANNELS` allowlist
   (routes/generate.ts:13-21).

## Operator decisions (2026-06-12)

| Topic | Decision |
|---|---|
| GitHub token | **Upgrade the existing infra `GITHUB_TOKEN` (one token everywhere) — FINAL, operator-confirmed twice with full mechanics verified.** The token in `centaur-infra-env` is a fine-grained PAT from the `ramboinfinex` account (verified live 2026-06-12); the operator flips **Contents → Read and write** and adds **Pull requests → Read and write** on it BEFORE Stage B's E2E (done up-front, so the rollout-sequencing concern is moot). Comms pod reads `process.env.GITHUB_TOKEN` — same secret key repo-cache mounts. The operator's "PRs only, never lands code" requirement is enforced by the REPO, not the token (verified live + against GitHub docs): there is no PR-only permission (PR creation requires contents:write for the `cf-emit/*` head branch — community discussion #106661; forking is org-disabled), and platform `main` carries a `pull_request` ruleset (enforcement: everyone) + required checks + signatures — direct pushes to main are rejected for ANY write token. ⚠️ Two recorded caveats the operator accepted: (a) DEVIATION from the spec's separate-token rule (repo-cache now mounts a write-capable token); (b) fine-grained PAT permissions are token-wide — contents:write applies to EVERY repo on the token's access list (platform, agent-platform, context), not just platform. PRs will author as `ramboinfinex`. `COMMS_PLATFORM_REPO` stays the repo escape hatch. |
| E2E PR target | **`infinex-xyz/platform` directly.** E2E PR is closed unmerged + branch deleted afterwards. The platform repo's automatic AI content review (`content--review.yaml`) will fire on it — expected, harmless. |
| Typefully E2E | **Separate test social set** (operator provisions; E2E sets `TYPEFULLY_SOCIAL_SET` to it). Production uses the default `"Infinex"` set; sharing the prod workspace across pipelines is acceptable. |
| display.dev reviewers | **Explicit `reviewer_emails` workflow input, plus inline brief parsing for Slack-started runs** (decided 2026-06-12, resolving OQ2): a Slack brief may carry `reviewers: a@x.com, b@x.com` — same inline-metadata convention as channel selection (`_parse_channels`). Explicit input overrides; well-formed emails only; no Slack-profile lookup. |
| Tokens availability | All three (GitHub write, Typefully, display.dev) available before Stage B's E2E task. |

## Verified anchors (2026-06-12 audit — all spec behaviors confirmed; drifted line numbers corrected below)

- `emit-platform-pr.ts`: paths :11-13; `LaunchPackage` :16-21; `emitLaunchPR` :70 (exported);
  `markRoadmapNodeDone` :397 (exported); `appendFeatureCopyEntry` :471 (exported);
  `markChangelogPublished` :501 (exported); `describeRoadmapChanges` :593 (exported);
  `extractChangelogTitle` :635 (exported); **`buildPrBody` :753 and `ensureTrailingNewline`
  :790 are module-private — Task 4 exports them**; `assertSafeBranch` is private but in the
  `_test` export — Task 4 promotes it.
- `services/api/server.ts`: `GET /health` :13-20 (no auth); five POST routes :23-27.
- `services/api/http.ts`: exact `"METHOD /path"` Map lookup :40-42; error bodies echo
  `message`+`details` unsanitized :52 (⇒ never put a token in an `HttpError`);
  `sanitizeLog` redacts by key name only :158.
- `routes/generate.ts`: `CHANNELS` :13-21; `handleGenerate` :23-76; runOptions :40-47.
- `harness/lib/typefully.ts`: Bearer :26; social-set resolution :39-48; draft body :189-195
  (**no `share:true`/`scratchpad_text` support yet — Task 2 adds them**); media endpoints
  are social-set-scoped (service client omits media this phase — spec marks it future).
- `harness/lib/freshen.ts`: `freshenDates` :20-43 (Task 4 copies it into `src/freshen.ts`;
  the service image only ships `src/` + `services/api/` — Dockerfile `COPY src ./src`).
- Python `client.py`: `_post` only :139-175; `_redact_sensitive` :215; `_client` :243.
- `comms_release.py`: round loop :453-587 (`MAX_CANDIDATE_ROUNDS=30` :913); `_render`
  :418-451; terminal render :591-607; **ship section :619-657 = the delivery-gate splice
  point**; `_generation_result_error` :688-694; `_seed_final_by_channel` :916-953;
  `_candidate_gate_blocks` :964-1022.
- `comms_shared.py`: `Gate(run_id, stage, gate_version, requester_user_id="",
  approver_user_ids=(), per_item=False)` :66-77 (correlation `run:stage:version` :84-85);
  `chunked_markdown_blocks` :160-192; `validate_gate_event` :261; `wait_for_gate_action`
  :292; `call_comms_tool(ctx, name, method, args)` :366-388.
- `workflow_engine.py`: step checkpoints after fn :378-383; `sleep`/`sleep_until` :401/:419;
  event wait suspend :498-505; first-write-wins events :2777-2779.
- Chart: attached-service NetworkPolicy block networkpolicy.yaml:169-217 (egress rules end
  :214 — **the 443 hook inserts there**); `repoCache.egressPorts` mechanism values.yaml:144-145
  + networkpolicy.yaml:379-383 (repo-cache-scoped — no generic flag exists);
  values.schema.json attachedServices per-service properties (add `egressPorts` near `proxy`);
  comms values.production.yaml: proxy off :32-33, secretEnv :47-57, repo-cache token :76-78;
  deploy-local.sh heredoc attachedServices block ~:256-291, secret patch ~:182-200.

## Commands (from the handoff — trust these)

```bash
# Python (run from repo root)
uv run --project services/api pytest overlays/comms-factory -q
uv run --project services/api ruff check overlays/comms-factory
uv run --project services/api ruff format overlays/comms-factory   # default 88 cols

# TS (standalone project — NOT in the root pnpm workspace)
cd attached-services/comms-factory
pnpm install --ignore-workspace
pnpm test            # vitest run (excludes harness/**)
pnpm typecheck       # tsc --noEmit

# Local stack
contrib/scripts/deploy-local.sh --services api --with-comms-factory
```

## File map

| File | Action | Responsibility |
|---|---|---|
| `attached-services/comms-factory/services/api/server.ts` | modify | `/health` capabilities + register new routes |
| `attached-services/comms-factory/src/typefully.ts` | create | service Typefully v2 client (drafts only) |
| `attached-services/comms-factory/services/api/routes/typefully-draft.ts` | create | `POST /typefully-draft` |
| `attached-services/comms-factory/src/emit-platform-pr.ts` | modify | export `buildPrBody`, `ensureTrailingNewline`, `assertSafeBranch` |
| `attached-services/comms-factory/src/freshen.ts` | create | `freshenDates` (copy of harness lib; image ships only `src/`) |
| `attached-services/comms-factory/src/launch-package.ts` | create | `buildLaunchPackage` mapper + `featureCardEntry` + frontmatter normalization |
| `attached-services/comms-factory/src/github-emit.ts` | create | REST emit (pre-flight, dry-run diff, branch/contents/PR) |
| `attached-services/comms-factory/services/api/routes/emit.ts` | create | `POST /emit` |
| `attached-services/comms-factory/src/display.ts` | create | `dsp` CLI wrapper (runner-injectable) |
| `attached-services/comms-factory/services/api/routes/display.ts` | create | `POST /display/{publish,comments,revise,resolve,unpublish}` |
| `attached-services/comms-factory/package.json` + `pnpm-lock.yaml` | modify | add `diff`, `@types/diff`, `@displaydev/cli` |
| `overlays/comms-factory/tools/comms_factory/client.py` | modify | `_get` + `capabilities` + `emit_platform_pr` + `typefully_draft` + 5 `display_*` |
| `overlays/comms-factory/workflows/comms_delivery.py` | create | destination groups, delivery gate, blog review loop |
| `overlays/comms-factory/workflows/comms_release.py` | modify | splice delivery flow into the ship section; `reviewer_emails` input |
| `overlays/comms-factory/tests/test_comms_delivery.py` | create | Python tests for all of the above |
| `contrib/chart/templates/networkpolicy.yaml` | modify | generic `egressPorts` hook for attached services |
| `contrib/chart/values.schema.json` | modify | declare `egressPorts` |
| `overlays/comms-factory/values.production.yaml` | modify | `egressPorts: [443]` + 3 secretEnv tokens |
| `contrib/scripts/deploy-local.sh` | modify | same heredoc additions + local secret patch |
| `contrib/docs/deploy-env-runsheet.md` | modify | token + egress runsheet |

Tasks 1–9 are TS; 10–13 Python; 14 chart; 15 E2E; 16 docs. Each task is
independently committable and leaves both suites green. Commit messages use
conventional commits. **All work happens on `feat/comms-delivery-routing` (PR #22,
stays draft).**

---

### Task 1: `/health` capabilities probe

The workflow (API pod) cannot read the comms pod's env — `GET /health` reports booleans.

**Files:**
- Modify: `attached-services/comms-factory/services/api/server.ts:13-20`
- Test: `attached-services/comms-factory/services/api/server.test.ts`

- [ ] **Step 1: Write the failing test** — append to the `describe` block in
  `services/api/server.test.ts`:

```ts
  it("reports delivery capabilities from env without leaking values", async () => {
    const prevGh = process.env.GITHUB_TOKEN;
    const prevTf = process.env.TYPEFULLY_API_KEY;
    const prevDsp = process.env.DISPLAYDEV_API_KEY;
    process.env.GITHUB_TOKEN = "github_pat_secret_value";
    delete process.env.TYPEFULLY_API_KEY;
    process.env.DISPLAYDEV_API_KEY = "sk_live_secret";
    try {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.capabilities).toEqual({ platform_pr: true, typefully: false, display: true });
      expect(JSON.stringify(body)).not.toContain("github_pat_secret_value");
      expect(JSON.stringify(body)).not.toContain("sk_live_secret");
    } finally {
      restoreEnv("GITHUB_TOKEN", prevGh);
      restoreEnv("TYPEFULLY_API_KEY", prevTf);
      restoreEnv("DISPLAYDEV_API_KEY", prevDsp);
    }
  });
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd attached-services/comms-factory && pnpm vitest run services/api/server.test.ts`
Expected: FAIL — `body.capabilities` is `undefined`.

- [ ] **Step 3: Implement** — in `server.ts`, replace the `GET /health` handler body so
  capabilities are computed per-request (env can change in tests):

```ts
routes.set("GET /health", () => ({
  body: {
    ok: true,
    service: "comms-factory-api",
    version: packageJson.version,
    commit: process.env.COMMIT_SHA ?? "local",
    capabilities: {
      platform_pr: Boolean(process.env.GITHUB_TOKEN?.trim()),
      typefully: Boolean(process.env.TYPEFULLY_API_KEY?.trim()),
      display: Boolean(process.env.DISPLAYDEV_API_KEY?.trim()),
    },
  },
}));
```

- [ ] **Step 4: Run tests + typecheck — verify green**

Run: `pnpm vitest run services/api/server.test.ts && pnpm typecheck`
Expected: PASS (the existing "serves unauthenticated health" test still passes —
`toMatchObject` ignores the new key).

- [ ] **Step 5: Commit**

```bash
git add attached-services/comms-factory/services/api/server.ts attached-services/comms-factory/services/api/server.test.ts
git commit -m "feat(comms): report delivery capabilities on /health"
```

---

### Task 2: Typefully service client (`src/typefully.ts`)

Copy-adapt `harness/lib/typefully.ts` (live-verified 2026-06-09) into the service. The
harness file stays untouched as the break-glass twin (the image ships only `src/` +
`services/api/`). Changes vs the harness client: no media support (spec marks media
future), `share: true` + `scratchpad_text` added (the harness client lacks both),
env-overridable base URL for tests, and errors return data instead of throwing
harness-flavored messages.

**Files:**
- Create: `attached-services/comms-factory/src/typefully.ts`
- Test: `attached-services/comms-factory/src/__tests__/typefully.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/__tests__/typefully.test.ts`. Pattern:
  boot a local mock Typefully server (same style as server.test.ts's mock Centaur server)
  and point `TYPEFULLY_BASE_URL` at it.

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTypefullyDraft } from "../typefully.js";

let mock: ReturnType<typeof createServer>;
let requests: Array<{ url: string | undefined; method: string | undefined; body: unknown }>;
let base = "";

beforeEach(async () => {
  requests = [];
  mock = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    requests.push({ url: req.url, method: req.method, body });
    if (req.url === "/v2/social-sets") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ id: 7, name: "Infinex" }, { id: 9, name: "Test Set" }]));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: 42, status: "draft", share_url: "https://typefully.com/t/abc" }));
  });
  base = await new Promise<string>((resolve) => {
    mock.listen(0, "127.0.0.1", () => {
      const a = mock.address();
      if (!a || typeof a === "string") throw new Error("no addr");
      resolve(`http://127.0.0.1:${a.port}`);
    });
  });
  process.env.TYPEFULLY_BASE_URL = base;
  process.env.TYPEFULLY_API_KEY = "tf-test-key";
  delete process.env.TYPEFULLY_SOCIAL_SET;
});

afterEach(async () => {
  delete process.env.TYPEFULLY_BASE_URL;
  delete process.env.TYPEFULLY_API_KEY;
  delete process.env.TYPEFULLY_SOCIAL_SET;
  await new Promise<void>((resolve, reject) => mock.close((e) => (e ? reject(e) : resolve())));
});

describe("createTypefullyDraft", () => {
  it("creates a solo draft with share + scratchpad and never sets publish_at", async () => {
    const result = await createTypefullyDraft(["One post."], {
      title: "Launch X",
      scratchpad: "run run_1 · Launch X",
    });
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect(draft?.method).toBe("POST");
    expect(draft?.body).toMatchObject({
      platforms: { x: { enabled: true, posts: [{ text: "One post." }] } },
      share: true,
      draft_title: "Launch X",
      scratchpad_text: "run run_1 · Launch X",
    });
    expect(JSON.stringify(draft?.body)).not.toContain("publish_at");
    expect(result).toMatchObject({
      draftId: 42,
      socialSetId: 7,
      count: 1,
      shareUrl: "https://typefully.com/t/abc",
      draftUrl: "https://typefully.com/?a=7&d=42",
    });
  });

  it("maps a thread 1:1 — one posts[] entry per tweet, order preserved", async () => {
    await createTypefullyDraft(["t1", "t2", "t3"], {});
    const draft = requests.find((r) => r.url === "/v2/social-sets/7/drafts");
    expect((draft?.body as { platforms: { x: { posts: { text: string }[] } } }).platforms.x.posts)
      .toEqual([{ text: "t1" }, { text: "t2" }, { text: "t3" }]);
  });

  it("resolves TYPEFULLY_SOCIAL_SET by name", async () => {
    process.env.TYPEFULLY_SOCIAL_SET = "Test Set";
    const result = await createTypefullyDraft(["x"], {});
    expect(result.socialSetId).toBe(9);
  });

  it("sends the key as a Bearer header only — never in the URL", async () => {
    await createTypefullyDraft(["x"], {});
    for (const r of requests) expect(r.url).not.toContain("tf-test-key");
  });

  it("throws a typed not-configured error when the key is absent", async () => {
    delete process.env.TYPEFULLY_API_KEY;
    await expect(createTypefullyDraft(["x"], {})).rejects.toThrow("typefully_not_configured");
  });
});
```

Also assert (same file, brief cases): empty/whitespace tweets are filtered and an
all-empty input rejects with `"typefully_no_posts"`; a social-set list with no match
throws `"typefully_social_set_not_found"`; a mock 401 whose body contains the literal
API key value produces an error message that does NOT contain the key (sanitized to
`[redacted]`).

- [ ] **Step 2: Run — verify failure**

Run: `pnpm vitest run src/__tests__/typefully.test.ts`
Expected: FAIL — module `../typefully.js` not found.

- [ ] **Step 3: Implement `src/typefully.ts`**

```ts
/**
 * Typefully API v2 client for the comms-factory SERVICE (drafts only — never
 * publishes). Adapted from harness/lib/typefully.ts (live-verified 2026-06-09),
 * which remains the operator-laptop break-glass twin. Differences: no media
 * support (future), share:true + scratchpad_text for review URLs/traceability,
 * TYPEFULLY_BASE_URL override for tests, typed error codes.
 * Auth: `Authorization: Bearer <TYPEFULLY_API_KEY>` — header only, never URL/argv.
 */

export interface TypefullyDraftOptions {
  title?: string;
  scratchpad?: string;
}

export interface TypefullyDraftResult {
  draftId: number;
  status: string;
  socialSetId: number;
  count: number;
  shareUrl: string | null;
  draftUrl: string;
}

function baseUrl(): string {
  return (process.env.TYPEFULLY_BASE_URL ?? "https://api.typefully.com").replace(/\/$/, "");
}

async function tf(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const key = process.env.TYPEFULLY_API_KEY?.trim();
  if (!key) throw new Error("typefully_not_configured");
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Upstream error bodies are third-party controlled and http.ts echoes error
    // messages into responses/logs unsanitized — strip the key before throwing.
    const safeDetail = detail.split(key).join("[redacted]");
    throw new Error(`typefully_http_${res.status}: ${safeDetail.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Resolve the target social set by env (numeric id or name), default "Infinex". */
async function resolveSocialSetId(): Promise<number> {
  const want = process.env.TYPEFULLY_SOCIAL_SET?.trim();
  if (want && /^\d+$/.test(want)) return Number(want);
  const data = await tf("/v2/social-sets");
  const sets = (Array.isArray(data) ? data : ((data.results as unknown[]) ?? [])) as Array<{ id: number; name?: string }>;
  const wantName = (want || "Infinex").toLowerCase();
  const match = sets.find((s) => (s.name ?? "").toLowerCase() === wantName);
  if (!match) throw new Error("typefully_social_set_not_found");
  return match.id;
}

export async function createTypefullyDraft(
  tweets: readonly string[],
  opts: TypefullyDraftOptions = {},
): Promise<TypefullyDraftResult> {
  const posts = tweets.map((t) => t.trim()).filter((t) => t.length > 0).map((text) => ({ text }));
  if (posts.length === 0) throw new Error("typefully_no_posts");
  const socialSetId = await resolveSocialSetId();
  const body = {
    platforms: { x: { enabled: true, posts } },
    share: true,
    ...(opts.title ? { draft_title: opts.title.slice(0, 120) } : {}),
    ...(opts.scratchpad ? { scratchpad_text: opts.scratchpad.slice(0, 2000) } : {}),
    // publish_at deliberately omitted → the draft stays a draft. Never auto-publish.
  };
  const draft = await tf(`/v2/social-sets/${socialSetId}/drafts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const draftId = Number(draft.id ?? draft.draft_id);
  const shareUrl =
    typeof draft.share_url === "string" ? draft.share_url
    : typeof draft.private_url === "string" ? draft.private_url
    : null;
  return {
    draftId,
    status: String(draft.status ?? "draft"),
    socialSetId,
    count: posts.length,
    shareUrl,
    draftUrl: `https://typefully.com/?a=${socialSetId}&d=${draftId}`,
  };
}
```

- [ ] **Step 4: Run tests + typecheck — verify green**

Run: `pnpm vitest run src/__tests__/typefully.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add attached-services/comms-factory/src/typefully.ts attached-services/comms-factory/src/__tests__/typefully.test.ts
git commit -m "feat(comms): service-side Typefully v2 draft client (share+scratchpad, drafts only)"
```

---

### Task 3: `POST /typefully-draft` route

**Files:**
- Create: `attached-services/comms-factory/services/api/routes/typefully-draft.ts`
- Modify: `attached-services/comms-factory/services/api/server.ts:22-33` (add to the route list)
- Test: `attached-services/comms-factory/services/api/routes/typefully-draft.test.ts`

- [ ] **Step 1: Write the failing tests** — same local-mock-server pattern as Task 2
  (set `TYPEFULLY_BASE_URL` + `TYPEFULLY_API_KEY` per test; call the handler directly
  with a fake `RequestContext`, like this):

```ts
import { describe, expect, it } from "vitest";
import { handleTypefullyDraft } from "./typefully-draft.js";

function ctx(body: unknown) {
  return { request: {} as never, method: "POST", url: new URL("http://x/typefully-draft"), body, requestId: "t" };
}
```

Cases (each a full `it(...)` in the file; reuse Task 2's mock-server helpers):
1. **not configured**: with `TYPEFULLY_API_KEY` unset,
   `await handleTypefullyDraft(ctx({ channel: "x", text: "hi" }))` returns
   `{ body: { ok: false, error: "typefully_not_configured" } }` — and no fetch happens.
2. **solo x**: body `{channel: "x", text: "One post.", title: "T", scratchpad: "run r1"}` →
   mock receives one `posts` entry; handler returns
   `{ok: true, channel: "x", draft_id: 42, share_url, draft_url}`.
3. **thread**: body `{channel: "x-thread", tweets: ["t1","t2"]}` → two posts in order.
4. **missing text/tweets** → throws `HttpError` 400 `missing_text`.
5. **social-set resolution failure** (env `TYPEFULLY_SOCIAL_SET=Nope`) → returns
   `{ok:false, error:"typefully_not_configured"}` (spec: resolution failure gets
   not-configured handling).
6. **upstream 5xx** (mock returns 500 on drafts) → `{ok:false, error:"typefully_draft_failed"}`,
   and the error body does NOT contain the API key.

- [ ] **Step 2: Run — verify failure** (module not found).

- [ ] **Step 3: Implement `routes/typefully-draft.ts`**

```ts
import { createTypefullyDraft } from "../../../src/typefully.js";
import { assertRecord, HttpError, log, optionalString, requiredString, stringArray, type JsonResponse, type RequestContext } from "../http.js";

export async function handleTypefullyDraft(ctx: RequestContext): Promise<JsonResponse> {
  const body = assertRecord(ctx.body);
  if (!process.env.TYPEFULLY_API_KEY?.trim()) {
    return { body: { ok: false, error: "typefully_not_configured" } };
  }
  const channel = requiredString(body, "channel");
  const tweets = stringArray(body.tweets);
  const text = optionalString(body, "text");
  const posts = tweets.length > 0 ? tweets : text ? [text] : [];
  if (posts.length === 0) throw new HttpError(400, "missing_text", "text or tweets is required");
  // Hoisted consts: under exactOptionalPropertyTypes, repeated optionalString()
  // calls in a conditional spread type as `string | undefined` (calls aren't
  // narrowed) — consts narrow correctly.
  const title = optionalString(body, "title");
  const scratchpad = optionalString(body, "scratchpad");
  try {
    const draft = await createTypefullyDraft(posts, {
      ...(title ? { title } : {}),
      ...(scratchpad ? { scratchpad } : {}),
    });
    return {
      body: {
        ok: true,
        channel,
        draft_id: draft.draftId,
        share_url: draft.shareUrl,
        draft_url: draft.draftUrl,
        count: draft.count,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("typefully_not_configured") || message.startsWith("typefully_social_set_not_found")) {
      return { body: { ok: false, error: "typefully_not_configured" } };
    }
    log("warn", "typefully_draft_failed", { channel, detail: message.slice(0, 200) });
    return { body: { ok: false, error: "typefully_draft_failed" } };
  }
}
```

Register in `server.ts` by adding to the existing POST list:

```ts
import { handleTypefullyDraft } from "./routes/typefully-draft.js";
// in the for-loop array:
  ["/typefully-draft", handleTypefullyDraft],
```

- [ ] **Step 4: Run all TS tests + typecheck — verify green**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (server.test.ts auth tests now also cover the new POST route's
`requirePostAuth` wrapping automatically — it uses the same loop).

- [ ] **Step 5: Commit**

```bash
git add attached-services/comms-factory/services/api/routes/typefully-draft.ts attached-services/comms-factory/services/api/routes/typefully-draft.test.ts attached-services/comms-factory/services/api/server.ts
git commit -m "feat(comms): POST /typefully-draft route (solo + threadified, draft-only)"
```

---

### Task 4: Export emit helpers + `src/freshen.ts` + `src/launch-package.ts` mapper

**Files:**
- Modify: `attached-services/comms-factory/src/emit-platform-pr.ts` (exports only — no behavior change)
- Create: `attached-services/comms-factory/src/freshen.ts`
- Create: `attached-services/comms-factory/src/launch-package.ts`
- Test: `attached-services/comms-factory/src/__tests__/launch-package.test.ts`

- [ ] **Step 1: Export the private helpers.** In `src/emit-platform-pr.ts`, make these
  five declarations exported (pure mechanical edit — add `export` keyword):
  - `buildPrBody` (:753), `ensureTrailingNewline` (:790), `assertSafeBranch` (~:735),
    and the three path constants `ROADMAP_DATA_PATH` (:11), `FEATURES_DATA_PATH` (:12),
    `BLOG_DIR` (:13).

  Run `pnpm test` — the existing emit tests must stay green (exports change nothing).

- [ ] **Step 2: Copy `freshenDates` into the service source.** Create `src/freshen.ts` as
  a verbatim copy of `harness/lib/freshen.ts` (43 lines: `DateChange` + `freshenDates`),
  with the header comment extended by one line:
  `// Twin of harness/lib/freshen.ts — the service image ships only src/ + services/api/ (Dockerfile), so the harness copy is unreachable in-pod. Keep both in sync.`
  The harness file stays untouched (its tests keep covering it).

- [ ] **Step 3: Write the failing mapper tests** — `src/__tests__/launch-package.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appendFeatureCopyEntry } from "../emit-platform-pr.js";
import { buildLaunchPackage, featureCardEntry, normalizeBlogFrontmatter } from "../launch-package.js";

// Mirrors the LIVE FEATURES_COPY schema (verified 2026-06-12 against
// infinex-xyz/platform@main: {title: string; description?: string; …images optional}).
const FEATURES_FIXTURE = `type FeatureCopyOptions = { title: string; description?: string };
export const FEATURES_COPY: FeatureCopyOptions[] = [
  {
    title: "Homepage",
    description: "A command center view.",
  },
];
`;

const WEB_CANDIDATE = {
  id: "cand_web_1",
  channel: "web",
  structured: { kind: "web-card" as const, subheading: "Perpetual Futures", title: "Trade perps / in-app", caption: "Powered by Hyperliquid" },
};

const BLOG_MD = `---
title: "Perps launch"
date: 2026-06-01
category: changelogs
---

Perps are live as of 2026-06-01.
`;

describe("featureCardEntry", () => {
  it("maps structured web copy to the live schema, stripping the ' / ' line-break marker", () => {
    const entry = featureCardEntry(WEB_CANDIDATE.structured);
    expect(entry).toContain('"Trade perps in-app"');
    expect(entry).toContain('"Powered by Hyperliquid"');
    expect(entry).not.toContain("subheading"); // no slot in FeatureCopyOptions — dropped
  });

  it("round-trips through appendFeatureCopyEntry into the live-schema fixture", () => {
    const out = appendFeatureCopyEntry(FEATURES_FIXTURE, featureCardEntry(WEB_CANDIDATE.structured));
    expect(out).toContain("Trade perps in-app");
    expect(out).toContain("Homepage"); // existing entries untouched
  });
});

describe("normalizeBlogFrontmatter", () => {
  it("freshens the stale date and its verbatim echoes to emit-day", () => {
    const { text, dateChanges } = normalizeBlogFrontmatter(BLOG_MD, { title: "Perps launch", today: "2026-06-12" });
    expect(text).toContain("date: 2026-06-12");
    expect(text).toContain("as of 2026-06-12");
    expect(dateChanges.length).toBeGreaterThan(0);
  });

  it("synthesizes frontmatter when absent (title, date, published, category)", () => {
    const { text } = normalizeBlogFrontmatter("Just a body.", { title: "Perps launch", today: "2026-06-12" });
    expect(text).toMatch(/^---\n/);
    expect(text).toContain('title: "Perps launch"');
    expect(text).toContain("date: 2026-06-12");
    expect(text).toContain("published: true");
    expect(text).toContain("category: changelogs");
  });

  it("injects typefullyUrl when supplied and omits it otherwise", () => {
    const withUrl = normalizeBlogFrontmatter(BLOG_MD, { title: "t", today: "2026-06-12", typefullyUrl: "https://typefully.com/t/abc" });
    expect(withUrl.text).toContain("typefullyUrl: https://typefully.com/t/abc");
    const without = normalizeBlogFrontmatter(BLOG_MD, { title: "t", today: "2026-06-12" });
    expect(without.text).not.toContain("typefullyUrl");
  });

  it("ensures published: true via markChangelogPublished semantics", () => {
    const { text } = normalizeBlogFrontmatter(BLOG_MD, { title: "t", today: "2026-06-12" });
    expect(text).toContain("published: true");
  });
});

describe("buildLaunchPackage", () => {
  const card = { title: "Perps launch", deployed_facts: ["perps live"] };
  const finalByChannel = {
    blog: { text: BLOG_MD, candidate_id: "cand_blog_1", edited: false, pick: true },
    web: { text: "Perpetual Futures\nTrade perps in-app\nPowered by Hyperliquid", candidate_id: "cand_web_1", edited: false, pick: true },
    x: { text: "tweet", candidate_id: "cand_x_1", edited: false, pick: true },
  };

  it("builds blog+web: changelogMd normalized, featureCard from candidate.structured via candidate_id", () => {
    const built = buildLaunchPackage(card, finalByChannel, [WEB_CANDIDATE], { today: "2026-06-12" });
    expect(built.pkg.changelogSlug).toBe("perps-launch");
    expect(built.pkg.changelogMd).toContain("date: 2026-06-12");
    expect(built.pkg.featureCard?.dataTsEntry).toContain("Trade perps in-app");
    expect(built.pkg.roadmapTick).toBeUndefined(); // never guessed
  });

  it("omits missing channels: blog-only and web-only both work", () => {
    const blogOnly = buildLaunchPackage(card, { blog: finalByChannel.blog }, [], { today: "2026-06-12" });
    expect(blogOnly.pkg.changelogMd).toBeDefined();
    expect(blogOnly.pkg.featureCard).toBeUndefined();
    const webOnly = buildLaunchPackage(card, { web: finalByChannel.web }, [WEB_CANDIDATE], { today: "2026-06-12" });
    expect(webOnly.pkg.changelogMd).toBeUndefined();
    expect(webOnly.pkg.featureCard?.dataTsEntry).toContain("Trade perps in-app");
  });

  it("notes (not crashes) when web is approved but the structured candidate is missing", () => {
    const built = buildLaunchPackage(card, { web: finalByChannel.web }, [], { today: "2026-06-12" });
    expect(built.pkg.featureCard).toBeUndefined();
    expect(built.notes.join(" ")).toContain("web");
  });

  it("threads typefullyUrl into the blog frontmatter", () => {
    const built = buildLaunchPackage(card, { blog: finalByChannel.blog }, [], { today: "2026-06-12", typefullyUrl: "https://typefully.com/t/abc" });
    expect(built.pkg.changelogMd).toContain("typefullyUrl: https://typefully.com/t/abc");
  });
});
```

- [ ] **Step 4: Run — verify failure** (`launch-package.js` not found).

- [ ] **Step 5: Implement `src/launch-package.ts`**

```ts
/**
 * Maps the workflow's approved copy (final_by_channel + candidates) onto the
 * emit package consumed by the REST emit path. Pure + deterministic: the
 * caller passes `today` so tests and replays are stable.
 * Web mapping verified against the LIVE FEATURES_COPY schema 2026-06-12:
 * {title, description?} — subheading has no slot (homepage card concept) and
 * the ' / ' marker is a feature-card-alt line-break convention → stripped
 * (precedent: renderStructured, generator.ts:134).
 */
import { extractChangelogTitle, markChangelogPublished } from "./emit-platform-pr.js";
import { freshenDates, type DateChange } from "./freshen.js";

export interface FinalChannelEntry {
  text: string;
  candidate_id?: string | null;
  edited?: boolean;
  pick?: boolean;
}
export type FinalByChannel = Record<string, FinalChannelEntry | null | undefined>;

export interface WebCardStructured { kind: "web-card"; subheading: string; title: string; caption: string }
export interface CandidateLike { id?: unknown; channel?: unknown; structured?: unknown }

/** Like LaunchPackage but changelogMd is optional — web-only PRs are legal. */
export interface EmitPackage {
  changelogSlug: string;
  changelogMd?: string;
  roadmapTick?: { nodeName: string; parentName?: string };
  featureCard?: { dataTsEntry: string };
}

export interface BuildLaunchPackageOptions {
  today: string; // YYYY-MM-DD
  typefullyUrl?: string;
  roadmapTick?: { nodeName: string; parentName?: string };
}

export interface BuiltLaunchPackage { pkg: EmitPackage; dateChanges: DateChange[]; notes: string[] }

export function slugify(value: string): string {
  return (
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "release"
  );
}

export function featureCardEntry(structured: WebCardStructured): string {
  const title = structured.title.replace(/\s*\/\s*/g, " ").trim();
  const description = structured.caption.trim();
  return `{\n    title: ${JSON.stringify(title)},\n    description: ${JSON.stringify(description)},\n  },`;
}

export function normalizeBlogFrontmatter(
  markdown: string,
  opts: { title: string; today: string; typefullyUrl?: string },
): { text: string; dateChanges: DateChange[]; notes: string[] } {
  const notes: string[] = [];
  let text = markdown;
  if (!/^---\n/.test(text)) {
    text = `---\ntitle: ${JSON.stringify(opts.title)}\ndate: ${opts.today}\npublished: true\ncategory: changelogs\n---\n\n${text}`;
    notes.push("frontmatter synthesized (none present)");
  } else {
    const end = text.indexOf("\n---", 3);
    let fm = text.slice(0, end);
    if (!/^title:/m.test(fm)) { fm += `\ntitle: ${JSON.stringify(opts.title)}`; notes.push("title added"); }
    if (!/^date:/m.test(fm)) { fm += `\ndate: ${opts.today}`; notes.push("date added"); }
    if (!/^category:/m.test(fm)) { fm += `\ncategory: changelogs`; notes.push("category: changelogs added"); }
    text = fm + text.slice(end);
  }
  text = markChangelogPublished(text); // existing exported helper — sets published: true
  if (opts.typefullyUrl) {
    const end = text.indexOf("\n---", 3);
    let fm = text.slice(0, end);
    if (/^typefullyUrl:/m.test(fm)) fm = fm.replace(/^typefullyUrl:.*$/m, `typefullyUrl: ${opts.typefullyUrl}`);
    else fm += `\ntypefullyUrl: ${opts.typefullyUrl}`;
    text = fm + text.slice(end);
    notes.push("typefullyUrl injected");
  }
  const freshened = freshenDates(text, opts.today);
  return { text: freshened.text, dateChanges: freshened.changes, notes };
}

export function buildLaunchPackage(
  card: Record<string, unknown>,
  finalByChannel: FinalByChannel,
  candidates: CandidateLike[],
  opts: BuildLaunchPackageOptions,
): BuiltLaunchPackage {
  const notes: string[] = [];
  const cardTitle = String(card.title ?? card.headline ?? "release").trim() || "release";
  const slug = typeof card.slug === "string" && card.slug.trim() ? slugify(card.slug) : slugify(cardTitle);
  const pkg: EmitPackage = { changelogSlug: slug };
  let dateChanges: DateChange[] = [];

  const blog = finalByChannel.blog;
  if (blog?.text?.trim()) {
    const title = extractChangelogTitle(blog.text, cardTitle);
    const normalized = normalizeBlogFrontmatter(blog.text, {
      title,
      today: opts.today,
      ...(opts.typefullyUrl ? { typefullyUrl: opts.typefullyUrl } : {}),
    });
    pkg.changelogMd = normalized.text;
    dateChanges = normalized.dateChanges;
    notes.push(...normalized.notes);
  }

  const web = finalByChannel.web;
  if (web?.text?.trim()) {
    const candidate = candidates.find((c) => c.id === web.candidate_id);
    const structured = candidate?.structured as WebCardStructured | undefined;
    if (structured?.kind === "web-card") {
      pkg.featureCard = { dataTsEntry: featureCardEntry(structured) };
    } else {
      notes.push("web approved but no structured web-card candidate found — feature card omitted");
    }
  }

  if (opts.roadmapTick) pkg.roadmapTick = opts.roadmapTick; // caller-supplied only — never guessed
  return { pkg, dateChanges, notes };
}
```

  **Note for the implementer:** read `markChangelogPublished` (emit-platform-pr.ts:501)
  before relying on it — if it requires an existing `published:` line rather than
  inserting one, add the insert in `normalizeBlogFrontmatter` and keep the test green.
  Likewise confirm the `dataTsEntry` trailing-comma format against how
  `appendFeatureCopyEntry` splices entries (its existing test at
  `__tests__/emit-platform-pr.test.ts:124` shows the expected shape) — adjust
  `featureCardEntry`'s template if the splice expects no trailing comma.

- [ ] **Step 6: Run tests + typecheck — verify green**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (including all pre-existing emit tests).

- [ ] **Step 7: Commit**

```bash
git add attached-services/comms-factory/src/emit-platform-pr.ts attached-services/comms-factory/src/freshen.ts attached-services/comms-factory/src/launch-package.ts attached-services/comms-factory/src/__tests__/launch-package.test.ts
git commit -m "feat(comms): launch-package mapper (final_by_channel -> emit package, live FEATURES_COPY schema)"
```

---

### Task 5: GitHub REST emit module (`src/github-emit.ts`)

No git/gh in the pod. Deterministic branch + Contents API PUT (blob sha ⇒ no
fast-forward problem) + Pulls API, idempotent at every step. Token travels in the
`Authorization` header ONLY — it is never interpolated into URLs, argv, errors, or logs.

**Files:**
- Modify: `attached-services/comms-factory/package.json` + `pnpm-lock.yaml` (add `diff`, dev `@types/diff`)
- Create: `attached-services/comms-factory/src/github-emit.ts`
- Test: `attached-services/comms-factory/src/__tests__/github-emit.test.ts`

- [ ] **Step 1: Add the diff dependency** (lockfile regen in the SAME commit — the image
  builds with `--frozen-lockfile`):

```bash
cd attached-services/comms-factory
pnpm add --ignore-workspace diff
pnpm add --ignore-workspace -D @types/diff
```

- [ ] **Step 2: Write the failing tests** — `src/__tests__/github-emit.test.ts`. Boot a
  local mock GitHub API server (createServer, same helpers as server.test.ts) recording
  every request `{method, url, headers.authorization, body}`; pass its address via
  `baseUrl` option. Use a fixture `EmitPackage` with blog + featureCard. Cases:

```ts
// 1. dry-run: returns plannedDiff naming both target paths; the request log contains
//    ZERO POST/PUT/PATCH/DELETE requests (reads only).
// 2. happy path (dryRun:false): requests in order —
//    GET  /repos/o/r/pulls?head=o:cf-emit/slug-run1&state=open   (preflight, returns [])
//    GET  /repos/o/r/git/ref/heads/main                          (returns sha "base123")
//    POST /repos/o/r/git/refs          body {ref: "refs/heads/cf-emit/slug-run1", sha: "base123"}
//    GET  /repos/o/r/contents/...blog path...?ref=cf-emit/slug-run1   (404 — new file)
//    GET  /repos/o/r/contents/...features path...?ref=...        (200, content b64 + sha "feat1")
//    PUT  /repos/o/r/contents/...blog path...    body {branch, content(b64), message} — NO sha
//    PUT  /repos/o/r/contents/...features path... body includes sha "feat1"
//    (reads-then-writes: the implementation computes ALL reads in the changes-building
//     loop, then PUTs in a second loop — assert THIS order, or per-file relative order)
//    POST /repos/o/r/pulls             body {title, head, base: "main"} → returns html_url
//    Result: {ok: true, prUrl: "<html_url>", existing: undefined}.
//    Every request carries authorization "Bearer test-token"; no URL contains "test-token".
// 3. pre-flight short-circuit: pulls?head returns an open PR → result {ok, prUrl, existing: true}
//    and the request log has exactly ONE request.
// 4. 422 on ref create ("Reference already exists") → flow continues to contents/PR.
// 5. 422 on PR create ("A pull request already exists") → falls back to GET pulls?head → prUrl.
// 6. 403 on a PUT → {ok: false, error: "github_permission_denied", status: 403};
//    JSON.stringify(result) does not contain "test-token".
// 7. features idempotency: branch features content already contains the entry title →
//    that PUT is skipped (absent from the request log), blog still written.
//    The fixture MUST be the re-indented spliced form — compute it with the real
//    appendFeatureCopyEntry(baseFixture, dataTsEntry), not a raw-pasted entry —
//    because the splice re-indents every line and a raw paste would not match
//    what a crash-retry actually reads back from the branch. Also add the
//    negative: branch features content WITHOUT the title marker → PUT happens.
// 8. paths with parens survive per-segment encoding: the features URL contains the
//    raw "(site)" segment (encodeURIComponent leaves parens unescaped per ECMA-262;
//    they are legal URI sub-delims and GitHub accepts them) and spaces/specials in
//    other segments WOULD be escaped.
// --- Hardenings deferred from the Task 5 review (implemented with Task 6) ---
// 9. transport rejection (mock server torn down before the call) => the TYPED envelope
//    {ok:false, error:"github_emit_failed", status:502, detail:"github_unreachable"} —
//    a fetch-level ECONNREFUSED/DNS failure must never escape as a raw throw.
// 10. transform error (roadmapTick names a missing node; mock serves a parseable
//     roadmap data.ts) => ok:false with detail containing the actionable message
//     ('roadmap node not found: "Missing"') — repo-shape/user-input messages are
//     token-safe by construction and must not be swallowed.
// 11. features file 404 at the ref => result.skipped is
//     ["<features path> not found at <ref> — change skipped"], ok:true, the blog PUT
//     and the PR still happen — a skip never silently vanishes an approved channel.
```

Write each as a real `it(...)` with full assertions against the recorded request log.

- [ ] **Step 3: Run — verify failure** (module not found).

- [ ] **Step 4: Implement `src/github-emit.ts`**

```ts
/**
 * REST-only platform emit: deterministic branch ref + Contents API PUTs (blob
 * sha => clean replace, no fast-forward concept) + Pulls API. Replaces the
 * git/gh-in-pod path (emitLaunchPR stays as the operator-laptop break-glass
 * twin). Idempotent: route-level pre-flight finds an existing PR; 422s on
 * ref/PR creation resolve to "already there"; contents are re-read from the
 * BRANCH on retry so replays never double-apply transforms.
 * The token is used ONLY as an Authorization header value.
 */
import { createTwoFilesPatch } from "diff";
import {
  appendFeatureCopyEntry,
  BLOG_DIR,
  buildPrBody,
  describeRoadmapChanges,
  ensureTrailingNewline,
  extractChangelogTitle,
  FEATURES_DATA_PATH,
  markRoadmapNodeDone,
  ROADMAP_DATA_PATH,
  type LaunchPackage,
  type RoadmapChangeSummary,
} from "./emit-platform-pr.js";
import type { EmitPackage } from "./launch-package.js";

export interface GithubEmitOptions {
  token: string;
  repo: string; // "owner/name"
  branch: string;
  dryRun: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface GithubEmitResult {
  ok: boolean;
  error?: "github_permission_denied" | "github_emit_failed";
  status?: number;
  /**
   * Token-safe failure context: repo-shape/user-input transform messages
   * ("roadmap node not found: X") or the "github_unreachable" transport
   * marker. The token only ever lives in a request header, never a message.
   */
  detail?: string;
  prUrl: string | null;
  plannedDiff: string | null;
  branch: string;
  existing?: boolean;
  /** Per-file skips (target absent at the ref) — surfaced, never silently dropped. */
  skipped: string[];
}

type Gh = (path: string, init?: RequestInit) => Promise<{ status: number; json: unknown }>;

function makeGh(opts: GithubEmitOptions): Gh {
  const base = (opts.baseUrl ?? process.env.GITHUB_API_BASE_URL ?? "https://api.github.com").replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  return async (path, init) => {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      // Transport-level rejection (DNS, ECONNREFUSED, reset): keep the typed
      // contract — a constant message, never the raw cause (token-safe).
      throw Object.assign(new Error("github_unreachable"), { status: 502 });
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, json };
  };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

const b64encode = (s: string) => Buffer.from(s, "utf8").toString("base64");
const b64decode = (s: string) => Buffer.from(s, "base64").toString("utf8");

interface FileChange { path: string; before: string | null; after: string; sha: string | null; skip: boolean }

function failResult(branch: string, status: number, detail?: string): GithubEmitResult {
  return {
    ok: false,
    error: status === 401 || status === 403 ? "github_permission_denied" : "github_emit_failed",
    status,
    ...(detail ? { detail } : {}),
    prUrl: null,
    plannedDiff: null,
    branch,
    skipped: [],
  };
}

export async function emitViaRest(pkg: EmitPackage, opts: GithubEmitOptions): Promise<GithubEmitResult> {
  try {
    return await emitViaRestInner(pkg, opts);
  } catch (error) {
    // Transport rejections (and any other stray throw in the network phases)
    // resolve to the typed failure envelope — callers never see a raw throw.
    const typed = error as { status?: number };
    if (typed.status === undefined) {
      // Unexpected programmer-error throw (not a typed transport failure) — log it so
      // it doesn't silently masquerade as a soft GitHub failure.
      const detail = error instanceof Error ? error.message.slice(0, 400) : String(error);
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", service: "comms-factory-api", event: "github_emit_unexpected", detail }));
    }
    return failResult(
      opts.branch,
      typed.status ?? 500,
      error instanceof Error ? error.message.slice(0, 200) : undefined,
    );
  }
}

async function emitViaRestInner(pkg: EmitPackage, opts: GithubEmitOptions): Promise<GithubEmitResult> {
  const gh = makeGh(opts);
  const [owner] = opts.repo.split("/");
  const skipped: string[] = [];
  const fail = (status: number, detail?: string): GithubEmitResult =>
    failResult(opts.branch, status, detail);

  // 1. Pre-flight idempotency — BEFORE any mutation (double-click / crash-retry).
  const preflight = await gh(`/repos/${opts.repo}/pulls?head=${encodeURIComponent(`${owner}:${opts.branch}`)}&state=open`);
  if (preflight.status >= 400) return fail(preflight.status);
  const existingPr = Array.isArray(preflight.json) ? (preflight.json[0] as { html_url?: string } | undefined) : undefined;
  if (existingPr?.html_url) {
    return { ok: true, prUrl: existingPr.html_url, plannedDiff: null, branch: opts.branch, existing: true, skipped };
  }

  // 2. Base sha.
  const ref = await gh(`/repos/${opts.repo}/git/ref/heads/main`);
  if (ref.status >= 400) return fail(ref.status);
  const baseSha = (ref.json as { object?: { sha?: string } })?.object?.sha;
  if (!baseSha) return fail(500);

  // Helper: read a file at a ref (null when absent).
  const readFileAt = async (path: string, at: string): Promise<{ content: string; sha: string } | null> => {
    const res = await gh(`/repos/${opts.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(at)}`);
    if (res.status === 404) return null;
    if (res.status >= 400) throw Object.assign(new Error("github_read_failed"), { status: res.status });
    const body = res.json as { content?: string; sha?: string };
    return { content: b64decode(body.content ?? ""), sha: body.sha ?? "" };
  };

  // 3-4. Compute file changes (dry-run reads from main; real path reads from the
  // branch AFTER creating it, so retries see already-applied transforms).
  let roadmapChanges: RoadmapChangeSummary[] = [];
  const readRef = opts.dryRun ? "main" : opts.branch;

  if (!opts.dryRun) {
    const created = await gh(`/repos/${opts.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${opts.branch}`, sha: baseSha }),
    });
    // 422 "Reference already exists" => crash-retry — continue idempotently.
    if (created.status >= 400 && created.status !== 422) return fail(created.status);
  }

  let changes: FileChange[];
  try {
    changes = [];
    if (pkg.changelogMd) {
      const path = `${BLOG_DIR}/${pkg.changelogSlug}.md`;
      const current = await readFileAt(path, readRef);
      const after = ensureTrailingNewline(pkg.changelogMd);
      changes.push({ path, before: current?.content ?? null, after, sha: current?.sha ?? null, skip: current?.content === after });
    }
    if (pkg.roadmapTick) {
      const current = await readFileAt(ROADMAP_DATA_PATH, readRef);
      if (current) {
        roadmapChanges = describeRoadmapChanges(current.content, pkg.roadmapTick);
        const after = markRoadmapNodeDone(current.content, pkg.roadmapTick);
        changes.push({ path: ROADMAP_DATA_PATH, before: current.content, after, sha: current.sha, skip: after === current.content });
      } else {
        // Surfaced, never silently dropped: an approved channel must not vanish.
        skipped.push(`${ROADMAP_DATA_PATH} not found at ${readRef} — change skipped`);
      }
    }
    if (pkg.featureCard) {
      const current = await readFileAt(FEATURES_DATA_PATH, readRef);
      if (current) {
        // Replay-safe skip: appendFeatureCopyEntry re-indents the entry when
        // splicing, so raw-prefix matching can never hit. Intra-line content
        // survives — match on the trimmed title property line instead.
        const marker = pkg.featureCard.dataTsEntry
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("title:"));
        const alreadyApplied = Boolean(marker && current.content.includes(marker));
        const after = alreadyApplied ? current.content : appendFeatureCopyEntry(current.content, pkg.featureCard.dataTsEntry);
        changes.push({ path: FEATURES_DATA_PATH, before: current.content, after, sha: current.sha, skip: alreadyApplied });
      } else {
        skipped.push(`${FEATURES_DATA_PATH} not found at ${readRef} — change skipped`);
      }
    }
  } catch (error) {
    // Transform errors here are repo-shape/user-input messages ("roadmap node
    // not found: X") — actionable and token-safe by construction.
    return fail(
      (error as { status?: number }).status ?? 500,
      error instanceof Error ? error.message.slice(0, 200) : undefined,
    );
  }

  if (opts.dryRun) {
    const plannedDiff = changes
      .map((c) => createTwoFilesPatch(c.path, c.path, c.before ?? "", c.after))
      .join("\n");
    return { ok: true, prUrl: null, plannedDiff, branch: opts.branch, skipped };
  }

  // 5. PUT contents (blob sha => clean replace), skipping already-applied files.
  for (const change of changes) {
    if (change.skip) continue;
    const put = await gh(`/repos/${opts.repo}/contents/${encodePath(change.path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Emit ${pkg.changelogSlug} launch comms: ${change.path}`,
        content: b64encode(change.after),
        branch: opts.branch,
        ...(change.sha ? { sha: change.sha } : {}),
      }),
    });
    if (put.status >= 400) return fail(put.status);
  }

  // 6. Open the PR (422 "already exists" => fetch and return it).
  const title = pkg.changelogMd
    ? extractChangelogTitle(pkg.changelogMd, pkg.changelogSlug)
    : `Update FEATURES_COPY: ${pkg.changelogSlug}`;
  const body = pkg.changelogMd
    ? buildPrBody(pkg as LaunchPackage, roadmapChanges)
    : `Emitted by comms-factory from an approved launch package.\n\n- Feature card: appended to \`FEATURES_COPY[]\`\n\nhuman-approve, DO NOT merge`;
  const pr = await gh(`/repos/${opts.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head: opts.branch, base: "main", body }),
  });
  if (pr.status === 422) {
    const again = await gh(`/repos/${opts.repo}/pulls?head=${encodeURIComponent(`${owner}:${opts.branch}`)}&state=open`);
    const found = Array.isArray(again.json) ? (again.json[0] as { html_url?: string } | undefined) : undefined;
    if (found?.html_url) return { ok: true, prUrl: found.html_url, plannedDiff: null, branch: opts.branch, existing: true, skipped };
    return fail(422);
  }
  if (pr.status >= 400) return fail(pr.status);
  return { ok: true, prUrl: (pr.json as { html_url?: string })?.html_url ?? null, plannedDiff: null, branch: opts.branch, skipped };
}
```

- [ ] **Step 5: Run tests + typecheck — verify green**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit** (lockfile included)

```bash
git add attached-services/comms-factory/package.json attached-services/comms-factory/pnpm-lock.yaml attached-services/comms-factory/src/github-emit.ts attached-services/comms-factory/src/__tests__/github-emit.test.ts
git commit -m "feat(comms): GitHub REST emit (pre-flight idempotent branch+contents+PR, header-only token)"
```

---

### Task 6: `POST /emit` route

Also carries the three hardenings the Task 5 review deferred here (small edits to
`src/github-emit.ts`): (A) transport rejections resolve to the typed envelope
(`status:502, detail:"github_unreachable"`) instead of throwing raw; (B) transform
errors surface as `detail` instead of being swallowed; (C) absent-file skips are
recorded in `skipped: string[]` and merged into the route's `notes` — see Task 5
test cases 9–11 and the updated Task 5 code block.

**Files:**
- Create: `attached-services/comms-factory/services/api/routes/emit.ts`
- Modify: `attached-services/comms-factory/services/api/server.ts` (register `/emit`)
- Modify: `attached-services/comms-factory/src/github-emit.ts` (hardenings A/B/C above)
- Test: `attached-services/comms-factory/services/api/routes/emit.test.ts`
- Test: `attached-services/comms-factory/src/__tests__/github-emit.test.ts` (cases 9–11)

- [ ] **Step 1: Write the failing tests** — `routes/emit.test.ts`, calling `handleEmit`
  directly with a fake `RequestContext` (Task 3 pattern) against the Task 5 mock GitHub
  server (set `GITHUB_API_BASE_URL`). Cases:
  1. **not configured**: `GITHUB_TOKEN` unset → `{ok:false, error:"github_not_configured"}`,
     zero requests to the mock.
  2. **deterministic default branch**: body with `run_id: "run_1"`, card title
     "Perps launch", `dry_run: false` → mock receives ref create for
     `refs/heads/cf-emit/perps-launch-run_1`; response carries `branch` + `slug`.
  3. **dry-run is the default**: body without `dry_run` → only GET requests; response has
     `planned_diff` and `pr_url: null`.
  4. **nothing to emit**: `final_by_channel` with only `x` approved →
     `{ok:false, error:"nothing_to_emit"}`.
  5. **typefully_url threads through**: with `typefully_url` set, the blog PUT body
     (base64-decoded) contains `typefullyUrl:`.
  6. **explicit branch override**: `branch: "cf-emit/custom-run_1"` is used verbatim;
     an unsafe branch (`"main"` or `"content/x"`) throws 400 (assertSafeBranch + an
     explicit `cf-emit/` prefix guard — Keystatic automation owns `content/*` branches).
  7. **skips become notes** (hardening C, route side): features file 404 at the ref
     (web approved with a structured web-card candidate, `dry_run: false`) → response
     `ok: true`, `notes` contains `"<features path> not found at <branch> — change
     skipped"`, and the blog PUT + PR still happen.
  8. **transport failure is typed** (hardening A, route side): mock torn down before
     the call → response `{ok:false, error:"github_emit_failed", status:502,
     detail:"github_unreachable"}` — never a raw throw; no token in the body.

- [ ] **Step 2: Run — verify failure.**

- [ ] **Step 3: Implement `routes/emit.ts`**

```ts
import { assertSafeBranch } from "../../../src/emit-platform-pr.js";
import { emitViaRest } from "../../../src/github-emit.js";
import {
  buildLaunchPackage,
  type CandidateLike,
  type FinalByChannel,
} from "../../../src/launch-package.js";
import {
  assertRecord,
  HttpError,
  optionalString,
  requiredString,
  type JsonResponse,
  type RequestContext,
} from "../http.js";

export async function handleEmit(ctx: RequestContext): Promise<JsonResponse> {
  const body = assertRecord(ctx.body);
  // The shared infra fine-grained PAT, upgraded to Contents+PR write (operator
  // decision). "PRs only, never lands code" is enforced by platform's main
  // branch protection (pull_request ruleset, enforcement: everyone) — verified
  // 2026-06-12 — not by the token.
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return { body: { ok: false, error: "github_not_configured" } };

  const card = assertRecord(body.release_card ?? body.card, "missing_release_card");
  const finalByChannel = assertRecord(body.final_by_channel, "missing_final_by_channel") as FinalByChannel;
  const candidates = (Array.isArray(body.candidates) ? body.candidates : []) as CandidateLike[];
  const runId = requiredString(body, "run_id");
  const dryRun = body.dry_run !== false; // default TRUE — mutations require explicit dry_run:false

  // Hoisted const: exactOptionalPropertyTypes — see the same pattern in Task 3.
  const typefullyUrl = optionalString(body, "typefully_url");
  const built = buildLaunchPackage(card, finalByChannel, candidates, {
    today: new Date().toISOString().slice(0, 10),
    ...(typefullyUrl ? { typefullyUrl } : {}),
  });
  if (!built.pkg.changelogMd && !built.pkg.featureCard) {
    return { body: { ok: false, error: "nothing_to_emit" } };
  }

  const branch = optionalString(body, "branch") ?? `cf-emit/${built.pkg.changelogSlug}-${runId}`;
  // cf-emit/ prefix is load-bearing: Keystatic Cloud automation owns content/* branches.
  if (!branch.startsWith("cf-emit/")) throw new HttpError(400, "invalid_branch", "emit branches must use the cf-emit/ prefix");
  assertSafeBranch(branch);

  const repo = process.env.COMMS_PLATFORM_REPO?.trim() || "infinex-xyz/platform";
  const result = await emitViaRest(built.pkg, { token, repo, branch, dryRun });
  return {
    body: {
      ok: result.ok,
      ...(result.error
        ? {
            error: result.error,
            status: result.status,
            // Token-safe by construction (transform/transport messages only).
            ...(result.detail ? { detail: result.detail } : {}),
          }
        : {}),
      pr_url: result.prUrl,
      planned_diff: result.plannedDiff,
      existing: result.existing ?? false,
      branch,
      slug: built.pkg.changelogSlug,
      date_changes: built.dateChanges,
      // Per-file emit skips never vanish an approved channel silently.
      notes: [...built.notes, ...result.skipped],
    },
  };
}
```

Register in `server.ts`'s POST list: `["/emit", handleEmit],`.

- [ ] **Step 4: Run all tests + typecheck — verify green.** `pnpm test && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add attached-services/comms-factory/services/api/routes/emit.ts attached-services/comms-factory/services/api/routes/emit.test.ts attached-services/comms-factory/services/api/server.ts attached-services/comms-factory/src/github-emit.ts attached-services/comms-factory/src/__tests__/github-emit.test.ts
git commit -m "feat(comms): POST /emit route (dry-run default, deterministic cf-emit/ branch) + emit hardenings (typed 502 transport envelope, transform-error detail, skip notes)"
```

---

### Task 7: display.dev client (`src/display.ts`) + `@displaydev/cli` dependency

In-pod auth is the `DISPLAYDEV_API_KEY` env var — **verified 2026-06-12**: the published
CLI reads `DISPLAYDEV_API_KEY` (and honors `DISPLAYDEV_SKIP_BROWSER`) from env, so the
key never appears in argv. The client wraps the trial-validated `dsp` commands with an
injectable runner (same DI pattern as `emit-platform-pr.ts`'s `CommandRunner`).

**Files:**
- Modify: `attached-services/comms-factory/package.json` + `pnpm-lock.yaml` (add `@displaydev/cli`)
- Create: `attached-services/comms-factory/src/display.ts`
- Test: `attached-services/comms-factory/src/__tests__/display.test.ts`

- [ ] **Step 1: Add the dependency** (lockfile regen in the SAME commit):

```bash
cd attached-services/comms-factory
pnpm add --ignore-workspace @displaydev/cli
```

- [ ] **Step 2: Probe the CLI's output contract** (verify-and-adapt step — the flag set
  below is trial-validated 2026-06-11; the OUTPUT format needs pinning):

```bash
pnpm exec dsp --help
pnpm exec dsp publish --help
pnpm exec dsp comment list --help
```

Look for a `--json` (or `--output json`) flag. If present, pass it on every invocation
and parse stdout as JSON. If not, adapt the `parse*` functions below to the human
output the trial produced (`short_id`, URL, `version`; comment list rows with body +
textQuote + root id + `createdOnVersion`). Record what you found in the commit message.

- [ ] **Step 3: Write the failing tests** — `src/__tests__/display.test.ts` with a fake
  runner (no real CLI calls):

```ts
import { describe, expect, it } from "vitest";
import { deleteArtifact, listComments, publishArtifact, redactDisplayKey, resolveThread, stripFrontmatter, type DspRunner } from "../display.js";

function fakeRunner(stdout: string): { runner: DspRunner; calls: Array<{ args: readonly string[]; stdin?: string }> } {
  const calls: Array<{ args: readonly string[]; stdin?: string }> = [];
  return {
    calls,
    runner: async (args, opts) => {
      calls.push({ args, ...(opts?.stdin !== undefined ? { stdin: opts.stdin } : {}) });
      return { stdout, stderr: "" };
    },
  };
}

const PUBLISH_JSON = JSON.stringify({ short_id: "abc123", url: "https://dsp.so/a/abc123", version: 1 });

describe("stripFrontmatter", () => {
  it("removes a leading YAML block (display renders it literally)", () => {
    expect(stripFrontmatter("---\ntitle: x\n---\n\nBody")).toBe("Body");
    expect(stripFrontmatter("No frontmatter")).toBe("No frontmatter");
  });
});

describe("publishArtifact", () => {
  it("publishes v1 private with reviewer allowlist, markdown via stdin, no key in argv", async () => {
    const { runner, calls } = fakeRunner(PUBLISH_JSON);
    const result = await publishArtifact(
      { markdown: "---\ntitle: t\n---\n\nDraft body", name: "perps-launch-blog", share: ["a@x.com", "b@x.com"] },
      runner,
    );
    expect(calls[0]?.args.slice(0, 2)).toEqual(["publish", "-"]);
    expect(calls[0]?.args).toContain("--visibility");
    expect(calls[0]?.args).toContain("private");
    expect(calls[0]?.args.join(" ")).toContain("--share a@x.com");
    expect(calls[0]?.args.join(" ")).toContain("--share b@x.com");
    expect(calls[0]?.stdin).toBe("Draft body"); // frontmatter stripped
    expect(calls[0]?.args.join(" ")).not.toContain("sk_live"); // env-auth only
    expect(result).toEqual({ shortId: "abc123", url: "https://dsp.so/a/abc123", version: 1 });
  });

  it("updates the same artifact with --id --base-version --reload", async () => {
    const { runner, calls } = fakeRunner(JSON.stringify({ short_id: "abc123", url: "u", version: 2 }));
    await publishArtifact({ markdown: "v2", name: "n", id: "abc123", baseVersion: 1 }, runner);
    expect(calls[0]?.args.join(" ")).toContain("--id abc123");
    expect(calls[0]?.args.join(" ")).toContain("--base-version 1");
    expect(calls[0]?.args).toContain("--reload");
  });
});

describe("listComments", () => {
  it("parses open threads into {id, body, textQuote, createdOnVersion}", async () => {
    const { runner, calls } = fakeRunner(JSON.stringify([
      { id: "c1", body: "tighten this", anchor: { textQuote: "perps are live" }, createdOnVersion: 1 },
    ]));
    const comments = await listComments("abc123", { status: "open" }, runner);
    expect(calls[0]?.args.join(" ")).toContain("comment list --artifact abc123 --status open");
    expect(comments).toEqual([{ id: "c1", body: "tighten this", textQuote: "perps are live", createdOnVersion: 1 }]);
  });
});

describe("resolveThread / deleteArtifact", () => {
  it("resolves a thread and deletes with --confirm", async () => {
    const a = fakeRunner("{}");
    await resolveThread("c1", a.runner);
    expect(a.calls[0]?.args.join(" ")).toContain("thread resolve c1");
    const b = fakeRunner("{}");
    await deleteArtifact("abc123", b.runner);
    expect(b.calls[0]?.args.join(" ")).toContain("delete abc123 --confirm");
  });
});

describe("redactDisplayKey", () => {
  it("strips the API key from CLI output before it can reach an Error message", () => {
    process.env.DISPLAYDEV_API_KEY = "sk_live_secret";
    try {
      expect(redactDisplayKey("auth failed for sk_live_secret (expired)")).toBe(
        "auth failed for [redacted] (expired)",
      );
    } finally {
      delete process.env.DISPLAYDEV_API_KEY;
    }
  });
});
```

- [ ] **Step 4: Run — verify failure**, then **implement `src/display.ts`**:

```ts
/**
 * display.dev client wrapping the @displaydev/cli (`dsp`) binary — the loop's
 * commands were trial-validated 2026-06-11 (publish/comment list/thread
 * resolve/delete). Auth is the DISPLAYDEV_API_KEY env var (the CLI reads it
 * natively — verified against the published package); the key NEVER appears in
 * argv. DISPLAYDEV_SKIP_BROWSER=1 keeps the CLI headless in-pod.
 * If Step 2's probe found no --json flag, adapt the parse* helpers to the
 * trial's text output and update the fake-runner fixtures to match.
 */
import { spawn } from "node:child_process";

export type DspRunner = (args: readonly string[], opts?: { stdin?: string }) => Promise<{ stdout: string; stderr: string }>;

export function displayConfigured(): boolean {
  return Boolean(process.env.DISPLAYDEV_API_KEY?.trim());
}

/** Third-party CLI stderr may echo the key in auth-failure diagnostics — strip
 *  it before the text can reach an Error message (http.ts echoes messages into
 *  500 bodies and logs unsanitized). Exported for direct testing. */
export function redactDisplayKey(text: string): string {
  const key = process.env.DISPLAYDEV_API_KEY?.trim();
  return key ? text.split(key).join("[redacted]") : text;
}

export const defaultRunner: DspRunner = (args, opts) =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "dsp", ...args], {
      env: { ...process.env, DISPLAYDEV_SKIP_BROWSER: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString("utf8"); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf8"); });
    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`dsp ${args[0]} exited ${code}: ${redactDisplayKey(stderr).slice(0, 300)}`));
    });
    if (opts?.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });

export function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n+/);
  return match ? markdown.slice(match[0].length) : markdown;
}

export interface PublishOptions {
  markdown: string;
  name: string;
  visibility?: "private" | "company";
  share?: string[];
  id?: string;
  baseVersion?: number;
}

export interface PublishResult { shortId: string; url: string; version: number }

export async function publishArtifact(opts: PublishOptions, runner: DspRunner = defaultRunner): Promise<PublishResult> {
  const args = [
    "publish", "-",
    "--name", opts.name,
    "--visibility", opts.visibility ?? "private",
    "--theme", "github",
    "--json",
  ];
  for (const email of opts.share ?? []) args.push("--share", email);
  if (opts.id) args.push("--id", opts.id, "--base-version", String(opts.baseVersion ?? 1), "--reload");
  const { stdout } = await runner(args, { stdin: stripFrontmatter(opts.markdown) });
  const parsed = JSON.parse(stdout) as { short_id?: string; id?: string; url?: string; version?: number };
  return {
    shortId: String(parsed.short_id ?? parsed.id ?? ""),
    url: String(parsed.url ?? ""),
    version: Number(parsed.version ?? 1),
  };
}

export interface DisplayComment { id: string; body: string; textQuote: string; createdOnVersion: number }

export async function listComments(
  artifactId: string,
  opts: { status?: "open" | "resolved" } = {},
  runner: DspRunner = defaultRunner,
): Promise<DisplayComment[]> {
  const { stdout } = await runner(["comment", "list", "--artifact", artifactId, "--status", opts.status ?? "open", "--json"]);
  const rows = JSON.parse(stdout) as Array<{ id?: string; body?: string; anchor?: { textQuote?: string }; createdOnVersion?: number }>;
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id ?? ""),
    body: String(r.body ?? ""),
    textQuote: String(r.anchor?.textQuote ?? ""),
    createdOnVersion: Number(r.createdOnVersion ?? 0),
  }));
}

export async function resolveThread(rootCommentId: string, runner: DspRunner = defaultRunner): Promise<void> {
  await runner(["thread", "resolve", rootCommentId, "--json"]);
}

export async function deleteArtifact(shortId: string, runner: DspRunner = defaultRunner): Promise<void> {
  await runner(["delete", shortId, "--confirm", "--json"]);
}
```

  (If the probe in Step 2 found no `--json`: remove the flag and swap `JSON.parse` for
  text parsing matched to real output — keep the tests' fake-runner fixtures in sync.)

- [ ] **Step 5: Run tests + typecheck — verify green.** `pnpm test && pnpm typecheck`

- [ ] **Step 6: Commit** (lockfile included)

```bash
git add attached-services/comms-factory/package.json attached-services/comms-factory/pnpm-lock.yaml attached-services/comms-factory/src/display.ts attached-services/comms-factory/src/__tests__/display.test.ts
git commit -m "feat(comms): display.dev client wrapping dsp CLI (env auth, headless, injectable runner)"
```

---

### Task 8: `POST /display/{publish,comments,resolve,unpublish}` routes

Thin handlers over Task 7, built with explicit dependency injection (a `deps` object)
so route tests need no module mocking.

**Files:**
- Create: `attached-services/comms-factory/services/api/routes/display.ts`
- Modify: `attached-services/comms-factory/services/api/server.ts` (register 4 routes)
- Test: `attached-services/comms-factory/services/api/routes/display.test.ts`

- [ ] **Step 1: Write the failing tests** — construct handlers with fake deps:

```ts
import { describe, expect, it } from "vitest";
import { makeDisplayHandlers } from "./display.js";

function ctx(body: unknown) {
  return { request: {} as never, method: "POST", url: new URL("http://x/display"), body, requestId: "t" };
}

const fakes = {
  displayConfigured: () => true,
  publishArtifact: async () => ({ shortId: "abc", url: "https://dsp.so/a/abc", version: 1 }),
  listComments: async () => [{ id: "c1", body: "b", textQuote: "q", createdOnVersion: 1 }],
  resolveThread: async () => {},
  deleteArtifact: async () => {},
};
```

Cases:
1. **not configured**: `displayConfigured: () => false` → every handler returns
   `{ok:false, error:"display_not_configured"}` without calling its dep.
2. **publish**: body `{markdown, name, share: ["a@x.com"]}` → fake called with
   visibility defaulted to `"private"`; returns `{ok, short_id: "abc", url, version: 1}`.
   Update form: `{markdown, name, id: "abc", base_version: 1}` → dep receives id+baseVersion.
3. **comments**: `{short_id: "abc"}` → `{ok, comments: [{id, body, text_quote, created_on_version}]}`
   (snake_case envelope for the Python client).
4. **resolve**: `{root_comment_id: "c1"}` → `{ok: true}`; **idempotent**: a dep that throws
   `"already resolved"` still returns `{ok: true}`.
5. **unpublish**: `{short_id: "abc"}` → `{ok: true}`; a dep throwing "not found" still
   returns `{ok: true}` (teardown is idempotent).
6. **missing required fields** → HttpError 400 (`missing_markdown`, `missing_short_id`, …).

- [ ] **Step 2: Run — verify failure**, then **implement `routes/display.ts`**:

```ts
import { deleteArtifact, displayConfigured, listComments, publishArtifact, resolveThread } from "../../../src/display.js";
import { assertRecord, optionalString, requiredString, stringArray, type Handler, type JsonResponse, type RequestContext } from "../http.js";

export interface DisplayDeps {
  displayConfigured: typeof displayConfigured;
  publishArtifact: typeof publishArtifact;
  listComments: typeof listComments;
  resolveThread: typeof resolveThread;
  deleteArtifact: typeof deleteArtifact;
}

const realDeps: DisplayDeps = { displayConfigured, publishArtifact, listComments, resolveThread, deleteArtifact };

const NOT_CONFIGURED: JsonResponse = { body: { ok: false, error: "display_not_configured" } };

export function makeDisplayHandlers(deps: DisplayDeps = realDeps): Record<string, Handler> {
  return {
    "/display/publish": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const markdown = requiredString(body, "markdown");
      const name = requiredString(body, "name");
      const id = optionalString(body, "id");
      const result = await deps.publishArtifact({
        markdown,
        name,
        visibility: optionalString(body, "visibility") === "company" ? "company" : "private",
        share: stringArray(body.share),
        ...(id ? { id, baseVersion: Number(body.base_version ?? 1) } : {}),
      });
      return { body: { ok: true, short_id: result.shortId, url: result.url, version: result.version } };
    },
    "/display/comments": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const shortId = requiredString(body, "short_id");
      const status = optionalString(body, "status") === "resolved" ? "resolved" as const : "open" as const;
      const comments = await deps.listComments(shortId, { status });
      return {
        body: {
          ok: true,
          comments: comments.map((c) => ({ id: c.id, body: c.body, text_quote: c.textQuote, created_on_version: c.createdOnVersion })),
        },
      };
    },
    "/display/resolve": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const id = requiredString(body, "root_comment_id");
      try { await deps.resolveThread(id); } catch { /* resolving a resolved thread is a no-op */ }
      return { body: { ok: true } };
    },
    "/display/unpublish": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const shortId = requiredString(body, "short_id");
      try { await deps.deleteArtifact(shortId); } catch { /* teardown is idempotent */ }
      return { body: { ok: true } };
    },
  };
}
```

Register in `server.ts` — after the existing for-loop, add:

```ts
import { makeDisplayHandlers } from "./routes/display.js";
// …
for (const [path, handler] of Object.entries(makeDisplayHandlers())) {
  routes.set(`POST ${path}`, async (ctx) => {
    requirePostAuth(ctx.request);
    return handler(ctx);
  });
}
```

- [ ] **Step 3: Run all tests + typecheck — verify green.** `pnpm test && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add attached-services/comms-factory/services/api/routes/display.ts attached-services/comms-factory/services/api/routes/display.test.ts attached-services/comms-factory/services/api/server.ts
git commit -m "feat(comms): /display publish/comments/resolve/unpublish routes"
```

---

### Task 9: `POST /display/revise` — the seed-path revision route

The load-bearing new mechanic of the review loop (spec open-verification #6): the base
`/generate` regenerates from scratch; `/display/revise` drives the actor-director **seed
path** so the Actor revises the current copy against reviewer comments.
Verified entrypoint: `orchestrateActorDirectorWithRetries(card, ["blog"], opts)` with
`opts.seed_transcript` (`ActorTranscriptMessage[]` = `{role, content}`,
actor-director.ts:160-163) and `opts.seed_notes` (`DirectorNotes`, :180-199);
**seed_notes requires seed_transcript** (actor-orchestrator.ts:215-217).

**Files:**
- Modify: `attached-services/comms-factory/services/api/routes/display.ts` (add handler + pure seed builder)
- Modify: `attached-services/comms-factory/services/api/server.ts` (register `/display/revise`)
- Test: `attached-services/comms-factory/services/api/routes/display-revise.test.ts`

- [ ] **Step 0 (read-first):** read `buildActorTranscript` (src/actor-director.ts:725) and
  the seed docstring (src/actor-orchestrator.ts:204-218) to confirm how
  `previous_transcript` + `director_notes` are injected before finalizing the seed shapes.

- [ ] **Step 1: Write the failing tests** — `routes/display-revise.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildReviseSeeds, makeDisplayReviseHandler } from "./display.js";

const CARD = {
  kind: "launch-tier",
  title: "Perps launch",
  headline: "Perps launch", // required by the LaunchTier zod schema (card.ts:146)
  audience: ["blog"],
  deployed_facts: ["perps are live"],
  tier_reason: "test",
};
const MARKDOWN = "## Perps launch\n\nperps are live today.";
const COMMENTS = [
  { text_quote: "perps are live", body: "cite the venue" },
  { text_quote: "this span was rewritten away", body: "stale one" },
];

describe("buildReviseSeeds", () => {
  it("builds a prior-turn transcript carrying the current markdown verbatim", () => {
    const seeds = buildReviseSeeds(MARKDOWN, [{ textQuote: "perps are live", body: "cite the venue" }]);
    expect(seeds.seed_transcript).toHaveLength(2);
    expect(seeds.seed_transcript[0]?.role).toBe("user");
    expect(seeds.seed_transcript[1]).toEqual({ role: "assistant", content: MARKDOWN });
  });

  it("turns comments into DirectorNotes that quote the anchored span", () => {
    const seeds = buildReviseSeeds(MARKDOWN, [{ textQuote: "perps are live", body: "cite the venue" }]);
    expect(seeds.seed_notes.attempt).toBe(1);
    expect(seeds.seed_notes.notes.join(" ")).toContain("perps are live");
    expect(seeds.seed_notes.notes.join(" ")).toContain("cite the venue");
    expect(seeds.seed_notes.change?.copy?.length).toBe(1);
  });
});

describe("handleDisplayRevise", () => {
  function fakeOrchestrate(captured: { opts?: Record<string, unknown>; channels?: string[] }) {
    return async (_card: unknown, channels: string[], opts: Record<string, unknown>) => {
      captured.channels = channels;
      captured.opts = opts;
      return {
        picks: [{ id: "rev_1", channel: "blog", text: "REVISED MARKDOWN" }],
        selection_rationales: {},
        attempts: [{ records: [{ candidate: { id: "rev_1", channel: "blog" }, director_audit: { publication_gate: "pass" } }] }],
        exhausted: false,
      };
    };
  }

  it("feeds seeds + blog channel to the orchestrator and returns revised markdown + audit + stale anchors", async () => {
    const captured: { opts?: Record<string, unknown>; channels?: string[] } = {};
    const handler = makeDisplayReviseHandler(fakeOrchestrate(captured) as never);
    const result = await handler({
      request: {} as never, method: "POST", url: new URL("http://x/display/revise"), requestId: "t",
      body: { markdown: MARKDOWN, comments: COMMENTS, release_card: CARD, run_id: "run_1" },
    });
    expect(captured.channels).toEqual(["blog"]);
    const seeds = captured.opts as { seed_transcript?: Array<{ content: string }>; seed_notes?: { notes: string[] } };
    expect(seeds.seed_transcript?.[1]?.content).toBe(MARKDOWN);
    // the stale comment (textQuote absent from markdown) is NOT fed to the reviser:
    expect(seeds.seed_notes?.notes.join(" ")).not.toContain("stale one");
    expect(result.body).toMatchObject({
      ok: true,
      markdown: "REVISED MARKDOWN",
      director_audit: { publication_gate: "pass" },
      stale_anchors: [{ text_quote: "this span was rewritten away", body: "stale one" }],
    });
  });

  it("400s on an invalid release card", async () => {
    const handler = makeDisplayReviseHandler(fakeOrchestrate({}) as never);
    await expect(
      handler({ request: {} as never, method: "POST", url: new URL("http://x"), requestId: "t",
        body: { markdown: MARKDOWN, comments: [], release_card: { nope: true }, run_id: "r" } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns display_not_configured when the capability is off (no LLM call)", async () => {
    const captured: { opts?: Record<string, unknown> } = {};
    const handler = makeDisplayReviseHandler(fakeOrchestrate(captured) as never, () => false);
    const result = await handler({ request: {} as never, method: "POST", url: new URL("http://x"), requestId: "t",
      body: { markdown: MARKDOWN, comments: COMMENTS, release_card: CARD, run_id: "run_1" } });
    expect(result.body).toMatchObject({ ok: false, error: "display_not_configured" });
    expect(captured.opts).toBeUndefined(); // the orchestrator was never invoked
  });
});
```

- [ ] **Step 2: Run — verify failure**, then **implement** (append to `routes/display.ts`):

```ts
import { orchestrateActorDirectorWithRetries } from "../../../src/actor-orchestrator.js";
import { safeParseReleaseCard } from "../../../src/card.js";
import type { ActorTranscriptMessage, DirectorNotes } from "../../../src/actor-director.js";
import { HttpError } from "../http.js";

export interface ReviseComment { textQuote: string; body: string }

export function buildReviseSeeds(markdown: string, comments: ReviseComment[]): {
  seed_transcript: ActorTranscriptMessage[];
  seed_notes: DirectorNotes;
} {
  return {
    seed_transcript: [
      {
        role: "user",
        content:
          "You previously drafted the blog post below. Human reviewers have now left inline comments on the rendered draft. Revise the SAME post against their notes — do not start over.",
      },
      { role: "assistant", content: markdown },
    ],
    seed_notes: {
      attempt: 1,
      summary: `Human reviewers left ${comments.length} inline comment(s) on the published draft. Address each one; keep everything they did not flag.`,
      notes: comments.map((c) => `On the passage "${c.textQuote}": ${c.body}`),
      preserve: { through_action: true, beat_plan: true },
      change: { copy: comments.map((c) => c.body) },
    },
  };
}

type OrchestrateFn = typeof orchestrateActorDirectorWithRetries;

export function makeDisplayReviseHandler(
  orchestrate: OrchestrateFn = orchestrateActorDirectorWithRetries,
  configured: typeof displayConfigured = displayConfigured,
): Handler {
  return async (ctx: RequestContext) => {
    // Same capability gate as makeDisplayHandlers — without it an authenticated
    // caller could trigger a full LLM generation cycle while display is "off".
    if (!configured()) return NOT_CONFIGURED;
    const body = assertRecord(ctx.body);
    const markdown = requiredString(body, "markdown");
    const parsed = safeParseReleaseCard(body.release_card ?? body.card);
    if (!parsed.success) throw new HttpError(400, "invalid_release_card", "revise requires a valid ReleaseCard", parsed.error.flatten());
    const rawComments = (Array.isArray(body.comments) ? body.comments : []) as Array<Record<string, unknown>>;
    const all = rawComments.map((c) => ({
      textQuote: String(c.text_quote ?? c.textQuote ?? ""),
      body: String(c.body ?? ""),
    })).filter((c) => c.body);
    // A comment whose anchored span no longer appears in the current text is
    // "anchor stale — addressed or removed": reported, never re-fed.
    const live = all.filter((c) => c.textQuote && markdown.includes(c.textQuote));
    const stale = all.filter((c) => !c.textQuote || !markdown.includes(c.textQuote));
    if (live.length === 0) throw new HttpError(400, "no_actionable_comments", "no comment anchors match the current draft");
    const seeds = buildReviseSeeds(markdown, live);
    const result = await orchestrate(parsed.data, ["blog"], {
      mode: "live",
      maxAttempts: 2,
      n: 1,
      seed_transcript: seeds.seed_transcript,
      seed_notes: seeds.seed_notes,
    });
    const pick = result.picks.find((p) => p.channel === "blog");
    if (!pick?.text) return { body: { ok: false, error: "revise_produced_no_blog_candidate" } };
    const record = result.attempts.at(-1)?.records.find((r) => r.candidate.id === pick.id);
    return {
      body: {
        ok: true,
        markdown: pick.text,
        director_audit: record?.director_audit ?? null,
        stale_anchors: stale.map((c) => ({ text_quote: c.textQuote, body: c.body })),
      },
    };
  };
}
```

Register by adding the route to `makeDisplayHandlers`' returned record in
`routes/display.ts` (ONE registration pattern for all five display routes —
Task 8's `server.ts` loop then picks it up with no separate `routes.set`;
function declarations hoist, so the reference below the factory is fine):

```ts
// inside makeDisplayHandlers' return object:
    "/display/revise": makeDisplayReviseHandler(),
```

  **Implementer note:** the exact types on `result.picks`/`attempts` come from
  `ActorDirectorResult` — adjust property access to the real shape after Step 0's read,
  keeping the test contract identical.

- [ ] **Step 3: Run all tests + typecheck — verify green.** `pnpm test && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add attached-services/comms-factory/services/api/routes/display.ts attached-services/comms-factory/services/api/routes/display-revise.test.ts attached-services/comms-factory/services/api/server.ts
git commit -m "feat(comms): /display/revise — seeded single-channel blog revision (actor-director seed path)"
```

---

### Task 10: Python thin-client — `_get` + 8 delivery methods

**Files:**
- Modify: `overlays/comms-factory/tools/comms_factory/client.py`
- Test: `overlays/comms-factory/tests/test_comms_client.py` (new file)

The client today has **only `_post`** (client.py:139-175). `capabilities()` is the one
GET (the deployed server serves `/health` as GET and `http.ts` matches
`"${method} ${path}"` exactly) — add a sibling `_get` mirroring `_post` minus the JSON
body. All public methods become `POST /tools/comms_factory/<method>` automatically
(plugin auto-discovery; hot-reloaded). **`/tools` rejects unknown kwargs** — workflow
call args must match these signatures exactly.

- [ ] **Step 1: Write the failing tests** — `tests/test_comms_client.py`:

```python
from __future__ import annotations

import json
from pathlib import Path
import sys

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "tools" / "comms_factory"))

import client as client_module  # noqa: E402
from client import CommsFactoryClient  # noqa: E402


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = json.dumps(self._payload)

    @property
    def is_success(self):
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


def _fake_httpx_client(monkeypatch, payload, captured):
    class _FakeClient:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, headers=None):
            captured.update({"method": "GET", "url": url, "headers": headers or {}})
            return _FakeResponse(payload=payload)

    monkeypatch.setattr(client_module.httpx, "Client", _FakeClient)


def test_capabilities_is_a_get_to_health_with_bearer_auth(monkeypatch):
    captured: dict = {}
    _fake_httpx_client(
        monkeypatch,
        {"ok": True, "capabilities": {"platform_pr": True, "typefully": 0, "display": "yes"}},
        captured,
    )
    result = CommsFactoryClient(base_url="http://svc:8080", token="tok").capabilities()
    assert captured["method"] == "GET"
    assert captured["url"] == "http://svc:8080/health"
    assert captured["headers"]["Authorization"] == "Bearer tok"
    # booleans coerced, never raw values:
    assert result["capabilities"] == {"platform_pr": True, "typefully": False, "display": True}


def test_capabilities_without_base_url_is_a_safe_error():
    result = CommsFactoryClient(base_url="", token="").capabilities()
    assert result["ok"] is False


def _capture_post(monkeypatch, client):
    captured: dict = {}

    def fake_post(path, payload, **kwargs):
        captured["path"] = path
        captured["payload"] = payload
        return {"ok": True}

    monkeypatch.setattr(client, "_post", fake_post)
    return captured


def test_emit_platform_pr_envelope(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured = _capture_post(monkeypatch, c)
    c.emit_platform_pr({"title": "T"}, {"blog": {"text": "b"}}, [], dry_run=True, run_id="r1")
    assert captured["path"] == "/emit"
    assert captured["payload"]["dry_run"] is True
    assert captured["payload"]["run_id"] == "r1"
    assert "branch" not in captured["payload"]  # only sent when explicitly set
    assert "typefully_url" not in captured["payload"]


def test_typefully_draft_envelope(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured = _capture_post(monkeypatch, c)
    c.typefully_draft("x-thread", tweets=["t1", "t2"], title="T", scratchpad="run r1")
    assert captured["path"] == "/typefully-draft"
    assert captured["payload"]["tweets"] == ["t1", "t2"]
    assert "text" not in captured["payload"]


def test_display_method_envelopes(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured = _capture_post(monkeypatch, c)
    c.display_publish("md", name="n", share=["a@x.com"])
    assert captured["path"] == "/display/publish"
    assert captured["payload"]["visibility"] == "private"
    c.display_publish("md", name="n", short_id="abc", base_version=2)
    assert captured["payload"]["id"] == "abc"
    assert captured["payload"]["base_version"] == 2
    c.display_comments("abc")
    assert captured["path"] == "/display/comments"
    assert captured["payload"] == {"short_id": "abc", "status": "open"}
    c.display_revise("md", [{"text_quote": "q", "body": "b"}], run_id="r1", release_card={"k": 1})
    assert captured["path"] == "/display/revise"
    c.display_resolve("c1")
    assert captured["payload"] == {"root_comment_id": "c1"}
    c.display_unpublish("abc")
    assert captured["payload"] == {"short_id": "abc"}
```

- [ ] **Step 2: Run — verify failure**

Run: `uv run --project services/api pytest overlays/comms-factory/tests/test_comms_client.py -q`
Expected: FAIL — `capabilities` attribute missing.

- [ ] **Step 3: Implement** — add to `CommsFactoryClient` (public methods after
  `generate`, `_get` next to `_post`):

```python
    def capabilities(self) -> dict[str, Any]:
        """Probe delivery capabilities — the ONE GET (server matches 'GET /health')."""
        result = self._get("/health")
        raw = result.get("capabilities")
        caps = raw if isinstance(raw, dict) else {}
        return {
            "ok": bool(result.get("ok")),
            "capabilities": {
                "platform_pr": bool(caps.get("platform_pr")),
                "typefully": bool(caps.get("typefully")),
                "display": bool(caps.get("display")),
            },
        }

    # NOTE: no **kwargs on the delivery methods — the tool manager skips its
    # unknown-arg rejection for VAR_KEYWORD signatures, which would silently
    # forward mis-typed workflow args instead of raising
    # tool_argument_validation_failed.
    def emit_platform_pr(
        self,
        release_card: dict[str, Any],
        final_by_channel: dict[str, Any],
        candidates: list[dict[str, Any]],
        *,
        dry_run: bool = True,
        branch: str | None = None,
        run_id: str | None = None,
        typefully_url: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "release_card": release_card,
            "final_by_channel": final_by_channel,
            "candidates": candidates,
            "dry_run": dry_run,
            "run_id": run_id,
        }
        if branch:
            payload["branch"] = branch
        if typefully_url:
            payload["typefully_url"] = typefully_url
        return self._post("/emit", payload, timeout=_LONG_TIMEOUT)

    def typefully_draft(
        self,
        channel: str,
        *,
        text: str | None = None,
        tweets: list[str] | None = None,
        title: str | None = None,
        scratchpad: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"channel": channel}
        if text is not None:
            payload["text"] = text
        if tweets is not None:
            payload["tweets"] = tweets
        if title:
            payload["title"] = title
        if scratchpad:
            payload["scratchpad"] = scratchpad
        return self._post("/typefully-draft", payload, timeout=_LONG_TIMEOUT)

    def display_publish(
        self,
        markdown: str,
        *,
        name: str,
        visibility: str = "private",
        share: list[str] | None = None,
        short_id: str | None = None,
        base_version: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"markdown": markdown, "name": name, "visibility": visibility}
        if share:
            payload["share"] = share
        if short_id:
            payload["id"] = short_id
            payload["base_version"] = base_version or 1
        return self._post("/display/publish", payload, timeout=_LONG_TIMEOUT)

    def display_comments(
        self, short_id: str, *, status: str = "open", since: Any = None
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"short_id": short_id, "status": status}
        if since is not None:
            payload["since"] = since
        return self._post("/display/comments", payload)

    def display_revise(
        self,
        markdown: str,
        comments: list[dict[str, Any]],
        *,
        run_id: str | None = None,
        release_card: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._post(
            "/display/revise",
            {
                "markdown": markdown,
                "comments": comments,
                "run_id": run_id,
                "release_card": release_card,
            },
            timeout=_LONG_TIMEOUT,
        )

    def display_resolve(self, root_comment_id: str) -> dict[str, Any]:
        return self._post("/display/resolve", {"root_comment_id": root_comment_id})

    def display_unpublish(self, short_id: str) -> dict[str, Any]:
        return self._post("/display/unpublish", {"short_id": short_id})

    def _get(
        self,
        path: str,
        *,
        timeout: httpx.Timeout = _DEFAULT_TIMEOUT,
    ) -> dict[str, Any]:
        # Mirrors _post exactly minus the JSON body (base-url guard, ok-default,
        # status->error mapping, redaction, Bearer auth).
        if not self.base_url:
            return {"ok": False, "error": "comms_factory_base_url_not_configured"}
        try:
            headers: dict[str, str] = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            with httpx.Client(timeout=timeout, trust_env=True) as client:
                response = client.get(f"{self.base_url}{path}", headers=headers)
            data = _read_json(response)
            if response.is_success:
                if isinstance(data, dict):
                    data.setdefault("ok", True)
                    return data
                return {"ok": True, "data": data}
            return {
                "ok": False,
                "error": "comms_factory_http_error",
                "status_code": response.status_code,
                "response": _redact_sensitive(data, self.token),
            }
        except httpx.TimeoutException:
            return {"ok": False, "error": "comms_factory_timeout"}
        except httpx.HTTPError as exc:
            return {
                "ok": False,
                "error": "comms_factory_request_failed",
                "detail": _redact_sensitive(str(exc), self.token),
            }
```

- [ ] **Step 4: Run tests + lint — verify green**

```bash
uv run --project services/api pytest overlays/comms-factory -q
uv run --project services/api ruff check overlays/comms-factory
uv run --project services/api ruff format overlays/comms-factory
```

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/tools/comms_factory/client.py overlays/comms-factory/tests/test_comms_client.py
git commit -m "feat(comms): thin-client delivery methods (capabilities GET, emit, typefully, display)"
```

---

### Task 11: `comms_delivery.py` — pure helpers (groups, tweets, gate blocks)

New overlay workflow helper module (no `WORKFLOW_NAME` — same pattern as
`comms_shared.py`; imported bare: `from comms_delivery import …`).

**Files:**
- Create: `overlays/comms-factory/workflows/comms_delivery.py`
- Test: `overlays/comms-factory/tests/test_comms_delivery.py` (new file; same
  `sys.path` bootstrap as `test_comms_workflows.py:8-10`)

- [ ] **Step 1: Write the failing tests** — pure-function cases:

```python
from comms_delivery import (  # noqa: E402  (after the sys.path bootstrap)
    delivery_gate_blocks,
    deliverable_groups,
    deliveries_made,
    destination_groups,
    empty_deliveries,
    fenced_diff_blocks,
    tweets_for_channel,
)
from comms_shared import Gate  # noqa: E402


def test_destination_groups_splits_by_destination_and_skips_missing():
    final = {
        "blog": {"text": "b"}, "web": {"text": "w"}, "x": {"text": "t"},
        "x-thread": None, "in-product": {"text": "i"}, "modal": {"text": "m"},
    }
    groups = destination_groups(list(final.keys()), final)
    assert groups["platform_pr"] == ["blog", "web"]
    assert groups["typefully"] == ["x"]  # x-thread is None -> missing
    assert groups["copy_only"] == ["in-product", "modal"]


def test_deliverable_groups_gate_on_capability():
    groups = {"platform_pr": ["blog"], "typefully": [], "copy_only": []}
    enabled = deliverable_groups(groups, {"platform_pr": False, "typefully": True})
    assert enabled == {"platform_pr": False, "typefully": False}


def test_tweets_for_channel_consumes_structured_array_never_resplits():
    candidates = [{"id": "c1", "structured": {"kind": "thread", "tweets": ["t1", "t2", "t3"]}}]
    entry = {"text": "t1\n\nt2 t3 flattened weirdly", "candidate_id": "c1"}
    assert tweets_for_channel(candidates, entry, "x-thread") == ["t1", "t2", "t3"]


def test_tweets_for_channel_falls_back_to_blank_line_split_without_structured():
    assert tweets_for_channel([], {"text": "a\n\nb", "candidate_id": "zz"}, "x-thread") == ["a", "b"]
    assert tweets_for_channel([], {"text": "solo"}, "x") == ["solo"]


def test_delivery_gate_blocks_states():
    gate = Gate("r1", "deliver", 1, "U1")
    groups = {"platform_pr": ["blog"], "typefully": ["x"], "copy_only": ["modal"]}
    enabled = {"platform_pr": True, "typefully": True}
    final = {"modal": {"text": "EMERGENCY: deposits paused"}}
    idle = str(delivery_gate_blocks(gate, groups, enabled, {"pr": "idle", "typefully": "idle"}, empty_deliveries(), final_by_channel=final))
    assert "Preview platform PR" in idle and "Create Typefully drafts" in idle and "Finish" in idle
    assert "Create PR" not in idle  # only after preview
    assert "deliver manually" in idle  # copy_only note
    assert "EMERGENCY: deposits paused" in idle  # copy-only text inlined
    previewed = str(delivery_gate_blocks(gate, groups, enabled, {"pr": "previewed", "typefully": "idle"}, empty_deliveries()))
    # typefully still idle -> Create PR announces its draft-creation side effect
    assert "Create Typefully drafts + PR" in previewed and "Cancel PR" in previewed
    assert "typefullyUrl" in previewed  # ordering note rendered
    previewed_after_tf = str(delivery_gate_blocks(gate, groups, enabled, {"pr": "previewed", "typefully": "created"}, empty_deliveries()))
    assert "Create PR" in previewed_after_tf and "Create Typefully drafts + PR" not in previewed_after_tf
    failed = str(delivery_gate_blocks(gate, groups, enabled, {"pr": "create_failed", "typefully": "created"}, empty_deliveries()))
    assert "creation FAILED" in failed and "Create PR" in failed and "Cancel PR" in failed
    terminal = str(delivery_gate_blocks(gate, groups, enabled, {"pr": "created", "typefully": "created"}, empty_deliveries(), terminal=True))
    assert "'type': 'actions'" not in terminal  # terminal is buttonless


def test_delivery_gate_blocks_single_group():
    # Finish is always valid: it means "done — accept the current delivery state".
    gate = Gate("r1", "deliver", 1, "U1")
    groups = {"platform_pr": [], "typefully": ["x"], "copy_only": []}
    enabled = {"platform_pr": False, "typefully": True}
    only_tf = str(delivery_gate_blocks(gate, groups, enabled, {"pr": "idle", "typefully": "idle"}, empty_deliveries()))
    assert "Create Typefully drafts" in only_tf and "Finish" in only_tf
    assert "Platform PR" not in only_tf


def test_fenced_diff_blocks_every_chunk_is_fenced():
    long_diff = "\n".join(f"+ line {i}" for i in range(400))  # > one 2800-char chunk
    blocks = fenced_diff_blocks(long_diff)
    assert len(blocks) > 1
    for block in blocks:
        text = block["text"]["text"]
        assert text.startswith("```") and text.rstrip("…").rstrip().endswith("```")


def test_deliveries_made_flips_only_on_created():
    d = empty_deliveries()
    assert deliveries_made(d) is False
    d["typefully"] = [{"channel": "x", "status": "failed", "url": None}]
    assert deliveries_made(d) is False
    d["platform_pr"] = {"status": "created", "url": "https://github.com/x/pull/1"}
    assert deliveries_made(d) is True
```

- [ ] **Step 2: Run — verify failure**, then **implement** the module header + helpers
  in `workflows/comms_delivery.py`:

```python
"""Delivery routing for comms_release (phase 2): destination grouping, the
human-confirmed delivery gate, and the optional display.dev blog review loop.

Same durable round-gate discipline as the candidate gate (comms_release.py
:453-607): fresh Gate(run_id, stage, gate_version) per interactive round
(events are first-write-wins per (event_type, correlation_id) — never reuse a
correlation for a second wait), terminal buttonless render on every exit,
bounded loops. All external calls are durable ctx.steps via call_comms_tool;
replay safety lives at the service routes (PR pre-flight + blob sha; display
--base-version guard). Typefully has no idempotency key — a crash between the
API call and the checkpoint can duplicate a DRAFT (accepted, spec Limitations).
"""

from __future__ import annotations

from typing import Any

# Task 11 imports ONLY what the pure helpers use — ruff F401 (unused import)
# fails the lint gate otherwise. Task 12 extends this import block when
# run_delivery_gate lands (WorkflowContext, GateValidationError,
# SlackWorkflowInput, call_comms_tool, extract_action, post_gate_message,
# update_gate_message, wait_for_gate_action).
from comms_shared import (
    Gate,
    actions_block,
    chunked_markdown_blocks,
    context_block,
    markdown_block,
)

PR_CHANNELS = ("blog", "web")
TYPEFULLY_CHANNELS = ("x", "x-thread")
MAX_DELIVERY_ROUNDS = 12
MAX_BLOG_REVIEW_ROUNDS = 10  # revision rounds (failed revisions don't consume)
MAX_BLOG_REVIEW_WAITS = 30  # hard cap on gate waits, failures included


def destination_groups(
    channels: list[str], final_by_channel: dict[str, Any]
) -> dict[str, list[str]]:
    approved = [c for c in channels if final_by_channel.get(c) is not None]
    return {
        "platform_pr": [c for c in approved if c in PR_CHANNELS],
        "typefully": [c for c in approved if c in TYPEFULLY_CHANNELS],
        "copy_only": [
            c for c in approved if c not in PR_CHANNELS and c not in TYPEFULLY_CHANNELS
        ],
    }


def deliverable_groups(
    groups: dict[str, list[str]], caps: dict[str, Any]
) -> dict[str, bool]:
    """Buttons appear only when the group is non-empty AND its capability is true."""
    return {
        "platform_pr": bool(groups["platform_pr"]) and bool(caps.get("platform_pr")),
        "typefully": bool(groups["typefully"]) and bool(caps.get("typefully")),
    }


def tweets_for_channel(
    candidates: list[dict[str, Any]], entry: dict[str, Any] | None, channel: str
) -> list[str]:
    """Typefully posts for an X channel. x-thread MUST consume the chosen
    candidate's structured tweets array (joined back via candidate_id) — never
    re-split the flattened text when structured exists. Solo x is one post."""
    text = str((entry or {}).get("text") or "")
    if channel != "x-thread":
        return [text] if text.strip() else []
    candidate = next(
        (c for c in candidates if c.get("id") == (entry or {}).get("candidate_id")),
        None,
    )
    structured = (candidate or {}).get("structured")
    if isinstance(structured, dict) and isinstance(structured.get("tweets"), list):
        tweets = [str(t) for t in structured["tweets"] if str(t).strip()]
        if tweets:
            return tweets
    return [part.strip() for part in text.split("\n\n") if part.strip()]


def empty_deliveries() -> dict[str, Any]:
    return {
        "platform_pr": {"status": "skipped", "url": None},
        "typefully": [],
        "copy_only": [],
        "blog_review": {"status": "skipped", "url": None, "version": None},
    }


def deliveries_made(deliveries: dict[str, Any]) -> bool:
    if deliveries["platform_pr"].get("status") == "created":
        return True
    return any(item.get("status") == "created" for item in deliveries["typefully"])


def fenced_diff_blocks(diff: str, limit: int = 2800) -> list[dict[str, Any]]:
    """Render a unified diff as Slack blocks, fencing EACH chunk individually.

    chunked_markdown_blocks splits on line boundaries with no fence awareness —
    wrapping the whole diff in one ``` fence leaves middle chunks unfenced (raw
    +/- lines render as mrkdwn). Chunk first, then fence each chunk."""
    lines = str(diff or "").split("\n")
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for line in lines:
        addition = len(line) + (1 if current else 0)
        if current and size + addition > limit:
            chunks.append("\n".join(current))
            current, size = [line], len(line)
            continue
        current.append(line)
        size += addition
    if current:
        chunks.append("\n".join(current))
    return [markdown_block(f"```\n{chunk}\n```") for chunk in chunks]


def delivery_gate_blocks(
    gate: Gate,
    groups: dict[str, list[str]],
    enabled: dict[str, bool],
    state: dict[str, str],
    deliveries: dict[str, Any],
    *,
    final_by_channel: dict[str, Any] | None = None,
    audit_line: str = "",
    terminal: bool = False,
) -> list[dict[str, Any]]:
    blocks = [
        markdown_block(
            "*Delivery* — route approved copy to its real destinations. Nothing"
            " auto-publishes: the PR is human-merged; Typefully drafts are"
            " human-published. *Finish* always means: done — accept the current"
            " delivery state."
        )
    ]
    for channel in groups["copy_only"]:
        blocks.append(
            markdown_block(
                f"_{channel}: no automated destination — copy below; deliver"
                " manually._"
            )
        )
        # Inline the copy so the operator doesn't have to scroll back for it
        # (modal especially: the exact text is what gets posted by hand).
        entry = (final_by_channel or {}).get(channel) or {}
        if entry.get("text"):
            blocks.extend(chunked_markdown_blocks(f">{entry['text']}"))
    actions: list[Any] = []
    if enabled["platform_pr"]:
        chans = " + ".join(groups["platform_pr"])
        # The typefully-first ordering is a side effect of Create PR — say so on
        # the button itself, never silently.
        drafts_pending = bool(enabled["typefully"] and state["typefully"] == "idle")
        create_label = "Create Typefully drafts + PR" if drafts_pending else "Create PR"
        if state["pr"] == "idle":
            blocks.append(
                markdown_block(f"*Platform PR* ({chans}) — preview the diff first.")
            )
            actions.append(("Preview platform PR", "preview_pr", None))
        elif state["pr"] == "previewed":
            note = (
                "\n_Typefully drafts are created first so the draft URL lands in"
                " the blog frontmatter's typefullyUrl._"
                if drafts_pending
                else ""
            )
            blocks.append(
                markdown_block(
                    f"*Platform PR* ({chans}) — planned diff posted above.{note}"
                )
            )
            actions.append((create_label, "create_pr", "primary"))
            actions.append(("Cancel PR", "cancel_pr", None))
        elif state["pr"] == "create_failed":
            blocks.append(
                markdown_block(
                    f"*Platform PR* ({chans}) — creation FAILED (see the context"
                    " line). Any Typefully drafts already created are listed"
                    " below. Retry is safe: the route pre-flight finds an"
                    " existing PR and contents PUTs are idempotent."
                )
            )
            actions.append((create_label, "create_pr", "primary"))
            actions.append(("Cancel PR", "cancel_pr", None))
        elif state["pr"] == "created":
            blocks.append(
                markdown_block(
                    f"*Platform PR* — created: {deliveries['platform_pr'].get('url')}"
                )
            )
        elif state["pr"] == "cancelled":
            blocks.append(markdown_block("*Platform PR* — cancelled this run."))
    if enabled["typefully"]:
        if state["typefully"] == "idle":
            blocks.append(
                markdown_block(
                    f"*Typefully drafts* ({' + '.join(groups['typefully'])}) —"
                    " creates DRAFTS; a human publishes."
                )
            )
            actions.append(("Create Typefully drafts", "typefully", None))
        else:
            urls = ", ".join(
                str(item.get("url"))
                for item in deliveries["typefully"]
                if item.get("url")
            )
            blocks.append(markdown_block(f"*Typefully drafts* — created: {urls}"))
    if audit_line:
        blocks.append(context_block(audit_line))
    if not terminal:
        actions.append(("Finish", "finish", None))
        blocks.append(actions_block(gate, actions))
    return blocks
```

- [ ] **Step 3: Run tests + lint — verify green.**

```bash
uv run --project services/api pytest overlays/comms-factory -q
uv run --project services/api ruff check overlays/comms-factory && uv run --project services/api ruff format overlays/comms-factory
```

- [ ] **Step 4: Commit**

```bash
git add overlays/comms-factory/workflows/comms_delivery.py overlays/comms-factory/tests/test_comms_delivery.py
git commit -m "feat(comms): delivery destination grouping + gate blocks (pure helpers)"
```

---

### Task 12: Delivery gate loop + splice into `comms_release.py`

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_delivery.py` (add `run_delivery_gate`)
- Modify: `overlays/comms-factory/workflows/comms_release.py` (ship section :619-657)
- Test: `overlays/comms-factory/tests/test_comms_delivery.py`

**Splice semantics (interpretation, recorded):** the existing ready-to-ship summary
(full copy render) still posts unchanged; the delivery gate follows it when any group
is deliverable. With no deliverable group (tokens absent / only copy-only channels),
behavior is byte-for-byte today's. Result keeps `status: "ready_to_ship"`; `deliveries`
carries delivery truth; `no_external_posting` flips false only when something was created.

- [ ] **Step 1: Write the failing tests.** Extend `test_comms_delivery.py` with
  handler-driven tests copying the `test_comms_workflows.py:441-557` pattern
  (monkeypatch `call_comms_tool` / `post_gate_message` / `update_gate_message` /
  `wait_for_gate_action` on BOTH `comms_release` and `comms_delivery` modules; `Ctx`
  class with `run_id` + pass-through `step`). The shared `fake_call_comms_tool` must
  answer: `validate`, `ground_from_tools`, `build_card`, `generate` (copy the fixtures),
  plus `capabilities`, `emit_platform_pr`, `typefully_draft`. Cases:

```python
@pytest.mark.asyncio
async def test_tokens_absent_falls_through_to_ready_to_ship(monkeypatch):
    # capabilities -> all False. Events: facts approve, card approve, candidate approve.
    # Asserts: result.status == "ready_to_ship"; result.no_external_posting is True;
    # result.deliveries == empty_deliveries() (+ copy_only untouched);
    # NO emit/typefully tool calls; NO gate message whose stage payload is "deliver".
    ...


@pytest.mark.asyncio
async def test_delivery_preview_create_finish_with_typefully_first_ordering(monkeypatch):
    # channels x + x-thread + blog; capabilities platform_pr/typefully True.
    # Events after candidate approve: deliver preview_pr -> deliver create_pr -> deliver finish.
    # fake emit_platform_pr returns planned_diff on dry_run, pr_url/branch/slug otherwise;
    # fake typefully_draft returns share_url.
    # Asserts:
    #  - first emit call has dry_run True; second has dry_run False
    #  - typefully_draft calls happen BEFORE the dry_run=False emit call (ordering rule)
    #  - the real emit call carries typefully_url from the draft's share_url
    #  - x-thread typefully call got tweets == the structured array (via candidate_id)
    #  - deliveries.platform_pr == {"status": "created", "url": ...};
    #    both typefully entries "created"; result.no_external_posting is False
    #  - a posted message contains the preview link "/preview/start?branch=" and the
    #    go-live note ("changelog popout")
    #  - the terminal delivery render (update name "render_delivery_gate_terminal")
    #    contains no actions blocks
    ...
```

  Additional enumerated cases (full `it`-style tests, same harness):
  3. **cancel path**: events `preview_pr` → `cancel_pr` → `finish` → no `dry_run=False`
     emit call; `deliveries.platform_pr.status == "skipped"`.
  4. **copy-only never delivered**: with `modal` approved, no tool call references it;
     the gate render carries the "deliver manually" note.
  5. **preview short-circuit on existing PR**: fake preview returns
     `{ok: True, existing: True, pr_url: …}` → state jumps to created, no second emit.
  6. **exhaustion**: 12 waits that all return `preview_pr` (failing preview: `ok: False`)
     → loop exhausts; result still `ready_to_ship`, `deliveries` present, terminal
     render posted.
  7. **gate validation rejection** (wait raises `GateValidationError`): delivery exits
     `rejected`, terminal render posted, `deliveries` carried in result.
  8. **failed create_pr is retryable**: first `create_pr` returns `ok: False` → the next
     render contains "creation FAILED" + a Create PR button (state `create_failed`,
     `create_pr` still in the allowed set); a second `create_pr` succeeds and
     `deliveries.platform_pr` flips to created.
  9. **all-failed typefully is retryable**: first `typefully` action returns `ok: False`
     for every channel → button still rendered next round (state stays idle); second
     attempt succeeds. Also assert every posted preview block starts AND ends with a
     ``` fence (`fenced_diff_blocks`).

- [ ] **Step 2: Run — verify failure**, then **implement `run_delivery_gate`** in
  `comms_delivery.py`. First extend the module's imports (Task 11 deliberately kept
  them minimal for ruff F401): add `from api.workflow_engine import WorkflowContext`
  and extend the `comms_shared` import with `GateValidationError`,
  `SlackWorkflowInput`, `call_comms_tool`, `chunked_markdown_blocks`,
  `extract_action`, `post_gate_message`, `update_gate_message`,
  `wait_for_gate_action`. Then:

```python
async def run_delivery_gate(
    ctx: WorkflowContext,
    inp: SlackWorkflowInput,
    *,
    card: dict[str, Any],
    channels: list[str],
    final_by_channel: dict[str, Any],
    candidates: list[dict[str, Any]],
    caps: dict[str, Any],
    deliveries: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    groups = destination_groups(channels, final_by_channel)
    enabled = deliverable_groups(groups, caps)
    deliveries["copy_only"] = groups["copy_only"]
    if not (enabled["platform_pr"] or enabled["typefully"]):
        return deliveries, "no_destinations"

    approvers = tuple(inp.approver_user_ids)
    state = {"pr": "idle", "typefully": "idle"}
    gate_message: dict[str, Any] = {}
    audit_line = ""

    async def _render(gate: Gate, name: str, *, terminal: bool, text: str) -> None:
        nonlocal gate_message
        blocks = delivery_gate_blocks(
            gate, groups, enabled, state, deliveries,
            final_by_channel=final_by_channel,
            audit_line=audit_line, terminal=terminal,
        )
        if not gate_message:
            gate_message = await post_gate_message(
                ctx, name=name, delivery=inp.delivery, text=text, blocks=blocks,
                metadata={
                    "event_type": "comms_gate",
                    "event_payload": {"run_id": ctx.run_id, "stage": "deliver"},
                },
            )
        else:
            await update_gate_message(
                ctx, name=name,
                channel=str(gate_message.get("channel") or ""),
                ts=str(gate_message.get("ts") or ""),
                text=text, blocks=blocks,
            )

    def _emit_args(dry_run: bool, typefully_url: str | None = None) -> dict[str, Any]:
        args: dict[str, Any] = {
            "release_card": card,
            "final_by_channel": final_by_channel,
            "candidates": candidates,
            "dry_run": dry_run,
            "run_id": ctx.run_id,
        }
        if typefully_url:
            args["typefully_url"] = typefully_url
        return args

    async def _create_typefully_drafts(round_n: int) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for channel in groups["typefully"]:
            posts = tweets_for_channel(candidates, final_by_channel.get(channel), channel)
            result = await call_comms_tool(
                ctx, f"typefully_{channel}_r{round_n}", "typefully_draft",
                {
                    "channel": channel,
                    "tweets": posts,
                    "title": str(card.get("title") or "")[:80],
                    "scratchpad": f"comms_release {ctx.run_id}",
                },
            )
            results.append({
                "channel": channel,
                "status": "created" if result.get("ok") else "failed",
                "url": result.get("share_url") or result.get("draft_url"),
            })
        deliveries["typefully"] = results
        # Only leave "idle" when EVERY draft failed — the button re-renders next
        # round so a transient Typefully outage stays retryable within the gate
        # (fresh per-round step names keep the retry replay-safe).
        if any(item["status"] == "created" for item in results):
            state["typefully"] = "created"
        return results

    outcome = ""
    for round_n in range(1, MAX_DELIVERY_ROUNDS + 1):
        gate = Gate(ctx.run_id, "deliver", round_n, inp.user_id, approvers)
        await _render(
            gate, f"render_delivery_gate_r{round_n}",
            terminal=False, text="Deliver approved copy.",
        )
        allowed = {"finish"}
        if enabled["platform_pr"] and state["pr"] == "idle":
            allowed.add("preview_pr")
        if enabled["platform_pr"] and state["pr"] in ("previewed", "create_failed"):
            allowed.update({"create_pr", "cancel_pr"})
        if enabled["typefully"] and state["typefully"] == "idle":
            allowed.add("typefully")
        try:
            event = await wait_for_gate_action(
                ctx, f"wait_delivery_gate_r{round_n}", gate, allowed
            )
        except GateValidationError as exc:
            audit_line = f"Delivery gate rejected: {exc.reason}."
            outcome = "rejected"
            break
        action = extract_action(event)
        slack = event.get("slack") if isinstance(event.get("slack"), dict) else {}
        audit_line = f"Round {round_n}: `{action}` by <@{slack.get('user_id') or '?'}>."

        if action == "finish":
            outcome = "finished"
            break
        if action == "preview_pr":
            preview = await call_comms_tool(
                ctx, f"emit_preview_r{round_n}", "emit_platform_pr", _emit_args(True)
            )
            if preview.get("ok") and preview.get("existing"):
                # crash-retry: this run's branch already has an open PR
                state["pr"] = "created"
                deliveries["platform_pr"] = {
                    "status": "created", "url": preview.get("pr_url"),
                }
            elif preview.get("ok") and preview.get("planned_diff") is not None:
                state["pr"] = "previewed"
                await post_gate_message(
                    ctx, name=f"post_pr_preview_r{round_n}", delivery=inp.delivery,
                    text="Planned platform PR diff",
                    # Per-chunk fences — one fence around the whole diff breaks
                    # when the chunker splits it (middle chunks render unfenced).
                    blocks=fenced_diff_blocks(str(preview["planned_diff"])),
                )
            else:
                audit_line += f" Preview failed: {preview.get('error') or 'unknown'}."
        elif action == "cancel_pr":
            state["pr"] = "cancelled"
        elif action == "typefully":
            await _create_typefully_drafts(round_n)
        elif action == "create_pr":
            # ORDERING: run Typefully first so the draft URL lands in the blog
            # frontmatter's typefullyUrl (the cross-link the org maintains by hand).
            typefully_url = None
            if enabled["typefully"] and state["typefully"] == "idle":
                results = await _create_typefully_drafts(round_n)
                typefully_url = next(
                    (item["url"] for item in results if item.get("url")), None
                )
            elif deliveries["typefully"]:
                typefully_url = next(
                    (i["url"] for i in deliveries["typefully"] if i.get("url")), None
                )
            emit = await call_comms_tool(
                ctx, f"emit_pr_r{round_n}", "emit_platform_pr",
                _emit_args(False, typefully_url),
            )
            if emit.get("ok") and emit.get("pr_url"):
                state["pr"] = "created"
                deliveries["platform_pr"] = {
                    "status": "created", "url": emit.get("pr_url"),
                }
                note = (
                    f"*Platform PR created:* {emit['pr_url']}\n"
                    f"Rendered preview: https://infinex.xyz/preview/start?branch="
                    f"{emit.get('branch')}&to=/news/{emit.get('slug')}\n"
                    "_Merging publishes to infinex.xyz/news automatically; the in-app"
                    " changelog popout follows the next platform prod release. The PR"
                    " gets the platform repo's automatic AI content review._"
                )
                await post_gate_message(
                    ctx, name=f"post_pr_created_r{round_n}", delivery=inp.delivery,
                    text="Platform PR created", blocks=[markdown_block(note)],
                )
            else:
                # Distinct render state: the operator must see the failure AND
                # know any Typefully drafts already exist before retrying.
                state["pr"] = "create_failed"
                deliveries["platform_pr"] = {"status": "failed", "url": None}
                audit_line += f" Create PR failed: {emit.get('error') or 'unknown'}."
    else:
        outcome = "exhausted"

    terminal_text = {
        "finished": "Delivery complete.",
        "rejected": "Delivery gate rejected.",
        "exhausted": f"Delivery gate limit reached ({MAX_DELIVERY_ROUNDS} rounds).",
    }[outcome]
    await _render(
        Gate(ctx.run_id, "deliver", 0, inp.user_id, approvers),
        "render_delivery_gate_terminal", terminal=True, text=terminal_text,
    )
    return deliveries, outcome
```

- [ ] **Step 3: Splice into `comms_release.py`.** Add to the imports block
  (`from comms_delivery import deliveries_made, empty_deliveries, run_delivery_gate`).
  Then, immediately BEFORE the `# ---- ship (per-channel) ----` section, insert the
  capabilities probe; and replace **the handler's final return — the one returning
  `{"status": "ready_to_ship", …}`** (anchor by content, not line number; the cited
  :619/:653-657 were the positions at planning time). Final handler order:
  capabilities probe → blog review loop (Task 13 inserts there) → ship blocks +
  `post_ready_to_ship` (unchanged) → delivery gate → final return:

```python
    # ---- delivery routing (phase 2) ----
    deliveries = empty_deliveries()
    caps_result = await call_comms_tool(ctx, "probe_capabilities", "capabilities", {})
    caps_raw = caps_result.get("capabilities")
    caps = caps_raw if isinstance(caps_raw, dict) else {}

    # …Task 13's blog review loop inserts HERE (after the probe, before ship)…

    # …existing ship_blocks rendering + post_ready_to_ship stay unchanged here…

    deliveries, _delivery_outcome = await run_delivery_gate(
        ctx, inp,
        card=card, channels=channels, final_by_channel=final_by_channel,
        candidates=candidates, caps=caps, deliveries=deliveries,
    )
    return {
        "status": "ready_to_ship",
        **_state_payload(),
        "deliveries": deliveries,
        "no_external_posting": not deliveries_made(deliveries),
    }
```

- [ ] **Step 4: Run the FULL Python suite + lint — verify green.** The existing
  `test_release_workflow_never_calls_external_publishing` (test_comms_workflows.py:441)
  needs two deliberate updates — make them, don't paper over them: (a) its
  `fake_call_comms_tool` raises `AssertionError(method)` on unknown methods → teach it
  `capabilities` returning `{"ok": True, "capabilities": {"platform_pr": False,
  "typefully": False, "display": False}}` (caps false ⇒ the delivery gate never engages
  and the test's no-external-publishing property still holds); (b) its exact-equality
  assertion `calls == [(…ground…), (…build_card…), (…generate…)]` gains
  `("comms_factory", "capabilities")` as the final element. Also monkeypatch
  `comms_delivery.call_comms_tool` (and its `post/update/wait` helpers) wherever the
  delivery gate is expected to run — patching only `comms_release` is not enough.

```bash
uv run --project services/api pytest overlays/comms-factory -q
uv run --project services/api ruff check overlays/comms-factory && uv run --project services/api ruff format overlays/comms-factory
```

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/workflows/comms_delivery.py overlays/comms-factory/workflows/comms_release.py overlays/comms-factory/tests/
git commit -m "feat(comms): human-confirmed delivery gate (preview->confirm PR, typefully-first ordering)"
```

---

### Task 13: Blog draft-review loop on display.dev (+ `reviewer_emails` input)

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_delivery.py` (add `run_blog_review_loop`)
- Modify: `overlays/comms-factory/workflows/comms_release.py` (`Input` + splice before ship)
- Test: `overlays/comms-factory/tests/test_comms_delivery.py`

**Encoded decisions (from spec §6 + operator):** entry requires blog approved AND
`caps.display` AND a non-empty reviewer list — resolved as `inp.reviewer_emails`
(explicit input wins) falling back to **emails parsed inline from the Slack brief**
(`reviewers: a@x.com, b@x.com` — operator decision resolving OQ2; same convention as
`_parse_channels`, and like it, the line is parsed but NOT stripped from the brief).
When neither yields emails the loop is skipped with a context note and blog goes
straight to the delivery PR. First publish is `visibility: private` + reviewer allowlist. The
**revision-round budget** (10) counts successful revisions; failed revisions don't
consume it (spec: "does not consume the round") — but every gate wait still uses a fresh
`gate_version` (first-write-wins: a correlation is never reused), with a hard wait cap
of 30. **Already-addressed feedback** is excluded via `resolved_ids` + the route's
stale-anchor check — NOT the spec's `createdOnVersion` filter (dropped: it strands a
comment left on a stale page view, and the dsp text-output fallback can't reliably
recover the field — recorded as deviation #10). **Interpretation flagged for review:**
"Abandon" abandons the REVIEW (artifact unpublished); the approved blog copy survives
unchanged and the delivery gate still offers the PR — review-abandon ≠ release-abandon.

- [ ] **Step 1: Write the failing tests** (handler-driven, same harness as Task 12;
  `fake_call_comms_tool` additionally answers `display_publish`, `display_comments`,
  `display_revise`, `display_resolve`, `display_unpublish`):
  1. **skip without capability**: caps.display False (or `reviewer_emails` empty) → no
     `display_publish` call; delivery gate proceeds normally.
  2. **publish + approve clean**: caps.display True, `reviewer_emails=["a@x.com"]`;
     events `blog_review approve` (comments return empty) → `display_publish` called
     once with `visibility: "private"` and `share: ["a@x.com"]`; a posted message
     contains the artifact URL; `deliveries.blog_review == {"status": "approved",
     "url": …, "version": 1}`; **no `display_unpublish`** (artifact retained as review
     record); flow continues into the delivery gate.
  3. **pull & revise round**: events `pull_revise` then `approve`. `display_comments`
     returns one NEW comment + one whose id was already resolved in a prior round
     (in `resolved_ids` — must NOT be re-fed; there is NO `created_on_version`
     filtering). `display_revise` returns
     `{ok, markdown: "REVISED", director_audit: {...}, stale_anchors: [...]}` →
     republish call carries `id` + `base_version: 1`; `display_resolve` called for the
     fed comment id ONLY after the republish succeeded; the re-render mentions the
     director audit and the stale-anchor note appears as its own block;
     final `final_by_channel["blog"]["text"] == "REVISED"` flows into the emit args.
  4. **failed revise doesn't consume the budget**: `display_revise` returns
     `{ok: False, error: "boom"}` → version unchanged, next render says revision
     failed, and a subsequent successful round still fits within
     `MAX_BLOG_REVIEW_ROUNDS`.
  5. **approve with open comments → confirm**: `display_comments` (approve path) returns
     an unresolved comment → next round's allowed actions include `approve_anyway`;
     `approve_anyway` exits approved.
  6. **abandon**: event `abandon` → `display_unpublish` called;
     `deliveries.blog_review.status == "abandoned"`; delivery gate still runs.
  7. **wait-cap exhaustion** → `display_unpublish` + status `"abandoned"` with
     `exhaustion_reason: "max_waits_reached"` (spec's status enum is
     approved|abandoned|skipped — never widened).
  8. **failed republish discards the revision**: `display_revise` succeeds but the
     follow-up `display_publish` returns `{ok: False}` → NO `display_resolve` calls,
     `version` unchanged, budget not consumed, and a later `approve` ships the
     ORIGINAL text (the discarded revision never reaches `final_by_channel`).
  9. **processing renders**: after `pull_revise` and `approve` click-events, an
     update with no actions blocks (the ⏳ processing render) is posted BEFORE the
     comments/revise tool calls; abandon-after-revisions records
     `deliveries.blog_review.discarded_revision` and the terminal render warns the
     PR uses the pre-review text.
  10. **brief-parsed reviewers**: with `Input.reviewer_emails` empty, a brief of
      `"for blog: perps launch. reviewers: a@x.com, B@x.com, notanemail, a@x.com"`
      still triggers the loop and `display_publish` receives
      `share == ["a@x.com", "B@x.com"]` (malformed dropped, case-insensitive
      dedupe, order kept); explicit `reviewer_emails` input overrides the brief;
      neither present → loop skipped. Plus direct unit tests on
      `_parse_reviewer_emails` for the no-match and multi-line cases.

- [ ] **Step 2: Run — verify failure**, then **implement `run_blog_review_loop`** in
  `comms_delivery.py`:

```python
def _revise_result_error(result: dict[str, Any]) -> str:
    """Mirror of comms_release._generation_result_error semantics for the revise
    envelope (kept local: comms_release imports this module, so importing back
    would be circular)."""
    if not isinstance(result, dict):
        return "invalid_tool_response"
    if result.get("ok") is False or result.get("error"):
        return str(result.get("error") or "tool_call_failed")[:500]
    if not str(result.get("markdown") or "").strip():
        return "revise_response_missing_markdown"
    return ""


def blog_review_blocks(
    gate: Gate,
    *,
    url: str,
    version: int,
    audit_line: str = "",
    pending_confirm: int = 0,
    processing: str = "",
    stale_note: str = "",
    terminal: bool = False,
) -> list[dict[str, Any]]:
    blocks = [
        markdown_block(
            f"*Blog draft review* — v{version} published (private, reviewer"
            f" allowlist): {url}\nComment inline on the page, then click a button."
            " The bot revises and republishes the same URL; humans never edit"
            " in-browser. The rendered theme is display.dev's, not infinex.xyz —"
            " styling is approximate."
        )
    ]
    if stale_note:
        # In the render proper, not just the context line: reviewers checking
        # display.dev will otherwise wonder why these threads stay open.
        blocks.append(markdown_block(stale_note))
    if audit_line:
        blocks.append(context_block(audit_line))
    if processing and not terminal:
        # Buttonless while a slow durable step runs (revise ≈ minutes): the
        # click is acknowledged and the double-click window is closed.
        blocks.append(markdown_block(f"⏳ _{processing}_"))
        return blocks
    if not terminal:
        if pending_confirm:
            blocks.append(
                markdown_block(
                    f"⚠️ {pending_confirm} open comment(s) not yet addressed —"
                    " approve anyway?"
                )
            )
            blocks.append(
                actions_block(
                    gate,
                    [
                        ("Approve anyway", "approve_anyway", "primary"),
                        ("Pull comments & revise", "pull_revise", None),
                        ("Abandon", "abandon", "danger"),
                    ],
                )
            )
        else:
            blocks.append(
                actions_block(
                    gate,
                    [
                        ("Pull comments & revise", "pull_revise", None),
                        ("Approve → open PR", "approve", "primary"),
                        ("Abandon", "abandon", "danger"),
                    ],
                )
            )
    return blocks


async def run_blog_review_loop(
    ctx: WorkflowContext,
    inp: SlackWorkflowInput,
    *,
    card: dict[str, Any],
    final_by_channel: dict[str, Any],
    deliveries: dict[str, Any],
    reviewer_emails: list[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    entry = dict(final_by_channel.get("blog") or {})
    original = str(entry.get("text") or "")
    markdown = original
    approvers = tuple(inp.approver_user_ids)

    publish = await call_comms_tool(
        ctx, "display_publish_r1", "display_publish",
        {
            "markdown": markdown,
            "name": f"comms-blog-{ctx.run_id}",
            "visibility": "private",
            "share": list(reviewer_emails),
        },
    )
    if not publish.get("ok"):
        await post_gate_message(
            ctx, name="post_blog_review_unavailable", delivery=inp.delivery,
            text="display.dev publish failed — skipping the blog review loop.",
            blocks=[
                context_block(
                    "display.dev publish failed"
                    f" ({publish.get('error') or 'unknown'}) — blog goes straight"
                    " to the delivery PR."
                )
            ],
        )
        return final_by_channel, deliveries

    short_id = str(publish.get("short_id") or "")
    url = str(publish.get("url") or "")
    version = int(publish.get("version") or 1)
    resolved_ids: set[str] = set()
    gate_message: dict[str, Any] = {}
    audit_line = ""
    pending_confirm = 0
    stale_note = ""
    rounds_used = 0
    outcome = ""

    async def _render(
        gate: Gate, name: str, *, terminal: bool, text: str, processing: str = ""
    ) -> None:
        nonlocal gate_message
        blocks = blog_review_blocks(
            gate, url=url, version=version, audit_line=audit_line,
            pending_confirm=pending_confirm, processing=processing,
            stale_note=stale_note, terminal=terminal,
        )
        if not gate_message:
            gate_message = await post_gate_message(
                ctx, name=name, delivery=inp.delivery, text=text, blocks=blocks,
                metadata={
                    "event_type": "comms_gate",
                    "event_payload": {"run_id": ctx.run_id, "stage": "blog_review"},
                },
            )
        else:
            await update_gate_message(
                ctx, name=name,
                channel=str(gate_message.get("channel") or ""),
                ts=str(gate_message.get("ts") or ""),
                text=text, blocks=blocks,
            )

    for wait_n in range(1, MAX_BLOG_REVIEW_WAITS + 1):
        if rounds_used >= MAX_BLOG_REVIEW_ROUNDS:
            outcome = "exhausted"
            break
        gate = Gate(ctx.run_id, "blog_review", wait_n, inp.user_id, approvers)
        await _render(
            gate, f"render_blog_review_r{wait_n}", terminal=False,
            text="Blog draft published for review.",
        )
        allowed = (
            {"approve_anyway", "pull_revise", "abandon"}
            if pending_confirm
            else {"pull_revise", "approve", "abandon"}
        )
        try:
            event = await wait_for_gate_action(
                ctx, f"wait_blog_review_r{wait_n}", gate, allowed
            )
        except GateValidationError as exc:
            audit_line = f"Blog review gate rejected: {exc.reason}."
            outcome = "abandoned"
            break
        action = extract_action(event)

        if action == "abandon":
            outcome = "abandoned"
            break
        if action == "approve_anyway":
            outcome = "approved"
            break
        if action == "approve":
            await _render(
                gate, f"render_blog_review_checking_r{wait_n}", terminal=False,
                text="Checking for open comments…",
                processing="Checking for open comments…",
            )
            open_check = await call_comms_tool(
                ctx, f"display_comments_approve_r{wait_n}", "display_comments",
                {"short_id": short_id, "status": "open"},
            )
            open_comments = [
                c for c in (open_check.get("comments") or [])
                if str(c.get("id")) not in resolved_ids
            ]
            if open_comments:
                # Feedback is never silently shipped: confirm on the NEXT round
                # (fresh gate_version — a correlation is never reused).
                pending_confirm = len(open_comments)
                audit_line = (
                    f"{pending_confirm} open comment(s) not yet addressed."
                )
                continue
            outcome = "approved"
            break
        if action == "pull_revise":
            pending_confirm = 0
            await _render(
                gate, f"render_blog_review_revising_r{wait_n}", terminal=False,
                text="Revising the draft…",
                processing="Pulling comments and revising the draft — this takes"
                " a few minutes.",
            )
            pulled = await call_comms_tool(
                ctx, f"display_comments_r{wait_n}", "display_comments",
                {"short_id": short_id, "status": "open"},
            )
            # Already-addressed feedback is excluded via resolved_ids (fed
            # comments are resolved below) + the route's stale-anchor check.
            # NO createdOnVersion filter: it strands a comment left on a stale
            # page view, and the dsp text-output fallback can't always recover
            # the field (defaulting to 0 would disable the mechanic entirely).
            fresh = [
                c for c in (pulled.get("comments") or [])
                if str(c.get("id")) not in resolved_ids
            ]
            if not fresh:
                audit_line = "No new open comments — approve when ready."
                continue
            revise = await call_comms_tool(
                ctx, f"display_revise_r{wait_n}", "display_revise",
                {
                    "markdown": markdown,
                    "comments": [
                        {"text_quote": c.get("text_quote"), "body": c.get("body")}
                        for c in fresh
                    ],
                    "run_id": ctx.run_id,
                    "release_card": card,
                },
            )
            error = _revise_result_error(revise)
            if error:
                # Failed revision: keep the previous published version and do NOT
                # consume the revision budget (mirrors the surfacing failed-retry rule).
                audit_line = f"Revision failed: {error} — keeping v{version}."
                continue
            revised_markdown = str(revise.get("markdown"))
            republished = await call_comms_tool(
                ctx, f"display_publish_r{wait_n + 1}", "display_publish",
                {
                    "markdown": revised_markdown,
                    "name": f"comms-blog-{ctx.run_id}",
                    "visibility": "private",
                    "share": list(reviewer_emails),
                    "short_id": short_id,
                    "base_version": version,
                },
            )
            if not republished.get("ok"):
                # Republish failed (base-version conflict / dsp error): the
                # reviewers still see the OLD rendering, so the revision must
                # NOT take effect — discard it, leave comments open, keep the
                # budget intact (same shape as the failed-revise branch above).
                audit_line = (
                    f"Republish failed: {republished.get('error') or 'unknown'}"
                    f" — keeping v{version}; revision discarded."
                )
                continue
            markdown = revised_markdown
            version = int(republished.get("version") or version + 1)
            for comment in fresh:
                cid = str(comment.get("id"))
                await call_comms_tool(
                    ctx, f"display_resolve_{cid}_r{wait_n}", "display_resolve",
                    {"root_comment_id": cid},
                )
                resolved_ids.add(cid)
            rounds_used += 1
            audit = revise.get("director_audit")
            audit_bits = []
            if isinstance(audit, dict):
                audit_bits.append(
                    "Director audit: "
                    + ", ".join(f"{k}={v}" for k, v in list(audit.items())[:4])
                )
            stale = revise.get("stale_anchors") or []
            stale_note = (
                f"_{len(stale)} comment(s) reference spans that were rewritten or"
                " removed — they stay open on display.dev but are treated as"
                " addressed and will not be re-fed to the reviser._"
                if stale
                else ""
            )
            audit_line = (
                f"Revised → v{version}; {len(fresh)} comment(s) addressed. "
                + " ".join(audit_bits)
            )
    else:
        outcome = "exhausted"

    if outcome == "approved":
        if markdown != original:
            entry.update({"text": markdown, "edited": True})
            final_by_channel = {**final_by_channel, "blog": entry}
        deliveries["blog_review"] = {
            "status": "approved", "url": url, "version": version,
        }
        # Artifact retained as the review record until the PR merges.
        terminal_text = f"Blog review approved at v{version}."
    else:
        await call_comms_tool(
            ctx, "display_unpublish", "display_unpublish", {"short_id": short_id}
        )
        # Spec §6 result enum is approved|abandoned|skipped — exhaustion maps to
        # "abandoned" with a distinct reason rather than widening the enum.
        deliveries["blog_review"] = {
            "status": "abandoned",
            "url": None,
            "version": version,
            **(
                {"exhaustion_reason": "max_waits_reached"}
                if outcome == "exhausted"
                else {}
            ),
            # Human-reviewed revisions are never silently destroyed: the latest
            # revised markdown survives in the durable result even though the
            # PR will ship the PRE-review text.
            **({"discarded_revision": markdown} if markdown != original else {}),
        }
        terminal_text = (
            "Blog review abandoned."
            if markdown == original
            else "Blog review abandoned — ⚠️ the delivery PR will use the"
            f" PRE-review text; {rounds_used} revision round(s) were discarded"
            " (recoverable from the workflow result's"
            " deliveries.blog_review.discarded_revision)."
        )
    await _render(
        Gate(ctx.run_id, "blog_review", 0, inp.user_id, approvers),
        "render_blog_review_terminal", terminal=True,
        text=terminal_text,
    )
    return final_by_channel, deliveries
```

- [ ] **Step 3: Wire into `comms_release.py`.** `Input` gains
  `reviewer_emails: list[str] = field(default_factory=list)`. Add the brief parser
  next to `_parse_channels` (same inline-metadata convention):

```python
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _parse_reviewer_emails(brief: str) -> list[str]:
    """Slack briefs carry reviewers inline ('reviewers: a@x.com, b@x.com') —
    the Slack command path has no structured input field for emails. Returns
    well-formed emails only (malformed entries are dropped — display.dev's
    --share would reject them at publish), deduped, first-seen order. Like
    _parse_channels, the line is parsed but not stripped from the brief."""
    match = re.search(r"\breviewers?\s*:\s*([^\n]+)", brief, flags=re.I)
    if not match:
        return []
    emails: list[str] = []
    seen: set[str] = set()
    for candidate in _EMAIL_RE.findall(match.group(1)):
        if candidate.lower() not in seen:
            seen.add(candidate.lower())
            emails.append(candidate)
    return emails
```

  In the splice from Task 12, between the capabilities probe and the ship section:

```python
    reviewer_emails = list(inp.reviewer_emails) or _parse_reviewer_emails(brief)
    if (
        final_by_channel.get("blog") is not None
        and caps.get("display")
        and reviewer_emails
    ):
        final_by_channel, deliveries = await run_blog_review_loop(
            ctx, inp, card=card, final_by_channel=final_by_channel,
            deliveries=deliveries, reviewer_emails=reviewer_emails,
        )
```

  (import `run_blog_review_loop` alongside the Task 12 imports; `brief` is the
  handler's existing local from its first lines.)

- [ ] **Step 4: Run the FULL Python suite + lint — verify green.** Same commands as Task 12.

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/workflows/comms_delivery.py overlays/comms-factory/workflows/comms_release.py overlays/comms-factory/tests/
git commit -m "feat(comms): display.dev blog draft-review loop (publish -> comment -> revise -> approve)"
```

---

### Task 14: Chart — `egressPorts` NetworkPolicy hook + token wiring

The ONLY base-chart change (spec §0). Without it the whole delivery path is
network-blocked: the attached-service policy grants egress only to api:8000 (+ optional
iron-proxy), and comms sets `proxy.enabled: false`.

**Files:**
- Modify: `contrib/chart/templates/networkpolicy.yaml` (insert after the `$proxyEnabled` block ends at :214)
- Modify: `contrib/chart/values.schema.json` (attachedServices per-service properties, next to `proxy`)
- Modify: `overlays/comms-factory/values.production.yaml` (egressPorts + 3 secretEnv tokens)
- Modify: `contrib/scripts/deploy-local.sh` (heredoc parity + local secret patch)

- [ ] **Step 1: Template hook.** In `networkpolicy.yaml`, between line 214's `{{- end }}`
  (closing `$proxyEnabled`) and line 215's `---`, insert (mirrors the repoCache
  consumption at :379-383 — one bare-`ports` rule per port, any destination, TCP):

```yaml
{{- range ($svc.egressPorts | default list) }}
    # Internet-only: a bare ports rule would also open every in-cluster service
    # on this port. The except list blocks the RFC-1918 ranges (in-cluster pod
    # and service CIDRs live there), so this grants internet egress only —
    # narrower than the repo-cache precedent, deliberately.
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: {{ . }}
{{- end }}
```

  (Task 15 Step 2 verifies the CNI actually enforces `ipBlock` — k3s ships
  kube-router for NetworkPolicy, which supports it; if a target CNI ever doesn't,
  fall back to the bare-ports form and record it in the runsheet.)

- [ ] **Step 2: Schema.** In `values.schema.json`, inside the attachedServices
  per-service `properties` (alongside `proxy`):

```json
"egressPorts": {
  "type": "array",
  "items": { "type": "integer", "minimum": 1, "maximum": 65535 }
},
```

  (Note: the per-service object has no `additionalProperties: false`, so this is
  contract hygiene, not a hard gate — still required so the key is documented.)

- [ ] **Step 3: Production values.** In `overlays/comms-factory/values.production.yaml`
  under `attachedServices.comms-factory`, after the `proxy:` block add:

```yaml
    # Delivery routing (phase 2): GitHub REST + Typefully + display.dev are
    # direct HTTPS calls (proxy.enabled is false) — open port-443 egress.
    egressPorts:
      - 443
```

  and extend `secretEnv:` (all optional — absent tokens just hide the buttons via the
  /health capabilities probe):

```yaml
      # Delivery tokens (phase 2). GITHUB_TOKEN is the SAME infra fine-grained
      # PAT repo-cache mounts, upgraded by the operator to Contents+PR write
      # (decision 2026-06-12 — see the plan's deviation log). "PRs only, never
      # lands code" is enforced by platform main's pull_request ruleset, not
      # the token.
      GITHUB_TOKEN:
        secretName: centaur-infra-env
        key: GITHUB_TOKEN
        optional: true
      TYPEFULLY_API_KEY:
        secretName: centaur-infra-env
        key: TYPEFULLY_API_KEY
        optional: true
      DISPLAYDEV_API_KEY:
        secretName: centaur-infra-env
        key: DISPLAYDEV_API_KEY
        optional: true
```

- [ ] **Step 4: deploy-local.sh parity.** In the `--with-comms-factory` heredoc
  (~:256-291): add the same `egressPorts` + three `secretEnv` entries (secretName
  `$SECRET_NAME`), plus `TYPEFULLY_SOCIAL_SET: "${TYPEFULLY_SOCIAL_SET:-Infinex}"`
  under `env:`. In the secret-patch block (~:182-200), pass through the delivery
  tokens when set in the caller's environment:

```bash
  DELIVERY_KEYS_JSON=""
  for key in GITHUB_TOKEN TYPEFULLY_API_KEY DISPLAYDEV_API_KEY; do
    value="${!key:-}"  # bash indirect expansion (the script is bash, not zsh)
    [[ -z "$value" ]] && continue
    DELIVERY_KEYS_JSON+=",\"${key}\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$value")"
  done
  if [[ -n "$DELIVERY_KEYS_JSON" ]]; then
    kubectl -n "$NAMESPACE" patch secret "$SECRET_NAME" -p "{\"stringData\":{${DELIVERY_KEYS_JSON#,}}}" >/dev/null
    echo ">> patched delivery token keys on $SECRET_NAME"
  fi
```

  (The script is bash — use the `${!key:-}` form. Update the script's `Optional env:`
  help line to mention the three new vars + `TYPEFULLY_SOCIAL_SET`.)

- [ ] **Step 5: Verify by rendering** (no test framework for the chart — assert with
  `helm template`):

```bash
helm template centaur contrib/chart -f overlays/comms-factory/values.production.yaml \
  --set attachedServices.comms-factory.image.repository=x \
  --set attachedServices.comms-factory.image.tag=y \
  | awk '/kind: NetworkPolicy/,0' | grep -B2 -A3 'port: 443'
# EXPECT: an egress rule with ipBlock cidr 0.0.0.0/0 + the three RFC-1918 excepts
# and port 443 inside the centaur-centaur-attached-comms-factory policy
# (plus the pre-existing api/slackbot 443 rules).

helm template centaur contrib/chart --set attachedServices.x.enabled=true \
  --set attachedServices.x.image.repository=r --set attachedServices.x.image.tag=t 2>/dev/null \
  | awk '/attached-x/,/^---/' | grep -c 'port: 443'
# EXPECT: 0 — no egressPorts set => no 443 egress (the hook is opt-in).
```

- [ ] **Step 6: Commit**

```bash
git add contrib/chart/templates/networkpolicy.yaml contrib/chart/values.schema.json overlays/comms-factory/values.production.yaml contrib/scripts/deploy-local.sh
git commit -m "feat(chart): additive attachedServices egressPorts hook + comms delivery token wiring"
```

---

### Task 15: Local-k8s E2E with REAL destinations

> ⚠️ Outward writes: a real PR branch on `infinex-xyz/platform` (closed + deleted
> after), real Typefully drafts in the TEST social set, a real private display.dev
> artifact. All reversible, all external. **Never touch the deploy box** — local k3s
> only. Operator must have provisioned: write-capable `GITHUB_TOKEN`,
> `TYPEFULLY_API_KEY` + test social set name, `DISPLAYDEV_API_KEY`, and reviewer email.

**Recipe base:** memory `comms-e2e-gate-driving.md` (headless gate driving: start runs
via the API, inject `comms.action` events via `POST /workflows/events` with the
bootstrapped `SLACKBOT_API_KEY` from `centaur-infra-env`, inspect Slack blocks via
history). Timing: grounding ~2 min; generation ~5 min/channel sequential — blog+web+x+
x-thread ≈ 20+ min. Budget an hour per full pass.

- [ ] **Step 1 — Phase 0: additive-behavior check (copy-only run).** The GitHub token
  cannot be absent locally without crippling grounding (it is the same infra
  `GITHUB_TOKEN` repo-cache mounts — operator decision), so the no-destination
  fall-through is proven with a run whose approved channels have NO destination:
  deploy with `TYPEFULLY_API_KEY`/`DISPLAYDEV_API_KEY` unset, run
  `comms release for in-product: …`, drive facts → card → candidate gates to
  approve. EXPECT: ready-to-ship message with the copy-only note; NO delivery
  gate posted (`run_delivery_gate` exits `no_destinations`); result
  `no_external_posting: true`, `deliveries.platform_pr.status == "skipped"`.
  (The tokens-absent capability fall-through itself is covered by the Python
  suite — Task 12 test 1.) Record.
- [ ] **Step 2 — deploy with tokens.**
  `GITHUB_TOKEN=… TYPEFULLY_API_KEY=… DISPLAYDEV_API_KEY=… TYPEFULLY_SOCIAL_SET="<test set>" contrib/scripts/deploy-local.sh --services api --with-comms-factory`.
  Secrets do NOT hot-reload: `kubectl rollout restart deploy -n centaur -l app.kubernetes.io/component=attached-comms-factory`
  (or the deploy name from `just status`). Verify from inside the API pod:
  `kubectl exec -n centaur deploy/centaur-centaur-api -- curl -s http://centaur-centaur-attached-comms-factory:8080/health`
  → all three capabilities true. Also verify NetworkPolicy took: exec into the comms
  pod and `curl -sI https://api.github.com` succeeds.
- [ ] **Step 3 — full run.** Start a release with channels blog+web+x+x-thread and
  `reviewer_emails: ["<operator email>"]` in the workflow input (API-started run —
  the Slack command path doesn't carry reviewer_emails; document this in the run notes).
  Drive gates to candidate-approve.
- [ ] **Step 4 — blog review loop.** EXPECT a private display.dev URL posted. As the
  reviewer: open it (logged in with the allowlisted email), leave one inline comment.
  Click "Pull comments & revise" (inject the `comms.action` event). EXPECT: revised
  v2 at the same URL, the comment resolved, director audit + version in the gate
  message. Then "Approve → open PR" (with a second open comment left deliberately →
  EXPECT the confirm round first; then approve anyway).
- [ ] **Step 5 — delivery gate.** "Preview platform PR" → EXPECT chunked unified diff
  (blog file + FEATURES_COPY append), no branch/PR on GitHub yet (`gh api
  'repos/infinex-xyz/platform/git/ref/heads/cf-emit/<slug>-<run_id>'` → 404).
  "Create PR" → EXPECT (ordering): Typefully drafts created FIRST in the test social
  set (x = 1 post; x-thread = one post per structured tweet — verify against the
  candidate's `structured.tweets`), then the PR: branch `cf-emit/<slug>-<run_id>`,
  title from the changelog frontmatter, body "human-approve, DO NOT merge", blog
  frontmatter carrying `published: true`, `category: changelogs`, emit-day `date:`,
  and `typefullyUrl:` pointing at the draft. EXPECT the posted message carries the
  `/preview/start?branch=…` link + go-live note. "Finish" → terminal buttonless gate.
- [ ] **Step 6 — replay safety probe.** Click "Create PR" again on a fresh run round
  (or re-run the emit tool call with the same `run_id` from inside the API pod via
  `call comms_factory emit_platform_pr '{…same args…}'`): EXPECT the SAME `pr_url`
  back (pre-flight short-circuit), no second PR, no duplicate FEATURES_COPY entry.
- [ ] **Step 7 — result + logs.** Fetch the durable result: `deliveries.platform_pr.url`
  set, two typefully entries `created`, `blog_review.status == "approved"`,
  `no_external_posting: false`. Check comms pod logs: no token substring anywhere
  (`kubectl logs … | grep -c "$GITHUB_TOKEN"` → 0).
- [ ] **Step 8 — teardown.** Close the PR unmerged + delete the branch
  (`gh pr close <url> --delete-branch`). Delete the test Typefully drafts (Typefully
  UI). Delete the display artifact (`dsp delete <short_id> --confirm` — it was
  retained on approve). Confirm `just smoke` still green.
- [ ] **Step 9 — record observations** in
  `docs/superpowers/plans/2026-06-12-comms-delivery-routing.e2e.md` (timings, URLs
  (redacted), surprises, any drift between plan and reality) and commit:

```bash
git add docs/superpowers/plans/2026-06-12-comms-delivery-routing.e2e.md
git commit -m "test(comms): delivery-routing local-k8s E2E observations (real destinations)"
```

---

### Task 16: Docs — runsheet + drift fixes

**Files:**
- Modify: `contrib/docs/deploy-env-runsheet.md` (or the runsheet the repo actually
  uses — check `contrib/docs/`): document the three delivery tokens (incl. the
  GITHUB_TOKEN write-scope requirement + the operator decision to reuse it), the
  `egressPorts: [443]` hook (internet-only via ipBlock-except), `TYPEFULLY_SOCIAL_SET`,
  the `reviewer_emails` workflow input + the Slack brief syntax
  (`reviewers: a@x.com, b@x.com`), and `COMMS_PLATFORM_REPO` (defaults to
  `infinex-xyz/platform`; the escape hatch for a staging/fork target if org fork
  policy ever changes).
- Modify: `CLAUDE.md` / `AGENTS.md` ONLY if something discovered during Stage B
  contradicts them (per the "keep this file current" rule). Expected delta: none.

- [ ] **Step 1:** Write the runsheet section ("Comms delivery routing (phase 2)"):
  what each token unlocks, what absent tokens do (buttons hidden), the egress hook,
  E2E teardown etiquette for the platform repo.
- [ ] **Step 2:** Commit:

```bash
git add contrib/docs/
git commit -m "docs(comms): delivery-routing deploy runsheet (tokens, egress, reviewer_emails)"
```

---

## Spec deviations & interpretations (for the reviewer)

1. **`COMMS_GITHUB_TOKEN` → `GITHUB_TOKEN` reuse** (operator decision 2026-06-12,
   re-confirmed same day after the full mechanics were verified live + against
   GitHub docs: no PR-only permission exists; "never lands code" comes from
   platform main's `pull_request` ruleset, not the token. Fork-flow alternative
   verified blocked — org forbids forking private repos. Caveats accepted:
   write-capable token in the repo-cache mount path; token-wide contents:write
   across the PAT's repo list; PRs author as `ramboinfinex`).
2. **`EmitPackage.changelogMd` optional** (spec's `LaunchPackage` requires it):
   web-only PRs are legal per the spec's own group definition (`platform_pr` =
   approved {blog, web}), so the REST path uses a superset type and composes the PR
   title/body without `buildPrBody` when blog is absent.
3. **Ship summary still posts before the delivery gate** ("delivery is additive" —
   the gate doesn't re-render copy; the summary keeps showing it).
4. **Review-abandon ≠ release-abandon** (§6 step 5 says "terminal" — encoded as: the
   review loop ends + artifact unpublished, but the approved blog copy still reaches
   the delivery gate).
5. **Result status stays `ready_to_ship`** after delivery; `deliveries` +
   `no_external_posting` carry the delivery truth (spec §5 defines no new status).
6. **Failed blog revision "does not consume the round"** implemented as a
   revision-budget counter (10) separate from gate waits (hard cap 30) — a
   correlation/`gate_version` is still never reused (first-write-wins).
7. **`scratchpad_text`/`share:true`** are spec'd v2 API fields the in-repo harness
   client doesn't send; Task 2 adds them. If the live API rejects them, drop
   `scratchpad_text` (traceability nice-to-have) — `share:true` is load-bearing
   (review URL) and was spec-verified.
8. **`dsp --json` output flag is assumed, verify-and-adapt** (Task 7 Step 2 probes
   `--help`; text-parse fallback specified).
9. **`/display/revise` body carries `release_card`** (spec §3 defined
   `{markdown, comments, run_id}` only): `orchestrateActorDirectorWithRetries`
   requires a valid ReleaseCard and there is no other way to supply it — the route
   and the Python client both add the field (review finding, 2026-06-12).
10. **Spec §6's `createdOnVersion` comment filtering is dropped** in favor of
    `resolved_ids` + the route's stale-anchor reporting: the version filter strands
    any comment left on a stale page view after a republish, and the dsp
    text-output fallback can't reliably recover the field (a 0-default would
    disable the revision mechanic entirely). Same goal — "a comment already
    addressed in a prior round is not re-fed" — different, fail-safe mechanism
    (review finding, 2026-06-12).

## Execution notes for Stage B

- One fresh subagent per task (superpowers:subagent-driven-development) + spec review
  per task, exactly like the surfacing phase.
- TS tasks: `cd attached-services/comms-factory && pnpm install --ignore-workspace`
  first (bare `pnpm install` resolves the WRONG workspace; `.npmrc ignore-workspace`
  does NOT fix it in pnpm 10).
- Python: `uv run --project services/api pytest overlays/comms-factory -q` (bare
  `uv run pytest` fails — no root pyproject).
- Never push to main; PR #22 stays draft; do NOT mark ready without operator go-ahead.
- If a verified anchor has drifted by the time a task runs, trust the tree, fix the
  plan in the same commit.

## Deferred / Open Questions

### From 2026-06-12 review

- **[P1][adversarial] Phase-0 E2E contradicts the GITHUB_TOKEN reuse wiring —
  ✅ RESOLVED 2026-06-12.** Phase 0 redefined as a copy-only-channel run (proves the
  no-destination fall-through without needing the token absent — Task 15 Step 1
  updated); the tokens-absent capability path stays covered by the Python suite.
  Rollout sequencing is moot: the operator upgrades the token's permissions
  up-front, before Stage B's E2E, so `platform_pr: true` is honest from the first
  deploy.
- **[P2][adversarial] The blog review loop is unreachable from Slack-started
  releases — ✅ RESOLVED 2026-06-12: parse from the brief** (operator decision).
  Slack briefs carry `reviewers: a@x.com, b@x.com` inline — same convention as
  channel selection; explicit `reviewer_emails` input still overrides. Encoded in
  Task 13 Step 3 (`_parse_reviewer_emails`) + test case 10; runsheet documents the
  syntax (Task 16).
- **[P2][security] Write-capable token + internet egress compounding —
  ✅ RESOLVED 2026-06-12: accepted by the operator** after verifying the mechanics
  online + live (no PR-only permission exists; platform main's `pull_request`
  ruleset blocks any direct push, so the worst-case is unwanted branches/PRs, all
  human-reviewed). Caveats recorded in the Operator decisions row: token-wide
  contents:write across the PAT's repo list; write-capable token in the repo-cache
  mount path. Revisit only if circumstances change.

