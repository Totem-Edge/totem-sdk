/** H8 — concurrent VTXO mutation guard at the host boundary. */
import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

/** Channel/pool internals are integer atoms; RPC amounts are decimal MINIMA text. */
const atoms = (value: string | number) => amountToAtoms(String(value));

describe('VTXO host hardening', () => {
  it('allows only one of two concurrent transfers of the same VTXO', async () => {
    const signing = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: '0x' + 'ab'.repeat(32),
      OMNIA_HOST_DB: `${os.tmpdir()}/omnia-vtxo-hardening-${Date.now()}.sqlite`,
    }));
    const backingCoin = {
      coinid: '0x' + '11'.repeat(32),
      address: 'Mx' + 'aa'.repeat(20),
      amount: '1000000',
      tokenid: '0x00',
      spent: false,
      created: 1,
      mmrentry: '0x' + '22'.repeat(32),
    };
    const context = {
      channels: new Map(),
      vtxoPools: new Map(),
      vtxos: new Map(),
      vtxoReceipts: new Map(),
      preparedVtxoReceipts: new Map(),
      coordinator: true,
      localParticipant: { partyId: 'operator', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
      chainProvider: {
        getCoin: async () => backingCoin,
        getTip: async () => ({ block: 10, hash: '0x01' }),
      },
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);
    const created = await methods.get('omnia/createVtxoPool')!({
      poolId: 'h8-pool', tokenId: '0x00', totalCapacity: '1000000', nonce: 'h8',
      backingCoinId: backingCoin.coinid, fundingAddress: backingCoin.address,
      // Pool policy limits are internal atom quantities.
      policy: { maxAmount: atoms('1000000') },
    }) as any;
    const minted = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '100000', nonce: 'h8-mint',
    }) as any;

    // OMN-041: provisional until the operator co-signs the mint receipt.
    expect(minted.vtxo.status).toBe('provisional');
    const preparedReceipt = await methods.get('omnia/prepareVtxoReceipt')!({
      receiptId: minted.receipt.receiptId,
      root: minted.vtxo.proof.root,
      epoch: minted.vtxo.epoch,
    }) as any;
    const signature = await signing.signer.sign(preparedReceipt.requests.receipt.digest, { addressIndex: 0, l1: 0, l2: 0 });
    await methods.get('omnia/submitVtxoReceipt')!({
      receiptId: minted.receipt.receiptId,
      signature: '0x' + Buffer.from(signature).toString('hex'),
    });

    const results = await Promise.allSettled([
      methods.get('omnia/transferVtxo')!({ vtxoId: minted.vtxo.vtxoId, recipient: 'bob', amount: '1000', nonce: 'h8-a', unsafeLedgerTransfer: true }),
      methods.get('omnia/transferVtxo')!({ vtxoId: minted.vtxo.vtxoId, recipient: 'carol', amount: '1000', nonce: 'h8-b', unsafeLedgerTransfer: true }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});
