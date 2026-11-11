/**
 * RFC-078 — co-sign consent must be a safe default and publicly reachable.
 *
 * Runs against the built package entry (dist), not src, so a missing export or
 * a relaxed default fails the release gate exactly as it would for a consumer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as omnia from '../../../../packages/omnia/dist/index.js';

test('default co-sign policy is exported from the package entry', () => {
  assert.equal(typeof omnia.defaultCoSignPolicy?.authorize, 'function');
});

test('default co-sign policy denies a local balance decrease', async () => {
  const decision = await omnia.defaultCoSignPolicy.authorize({
    channel: {},
    state: {},
    localPartyId: 'alice',
    localBalanceBefore: 100n,
    localBalanceAfter: 0n,
    addedHtlcIds: [],
    removedHtlcIds: [],
  });
  assert.equal(decision.allowed, false);
  assert.match(String(decision.reason), /balance would decrease/);
});

test('default co-sign policy allows a state that does not reduce the local balance', async () => {
  const decision = await omnia.defaultCoSignPolicy.authorize({
    channel: {},
    state: {},
    localPartyId: 'alice',
    localBalanceBefore: 100n,
    localBalanceAfter: 100n,
    addedHtlcIds: [],
    removedHtlcIds: [],
  });
  assert.equal(decision.allowed, true);
});
