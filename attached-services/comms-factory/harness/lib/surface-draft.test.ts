/** Run: pnpm --dir harness exec tsx lib/surface-draft.test.ts */
import { assert, createTestRunner } from './test-utils';
import { finalPickRevision } from './final-pick-revision';
import { shouldRestoreSurfaceDraft, surfaceDraftPayload } from './surface-draft';

const { test, done } = createTestRunner();

test('surfaceDraftPayload: stores the server copy the draft was based on', () => {
  const payload = surfaceDraftPayload(
    { structured: null, text: 'working' },
    { baseText: 'server-v1', baseStructuredJson: null },
  );
  assert.equal(payload.text, 'working');
  assert.equal(payload.baseText, 'server-v1');
});

test('shouldRestoreSurfaceDraft: restores when current server copy still matches base', () => {
  assert.equal(
    shouldRestoreSurfaceDraft(
      { structured: null, text: 'working', baseText: 'server-v1', baseStructuredJson: null },
      'server-v1',
    ),
    true,
  );
});

test('shouldRestoreSurfaceDraft: drops when final pick changed underneath the draft', () => {
  assert.equal(
    shouldRestoreSurfaceDraft(
      { structured: null, text: 'working', baseText: 'server-v1', baseStructuredJson: null },
      'server-v2',
    ),
    false,
  );
});

test('shouldRestoreSurfaceDraft: legacy placeholder draft cannot shadow Cloudinary pick', () => {
  assert.equal(
    shouldRestoreSurfaceDraft(
      { structured: null, text: 'src: <designer-cover-url>' },
      'src: https://res.cloudinary.com/infinex/image/upload/v1/blog/cover.png',
    ),
    false,
  );
});

test('finalPickRevision: changes when final text changes', () => {
  const a = finalPickRevision([
    {
      channel: 'blog',
      candidate_id: 'c1',
      final_text: 'one',
      final_structured_json: null,
      shipped_at: null,
      shipped_to: null,
    },
  ]);
  const b = finalPickRevision([
    {
      channel: 'blog',
      candidate_id: 'c1',
      final_text: 'two',
      final_structured_json: null,
      shipped_at: null,
      shipped_to: null,
    },
  ]);
  assert.notEqual(a, b);
});

test('finalPickRevision: stable across row ordering', () => {
  const rows = [
    { channel: 'x', candidate_id: 'c2', final_text: 'x', final_structured_json: null },
    { channel: 'blog', candidate_id: 'c1', final_text: 'blog', final_structured_json: null },
  ];
  assert.equal(finalPickRevision(rows), finalPickRevision([...rows].reverse()));
});

done();
