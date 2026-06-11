'use server';

import { execFile } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { emitChildEnv, emitCliArgs, emitTimeoutMs, formatEmitProcessError } from '@/lib/emit-process';
import { requireCard } from '@/lib/queries';

const execFileAsync = promisify(execFile);

const ROADMAP_DATA_PATH = 'apps/public-website/src/app/(site)/roadmap/data.ts';

/** Harness runs from harness/; the emit CLI lives in the repo root. */
function repoRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith('/harness') ? resolve(cwd, '..') : cwd;
}

function platformRoot(): string {
  return process.env.PLATFORM_ROOT ?? join(homedir(), 'Sites/infinex-xyz/platform');
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'launch';
}

export type RoadmapProposal = {
  nodeName: string;
  status: string;
  reason: string;
  confidence: number;
};

export type RoadmapChangeSummary = {
  path: string;
  from: string | null;
  to: 'done';
  reason: 'selected' | 'parent-rollup';
};

export type EmitPlatformResult = {
  prUrl: string | null;
  plannedDiff: string;
  prDescription: string;
  roadmapChanges: RoadmapChangeSummary[];
  proposedRoadmap: RoadmapProposal | null;
};

/**
 * Propose which roadmap node a launch completes — so the operator approves a
 * concrete diff (yay/nay) instead of blind-typing a node name. Lightweight parse
 * of the roadmap data.ts (name + status per node) + one LLM match. The robust AST
 * status flip is still done downstream by markRoadmapNodeDone in the CLI.
 */
async function proposeRoadmapTick(launchSummary: string): Promise<RoadmapProposal | null> {
  let source: string;
  try {
    source = await readFile(join(platformRoot(), ROADMAP_DATA_PATH), 'utf8');
  } catch {
    return null;
  }
  const nodes: Array<{ name: string; status: string }> = [];
  const re = /name:\s*['"]([^'"]+)['"][^}]*?status:\s*['"]([^'"]+)['"]/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m[1] && m[2] && m[2] !== 'done' && m[2] !== 'shipped') nodes.push({ name: m[1], status: m[2] });
  }
  if (nodes.length === 0) return null;

  const list = nodes.map((n) => `- ${n.name} [${n.status}]`).join('\n');
  let raw: string;
  try {
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: process.env.COMMS_DIRECTOR_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 400,
      system:
        'You map a shipped product launch to the single roadmap node it completes. Reply with ONE JSON object and no other text.',
      messages: [
        {
          role: 'user',
          content:
            `Launch that just shipped:\n${launchSummary}\n\n` +
            `Roadmap nodes not yet done:\n${list}\n\n` +
            `Which ONE node does this launch complete (it should flip to "done")? Reply JSON: ` +
            `{"nodeName":"<exact name copied from the list>","reason":"<one sentence>","confidence":<0..1>}. ` +
            `If none clearly matches, set confidence below 0.5.`,
        },
      ],
    });
    raw = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  } catch {
    return null;
  }

  const json = raw.match(/\{[\s\S]*\}/);
  if (!json) return null;
  let parsed: { nodeName?: string; reason?: string; confidence?: number };
  try {
    parsed = JSON.parse(json[0]) as typeof parsed;
  } catch {
    return null;
  }
  const match = parsed.nodeName ? nodes.find((n) => n.name === parsed.nodeName) : undefined;
  if (!match || (parsed.confidence ?? 0) < 0.5) return null;
  return { nodeName: match.name, status: match.status, reason: parsed.reason ?? '', confidence: parsed.confidence ?? 0 };
}

/**
 * Emit the approved package for a card as a platform PR via the verified
 * scripts/emit-pr.ts CLI (dry-run by default; `--live` opens the PR). Never
 * merges. The changelog comes from the approved `blog` pick; the roadmap tick is
 * auto-proposed (operator reviews it in the dry-run diff) unless overridden or
 * disabled.
 */
export async function emitPlatformPR(
  cardId: string,
  opts: {
    live?: boolean;
    includeRoadmap?: boolean;
    roadmapOverride?: { nodeName: string; parentName?: string };
  } = {},
): Promise<EmitPlatformResult> {
  const db = getDb();
  requireCard(cardId, db);

  const blog = db
    .prepare("SELECT final_text FROM final_picks WHERE card_id = ? AND channel = 'blog'")
    .get(cardId) as { final_text: string } | undefined;
  if (!blog) {
    throw new Error('No approved blog/changelog pick to emit — approve the blog surface first.');
  }

  const title = blog.final_text.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  const subtitle = blog.final_text.match(/^subtitle:\s*(.+)$/m)?.[1]?.trim();
  const launchSummary = [title, subtitle].filter(Boolean).join(' — ') || (title ?? cardId);

  const includeRoadmap = opts.includeRoadmap !== false;
  let proposedRoadmap: RoadmapProposal | null = null;
  let roadmapTick: { nodeName: string; parentName?: string } | undefined;
  if (opts.roadmapOverride) {
    roadmapTick = opts.roadmapOverride;
  } else if (includeRoadmap) {
    proposedRoadmap = await proposeRoadmapTick(launchSummary);
    if (proposedRoadmap) roadmapTick = { nodeName: proposedRoadmap.nodeName };
  }

  const pkg = {
    changelogSlug: slugify(title ?? cardId),
    changelogMd: blog.final_text,
    ...(roadmapTick ? { roadmapTick } : {}),
  };

  const pkgPath = join(tmpdir(), `cf-launch-${cardId}-${Date.now()}.json`);
  await writeFile(pkgPath, JSON.stringify(pkg), 'utf8');
  try {
    const timeout = emitTimeoutMs(opts.live);
    const { stdout } = await execFileAsync(
      'pnpm',
      emitCliArgs(pkgPath, { live: opts.live, platformRoot: platformRoot() }),
      {
        cwd: repoRoot(),
        env: emitChildEnv(),
        killSignal: 'SIGTERM',
        maxBuffer: 16 * 1024 * 1024,
        timeout,
      },
    );
    const result = JSON.parse(stdout) as {
      prUrl: string | null;
      plannedDiff: string;
      prDescription?: string;
      roadmapChanges?: RoadmapChangeSummary[];
    };
    return {
      prUrl: result.prUrl,
      plannedDiff: result.plannedDiff,
      prDescription: result.prDescription ?? '',
      roadmapChanges: result.roadmapChanges ?? [],
      proposedRoadmap,
    };
  } catch (err) {
    throw formatEmitProcessError(err, emitTimeoutMs(opts.live));
  } finally {
    await rm(pkgPath, { force: true });
  }
}
