import {
  MINIMA_DECIMALS,
  amountToAtoms,
  atomsToAmount,
  atomsToMiniNumber,
  coinAmountAtoms,
  unscaledToAmount,
} from '@totemsdk/core';

const ATOMS_PER_MINIMA = 10n ** BigInt(MINIMA_DECIMALS);

describe('amount units (decimal MINIMA text <-> atoms)', () => {
  it('converts fractional and whole amounts exactly', () => {
    expect(amountToAtoms('0.2')).toBe(2n * 10n ** 43n);
    expect(amountToAtoms('3')).toBe(3n * ATOMS_PER_MINIMA);
    expect(amountToAtoms('0')).toBe(0n);
    expect(amountToAtoms('0.' + '0'.repeat(43) + '1')).toBe(1n);
  });

  it('accepts a leading-dot-free zero part and trailing zeros', () => {
    expect(amountToAtoms('000.20')).toBe(2n * 10n ** 43n);
    expect(amountToAtoms('0.' + '0'.repeat(MINIMA_DECIMALS))).toBe(0n);
  });

  it('round-trips through atomsToAmount', () => {
    for (const value of ['0', '1', '0.2', '123.0000001', '0.' + '0'.repeat(43) + '1']) {
      expect(atomsToAmount(amountToAtoms(value))).toBe(
        value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value,
      );
    }
  });

  it('reports the MiniNumber scale Java expects for an atom amount', () => {
    expect(atomsToMiniNumber(2n * 10n ** 43n)).toEqual({
      unscaled: 2n * 10n ** 43n,
      scale: MINIMA_DECIMALS,
    });
  });

  it('renders unscaled values at an arbitrary MiniNumber scale', () => {
    expect(unscaledToAmount(2n * 10n ** 43n, 44)).toBe('0.2');
    expect(unscaledToAmount(150n, 2)).toBe('1.5');
    expect(unscaledToAmount(5n, 0)).toBe('5');
    expect(() => unscaledToAmount(-1n, 2)).toThrow(/non-negative/);
    expect(() => unscaledToAmount(1n, 256)).toThrow(/scale/);
  });

  it('reads a coin amount as atoms across provider and internal forms', () => {
    expect(coinAmountAtoms({ amount: '0.2' })).toBe(2n * 10n ** 43n);
    expect(coinAmountAtoms({ amount: '3' })).toBe(3n * ATOMS_PER_MINIMA);
    expect(coinAmountAtoms({ amount: 1000 })).toBe(1000n);
    expect(coinAmountAtoms({ amount: 1000n })).toBe(1000n);
    expect(() => coinAmountAtoms({ amount: 0.5 })).toThrow(/non-negative integer/);
    expect(() => coinAmountAtoms({ amount: -1n })).toThrow(/non-negative/);
  });

  it('fails closed on non-decimal, negative, exponent and over-precise input', () => {
    expect(() => amountToAtoms('-1')).toThrow(/non-negative decimal/);
    expect(() => amountToAtoms('1e3')).toThrow(/non-negative decimal/);
    expect(() => amountToAtoms('abc')).toThrow(/non-negative decimal/);
    expect(() => amountToAtoms('')).toThrow(/non-negative decimal/);
    expect(() => amountToAtoms('.')).toThrow(/non-negative decimal/);
    expect(() => amountToAtoms('1.' + '0'.repeat(MINIMA_DECIMALS) + '1')).toThrow(
      /cannot be represented exactly/,
    );
    expect(() => atomsToAmount(-1n)).toThrow(/non-negative/);
    expect(() => atomsToMiniNumber(-1n)).toThrow(/non-negative/);
  });
});
