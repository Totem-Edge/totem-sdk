/**
 * RFC-058 P1 — host prepareSpliceIn / submitSplice wallet flow.
 */

import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import {
  DefaultEltooPaymentProgram,
  signRequestPayload,
  type OmniaChannel,
} from '@totemsdk/omnia';
import { computeSpliceTxDigest } from '@totemsdk/omnia-splice';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

/** Channel/pool internals are integer atoms; RPC amounts are decimal MINIMA text. */
const atoms = (value: string | number) => amountToAtoms(String(value));

const ALICE_SEED = '0x' + 'ab'.repeat(32);
const BOB_SEED = '0x' + 'cd'.repeat(32);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ADDITIONAL_COIN_ADDRESS = 'Mx' + 'aa'.repeat(20);
const aliceDb = `${os.tmpdir()}/omnia-prepare-splice-alice-${suffix}.sqlite`;
const bobDb = `${os.tmpdir()}/omnia-prepare-splice-bob-${suffix}.sqlite`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('omnia prepareSpliceIn / submitSplice', () => {
  it('quiesces, collects the peer acceptance, verifies wallet signatures and finalizes', async () => {
    const alice = createHostSigning(loadConfigFromEnv({ OMNIA_HOST_SEED: ALICE_SEED, OMNIA_HOST_DB: aliceDb }));
    const bob = createHostSigning(loadConfigFromEnv({ OMNIA_HOST_SEED: BOB_SEED, OMNIA_HOST_DB: bobDb }));
    const channel: OmniaChannel = {
      channelId: '0x' + 'ab'.repeat(32),
      fundingTxId: '0x' + 'ef'.repeat(32),
      fundingCoinId: '0x' + 'cc'.repeat(32),
      fundingScript: 'RETURN TRUE',
      programId: DefaultEltooPaymentProgram.id,
      programVersion: DefaultEltooPaymentProgram.version,
      fundingAddress: '0x' + 'dd'.repeat(32),
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: atoms('1000'),
      parties: [
        { partyId: 'alice', publicKeyDigest: alice.publicKeyDigest, addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: bob.publicKeyDigest, addressIndex: 1 },
      ],
      balances: { alice: atoms('600'), bob: atoms('400') },
      pendingHTLCs: [],
      currentSequence: 1,
      onChainSequence: 0,
      latestState: null,
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      createdAt: 1_000,
      updatedAt: 1_000,
    };

    let onMessage: ((msg: any) => void) | undefined;
    const peer = {
      pubkey: 'bob',
      channelId: channel.channelId,
      sendMessage: jest.fn(async (msg: any) => {
        if (msg.type === 'SPLICE_PROPOSAL') {
          const proposal = msg.payload.proposal;
          const digest = computeSpliceTxDigest(proposal.spliceTxDraft);
          const indices = { addressIndex: 0, l1: 0, l2: 0 };
          const signature = await bob.signer.sign(digest, indices);
          setTimeout(() => onMessage?.({
            type: 'SPLICE_ACCEPT',
            channelId: msg.channelId,
            nonce: msg.nonce,
            payload: {
              acceptance: {
                spliceId: proposal.spliceId,
                channelId: channel.channelId,
                acceptorPublicKeyDigest: bob.publicKeyDigest,
                acceptorSignature: signature,
                acceptorReservationId: '',
                acceptorSigningIndices: indices,
                acceptedAt: Date.now(),
              },
            },
          }), 0);
        }
      }),
      onMessage: jest.fn((cb: (msg: any) => void) => {
        onMessage = cb;
        return () => { onMessage = undefined; };
      }),
      onReconnected: jest.fn(() => () => {}),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
    };
    const broadcastTxPoW = jest.fn(async () => ({ success: true, txpowid: 'tx-splice' }));
    // CAN-011: the host now observes the successor before marking a splice
    // active, so the chain mock must answer like a node.
    const getCoins = jest.fn(async () => [{
      coinid: '0x' + '77'.repeat(32),
      amount: '1500',
      address: channel.fundingAddress,
      tokenid: '0x00',
      spent: false,
      created: '1',
    }]);
    const getTip = jest.fn(async () => ({ block: 100 }));
    // OMN-072: a successor is only adopted when the splice transaction created
    // it, so the chain must report the transaction's outputs.
    const getTransactionOutputs = jest.fn(async () => ['0x' + '77'.repeat(32)]);
    const getCoin = jest.fn(async (coinId: string) => ({
      coinid: coinId,
      amount: '500',
      address: ADDITIONAL_COIN_ADDRESS,
      tokenid: '0x00',
      spent: false,
      mmrentry: '1',
      created: '1',
    }));
    const context = {
      channels: new Map([[channel.channelId, channel]]),
      preparedSplice: new Map(),
      spliceAcceptances: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: alice.signer,
      leaseProvider: alice.leaseProvider,
      chainProvider: { broadcastTxPoW, getCoins, getCoin, getTip, getTransactionOutputs },
      localParticipant: { partyId: 'alice', publicKeyDigest: alice.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
      swarm: { connectToPeer: jest.fn(async () => peer) },
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareSpliceIn')!({
      operationId: 'prep-splice-1',
      channelId: channel.channelId,
      additionalCoinId: '0x' + '99'.repeat(32),
      additionalAmount: '500',
      additionalCoinAddress: ADDITIONAL_COIN_ADDRESS,
      // OMN-056: explicit decimal balance maps are converted at the boundary.
      newBalances: { alice: '900', bob: '600' },
    });

    expect(prepared).toMatchObject({ success: true, status: 'signature-required', spliceType: 'in' });
    const requests = (prepared as any).requests;
    const updateIndices = { addressIndex: 0, l1: 1, l2: 0 };
    const settlementIndices = { addressIndex: 0, l1: 2, l2: 0 };
    const spliceIndices = { addressIndex: 0, l1: 3, l2: 0 };
    const intentSignature = await alice.signer.sign(signRequestPayload(requests.quiesce.intent), updateIndices);
    const updateSignature = await alice.signer.sign(requests.quiesce.update.digest, updateIndices);
    const settlementSignature = await alice.signer.sign(requests.quiesce.settlement.digest, settlementIndices);
    const spliceIntentSignature = await alice.signer.sign(signRequestPayload(requests.splice.intent), spliceIndices);
    const spliceSignature = await alice.signer.sign(requests.splice.chain.digest, spliceIndices);

    const submitted = await methods.get('omnia/submitSplice')!({
      operationId: 'submit-splice-1',
      preparedOperationId: 'prep-splice-1',
      quiesceIntentSignature: hex(intentSignature),
      quiesceUpdateSignature: hex(updateSignature),
      quiesceSettlementSignature: hex(settlementSignature),
      quiesceUpdateIndices: updateIndices,
      quiesceSettlementIndices: settlementIndices,
      spliceIntentSignature: hex(spliceIntentSignature),
      spliceSignature: hex(spliceSignature),
      spliceIndices,
      coinProofsHex: ['0x010203'],
      scriptProofsHex: ['0x040506'],
    });

    expect(submitted).toMatchObject({ success: true, spliceId: (prepared as any).spliceId, spliceType: 'splice_in' });
    expect((submitted as any).totalValue).toBe('1500');
    const spliced = context.channels.get(channel.channelId)!;
    expect(spliced.status).toBe('active');
    expect(spliced.totalValue).toBe(atoms('1500'));
    expect(spliced.balances).toEqual({ alice: atoms('900'), bob: atoms('600') });
    expect(broadcastTxPoW).toHaveBeenCalledTimes(1);
  }, 60_000);
});
