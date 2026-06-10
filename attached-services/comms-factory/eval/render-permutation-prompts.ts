/**
 * Render each prompt-architecture permutation's system prompt to a file so the
 * Wave 1B Mirodan competence runner can consume them via --system-prompt-file.
 *
 * Usage:
 *   pnpm tsx eval/render-permutation-prompts.ts [output-dir]
 *
 * Default output-dir: eval/permutation-prompts/
 */

import fs from "node:fs";
import path from "node:path";
import { buildSystemPrompt, type PromptPermutation } from "../src/generator.js";
import { INFINEX_VOICE } from "../src/voice/infinex.js";

const PERMUTATIONS: PromptPermutation[] = [
  "current",
  "v2",
  "v1-current",
  "kernel",
  "placement",
  "examples",
  "full",
];

function main(): void {
  const outDir = path.resolve(process.argv[2] ?? "eval/permutation-prompts");
  fs.mkdirSync(outDir, { recursive: true });

  for (const permutation of PERMUTATIONS) {
    const prompt = buildSystemPrompt(INFINEX_VOICE, permutation);
    const filePath = path.join(outDir, `${permutation}.md`);
    fs.writeFileSync(filePath, prompt);
    const chars = prompt.length;
    const approxTokens = Math.round(chars / 4);
    process.stderr.write(
      `wrote ${filePath}  (${chars} chars, ~${approxTokens} tokens)\n`,
    );
  }

  process.stderr.write(`\nDone. ${PERMUTATIONS.length} prompts written to ${outDir}\n`);
}

main();
