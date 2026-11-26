/**
 * OMN-077 regression — operation replay must survive the real operation store.
 *
 * withOperation() used to read `verifyRequest` off the store and call it as a
 * bare function. OperationStore.verifyRequest() calls `this.get()`, so the
 * unbound call threw TypeError on every retry of an existing operation. The
 * existing unit tests missed it because they stub the store with an object
 * literal whose verifyRequest is a closure over a Map.
 *
 * This suite deliberately uses the production OperationStore (a real SQLite
 * file, no mock) so the receiver bug cannot come back unnoticed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { amountToAtoms } from '@totemsdk/core';

import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';
import { OperationStore } from '../stores/operations.js';

const atoms = (value: string | number) => amountToAtoms(String(value));

function sqliteAvailable(): boolean {
  try {
    const store = new OperationStore(':memory:');
    store.close();
    return true;
  } catch (error) {
    if (String(error).includes('Could not locate the bindings file')) return false;
    throw error;
  }
}

const describeSqlite = sqliteAvailable() ? describe : describe.skip;

function channel(overrides: Record<string, unknown> = {}) {
  return {
    channelId: 'channel-1',
    fundingTxId: '0x' + '11'.repeat(32),
    fundingCoinId: '0x' + '22'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + '33'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: atoms('10'),
    parties: [
      { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0, settlementAddress: '0x' + '44'.repeat(32) },
      { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1, settlementAddress: '0x' + '55'.repeat(32) },
    ],
    balances: { alice: atoms('7'), bob: atoms('3') },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as any;
}

function hostWith(operations: OperationStore) {
  const channels = new Map<string, any>([['channel-1', channel()]]);
  const signer = {
    publicKeyDigest: '0x' + 'aa'.repeat(32),
    sign: async () => new Uint8Array(1088),
  };
  const leaseProvider = {
    reserveKeyUse: async () => ({
      reservationId: 'lease-1',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      expiresAt: Date.now() + 1000,
    }),
    commitKeyUse: async () => undefined,
    burnReservation: async () => undefined,
  } as any;

  const context = {
    channels,
    operations: operations as any,
    routing: new InProcessRoutingProvider(),
    signer,
    leaseProvider,
    localParticipant: channels.get('channel-1')!.parties[0],
    chainProvider: { broadcastTxPoW: async () => undefined } as any,
  } as any;

  const methods = createHostMethods(context);
  return { methods, channels, handler: methods.get('totem_omniaIncrementCounter')! };
}

describeSqlite('OMN-077 operation replay against the real OperationStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-op-replay-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the committed result for an identical retry instead of throwing', async () => {
    const operations = new OperationStore(path.join(dir, 'operations.db'));
    const { handler, channels } = hostWith(operations);
    const request = { operationId: 'replay-1', channelId: 'channel-1', by: '1' };

    const first = await handler(request);
    // The unbound verifier threw here: TypeError reading 'get' of undefined.
    const second = await handler(request);

    expect(second).toEqual(first);
    expect(operations.get('replay-1')!.status).toBe('committed');
    // The replay must not re-execute the channel update.
    expect(channels.get('channel-1')!.currentSequence).toBe(first.sequence);
  });

  it('still rejects a reused operation id with different request data', async () => {
    const operations = new OperationStore(path.join(dir, 'operations.db'));
    const { handler } = hostWith(operations);

    await handler({ operationId: 'replay-2', channelId: 'channel-1', by: '1' });
    await expect(handler({ operationId: 'replay-2', channelId: 'channel-1', by: '2' }))
      .rejects.toThrow(/does not match the original request/);
  });

  it('replays from a different OperationStore instance on the same file', async () => {
    const dbPath = path.join(dir, 'operations.db');
    const firstStore = new OperationStore(dbPath);
    const first = await hostWith(firstStore).handler({
      operationId: 'replay-3', channelId: 'channel-1', by: '1',
    });
    firstStore.close();

    // A restarted host: new store object, same durable file.
    const secondStore = new OperationStore(dbPath);
    const replay = await hostWith(secondStore).handler({
      operationId: 'replay-3', channelId: 'channel-1', by: '1',
    });
    secondStore.close();

    expect(replay).toEqual(first);
  });
});
