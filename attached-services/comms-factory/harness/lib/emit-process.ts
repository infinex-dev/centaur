export const EMIT_DRY_RUN_TIMEOUT_MS = 45_000;
export const EMIT_LIVE_TIMEOUT_MS = 180_000;

type EmitCliArgsOpts = {
  live?: boolean;
  platformRoot: string;
};

export function emitCliArgs(pkgPath: string, opts: EmitCliArgsOpts): string[] {
  return [
    'tsx',
    'scripts/emit-pr.ts',
    `--package=${pkgPath}`,
    `--platform-root=${opts.platformRoot}`,
    ...(opts.live ? ['--live'] : []),
  ];
}

export function emitTimeoutMs(live?: boolean): number {
  return live ? EMIT_LIVE_TIMEOUT_MS : EMIT_DRY_RUN_TIMEOUT_MS;
}

export function emitChildEnv(base: Record<string, string | undefined> = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    NODE_ENV: normalizeNodeEnv(base.NODE_ENV ?? process.env.NODE_ENV),
    GCM_INTERACTIVE: 'Never',
    GIT_TERMINAL_PROMPT: '0',
    GIT_SSH_COMMAND: withSshBatchMode(base.GIT_SSH_COMMAND),
  };
}

function withSshBatchMode(command: string | undefined): string {
  if (!command) return 'ssh -o BatchMode=yes';
  if (/\bBatchMode\s*=/.test(command)) return command;
  return `${command} -o BatchMode=yes`;
}

function normalizeNodeEnv(value: string | undefined): 'development' | 'production' | 'test' {
  if (value === 'development' || value === 'production' || value === 'test') return value;
  return 'development';
}

export function formatEmitProcessError(error: unknown, timeoutMs: number): Error {
  const err = error as {
    code?: string | number;
    signal?: string;
    killed?: boolean;
    stdout?: string | Buffer;
    stderr?: string | Buffer;
    message?: string;
  };

  const chunks = ['Platform PR emit failed.'];
  if (err.killed) chunks.push(`Timed out after ${Math.round(timeoutMs / 1000)}s.`);
  if (err.signal) chunks.push(`Process signal: ${err.signal}.`);
  if (err.code !== undefined) chunks.push(`Exit code: ${err.code}.`);

  const stderr = asText(err.stderr).trim();
  const stdout = asText(err.stdout).trim();
  if (stderr) chunks.push(`stderr:\n${stderr}`);
  if (stdout) chunks.push(`stdout:\n${stdout}`);
  if (!stderr && !stdout && err.message) chunks.push(err.message);

  return new Error(chunks.join('\n\n'));
}

function asText(value: string | Buffer | undefined): string {
  if (typeof value === 'string') return value;
  return value?.toString('utf8') ?? '';
}
