/**
 * Concurrent channel mutations must serialize per channel. Before the lock,
 * five simultaneous pay calls all read the same sequence and only one
 * transition applied while every call reported success.
 */

import os from 'node:os';
import { DefaultEltooPaymentProgram, type OmniaChannel } from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-pay-concurrency-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;

describe('concurrent host payments', () => {
  it('applies every concurrent payment instead of collapsing to one', async () => {
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
    const context = {
      channels: new Map([[channel.channelId, channel]]),
      operations: {
        get: () => undefined,
        create: (record: { operationId: string }) => ({ ...record, status: 'pending' }),
        transition: (operationId: string) => ({ operationId, status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider: {},
      localParticipant: { partyId: 'alice', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
      custodyMode: 'self',
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const pay = methods.get('omnia/pay')!;
    const results = await Promise.all(
      [10n, 20n, 30n, 40n, 50n].map((amount, index) =>
        pay({ operationId: `concurrent-${index}`, channelId: channel.channelId, amount: amount.toString() })),
    );

    for (const result of results) {
      expect(result).toMatchObject({ success: true, channelId: channel.channelId });
    }
    const updated = context.channels.get(channel.channelId)!;
    expect(updated.currentSequence).toBe(6);
    expect(updated.balances).toEqual({ alice: 450n, bob: 550n });
    expect(new Set(results.map((r) => (r as { sequence: number }).sequence))).toEqual(new Set([2, 3, 4, 5, 6]));
  });
});
