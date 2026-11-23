/**
 * Fails when a security-critical transaction-pipeline file changes without the
 * lock being re-pinned in the same commit. See PIPELINE-LOCK.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPins, computePins, LOCKED_FILES } from '../scripts/lock-txn-pipeline.mjs';

test('transaction pipeline is byte-for-byte the reviewed version', () => {
  const pins = computePins();
  assert.ok(Object.keys(pins).length > 0, 'no pipeline files were found to pin');
  assert.ok(
    LOCKED_FILES.includes('src/core/buildTxnRow.ts'),
    'buildTxnRow.ts must stay in the lock'
  );

  const problems = verifyPins();
  assert.deepEqual(
    problems,
    [],
    `Transaction pipeline changed:\n${problems.join('\n')}`
  );
});
