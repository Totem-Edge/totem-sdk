import {
  buildPoolFundTx,
  verifyPoolFundTx,
  addressFromPkDigest,
  toProofHex,
  hashPoolFundTx,
  type PoolFundTx,
  type DeepFundingProof,
} from '../fund-tx';
import { wotsKeypairFromSeed } from '@totemsdk/core';

const SEED = new Uint8Array(32).fill(7);

function lpFixture(index = 0) {
  const { pk } = wotsKeypairFromSeed(SEED, index);
  return { lpAddress: addressFromPkDigest(pk), lpKeyIndex: index };
}

describe('buildPoolFundTx', () => {
  it('produces a deep funding proof signed by the LP', () => {
    const { lpAddress, lpKeyIndex } = lpFixture();
    const { tx, proof, signature } = buildPoolFundTx({
      poolId: 'pool-1',
      fundingCoinId: '0xFUND',
      tokenId: '0x00',
      amount: '250000',
      lpAddress,
      recipientAddress: addressFromPkDigest(wotsKeypairFromSeed(new Uint8Array(32).fill(9), 0).pk),
      lpSeed: SEED,
      lpKeyIndex,
      nonce: 'n1',
    });

    expect(proof.lpAddress).toBe(lpAddress);
    expect(signature.length).toBeGreaterThan(0);
    const check = verifyPoolFundTx(tx, proof);
    expect(check.valid).toBe(true);
    expect(check.reasons).toEqual([]);
  });

  it('throws when the seed does not own the claimed lpAddress', () => {
    const attacker = addressFromPkDigest(wotsKeypairFromSeed(new Uint8Array(32).fill(99), 0).pk);
    expect(() =>
      buildPoolFundTx({
        poolId: 'pool-1',
        fundingCoinId: '0xFUND',
        amount: '100',
        lpAddress: attacker,
        recipientAddress: attacker,
        lpSeed: SEED,
      }),
    ).toThrow(/do not own lpAddress/);
  });
});

describe('verifyPoolFundTx', () => {
  function fixture() {
    const { lpAddress, lpKeyIndex } = lpFixture();
    const { tx, proof } = buildPoolFundTx({
      poolId: 'pool-1',
      fundingCoinId: '0xFUND',
      tokenId: '0x00',
      amount: '250000',
      lpAddress,
      recipientAddress: addressFromPkDigest(wotsKeypairFromSeed(new Uint8Array(32).fill(9), 0).pk),
      lpSeed: SEED,
      lpKeyIndex,
      nonce: 'n1',
    });
    return { tx, proof, lpAddress };
  }

  it('accepts a genuine deep proof against the pool address', () => {
    const { tx, proof } = fixture();
    const check = verifyPoolFundTx(tx, proof, tx.recipientAddress);
    expect(check.valid).toBe(true);
  });

  it('rejects a tampered transaction (digest binding)', () => {
    const { tx, proof } = fixture();
    const forged: PoolFundTx = { ...tx, amount: '999999' };
    const check = verifyPoolFundTx(forged, proof, tx.recipientAddress);
    expect(check.valid).toBe(false);
    expect(check.reasons).toContain('signedDigest does not match the transaction');
  });

  it('rejects a tampered proof amount', () => {
    const { tx, proof } = fixture();
    const forged: DeepFundingProof = { ...proof, amount: '1' };
    const check = verifyPoolFundTx(tx, forged, tx.recipientAddress);
    expect(check.valid).toBe(false);
  });

  it('rejects a proof whose signer does not own the LP address', () => {
    const { tx, proof } = fixture();
    const attacker = addressFromPkDigest(wotsKeypairFromSeed(new Uint8Array(32).fill(42), 0).pk);
    const forged: DeepFundingProof = { ...proof, lpAddress: attacker };
    const check = verifyPoolFundTx(tx, forged, tx.recipientAddress);
    expect(check.valid).toBe(false);
    expect(check.reasons).toContain('lpPkDigest does not own lpAddress');
  });

  it('rejects a proof bound to a different pool script address', () => {
    const { tx, proof } = fixture();
    const other = addressFromPkDigest(wotsKeypairFromSeed(new Uint8Array(32).fill(5), 0).pk);
    const check = verifyPoolFundTx(tx, proof, other);
    expect(check.valid).toBe(false);
    expect(check.reasons).toContain(`recipient ${proof.recipientAddress} is not the expected pool address ${other}`);
  });

  it('rejects a replayed nonce or foreign domain', () => {
    const { tx, proof } = fixture();
    const replayed: DeepFundingProof = { ...proof, nonce: 'n2' };
    const a = verifyPoolFundTx(tx, replayed, tx.recipientAddress);
    expect(a.valid).toBe(false);
    expect(a.reasons).toContain('proof.nonce differs from tx');

    const foreign: PoolFundTx = { ...tx, domain: 'evil' };
    const b = verifyPoolFundTx(foreign, proof, tx.recipientAddress);
    expect(b.valid).toBe(false);
    expect(b.reasons).toContain('tx uses a foreign domain');
  });
});

describe('deep proof determinism', () => {
  it('hash and hex encoding are stable', () => {
    const { lpAddress, lpKeyIndex } = lpFixture();
    const a = buildPoolFundTx({
      poolId: 'pool-1',
      fundingCoinId: '0xFUND',
      amount: '250000',
      lpAddress,
      recipientAddress: lpAddress,
      lpSeed: SEED,
      lpKeyIndex,
      nonce: 'n1',
    });
    const b = buildPoolFundTx({
      poolId: 'pool-1',
      fundingCoinId: '0xFUND',
      amount: '250000',
      lpAddress,
      recipientAddress: lpAddress,
      lpSeed: SEED,
      lpKeyIndex,
      nonce: 'n1',
    });
    expect(hashPoolFundTx(b.tx)).toEqual(hashPoolFundTx(a.tx));
    expect(toProofHex(b.proof)).toBe(toProofHex(a.proof));
  });
});