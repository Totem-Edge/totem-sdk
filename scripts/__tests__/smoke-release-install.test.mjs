import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'smoke-release-install.mjs');

function smokeFixture(t, registryAvailable) {
  const root = mkdtempSync(join(tmpdir(), 'release-smoke-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const pkg = join(root, 'package');
  mkdirSync(bin);
  mkdirSync(pkg);
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({
    name: '@fixture/release-smoke', version: '1.0.0', main: 'index.cjs', files: ['index.cjs'],
    dependencies: { '@totemsdk/fixture-unavailable-sibling': '^1.0.0' },
  }));
  writeFileSync(join(pkg, 'index.cjs'), 'exports.value = 1;\n');
  // Pack/extract are real. Only registry availability/install outcomes are
  // controlled so these negative regressions never depend on a network outage.
  const npm = join(bin, 'npm');
  writeFileSync(npm, `#!/usr/bin/env node
    if (process.argv[2] === 'view') process.exit(${registryAvailable ? 0 : 1});
    if (process.argv[2] === 'install') process.exit(23);
    process.exit(24);
  `);
  chmodSync(npm, 0o755);
  return spawnSync(process.execPath, [script, pkg], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8', timeout: 30_000,
  });
}

test('unverifiable sibling registry resolution is a failed release gate, never a skip/PASS', (t) => {
  const result = smokeFixture(t, false);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /Release smoke cannot verify/);
  assert.doesNotMatch(result.stdout, /Release smoke install passed|Smoke install skipped/);
});

test('install failures remain fatal even when registry metadata resolves', (t) => {
  const result = smokeFixture(t, true);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /failed with status 23/);
  assert.doesNotMatch(result.stdout, /Release smoke install passed/);
});
