import {
  EMIT_DRY_RUN_TIMEOUT_MS,
  EMIT_LIVE_TIMEOUT_MS,
  emitChildEnv,
  emitCliArgs,
  emitTimeoutMs,
  formatEmitProcessError,
  prNumberFromUrl,
  promoteCliArgs,
  promoteWatchArgs,
} from './emit-process';
import { assert, createTestRunner } from './test-utils';

const { test, done } = createTestRunner();

test('builds emit CLI args with platform root and live flag', () => {
  assert.deepEqual(emitCliArgs('/tmp/pkg.json', { platformRoot: '/platform', live: true }), [
    'tsx',
    'scripts/emit-pr.ts',
    '--package=/tmp/pkg.json',
    '--platform-root=/platform',
    '--live',
  ]);
});

test('sets noninteractive git and ssh env for child process', () => {
  const env = emitChildEnv({ PATH: '/bin', GIT_SSH_COMMAND: 'ssh -i key' });
  assert.equal(env.PATH, '/bin');
  assert.equal(env.GCM_INTERACTIVE, 'Never');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.GIT_SSH_COMMAND, 'ssh -i key -o BatchMode=yes');

  const existing = emitChildEnv({ GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' });
  assert.equal(existing.GIT_SSH_COMMAND, 'ssh -o BatchMode=yes');
});

test('chooses separate dry-run and live timeouts', () => {
  assert.equal(emitTimeoutMs(false), EMIT_DRY_RUN_TIMEOUT_MS);
  assert.equal(emitTimeoutMs(true), EMIT_LIVE_TIMEOUT_MS);
});

test('formats child-process failures with useful output', () => {
  const err = formatEmitProcessError(
    {
      killed: true,
      signal: 'SIGTERM',
      code: null,
      stderr: 'Enter passphrase for key',
      stdout: 'partial output',
    },
    180_000,
  );

  assert.match(err.message, /Platform PR emit failed/);
  assert.match(err.message, /Timed out after 180s/);
  assert.match(err.message, /SIGTERM/);
  assert.match(err.message, /Enter passphrase/);
  assert.match(err.message, /partial output/);
});

test('builds promote CLI args for the one-shot and watcher scripts', () => {
  assert.deepEqual(promoteCliArgs(14754, { platformRoot: '/platform', live: true }), [
    'tsx',
    'scripts/promote-pr.ts',
    '--main-pr=14754',
    '--platform-root=/platform',
    '--live',
  ]);
  assert.deepEqual(promoteWatchArgs(14754, { platformRoot: '/platform', statusFile: '/tmp/s.json' }), [
    'tsx',
    'scripts/promote-pr-watch.ts',
    '--main-pr=14754',
    '--platform-root=/platform',
    '--status-file=/tmp/s.json',
  ]);
  assert.deepEqual(promoteWatchArgs(7, { platformRoot: '/p', statusFile: '/s', intervalMs: 5000 }), [
    'tsx',
    'scripts/promote-pr-watch.ts',
    '--main-pr=7',
    '--platform-root=/p',
    '--status-file=/s',
    '--interval-ms=5000',
  ]);
});

test('extracts a PR number from a GitHub PR URL', () => {
  assert.equal(prNumberFromUrl('https://github.com/infinex-xyz/platform/pull/14754'), 14754);
  assert.equal(prNumberFromUrl('https://github.com/infinex-xyz/platform/pull/14754#issuecomment-1'), 14754);
  assert.equal(prNumberFromUrl('https://github.com/infinex-xyz/platform'), null);
  assert.equal(prNumberFromUrl('not a url'), null);
});

done();
