import assert from 'node:assert';

export { assert };

export type TestFn = () => void;
export type AsyncTestFn = () => Promise<void>;

export function createTestRunner(): {
  test: (name: string, fn: TestFn) => void;
  testAsync: (name: string, fn: AsyncTestFn) => Promise<void>;
  done: () => void;
} {
  let passed = 0;
  return {
    test(name, fn) {
      fn();
      passed += 1;
      console.log(`  ok  ${name}`);
    },
    async testAsync(name, fn) {
      await fn();
      passed += 1;
      console.log(`  ok  ${name}`);
    },
    done() {
      console.log(`\n${passed} passed`);
    },
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
