/**
 * S5 host plumbing: createFactory accepts funding material and closeFactory
 * accepts the factory coin proof. The SDK funding/close state machine is covered
 * by omnia-factory tests; this verifies the host wiring.
 */

jest.mock('@totemsdk/omnia-factory', () => {
  const actual = jest.requireActual('@totemsdk/omnia-factory');
  return {
    ...actual,
    createFactory: jest.fn(async (participants: any[]) => ({
      factoryId: 'factory-1',
      status: 'active',
      participants,
      allocations: {},
      virtualChannels: [],
      currentSequence: 0,
      fundingCoinId: '0x' + 'ab'.repeat(32),
    })),
    closeFactory: jest.fn(async () => ({
      txpowId: 'tx-close-1',
      finalAllocations: { alice: 100n, bob: 100n },
    })),
    buildFactorySettlement: jest.fn(() => ({
      settlementDraft: {},
      settlementTxHex: '0xdead',
      txDigest: new Uint8Array(32).fill(1),
    })),
    signFactorySettlement: jest.fn(async () => ({
      partyId: 'alice',
      signature: new Uint8Array(64).fill(2),
      reservationId: 'res-local',
    })),
    assembleFactorySettlement: jest.fn(async () => ({
      txpowId: 'tx-close-2',
      finalAllocations: { alice: 100n, bob: 100n },
    })),
  };
});

import {
  assembleFactorySettlement as mockAssembleFactorySettlement,
  closeFactory as mockCloseFactory,
  createFactory as mockCreateFactory,
} from '@totemsdk/omnia-factory';
import { createHostMethods } from '../api/methods.js';

const COIN_PROOF = '0x' + '11'.repeat(64);

function makeContext() {
  return {
    channels: new Map(),
    factories: new Map(),
    factoryBundles: {
      alice: { signer: { publicKeyDigest: 'alice' }, leaseProvider: { commitKeyUse: async () => {}, reserveKeyUse: async () => ({ reservationId: 'r', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: Date.now() + 1000 }), burnReservation: async () => {} }, verify: () => true },
    },
    localParticipant: { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0 },
    signer: { publicKeyDigest: 'alice', sign: async () => new Uint8Array(64) },
    leaseProvider: {
      reserveKeyUse: async () => ({ reservationId: 'r', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: Date.now() + 1000 }),
      commitKeyUse: async () => {},
      burnReservation: async () => {},
    },
    chainProvider: { submitTransaction: async () => ({ success: true, txpowid: 'tx-fund' }) },
    operations: {
      get: () => undefined,
      create: () => ({ operationId: 'op', status: 'pending' }),
      transition: () => ({ operationId: 'op', status: 'committed' }),
      listByStatus: () => [],
    },
  } as any;
}

