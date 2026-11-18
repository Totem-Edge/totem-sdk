/**
 * RFC-058 P1 — host prepareOpenChannel / submitOpenChannel wallet funding.
 */

import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import { signRequestPayload } from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

/** Channel/pool internals are integer atoms; RPC amounts are decimal MINIMA text. */
const atoms = (value: string | number) => amountToAtoms(String(value));

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-prepare-open-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('omnia prepareOpenChannel / submitOpenChannel', () => {
  it('prepares the funding digest, verifies the wallet signature and broadcasts', async () => {
    const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath });
    const signing = createHostSigning(config);
    const getCoin = jest.fn(async () => ({
      coinid: '0x' + 'cc'.repeat(32),
      amount: '1000',
      address: '0x' + 'dd'.repeat(32),
      tokenid: '0x00',
      spent: false,
      created: '1',
    }));
    const submitTransaction = jest.fn(async () => ({ success: true, txpowid: 'tx-funding' }));
    const chainProvider = {
      getCoin,
      getToken: jest.fn(async () => ({ script: 'RETURN TRUE' })),
      getTip: jest.fn(async () => ({ block: 10, hash: '0x01' })),
      submitTransaction,
    };
    const context = {
      channels: new Map(),
      preparedOpen: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider,
      localParticipant: {
        partyId: 'alice',
        publicKeyDigest: signing.publicKeyDigest,
        addressIndex: 0,
        settlementAddress: '0x' + '44'.repeat(32),
      },
      custodyMode: 'self',
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareOpenChannel')!({
      operationId: 'prep-open-1',
      remotePartyId: 'bob',
      remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
      remoteAddressIndex: 1,
      remoteSettlementAddress: '0x' + '55'.repeat(32),
      localAmount: '600',
      remoteAmount: '400',
      fundingCoinId: '0x' + 'cc'.repeat(32),
    });

    expect(prepared).toMatchObject({ success: true, status: 'signature-required' });
    const requests = (prepared as any).requests;
    const indices = { addressIndex: 0, l1: 0, l2: 0 };
    const intentSignature = await signing.signer.sign(signRequestPayload(requests.intent), indices);
    const fundingSignature = await signing.signer.sign(requests.funding.digest, indices);

    const submitted = await methods.get('omnia/submitOpenChannel')!({
      operationId: 'submit-open-1',
      preparedOperationId: 'prep-open-1',
      intentSignature: hex(intentSignature),
      fundingSignature: hex(fundingSignature),
      fundingCoinProofsHex: ['0x01'],
      fundingScriptProofsHex: ['0x02'],
    });

    expect(submitted).toMatchObject({
      success: true,
      fundingTxId: 'tx-funding',
      acknowledged: true,
    });
    const channel = context.channels.get((submitted as any).channelId)!;
    expect(channel.status).toBe('active');
    expect(channel.fundingTxId).toBe('tx-funding');
    expect(channel.balances).toEqual({ alice: atoms('600'), bob: atoms('400') });
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('R2: rejects an atom integer where the RPC expects decimal MINIMA text', async () => {
    const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: `${dbPath}-guard` });
    const signing = createHostSigning(config);
    const context = {
      channels: new Map(),
      preparedOpen: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider: { getCoin: jest.fn(), getToken: jest.fn(), submitTransaction: jest.fn() },
      localParticipant: {
        partyId: 'alice',
        publicKeyDigest: signing.publicKeyDigest,
        addressIndex: 0,
        settlementAddress: '0x' + '44'.repeat(32),
      },
      custodyMode: 'self',
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);
    await expect(methods.get('omnia/prepareOpenChannel')!({
      operationId: 'prep-atoms',
      remotePartyId: 'bob',
      remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
      remoteAddressIndex: 1,
      localAmount: '2' + '0'.repeat(43), // 2e43 = 0.2 MINIMA in atoms
      remoteAmount: '100',
      fundingCoinId: '0x' + 'cc'.repeat(32),
    })).rejects.toThrow(/looks like an atom integer/);

    // Boundary: exactly the node ceiling is accepted by the amount guard (it
    // fails later for lack of a funding coin), one atom above is rejected.
    await expect(methods.get('omnia/prepareOpenChannel')!({
      operationId: 'prep-ceiling-ok',
      remotePartyId: 'bob',
      remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
      remoteAddressIndex: 1,
      localAmount: '1000000000',
      remoteAmount: '1',
      fundingCoinId: '0x' + 'cc'.repeat(32),
    })).rejects.not.toThrow(/looks like an atom integer/);
    await expect(methods.get('omnia/prepareOpenChannel')!({
      operationId: 'prep-ceiling-over',
      remotePartyId: 'bob',
      remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
      remoteAddressIndex: 1,
      localAmount: '1000000001',
      remoteAmount: '1',
      fundingCoinId: '0x' + 'cc'.repeat(32),
    })).rejects.toThrow(/looks like an atom integer/);
  });

  it('CAN-006: an unacknowledged open is persisted pending and can be re-proposed', async () => {
    const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: `${dbPath}-ack` });
    const signing = createHostSigning(config);
    const chainProvider = {
      getCoin: jest.fn(async () => ({
        coinid: '0x' + 'cc'.repeat(32),
        amount: '1000',
        address: '0x' + 'dd'.repeat(32),
        tokenid: '0x00',
        spent: false,
        created: '1',
      })),
      getToken: jest.fn(async () => ({ script: 'RETURN TRUE' })),
      submitTransaction: jest.fn(async () => ({ success: true, txpowid: 'tx-funding' })),
      getTip: jest.fn(async () => ({ block: 1 })),
    };

    const listeners = new Set<(msg: any) => void>();
    let replyType = 'ERROR';
    const peer = {
      sendMessage: jest.fn(async (msg: any) => {
        if (msg.type === 'CHANNEL_PROPOSAL') {
          const type = replyType;
          setImmediate(() => {
            for (const cb of listeners) {
              cb({
                type,
                channelId: msg.channelId,
                nonce: msg.nonce,
                payload: type === 'ERROR' ? { error: 'rejected by peer' } : {},
              });
            }
          });
        }
      }),
      onMessage: (cb: (msg: any) => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      onReconnected: () => () => {},
    };

    const context = {
      channels: new Map(),
      preparedOpen: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider,
      swarm: { connectToPeer: jest.fn(async () => peer) },
      localParticipant: {
        partyId: 'alice',
        publicKeyDigest: signing.publicKeyDigest,
        addressIndex: 0,
        settlementAddress: '0x' + '44'.repeat(32),
      },
      custodyMode: 'self',
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareOpenChannel')!({
      operationId: 'prep-open-ack',
      remotePartyId: 'bob',
      remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
      remoteAddressIndex: 1,
      remoteSettlementAddress: '0x' + '55'.repeat(32),
      localAmount: '600',
      remoteAmount: '400',
      fundingCoinId: '0x' + 'cc'.repeat(32),
    });
    const requests = (prepared as any).requests;
    const indices = { addressIndex: 0, l1: 0, l2: 0 };
    const intentSignature = await signing.signer.sign(signRequestPayload(requests.intent), indices);
    const fundingSignature = await signing.signer.sign(requests.funding.digest, indices);

    const submitted = await methods.get('omnia/submitOpenChannel')!({
      operationId: 'submit-open-ack',
      preparedOperationId: 'prep-open-ack',
      intentSignature: hex(intentSignature),
      fundingSignature: hex(fundingSignature),
      fundingScriptProofsHex: ['0x02'],
    }) as any;

    expect(submitted).toMatchObject({
      success: false,
      acknowledged: false,
      status: 'funding_pending',
      errorCode: 'NOT_ACKNOWLEDGED',
    });
    const channelId = submitted.channelId as string;
    expect(context.channels.get(channelId)!.status).toBe('funding_pending');

    replyType = 'ACK';
    const resubmitted = await methods.get('omnia/resubmitChannelProposal')!({
      operationId: 'resubmit-open-ack',
      channelId,
    }) as any;
    expect(resubmitted).toMatchObject({ success: true, acknowledged: true, status: 'active' });
    expect(context.channels.get(channelId)!.status).toBe('active');
  });
});
