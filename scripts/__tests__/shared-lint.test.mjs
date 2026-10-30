import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectLintFiles, lintPackage } from '../lint-workspace-package.mjs';

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'shared-lint-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'package.json'), '{"name":"@fixture/lint","version":"1.0.0"}');
  for (const [name, content] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

test('shared lint parses authored TypeScript and JavaScript while excluding generated/native outputs', async (t) => {
  const root = fixture(t, {
    'src/index.ts': 'export function echo<T>(value: T): T { return value; }',
    'scripts/probe.mjs': 'export const value = 7;',
    'dist/broken.js': 'this is not valid JavaScript',
    'pkg-node/generated.js': 'invalid output',
    'src/types.d.ts': 'declare const value: number;',
    'target/generated.js': 'invalid output',
  });
  const report = await lintPackage(root, { cwd: root });
  assert.equal(report.fileCount, 2);
  assert.equal(report.errorCount, 0);
});

test('correctness failures in TypeScript and JavaScript fail shared lint', async (t) => {
  const root = fixture(t, {
    'src/unreachable.ts': 'export function f(): number { return 1; console.log("unreachable"); }',
    'scripts/promise.mjs': 'export const value = new Promise(async (resolve) => { resolve(1); });',
  });
  const report = await lintPackage(root, { cwd: root });
  assert.equal(report.errorCount, 2);
  const rules = report.results.flatMap((result) => result.messages.map((message) => message.ruleId));
  assert.ok(rules.includes('no-unreachable'));
  assert.ok(rules.includes('no-async-promise-executor'));
});

test('inline disable comments cannot bypass mandatory correctness rules', async (t) => {
  const root = fixture(t, {
    'src/index.ts': '/* eslint-disable no-unreachable */\nexport function f() { return 1; console.log("unreachable"); }',
  });
  const report = await lintPackage(root, { cwd: root });
  assert.ok(report.errorCount > 0);
});

test('zero authored source files fail instead of passing on generated artifacts', async (t) => {
  const root = fixture(t, { 'dist/index.js': 'exports.value = 1;' });
  assert.deepEqual(collectLintFiles(root), []);
  await assert.rejects(lintPackage(root, { cwd: root }), /No JS\/TS source files selected/);
});

test('an ignore pattern cannot turn selected authored sources into a successful empty check', async (t) => {
  const root = fixture(t, {
    'src/index.ts': 'export const value = 1;',
    'fixture-eslint.mjs': 'export default [{ ignores: ["**/*.ts"] }];',
  });
  await assert.rejects(lintPackage(root, { cwd: root, configFile: join(root, 'fixture-eslint.mjs') }), /Selected source is ignored/);
});
