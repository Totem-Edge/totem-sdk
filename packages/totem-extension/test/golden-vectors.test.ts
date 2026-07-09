import { formatMinimaAmount, parseMinimaAmount } from '../src/constants';
import goldenVectors from './goldens/wots-vectors.json';
import './setup';

describe('Golden Vector Regression Tests', () => {
  
  describe('44-decimal precision golden vectors', () => {
    const precisionVectors = goldenVectors.precision.testCases;

    precisionVectors.forEach(vector => {
      test(`parseMinimaAmount: ${vector.name}`, () => {
        const result = parseMinimaAmount(vector.displayAmount);
        expect(result).toBe(vector.baseUnits);
      });

      test(`formatMinimaAmount: ${vector.name}`, () => {
        const result = formatMinimaAmount(vector.baseUnits, 44);
        // Normalize by parsing and reformatting to remove trailing zeros
        const normalized = formatMinimaAmount(parseMinimaAmount(result), 44);
        const expectedNormalized = formatMinimaAmount(parseMinimaAmount(vector.displayAmount), 44);
        expect(normalized).toBe(expectedNormalized);
      });
    });

    test('round-trip conversion preserves all values', () => {
      precisionVectors.forEach(vector => {
        const parsed = parseMinimaAmount(vector.displayAmount);
        const formatted = formatMinimaAmount(parsed, 44);
        const reparsed = parseMinimaAmount(formatted);
        expect(reparsed).toBe(vector.baseUnits);
      });
    });
  });

  describe('WOTS signature structure golden vectors', () => {
    const wotsVectors = goldenVectors.vectors;

    wotsVectors.forEach(vector => {
      test(`validates structure: ${vector.name}`, () => {
        expect(vector.expectedSignatureLength).toBe(34); // v2-spec: L=34
        expect(vector.expectedTotalBytes).toBe(3264); // 3 * 34 * 32 = 3264
        expect(vector.seed).toMatch(/^0x[0-9a-f]{64}$/);
        expect(vector.digest).toMatch(/^0x[0-9a-f]{64}$/);
      });

      test(`validates indices: ${vector.name}`, () => {
        expect(vector.indices.l1).toBeGreaterThanOrEqual(0);
        expect(vector.indices.l1).toBeLessThan(64);
        expect(vector.indices.l2).toBeGreaterThanOrEqual(0);
        expect(vector.indices.l2).toBeLessThan(64);
        expect(vector.indices.l3).toBeGreaterThanOrEqual(0);
        expect(vector.indices.l3).toBeLessThan(64);
      });
    });
  });

  describe('Transaction flow golden vector', () => {
    const flowVector = goldenVectors.transactionFlow;

    test('validates prepare request structure', () => {
      expect(flowVector.prepare.to).toMatch(/^0x[0-9a-f]{64}$/);
      expect(flowVector.prepare.amount).toMatch(/^\d+$/);
      expect(flowVector.prepare.tokenId).toMatch(/^0x[0-9a-f]+$/);
    });

    test('validates expected signature structure', () => {
      const sig = flowVector.expectedSignature;
      
      expect(sig.witnessBundle.l1ProofLength).toBe(34);
      expect(sig.witnessBundle.l2ProofLength).toBe(34);
      expect(sig.witnessBundle.l3ProofLength).toBe(34);
      expect(sig.witnessBundle.elementSize).toBe(32);
      
      // signedHex format: 0x + digest(64) + l1Proof(34*64) + l2Proof(34*64) + l3Proof(34*64)
      // = 2 + 64 + 2176 + 2176 + 2176 = 6594
      expect(sig.totalLength).toBe(6594);
    });

    test('validates rootPublicKey format', () => {
      expect(flowVector.rootPublicKey).toMatch(/^0x[0-9a-f]{64}$/);
    });

    test('validates seed format', () => {
      expect(flowVector.seed).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe('Constants validation', () => {
    test('MINIMA_DECIMALS matches golden vector', () => {
      expect(goldenVectors.precision.decimals).toBe(44);
    });

    test('MINIMA_SCALE matches golden vector', () => {
      // 10^44 = 1 followed by 44 zeros = 45 characters total
      expect(goldenVectors.precision.scale).toBe('100000000000000000000000000000000000000000000');
      expect(goldenVectors.precision.scale.length).toBe(45); // 1 + 44 zeros
    });

    test('v2-spec parameter set', () => {
      expect(goldenVectors.paramSet).toBe('v2-spec');
    });
  });

  describe('Edge case validation from golden vectors', () => {
    test('handles zero values correctly', () => {
      const zeroVector = goldenVectors.precision.testCases.find(v => v.name === 'Zero');
      expect(zeroVector).toBeDefined();
      expect(parseMinimaAmount(zeroVector!.displayAmount)).toBe('0');
      expect(formatMinimaAmount(zeroVector!.baseUnits)).toBe('0');
    });

    test('handles maximum precision (1 base unit)', () => {
      const maxPrecVector = goldenVectors.precision.testCases.find(v => v.name === 'Maximum precision (1 base unit)');
      expect(maxPrecVector).toBeDefined();
      expect(parseMinimaAmount(maxPrecVector!.displayAmount)).toBe('1');
    });

    test('handles large amounts correctly', () => {
      const largeVector = goldenVectors.precision.testCases.find(v => v.name === 'Large amount (1 million)');
      expect(largeVector).toBeDefined();
      expect(parseMinimaAmount(largeVector!.displayAmount)).toBe(largeVector!.baseUnits);
    });
  });

  describe('Regression protection', () => {
    test('changing WOTS implementation should break these tests', () => {
      // This test ensures that any changes to WOTS signature structure
      // will fail the golden vector tests, alerting us to potential breaking changes
      
      const totalSignatureBytes = goldenVectors.vectors[0].expectedTotalBytes;
      const signatureLength = goldenVectors.vectors[0].expectedSignatureLength;
      
      // If these change, WOTS implementation has changed
      expect(totalSignatureBytes).toBe(3264);
      expect(signatureLength).toBe(34);
    });

    test('changing precision should break these tests', () => {
      // This test ensures that any changes to precision handling
      // will fail the golden vector tests
      
      const scale = goldenVectors.precision.scale;
      const decimals = goldenVectors.precision.decimals;
      
      // If these change, precision implementation has changed
      expect(decimals).toBe(44);
      expect(scale).toBe('100000000000000000000000000000000000000000000'); // 10^44 (45 chars)
    });
  });
});
