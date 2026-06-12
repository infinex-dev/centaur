import type { ActorTranscriptMessage, DirectorNotes } from "../../../src/actor-director.js";
import { orchestrateActorDirectorWithRetries } from "../../../src/actor-orchestrator.js";
import { safeParseReleaseCard } from "../../../src/card.js";
import {
  deleteArtifact,
  displayConfigured,
  listComments,
  publishArtifact,
  resolveThread,
} from "../../../src/display.js";
import {
  assertRecord,
  HttpError,
  log,
  optionalString,
  requiredString,
  stringArray,
  type Handler,
  type JsonResponse,
  type RequestContext,
} from "../http.js";

export interface DisplayDeps {
  displayConfigured: typeof displayConfigured;
  publishArtifact: typeof publishArtifact;
  listComments: typeof listComments;
  resolveThread: typeof resolveThread;
  deleteArtifact: typeof deleteArtifact;
}

const realDeps: DisplayDeps = {
  displayConfigured,
  publishArtifact,
  listComments,
  resolveThread,
  deleteArtifact,
};

const NOT_CONFIGURED: JsonResponse = { body: { ok: false, error: "display_not_configured" } };

export function makeDisplayHandlers(deps: DisplayDeps = realDeps): Record<string, Handler> {
  return {
    "/display/publish": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const markdown = requiredString(body, "markdown");
      const name = requiredString(body, "name");
      const id = optionalString(body, "id");
      // Lost-update guard: updates must state the version they were derived
      // from — display.ts throws display_base_version_required if it's absent,
      // so surface the contract as a clean 400 here instead.
      if (id !== undefined && typeof body.base_version !== "number") {
        throw new HttpError(400, "missing_base_version", "base_version is required when id is set");
      }
      const result = await deps.publishArtifact({
        markdown,
        name,
        visibility: optionalString(body, "visibility") === "company" ? "company" : "private",
        share: stringArray(body.share),
        ...(id !== undefined ? { id, baseVersion: Number(body.base_version) } : {}),
      });
      return {
        body: { ok: true, short_id: result.shortId, url: result.url, version: result.version },
      };
    },

    "/display/comments": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const shortId = requiredString(body, "short_id");
      const status =
        optionalString(body, "status") === "resolved"
          ? ("resolved" as const)
          : ("open" as const);
      const comments = await deps.listComments(shortId, { status });
      return {
        body: {
          ok: true,
          comments: comments.map((c) => ({
            id: c.id,
            body: c.body,
            text_quote: c.textQuote,
            created_on_version: c.createdOnVersion,
          })),
        },
      };
    },

    "/display/resolve": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const id = requiredString(body, "root_comment_id");
      try {
        await deps.resolveThread(id);
      } catch (error) {
        // Teardown stays idempotent ({ok:true} regardless), but runner
        // timeouts/auth failures must not vanish unlogged. Runner messages
        // are already key-redacted (src/display.ts redactDisplayKey).
        log("warn", "display_teardown_swallowed", {
          route: "resolve",
          detail: error instanceof Error ? error.message.slice(0, 200) : String(error),
        });
      }
      return { body: { ok: true } };
    },

    "/display/unpublish": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const shortId = requiredString(body, "short_id");
      try {
        await deps.deleteArtifact(shortId);
      } catch (error) {
        log("warn", "display_teardown_swallowed", {
          route: "unpublish",
          detail: error instanceof Error ? error.message.slice(0, 200) : String(error),
        });
      }
      return { body: { ok: true } };
    },

    "/display/revise": makeDisplayReviseHandler(),
  };
}

export interface ReviseComment {
  textQuote: string;
  body: string;
}

/** Pure seed builder for the actor-director seed path: the prior turn carries
 *  the current markdown VERBATIM as the assistant's own output, and reviewer
 *  comments become DirectorNotes — so the Actor revises in place instead of
 *  regenerating from scratch (buildActorTranscript appends the notes as the
 *  next user turn when a previous transcript exists). */
export function buildReviseSeeds(
  markdown: string,
  comments: ReviseComment[],
): {
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
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid_release_card",
        "revise requires a valid ReleaseCard",
        parsed.error.flatten(),
      );
    }
    const rawComments = (Array.isArray(body.comments) ? body.comments : []) as Array<
      Record<string, unknown>
    >;
    const all = rawComments
      .map((c) => ({
        textQuote: String(c.text_quote ?? c.textQuote ?? ""),
        body: String(c.body ?? ""),
      }))
      .filter((c) => c.body);
    // A comment whose anchored span no longer appears in the current text is
    // "anchor stale — addressed or removed": reported, never re-fed.
    const live = all.filter((c) => c.textQuote && markdown.includes(c.textQuote));
    const stale = all.filter((c) => !c.textQuote || !markdown.includes(c.textQuote));
    if (live.length === 0) {
      throw new HttpError(400, "no_actionable_comments", "no comment anchors match the current draft");
    }
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
