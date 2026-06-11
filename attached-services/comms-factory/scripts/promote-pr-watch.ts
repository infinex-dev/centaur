#!/usr/bin/env tsx
// Watch a platform main PR; when it merges, author the prod promotion PR
// (content-only cherry-pick onto `prod` — see emitProdPromotionPR). Designed to
// run as a detached child of the harness: it reports progress by rewriting a
// status JSON file, so the ship panel can poll without holding a process open.
// If this watcher dies (dev-server restart, reboot), the ship panel's
// "promote now" button runs the same promotion manually — nothing is lost.
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { emitProdPromotionPR } from "../src/emit-platform-pr.js";

const execFileAsync = promisify(execFile);

export type PromoteWatchStatus = {
  phase: "watching" | "promoting" | "done" | "error";
  mainPrNumber: number;
  checkedAt: string;
  mainPrState?: string;
  prodPrUrl?: string | null;
  error?: string;
};

main().catch(async (err) => {
  await writeStatus({ phase: "error", error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const mainPrNumber = Number(flag("main-pr"));
const platformRoot = flag("platform-root");
const statusFile = flag("status-file");
const intervalMs = Number(flag("interval-ms") ?? 60_000);
const maxHours = Number(flag("max-hours") ?? 48);

async function main(): Promise<void> {
  if (!Number.isInteger(mainPrNumber) || mainPrNumber <= 0 || !platformRoot || !statusFile) {
    throw new Error(
      "Usage: pnpm tsx scripts/promote-pr-watch.ts --main-pr=<number> --platform-root=<path> --status-file=<path> [--interval-ms=60000] [--max-hours=48]",
    );
  }

  const deadline = Date.now() + maxHours * 3_600_000;
  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(`gave up after ${maxHours}h — main PR #${mainPrNumber} still not merged. Use "promote now" after it merges.`);
    }

    let state = "UNKNOWN";
    try {
      const { stdout } = await execFileAsync("gh", ["pr", "view", String(mainPrNumber), "--json", "state"], {
        cwd: platformRoot,
        maxBuffer: 1024 * 1024,
      });
      state = (JSON.parse(stdout) as { state: string }).state;
    } catch {
      // Transient gh/network failure: keep watching.
    }

    if (state === "CLOSED") {
      throw new Error(`main PR #${mainPrNumber} was closed without merging — nothing to promote.`);
    }
    if (state === "MERGED") break;

    await writeStatus({ phase: "watching", mainPrState: state });
    await sleep(intervalMs);
  }

  await writeStatus({ phase: "promoting", mainPrState: "MERGED" });
  const result = await emitProdPromotionPR(mainPrNumber, { platformRoot, dryRun: false });
  await writeStatus({ phase: "done", mainPrState: "MERGED", prodPrUrl: result.prUrl });
}

async function writeStatus(partial: Omit<PromoteWatchStatus, "mainPrNumber" | "checkedAt">): Promise<void> {
  if (!statusFile) return;
  const status: PromoteWatchStatus = {
    ...partial,
    mainPrNumber,
    checkedAt: new Date().toISOString(),
  };
  await writeFile(statusFile, JSON.stringify(status, null, 2), "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
