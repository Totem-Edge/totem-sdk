/**
 * P2PQuorumLeaseProvider tests.
 *
 * Covers:
 *   - Successful reservation with quorum attestation
 *   - Quorum not reached → local burn + QuorumUnavailableError
 *   - Peer conflict → local burn + QuorumConflictError
 *   - Commit/burn broadcast to peers
 *   - Watermark publish + journal sync (advance + conflict)
 *   - Certificate verification
 */

import { P2PQuorumLeaseProvider } from '../quorum';
import { LocalLeaseProvider } from '../local';
import { QuorumUnavailableError, QuorumConflictError } from '../errors';
import type { QuorumPeer, SigningIndices } from '../types';

class MemoryStorage {
  private store = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
  async keys(): Promise<string[]> {
    return [...this.store.keys()];
  }
  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

interface PeerState {
  reserved: Map<string, SigningIndices>;
  committed: string[];
  burned: string[];
  watermarks: Map<string, { addressCursor: number; l1Cursor: number; l2Cursor: number }>;
  failReserve?: boolean;
  unreachable?: boolean;
}

function makePeer(peerId: string, state: PeerState): QuorumPeer {
  return {
    peerId,
    async request(message, _timeoutMs) {
      if (state.unreachable) throw new Error('peer unreachable');
      switch (message.type) {
        case 'LEASE_RESERVE': {
          if (state.failReserve) {
            return { type: 'ERROR', payload: { message: 'slot taken' } };
          }
          const payload = message.payload as {
            treeId: string;
            indices: SigningIndices;
            ttlMs?: number;
          };
          const key = `${payload.treeId}:${payload.indices.addressIndex}:${payload.indices.l1}:${payload.indices.l2}`;
          if (state.reserved.has(key)) {
            return { type: 'ERROR', payload: { message: 'slot taken' } };
          }
          state.reserved.set(key, payload.indices);
          return {
            type: 'LEASE_RESPONSE',
            payload: {
              action: 'reserved',
              reservation: {
                reservationId: `peer-${peerId}-${key}`,
                indices: payload.indices,
                expiresAt: Date.now() + (payload.ttlMs ?? 120_000),
              },
            },
          };
        }
        case 'LEASE_COMMIT': {
          state.committed.push(String(message.payload.reservationId));
          return { type: 'LEASE_RESPONSE', payload: { action: 'committed' } };
        }
        case 'LEASE_BURN': {
          state.burned.push(String(message.payload.reservationId));
          return { type: 'LEASE_RESPONSE', payload: { action: 'burned' } };
        }
        case 'LEASE_WATERMARK': {
          const payload = message.payload as {
            treeId: string;
            query?: boolean;
            addressCursor?: number;
            l1Cursor?: number;
            l2Cursor?: number;
          };
          if (payload.query) {
            const wm = state.watermarks.get(payload.treeId);
            if (!wm) return { type: 'ERROR', payload: { message: 'no watermark' } };
            return { type: 'LEASE_RESPONSE', payload: { ...wm } };
          }
          state.watermarks.set(payload.treeId, {
            addressCursor: payload.addressCursor!,
            l1Cursor: payload.l1Cursor!,
            l2Cursor: payload.l2Cursor!,
          });
          return { type: 'LEASE_RESPONSE', payload: { action: 'published' } };
        }
        default:
          return { type: 'ERROR', payload: { message: 'unknown' } };
      }
    },
  };
}

function makeLocal() {
  return new LocalLeaseProvider(new MemoryStorage());
}

describe('P2PQuorumLeaseProvider', () => {
  it('reserves with quorum attestation and returns a certificate', async () => {
    const local = makeLocal();
    const peerState: PeerState = { reserved: new Map(), committed: [], burned: [], watermarks: new Map() };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet', purpose: 'test' });

    expect(reservation.indices).toEqual({ addressIndex: 0, l1: 0, l2: 0 });
    expect(reservation.certificate).toBeDefined();
    expect(reservation.certificate!.attestations).toHaveLength(1);
    expect(reservation.certificate!.attestations![0].peerId).toBe('peer-a');
    expect(reservation.certificate!.issuedBy).toBe('p2p-quorum');

    // Local watermark advanced
    const wm = await local.getLocalWatermark('wallet');
    expect(wm.unavailableCount).toBe(1);
  });

  it('burns locally and throws QuorumUnavailableError when quorum is not reached', async () => {
    const local = makeLocal();
    const peerState: PeerState = {
      reserved: new Map(),
      committed: [],
      burned: [],
      watermarks: new Map(),
      unreachable: true,
    };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    await expect(provider.reserveKeyUse({ treeId: 'wallet' })).rejects.toThrow(QuorumUnavailableError);

    // Slot burned — never reusable
    const wm = await local.getLocalWatermark('wallet');
    expect(wm.unavailableCount).toBe(1);
    const journal = local.getJournal().getByTree('wallet');
    expect(journal[journal.length - 1].status).toBe('burned');
  });

  it('burns locally and throws QuorumConflictError when a peer holds the slot', async () => {
    const local = makeLocal();
    const peerState: PeerState = {
      reserved: new Map([['wallet:0:0:0', { addressIndex: 0, l1: 0, l2: 0 }]]),
      committed: [],
      burned: [],
      watermarks: new Map(),
    };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    await expect(provider.reserveKeyUse({ treeId: 'wallet' })).rejects.toThrow(QuorumConflictError);

    const wm = await local.getLocalWatermark('wallet');
    expect(wm.unavailableCount).toBe(1);
  });

  it('requires minAttestations from distinct peers', async () => {
    const local = makeLocal();
    const peerStateA: PeerState = { reserved: new Map(), committed: [], burned: [], watermarks: new Map() };
    const peerStateB: PeerState = {
      reserved: new Map(),
      committed: [],
      burned: [],
      watermarks: new Map(),
      unreachable: true,
    };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerStateA), makePeer('peer-b', peerStateB)],
      minAttestations: 2,
    });

