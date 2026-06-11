/**
 * Upload one image to Cloudinary by driving the platform repo's blessed upload
 * script (`@infinex/scripts -> pnpm cloudinary:upload`).
 *
 * The harness stages a single uploaded file in a temp directory, invokes the
 * platform workspace from its root, and parses the `secure_url` emitted by the
 * script. This keeps upload behavior aligned with platform and avoids duplicating
 * Cloudinary signing/upload semantics in comms-factory.
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const pexec = promisify(execFile);

const ALLOWED = /\.(png|jpe?g|gif|webp|svg)$/i;
const PLATFORM_ROOT = process.env.PLATFORM_ROOT ?? '/Users/opaque/platform';
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_BLOG_FOLDER ?? process.env.CLOUDINARY_FOLDER ?? 'blog';

export interface UploadResult {
  url: string;
  width?: number;
  height?: number;
}

/** Validate, stage to a temp dir, upload to Cloudinary, and clean up. */
export async function uploadFile(file: unknown): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) throw new Error('No file uploaded.');
  if (!ALLOWED.test(file.name)) throw new Error(`Unsupported image type: ${file.name}`);

  const dir = await mkdtemp(join(tmpdir(), 'cf-img-'));
  try {
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const localPath = join(dir, safeName);
    await writeFile(localPath, Buffer.from(await file.arrayBuffer()));
    return await uploadImageToCloudinary(localPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Upload the file at `localPath` (which should sit alone in its own temp dir). */
export async function uploadImageToCloudinary(localPath: string): Promise<UploadResult> {
  const dims = readImageSize(localPath);
  const stdout = await runPlatformCloudinaryUpload(localPath);
  const url = parseCloudinaryUrl(stdout);
  if (!url) {
    throw new Error(`Cloudinary upload produced no URL.\n${stdout.trim().slice(-800)}`);
  }
  return { url, width: dims?.width, height: dims?.height };
}

async function runPlatformCloudinaryUpload(localPath: string): Promise<string> {
  try {
    const r = await pexec(
      'pnpm',
      ['--dir', PLATFORM_ROOT, '--filter', '@infinex/scripts', 'run', 'cloudinary:upload'],
      {
        cwd: PLATFORM_ROOT,
        env: platformUploadEnv(localPath),
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    return r.stdout;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const detail = (e.stderr || e.stdout || e.message || '').toString().trim().slice(-1200);
    throw new Error(platformUploadFailureMessage(detail));
  }
}

export function platformUploadFailureMessage(detail: string): string {
  const lower = detail.toLowerCase();
  let hint = 'See platform script output below.';
  if (lower.includes('tsx: command not found') || lower.includes('command "tsx" not found')) {
    hint =
      `Platform script deps are missing at ${PLATFORM_ROOT}; run ` +
      '`pnpm --dir /Users/opaque/platform install --filter @infinex/scripts... --config.strict-peer-dependencies=false`.';
  } else if (detail.includes('CLOUDINARY_API_KEY') || detail.includes('CLOUDINARY_API_SECRET')) {
    hint =
      'Cloudinary credentials are missing; set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in harness/.env.local, then restart the harness.';
  } else if (detail.includes('CLOUDINARY_CLOUD_NAME')) {
    hint = 'CLOUDINARY_CLOUD_NAME is missing; set it in harness/.env.local or rely on the harness default "infinex".';
  }
  return `Cloudinary upload failed via platform script. ${hint}\n${detail}`;
}

export function platformUploadEnv(localPath: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: sanitizedChildPath(),
    UPLOAD_FROM_FOLDER: dirname(localPath),
    CLOUDINARY_FOLDER,
    OVERWRITE: 'true',
    PARALLEL_UPLOADS: 'false',
  };
  if (!env.CLOUDINARY_CLOUD_NAME) env.CLOUDINARY_CLOUD_NAME = 'infinex';
  return env;
}

function sanitizedChildPath(): string | undefined {
  const current = process.env.PATH;
  if (!current) return current;

  const cwd = resolve(process.cwd());
  const repoRoot = cwd.endsWith('/harness') ? dirname(cwd) : cwd;
  const harnessRoot = cwd.endsWith('/harness') ? cwd : resolve(cwd, 'harness');

  return current
    .split(delimiter)
    .filter((entry) => {
      const abs = resolve(entry);
      return (
        abs !== resolve(harnessRoot, 'node_modules/.bin') &&
        abs !== resolve(repoRoot, 'node_modules/.bin')
      );
    })
    .join(delimiter);
}

export function parseCloudinaryUrl(stdout: string): string | null {
  return stdout.match(/→\s*(https:\/\/res\.cloudinary\.com\/\S+)/)?.[1] ?? null;
}

/** Minimal PNG/JPEG intrinsic-size reader. Returns null for other formats. */
export function readImageSize(path: string): { width: number; height: number } | null {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    return null;
  }
  // PNG: 8-byte sig, IHDR width/height at offsets 16/20 (big-endian)
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: walk markers to a Start-Of-Frame (SOFn)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off += 1;
        continue;
      }
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker !== undefined && marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
  }
  return null;
}
