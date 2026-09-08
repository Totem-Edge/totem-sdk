import {
  createLiquidityCommitment,
  acceptLiquidityCommitment,
  rejectLiquidityCommitment,
  cancelLiquidityCommitment,
  verifyLiquidityCommitment,
  confirmLiquidityCommitment,
  assetToTokenId,
} from '../commitment.js';
import type { LiquidityFunding } from '../types.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';

function makePool() {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, minCommitment: 100n, maxCommitment: 10000n, createdAt: 1000,
  });
}

function makeCommitment(overrides: { funding?: LiquidityFunding } = {}) {
  return createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    funding: overrides.funding,
  });
}

const passVerifier = {
  verifyDeposit: async () => ({ valid: true }),
};

const failVerifier = {
  verifyDeposit: async () => ({ valid: false, reason: 'coin is spent' }),
};

describe('commitment', () => {
  describe('createLiquidityCommitment', () => {
    it('creates a signed commitment', () => {
      const c = makeCommitment();
      expect(c.status).toBe('signed');
      expect(c.amount).toBe(1000n);
    });

    it('carries declared funding when a coin is provided', () => {
      const c = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'declared' },
      });
      expect(c.funding?.status).toBe('declared');
    });
  });

  describe('acceptLiquidityCommitment', () => {
    it('refuses a commitment whose funding is not chain-confirmed', async () => {
      const c = makeCommitment();
      await expect(acceptLiquidityCommitment(c)).rejects.toThrow(/not chain-confirmed/);
      const declared = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'declared' },
      });
      await expect(acceptLiquidityCommitment(declared)).rejects.toThrow(/not chain-confirmed/);
    });

    it('accepts a chain-confirmed commitment', async () => {
      const c = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'chain-confirmed', confirmedAt: 1000 },
      });
      const accepted = await acceptLiquidityCommitment(c);
      expect(accepted.status).toBe('accepted');
    });

    it('re-checks the chain when a verifier is supplied', async () => {
      const confirmed = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'chain-confirmed', confirmedAt: 1000 },
      });
      await expect(acceptLiquidityCommitment(confirmed, { chainProvider: passVerifier })).resolves.toMatchObject({ status: 'accepted' });
      await expect(acceptLiquidityCommitment(confirmed, { chainProvider: failVerifier })).rejects.toThrow(/failed on-chain verification/);
    });
  });

  describe('rejectLiquidityCommitment / cancelLiquidityCommitment', () => {
    it('rejects and cancels', () => {
      const c = makeCommitment();
      expect(rejectLiquidityCommitment(c, 'too small').status).toBe('rejected');
      expect(rejectLiquidityCommitment(c, 'too small').metadata?.rejectReason).toBe('too small');
      expect(cancelLiquidityCommitment(c).status).toBe('cancelled');
    });
  });

  describe('verifyLiquidityCommitment', () => {
    it('verifies a valid commitment without funding', async () => {
      const pool = makePool();
      const c = makeCommitment();
      const result = await verifyLiquidityCommitment({ commitment: c, pool });
      expect(result.ok).toBe(true);
    });

    it('requires a live verifier for declared funding', async () => {
      const pool = makePool();
      const c = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'declared' },
      });
      const result = await verifyLiquidityCommitment({ commitment: c, pool });
      expect(result.ok).toBe(false);
      expect(result.requiresLiveVerifier).toBe(true);

      const withVerifier = await verifyLiquidityCommitment({ commitment: c, pool, chainProvider: passVerifier });
      expect(withVerifier.ok).toBe(true);
    });

    it('fails a funding that is invalid on chain', async () => {
      const pool = makePool();
      const c = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'invalid' },
      });
      const result = await verifyLiquidityCommitment({ commitment: c, pool });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMITMENT_INVALID');
    });

    it('rejects below-minimum and expired commitments', async () => {
      const pool = makePool();
      const small = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 50n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      expect((await verifyLiquidityCommitment({ commitment: small, pool })).code).toBe('AMOUNT_TOO_SMALL');

      const expired = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' }, expiresAt: 500,
      });
      expect((await verifyLiquidityCommitment({ commitment: expired, pool, now: 2000 })).code).toBe('COMMITMENT_EXPIRED');
    });
  });

  describe('confirmLiquidityCommitment', () => {
    it('marks funding chain-confirmed when the check passes', async () => {
      const c = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'declared' },
      });
      const confirmed = await confirmLiquidityCommitment(c, passVerifier, 2000);
      expect(confirmed.funding?.status).toBe('chain-confirmed');
      expect(confirmed.funding?.confirmedAt).toBe(2000);
    });

    it('invalidates funding when the check fails', async () => {
      const c = makeCommitment({
        funding: { utxoRef: '0xC1', tokenId: '0x00', amount: 1000n, status: 'declared' },
      });
      const confirmed = await confirmLiquidityCommitment(c, failVerifier);
      expect(confirmed.funding?.status).toBe('invalid');
    });

    it('throws when there is no funding to confirm', async () => {
      await expect(confirmLiquidityCommitment(makeCommitment(), passVerifier)).rejects.toThrow(/no funding/);
    });
  });

  describe('assetToTokenId', () => {
    it('maps assets to on-chain token ids', () => {
      expect(assetToTokenId('MINIMA')).toBe('0x00');
      expect(assetToTokenId('USDT')).toBe('0xUSDT');
      expect(assetToTokenId('TOTEM')).toBe('TOTEM');
    });
  });
});