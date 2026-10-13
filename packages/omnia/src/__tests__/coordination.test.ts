/**
 * RFC-035 Phase B (B0) — coordination transport, stores, and peer binding.
 */

import type { StorageAdapter } from '@totemsdk/core';
import type { OmniaMessage, OmniaPeer } from '../messaging-types.js';
import {
  createMemoryCoordinationStore,
  createStorageCoordinationStore,
} from '../coordination/proposals.js';
import { createOmniaCoordination } from '../coordination/index.js';

function fakePeer(pubkey: string) {
  const listeners = new Set<(m: OmniaMessage) => void>();
  const sent: OmniaMessage[] = [];
  const peer: OmniaPeer = {
    pubkey,
    channelId: 'c1',
    async sendMessage(m) {
      sent.push(m);
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    disconnect() {},
    onReconnecting() {
      return () => {};
    },
    onReconnected() {
      return () => {};
    },
  };
  return { peer, sent, emit: (m: OmniaMessage) => [...listeners].forEach((l) => l(m)) };
}

function fakeStorage(): StorageAdapter {
  const m = new Map<string, unknown>();
  return {
    async get<T>(k: string) {
      return (m.get(k) as T) ?? null;
    },
    async set<T>(k: string, v: T) {
      m.set(k, v);
    },
    async remove(k: string) {
      return m.delete(k);
    },
    async clear() {
      m.clear();
    },
    async keys() {
      return [...m.keys()];
    },
    async has(k: string) {
      return m.has(k);
    },
  };
}

const proposal = (over: Record<string, unknown> = {}) => ({
  correlationId: 'splice-1',
  kind: 'SPLICE_PROPOSAL' as const,
  channelId: 'c1',
  payload: { proposal: 'p' },
  state: 'pending' as const,
  createdAt: Date.now(),
  expiresAt: Date.now() + 1000,
  peers: ['peerB'],
  ...over,
});

describe.each([
  ['memory', () => createMemoryCoordinationStore()],
  ['storage', () => createStorageCoordinationStore(fakeStorage())],
])('coordination store (%s)', (_label, factory) => {
  it('round-trips proposals and state', async () => {
    const store = factory();
    await store.putProposal(proposal());
    const rec = await store.getProposal('splice-1');
    expect(rec?.kind).toBe('SPLICE_PROPOSAL');
    await store.setProposalState('splice-1', 'accepted');
    expect((await store.getProposal('splice-1'))?.state).toBe('accepted');
    expect(await store.deleteProposal('splice-1')).toBe(true);
    expect(await store.getProposal('splice-1')).toBeNull();
  });

  it('records acceptances idempotently', async () => {
    const store = factory();
    const msg = { type: 'SPLICE_ACCEPT', channelId: 'c1', correlationId: 'splice-1', nonce: 1, payload: {} } as OmniaMessage;
    expect(await store.recordAcceptance('splice-1', 'bob', msg)).toBe(true);
    expect(await store.recordAcceptance('splice-1', 'bob', msg)).toBe(false);
    const list = await store.listAcceptances('splice-1');
    expect(list).toHaveLength(1);
    expect(list[0].partyId).toBe('bob');
  });
});

describe('coordination store recovery (RFC-035 B5)', () => {
  it('reloads proposals + acceptances from a shared durable store (reconnect)', async () => {
    const adapter = fakeStorage();
    const store1 = createStorageCoordinationStore(adapter);
    await store1.putProposal(proposal());
    await store1.recordAcceptance('splice-1', 'bob', {
      type: 'SPLICE_ACCEPT',
      channelId: 'c1',
      correlationId: 'splice-1',
      nonce: 1,
      payload: {},
    } as OmniaMessage);

    // simulate a wallet restart: a fresh store over the same storage
    const store2 = createStorageCoordinationStore(adapter);
    expect((await store2.getProposal('splice-1'))?.kind).toBe('SPLICE_PROPOSAL');
    expect(await store2.listAcceptances('splice-1')).toHaveLength(1);
  });
});

describe('createOmniaCoordination', () => {
  it('routes a proposal to its handler and lets it reply', async () => {
    const { peer, emit, sent } = fakePeer('peerA');
    const seen: string[] = [];
    const coord = createOmniaCoordination({
      handlers: {
        SPLICE_PROPOSAL: async (ctx) => {
          seen.push(ctx.correlationId);
          await ctx.send('SPLICE_ACCEPT', { ok: true });
        },
      },
    });
    coord.bindPeer(peer);

    emit({ type: 'SPLICE_PROPOSAL', channelId: 'c1', correlationId: 'splice-1', nonce: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(seen).toEqual(['splice-1']);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('SPLICE_ACCEPT');
    expect(sent[0].correlationId).toBe('splice-1');
  });

  it('ignores non-coordination kinds', async () => {
    const { peer, emit, sent } = fakePeer('peerA');
    const handler = jest.fn();
    createOmniaCoordination({ handlers: { SPLICE_PROPOSAL: handler } }).bindPeer(peer);
    emit({ type: 'STATE_UPDATE', channelId: 'c1', nonce: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('replies ERROR when a handler throws', async () => {
    const { peer, emit, sent } = fakePeer('peerA');
    createOmniaCoordination({
      handlers: {
        SPLICE_PROPOSAL: async () => {
          throw new Error('nope');
        },
      },
    }).bindPeer(peer);
    emit({ type: 'SPLICE_PROPOSAL', channelId: 'c1', correlationId: 'splice-1', nonce: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(sent[0]?.type).toBe('ERROR');
  });

  it('persists and sends a proposal', async () => {
    const { peer, sent } = fakePeer('peerB');
    const coord = createOmniaCoordination();
    const msg = await coord.sendProposal({
      peer,
      kind: 'SPLICE_PROPOSAL',
      correlationId: 'splice-9',
      channelId: 'c1',
      payload: { a: 1 },
    });
    expect(msg.type).toBe('SPLICE_PROPOSAL');
    expect(sent).toHaveLength(1);
    const rec = await coord.store.getProposal('splice-9');
    expect(rec?.state).toBe('pending');
    expect(rec?.peers).toEqual(['peerB']);
  });
});
