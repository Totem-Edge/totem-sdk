import { createPerAddressTreeKey } from '@totemsdk/core';
import { TransactionService, type SignPerAddressRequest } from '../src/core/transaction/service';
import './setup';

/**
 * WOTS signing tests against the current per-address TreeKey architecture
 * (addressIndex, l1, l2) — the legacy 3-level `TransactionService.sign()`
 * (l1/l2/l3 flat proofs) no longer exists.
 *
 * `signWithPerAddressTreeKey` produces the Minima `TreeKey.sign()` proof chain.
 * For a depth-3 per-address TreeKey the chain is Root → L1 → L2 → DATA, i.e.
 * three `SignatureProof` entries, each carrying a 32-byte WOTS public-key digest
 * (leafPubkey), a 1088-byte WOTS signature (L×32 = 34×32), and an MMR proof.
 */

const HEX_32 = /^0x[0-9a-f]{64}$/;
const WOTS_SIGNATURE_HEX_LEN = 2 + 34 * 32 * 2; // '0x' + 1088 bytes

const TEST_SEED = new Uint8Array(32).fill(0x42);
const TEST_DIGEST = '0x' + 'ab'.repeat(32);

function request(overrides: Partial<SignPerAddressRequest> = {}): SignPerAddressRequest {
  return { addressIndex: 0, l1: 10, l2: 5, digestTx: TEST_DIGEST, ...overrides };
}

describe('WOTS signing (per-address TreeKey)', () => {
  test('produces a 3-proof hierarchical witness bundle', async () => {
    const treeKey = createPerAddressTreeKey(TEST_SEED, 0);
    const { witnessBundle, signedHex } = await TransactionService.signWithPerAddressTreeKey(request(), treeKey);

    expect(witnessBundle.addressIndex).toBe(0);
    expect(witnessBundle.l1).toBe(10);
    expect(witnessBundle.l2).toBe(5);
    expect(witnessBundle.rootPublicKey).toMatch(HEX_32);
    expect(witnessBundle.proofs).toHaveLength(3);

    for (const proof of witnessBundle.proofs) {
      expect(proof.leafPubkey).toMatch(HEX_32);
      expect(proof.signature).toMatch(/^0x[0-9a-f]+$/);
      expect(proof.signature).toHaveLength(WOTS_SIGNATURE_HEX_LEN);
      expect(proof.mmrProof).toMatch(/^0x[0-9a-f]*$/);
    }

    expect(signedHex).toMatch(/^0x[0-9a-f]+$/);
  });

  test('is deterministic for the same seed, indices, and digest', async () => {
    const a = await TransactionService.signWithPerAddressTreeKey(request(), createPerAddressTreeKey(TEST_SEED, 0));
    const b = await TransactionService.signWithPerAddressTreeKey(request(), createPerAddressTreeKey(TEST_SEED, 0));

    expect(a.signedHex).toBe(b.signedHex);
    expect(a.witnessBundle.proofs[2].signature).toBe(b.witnessBundle.proofs[2].signature);
  });

  test('different indices produce different signatures', async () => {
    const a = await TransactionService.signWithPerAddressTreeKey(request({ l1: 10, l2: 5 }), createPerAddressTreeKey(TEST_SEED, 0));
    const b = await TransactionService.signWithPerAddressTreeKey(request({ l1: 20, l2: 5 }), createPerAddressTreeKey(TEST_SEED, 0));

    expect(a.witnessBundle.proofs[2].signature).not.toBe(b.witnessBundle.proofs[2].signature);
  });

  test('different seeds produce different signatures', async () => {
    const a = await TransactionService.signWithPerAddressTreeKey(request(), createPerAddressTreeKey(new Uint8Array(32).fill(0x11), 0));
    const b = await TransactionService.signWithPerAddressTreeKey(request(), createPerAddressTreeKey(new Uint8Array(32).fill(0x22), 0));

    expect(a.witnessBundle.rootPublicKey).not.toBe(b.witnessBundle.rootPublicKey);
    expect(a.witnessBundle.proofs[2].signature).not.toBe(b.witnessBundle.proofs[2].signature);
  });

  test('rejects a digest that is not 32 bytes', async () => {
    const treeKey = createPerAddressTreeKey(TEST_SEED, 0);
    await expect(
      TransactionService.signWithPerAddressTreeKey(request({ digestTx: '0x1234' }), treeKey),
    ).rejects.toThrow(/Invalid digest length/);
  });

  test('rejects an out-of-range address index', async () => {
    const treeKey = createPerAddressTreeKey(TEST_SEED, 0);
    await expect(
      TransactionService.signWithPerAddressTreeKey(request({ addressIndex: 64 }), treeKey),
    ).rejects.toThrow(/out of range/);
  });

  test('handles zero and maximum indices', async () => {
    const zero = await TransactionService.signWithPerAddressTreeKey(
      request({ l1: 0, l2: 0, digestTx: '0x' + '00'.repeat(32) }),
      createPerAddressTreeKey(TEST_SEED, 0),
    );
    expect(zero.witnessBundle.proofs).toHaveLength(3);

    const max = await TransactionService.signWithPerAddressTreeKey(
      request({ l1: 63, l2: 63, digestTx: '0x' + 'ff'.repeat(32) }),
      createPerAddressTreeKey(TEST_SEED, 0),
    );
    expect(max.witnessBundle.l1).toBe(63);
    expect(max.witnessBundle.l2).toBe(63);
    expect(max.witnessBundle.proofs).toHaveLength(3);
  });

  test('different address indices derive different TreeKeys', async () => {
    const a = await TransactionService.signWithPerAddressTreeKey(request({ addressIndex: 0, l1: 1, l2: 1 }), createPerAddressTreeKey(TEST_SEED, 0));
    const b = await TransactionService.signWithPerAddressTreeKey(request({ addressIndex: 1, l1: 1, l2: 1 }), createPerAddressTreeKey(TEST_SEED, 1));
    expect(a.witnessBundle.rootPublicKey).not.toBe(b.witnessBundle.rootPublicKey);
  });
});
