/** Run all lightweight harness unit tests. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);

const TEST_FILES = [
  'lib/news-image-patch.test.ts',
  'lib/news-render.test.ts',
  'lib/thread-media.test.ts',
  'lib/surface-draft.test.ts',
  'lib/package-view.test.ts',
  'lib/cloudinary-upload.test.ts',
  'lib/typefully.test.ts',
  'lib/emit-process.test.ts',
  'lib/server-action-wiring.test.ts',
];

async function main(): Promise<void> {
  for (const file of TEST_FILES) {
    console.log(`\n${file}`);
    const r = await pexec('pnpm', ['exec', 'tsx', file], {
      cwd: process.cwd(),
      maxBuffer: 2 * 1024 * 1024,
    });
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
