#!/usr/bin/env tsx
import { emitProdPromotionPR, type PromoteOpts } from "../src/emit-platform-pr.js";

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mainPr = Number(flag(args, "main-pr"));
  if (!Number.isInteger(mainPr) || mainPr <= 0) {
    throw new Error("Usage: pnpm tsx scripts/promote-pr.ts --main-pr=<number> [--platform-root=<path>] [--branch=<branch>] [--live]");
  }

  const opts: PromoteOpts = {
    dryRun: !args.includes("--live"),
    ...(flag(args, "platform-root") !== undefined ? { platformRoot: flag(args, "platform-root") } : {}),
    ...(flag(args, "branch") !== undefined ? { branch: flag(args, "branch") } : {}),
  };

  const result = await emitProdPromotionPR(mainPr, opts);
  console.log(JSON.stringify(result, null, 2));
}

function flag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
