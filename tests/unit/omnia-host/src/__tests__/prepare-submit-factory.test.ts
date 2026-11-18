/**
 * RFC-058 P1 — host prepareFactory / submitFactory wallet flow.
 */

import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import { signRequestPayload } from '@totemsdk/omnia';
import { acceptFactory } from '@totemsdk/omnia-factory';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const ALICE_SEED = '0x' + 'ab'.repeat(32);
const BOB_SEED = '0x' + 'cd'.repeat(32);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('omnia prepareFactory / submitFactory', () => {
  it('signs the factory commitment, gets the peer acceptance and activates', async () => {
    const alice = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: ALICE_SEED,
      OMNIA_HOST_DB: `${os.tmpdir()}/omnia-prepare-factory-alice-${suffix}.sqlite`,
    }));
    const bob = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: BOB_SEED,
      OMNIA_HOST_DB: `${os.tmpdir()}/omnia-prepare-factory-bob-${suffix}.sqlite`,
    }));
    const bobBundle = { leaseProvider: bob.leaseProvider, signer: bob.signer };

    let onMessage: ((msg: any) => void) | undefined;
    const peer = {
      pubkey: 'bob',
      channelId: 'factory',
      sendMessage: jest.fn(async (msg: any) => {
        if (msg.type === 'FACTORY_PROPOSAL') {
          const accepted = await acceptFactory(msg.payload.factory, bobBundle);
          setTimeout(() => onMessage?.({
            type: 'FACTORY_ACCEPT',
            channelId: accepted.factoryId,
            nonce: msg.nonce,
            payload: { factory: accepted },
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
    const context = {
      channels: new Map(),
      factories: new Map(),
      preparedFactory: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      localParticipant: { partyId: 'alice', publicKeyDigest: alice.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
      coordinator: true,
      swarm: { connectToPeer: jest.fn(async () => peer) },
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareFactory')!({
      operationId: 'prep-factory-1',
      participants: [
        { partyId: 'alice', publicKeyDigest: alice.publicKeyDigest, addressIndex: 0, contributionAmount: '600' },
        { partyId: 'bob', publicKeyDigest: bob.publicKeyDigest, addressIndex: 1, contributionAmount: '400' },
      ],
      tokenId: '0x00',
    });

    expect(prepared).toMatchObject({ success: true, status: 'signature-required', onChain: false });
    const requests = (prepared as any).requests;
    const indices = { addressIndex: 0, l1: 0, l2: 0 };
    const intentSignature = await alice.signer.sign(signRequestPayload(requests.intent), indices);
    const commitmentSignature = await alice.signer.sign(requests.commitment.digest, indices);

    const submitted = await methods.get('omnia/submitFactory')!({
      operationId: 'submit-factory-1',
      preparedOperationId: 'prep-factory-1',
      intentSignature: hex(intentSignature),
      commitmentSignature: hex(commitmentSignature),
    });

    expect(submitted).toMatchObject({ success: true, status: 'active' });
    const factory = (context.factories as Map<string, any>).get((prepared as any).factoryId)!;
    expect(factory.status).toBe('active');
    expect(factory.allocations).toEqual({ alice: amountToAtoms('600'), bob: amountToAtoms('400') });
  }, 30_000);

  it('OMN-037: accepts fractional participant contributions as decimal MINIMA', async () => {
    const alice = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: ALICE_SEED,
      OMNIA_HOST_DB: `${os.tmpdir()}/omnia-fractional-factory-alice-${suffix}.sqlite`,
    }));
    const bob = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: BOB_SEED,
      OMNIA_HOST_DB: `${os.tmpdir()}/omnia-fractional-factory-bob-${suffix}.sqlite`,
    }));
    const bobBundle = { leaseProvider: bob.leaseProvider, signer: bob.signer };

    let onMessage: ((msg: any) => void) | undefined;
    const peer = {
      pubkey: 'bob',
      channelId: 'factory',
      sendMessage: jest.fn(async (msg: any) => {
        if (msg.type === 'FACTORY_PROPOSAL') {
          const accepted = await acceptFactory(msg.payload.factory, bobBundle);
          setTimeout(() => onMessage?.({
            type: 'FACTORY_ACCEPT',
            channelId: accepted.factoryId,
            nonce: msg.nonce,
            payload: { factory: accepted },
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
    const context = {
      channels: new Map(),
      factories: new Map(),
      preparedFactory: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      localParticipant: { partyId: 'alice', publicKeyDigest: alice.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
      coordinator: true,
      swarm: { connectToPeer: jest.fn(async () => peer) },
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareFactory')!({
      operationId: 'prep-factory-frac',
      participants: [
        { partyId: 'alice', publicKeyDigest: alice.publicKeyDigest, addressIndex: 0, contributionAmount: '0.2' },
        { partyId: 'bob', publicKeyDigest: bob.publicKeyDigest, addressIndex: 1, contributionAmount: '0.3' },
      ],
      tokenId: '0x00',
    });
    const requests = (prepared as any).requests;
    const indices = { addressIndex: 0, l1: 0, l2: 0 };
    const intentSignature = await alice.signer.sign(signRequestPayload(requests.intent), indices);
    const commitmentSignature = await alice.signer.sign(requests.commitment.digest, indices);

    await methods.get('omnia/submitFactory')!({
      operationId: 'submit-factory-frac',
      preparedOperationId: 'prep-factory-frac',
      intentSignature: hex(intentSignature),
      commitmentSignature: hex(commitmentSignature),
    });

    const factory = (context.factories as Map<string, any>).get((prepared as any).factoryId)!;
    expect(factory.allocations).toEqual({
      alice: amountToAtoms('0.2'),
      bob: amountToAtoms('0.3'),
    });
    expect(factory.totalValue ?? factory.total).toBe(amountToAtoms('0.5'));
  }, 30_000);
});
