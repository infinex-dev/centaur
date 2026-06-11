/** Run: npx tsx lib/thread-media.test.ts */
import { assert, createTestRunner } from './test-utils';
import { threadMedia, setThreadMedia } from './thread-media';

const { test, done } = createTestRunner();

const THREAD = JSON.stringify({ kind: 'thread', tweets: ['lead', 'second', 'third'] });
const URL = 'https://res.cloudinary.com/infinex/image/upload/v1/blog/lead.png';

test('threadMedia: empty when no media key', () => {
  assert.deepEqual(threadMedia(THREAD), []);
});

test('threadMedia: empty for non-thread / null', () => {
  assert.deepEqual(threadMedia(null), []);
  assert.deepEqual(threadMedia(JSON.stringify({ kind: 'web-card', subheading: '', title: '', caption: '' })), []);
});

test('setThreadMedia: sets index, pads with null, preserves tweets', () => {
  const out = setThreadMedia(THREAD, 1, URL);
  const m = threadMedia(out);
  assert.deepEqual(m, [null, URL, null]);
  assert.deepEqual(JSON.parse(out).tweets, ['lead', 'second', 'third']);
});

test('setThreadMedia: lead-tweet (index 0)', () => {
  assert.deepEqual(threadMedia(setThreadMedia(THREAD, 0, URL)), [URL, null, null]);
});

test('setThreadMedia: replaces an existing url at the same index', () => {
  const once = setThreadMedia(THREAD, 0, URL);
  const twice = setThreadMedia(once, 0, 'https://res.cloudinary.com/infinex/image/upload/v2/x.png');
  assert.deepEqual(threadMedia(twice), ['https://res.cloudinary.com/infinex/image/upload/v2/x.png', null, null]);
});

test('setThreadMedia: throws on out-of-range index', () => {
  assert.throws(() => setThreadMedia(THREAD, 9, URL), /no tweet at index 9/);
});

test('setThreadMedia: throws on non-thread payload', () => {
  assert.throws(() => setThreadMedia(JSON.stringify({ kind: 'carousel', slides: [] }), 0, URL), /not a thread payload/);
});

test('round-trips through parseStructured (media survives)', () => {
  const out = setThreadMedia(setThreadMedia(THREAD, 0, URL), 2, URL);
  assert.deepEqual(threadMedia(out), [URL, null, URL]);
});

done();
