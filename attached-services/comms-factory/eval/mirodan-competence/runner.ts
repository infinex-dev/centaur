/**
 * Mirodan competence eval — runner.
 *
 * Invokes a model (Anthropic SDK) with an optional system-prompt prefix per
 * permutation, plus the question prompt, and returns structured responses.
 *
 * The system-prompt prefix is the "permutation under test" — Wave 1C/1D will
 * plug in the actual prompt contents (compact kernel, full sheet, just-locked-
 * voice-ts, none/baseline, etc.). The rig accepts an arbitrary string.
 *
 * Usage:
 *   pnpm tsx eval/mirodan-competence/runner.ts \
 *     --system-prompt-file=<path> \
 *     --output=<path.json> \
 *     [--model=claude-opus-4-7] [--limit=N] [--label=<perm-name>]
 *
 *   # Or pass --system-prompt-empty to test the no-context baseline.
 *
 * Output JSON shape:
 *   {
 *     label: string,
 *     model: string,
 *     system_prompt_path: string | null,
 *     ran_at: ISO8601,
 *     responses: [{ question_id, response, latency_ms }]
 *   }
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { QUESTIONS, type Question } from "./questions.js";

interface RunOptions {
  model: string;
  systemPrompt: string | null;
  systemPromptPath: string | null;
  label: string;
  limit: number | null;
  outputPath: string;
  maxTokens: number;
}

interface RawResponse {
  question_id: string;
  response: string;
  latency_ms: number;
}

interface RunFile {
  label: string;
  model: string;
  system_prompt_path: string | null;
  ran_at: string;
  responses: RawResponse[];
}

function parseArgs(argv: string[]): RunOptions {
  const flags = new Map<string, string>();
  for (const a of argv) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq === -1) flags.set(a.slice(2), "true");
      else flags.set(a.slice(2, eq), a.slice(eq + 1));
    }
  }
  const outputRaw = flags.get("output");
  if (!outputRaw) {
    throw new Error("Missing --output=<path.json>");
  }
  const empty = flags.get("system-prompt-empty") === "true";
  const systemPromptPath = empty ? null : flags.get("system-prompt-file") ?? null;
  if (!empty && !systemPromptPath) {
    throw new Error(
      "Pass either --system-prompt-file=<path> OR --system-prompt-empty.",
    );
  }
  let systemPrompt: string | null = null;
  if (systemPromptPath) {
    systemPrompt = fs.readFileSync(path.resolve(systemPromptPath), "utf8");
  }
  return {
    model: flags.get("model") ?? "claude-opus-4-7",
    systemPrompt,
    systemPromptPath,
    label: flags.get("label") ?? path.basename(outputRaw, ".json"),
    limit: flags.has("limit") ? Number.parseInt(flags.get("limit")!, 10) : null,
    outputPath: path.resolve(outputRaw),
    maxTokens: flags.has("max-tokens")
      ? Number.parseInt(flags.get("max-tokens")!, 10)
      : 1024,
  };
}

const BASE_USER_INSTRUCTIONS = `Answer the following question about the Mirodan / Laban character framework. Be precise and concise. Where the question asks for a list or specific terms, use the exact framework vocabulary (Stable, Adream, Near, Mobile, Awake, Remote, Pressing, Punching, etc.). Where the question asks for structured output (e.g. "tempo: X, motor: Y, verdict: Z"), use that exact label:value format on separate lines.

Question:`;

function buildUserMessage(q: Question): string {
  return `${BASE_USER_INSTRUCTIONS}\n\n${q.prompt}`;
}

async function callModel(
  client: Anthropic,
  model: string,
  systemPrompt: string | null,
  q: Question,
  maxTokens: number,
): Promise<{ text: string; latencyMs: number }> {
  const t0 = Date.now();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserMessage(q) },
  ];
  const createArgs: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (systemPrompt && systemPrompt.trim().length > 0) {
    createArgs.system = systemPrompt;
  }
  const response = await client.messages.create(createArgs);
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  return { text, latencyMs: Date.now() - t0 };
}

export async function runEval(opts: RunOptions): Promise<RunFile> {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic();
  const questions = opts.limit ? QUESTIONS.slice(0, opts.limit) : QUESTIONS;
  const responses: RawResponse[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    process.stderr.write(
      `[${i + 1}/${questions.length}] ${q.id} (${q.category} / ${q.discriminator})… `,
    );
    try {
      const { text, latencyMs } = await callModel(
        client,
        opts.model,
        opts.systemPrompt,
        q,
        opts.maxTokens,
      );
      responses.push({ question_id: q.id, response: text, latency_ms: latencyMs });
      process.stderr.write(`${latencyMs}ms\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`ERROR: ${msg}\n`);
      responses.push({ question_id: q.id, response: `[ERROR] ${msg}`, latency_ms: 0 });
    }
  }
  const out: RunFile = {
    label: opts.label,
    model: opts.model,
    system_prompt_path: opts.systemPromptPath,
    ran_at: new Date().toISOString(),
    responses,
  };
  fs.writeFileSync(opts.outputPath, JSON.stringify(out, null, 2));
  process.stderr.write(`\nWrote ${responses.length} response(s) to ${opts.outputPath}\n`);
  return out;
}

const isDirectInvocation =
  import.meta.url === `file://${process.argv[1] ?? ""}` ||
  process.argv[1]?.endsWith("/runner.ts") === true ||
  process.argv[1]?.endsWith("\\runner.ts") === true;

if (isDirectInvocation) {
  const opts = parseArgs(process.argv.slice(2));
  runEval(opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
