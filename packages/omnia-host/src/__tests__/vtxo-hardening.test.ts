/** H8 — concurrent VTXO mutation guard at the host boundary. */
import { createHostMethods, type HostApiContext } from '../api/methods.js';

describe('VTXO host hardening', () => {
  it('allows only one of two concurrent transfers of the same VTXO', async () => {
    const context = {
      channels: new Map(),
      vtxoPools: new Map(),
      vtxos: new Map(),
      vtxoReceipts: new Map(),
      preparedVtxoReceipts: new Map(),
      coordinator: true,
      localParticipant: { partyId: 'operator', publicKeyDigest: '0x' + 'ab'.repeat(32), addressIndex: 0 },
      custodyMode: 'self',
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);
    const created = await methods.get('omnia/createVtxoPool')!({
      poolId: 'h8-pool', tokenId: '0x00', totalCapacity: '1000000', nonce: 'h8',
    }) as any;
    const minted = await methods.get('omnia/mintVtxo')!({
      poolId: created.pool.poolId, owner: 'alice', amount: '100000', nonce: 'h8-mint',
    }) as any;

    const results = await Promise.allSettled([
      methods.get('omnia/transferVtxo')!({ vtxoId: minted.vtxo.vtxoId, recipient: 'bob', amount: '1000', nonce: 'h8-a', unsafeLedgerTransfer: true }),
      methods.get('omnia/transferVtxo')!({ vtxoId: minted.vtxo.vtxoId, recipient: 'carol', amount: '1000', nonce: 'h8-b', unsafeLedgerTransfer: true }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});
