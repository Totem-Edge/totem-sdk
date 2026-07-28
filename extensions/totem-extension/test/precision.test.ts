import { formatMinimaAmount, parseMinimaAmount, MINIMA_SCALE, MINIMA_DECIMALS } from '../src/constants';
import './setup';

describe('Minima Precision Utilities (44 decimals)', () => {
  
  describe('formatMinimaAmount', () => {
    test('formats zero correctly', () => {
      expect(formatMinimaAmount('0')).toBe('0');
    });

    test('formats whole number without decimals', () => {
      const oneMinima = MINIMA_SCALE.toString();
      expect(formatMinimaAmount(oneMinima)).toBe('1');
    });

    test('formats fractional amounts with default 4 decimals', () => {
      // 1.5 MINIMA = 15 * 10^43
      const oneFive = (BigInt('15') * MINIMA_SCALE / BigInt('10')).toString();
      expect(formatMinimaAmount(oneFive)).toBe('1.5');
    });

    test('formats small fractional amounts correctly', () => {
      // 0.0001 MINIMA
      const small = (BigInt('1') * MINIMA_SCALE / BigInt('10000')).toString();
      expect(formatMinimaAmount(small)).toBe('0.0001');
    });

    test('formats large amounts correctly', () => {
      // 1,000,000 MINIMA
      const large = (BigInt('1000000') * MINIMA_SCALE).toString();
      expect(formatMinimaAmount(large)).toBe('1000000');
    });

    test('handles maximum precision (44 decimals)', () => {
      // Test with 1 base unit (smallest possible amount)
      expect(formatMinimaAmount('1', 44)).toBe('0.00000000000000000000000000000000000000000001');
    });

    test('truncates to specified decimal places', () => {
      // 1.123456789 with 4 decimal display
      const value = (BigInt('1123456789') * MINIMA_SCALE / BigInt('1000000000')).toString();
      expect(formatMinimaAmount(value, 4)).toBe('1.1234');
    });

    test('removes trailing zeros from fractional part', () => {
      // 1.5000 should display as 1.5
      const value = (BigInt('15000') * MINIMA_SCALE / BigInt('10000')).toString();
      expect(formatMinimaAmount(value)).toBe('1.5');
    });

    test('handles edge case: 1 base unit with limited decimals', () => {
      // 1 base unit with 44 decimals is 0.00...001 (44 zeros before the 1)
      // When formatted with only 6 decimals, it rounds to 0
      expect(formatMinimaAmount('1', 6)).toBe('0');
      // But with full 44 decimals, it shows the value
      expect(formatMinimaAmount('1', 44)).toBe('0.00000000000000000000000000000000000000000001');
    });

    test('handles very large fractional precision', () => {
      // Test 0.12345678901234567890123456789012345678901234 (full 44 decimals)
      const maxPrecision = '12345678901234567890123456789012345678901234';
      expect(formatMinimaAmount(maxPrecision, 44)).toBe('0.12345678901234567890123456789012345678901234');
    });

    test('handles invalid input gracefully', () => {
      expect(formatMinimaAmount('invalid')).toBe('0');
      expect(formatMinimaAmount('')).toBe('0');
    });

    test('formats negative amounts (if supported)', () => {
      const negativeOne = (-MINIMA_SCALE).toString();
      const result = formatMinimaAmount(negativeOne);
      expect(result).toBe('-1');
    });
  });

  describe('parseMinimaAmount', () => {
    test('parses zero correctly', () => {
      expect(parseMinimaAmount('0')).toBe('0');
    });

    test('parses whole number correctly', () => {
      expect(parseMinimaAmount('1')).toBe(MINIMA_SCALE.toString());
    });

    test('parses fractional amount correctly', () => {
      const result = parseMinimaAmount('1.5');
      const expected = (BigInt('15') * MINIMA_SCALE / BigInt('10')).toString();
      expect(result).toBe(expected);
    });

    test('parses small fractional amounts', () => {
      const result = parseMinimaAmount('0.0001');
      const expected = (BigInt('1') * MINIMA_SCALE / BigInt('10000')).toString();
      expect(result).toBe(expected);
    });

    test('parses large amounts correctly', () => {
      const result = parseMinimaAmount('1000000');
      const expected = (BigInt('1000000') * MINIMA_SCALE).toString();
      expect(result).toBe(expected);
    });

    test('handles maximum precision input (44 decimals)', () => {
      const input = '0.12345678901234567890123456789012345678901234';
      const result = parseMinimaAmount(input);
      expect(result).toBe('12345678901234567890123456789012345678901234');
    });

    test('pads short fractional parts correctly', () => {
      const result = parseMinimaAmount('1.5');
      const expected = (BigInt('15') * MINIMA_SCALE / BigInt('10')).toString();
      expect(result).toBe(expected);
    });

    test('truncates fractional parts exceeding 44 decimals', () => {
      const input = '1.' + '1'.repeat(50); // 50 decimal places
      const result = parseMinimaAmount(input);
      const expected = parseMinimaAmount('1.' + '1'.repeat(44)); // Should match 44 decimals
      expect(result).toBe(expected);
    });

    test('handles amount without decimal point', () => {
      expect(parseMinimaAmount('5')).toBe((BigInt('5') * MINIMA_SCALE).toString());
    });

    test('handles amount with trailing decimal point', () => {
      expect(parseMinimaAmount('5.')).toBe((BigInt('5') * MINIMA_SCALE).toString());
    });

    test('handles invalid input gracefully', () => {
      expect(parseMinimaAmount('invalid')).toBe('0');
      expect(parseMinimaAmount('')).toBe('0');
    });

    test('handles very small amounts (1 base unit)', () => {
      const smallest = '0.' + '0'.repeat(43) + '1'; // 0.00...001 (44 decimals)
      expect(parseMinimaAmount(smallest)).toBe('1');
    });
  });

  describe('Round-trip conversion', () => {
    test('parse → format returns original value (whole)', () => {
      const original = '100';
      const parsed = parseMinimaAmount(original);
      const formatted = formatMinimaAmount(parsed);
      expect(formatted).toBe(original);
    });

    test('parse → format returns original value (fractional)', () => {
      const original = '1.2345';
      const parsed = parseMinimaAmount(original);
      const formatted = formatMinimaAmount(parsed, 4);
      expect(formatted).toBe(original);
    });

    test('parse → format handles maximum precision', () => {
      const original = '0.12345678901234567890123456789012345678901234';
      const parsed = parseMinimaAmount(original);
      const formatted = formatMinimaAmount(parsed, 44);
      expect(formatted).toBe(original);
    });

    test('format → parse returns original value', () => {
      const original = MINIMA_SCALE.toString();
      const formatted = formatMinimaAmount(original);
      const parsed = parseMinimaAmount(formatted);
      expect(parsed).toBe(original);
    });
  });

  describe('Edge cases and constants', () => {
    test('MINIMA_SCALE is 10^44', () => {
      expect(MINIMA_SCALE).toBe(BigInt(10) ** BigInt(44));
    });

    test('MINIMA_DECIMALS is 44', () => {
      expect(MINIMA_DECIMALS).toBe(44);
    });

    test('handles amounts near JavaScript MAX_SAFE_INTEGER', () => {
      // JavaScript MAX_SAFE_INTEGER = 9007199254740991
      const largeBaseUnits = (BigInt(9007199254740991) * MINIMA_SCALE).toString();
      const formatted = formatMinimaAmount(largeBaseUnits);
      expect(formatted).toBe('9007199254740991');
    });

    test('handles amounts far exceeding JavaScript number limits', () => {
      // 10^20 MINIMA (would overflow JavaScript number)
      const veryLarge = (BigInt('100000000000000000000') * MINIMA_SCALE).toString();
      const formatted = formatMinimaAmount(veryLarge);
      expect(formatted).toBe('100000000000000000000');
    });
  });

  describe('Real-world transaction scenarios', () => {
    test('formats typical transaction amount: 5.25 MINIMA', () => {
      const baseUnits = (BigInt('525') * MINIMA_SCALE / BigInt('100')).toString();
      expect(formatMinimaAmount(baseUnits)).toBe('5.25');
    });

    test('parses typical user input: "10.5"', () => {
      const result = parseMinimaAmount('10.5');
      const expected = (BigInt('105') * MINIMA_SCALE / BigInt('10')).toString();
      expect(result).toBe(expected);
    });

    test('handles gas fees with high precision: 0.000123', () => {
      const baseUnits = (BigInt('123') * MINIMA_SCALE / BigInt('1000000')).toString();
      expect(formatMinimaAmount(baseUnits, 6)).toBe('0.000123');
    });
  });
});
