#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import {
  emitBatchLaunchPR,
  type BatchEmitOpts,
  type LaunchPackage,
  type RenumberDirective,
} from "../src/emit-platform-pr.js";

type BatchInput = {
  packages?: LaunchPackage[];
  renumber?: RenumberDirective[];
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const batchPath = flag(args, "batch") ?? args.find((arg) => !arg.startsWith("--"));
  if (!batchPath) {
    throw new Error(
      [
        "Usage: pnpm tsx scripts/emit-batch-pr.ts --batch=<batch.json> [--platform-root=<path>] [--branch=<branch>] [--live]",
        "",
        "batch.json shape:",
        '  {',
        '    "renumber": [{ "slug": "fiat-bank-deposits-live-via-bridge-xyz", "internalNumber": 63 }],',
        '    "packages": [ <LaunchPackage>, ... ]',
        '  }',
        "",
        "Renumbers run first, so a new package auto-derives its number from the stamped state.",
        "Dry-run by default; pass --live to push the branch and open one PR.",
      ].join("\n"),
    );
  }

  const input = JSON.parse(readFileSync(batchPath, "utf8")) as BatchInput;
  const opts: BatchEmitOpts = {
    dryRun: !args.includes("--live"),
    ...(input.renumber ? { renumber: input.renumber } : {}),
    ...(flag(args, "platform-root") !== undefined ? { platformRoot: flag(args, "platform-root") } : {}),
    ...(flag(args, "branch") !== undefined ? { branch: flag(args, "branch") } : {}),
  };

  const result = await emitBatchLaunchPR(input.packages ?? [], opts);
  console.log(JSON.stringify(result, null, 2));
}

function flag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
