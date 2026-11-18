/**
 * OMN-043 — every advertised pool-allocation target must either execute
 * through a live port or be rejected before accounting is mutated.
 */

import { amountToAtoms } from '@totemsdk/core';
import { createHostMethods, type HostApiContext } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

const atoms = (value: string | number) => amountToAtoms(String(value));

function context(overrides: Record<string, unknown> = {}) {
  const signer = {
    publicKeyDigest: '0x' + 'ab'.repeat(32),
    sign: jest.fn(async () => new Uint8Array(1088)),
  };
  const leaseProvider = {
    reserveKeyUse: jest.fn(async () => ({
      reservationId: 'lease-1',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      expiresAt: Date.now() + 1000,
    })),
    commitKeyUse: jest.fn(async () => undefined),
    burnReservation: jest.fn(async () => undefined),
  };
  return {
    signer,
    leaseProvider,
    routing: new InProcessRoutingProvider(),
    chainProvider: {
      getCoin: jest.fn(async () => ({
        coinid: '0x' + '11'.repeat(32),
        amount: '5',
        address: 'MxLP',
        tokenid: '0x00',
        spent: false,
        mmrentry: '1',
        created: '1',
      })),
      getTip: async () => ({ block: 10, hash: '0x01' }),
    },
    channels: new Map(),
    pools: new Map(),
    poolPositions: new Map(),
    vtxoPools: new Map(),
    vtxos: new Map(),
    vtxoReceipts: new Map(),
    operations: {
      get: () => undefined,
      create: () => ({ operationId: 'op', status: 'pending' }),
      transition: () => ({ operationId: 'op', status: 'committed' }),
      listByStatus: () => [],
    },
    localParticipant: { partyId: 'operator', publicKeyDigest: '0x' + 'ab'.repeat(32), addressIndex: 0 },
    custodyMode: 'self',
    ...overrides,
  } as unknown as HostApiContext;
}

async function seeded(methods: ReturnType<typeof createHostMethods>, purpose: string) {
  await methods.get('omnia/createLiquidityPool')!({
    poolId: 'alloc-pool',
    operatorAddress: 'MxOPERATOR',
    tokenId: '0x00',
    purpose,
    poolType: 'community-pool',
    capacity: '10',
    feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  });
  const deposited = await methods.get('omnia/depositToPool')!({
    poolId: 'alloc-pool',
    lpAddress: 'MxLP',
    amount: '5',
    purpose,
    underlyingUtxoRef: '0x' + '11'.repeat(32),
  }) as any;
  return deposited.position.positionId as string;
}

describe('OMN-043 allocation targets', () => {
  it('executes a router allocation through the live router port', async () => {
    const methods = createHostMethods(context());
    const positionId = await seeded(methods, 'omnia-router-liquidity');
    const allocated = await methods.get('omnia/allocatePoolCapital')!({
      positionId,
      amount: '1',
      allocationType: 'route-reserve',
      purpose: 'omnia-router-liquidity',
      target: {
        type: 'router',
        channel: {
          channelId: 'router-ch-1',
          from: '0x' + '01'.repeat(32),
          to: '0x' + '02'.repeat(32),
          tokenId: '0x00',
          availableBalance: atoms('1'),
          htlcCapacity: atoms('1'),
          feeRate: 0n,
        },
      },
    }) as any;
    expect(allocated).toMatchObject({ success: true, position: { allocatedAmount: '1' } });
  });

  it('executes a VTXO allocation against a backed pool', async () => {
    const backing = {
      coinid: '0x' + '77'.repeat(32),
      address: 'Mx' + 'aa'.repeat(20),
      amount: '1',
      tokenid: '0x00',
      spent: false,
      created: 1,
      mmrentry: '0x' + '22'.repeat(32),
    };
    const ctx = context({
      chainProvider: {
        getCoin: async (coinId: string) => (coinId === backing.coinid
          ? backing
          : {
              coinid: '0x' + '11'.repeat(32),
              amount: '5',
              address: 'MxLP',
              tokenid: '0x00',
              spent: false,
              mmrentry: '1',
              created: '1',
            }),
        getTip: async () => ({ block: 5, hash: '0x01' }),
      },
    });
    const methods = createHostMethods(ctx);
    const positionId = await seeded(methods, 'vtxo-pool-backing');
    const created = await methods.get('omnia/createVtxoPool')!({
      poolId: 'alloc-vtxo-pool',
      tokenId: '0x00',
      backingCoinId: backing.coinid,
      fundingAddress: backing.address,
      totalCapacity: '1',
      nonce: 'alloc-vtxo',
      policy: { maxAmount: atoms('1') },
    }) as any;

    const pool = (ctx.vtxoPools as Map<string, any>).get(created.pool.poolId);
    const allocated = await methods.get('omnia/allocatePoolCapital')!({
      positionId,
      amount: '0.5',
      allocationType: 'vtxo-backing',
      purpose: 'vtxo-pool-backing',
      target: {
        type: 'vtxo',
        pool,
        params: { owner: 'alice', amount: atoms('0.5'), nonce: 'alloc-mint' },
      },
    }) as any;
    expect(allocated.success).toBe(true);
    expect((ctx.vtxos as Map<string, any>).size).toBe(1);
  });

  it('rejects an unconfigured channel allocation without mutating accounting', async () => {
    const methods = createHostMethods(context());
    const positionId = await seeded(methods, 'omnia-channel-capital');
    await expect(methods.get('omnia/allocatePoolCapital')!({
      positionId,
      amount: '1',
      allocationType: 'channel-capital',
      purpose: 'omnia-channel-capital',
      target: { type: 'channel', params: {} },
    })).rejects.toThrow(/not configured on this host/);
  });

  it('rejects a missing target type', async () => {
    const methods = createHostMethods(context());
    const positionId = await seeded(methods, 'community-liquidity');
    await expect(methods.get('omnia/allocatePoolCapital')!({
      positionId,
      amount: '1',
      allocationType: 'manual-reserve',
      purpose: 'community-liquidity',
    })).rejects.toThrow(/requires target.type/);
  });

  it('uses an injected channel port when the deployment supplies one', async () => {
    const omnia = {
      createChannel: jest.fn(async () => ({
        channelId: 'allocated-channel',
        status: 'opening',
        latestState: null,
        parties: [],
      })),
      updateState: jest.fn(),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn(),
      verifyStateForCoSign: jest.fn(async () => ({ valid: true, errors: [] })),
      closeChannel: jest.fn(),
    };
    const ctx = context({ allocationContext: { omnia } });
    const methods = createHostMethods(ctx);
    const positionId = await seeded(methods, 'omnia-channel-capital');
    const allocated = await methods.get('omnia/allocatePoolCapital')!({
      positionId,
      amount: '1',
      allocationType: 'channel-capital',
      purpose: 'omnia-channel-capital',
      target: { type: 'channel', params: { fundingCoinId: '0x' + '33'.repeat(32) } },
    }) as any;
    expect(allocated.success).toBe(true);
    expect(omnia.createChannel).toHaveBeenCalled();
  });
});
