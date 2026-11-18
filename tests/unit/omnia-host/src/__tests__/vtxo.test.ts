/**
 * VTXO host API — pool, mint, transfer, refresh, exit and receipt signing.
 */

import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import { verifyChannelSignature } from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

/** Channel/pool internals are integer atoms; RPC amounts are decimal MINIMA text. */
const atoms = (value: string | number) => amountToAtoms(String(value));

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-vtxo-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('VTXO host API', () => {
  it('mints, transfers, refreshes, exits and co-signs receipts from the wallet', async () => {
    const signing = createHostSigning(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath }));
    // OMN-041/042: pool backing and exit completion are chain-verified.
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
      vtxoExitVerifier: async ({ vtxo, txpowId }: any) => ({
        valid: true,
        owner: vtxo.owner,
        amount: vtxo.amount,
        tokenId: vtxo.tokenId,
        confirmations: 6,
        ...(txpowId ? {} : { valid: false }),
      }),
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);

    const created = await methods.get('omnia/createVtxoPool')!({
      poolId: 'vtxo-pool-1',
      tokenId: '0x00',
      backingCoinId: backingCoin.coinid,
      fundingAddress: backingCoin.address,
      totalCapacity: '1000000',
      nonce: 'pool-1',
      // Pool policy limits are internal atom quantities.
      policy: { maxAmount: atoms('1000000') },
    });
    expect(created).toMatchObject({ success: true });
    const storePoolId = (created as any).pool.poolId;
    const signReceipt = async (receiptId: string, root: string, extra: Record<string, unknown> = {}) => {
      const prepared = await methods.get('omnia/prepareVtxoReceipt')!({
        receiptId,
        root,
        ...(typeof extra.epoch === 'number' ? { epoch: extra.epoch } : {}),
        ...extra,
      });
      const request = (prepared as any).requests.receipt;
      const indices = { addressIndex: 0, l1: 0, l2: 0 };
      const signature = await signing.signer.sign(request.digest, indices);
      expect(verifyChannelSignature(signature, request.digest, signing.publicKeyDigest)).toBe(true);
      const submitted = await methods.get('omnia/submitVtxoReceipt')!({
        receiptId,
        signature: hex(signature),
      });
      expect(submitted).toMatchObject({ success: true });
      return submitted as any;
    };

    const minted = await methods.get('omnia/mintVtxo')!({
      poolId: storePoolId,
      owner: 'alice',
      amount: '100000',
      nonce: 'mint-1',
    });
    const mint = minted as any;
    await signReceipt(mint.receipt.receiptId, mint.vtxo.proof.root);

    const transferred = await methods.get('omnia/transferVtxo')!({
      vtxoId: mint.vtxo.vtxoId,
      recipient: 'bob',
      amount: '40000',
      nonce: 'xfer-1', unsafeLedgerTransfer: true,
    });
    const transfer = transferred as any;
    expect(transfer.change.amount).toBe('60000');
    await signReceipt(transfer.receipt.receiptId, transfer.output.proof.root, {
      inputsAmount: '100000',
    });

    const refreshed = await methods.get('omnia/refreshVtxo')!({
      vtxoId: transfer.output.vtxoId,
      newEpoch: 3,
      nonce: 'refresh-1',
    });
    const refresh = refreshed as any;
    expect(refresh.refreshed.epoch).toBe(3);
    const refreshPrepared = await methods.get('omnia/prepareVtxoReceipt')!({
      receiptId: refresh.receipt.receiptId,
      root: refresh.refreshed.proof.root,
      epoch: 3,
      previousEpoch: 2,
      inputsAmount: '40000',
    });
    const refreshRequest = (refreshPrepared as any).requests.receipt;
    const refreshSignature = await signing.signer.sign(refreshRequest.digest, { addressIndex: 0, l1: 0, l2: 0 });
    await methods.get('omnia/submitVtxoReceipt')!({
      receiptId: refresh.receipt.receiptId,
      signature: hex(refreshSignature),
    });

    const exit = await methods.get('omnia/initiateVtxoExit')!({ vtxoId: refresh.refreshed.vtxoId });
    expect(exit).toMatchObject({ success: true, vtxo: { status: 'exiting' } });
    const exited = await methods.get('omnia/completeVtxoExit')!({
      vtxoId: refresh.refreshed.vtxoId,
      txpowId: 'tx-exit',
    });
    expect(exited).toMatchObject({ success: true, vtxo: { status: 'exited', exitTxpowId: 'tx-exit' } });
  });
});
