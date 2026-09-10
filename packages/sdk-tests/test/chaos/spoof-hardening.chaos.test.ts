/**
 * sdk-tests/test/chaos/spoof-hardening.chaos.test.ts — adversarial conformance
 * fixtures for the liquidity-bond spoof-hardening program (#35).
 *
 * One fixture per attack surface killed in P0/P0.5/P1:
 *   A phantom deposit   — acceptCommitment refuses declared-only funding
 *   B operator forgery   — applyRegistryTransition rejects a forged signer
 *   C fee/NAV inflation  — unverified earnable fees never accrue to NAV
 *   D receipt replay     — a consumed receipt cannot double-withdraw
 *   E identity squatting — a signature-backed proof cannot be forged
 */

import {
  createEmptyLiquidityBondRegistryState,
  createLiquidityPoolManifest,
  createLiquidityCommitment,
  confirmLiquidityCommitment,
  acceptLiquidityCommitment,
  applyRegistryTransition,
  signRegistryTransition,
  computeRegistryRoot,
  recordLiquidityFee,
  sumLpFeesForPosition,
  verifyIdentityChallengeProof,
  computeIdentityChallenge,
  type RegistryTransitionSigner,
  type RegistryRootVerifier,
} from '@totemsdk/liquidity-bond';
import { verifyDeposit } from '@totemsdk/chain-provider';
import { buildPoolFundTx, verifyPoolFundTx } from '@totemsdk/tx-builder';
import { bytesToHex, hexToBytes, scriptFromWotsPk, scriptToAddress, wotsKeypairFromSeed, wotsSign } from '@totemsdk/core';

const SEED = new Uint8Array(32).fill(31);
const ATTACKER_SEED = new Uint8Array(32).fill(77);

function makePool() {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makeSigner(seed: Uint8Array, pk = 'rooter-1'): RegistryTransitionSigner {
  return { publicKeyDigest: pk, sign: async () => new Uint8Array([1, 2, 3]) };
}

function makeVerifier(signer: RegistryTransitionSigner): RegistryRootVerifier {
  return {
    publicKeyDigest: signer.publicKeyDigest,
    verify: async (payload, signature) => {
      const r = await signer.sign(payload as Uint8Array, { addressIndex: 0, l1: 0, l2: 0 });
      return (r as Uint8Array).every((b, i) => (signature as Uint8Array)[i] === b);
    },
  };
}

describe('spoof-hardening conformance (A/B/C/D/E)', () => {
  it('A: phantom deposit — declared funding is never accepted', async () => {
    const pool = makePool();
    const commitment = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      funding: { utxoRef: '0xPHANTOM', tokenId: '0x00', amount: 1000n, status: 'declared' },
    });
    await expect(acceptLiquidityCommitment(commitment)).rejects.toThrow(/not chain-confirmed/);
  });

  it('A: deep proof — a funding coin must be unspent and owned', async () => {
    const result = await verifyDeposit(
      { getCoin: async () => ({ coinid: '0xC1', amount: '1000', address: 'MxLP', tokenid: '0x00', spent: true }) },
      { coinId: '0xC1', ownerAddress: 'MxLP' },
    );
    expect(result.valid).toBe(false);
    expect(result.unspent).toBe(false);
  });

  it('A: deep proof — LP-signed spend into the pool script', () => {
    const kp = wotsKeypairFromSeed(SEED, 0);
    const lpAddress = scriptToAddress(scriptFromWotsPk(kp.pk));
    const { tx, proof } = buildPoolFundTx({
      poolId: 'pool-1',
      fundingCoinId: '0xC1',
      amount: '1000',
      lpAddress,
      recipientAddress: lpAddress,
      lpSeed: SEED,
      nonce: 'n1',
    });
    expect(verifyPoolFundTx(tx, proof, tx.recipientAddress).valid).toBe(true);
    const forged = { ...proof, amount: '999999' };
    expect(verifyPoolFundTx(tx, forged, tx.recipientAddress).valid).toBe(false);
  });

  it('B: operator forgery — a transition signed by the wrong key is rejected', async () => {
    let state = createEmptyLiquidityBondRegistryState();
    const signer = makeSigner(SEED);
    const verifier = makeVerifier(signer);
    const genesis = await signRegistryTransition(state, { type: 'genesis' }, signer, { signedAt: 1 });
    state = await applyRegistryTransition(state, state, genesis, verifier);

    const next = { ...state, pools: { ...state.pools, 'pool-1': makePool() } };
    const attacker = makeSigner(ATTACKER_SEED, 'attacker-1');
    const forged = await signRegistryTransition(next, { type: 'register-pool', poolId: 'pool-1' }, attacker, {
      previousRoot: state.root,
    });
    await expect(applyRegistryTransition(state, next, forged, verifier)).rejects.toThrow(/fails verification/);
  });

  it('C: fee/NAV inflation — unverified earnable fees never accrue', () => {
    const unverified = recordLiquidityFee({
      positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
      grossFeeAmount: 10n, lpFeeAmount: 8n, source: 'route-fee', earnProof: { htlcId: 'h-1' },
    });
    const verified = recordLiquidityFee({
      positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
      grossFeeAmount: 10n, lpFeeAmount: 8n, source: 'route-fee', earnProof: { htlcId: 'h-2' }, verified: true,
    });
    expect(sumLpFeesForPosition([unverified, verified], 'pos-1')).toBe(8n);
  });

  it('D: receipt replay — a consumed receipt cannot double-withdraw', async () => {
    const { consumeLiquidityReceipt, issueLiquidityReceipt, verifyLiquidityReceipt } = await import('@totemsdk/liquidity-bond');
    const commitment = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    });
    const { createLiquidityPosition } = await import('@totemsdk/liquidity-bond');
    const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
    const receipt = issueLiquidityReceipt({ position, poolId: 'pool-1', ownerAddress: 'MxLP' });
    const consumed = consumeLiquidityReceipt(receipt, 'wdrw-1');
    const result = verifyLiquidityReceipt({ receipt: consumed, position });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already been consumed/);
  });

  it('E: identity squatting — a signature-backed proof cannot be forged', () => {
    const kp = wotsKeypairFromSeed(SEED, 0);
    const address = scriptToAddress(scriptFromWotsPk(kp.pk));
    const challenge = computeIdentityChallenge('pool-1', address);
    const genuine = {
      address,
      publicKeyDigest: bytesToHex(kp.pk),
      challenge,
      signature: bytesToHex(wotsSign(kp.seed, kp.index, hexToBytes(challenge))),
    };
    expect(verifyIdentityChallengeProof(genuine, address, 'pool-1')).toBe(true);

    const attacker = wotsKeypairFromSeed(ATTACKER_SEED, 0);
    const forged = {
      ...genuine,
      publicKeyDigest: bytesToHex(attacker.pk),
      signature: bytesToHex(wotsSign(attacker.seed, attacker.index, hexToBytes(challenge))),
    };
    expect(verifyIdentityChallengeProof(forged, address, 'pool-1')).toBe(false);
  });
});