/**
 * RFC-058 P1 — host preparePay / submitPay with wallet-supplied signatures.
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
const dbPath = `${os.tmpdir()}/omnia-prepare-pay-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('omnia preparePay / submitPay', () => {
  it('registers prepare/submit in coordinator mode without a signer', async () => {
    const channel: OmniaChannel = {
      channelId: '0x' + 'cd'.repeat(32),
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
        { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 },
      ],
      balances: { alice: 600n, bob: 400n },
      pendingHTLCs: [],
      currentSequence: 1,
      latestState: null,
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      createdAt: 1_000,
      updatedAt: 1_000,
    };
    const context = {
      channels: new Map([[channel.channelId, channel]]),
      preparedPay: new Map(),
      coordinator: true,
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      localParticipant: { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0 },
      custodyMode: 'self',
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    expect(methods.has('omnia/preparePay')).toBe(true);
    expect(methods.has('omnia/submitPay')).toBe(true);

    const prepared = await methods.get('omnia/preparePay')!({
      operationId: 'prep-coordinator',
      channelId: channel.channelId,
      amount: '100',
    });
    expect(prepared).toMatchObject({ success: true, status: 'signature-required' });
  });

  it('prepares requests, verifies wallet signatures, applies the state and sends it', async () => {
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
        { partyId: 'alice', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1 },
      ],
      balances: { alice: 600n, bob: 400n },
      pendingHTLCs: [],
      currentSequence: 1,
      latestState: null,
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      createdAt: 1_000,
      updatedAt: 1_000,
    };

    const sent: any[] = [];
    const peer = {
      pubkey: 'bob',
      channelId: channel.channelId,
      sendMessage: jest.fn(async (msg: any) => { sent.push(msg); }),
      onMessage: jest.fn(() => () => {}),
      onReconnected: jest.fn(() => () => {}),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
    };
    const context = {
      channels: new Map([[channel.channelId, channel]]),
      preparedPay: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider: {},
      localParticipant: { partyId: 'alice', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
      swarm: { connectToPeer: jest.fn(async () => peer) },
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/preparePay')!({
      operationId: 'prep-pay-1',
      channelId: channel.channelId,
      amount: '100',
    });

    expect(prepared).toMatchObject({ success: true, status: 'signature-required' });
    const requests = (prepared as any).requests;
    const updateIndices = { addressIndex: 0, l1: 1, l2: 0 };
    const settlementIndices = { addressIndex: 0, l1: 2, l2: 0 };
    const intentSignature = await signing.signer.sign(signRequestPayload(requests.intent), updateIndices);
    const updateSignature = await signing.signer.sign(requests.update.digest, updateIndices);
    const settlementSignature = await signing.signer.sign(requests.settlement.digest, settlementIndices);

    const submitted = await methods.get('omnia/submitPay')!({
      operationId: 'submit-pay-1',
      preparedOperationId: 'prep-pay-1',
      intentSignature: hex(intentSignature),
      updateSignature: hex(updateSignature),
      updateIndices,
      settlementSignature: hex(settlementSignature),
      settlementIndices,
    });

    expect(submitted).toMatchObject({ success: true, channelId: channel.channelId, sequence: 2 });
    const updated = context.channels.get(channel.channelId)!;
    expect(updated.currentSequence).toBe(2);
    expect(updated.balances).toEqual({ alice: 500n, bob: 500n });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'STATE_UPDATE', channelId: channel.channelId });
  });
});
