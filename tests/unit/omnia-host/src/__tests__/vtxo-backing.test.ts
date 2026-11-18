/**
 * OMN-041 / OMN-042 — VTXO issuance needs verified backing and exits need
 * verified chain evidence.
 */

import { amountToAtoms } from '@totemsdk/core';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const atoms = (value: string | number) => amountToAtoms(String(value));

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    channels: new Map(),
    vtxoPools: new Map(),
    vtxos: new Map(),
    vtxoReceipts: new Map(),
    preparedVtxoReceipts: new Map(),
    coordinator: true,
    localParticipant: { partyId: 'operator', publicKeyDigest: '0x' + 'ab'.repeat(32), addressIndex: 0 },
    custodyMode: 'self',
    ...overrides,
  } as unknown as HostApiContext;
}

function backingCoin(amount = '1') {
  return {
    coinid: '0x' + '11'.repeat(32),
    address: 'Mx' + 'aa'.repeat(20),
    amount,
    tokenid: '0x00',
    spent: false,
    created: 1,
    mmrentry: '0x' + '22'.repeat(32),
  };
}

describe('OMN-041 VTXO backing', () => {
  it('rejects a pool created without verified on-chain backing', async () => {
    const methods = createHostMethods(baseContext());
    await expect(methods.get('omnia/createVtxoPool')!({
      poolId: 'unbacked',
      tokenId: '0x00',
      totalCapacity: '100',
      nonce: 'n1',
      policy: { maxAmount: atoms('100') },
    })).rejects.toThrow(/chain provider to verify the backing coin/);
  });

  it('rejects capacity larger than the backing coin', async () => {
    const methods = createHostMethods(baseContext({
      chainProvider: { getCoin: async () => backingCoin('0.5'), getTip: async () => ({ block: 5, hash: '0x01' }) },
    }));
    await expect(methods.get('omnia/createVtxoPool')!({
      poolId: 'over-capacity',
      tokenId: '0x00',
      backingCoinId: '0x' + '11'.repeat(32),
      fundingAddress: 'Mx' + 'aa'.repeat(20),
      totalCapacity: '1',
      nonce: 'n2',
      policy: { maxAmount: atoms('1') },
    })).rejects.toThrow(/but capacity is/);
  });

  it('rejects a spent backing coin', async () => {
    const methods = createHostMethods(baseContext({
      chainProvider: {
        getCoin: async () => ({ ...backingCoin('1'), spent: true }),
        getTip: async () => ({ block: 5, hash: '0x01' }),
      },
    }));
    await expect(methods.get('omnia/createVtxoPool')!({
      poolId: 'spent',
      tokenId: '0x00',
      backingCoinId: '0x' + '11'.repeat(32),
      fundingAddress: 'Mx' + 'aa'.repeat(20),
      totalCapacity: '1',
      nonce: 'n3',
    })).rejects.toThrow(/already spent/);
  });

  it('refuses to mint from a pool that never had verified backing', async () => {
    const context = baseContext();
    const methods = createHostMethods(context);
    // Simulate a pool loaded from an older store: no backing metadata.
    (context.vtxoPools as Map<string, any>).set('legacy', {
      poolId: 'legacy',
      tokenId: '0x00',
      totalCapacity: atoms('10'),
      availableCapacity: atoms('10'),
      members: [],
      epoch: 0,
    });
    await expect(methods.get('omnia/mintVtxo')!({
      poolId: 'legacy', owner: 'alice', amount: '1', nonce: 'm1',
    })).rejects.toThrow(/no verified on-chain backing/);
  });

  it('issues provisional VTXOs that only become active after the operator receipt', async () => {
    const context = baseContext({
      chainProvider: { getCoin: async () => backingCoin('1'), getTip: async () => ({ block: 5, hash: '0x01' }) },
    });
    const methods = createHostMethods(context);
    const created = await methods.get('omnia/createVtxoPool')!({
      poolId: 'backed',
      tokenId: '0x00',
      backingCoinId: '0x' + '11'.repeat(32),
      fundingAddress: 'Mx' + 'aa'.repeat(20),
      totalCapacity: '1',
      nonce: 'n4',
      policy: { maxAmount: atoms('1') },
    }) as any;
    expect(created.pool.backing).toMatchObject({ coinId: '0x' + '11'.repeat(32) });

    const minted = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '0.5', nonce: 'm2',
    }) as any;
    expect(minted.vtxo.status).toBe('provisional');
    expect((context.vtxos as Map<string, any>).get(minted.vtxo.vtxoId).status).toBe('provisional');
  });
});

