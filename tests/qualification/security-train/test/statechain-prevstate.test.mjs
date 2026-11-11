/**
 * RFC-078 — statechain ownership must bind the spent coin's PREVSTATE(0).
 *
 * Reading STATE(0) lets an outsider substitute the state they are spending
 * from, so any holder of the funding coin could redirect ownership.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStatechainScript } from '../../../../packages/statechain/dist/index.js';

test('statechain owner script binds PREVSTATE(0)', () => {
  const script = buildStatechainScript('0x' + 'aa'.repeat(32));
  assert.match(
    script,
    /PREVSTATE\(0\)/,
    'statechain owner is not bound to PREVSTATE(0); an outsider can substitute STATE(0)',
  );
  assert.doesNotMatch(script, /LET OWNER=STATE\(0\)/);
});
