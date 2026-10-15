/**
 * omnia-pool live execution ports (RFC-035 B5 / RFC-038).
 */

import type { ChannelSigner } from '@totemsdk/omnia';
import { createOmniaPoolLivePorts } from '../live-ports.js';

const signer = { publicKeyDigest: '0x' + 'aa'.repeat(32), sign: async () => new Uint8Array(64) } as ChannelSigner;

describe('createOmniaPoolLivePorts', () => {
  const ports = createOmniaPoolLivePorts({ signer, leaseProvider: {} as never });

  it('mints a VTXO through the vtxo port', async () => {
    const pool = await ports.vtxo.createPool({
      poolId: 'p1',
      operator: '0x' + '11'.repeat(32),
      tokenId: '0x00',
      totalCapacity: '1000',
      nonce: 'n1',
    });
    expect(pool.poolId).toBeTruthy();

    const result = await ports.vtxo.mintVtxo(pool, { owner: '0x' + '22'.repeat(32), amount: 100n, nonce: 'n2' });
    expect(result.vtxo.amount).toBe(100n);
    expect(result.vtxo.poolId).toBe(pool.poolId);
  });

  it('delegates the router port to @totemsdk/omnia-router', () => {
    const graph = ports.router.createChannelGraph();
    ports.router.addChannel(graph, {
      channelId: 'c1',
      from: 'alice',
      to: 'bob',
      tokenId: '0x00',
      availableBalance: 1000n,
      htlcCapacity: 1000n,
      feeRate: 0n,
    });
    const route = ports.router.findRoute(graph, 'alice', 'bob', 100n, '0x00');
    expect(route).toBeDefined();
    expect(route!.hops.length).toBeGreaterThanOrEqual(1);
  });
});
