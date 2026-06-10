#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { emitLaunchPR, type EmitOpts, type LaunchPackage } from "../src/emit-platform-pr.js";

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const packagePath = flag(args, "package") ?? args.find((arg) => !arg.startsWith("--"));
  if (!packagePath) {
    throw new Error("Usage: pnpm tsx scripts/emit-pr.ts --package=<launch-package.json> [--platform-root=<path>] [--branch=<branch>] [--live]");
  }

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as LaunchPackage;
  const opts: EmitOpts = {
    dryRun: !args.includes("--live"),
    ...(flag(args, "platform-root") !== undefined ? { platformRoot: flag(args, "platform-root") } : {}),
    ...(flag(args, "branch") !== undefined ? { branch: flag(args, "branch") } : {}),
  };

  const result = await emitLaunchPR(pkg, opts);
  console.log(JSON.stringify(result, null, 2));
}

function flag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