describe('S5 factory funding + close host plumbing', () => {
  function makeContext() {
    return {
      channels: new Map(),
      factories: new Map(),
      factoryBundles: {
        alice: { signer: { publicKeyDigest: 'alice' }, leaseProvider: { commitKeyUse: async () => {}, reserveKeyUse: async () => ({ reservationId: 'r', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: Date.now() + 1000 }), burnReservation: async () => {} }, verify: () => true },
      },
      localParticipant: { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0 },
      signer: { publicKeyDigest: 'alice', sign: async () => new Uint8Array(64) },
      leaseProvider: {
        reserveKeyUse: async () => ({ reservationId: 'r', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: Date.now() + 1000 }),
        commitKeyUse: async () => {},
        burnReservation: async () => {},
      },
      chainProvider: { submitTransaction: async () => ({ success: true, txpowid: 'tx-fund' }) },
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
    } as any;
  }

  it('passes funding material into createFactory', async () => {
    const context = makeContext();
    const methods = createHostMethods(context);
    const result = await methods.get('omnia/createFactory')!({
      operationId: 'op-create',
      tokenId: '0x00',
      participants: [
        { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0, contributionAmount: '100' },
        { partyId: 'bob', publicKeyDigest: 'bob', addressIndex: 0, contributionAmount: '100' },
      ],
      funding: [
        { partyId: 'alice', coinProof: COIN_PROOF, coinAddress: 'MxAlice', script: 'RETURN TRUE' },
        { partyId: 'bob', coinProof: COIN_PROOF, coinAddress: 'MxBob', script: 'RETURN TRUE' },
      ],
    });

    expect(result).toMatchObject({ success: true, factoryId: 'factory-1' });
    expect(mockCreateFactory).toHaveBeenCalledTimes(1);
    const args = (mockCreateFactory as jest.Mock).mock.calls[0];
    expect(args[5]).toHaveLength(2);
    expect(args[5][0]).toMatchObject({ partyId: 'alice', coinAddress: 'MxAlice', script: 'RETURN TRUE' });
    expect(args[5][0].coinProof).toBeInstanceOf(Uint8Array);
    expect(typeof args[5][0].signer).toBe('function');
  });

  it('passes the factory coin proof into closeFactory', async () => {
    const context = makeContext();
    context.factories.set('factory-1', { factoryId: 'factory-1', status: 'active', participants: [], virtualChannels: [] });
    const methods = createHostMethods(context);
    const result = await methods.get('omnia/closeFactory')!({
      operationId: 'op-close',
      factoryId: 'factory-1',
      coinProof: COIN_PROOF,
    });

    expect(result).toMatchObject({ success: true, factoryId: 'factory-1', settlementTxId: 'tx-close-1' });
    expect(mockCloseFactory).toHaveBeenCalledTimes(1);
    const args = (mockCloseFactory as jest.Mock).mock.calls[0];
    expect(args[3].coinProof).toBeInstanceOf(Uint8Array);
  });
});


describe('S5 cooperative factory close (two hosts)', () => {
  it('collects the counterparty signature and broadcasts once', async () => {
    let reply: ((msg: any) => void) | undefined;
    const remoteSig = { partyId: 'bob', signature: new Uint8Array(64).fill(3), reservationId: 'res-remote' };
    const sent: any[] = [];
    const peer = {
      pubkey: 'bob',
      channelId: 'factory-1',
      sendMessage: jest.fn(async (msg: any) => {
        sent.push(msg);
        if (msg.type === 'FACTORY_CLOSE_PROPOSAL') {
          setTimeout(() => reply?.({ ...msg, type: 'FACTORY_CLOSE_ACCEPT', payload: { signature: remoteSig } }), 0);
        }
      }),
      onMessage: jest.fn((cb: (msg: any) => void) => { reply = cb; return () => { reply = undefined; }; }),
      onReconnected: jest.fn(() => () => {}),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
    };
    const context = makeContext();
    context.swarm = { connectToPeer: jest.fn(async () => peer) };
    context.factories.set('factory-1', {
      factoryId: 'factory-1',
      status: 'active',
      participants: [
        { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0, contributionAmount: 100n },
        { partyId: 'bob', publicKeyDigest: 'bob', addressIndex: 0, contributionAmount: 100n },
      ],
      allocations: { alice: 100n, bob: 100n },
      virtualChannels: [],
      currentSequence: 0,
      fundingCoinId: '0x' + 'ab'.repeat(32),
    });
    const methods = createHostMethods(context);
    const result = await methods.get('omnia/closeFactory')!({
      operationId: 'op-close-2',
      factoryId: 'factory-1',
      coinProof: COIN_PROOF,
    });

    expect(result).toMatchObject({ success: true, factoryId: 'factory-1', settlementTxId: 'tx-close-2' });
    expect(mockAssembleFactorySettlement).toHaveBeenCalledTimes(1);
    expect(sent.map((m) => m.type)).toEqual(['FACTORY_CLOSE_PROPOSAL', 'FACTORY_CLOSE_FINALIZED']);
  });
});
