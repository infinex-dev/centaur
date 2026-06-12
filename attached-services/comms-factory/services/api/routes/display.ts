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
      } catch {
        /* resolving a resolved thread is a no-op */
      }
      return { body: { ok: true } };
    },

    "/display/unpublish": async (ctx: RequestContext) => {
      const body = assertRecord(ctx.body);
      if (!deps.displayConfigured()) return NOT_CONFIGURED;
      const shortId = requiredString(body, "short_id");
      try {
        await deps.deleteArtifact(shortId);
      } catch {
        /* teardown is idempotent */
      }
      return { body: { ok: true } };
    },
  };
}