    await expect(provider.reserveKeyUse({ treeId: 'wallet' })).rejects.toThrow(QuorumUnavailableError);
  });

  it('commits locally and broadcasts to peers', async () => {
    const local = makeLocal();
    const peerState: PeerState = { reserved: new Map(), committed: [], burned: [], watermarks: new Map() };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.commitKeyUse(reservation.reservationId, '0xTX1');

    expect(peerState.committed).toContain(reservation.reservationId);
    const wm = await local.getLocalWatermark('wallet');
    expect(wm.unavailableCount).toBe(1);
  });

  it('burns locally and broadcasts to peers', async () => {
    const local = makeLocal();
    const peerState: PeerState = { reserved: new Map(), committed: [], burned: [], watermarks: new Map() };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.burnReservation(reservation.reservationId, 'test burn');

    expect(peerState.burned).toContain(reservation.reservationId);
  });

  it('publishes the local watermark to peers', async () => {
    const local = makeLocal();
    const peerState: PeerState = { reserved: new Map(), committed: [], burned: [], watermarks: new Map() };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.publishWatermark('wallet');

    const peerWm = peerState.watermarks.get('wallet');
    expect(peerWm).toBeDefined();
    expect(peerWm!.addressCursor).toBe(0);
    expect(peerWm!.l1Cursor).toBe(0);
    expect(peerWm!.l2Cursor).toBe(1);
  });

  it('syncLeaseJournal advances to a remote watermark ahead of local', async () => {
    const local = makeLocal();
    const peerState: PeerState = {
      reserved: new Map(),
      committed: [],
      burned: [],
      watermarks: new Map([['wallet', { addressCursor: 0, l1Cursor: 0, l2Cursor: 5 }]]),
    };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    // Create the local tree first (reserve advances local to l2=1)
    await provider.reserveKeyUse({ treeId: 'wallet' });

    const result = await provider.syncLeaseJournal();

    expect(result.synced).toBe(true);
    expect(result.advancedTo).toEqual({ addressIndex: 0, l1: 0, l2: 5 });
    const wm = await local.getLocalWatermark('wallet');
    expect(wm.l2Cursor).toBe(5);
  });

  it('syncLeaseJournal records a conflict when remote is behind local', async () => {
    const local = makeLocal();
    const peerState: PeerState = {
      reserved: new Map(),
      committed: [],
      burned: [],
      watermarks: new Map([['wallet', { addressCursor: 0, l1Cursor: 0, l2Cursor: 0 }]]),
    };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    await provider.reserveKeyUse({ treeId: 'wallet' });
    const result = await provider.syncLeaseJournal();

    expect(result.synced).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].treeId).toBe('wallet');
  });

  it('verifies certificates with sufficient fresh attestations', async () => {
    const local = makeLocal();
    const peerState: PeerState = { reserved: new Map(), committed: [], burned: [], watermarks: new Map() };
    const provider = new P2PQuorumLeaseProvider({
      local,
      peers: [makePeer('peer-a', peerState)],
      minAttestations: 1,
    });

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    expect(await provider.verifyLeaseCertificate(reservation.certificate)).toBe(true);

    const expired = {
      ...reservation.certificate!,
      expiresAt: Date.now() - 1,
      attestations: reservation.certificate!.attestations!.map((a) => ({
        ...a,
        expiresAt: Date.now() - 1,
      })),
    };
    expect(await provider.verifyLeaseCertificate(expired)).toBe(false);
    expect(await provider.verifyLeaseCertificate(undefined)).toBe(false);
  });
});
