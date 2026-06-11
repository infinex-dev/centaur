'use server';

/**
 * Dev-server restart, from the UI. Touching next.config.js makes Next dev
 * restart itself ("Found a change in next.config.js. Restarting the
 * server..."), which re-bundles ../src — so edits to the pipeline (voice spec,
 * actor memory, generator) are picked up without leaving the browser.
 * Dev-harness convenience only; no-op risk is nil (mtime touch, no content
 * change).
 */

import { utimesSync } from 'node:fs';
import { resolve } from 'node:path';

export async function restartDevServer(): Promise<{ ok: boolean; error?: string }> {
  try {
    const configPath = resolve(process.cwd(), 'next.config.js');
    const now = new Date();
    utimesSync(configPath, now, now);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
