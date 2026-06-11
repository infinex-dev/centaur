/**
 * Card detail — release package review (Claude Code Design v3).
 * Hero + status strip + 5-tab review surface. Existing functional panels
 * (facts, card editor, generate controls, ship, actor events, pending-API
 * approval gate) are injected into the tabs as slots so no review capability
 * regresses.
 */

import Link from 'next/link';
import { FactsTable } from '@/components/FactsTable';
import { CardEditor } from '@/components/CardEditor';
import { AttemptPanel } from '@/components/AttemptPanel';
import { ActorRunEventsPanel } from '@/components/ActorRunEventsPanel';
import { GenerateControls } from '@/components/GenerateControls';
import { ShipPanel } from '@/components/ShipPanel';
import { PendingApiPanel } from '@/components/PendingApiPanel';
import { FinalPickRefresh } from '@/components/FinalPickRefresh';
import {
  PackageTabs,
  type CorpusItemVM,
  type SurfaceRowVM,
  type ThroughlineBeatVM,
} from '@/components/design/PackageTabs';
import { buildPackageView } from '@/lib/package-view';
import { finalPickRevision } from '@/lib/final-pick-revision';
import { surfaceOfCandidate } from '@/lib/surfaces';
import {
  CHANNELS,
  expectedChannelsForCard,
  getCardDetail,
  getLatestActorRun,
  getLatestGrounderRun,
  getReleaseCardJson,
} from '@/lib/queries';
import type { Channel, HarnessActorAttempt, HarnessCandidate, HarnessGeneratorAttempt } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CHANNEL_LABEL: Record<Channel, string> = {
  x: 'X (tweet)',
  'x-thread': 'X thread',
  web: 'web card',
  'in-product': 'in-product microcopy',
  modal: 'in-app modal',
  blog: 'blog post',
  carousel: 'in-app carousel',
  'image-brief': 'image brief',
};

interface AttemptGroup {
  attempt: number;
  attemptRow: HarnessGeneratorAttempt | null;
  actorAttempt: HarnessActorAttempt | null;
  candidates: HarnessCandidate[];
}

function buildAttemptGroups(
  channel: Channel,
  candidates: HarnessCandidate[],
  attempts: HarnessGeneratorAttempt[],
  actorAttempts: HarnessActorAttempt[],
): AttemptGroup[] {
  const byAttempt = new Map<number, AttemptGroup>();
  for (const a of actorAttempts) {
    if (!actorAttemptIncludesChannel(a, channel)) continue;
    byAttempt.set(a.attempt, { attempt: a.attempt, attemptRow: null, actorAttempt: a, candidates: [] });
  }
  for (const a of attempts) {
    const existing = byAttempt.get(a.attempt);
    byAttempt.set(a.attempt, {
      attempt: a.attempt,
      attemptRow: a,
      actorAttempt: existing?.actorAttempt ?? null,
      candidates: existing?.candidates ?? [],
    });
  }
  for (const c of candidates) {
    const existing = byAttempt.get(c.attempt);
    if (existing) existing.candidates.push(c);
    else byAttempt.set(c.attempt, { attempt: c.attempt, attemptRow: null, actorAttempt: null, candidates: [c] });
  }
  return [...byAttempt.values()].sort((a, b) => b.attempt - a.attempt);
}

function actorAttemptIncludesChannel(attempt: HarnessActorAttempt, channel: Channel): boolean {
  try {
    const channels = JSON.parse(attempt.channels_json);
    return Array.isArray(channels) && channels.includes(channel);
  } catch {
    return false;
  }
}

