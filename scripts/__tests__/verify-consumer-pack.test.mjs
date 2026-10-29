import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const verifier = join(dirname(fileURLToPath(import.meta.url)), '..', 'verify-consumer-pack.mjs');

function consumerFixture(t, { brokenRequire = false, missingDependency = false, noRoot = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'consumer-gate-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sibling = join(root, 'sibling');
  const pkg = join(root, 'package');
  mkdirSync(sibling);
  mkdirSync(join(pkg, 'cjs'), { recursive: true });
  writeFileSync(join(sibling, 'package.json'), JSON.stringify({
    name: '@totemsdk/fixture-sibling', version: '1.0.0', main: 'index.js',
  }));
  writeFileSync(join(sibling, 'index.js'), 'exports.value = 7;\n');
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({
    name: '@fixture/consumer-gate', version: '1.0.0', type: 'module',
    files: ['index.js', 'cjs'],
    exports: noRoot ? { './subpath': './index.js' } : { '.': {
      import: { types: './index.d.ts', default: './index.js' },
      require: { types: './cjs/index.d.ts', default: './cjs/index.js' },
    } },
    dependencies: { '@totemsdk/fixture-sibling': `file:${missingDependency ? join(root, 'absent') : sibling}` },
  }));
  writeFileSync(join(pkg, 'index.js'), "import sibling from '@totemsdk/fixture-sibling'; export const value = sibling.value;\n");
  writeFileSync(join(pkg, 'cjs', 'package.json'), '{"type":"commonjs"}\n');
  writeFileSync(join(pkg, 'cjs', 'index.js'), brokenRequire
    ? "throw new Error('broken CommonJS consumer');\n"
    : "exports.value = require('@totemsdk/fixture-sibling').value;\n");
  return spawnSync(process.execPath, [verifier, pkg], { encoding: 'utf8', timeout: 60_000 });
}

test('installs a real scoped sibling dependency and loads both nested export branches', (t) => {
  const result = consumerFixture(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Consumer pack verification passed/);
});

test('a broken nested CommonJS .js entry fails even with a valid ESM entry', (t) => {
  const result = consumerFixture(t, { brokenRequire: true });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /broken CommonJS consumer/);
});

test('unavailable scoped sibling dependencies fail rather than falling back to extraction', (t) => {
  const result = consumerFixture(t, { missingDependency: true });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /Consumer pack verification passed/);
});

test('zero root probes fail instead of producing a consumer PASS', (t) => {
  const result = consumerFixture(t, { noRoot: true });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /No supported root import\/require probes/);
});
