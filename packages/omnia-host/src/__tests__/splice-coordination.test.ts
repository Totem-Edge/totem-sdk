/**
 * S7 host coordination: propose over the peer, receive the acceptance, finalize,
 * and send SPLICE_FINALIZED. The splice SDK is mocked here; the real state
 * machine is covered by the S7 harness and omnia-splice tests.
 */

jest.mock('@totemsdk/omnia-splice', () => {
  const actual = jest.requireActual('@totemsdk/omnia-splice');
  return {
    ...actual,
    quiesceChannel: jest.fn(async (channel: any) => ({ ...channel, status: 'quiesced' })),
    proposeSpliceIn: jest.fn(async (_channel: any, coinId: string, amount: bigint) => ({
      spliceId: 'splice-1',
      channelId: 'ch-1',
      params: { type: 'splice_in', newTotalValue: 1500n, newBalances: { alice: 900n, bob: 600n }, additionalCoinId: coinId, additionalAmount: amount },
      spliceTxHex: '0xdead',
      spliceTxDraft: {},
      proposerPublicKeyDigest: 'alice',
      proposerSignature: new Uint8Array(),
      proposerReservationId: 'res-a',
      proposerSigningIndices: { l1: 0, l2: 0, addressIndex: 0 },
      proposedAt: 1,
    })),
    finalizeSplice: jest.fn(async () => ({
      channelId: 'ch-1',
      status: 'active',
      spliceType: 'splice_in',
      spliceFundingTxId: 'tx-1',
      spliceFundingCoinId: 'tx-1-0',
      totalValue: 1500n,
      balances: { alice: 900n, bob: 600n },
    })),
  };
});

import { createHostMethods } from '../api/methods.js';

describe('S7 host splice coordination', () => {
  it('proposes, accepts, finalizes, and notifies the counterparty', async () => {
    const channel = {
      channelId: 'ch-1',
      status: 'active',
      parties: [
        { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'bob', addressIndex: 0 },
      ],
      balances: { alice: 600n, bob: 400n },
      totalValue: 1000n,
      pendingHTLCs: [],
      currentSequence: 5,
      stateLog: [],
    };

    let reply: ((msg: any) => void) | undefined;
    const acceptance = {
      spliceId: 'splice-1',
      channelId: 'ch-1',
      acceptorPublicKeyDigest: 'bob',
      acceptorSignature: new Uint8Array(),
      acceptorReservationId: 'res-b',
      acceptorSigningIndices: { l1: 0, l2: 0, addressIndex: 0 },
      acceptedAt: 1,
    };
    const sent: any[] = [];
    const peer = {
      pubkey: 'bob',
      channelId: 'ch-1',
      sendMessage: jest.fn(async (msg: any) => {
        sent.push(msg);
        if (msg.type === 'SPLICE_PROPOSAL') {
          setTimeout(() => reply?.({ ...msg, type: 'SPLICE_ACCEPT', payload: { acceptance } }), 0);
        }
      }),
      onMessage: jest.fn((cb: (msg: any) => void) => { reply = cb; return () => { reply = undefined; }; }),
      onReconnected: jest.fn(() => () => {}),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
    };
    const context = {
      channels: new Map([['ch-1', channel]]),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      swarm: {
        connectToPeer: jest.fn(async () => peer),
        advertise: jest.fn(),
        listenForChannels: jest.fn(() => jest.fn()),
        broadcast: jest.fn(),
        close: jest.fn(async () => undefined),
      },
      spliceLeaseProvider: {
        signer: { publicKeyDigest: 'alice' },
        wotsLease: {},
        broadcast: jest.fn(async () => ({ txpowid: 'tx-1', success: true })),
      },
      spliceProposals: new Map(),
      spliceAcceptances: new Map(),
      localParticipant: { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0 },
      signer: { publicKeyDigest: 'alice', sign: async () => new Uint8Array(64) },
      leaseProvider: {},
      chainProvider: {},
    } as any;

    const methods = createHostMethods(context);
    const handler = methods.get('omnia/spliceIn')!;
    const result = await handler({
      operationId: 'op-splice-in',
      channelId: 'ch-1',
      additionalCoinId: '0xcoin',
      additionalAmount: '500',
    });

    expect(result).toMatchObject({ success: true, channelId: 'ch-1', spliceId: 'splice-1', totalValue: '1500' });
    expect(sent.map((m) => m.type)).toEqual(['SPLICE_PROPOSAL', 'SPLICE_FINALIZED']);
    expect(context.channels.get('ch-1').totalValue).toBe(1500n);
    expect(context.spliceAcceptances.get('splice-1')).toEqual(acceptance);
  });
});