describe('OMN-042 VTXO exit evidence', () => {
  async function exitingVtxo(verifier: (request: any) => Promise<any>) {
    const context = baseContext({
      chainProvider: { getCoin: async () => backingCoin('1'), getTip: async () => ({ block: 5, hash: '0x01' }) },
      vtxoExitVerifier: verifier,
    });
    const methods = createHostMethods(context);
    const created = await methods.get('omnia/createVtxoPool')!({
      poolId: 'exit-pool',
      tokenId: '0x00',
      backingCoinId: '0x' + '11'.repeat(32),
      fundingAddress: 'Mx' + 'aa'.repeat(20),
      totalCapacity: '1',
      nonce: 'n5',
      policy: { maxAmount: atoms('1') },
    }) as any;
    const minted = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '0.5', nonce: 'm3',
    }) as any;
    // Promote to active without a wallet: the receipt step is covered elsewhere.
    const stored = (context.vtxos as Map<string, any>).get(minted.vtxo.vtxoId);
    (context.vtxos as Map<string, any>).set(minted.vtxo.vtxoId, { ...stored, status: 'active' });
    const exit = await methods.get('omnia/initiateVtxoExit')!({ vtxoId: minted.vtxo.vtxoId }) as any;
    return { context, methods, vtxo: exit.vtxo };
  }

  it('requires an exit verifier', async () => {
    const { context, vtxo } = await exitingVtxo(async () => ({ valid: true }));
    const bare = createHostMethods({ ...context, vtxoExitVerifier: undefined } as unknown as HostApiContext);
    await expect(bare.get('omnia/completeVtxoExit')!({
      vtxoId: vtxo.vtxoId, txpowId: '0xab',
    })).rejects.toThrow(/exit verifier/);
  });

  it('keeps the VTXO exiting when the payout is unverified', async () => {
    const { context, methods, vtxo } = await exitingVtxo(async () => ({ valid: false, reason: 'no such transaction' }));
    await expect(methods.get('omnia/completeVtxoExit')!({
      vtxoId: vtxo.vtxoId, txpowId: '0xab',
    })).rejects.toThrow(/not verified/);
    expect((context.vtxos as Map<string, any>).get(vtxo.vtxoId).status).toBe('exiting');
  });

  it('rejects a verified exit that pays the wrong owner', async () => {
    const { methods, vtxo } = await exitingVtxo(async () => ({
      valid: true, owner: 'mallory', amount: atoms('0.5'), tokenId: '0x00', confirmations: 6,
    }));
    await expect(methods.get('omnia/completeVtxoExit')!({
      vtxoId: vtxo.vtxoId, txpowId: '0xab',
    })).rejects.toThrow(/not the VTXO owner/);
  });

  it('finalizes only a verified, sufficiently confirmed exit', async () => {
    const { methods, vtxo } = await exitingVtxo(async (request) => ({
      valid: true, owner: request.vtxo.owner, amount: request.vtxo.amount, tokenId: request.vtxo.tokenId, confirmations: 2,
    }));
    const exited = await methods.get('omnia/completeVtxoExit')!({
      vtxoId: vtxo.vtxoId, txpowId: '0x' + 'cd'.repeat(32),
    }) as any;
    expect(exited.vtxo.status).toBe('exited');
    expect(exited.vtxo.exitTxpowId).toBe('0x' + 'cd'.repeat(32));
  });
});
