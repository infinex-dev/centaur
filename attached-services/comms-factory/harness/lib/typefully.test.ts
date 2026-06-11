/** Run: pnpm --dir harness exec tsx lib/typefully.test.ts */
import { assert, createTestRunner, jsonResponse } from './test-utils';
import { createTypefullyThreadDraft } from './typefully';

type FetchCall = { url: string; init?: RequestInit };

const originalFetch = globalThis.fetch;
const originalKey = process.env.TYPEFULLY_API_KEY;
const originalSet = process.env.TYPEFULLY_SOCIAL_SET;

const { testAsync, done } = createTestRunner();

async function main(): Promise<void> {
  try {
    await testAsync('uploads media with a raw PUT and attaches media_ids to the matching post', async () => {
      const calls: FetchCall[] = [];
      process.env.TYPEFULLY_API_KEY = 'test-key';
      process.env.TYPEFULLY_SOCIAL_SET = 'Infinex';

      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        calls.push({ url, init });

        if (url === 'https://api.typefully.com/v2/social-sets') {
          return jsonResponse({ results: [{ id: 123, name: 'Infinex' }] });
        }
        if (url === 'https://res.cloudinary.com/infinex/image/upload/v1/blog/lead.png') {
          return new Response(new Uint8Array([1, 2, 3]));
        }
        if (url === 'https://api.typefully.com/v2/social-sets/123/media/upload') {
          assert.equal(init?.method, 'POST');
          assert.deepEqual(JSON.parse(String(init?.body)), { file_name: 'lead.png' });
          return jsonResponse({ media_id: 'media-1', upload_url: 'https://s3.example/upload?signature=abc' }, 201);
        }
        if (url === 'https://s3.example/upload?signature=abc') {
          assert.equal(init?.method, 'PUT');
          assert.equal(init?.headers, undefined);
          assert.deepEqual(Array.from(new Uint8Array(init?.body as ArrayBuffer)), [1, 2, 3]);
          return new Response(null, { status: 200 });
        }
        if (url === 'https://api.typefully.com/v2/social-sets/123/media/media-1') {
          return jsonResponse({ media_id: 'media-1', status: 'ready' });
        }
        if (url === 'https://api.typefully.com/v2/social-sets/123/drafts') {
          assert.equal(init?.method, 'POST');
          assert.deepEqual(JSON.parse(String(init?.body)), {
            platforms: {
              x: {
                enabled: true,
                posts: [
                  { text: 'Lead tweet', media_ids: ['media-1'] },
                  { text: 'Second tweet' },
                ],
              },
            },
            share: false,
            draft_title: 'probe',
          });
          return jsonResponse({ id: 456, status: 'draft', private_url: 'https://typefully.com/?d=456&a=123' }, 201);
        }

        throw new Error(`unexpected fetch: ${url}`);
      }) as typeof fetch;

      const result = await createTypefullyThreadDraft(
        [
          { text: 'Lead tweet', mediaUrls: ['https://res.cloudinary.com/infinex/image/upload/v1/blog/lead.png'] },
          { text: 'Second tweet' },
        ],
        { title: 'probe' },
      );

      assert.deepEqual(result, {
        id: 456,
        status: 'draft',
        socialSetId: 123,
        count: 2,
        mediaCount: 1,
        url: 'https://typefully.com/?d=456&a=123',
      });
      assert.equal(calls.filter((c) => c.url.includes('/media/upload')).length, 1);
    });

    done();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPEFULLY_API_KEY;
    else process.env.TYPEFULLY_API_KEY = originalKey;
    if (originalSet === undefined) delete process.env.TYPEFULLY_SOCIAL_SET;
    else process.env.TYPEFULLY_SOCIAL_SET = originalSet;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
