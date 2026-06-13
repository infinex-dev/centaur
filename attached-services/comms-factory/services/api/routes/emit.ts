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
