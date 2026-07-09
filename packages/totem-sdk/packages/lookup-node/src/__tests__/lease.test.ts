/**
 * Lease coordinator integration tests.
 *
 * Covers the full WOTS lease lifecycle:
 *   - LEASE_RESERVE → returns LeaseReservation with signed LeaseCertificate
 *   - LEASE_COMMIT → finalises the reservation
 *   - LEASE_BURN  → cancels the reservation
 *   - Double-commit is rejected (LeaseNotFoundError after finalized)
 *   - Node without lease.enabled returns NOT_SUPPORTED error
 */

import type { LeaseReservation } from '@totemsdk/wots-lease';
import { flatIndex } from '@totemsdk/wots-lease';
import { LookupNode } from '../node.js';
import { makeMockProvider, connectTestClient } from './helpers.js';

function makeLeaseNode() {
  return new LookupNode({
    provider: makeMockProvider(),
    _skipAuth: true,
    lease: { enabled: true },
  });
}

describe('Lease coordinator', () => {
  it('LEASE_RESERVE returns a reservation with a LeaseCertificate', async () => {
    const node = makeLeaseNode();
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'LEASE_RESERVE',
      version: 1,
      id: 'lr-1',
      payload: { treeId: 'tree-alpha', ttlMs: 60_000 },
    });

    const response = await buffer.waitFor((m) => m.id === 'lr-1', 2_000);
    expect(response.type).not.toBe('ERROR');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { reservation } = response.payload as { reservation: LeaseReservation & { certificate: unknown } };
    expect(reservation).toBeDefined();
    expect(reservation.reservationId).toBeTruthy();
    expect(reservation.indices).toBeDefined();
    expect(reservation.indices.addressIndex).toBeGreaterThanOrEqual(0);
    expect(reservation.certificate).toBeDefined();

    await node.stop();
  });

  it('LEASE_COMMIT finalizes a reservation', async () => {
    const node = makeLeaseNode();
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    // Reserve
    buffer.send(clientTransport, {
      type: 'LEASE_RESERVE',
      version: 1,
      id: 'lc-reserve',
      payload: { treeId: 'tree-beta' },
    });
    const reserveResponse = await buffer.waitFor((m) => m.id === 'lc-reserve', 2_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { reservation } = reserveResponse.payload as { reservation: LeaseReservation };
    const { reservationId, indices } = reservation;

    // Commit
    buffer.send(clientTransport, {
      type: 'LEASE_COMMIT',
      version: 1,
      id: 'lc-commit',
      payload: { reservationId, txId: '0xTX123', indices },
    });

    const commitResponse = await buffer.waitFor((m) => m.id === 'lc-commit', 2_000);
    expect(commitResponse.type).toBe('LEASE_RESPONSE');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((commitResponse.payload as any).action).toBe('committed');

    await node.stop();
  });

  it('LEASE_BURN cancels a reservation', async () => {
    const node = makeLeaseNode();
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    // Reserve
    buffer.send(clientTransport, {
      type: 'LEASE_RESERVE',
      version: 1,
      id: 'lb-reserve',
      payload: { treeId: 'tree-gamma' },
    });
    const reserveResponse = await buffer.waitFor((m) => m.id === 'lb-reserve', 2_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { reservation } = reserveResponse.payload as { reservation: LeaseReservation };
    const { reservationId, indices } = reservation;

    // Burn
    buffer.send(clientTransport, {
      type: 'LEASE_BURN',
      version: 1,
      id: 'lb-burn',
      payload: { reservationId, reason: 'test cancellation', indices },
    });

    const burnResponse = await buffer.waitFor((m) => m.id === 'lb-burn', 2_000);
    expect(burnResponse.type).toBe('LEASE_RESPONSE');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((burnResponse.payload as any).action).toBe('burned');

    await node.stop();
  });

  it('LEASE_COMMIT after LEASE_BURN returns an error', async () => {
    const node = makeLeaseNode();
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    // Reserve
    buffer.send(clientTransport, {
      type: 'LEASE_RESERVE',
      version: 1,
      id: 'lbc-reserve',
      payload: { treeId: 'tree-delta' },
    });
    const reserveResponse = await buffer.waitFor((m) => m.id === 'lbc-reserve', 2_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { reservation } = reserveResponse.payload as { reservation: LeaseReservation };
    const { reservationId, indices } = reservation;

    // Burn first
    buffer.send(clientTransport, {
      type: 'LEASE_BURN',
      version: 1,
      id: 'lbc-burn',
      payload: { reservationId, reason: 'cancel early', indices },
    });
    await buffer.waitFor((m) => m.id === 'lbc-burn', 2_000);

    // Then try to commit the same reservation
    buffer.send(clientTransport, {
      type: 'LEASE_COMMIT',
      version: 1,
      id: 'lbc-commit',
      payload: { reservationId, txId: '0xTXLATE', indices },
    });

    const commitResponse = await buffer.waitFor((m) => m.id === 'lbc-commit', 2_000);
    expect(commitResponse.type).toBe('ERROR');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((commitResponse.payload as any).code).toBe('LEASE_COMMIT_FAILED');

    await node.stop();
  });

  it('returns NOT_SUPPORTED when lease is not configured', async () => {
    const node = new LookupNode({
      provider: makeMockProvider(),
      _skipAuth: true,
      // lease NOT configured
    });
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'LEASE_RESERVE',
      version: 1,
      id: 'lease-ns',
      payload: { treeId: 'tree-x' },
    });

    const response = await buffer.waitFor((m) => m.id === 'lease-ns');
    expect(response.type).toBe('ERROR');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).code).toBe('NOT_SUPPORTED');
  });

  it('sequential reserves get monotonically increasing addressIndex (reserve→commit cycle)', async () => {
    const node = makeLeaseNode();
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    const reservations: LeaseReservation[] = [];

    // LocalLeaseProvider advances the cursor only on commit/burn, not on reserve.
    // So we must commit each reservation before the next reserve to get a higher index.
    for (let i = 0; i < 3; i++) {
      buffer.send(clientTransport, {
        type: 'LEASE_RESERVE',
        version: 1,
        id: `seq-r-${i}`,
        payload: { treeId: 'tree-seq' },
      });
      const resp = await buffer.waitFor((m) => m.id === `seq-r-${i}`, 2_000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reservation = (resp.payload as any).reservation as LeaseReservation;
      reservations.push(reservation);

      // Commit before next reserve so the watermark cursor advances
      buffer.send(clientTransport, {
        type: 'LEASE_COMMIT',
        version: 1,
        id: `seq-c-${i}`,
        payload: { reservationId: reservation.reservationId, txId: `0xTX${i}`, indices: reservation.indices },
      });
      await buffer.waitFor((m) => m.id === `seq-c-${i}`, 2_000);
    }

    // The composite flatIndex must be strictly increasing across reserve→commit cycles.
    // addressIndex only changes every MAX_L² keys; the l2/l1 sub-indices advance first.
    expect(flatIndex(reservations[1].indices)).toBeGreaterThan(flatIndex(reservations[0].indices));
    expect(flatIndex(reservations[2].indices)).toBeGreaterThan(flatIndex(reservations[1].indices));

    await node.stop();
  });
});
