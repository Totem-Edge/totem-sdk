import { toRawTokenAmount } from '../amounts';

describe('toRawTokenAmount', () => {
  it('scales whole and fractional token amounts exactly', () => {
    expect(toRawTokenAmount('1.5', 8)).toBe('150000000');
    expect(toRawTokenAmount('0.00000001', 8)).toBe('1');
    expect(toRawTokenAmount('1', 0)).toBe('1');
    expect(toRawTokenAmount('1.0', 0)).toBe('1');
    expect(toRawTokenAmount('00012.3400', 4)).toBe('123400');
    expect(toRawTokenAmount('0', 8)).toBe('0');
  });

  it('rejects fractional raw units and invalid input', () => {
    expect(() => toRawTokenAmount('0.000000001', 8)).toThrow(/more than 8/);
    expect(() => toRawTokenAmount('-1', 8)).toThrow(/invalid/);
    expect(() => toRawTokenAmount('1e3', 8)).toThrow(/invalid/);
    expect(() => toRawTokenAmount('1', -1)).toThrow(/invalid token scale/);
    expect(() => toRawTokenAmount('1', 1.5)).toThrow(/invalid token scale/);
  });
});
