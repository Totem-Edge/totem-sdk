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

  it('fails closed on execution-port shapes that diverged from the live API', () => {
    expect(() => ports.router.createChannelGraph()).toThrow(/not wired/);
    expect(() => ports.router.addChannel({} as never, {} as never)).toThrow(/not wired/);
    expect(() => ports.factory.reallocate({} as never, {})).toThrow(/not wired/);
    expect(() => ports.splice.acceptSplice({} as never)).toThrow(/not wired/);
    expect(() => ports.vtxo.markExiting({} as never, 'v1')).toThrow(/not wired/);
  });
});
