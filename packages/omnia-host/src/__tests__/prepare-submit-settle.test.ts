/**
 * RFC-058 P1 — host prepareSettle / submitSettle with wallet signatures.
 */

import os from 'node:os';
import {
  DefaultEltooPaymentProgram,
  signRequestPayload,
  type OmniaChannel,
} from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-prepare-settle-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('omnia prepareSettle / submitSettle', () => {
  it('co-signs with the peer, verifies wallet signatures and broadcasts the close', async () => {
    const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath });
    const signing = createHostSigning(config);
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
      totalValue: 1000n,
      parties: [
        {
          partyId: 'alice',
          publicKeyDigest: signing.publicKeyDigest,
          addressIndex: 0,
          settlementAddress: '0x' + '44'.repeat(32),
        },
        {
          partyId: 'bob',
          publicKeyDigest: '0x' + 'bb'.repeat(32),
          addressIndex: 1,
          settlementAddress: '0x' + '55'.repeat(32),
        },
      ],
      balances: { alice: 600n, bob: 400n },
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
        if (msg.type === 'SETTLEMENT_PROPOSAL') {
          setTimeout(() => onMessage?.({
            type: 'ACK',
            channelId: msg.channelId,
            nonce: msg.nonce,
            payload: { partyId: 'bob', signature: hex(new Uint8Array(64)) },
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
    const submitTransaction = jest.fn(async () => ({ success: true, txpowid: 'tx-settle' }));
    const context = {
      channels: new Map([[channel.channelId, channel]]),
      preparedSettle: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider: { submitTransaction },
      localParticipant: { partyId: 'alice', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
      swarm: { connectToPeer: jest.fn(async () => peer) },
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareSettle')!({
      operationId: 'prep-settle-1',
      channelId: channel.channelId,
    });

    expect(prepared).toMatchObject({ success: true, status: 'signature-required' });
    const requests = (prepared as any).requests;
    const indices = { addressIndex: 0, l1: 5, l2: 0 };
    const intentSignature = await signing.signer.sign(signRequestPayload(requests.intent), indices);
    const settlementSignature = await signing.signer.sign(requests.settlement.digest, indices);

    const submitted = await methods.get('omnia/submitSettle')!({
      operationId: 'submit-settle-1',
      preparedOperationId: 'prep-settle-1',
      intentSignature: hex(intentSignature),
      settlementSignature: hex(settlementSignature),
      settlementIndices: indices,
      broadcastProofs: { coinProofs: ['0x01'], scriptProofs: ['0x02'] },
    });

    expect(submitted).toMatchObject({ success: true, settlementTxId: 'tx-settle' });
    expect(context.channels.get(channel.channelId)!.status).toBe('closed');
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });
});
