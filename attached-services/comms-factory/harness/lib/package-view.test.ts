/** Run: pnpm --dir harness exec tsx lib/package-view.test.ts */
import { assert, createTestRunner } from './test-utils';
import { buildPackageView } from './package-view';
import { CHANNELS } from './queries';
import type { CardDetailView, Channel, HarnessCandidate } from './types';

const { test, done } = createTestRunner();

function candidate(channel: Channel, over: Partial<HarnessCandidate> = {}): HarnessCandidate {
  return {
    id: `cand-${channel}`,
    card_id: 'card-1',
    channel,
    attempt: 1,
    text: 'Spot is live in Infinex.',
    structured_json: null,
    declared_beats_json: '[]',
    beat_audit_json: '[]',
    validation_passed: true,
    validation_failures_json: '[]',
    active_validation_passed: null,
    active_audit_json: null,
    history_guard_passed: null,
    history_guard_json: null,
    director_audit_id: null,
    director_passed: true,
    director_audit_json: null,
    rationale: null,
    source: 'anthropic',
    prompt_variant: null,
    created_at: '2026-06-10T00:00:00Z',
    ...over,
  };
}

function detailWith(expected: Channel[], byChannel: Partial<Record<Channel, HarnessCandidate[]>>): CardDetailView {
  const candidates_by_channel = Object.fromEntries(
    CHANNELS.map((ch) => [ch, byChannel[ch] ?? []]),
  ) as Record<Channel, HarnessCandidate[]>;
  return { expected_channels: expected, candidates_by_channel } as unknown as CardDetailView;
}

test('buildPackageView: only surfaces with generated candidates get rows — audience channels the operator never generated do not appear', () => {
  const view = buildPackageView(detailWith(
    ['x', 'web', 'image-brief'],
    { x: [candidate('x')] },
  ));
  assert.deepEqual(view.rows.map((r) => r.surface), ['x']);
  assert.equal(view.total, 1);
});

test('buildPackageView: a generated surface still appears even when outside the card audience', () => {
  const view = buildPackageView(detailWith(
    ['web'],
    { blog: [candidate('blog', { validation_passed: false, validation_failures_json: '[{"rule":"r","reason":"x"}]' })] },
  ));
  assert.deepEqual(view.rows.map((r) => r.surface), ['blog']);
  assert.equal(view.rows[0]?.state, 'blocked');
});

done();
