/**
 * Run: pnpm --dir harness exec tsx lib/server-action-wiring.test.ts
 *
 * Guards the one *code* path to a runtime "Server Action … was not found on the
 * server" error: a component imports a server action by name, but the action was
 * renamed / removed / never exported from its `app/actions/*` module. (The other
 * cause of that error — Next dev minting fresh action IDs across restarts — is a
 * client/server build-skew artifact no single-process test can reproduce; it's
 * pinned away via NEXT_SERVER_ACTIONS_ENCRYPTION_KEY, not a test.)
 *
 * Pure fs + regex on purpose: importing the action modules would drag in
 * better-sqlite3 / the `@/` alias, which the tsx test runner doesn't resolve.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assert, createTestRunner } from './test-utils';

const HARNESS_ROOT = resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
// Capture the optional `type` keyword so whole-clause type imports can be skipped
// (type-only imports are erased at runtime — they can never be a server-action ref).
const IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]@\/app\/actions\/([\w-]+)['"]/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Identifiers a `'use server'` module exposes (functions, consts, re-exports, types). */
function exportedNames(file: string): Set<string> {
  const src = readFileSync(file, 'utf8');
  const names = new Set<string>();
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const alias = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (alias) names.add(alias);
    }
  }
  return names;
}

const { test, done } = createTestRunner();

function importsFromActions(): Array<{ file: string; names: string[]; module: string }> {
  const refs: Array<{ file: string; names: string[]; module: string }> = [];
  for (const root of SCAN_DIRS) {
    for (const file of walk(join(HARNESS_ROOT, root))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(IMPORT_RE)) {
        if (m[1]) continue; // whole-clause `import type { … }` — erased at runtime
        const names = m[2]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && !/^type\s/.test(s)) // skip inline `type X` specifiers
          .map((s) => s.split(/\s+as\s+/)[0].trim());
        refs.push({ file, names, module: m[3] });
      }
    }
  }
  return refs;
}

test('every server action a component imports is exported by its app/actions module', () => {
  const refs = importsFromActions();
  assert.ok(refs.length > 0, 'expected to find @/app/actions imports to check');

  const exportsCache = new Map<string, Set<string>>();
  const missing: string[] = [];
  for (const ref of refs) {
    const modPath = join(HARNESS_ROOT, 'app/actions', `${ref.module}.ts`);
    let exports = exportsCache.get(modPath);
    if (!exports) {
      exports = exportedNames(modPath);
      exportsCache.set(modPath, exports);
    }
    for (const name of ref.names) {
      if (!exports.has(name)) {
        missing.push(`${ref.file.replace(HARNESS_ROOT + '/', '')} imports {${name}} from @/app/actions/${ref.module} — not exported`);
      }
    }
  }
  assert.deepEqual(missing, [], `\n${missing.join('\n')}`);
});

test('ship-gate actions (preview/emit PR + ship) are present', () => {
  const ship = exportedNames(join(HARNESS_ROOT, 'app/actions/ship.ts'));
  const emit = exportedNames(join(HARNESS_ROOT, 'app/actions/emit.ts'));
  for (const name of ['abandonCard', 'completeCard', 'shipPick', 'sendThreadToTypefully']) {
    assert.ok(ship.has(name), `ship.ts must export ${name}`);
  }
  assert.ok(emit.has('emitPlatformPR'), 'emit.ts must export emitPlatformPR (the preview/emit PR action)');
});

done();
