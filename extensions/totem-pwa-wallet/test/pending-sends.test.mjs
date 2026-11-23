/**
 * Balance math behind the optimistic-send UX. A regression here shows the user
 * a wrong balance immediately after sending, so pin it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  subtractAmount,
  effectiveBalance,
  pendingAmountFor,
} from '../src/core/pendingSends.ts';

const send = (amount, tokenId = '0x00') => ({
  txpowid: '0xabc',
  address: 'MxTEST',
  tokenId,
  amount,
  balanceBefore: '0.1',
  createdAt: Date.now(),
});

test('subtractAmount keeps whole numbers intact', () => {
  assert.equal(subtractAmount('100', '1'), '99');
  assert.equal(subtractAmount('0.7', '0.1'), '0.6');
  assert.equal(subtractAmount('0.1', '0.1'), '0');
});

test('effectiveBalance subtracts in-flight sends from the confirmed balance', () => {
  assert.equal(effectiveBalance('0.1', [send('0.1')], '0x00'), '0');
  assert.equal(effectiveBalance('1', [send('0.1')], '0x00'), '0.9');
  assert.equal(effectiveBalance('1', [send('0.1', '0x05')], '0x00'), '1');
});

test('pendingAmountFor sums only the requested token', () => {
  const sends = [send('0.1'), send('0.2'), send('5', '0x05')];
  assert.equal(pendingAmountFor(sends, '0x00'), '0.3');
  assert.equal(pendingAmountFor(sends, '0x05'), '5');
  assert.equal(pendingAmountFor(sends, '0x99'), '0');
});
