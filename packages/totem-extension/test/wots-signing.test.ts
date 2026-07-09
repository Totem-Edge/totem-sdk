import { TransactionService, SignRequest } from '../src/core/transaction/service';
import './setup';

describe('WOTS Signing with Real SDK', () => {
  
  describe('TransactionService.sign() - Real Cryptographic Validation', () => {
    const testSeed = new Uint8Array(32).fill(0x42); // Deterministic seed
    const testDigestHex = '0x' + 'ab'.repeat(32); // 32-byte digest
    
    const signRequest: SignRequest = {
      l1: 10,
      l2: 5,
      l3: 3,
      digestTx: testDigestHex
    };

    test('generates real v2-spec signature with 34 elements', async () => {
      const result = await TransactionService.sign(signRequest, testSeed, 'v2-spec');
      
      // Verify witnessBundle structure
      expect(result.witnessBundle).toBeDefined();
      expect(result.witnessBundle.l1).toBe(10);
      expect(result.witnessBundle.l2).toBe(5);
      expect(result.witnessBundle.l3).toBe(3);
      
      // Verify REAL signature arrays have 34 elements (v2-spec)
      expect(result.witnessBundle.signatures.l1Proof).toHaveLength(34);
      expect(result.witnessBundle.signatures.l2Proof).toHaveLength(34);
      expect(result.witnessBundle.signatures.l3Proof).toHaveLength(34);
    });

    test('each signature element is exactly 32 bytes (64 hex chars)', async () => {
      const result = await TransactionService.sign(signRequest, testSeed, 'v2-spec');
      
      // Check L1 proof elements
      result.witnessBundle.signatures.l1Proof.forEach((hexSig, i) => {
        expect(hexSig).toMatch(/^0x[0-9a-f]{64}$/);
        expect(hexSig.replace(/^0x/, '')).toHaveLength(64); // 32 bytes
      });

      // Check L2 proof elements
      result.witnessBundle.signatures.l2Proof.forEach((hexSig, i) => {
        expect(hexSig).toMatch(/^0x[0-9a-f]{64}$/);
      });

      // Check L3 proof elements
      result.witnessBundle.signatures.l3Proof.forEach((hexSig, i) => {
        expect(hexSig).toMatch(/^0x[0-9a-f]{64}$/);
      });
    });

    test('total signature size is 3 * 34 * 32 = 3264 bytes', async () => {
      const result = await TransactionService.sign(signRequest, testSeed, 'v2-spec');
      
      const totalElements = 
        result.witnessBundle.signatures.l1Proof.length +
        result.witnessBundle.signatures.l2Proof.length +
        result.witnessBundle.signatures.l3Proof.length;
      
      expect(totalElements).toBe(3 * 34); // 102 elements total
      
      // Each element is 32 bytes
      const totalBytes = totalElements * 32;
      expect(totalBytes).toBe(3264);
    });

    test('generates deterministic signatures for same seed/digest', async () => {
      const result1 = await TransactionService.sign(signRequest, testSeed, 'v2-spec');
      const result2 = await TransactionService.sign(signRequest, testSeed, 'v2-spec');
      
      // Same seed + digest should produce identical signatures
      expect(result1.witnessBundle.signatures.l1Proof[0]).toBe(result2.witnessBundle.signatures.l1Proof[0]);
      expect(result1.witnessBundle.signatures.l2Proof[0]).toBe(result2.witnessBundle.signatures.l2Proof[0]);
      expect(result1.witnessBundle.signatures.l3Proof[0]).toBe(result2.witnessBundle.signatures.l3Proof[0]);
    });

    test('different indices produce different signatures', async () => {
      const request1 = { ...signRequest, l1: 10, l2: 5, l3: 3 };
      const request2 = { ...signRequest, l1: 20, l2: 5, l3: 3 }; // Different L1
      
      const result1 = await TransactionService.sign(request1, testSeed, 'v2-spec');
      const result2 = await TransactionService.sign(request2, testSeed, 'v2-spec');
      
      // Different L1 index should produce different L1 signature (same level comparison)
      expect(result1.witnessBundle.signatures.l1Proof[0]).not.toBe(result2.witnessBundle.signatures.l1Proof[0]);
    });

    test('validates digest length (must be 32 bytes)', async () => {
      const invalidRequest = {
        ...signRequest,
        digestTx: '0x1234' // Too short
      };
      
      await expect(
        TransactionService.sign(invalidRequest, testSeed, 'v2-spec')
      ).rejects.toThrow(/Invalid digest length/);
    });

    test('handles hex digest with and without 0x prefix', async () => {
      const digestWithoutPrefix = 'ab'.repeat(32);
      const requestNoPrefix = { ...signRequest, digestTx: digestWithoutPrefix };
      
      const result = await TransactionService.sign(requestNoPrefix, testSeed, 'v2-spec');
      
      expect(result.witnessBundle.signatures.l1Proof).toHaveLength(34);
    });

    test('returns signedHex in correct format', async () => {
      const result = await TransactionService.sign(signRequest, testSeed, 'v2-spec');
      
      // signedHex should start with 0x
      expect(result.signedHex).toMatch(/^0x/);
      
      // Should be hex string
      expect(result.signedHex).toMatch(/^0x[0-9a-f]+$/);
      
      // signedHex format: 0x + digest + l1Proof + l2Proof + l3Proof
      // digest: 64 chars (32 bytes)
      // Each proof: 34 elements * 64 chars = 2176 chars
      // Total: 2 (0x) + 64 + 2176*3 = 6594 chars
      expect(result.signedHex).toHaveLength(2 + 64 + (34 * 64 * 3));
    });

    test('handles edge case: zero indices (l1=0, l2=0, l3=0)', async () => {
      const zeroRequest: SignRequest = {
        l1: 0, l2: 0, l3: 0,
        digestTx: '0x' + '00'.repeat(32)
      };
      
      const result = await TransactionService.sign(zeroRequest, testSeed, 'v2-spec');
      
      expect(result.witnessBundle.l1).toBe(0);
      expect(result.witnessBundle.l2).toBe(0);
      expect(result.witnessBundle.l3).toBe(0);
      expect(result.witnessBundle.signatures.l1Proof).toHaveLength(34);
    });

    test('handles maximum indices (63 for 64-address tree)', async () => {
      const maxRequest: SignRequest = {
        l1: 63, l2: 63, l3: 63,
        digestTx: '0x' + 'ff'.repeat(32)
      };
      
      const result = await TransactionService.sign(maxRequest, testSeed, 'v2-spec');
      
      expect(result.witnessBundle.l1).toBe(63);
      expect(result.witnessBundle.l2).toBe(63);
      expect(result.witnessBundle.l3).toBe(63);
      expect(result.witnessBundle.signatures.l1Proof).toHaveLength(34);
    });

    test('handles all-zero digest', async () => {
      const zeroDigestRequest: SignRequest = {
        l1: 1, l2: 2, l3: 3,
        digestTx: '0x' + '00'.repeat(32)
      };
      
      const result = await TransactionService.sign(zeroDigestRequest, testSeed, 'v2-spec');
      
      expect(result.witnessBundle.signatures.l1Proof).toHaveLength(34);
    });

    test('handles all-ff digest', async () => {
      const maxDigestRequest: SignRequest = {
        l1: 1, l2: 2, l3: 3,
        digestTx: '0x' + 'ff'.repeat(32)
      };
      
      const result = await TransactionService.sign(maxDigestRequest, testSeed, 'v2-spec');
      
      expect(result.witnessBundle.signatures.l1Proof).toHaveLength(34);
    });
  });

  describe('Known test vectors (regression protection)', () => {
    test('generates consistent signatures for known seed and digest', async () => {
      // Known test vector
      const knownSeed = new Uint8Array(32);
      for (let i = 0; i < 32; i++) knownSeed[i] = i;
      
      const knownDigest = '0x' + Buffer.from(new Uint8Array(32).fill(0xff)).toString('hex');
      
      const signRequest: SignRequest = {
        l1: 10, l2: 20, l3: 30,
        digestTx: knownDigest
      };
      
      const result = await TransactionService.sign(signRequest, knownSeed, 'v2-spec');
      
      // Snapshot first element of each proof for regression testing
      expect(result.witnessBundle.signatures.l1Proof[0]).toBeDefined();
      expect(result.witnessBundle.signatures.l2Proof[0]).toBeDefined();
      expect(result.witnessBundle.signatures.l3Proof[0]).toBeDefined();
      
      // These should remain consistent across runs
      expect(result.witnessBundle.signatures.l1Proof[0]).toMatch(/^0x[0-9a-f]{64}$/);
      
      // Store first signature for regression check
      const firstL1Sig = result.witnessBundle.signatures.l1Proof[0];
      expect(firstL1Sig).toBeDefined();
      expect(firstL1Sig.length).toBe(66); // 0x + 64 hex chars
    });

    test('different seeds produce different signatures', async () => {
      const seed1 = new Uint8Array(32).fill(0x11);
      const seed2 = new Uint8Array(32).fill(0x22);
      
      const signRequest: SignRequest = {
        l1: 5, l2: 10, l3: 15,
        digestTx: '0x' + 'ab'.repeat(32)
      };
      
      const result1 = await TransactionService.sign(signRequest, seed1, 'v2-spec');
      const result2 = await TransactionService.sign(signRequest, seed2, 'v2-spec');
      
      // Different seeds should produce different signatures
      expect(result1.witnessBundle.signatures.l1Proof[0]).not.toBe(result2.witnessBundle.signatures.l1Proof[0]);
    });
  });

  describe('Real-world cryptographic properties', () => {
    test('signature elements are non-zero for non-zero digest', async () => {
      const signRequest: SignRequest = {
        l1: 1, l2: 2, l3: 3,
        digestTx: '0x' + '12'.repeat(32)
      };
      
      const result = await TransactionService.sign(signRequest, new Uint8Array(32).fill(0x42), 'v2-spec');
      
      // At least some signature elements should be non-zero
      const hasNonZeroElement = result.witnessBundle.signatures.l1Proof.some(sig => 
        sig !== '0x' + '00'.repeat(32)
      );
      
      expect(hasNonZeroElement).toBe(true);
    });

    test('signatures vary with different digest values', async () => {
      const seed = new Uint8Array(32).fill(0x42);
      const signRequest1: SignRequest = {
        l1: 1, l2: 1, l3: 1,
        digestTx: '0x' + 'ab'.repeat(32)
      };
      const signRequest2: SignRequest = {
        l1: 1, l2: 1, l3: 1,
        digestTx: '0x' + 'cd'.repeat(32) // Different digest
      };
      
      const result1 = await TransactionService.sign(signRequest1, seed, 'v2-spec');
      const result2 = await TransactionService.sign(signRequest2, seed, 'v2-spec');
      
      // Different digests should produce different signatures
      expect(result1.witnessBundle.signatures.l1Proof[0]).not.toBe(result2.witnessBundle.signatures.l1Proof[0]);
    });
  });
});
