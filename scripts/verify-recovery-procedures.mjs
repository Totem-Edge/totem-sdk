#!/usr/bin/env node
/**
 * RFC-063 B4 — executable key/lease/storage recovery gate.
 *
 * Runs the focused suites that back docs/security/recovery-runbook.md. This is a
 * procedure check, not a substitute for a real-node recovery drill.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CASES = [
  {
    name: 'wots-lease: reservation/journal/watermark/seed recovery',
    cwd: 'packages/wots-lease',
    tests: [
      'src/__tests__/reservation-recovery.test.ts',
      'src/__tests__/journal.test.ts',
      'src/__tests__/watermark.test.ts',
      'src/__tests__/seed.test.ts',
      'src/__tests__/one-time-key-reuse.test.ts',
    ],
  },
  {
    name: 'storage: torn journal, CAS snapshot and crashed holder',
    cwd: 'packages/storage',
    tests: [
      'src/__tests__/journal.test.ts',
      'src/__tests__/snapshot-store.test.ts',
      'src/__tests__/cas-fuzz.test.ts',
      'src/__tests__/file-store.conformance.test.ts',
    ],
  },
  {
    name: 'omnia-host: recovered channels and rotation/recovery MFA',
    cwd: 'packages/omnia-host',
    tests: ['src/__tests__/stores.test.ts', 'src/__tests__/mfa.test.ts'],
  },
];

let failures = 0;

for (const testCase of CASES) {
  process.stdout.write(`\n── ${testCase.name}\n`);
  const result = spawnSync(
    'npx',
    ['jest', '--runInBand', '--silent', ...testCase.tests],
    { cwd: join(ROOT, testCase.cwd), encoding: 'utf8', shell: process.platform === 'win32' },
  );
  const ok = result.status === 0;
  if (!ok) {
    failures += 1;
    process.stdout.write((result.stdout + result.stderr).slice(-4000) + '\n');
  }
  process.stdout.write(ok ? 'ok\n' : 'FAIL\n');
}

if (failures > 0) {
  process.stdout.write(`\nrecovery procedures: FAIL (${failures} case(s))\n`);
  process.exit(1);
}
process.stdout.write('\nrecovery procedures: PASS\n');