/** flow-direction prompt_variant → A/B badge. */
function flowBadge(promptVariant: string | null): { tag: 'A' | 'B'; label: string } | null {
  if (promptVariant === 'inwards-out') return { tag: 'A', label: 'inwards-out' };
  if (promptVariant === 'outwards-in') return { tag: 'B', label: 'outwards-in' };
  return null;
}

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getCardDetail(id);
  if (!detail) {
    return (
      <div className="surface p-6 muted">
        Card not found.{' '}
        <Link href="/" className="text-state-running hover:underline">
          ← back to queue
        </Link>
      </div>
    );
  }

  const {
    card,
    facts,
    candidates_by_channel,
    attempts_by_channel,
    actor_attempts,
    operator_feedback,
    pipeline_run,
    picks,
    pending_api_requests,
  } = detail;
  const releaseCardJson = getReleaseCardJson(card.id);
  const latestGrounderRun = getLatestGrounderRun(card.id);
  const latestActorRun = getLatestActorRun(card.id);
  const regexOnlyMode = process.env.HARNESS_ACTIVE_VALIDATOR === '0';
  const expectedChannels = expectedChannelsForCard(card.id);
  const displayChannels = CHANNELS.filter(
    (channel) => expectedChannels.includes(channel) || candidates_by_channel[channel].length > 0,
  );

  const pkg = buildPackageView(detail);
  const allCandidates = CHANNELS.flatMap((ch) => candidates_by_channel[ch]);
  const pickedIds = new Set(picks.map((p) => p.candidate_id));
  // candidate_id → its pick's final_text, so the attempt-history cards can show
  // an operator's saved edit in place instead of the immutable generated draft.
  const pickedTextByCandidate = new Map(picks.map((p) => [p.candidate_id, p.final_text]));

  // ── Surface VMs for the Package tab ──────────────────────────────────────
  // When a final pick exists, show its (possibly operator-edited) copy — that's
  // the ship artifact and the edit target. Otherwise show the best candidate.
  const pickByChannel = new Map(picks.map((p) => [p.channel, p]));
  const surfaceVMs: SurfaceRowVM[] = pkg.rows.map((r) => {
    const pick = r.candidate ? pickByChannel.get(r.candidate.channel) : undefined;
    const candidateId = pick?.candidate_id ?? r.candidate?.id ?? null;
    return {
      surface: r.surface,
      state: r.state,
      candidateId,
      channel: r.candidate?.channel ?? r.surface,
      edited: Boolean(pick),
      text: pick?.final_text ?? r.candidate?.text ?? '',
      structuredJson: pick?.final_structured_json ?? r.candidate?.structured_json ?? null,
      attempt: r.candidate?.attempt ?? null,
      regexPassed: r.candidate ? r.candidate.validation_passed : null,
      directorPassed: r.candidate ? r.candidate.director_passed : null,
      flow: flowBadge(r.candidate?.prompt_variant ?? null),
      blockReason: r.blockReason,
    };
  });

  // ── Corpus VMs (every candidate) ─────────────────────────────────────────
  const corpusVMs: CorpusItemVM[] = allCandidates
    .slice()
    .sort((a, b) => b.attempt - a.attempt || a.channel.localeCompare(b.channel))
    .map((c) => {
      const fails = parseFailures(c.validation_failures_json);
      const failed = !c.validation_passed || c.director_passed === false;
      const status: CorpusItemVM['status'] = pickedIds.has(c.id)
        ? 'picked'
        : failed
          ? 'failed'
          : 'superseded';
      return {
        id: c.id,
        surface: surfaceOfCandidate(c),
        attempt: c.attempt,
        text: c.text,
        structuredJson: c.structured_json,
        status,
        regexPassed: c.validation_passed,
        directorPassed: c.director_passed,
        flow: flowBadge(c.prompt_variant),
        reason: !c.validation_passed && fails[0] ? `${fails[0].rule} — ${fails[0].reason}` : null,
      };
    });

  // ── Throughline VMs (beats per surface, from best candidate) ─────────────
  const throughlineVMs: ThroughlineBeatVM[] = pkg.rows.map((r) => ({
    surface: r.surface,
    beats: parseBeats(r.candidate?.beat_audit_json),
  }));

  const flow = actorFlow(actor_attempts);
  const attempts = maxAttempt(actor_attempts, allCandidates);

  // ── Slots ────────────────────────────────────────────────────────────────
  const generateControls = (
    <div className="space-y-4">
      {regexOnlyMode && (
        <div className="rs-constraint">
          <span className="rs-constraint-tag">regex-only</span>
          <span>
            LLM auditor disabled — validation is pattern-matching, not claim-validity reasoning.
            Re-enable with <code>HARNESS_ACTIVE_VALIDATOR=1</code>.
          </span>
        </div>
      )}
      <GenerateControls cardId={card.id} defaultChannels={expectedChannels} initialRun={latestActorRun} />
      <ActorRunEventsPanel cardId={card.id} initialRun={latestActorRun} />
    </div>
  );

  const corpusHistory = (
    <div className="space-y-6">
      {displayChannels.map((channel) => {
        const candidates = candidates_by_channel[channel];
        const groups = buildAttemptGroups(channel, candidates, attempts_by_channel[channel], actor_attempts);
        if (groups.length === 0) return null;
        return (
          // Channel-level accordion: one click on the header collapses every
          // attempt of this channel; individual attempts stay toggleable inside.
          <details key={channel} open className="space-y-3">
            <summary className="eyebrow cursor-pointer select-none">
              {CHANNEL_LABEL[channel]} · {candidates.length} candidates · {groups.length} attempts
            </summary>
            {groups.map((g) => (
              <AttemptPanel
                key={`${channel}-${g.attempt}`}
                cardId={card.id}
                channel={channel}
                attempt={g.attempt}
                attemptRow={g.attemptRow}
                actorAttempt={g.actorAttempt}
                candidates={g.candidates}
                operatorFeedback={operator_feedback}
                pickedTextByCandidate={pickedTextByCandidate}
              />
            ))}
          </details>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-2">
      <FinalPickRefresh cardId={card.id} initialRevision={finalPickRevision(picks)} />
      <div className="crumb">
        <Link href="/">queue</Link> / {card.id} / package review
      </div>

      {/* hero + ship count */}
      <div className="surface run-summary">
        <div className="rs-main">
          <div className="rs-left">
            <div className="eyebrow eyebrow-strong">RELEASE · PACKAGE REVIEW</div>
            <h1 className="title-xl mt-1">{card.brief}</h1>
            <div className="detail-meta">
              <span className="chip"><span className="chip-label">release</span><span className="chip-val mono">{card.id}</span></span>
              {flow && <span className="chip"><span className="chip-label">flow</span><span className="chip-val">{flow}</span></span>}
              <span className="chip"><span className="chip-label">voice</span><span className="chip-val">{card.voice}</span></span>
              {attempts != null && <span className="chip"><span className="chip-label">attempts</span><span className="chip-val">{attempts}</span></span>}
              <span className="chip"><span className="chip-label">facts</span><span className="chip-val">{facts.length}</span></span>
            </div>
          </div>
          <div className="rs-ship">
            <div className="rs-count">
              <span className="rs-count-n">{pkg.shippable}</span>
              <span className="rs-count-d">/ {pkg.total || '—'}</span>
            </div>
            <div className="rs-count-lab">SHIPPABLE SURFACES</div>
            <div className="rs-segs">
              {pkg.rows.map((r) => (
                <span
                  key={r.surface}
                  className={`rs-seg ${r.state === 'shippable' ? 'shippable' : r.state === 'blocked' ? 'blocked' : 'missing'}`}
                  title={`${r.surface}: ${r.state}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="rs-flags">
          <span className={`rs-flag ${pipeline_run?.proof_passed ? 'ok' : 'fail'}`}>
            <span className="rs-flag-icon">{pipeline_run?.proof_passed ? '✓' : '✕'}</span>
            Pipeline proof <strong>{pipeline_run ? (pipeline_run.proof_passed ? 'passed' : 'missing') : 'absent'}</strong>
          </span>
          <span className={`rs-flag ${pkg.blockedSurfaces.length ? 'warn' : 'ok'}`}>
            <span className="rs-flag-icon">{pkg.blockedSurfaces.length ? '⚠' : '✓'}</span>
            {pkg.blockedSurfaces.length
              ? <>Blocked: <code>{pkg.blockedSurfaces.join(', ')}</code></>
              : 'No blocked surfaces'}
          </span>
          {pending_api_requests.length > 0 && (
            <span className="rs-flag warn">
              <span className="rs-flag-icon">⚠</span>
              <strong>{pending_api_requests.length}</strong> pending API approval{pending_api_requests.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="rs-flag gate">
            <span className="rs-flag-icon">⏻</span>
            Auto-posted <strong>false</strong>
          </span>
          <span className="rs-flag gate">
            <span className="rs-flag-icon">⊘</span>
            human approval required
          </span>
        </div>
      </div>

      <PackageTabs
        cardId={card.id}
        surfaces={surfaceVMs}
        corpus={corpusVMs}
        throughline={throughlineVMs}
        counts={{ failures: pkg.blockedSurfaces.length, corpus: corpusVMs.length }}
        pendingApi={
          pending_api_requests.length > 0 ? (
            <PendingApiPanel cardId={card.id} requests={pending_api_requests} />
          ) : null
        }
        research={
          <FactsTable
            cardId={card.id}
            facts={facts}
            researchApprovedAt={card.research_approved_at}
            latestGrounderRun={latestGrounderRun}
          />
        }
        cardEditor={
          <CardEditor cardId={card.id} releaseCardJson={releaseCardJson} cardApprovedAt={card.card_approved_at} />
        }
        generateControls={generateControls}
        ship={<ShipPanel cardId={card.id} picks={picks} />}
        actorEvents={corpusHistory}
        runEvents={<ActorRunEventsPanel cardId={card.id} initialRun={latestActorRun} />}
        pipelineProof={<PipelineProofBanner pipelineRun={pipeline_run} />}
      />
    </div>
  );
}

function parseFailures(json: string): Array<{ rule: string; reason: string }> {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function parseBeats(json: string | undefined): { tempo: string; passed: boolean }[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as Array<{ declared_tempo?: string; classified_tempo?: string; passed?: boolean }>;
    return arr.map((b) => ({ tempo: b.declared_tempo ?? b.classified_tempo ?? '?', passed: Boolean(b.passed) }));
  } catch {
    return [];
  }
}

function actorFlow(actorAttempts: HarnessActorAttempt[]): string | null {
  const latest = actorAttempts[actorAttempts.length - 1];
  if (!latest) return null;
  try {
    const tw = JSON.parse(latest.table_work_json) as { through_action?: string };
    return tw.through_action ? tw.through_action.slice(0, 48) : null;
  } catch {
    return null;
  }
}

function maxAttempt(actorAttempts: HarnessActorAttempt[], candidates: HarnessCandidate[]): number | null {
  const a = actorAttempts.reduce((m, x) => Math.max(m, x.attempt), 0);
  const c = candidates.reduce((m, x) => Math.max(m, x.attempt), 0);
  const max = Math.max(a, c);
  return max > 0 ? max : null;
}

function PipelineProofBanner({
  pipelineRun,
}: {
  pipelineRun: {
    pipeline_id: string;
    pipeline_label: string;
    entrypoint: string;
    proof_json: string;
    proof_passed: boolean;
    created_at: string;
  } | null;
}) {
  if (!pipelineRun) {
    return (
      <div className="proof fail surface">
        <div className="proof-head">
          <span className="proof-seal">✕</span>
          <div>
            <div className="proof-title">Pipeline proof absent</div>
            <div className="proof-sub muted">Treat generated artifacts as legacy until rerun with Pipeline 3 proof.</div>
          </div>
        </div>
      </div>
    );
  }
  const proof = parseProof(pipelineRun.proof_json);
  return (
    <div className={`proof surface ${pipelineRun.proof_passed ? 'ok' : 'fail'}`}>
      <div className="proof-head">
        <span className="proof-seal">{pipelineRun.proof_passed ? '✓' : '✕'}</span>
        <div>
          <div className="proof-title">
            {pipelineRun.pipeline_label} · proof {pipelineRun.proof_passed ? 'passed' : 'missing'}
          </div>
          <div className="proof-sub muted mono">{pipelineRun.pipeline_id} · {pipelineRun.entrypoint}</div>
        </div>
      </div>
      {proof?.proof_fields && (
        <div className="proof-checks">
          {proof.proof_fields.map((f) => (
            <div key={f.key} className={`proof-check ${f.passed ? 'passed' : 'failed'}`}>
              <span className="proof-check-icon">{f.passed ? '✓' : '✕'}</span>
              <span className="proof-check-id mono">{f.key}</span>
              <span className="proof-check-label">{f.label}: {f.evidence}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseProof(json: string): {
  warnings?: string[];
  proof_fields?: Array<{ key: string; label: string; passed: boolean; evidence: string }>;
} | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
