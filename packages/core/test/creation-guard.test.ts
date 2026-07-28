/**
 * WOTS Address Creation Tests
 * 
 * With Java-compatible refactoring (2026-01), the creation guard was removed.
 * All parameter sets now resolve to WOTS_MINIMA (w=8).
 * This test verifies that address creation works with all param set aliases.
 */
import { wotsKeypairFromSeed } from "../src/wots";
import { WOTS_V1_DEV, WOTS_V2_SPEC, WOTS_MINIMA } from "../src/params";

describe("Address creation (Java-compatible)", () => {
  const testSeed = new Uint8Array(32).fill(0x42);
  
  test("allows address creation with WOTS_MINIMA", () => {
    expect(() => {
      const keypair = wotsKeypairFromSeed(testSeed, 0, WOTS_MINIMA);
      expect(keypair.pk).toHaveLength(32);
    }).not.toThrow();
  });
  
  test("allows address creation with WOTS_V2_SPEC alias", () => {
    expect(() => {
      const keypair = wotsKeypairFromSeed(testSeed, 0, WOTS_V2_SPEC);
      expect(keypair.pk).toHaveLength(32);
    }).not.toThrow();
  });

  test("allows address creation with WOTS_V1_DEV alias", () => {
    expect(() => {
      const keypair = wotsKeypairFromSeed(testSeed, 0, WOTS_V1_DEV);
      expect(keypair.pk).toHaveLength(32);
    }).not.toThrow();
  });
  
  test("allows creation when no paramSet specified (uses default)", () => {
    expect(() => {
      const keypair = wotsKeypairFromSeed(testSeed, 0);
      expect(keypair.pk).toHaveLength(32);
    }).not.toThrow();
  });
  
  test("all param set aliases produce identical PKdigest", () => {
    const pk1 = wotsKeypairFromSeed(testSeed, 0, WOTS_MINIMA).pk;
    const pk2 = wotsKeypairFromSeed(testSeed, 0, WOTS_V1_DEV).pk;
    const pk3 = wotsKeypairFromSeed(testSeed, 0, WOTS_V2_SPEC).pk;
    const pk4 = wotsKeypairFromSeed(testSeed, 0).pk;
    
    const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
    expect(hex(pk1)).toBe(hex(pk2));
    expect(hex(pk1)).toBe(hex(pk3));
    expect(hex(pk1)).toBe(hex(pk4));
  });
  
  test("PKdigest differs for different indices", () => {
    const pk0 = wotsKeypairFromSeed(testSeed, 0, WOTS_MINIMA).pk;
    const pk1 = wotsKeypairFromSeed(testSeed, 1, WOTS_MINIMA).pk;
    
    const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
    expect(hex(pk0)).not.toBe(hex(pk1));
  });
});
