/**
 * OMN-054 — liquidity deposits must be confirmed at depth, not merely present.
 */

import { createHostMethods, type HostApiContext } from '../api/methods.js';

function context(chainProvider: Record<string, unknown>) {
  const signer = {
    publicKeyDigest: '0x' + 'ab'.repeat(32),
    sign: async () => new Uint8Array(1088),
  };
  return {
    signer,
    leaseProvider: {
      reserveKeyUse: async () => ({
        reservationId: 'r-1',
        indices: { addressIndex: 0, l1: 0, l2: 0 },
        expiresAt: Date.now() + 1000,
      }),
      commitKeyUse: async () => undefined,
      burnReservation: async () => undefined,
    },
    channels: new Map(),
    pools: new Map(),
    poolPositions: new Map(),
    operations: {
      get: () => undefined,
      create: () => ({ operationId: 'op', status: 'pending' }),
      transition: () => ({ operationId: 'op', status: 'committed' }),
      listByStatus: () => [],
    },
    localParticipant: { partyId: 'operator', publicKeyDigest: signer.publicKeyDigest, addressIndex: 0 },
    custodyMode: 'self',
    chainProvider,
  } as unknown as HostApiContext;
}

async function seeded(chainProvider: Record<string, unknown>) {
  const methods = createHostMethods(context(chainProvider));
  await methods.get('omnia/createLiquidityPool')!({
    poolId: 'confirm-pool',
    operatorAddress: 'MxOPERATOR',
    tokenId: '0x00',
    purpose: 'community-liquidity',
    poolType: 'community-pool',
    capacity: '10',
    feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  });
  return (underlyingUtxoRef: string) => methods.get('omnia/depositToPool')!({
    poolId: 'confirm-pool',
    lpAddress: 'MxLP',
    amount: '1',
    purpose: 'community-liquidity',
    underlyingUtxoRef,
  });
}

const coin = (overrides: Record<string, unknown> = {}) => ({
  coinid: '0x' + '11'.repeat(32),
  amount: '5',
  address: 'MxLP',
  tokenid: '0x00',
  spent: false,
  mmrentry: '1',
  created: '1',
  ...overrides,
});

describe('OMN-054 deposit confirmation', () => {
  it('rejects a mempool coin', async () => {
    const deposit = await seeded({ getCoin: async () => coin({ mmrentry: '0' }) });
    await expect(deposit('0x' + '11'.repeat(32))).rejects.toThrow(/confirmed/);
  });

  it('rejects a coin whose depth cannot be established', async () => {
    const deposit = await seeded({ getCoin: async () => coin() });
    await expect(deposit('0x' + '11'.repeat(32))).rejects.toThrow(/depth cannot be established/);
  });

  it('accepts a confirmed coin with a real depth', async () => {
    const deposit = await seeded({
      getCoin: async () => coin({ created: '10' }),
      getTip: async () => ({ block: 10, hash: '0x01' }),
    });
    await expect(deposit('0x' + '11'.repeat(32))).resolves.toMatchObject({ success: true });
  });

  it('rejects a verifier result that says the coin is unconfirmed', async () => {
    const deposit = await seeded({
      getTip: async () => ({ block: 10, hash: '0x01' }),
      verifyDeposit: async () => ({ valid: true, confirmed: false }),
    });
    await expect(deposit('0x' + '11'.repeat(32))).rejects.toThrow(/not chain-confirmed/);
  });
});
