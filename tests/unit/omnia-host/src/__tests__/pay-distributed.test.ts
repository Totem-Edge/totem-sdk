/**
 * OMN-102 / OMN-103 (audit 3, OMN-100/101) — distributed payment execution.
 *
 * OMN-102: the distributed branch returned before withOperation, so a payment
 * that locks liquidity and messages a peer had no durable journal. It now runs
 * under the same lifecycle and requires an operation id.
 *
 * OMN-103: locality was decided from `channelId` alone; a swap hop also owns
 * `outboundChannelId`, so a route could be called local with a remote outbound
 * channel.
 */

import os from 'node:os';
import { amountToAtoms } from '@totemsdk/core';
import { DefaultEltooPaymentProgram, type OmniaChannel } from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const atoms = (value: string | number) => amountToAtoms(String(value));
const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-pay-distributed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const REMOTE_CHANNEL = '0x' + '99'.repeat(32);
const BOB = '0x' + 'bb'.repeat(32);
const CAROL = '0x' + '77'.repeat(32);

function harness() {
  const signing = createHostSigning(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath }));
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
    totalValue: atoms('1000'),
    parties: [
      { partyId: 'alice', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: BOB, addressIndex: 1 },
    ],
    balances: { alice: atoms('600'), bob: atoms('400') },
    pendingHTLCs: [],
    currentSequence: 1,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1_000,
    updatedAt: 1_000,
  };

  const records = new Map<string, any>();
  const operations = {
    get: (id: string) => records.get(id),
    create: (id: string, request?: unknown) => {
      const record = { operationId: id, status: 'pending', request };
      records.set(id, record);
      return record;
    },
    transition: (id: string, _from: string, to: string, patch?: any) => {
      const record = records.get(id);
      record.status = to;
      record.result = patch?.result;
      record.error = patch?.error;
      return record;
    },
    listByStatus: () => [],
  };

  const signer = {
    publicKeyDigest: signing.publicKeyDigest,
    sign: jest.fn(async () => new Uint8Array(1088)),
  };
  const context = {
    channels: new Map([[channel.channelId, channel]]),
    operations,
    routing: { getRoute: jest.fn() },
    signer,
    leaseProvider: {
      reserveKeyUse: jest.fn(async () => ({
        reservationId: 'lease-1',
        indices: { addressIndex: 0, l1: 0, l2: 0 },
        expiresAt: Date.now() + 1000,
      })),
      commitKeyUse: jest.fn(async () => undefined),
      burnReservation: jest.fn(async () => undefined),
    },
    chainProvider: { broadcastTxPoW: jest.fn() },
    localParticipant: channel.parties[0],
    swarm: { connectToPeer: jest.fn(async () => ({ sendMessage: jest.fn(async () => undefined) })) },
  } as unknown as HostApiContext;

  return { context, channel, methods: createHostMethods(context) };
}

function twoHopRoute(channelId: string) {
  return {
    tokenIn: '0x00',
    tokenOut: '0x00',
    totalFees: '0',
    estimatedBlocks: 2,
    hops: [
      { channelId, from: 'alice', to: BOB, amount: '0.5', tokenId: '0x00' },
      { channelId: REMOTE_CHANNEL, from: BOB, to: CAROL, amount: '0.5', tokenId: '0x00' },
    ],
  };
}

describe('distributed payment execution', () => {
  it('refuses a distributed payment without an operation id (OMN-102)', async () => {
    const { context, channel, methods } = harness();

    await expect(methods.get('omnia/payMultiHop')!({
      route: twoHopRoute(channel.channelId),
      hashlock: '0x' + '11'.repeat(32),
      preimage: '0x' + '22'.repeat(32),
      amount: '0.5',
      tokenId: '0x00',
      expiryBlock: '1000',
    })).rejects.toThrow(/requires an operationId/);

    // Nothing may be locked before an operation id exists.
    expect(channel.pendingHTLCs).toHaveLength(0);
    expect(context.swarm!.connectToPeer).not.toHaveBeenCalled();
  });

  it('runs the distributed payment through the operation journal (OMN-102)', async () => {
    const { context, channel, methods } = harness();

    await expect(methods.get('omnia/payMultiHop')!({
      operationId: 'dist-1',
      route: twoHopRoute(channel.channelId),
      hashlock: '0x' + '11'.repeat(32),
      preimage: '0x' + '22'.repeat(32),
      amount: '0.5',
      tokenId: '0x00',
      expiryBlock: '1000',
    })).resolves.toMatchObject({ state: 'first-hop-accepted', terminal: false });

    const operation = context.operations!.get('dist-1')!;
    expect(operation.status).toBe('committed');
  });

  it('treats a swap route with a remote outbound channel as distributed (OMN-103)', async () => {
    const { methods, channel } = harness();

    await expect(methods.get('omnia/payMultiHop')!({
      operationId: 'swap-1',
      route: {
        tokenIn: '0x00',
        tokenOut: '0x' + '44'.repeat(32),
        totalFees: '0',
        estimatedBlocks: 2,
        hops: [{
          channelId: channel.channelId,
          isSwap: true,
          tokenIn: '0x00',
          tokenOut: '0x' + '44'.repeat(32),
          amountIn: '0.5',
          amountOut: '0.4',
          rate: '0.8',
          inboundChannelId: channel.channelId,
          outboundChannelId: REMOTE_CHANNEL,
          from: 'alice',
          to: BOB,
          amount: '0.5',
          tokenId: '0x00',
        }],
      },
      hashlock: '0x' + '11'.repeat(32),
      preimage: '0x' + '22'.repeat(32),
      amount: '0.5',
      tokenId: '0x00',
      targetTokenId: '0x' + '44'.repeat(32),
      expiryBlock: '1000',
    })).rejects.toThrow(/Distributed cross-token payments are not supported/);
  });
});
