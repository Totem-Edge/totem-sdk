import { WOTS_V1_DEV, WOTS_V2_SPEC } from "../src/params";
import { toWinternitzDigits, baseWWithChecksum, wotsSign, wotsPkFromSig } from "../src/wots";
import { sha3_256 } from "js-sha3";

describe("WOTS Length and Steps Verification", () => {
  const testSeed = new Uint8Array(32).fill(0x42);
  const testMessage = new Uint8Array(sha3_256.arrayBuffer(new Uint8Array([1, 2, 3, 4])));
  
  describe("v2-spec (w=256)", () => {
    test("L should be 34", () => {
      expect(WOTS_V2_SPEC.L).toBe(34);
    });
    
    test("STEPS should be 255 (w-1)", () => {
      const STEPS = WOTS_V2_SPEC.w - 1;
      expect(STEPS).toBe(255);
    });
    
    test("toWinternitzDigits produces correct lengths for w=256", () => {
      const { digits, checksumDigits } = toWinternitzDigits(testMessage, 256);
      expect(digits.length).toBe(32); // 32 message bytes
      expect(checksumDigits.length).toBe(2); // 2 checksum bytes
      expect(digits.length + checksumDigits.length).toBe(34);
    });
    
    test("baseWWithChecksum returns exactly L=34 digits for v2-spec", () => {
      const allDigits = baseWWithChecksum(testMessage, WOTS_V2_SPEC);
      expect(allDigits.length).toBe(34);
      expect(allDigits.length).toBe(WOTS_V2_SPEC.L);
    });
    
    test("signature has exactly L=34 elements for v2-spec", () => {
      const sig = wotsSign(testMessage, testSeed, 0, WOTS_V2_SPEC);
      expect(sig.sig.length).toBe(34);
      expect(sig.sig.length).toBe(WOTS_V2_SPEC.L);
      expect(sig.w).toBe(256);
    });
    
    test("each digit value is within range [0, 255] for w=256", () => {
      const allDigits = baseWWithChecksum(testMessage, WOTS_V2_SPEC);
      for (const digit of allDigits) {
        expect(digit).toBeGreaterThanOrEqual(0);
        expect(digit).toBeLessThanOrEqual(255);
      }
    });
  });
  
  describe("v1-dev (w=8)", () => {
    test("L should be 89", () => {
      expect(WOTS_V1_DEV.L).toBe(89);
    });
    
    test("STEPS should be 7 (w-1)", () => {
      const STEPS = WOTS_V1_DEV.w - 1;
      expect(STEPS).toBe(7);
    });
    
    test("toWinternitzDigits produces correct lengths for w=8", () => {
      const { digits, checksumDigits } = toWinternitzDigits(testMessage, 8);
      // For n=256, w=8: floor(256/3) = 85 message digits, 4 checksum digits
      expect(digits.length).toBe(85);
      expect(checksumDigits.length).toBe(4);
      expect(digits.length + checksumDigits.length).toBe(89);
    });
    
    test("baseWWithChecksum returns exactly L=89 digits for v1-dev", () => {
      const allDigits = baseWWithChecksum(testMessage, WOTS_V1_DEV);
      expect(allDigits.length).toBe(89);
      expect(allDigits.length).toBe(WOTS_V1_DEV.L);
    });
    
    test("signature has exactly L=89 elements for v1-dev", () => {
      const sig = wotsSign(testMessage, testSeed, 0, WOTS_V1_DEV);
      expect(sig.sig.length).toBe(89);
      expect(sig.sig.length).toBe(WOTS_V1_DEV.L);
      expect(sig.w).toBe(8);
    });
    
    test("each digit value is within range [0, 7] for w=8", () => {
      const allDigits = baseWWithChecksum(testMessage, WOTS_V1_DEV);
      for (const digit of allDigits) {
        expect(digit).toBeGreaterThanOrEqual(0);
        expect(digit).toBeLessThanOrEqual(7);
      }
    });
  });
  
  describe("Wrong-length signature rejection", () => {
    test("wotsPkFromSig rejects wrong-length signature for v2-spec", () => {
      const sig = wotsSign(testMessage, testSeed, 0, WOTS_V2_SPEC);
      // Corrupt signature by removing an element
      sig.sig.pop();
      
      expect(() => {
        wotsPkFromSig(testMessage, sig, WOTS_V2_SPEC);
      }).toThrow("Wrong signature length: expected 34, got 33");
    });
    
    test("wotsPkFromSig rejects wrong-length signature for v1-dev", () => {
      const sig = wotsSign(testMessage, testSeed, 0, WOTS_V1_DEV);
      // Corrupt signature by adding an extra element
      sig.sig.push(new Uint8Array(32));
      
      expect(() => {
        wotsPkFromSig(testMessage, sig, WOTS_V1_DEV);
      }).toThrow("Wrong signature length: expected 89, got 90");
    });
    
    test("wotsPkFromSig rejects v1 signature with v2 params", () => {
      const sig = wotsSign(testMessage, testSeed, 0, WOTS_V1_DEV);
      
      expect(() => {
        wotsPkFromSig(testMessage, sig, WOTS_V2_SPEC);
      }).toThrow("Wrong signature length: expected 34, got 89");
    });
    
    test("wotsPkFromSig rejects v2 signature with v1 params", () => {
      const sig = wotsSign(testMessage, testSeed, 0, WOTS_V2_SPEC);
      
      expect(() => {
        wotsPkFromSig(testMessage, sig, WOTS_V1_DEV);
      }).toThrow("Wrong signature length: expected 89, got 34");
    });
  });
  
  describe("Checksum calculations", () => {
    test("v2-spec checksum for all zeros message", () => {
      const zeroMsg = new Uint8Array(32); // all zeros
      const { digits, checksumDigits } = toWinternitzDigits(zeroMsg, 256);
      // Sum = 32 * (255 - 0) = 32 * 255 = 8160
      const expectedSum = 32 * 255;
      const actualSum = (checksumDigits[0] << 8) | checksumDigits[1];
      expect(actualSum).toBe(expectedSum);
      expect(expectedSum).toBe(8160);
    });
    
    test("v2-spec checksum for all 0xFF message", () => {
      const fullMsg = new Uint8Array(32).fill(0xFF);
      const { digits, checksumDigits } = toWinternitzDigits(fullMsg, 256);
      // Sum = 32 * (255 - 255) = 0
      const actualSum = (checksumDigits[0] << 8) | checksumDigits[1];
      expect(actualSum).toBe(0);
    });
    
    test("v1-dev checksum calculation matches expected", () => {
      const zeroMsg = new Uint8Array(32); // all zeros
      const { digits, checksumDigits } = toWinternitzDigits(zeroMsg, 8);
      // For all zeros with w=8: sum of digits = 0
      // checksum = 85 * 7 - 0 = 595
      const digitsSum = digits.reduce((a, b) => a + b, 0);
      expect(digitsSum).toBe(0);
      
      // Convert checksum digits back to number
      let checksumValue = 0;
      for (const d of checksumDigits) {
        checksumValue = checksumValue * 8 + d;
      }
      expect(checksumValue).toBe(595);
    });
  });
});