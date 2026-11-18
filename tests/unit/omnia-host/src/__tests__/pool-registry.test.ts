/**
 * OMN-032 — the pool registry is the single authoritative allocation ledger.
 * Position views must never fork it.
 */

import { createHostMethods, type HostApiContext } from '../api/methods.js';

function context() {
  const signer = {
    publicKeyDigest: '0x' + 'ab'.repeat(32),
    sign: async () => new Uint8Array(1088),
  };
  const leaseProvider = {
    reserveKeyUse: async () => ({
      reservationId: 'lease-1',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      expiresAt: Date.now() + 1000,
    }),
    commitKeyUse: async () => undefined,
    burnReservation: async () => undefined,
  };
  return {
    signer,
    leaseProvider,
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
    chainProvider: {
      getCoin: async (coinId: string) => ({
        coinid: coinId,
        amount: '100',
        address: 'MxLP',
        tokenid: '0x00',
        spent: false,
        mmrentry: '1',
        created: '1',
      }),
      getTip: async () => ({ block: 10, hash: '0x01' }),
    },
    custodyMode: 'self',
  } as unknown as HostApiContext;
}

async function seedPool(methods: ReturnType<typeof createHostMethods>) {
  await methods.get('omnia/createLiquidityPool')!({
    poolId: 'shared-pool',
    operatorAddress: 'MxOPERATOR',
    tokenId: '0x00',
    purpose: 'community-liquidity',
    poolType: 'community-pool',
    capacity: '1000',
    feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  });
}

async function deposit(
  methods: ReturnType<typeof createHostMethods>,
  lp: string,
  ref: string,
): Promise<string> {
  const deposited = await methods.get('omnia/depositToPool')!({
    poolId: 'shared-pool',
    lpAddress: 'MxLP',
    amount: '10',
    purpose: 'community-liquidity',
    underlyingUtxoRef: ref,
  }) as any;
  return deposited.position.positionId;
}

describe('OMN-032 pool registry authority', () => {
  it('keeps allocations for two positions in one registry', async () => {
    const ctx = context();
    const methods = createHostMethods(ctx);
    await seedPool(methods);

    const first = await deposit(methods, 'MxLP', '0x' + '11'.repeat(32));
    const second = await deposit(methods, 'MxLP', '0x' + '22'.repeat(32));
    expect(first).not.toBe(second);

    await methods.get('omnia/allocatePoolCapital')!({
      positionId: first,
      amount: '5',
      allocationType: 'manual-reserve',
      purpose: 'community-liquidity',
      target: { type: 'reserve', purpose: 'contingency' },
    });

    const poolRegistry = (ctx.pools as Map<string, any>).get('shared-pool').registry;
    expect(poolRegistry.allocations[first]).toHaveLength(1);

    // The second position must not be able to write a registry view that
    // forgets the first position's allocation.
    await methods.get('omnia/allocatePoolCapital')!({
      positionId: second,
      amount: '5',
      allocationType: 'manual-reserve',
      purpose: 'community-liquidity',
      target: { type: 'reserve', purpose: 'contingency' },
    });

    const latest = (ctx.pools as Map<string, any>).get('shared-pool').registry;
    expect(latest.allocations[first]).toHaveLength(1);
    expect(latest.allocations[second]).toHaveLength(1);

    // A later deposit reads the same authoritative registry.
    await deposit(methods, 'MxLP', '0x' + '33'.repeat(32));
    const afterDeposit = (ctx.pools as Map<string, any>).get('shared-pool').registry;
    expect(afterDeposit.allocations[first]).toHaveLength(1);
    expect(afterDeposit.allocations[second]).toHaveLength(1);
  });
});
