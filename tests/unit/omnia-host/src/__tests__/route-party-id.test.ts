import { createHostMethods, type HostApiContext } from '../api/methods.js';
import { channelGraphEdges, InProcessRoutingProvider } from '../router/routing-provider.js';
import type { OmniaChannel } from '@totemsdk/omnia';

function channel(): OmniaChannel {
  return {
    channelId: 'vc-route-1',
    fundingTxId: '',
    fundingCoinId: '',
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + '11'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: '0x' + 'AA'.repeat(32), addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '0x' + 'BB'.repeat(32), addressIndex: 0 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 1,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'virtual',
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('omniaGetRoute node identifiers', () => {
  it('finds a real in-process route when given party IDs', async () => {
    const ch = channel();
    const routing = new InProcessRoutingProvider();
    routing.rebuild(channelGraphEdges([ch]));
    const context = {
      channels: new Map([[ch.channelId, ch]]),
      routing,
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      localParticipant: { partyId: 'alice', publicKeyDigest: '0x' + 'AA'.repeat(32), addressIndex: 0 },
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);
    const result = await methods.get('omnia/getRoute')!({
      fromPartyId: 'alice',
      toPartyId: 'bob',
      amount: '10',
      tokenId: '0x00',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('normalizes party IDs to public key digests before routing', async () => {
    const getRoute = jest.fn(() => ({ totalFees: 0n, hops: [] }));
    const context = {
      channels: new Map([['vc-route-1', channel()]]),
      routing: { getRoute },
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      localParticipant: { partyId: 'alice', publicKeyDigest: '0x' + 'AA'.repeat(32), addressIndex: 0 },
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);

    await methods.get('omnia/getRoute')!({
      fromPartyId: 'alice',
      toPartyId: 'bob',
      amount: '10',
      tokenId: '0x00',
    });

    expect(getRoute).toHaveBeenCalledWith(expect.objectContaining({
      from: '0x' + 'AA'.repeat(32),
      to: '0x' + 'BB'.repeat(32),
    }));
  });
});
