import {
  verifyPoolOperatorIdentity,
  verifyLpIdentity,
  verifyReceiptOwnerIdentity,
  verifyIdentityChallengeProof,
  computeIdentityChallenge,
  IDENTITY_CHALLENGE_DOMAIN,
  type IdentityChallengeProof,
} from '../identity.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';
import { createLiquidityCommitment } from '../commitment.js';
import { issueLiquidityReceipt } from '../receipt.js';
import { createLiquidityPosition } from '../position.js';
import { bytesToHex, hexToBytes, scriptFromWotsPk, scriptToAddress, wotsKeypairFromSeed, wotsSign } from '@totemsdk/core';

function makeIdentityGraph(rootAddress: string) {
  return {
    document: { rootAddress, controllerAddress: rootAddress },
    claims: [],
  };
}

function makeSigner(seed: Uint8Array, index = 0) {
  const kp = wotsKeypairFromSeed(seed, index);
  return {
    address: scriptToAddress(scriptFromWotsPk(kp.pk)),
    pkDigestHex: bytesToHex(kp.pk),
    signBytes: (challenge: Uint8Array) => wotsSign(kp.seed, kp.index, challenge),
  };
}

function makeProof(signer: ReturnType<typeof makeSigner>, entityId: string, address: string): IdentityChallengeProof {
  const challenge = computeIdentityChallenge(entityId, address);
  return {
    address,
    publicKeyDigest: signer.pkDigestHex,
    challenge,
    signature: bytesToHex(signer.signBytes(hexToBytes(challenge))),
  };
}

const ROOT_SEED = new Uint8Array(32).fill(21);
const ATTACKER_SEED = new Uint8Array(32).fill(99);

describe('identity', () => {
  describe('verifyIdentityChallengeProof', () => {
    it('accepts a genuine signature-backed proof', () => {
      const signer = makeSigner(ROOT_SEED);
      const proof = makeProof(signer, 'pool-1', signer.address);
      expect(verifyIdentityChallengeProof(proof, signer.address, 'pool-1')).toBe(true);
    });

    it('rejects a proof for a different entity (replay)', () => {
      const signer = makeSigner(ROOT_SEED);
      const proof = makeProof(signer, 'pool-1', signer.address);
      expect(verifyIdentityChallengeProof(proof, signer.address, 'pool-2')).toBe(false);
    });

    it('rejects a proof signed by a different key', () => {
      const signer = makeSigner(ROOT_SEED);
      const attacker = makeSigner(ATTACKER_SEED);
      const proof = makeProof(attacker, 'pool-1', signer.address);
      expect(verifyIdentityChallengeProof(proof, signer.address, 'pool-1')).toBe(false);
    });
  });

  describe('verifyPoolOperatorIdentity', () => {
    it('verifies pool operator identity via signature', () => {
      const signer = makeSigner(ROOT_SEED);
      const pool = createLiquidityPoolManifest({
        poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
        asset: 'MINIMA', lockTerms: { lockType: 'none' }, operatorAddress: signer.address, createdAt: 1000,
      });
      const result = verifyPoolOperatorIdentity({
        manifest: pool,
        identityGraph: makeIdentityGraph(signer.address),
        proof: makeProof(signer, 'pool-1', signer.address),
      });
      expect(result.ok).toBe(true);
    });

    it('rejects an operator without a signature-backed proof', () => {
      const signer = makeSigner(ROOT_SEED);
      const pool = createLiquidityPoolManifest({
        poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
        asset: 'MINIMA', lockTerms: { lockType: 'none' }, operatorAddress: signer.address, createdAt: 1000,
      });
      const result = verifyPoolOperatorIdentity({ manifest: pool, identityGraph: makeIdentityGraph(signer.address) });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('POOL_IDENTITY_NOT_AUTHORISED');
    });

    it('rejects an attacker who cannot sign as the operator', () => {
      const signer = makeSigner(ROOT_SEED);
      const attacker = makeSigner(ATTACKER_SEED);
      const pool = createLiquidityPoolManifest({
        poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
        asset: 'MINIMA', lockTerms: { lockType: 'none' }, operatorAddress: signer.address, createdAt: 1000,
      });
      const result = verifyPoolOperatorIdentity({
        manifest: pool,
        identityGraph: makeIdentityGraph(signer.address),
        proof: makeProof(attacker, 'pool-1', signer.address),
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('verifyLpIdentity', () => {
    it('verifies LP identity via signature', () => {
      const signer = makeSigner(ROOT_SEED);
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: signer.address, asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const result = verifyLpIdentity({
        commitment,
        identityGraph: makeIdentityGraph(signer.address),
        proof: makeProof(signer, commitment.commitmentId, signer.address),
      });
      expect(result.ok).toBe(true);
    });

    it('rejects an LP without a signature-backed proof', () => {
      const signer = makeSigner(ROOT_SEED);
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: signer.address, asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const result = verifyLpIdentity({ commitment, identityGraph: makeIdentityGraph(signer.address) });
      expect(result.ok).toBe(false);
    });
  });

  describe('verifyReceiptOwnerIdentity', () => {
    it('rejects a receipt owner who cannot sign as the owner', () => {
      const signer = makeSigner(ROOT_SEED);
      const attacker = makeSigner(ATTACKER_SEED);
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: signer.address, asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      const receipt = issueLiquidityReceipt({ position, poolId: 'pool-1', ownerAddress: signer.address });
      const result = verifyReceiptOwnerIdentity({
        receipt,
        identityGraph: makeIdentityGraph(signer.address),
        proof: makeProof(attacker, receipt.receiptId, signer.address),
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('RECEIPT_OWNER_NOT_AUTHORISED');
    });

    it('verifies a genuine receipt owner', () => {
      const signer = makeSigner(ROOT_SEED);
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: signer.address, asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      const receipt = issueLiquidityReceipt({ position, poolId: 'pool-1', ownerAddress: signer.address });
      const result = verifyReceiptOwnerIdentity({
        receipt,
        identityGraph: makeIdentityGraph(signer.address),
        proof: makeProof(signer, receipt.receiptId, signer.address),
      });
      expect(result.ok).toBe(true);
    });
  });

  it('uses a domain-separated challenge', () => {
    expect(IDENTITY_CHALLENGE_DOMAIN).toMatch(/^totemsdk\/liquidity-bond\/identity\/v1$/);
  });
});