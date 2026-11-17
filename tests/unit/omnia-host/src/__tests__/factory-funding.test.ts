/**
 * S5 host plumbing: createFactory accepts funding material and closeFactory
 * accepts the factory coin proof. The SDK funding/close state machine is covered
 * by omnia-factory tests; this verifies the host wiring.
 */

jest.mock('@totemsdk/omnia-factory', () => {
  const actual = jest.requireActual('@totemsdk/omnia-factory');
  return {
    ...actual,
    buildFactoryOpening: jest.fn(async (participants: any[]) => ({
      factory: {
        factoryId: 'factory-1',
        status: 'opening',
        participants,
        allocations: Object.fromEntries(participants.map((p: any) => [p.partyId, BigInt(p.contributionAmount)])),
        totalValue: participants.reduce((sum: bigint, p: any) => sum + BigInt(p.contributionAmount), 0n),
        tokenId: '0x00',
        tokenScale: 0,
        virtualChannels: [],
        currentSequence: 0,
        stateLog: [],
        fundingScript: 'RETURN TRUE',
        fundingAddress: '0x' + 'ee'.repeat(32),
        pendingCommitment: '0x' + 'ab'.repeat(32),
        pendingSignatures: {},
      },
      fundingTxBytes: new Uint8Array([1, 2, 3]),
      fundingDigest: new Uint8Array(32).fill(9),
      fundingCoinId: '0x' + 'cd'.repeat(32),
      fundingMaterials: [],
      onChain: true,
    })),
    proposeFactoryOpening: jest.fn(async (plan: any) => ({
      ...plan.factory,
      pendingSignatures: { alice: new Uint8Array(64).fill(1) },
    })),
    finalizeFactoryOpening: jest.fn(async (plan: any) => ({
      ...plan.factory,
      status: 'active',
      currentSequence: 1,
      fundingTxId: 'tx-fund',
      fundingCoinId: plan.fundingCoinId,
      pendingCommitment: undefined,
      pendingSignatures: {},
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
  finalizeFactoryOpening as mockFinalizeFactoryOpening,
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
        { partyId: 'alice', coinProof: COIN_PROOF, coinAddress: 'MxAlice', script: 'RETURN TRUE', signature: '0x' + '11'.repeat(64) },
        { partyId: 'bob', coinProof: COIN_PROOF, coinAddress: 'MxBob', script: 'RETURN TRUE', signature: '0x' + '22'.repeat(64) },
      ],
    });

    expect(result).toMatchObject({ success: true, factoryId: 'factory-1' });
    expect(mockFinalizeFactoryOpening).toHaveBeenCalledTimes(1);
    const opts = (mockFinalizeFactoryOpening as jest.Mock).mock.calls[0][1];
    expect(opts.fundingSignatures).toMatchObject({
      alice: expect.any(Uint8Array),
      bob: expect.any(Uint8Array),
    });
    expect(opts.openingSignatures).toMatchObject({ alice: expect.any(Uint8Array) });
  });

  it('sends the proposal before requesting funding signatures', async () => {
    const events: string[] = [];
    let reply: ((msg: any) => void) | undefined;
    const peer = {
      pubkey: 'bob',
      channelId: 'factory-1',
      sendMessage: jest.fn(async (msg: any) => {
        events.push(msg.type);
        if (msg.type === 'FACTORY_PROPOSAL') {
          const sig = new Uint8Array(64).fill(9);
          setTimeout(() => reply?.({
            type: 'FACTORY_ACCEPT',
            channelId: msg.channelId,
            nonce: msg.nonce,
            payload: {
              factory: {
                ...msg.payload.factory,
                pendingSignatures: { alice: sig, bob: sig },
              },
            },
          }), 0);
        }
        if (msg.type === 'FACTORY_FUNDING_REQUEST') {
          setTimeout(() => reply?.({
            type: 'FACTORY_FUNDING_RESPONSE',
            channelId: msg.channelId,
            nonce: msg.nonce,
            payload: { signature: '0x' + '33'.repeat(64) },
          }), 0);
        }
      }),
      onMessage: jest.fn((cb: (msg: any) => void) => { reply = cb; return () => { reply = undefined; }; }),
      onReconnected: jest.fn(() => () => {}),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true),
    };
    const context = makeContext();
    context.swarm = { connectToPeer: jest.fn(async () => peer) };
    const methods = createHostMethods(context);

    await methods.get('omnia/createFactory')!({
      operationId: 'op-order',
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

    expect(events[0]).toBe('FACTORY_PROPOSAL');
    expect(events).toContain('FACTORY_FUNDING_REQUEST');
    expect(events.indexOf('FACTORY_FUNDING_REQUEST')).toBeGreaterThan(events.indexOf('FACTORY_PROPOSAL'));
    const opts = (mockFinalizeFactoryOpening as jest.Mock).mock.calls.at(-1)[1];
    expect(opts.fundingSignatures).toMatchObject({ alice: expect.any(Uint8Array), bob: expect.any(Uint8Array) });
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
