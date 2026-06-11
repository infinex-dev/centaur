/**
 * CLI twin of the card page's "ask grounder" control.
 * Run from harness/: pnpm exec tsx scripts/ask-grounder.ts <card-id> "<ask>"
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

async function main(): Promise<void> {
  const [cardId, ...promptParts] = process.argv.slice(2);
  const prompt = promptParts.join(' ').trim();
  if (!cardId || !prompt) {
    console.error('Usage: pnpm exec tsx scripts/ask-grounder.ts <card-id> "<ask>"');
    process.exit(1);
  }
  loadEnv(resolve(process.cwd(), '.env.local'));
  loadEnv(resolve(process.cwd(), '../.env'));
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not found in harness/.env.local or ../.env');
    process.exit(1);
  }

  const { askGrounder } = await import('../lib/reground');
  const result = await askGrounder(cardId, prompt, (event) => {
    const e = event as unknown as Record<string, unknown>;
    const detail = e.name ?? e.content_preview ?? e.claim ?? '';
    console.log(`[${String(e.type)}] ${typeof detail === 'string' ? detail.slice(0, 160) : JSON.stringify(detail).slice(0, 160)}`);
  });

  console.log(`\nrun ${result.run_id}: ${result.verified} fact(s) grounded`);
  for (const u of result.unverifiable) console.log(`UNVERIFIABLE: ${u.claim} — ${u.reason}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
