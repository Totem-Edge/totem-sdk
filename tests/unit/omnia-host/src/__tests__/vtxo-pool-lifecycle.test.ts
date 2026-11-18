/**
 * OMN-045 / OMN-046 / OMN-047 / OMN-050 — pool creation is create-only, refresh
 * ids include the epoch, and pool-wide mint receipts verify against the member
 * set.
 */

import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const atoms = (value: string | number) => amountToAtoms(String(value));
const backing = {
  coinid: '0x' + '11'.repeat(32),
  address: 'Mx' + 'aa'.repeat(20),
  amount: '1000',
  tokenid: '0x00',
  spent: false,
  created: 1,
  mmrentry: '0x' + '22'.repeat(32),
};

function context(signing: ReturnType<typeof createHostSigning>, overrides: Record<string, unknown> = {}) {
  return {
    channels: new Map(),
    vtxoPools: new Map(),
    vtxos: new Map(),
    vtxoReceipts: new Map(),
    preparedVtxoReceipts: new Map(),
    pools: new Map(),
    poolPositions: new Map(),
    operations: {
      get: () => undefined,
      create: () => ({ operationId: 'op', status: 'pending' }),
      transition: () => ({ operationId: 'op', status: 'committed' }),
      listByStatus: () => [],
    },
    signer: signing.signer,
    leaseProvider: signing.leaseProvider,
    localParticipant: { partyId: 'operator', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
    custodyMode: 'self',
    chainProvider: {
      getCoin: async () => ({ ...backing, address: 'MxLP' }),
      getTip: async () => ({ block: 10, hash: '0x01' }),
    },
    ...overrides,
  } as unknown as HostApiContext;
}

function signing() {
  return createHostSigning(loadConfigFromEnv({
    OMNIA_HOST_SEED: '0x' + 'ab'.repeat(32),
    OMNIA_HOST_DB: `${os.tmpdir()}/omnia-pool-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
  }));
}

const POOL = {
  poolId: 'lifecycle-pool',
  tokenId: '0x00',
  backingCoinId: backing.coinid,
  fundingAddress: 'MxLP',
  totalCapacity: '1',
  nonce: 'lifecycle',
  policy: { maxAmount: atoms('1') },
};

describe('OMN-045 VTXO pool creation is create-only', () => {
  it('returns the existing pool without resetting capacity or members', async () => {
    const ctx = context(signing());
    const methods = createHostMethods(ctx);
    const created = await methods.get('omnia/createVtxoPool')!(POOL) as any;
    await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '0.4', nonce: 'mint-a',
    });
    const before = (ctx.vtxoPools as Map<string, any>).get(created.pool.poolId);

    const again = await methods.get('omnia/createVtxoPool')!(POOL) as any;
    expect(again.existed).toBe(true);
    const after = (ctx.vtxoPools as Map<string, any>).get(created.pool.poolId);
    expect(after.epoch).toBe(before.epoch);
    expect(after.members).toHaveLength(1);
    expect(after.availableCapacity).toBe(before.availableCapacity);
  });

  it('rejects a repeat with different terms', async () => {
    const ctx = context(signing());
    const methods = createHostMethods(ctx);
    await methods.get('omnia/createVtxoPool')!(POOL);
    await expect(methods.get('omnia/createVtxoPool')!({ ...POOL, totalCapacity: '2' }))
      .rejects.toThrow(/already exists with different terms/);
  });
});

describe('OMN-050 liquidity pool creation is create-only', () => {
  const pool = {
    poolId: 'lp-create-only',
    operatorAddress: 'MxOPERATOR',
    tokenId: '0x00',
    purpose: 'community-liquidity',
    poolType: 'community-pool',
    capacity: '10',
    feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  };

  it('preserves the registry across a repeated creation request', async () => {
    const ctx = context(signing());
    const methods = createHostMethods(ctx);
    await methods.get('omnia/createLiquidityPool')!(pool);
    await methods.get('omnia/depositToPool')!({
      poolId: pool.poolId,
      lpAddress: 'MxLP',
      amount: '1',
      purpose: 'community-liquidity',
      underlyingUtxoRef: '0x' + '11'.repeat(32),
    });

    const again = await methods.get('omnia/createLiquidityPool')!(pool) as any;
    expect(again.existed).toBe(true);
    expect(Object.keys(again.registry.commitments ?? {})).toHaveLength(1);
  });

  it('rejects a repeat with a different capacity', async () => {
    const ctx = context(signing());
    const methods = createHostMethods(ctx);
    await methods.get('omnia/createLiquidityPool')!(pool);
    await expect(methods.get('omnia/createLiquidityPool')!({ ...pool, capacity: '20' }))
      .rejects.toThrow(/already exists with different capacity/);
  });
});

describe('OMN-046 / OMN-047 VTXO refresh and receipts', () => {
  it('a refresh reusing the mint nonce produces a distinct id', async () => {
    const ctx = context(signing());
    const methods = createHostMethods(ctx);
    const created = await methods.get('omnia/createVtxoPool')!(POOL) as any;
    const minted = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '0.4', nonce: 'same-nonce',
    }) as any;
    const stored = (ctx.vtxos as Map<string, any>).get(minted.vtxo.vtxoId);
    (ctx.vtxos as Map<string, any>).set(minted.vtxo.vtxoId, { ...stored, status: 'active' });

    const refreshed = await methods.get('omnia/refreshVtxo')!({
      vtxoId: minted.vtxo.vtxoId, newEpoch: 2, nonce: 'same-nonce',
    }) as any;
    expect(refreshed.refreshed.vtxoId).not.toBe(minted.vtxo.vtxoId);
    // Both records coexist: the consumed one is not overwritten.
    expect((ctx.vtxos as Map<string, any>).get(minted.vtxo.vtxoId).status).toBe('refreshed');
    expect((ctx.vtxos as Map<string, any>).get(refreshed.refreshed.vtxoId).status).toBe('active');
  });

  it('prepares a receipt for the second mint against the pool-wide root', async () => {
    const sign = signing();
    const ctx = context(sign);
    const methods = createHostMethods(ctx);
    const created = await methods.get('omnia/createVtxoPool')!(POOL) as any;

    const first = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '0.3', nonce: 'mint-1',
    }) as any;
    const promoted = (ctx.vtxos as Map<string, any>).get(first.vtxo.vtxoId);
    (ctx.vtxos as Map<string, any>).set(first.vtxo.vtxoId, { ...promoted, status: 'active' });

    const second = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'bob', amount: '0.3', nonce: 'mint-2',
    }) as any;

    // The pool root now commits both members; the second receipt must still
    // prepare. This is exactly the OMN-047 failure mode.
    const prepared = await methods.get('omnia/prepareVtxoReceipt')!({
      receiptId: second.receipt.receiptId,
      root: second.vtxo.proof.root,
      epoch: second.vtxo.epoch,
    }) as any;
    expect(prepared).toMatchObject({ success: true, status: 'signature-required' });
    const signature = await sign.signer.sign(prepared.requests.receipt.digest, { addressIndex: 0, l1: 0, l2: 0 });
    const submitted = await methods.get('omnia/submitVtxoReceipt')!({
      receiptId: second.receipt.receiptId,
      signature: '0x' + Buffer.from(signature).toString('hex'),
    });
    expect(submitted).toMatchObject({ success: true });
  });
});
