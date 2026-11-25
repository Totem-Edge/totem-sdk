import {
  AMOUNT_SCALE,
  addAmounts,
  applyBps,
  compareAmounts,
  effectiveBps,
  formatDecimalAmount,
  gte,
  parseDecimalAmount,
  subAmounts,
} from '@totemsdk/core';
import {
  assertOperationTransition,
  canTransitionOperation,
  isTerminalOperationStatus,
} from '@totemsdk/core';

/**
 * OMN-071 / OMN-077 primitives.
 *
 * These are the shared pieces every Omnia package now uses, so the properties
 * below are asserted once: exactness, rejection of malformed input, and a
 * lifecycle that cannot treat an unknown outcome as retryable.
 */

describe('decimal amounts', () => {
  test('parses exactly at the full 18-decimal scale', () => {
    expect(parseDecimalAmount('1')).toBe(10n ** 18n);
    expect(parseDecimalAmount('1.5')).toBe(15n * 10n ** 17n);
    expect(parseDecimalAmount('0.000000000000000001')).toBe(1n);
    expect(AMOUNT_SCALE).toBe(18);
  });

  test('rejects precision it cannot represent instead of truncating', () => {
    expect(parseDecimalAmount('1.0000000000000000001')).toBeNull();
  });

  test('rejects malformed forms rather than coercing them', () => {
    for (const value of ['', ' 1', '1 ', '-1', '+1', '1e3', '0x10', '1.', '.5', 'NaN', '1,5']) {
      expect(parseDecimalAmount(value)).toBeNull();
    }
  });

  test('compares without floating point', () => {
    expect(gte('100000000000000000000000001', '100000000000000000000000000')).toBe(true);
    expect(compareAmounts('1.10', '1.1')).toBe(0);
    expect(gte('0.1', '0.2')).toBe(false);
    expect(compareAmounts('x', '1')).toBeNull();
  });

  test('adds and subtracts exactly', () => {
    expect(addAmounts('0.1', '0.2')).toBe('0.3');
    expect(addAmounts('999999999999999999999', '1')).toBe('1000000000000000000000');
    expect(subAmounts('1', '0.000000000000000001')).toBe('0.999999999999999999');
    expect(subAmounts('1', '2')).toBeNull();
  });

  test('formats canonically', () => {
    expect(formatDecimalAmount(0n)).toBe('0');
    expect(formatDecimalAmount(10n ** 18n)).toBe('1');
    expect(formatDecimalAmount(15n * 10n ** 17n)).toBe('1.5');
  });

  test('computes basis points exactly and rounds ceilings up', () => {
    expect(applyBps('100', 100)).toBe('1');
    expect(applyBps('100', 0)).toBe('0');
    expect(applyBps('100', -1)).toBeNull();
    expect(effectiveBps('1', '100')).toBe(100);
    // 0.01 on 300 is 0.333… bps, which must round up to 1, not to 0.
    expect(effectiveBps('0.01', '300')).toBe(1);
  });
});

describe('operation lifecycle', () => {
  test('committed is terminal and cannot be reopened', () => {
    expect(isTerminalOperationStatus('committed')).toBe(true);
    expect(canTransitionOperation('committed', 'failed')).toBe(false);
    expect(() => assertOperationTransition('committed', 'failed')).toThrow(/cannot move/);
  });

  test('executing can end as unknown', () => {
    expect(canTransitionOperation('executing', 'unknown')).toBe(true);
    expect(isTerminalOperationStatus('unknown')).toBe(true);
  });

  test('unknown can only be resolved by reconciliation', () => {
    expect(canTransitionOperation('unknown', 'committed')).toBe(true);
    expect(canTransitionOperation('unknown', 'failed')).toBe(true);
    expect(canTransitionOperation('unknown', 'executing')).toBe(false);
  });

  test('a proven failure is retryable', () => {
    expect(canTransitionOperation('failed', 'executing')).toBe(true);
  });
});
