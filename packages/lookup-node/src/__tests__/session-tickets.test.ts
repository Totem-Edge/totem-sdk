/**
 * RFC-032-A: session ticket store + node identity.
 *
 * Covers mint/verify, expiry, per-ticket seq monotonicity (replay), request
 * budget, revocation, subject binding, and forged signatures.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionTicketDigest, authDigest, PROTOCOL_VERSION } from '@totemsdk/lookup-protocol';
import type { SessionTicket, LookupMessage } from '@totemsdk/lookup-protocol';
import {
  createPerAddressTreeKey,
  serializeTreeSignature,
  bytesToHex,
} from '@totemsdk/core';
import { NodeIdentity } from '../auth-verify.js';
import { SessionTicketStore, type SessionTicketPersistence } from '../ticket-store.js';
import { LookupNode } from '../node.js';
import { SqliteStore } from '../storage.js';
import { makeMockProvider, createTestPair, MessageBuffer } from './helpers.js';
import { makeRawSender } from '../handlers.js';

jest.setTimeout(60_000);

/** A real client identity (TreeKey) that signs auth envelopes. */
function makeClientIdentity(seedByte: number) {
  const treeKey = createPerAddressTreeKey(new Uint8Array(32).fill(seedByte), 0);
  const pk = bytesToHex(treeKey.getPublicKey()).toLowerCase();
  const signEnvelope = (msg: LookupMessage, expiresAt: number): LookupMessage => {
    const nonce = treeKey.getUses();
    const digest = authDigest(msg as never, nonce, expiresAt);
    const sig = serializeTreeSignature(treeKey.sign(digest));
    return {
      ...msg,
      auth: { rootPublicKey: pk, signature: bytesToHex(sig).toLowerCase(), nonce, expiresAt },
    };
  };
  return { treeKey, pk, signEnvelope };
}

function ticket(overrides: Partial<SessionTicket> = {}): SessionTicket {
  const base: Omit<SessionTicket, 'signature'> = {
    ticketId: 'tkt-1',
    subject: 'ab'.repeat(32),
    nodeId: 'node-x',
    issuedAt: 1000,
    expiresAt: 1000 + 60_000,
    maxRequests: 3,
  };
  return { ...base, signature: 'sig', ...overrides };
}

function persistent(store: SqliteStore): SessionTicketPersistence {
  return {
    get: (key) => store.kvGet(key),
    set: (key, value) => store.kvSet(key, value),
    remove: (key) => store.kvRemove(key),
    keys: (prefix) => store.kvKeys(prefix),
  };
}

describe('SessionTicketStore', () => {
  it('accepts strictly increasing seq and enforces the request budget', () => {
    const now = 1000;
    const store = new SessionTicketStore({ now: () => now });
    store.issue(ticket({ maxRequests: 3 }));

    expect(store.consume('tkt-1', 0)).toMatchObject({ ok: true, subject: 'ab'.repeat(32) });
    expect(store.consume('tkt-1', 1).ok).toBe(true);
    expect(store.consume('tkt-1', 2).ok).toBe(true);
    // budget exhausted
    expect(store.consume('tkt-1', 3)).toMatchObject({ ok: false, reason: 'exhausted' });
  });

  it('rejects replayed and non-monotonic seq', () => {
    const store = new SessionTicketStore({ now: () => 1000 });
    store.issue(ticket());
    expect(store.consume('tkt-1', 5).ok).toBe(true);
    expect(store.consume('tkt-1', 5)).toMatchObject({ ok: false, reason: 'replay' });
    expect(store.consume('tkt-1', 4)).toMatchObject({ ok: false, reason: 'replay' });
  });

  it('rejects an expired ticket', () => {
    let now = 1000;
    const store = new SessionTicketStore({ now: () => now });
    store.issue(ticket({ expiresAt: 2000 }));
    now = 3000;
    expect(store.consume('tkt-1', 0)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('rejects unknown and revoked tickets', () => {
    const store = new SessionTicketStore({ now: () => 1000 });
    expect(store.consume('nope', 0)).toMatchObject({ ok: false, reason: 'unknown' });
    store.issue(ticket());
    store.revoke('tkt-1');
    expect(store.consume('tkt-1', 0)).toMatchObject({ ok: false, reason: 'revoked' });
  });

  it('binds the ticket to its subject', () => {
    const store = new SessionTicketStore({ now: () => 1000 });
    store.issue(ticket({ subject: 'aa'.repeat(32) }));
    expect(store.consume('tkt-1', 0, 'bb'.repeat(32))).toMatchObject({ ok: false, reason: 'unknown' });
    expect(store.consume('tkt-1', 0, 'aa'.repeat(32)).ok).toBe(true);
  });
});

describe('SessionTicketStore durability (RFC-032-A T4)', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookup-tickets-'));
    file = path.join(dir, 'node.sqlite');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('preserves the seq watermark and request budget across reopen', () => {
    let db = new SqliteStore(file);
    let store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-x',
      persistence: persistent(db),
    });
    store.issue(ticket({ nodeId: 'node-x', maxRequests: 3 }));
    expect(store.consume('tkt-1', 0, 'ab'.repeat(32))).toMatchObject({ ok: true });
    db.close();

    db = new SqliteStore(file);
    store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-x',
      persistence: persistent(db),
    });
    expect(store.consume('tkt-1', 0)).toMatchObject({ ok: false, reason: 'replay' });
    expect(store.consume('tkt-1', 1).ok).toBe(true);
    expect(store.consume('tkt-1', 2).ok).toBe(true);
    expect(store.consume('tkt-1', 3)).toMatchObject({ ok: false, reason: 'exhausted' });
    db.close();
  });

  it('does not resurrect a revoked ticket across reopen', () => {
    let db = new SqliteStore(file);
    let store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-x',
      persistence: persistent(db),
    });
    store.issue(ticket({ nodeId: 'node-x' }));
    store.revoke('tkt-1');
    db.close();

    db = new SqliteStore(file);
    store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-x',
      persistence: persistent(db),
    });
    expect(store.consume('tkt-1', 0)).toMatchObject({ ok: false, reason: 'unknown' });
    db.close();
  });

  it('discards tickets minted by a different node and corrupt entries', () => {
    let db = new SqliteStore(file);
    let store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-x',
      persistence: persistent(db),
    });
    store.issue(ticket({ nodeId: 'other-node', ticketId: 'foreign' }));
    db.kvSet('totem_lookup_ticket:v1:broken', '{not-json');
    db.close();

    db = new SqliteStore(file);
    store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-x',
      persistence: persistent(db),
    });
    expect(store.consume('foreign', 0)).toMatchObject({ ok: false, reason: 'unknown' });
    expect(store.size()).toBe(0);
    expect(db.kvGet('totem_lookup_ticket:v1:broken')).toBeNull();
    db.close();
  });
});

describe('NodeIdentity ticket signing (RFC-032-A)', () => {
  it('mints a ticket whose signature verifies against the node identity', () => {
    const id = NodeIdentity.fromNodeId('node-1');
    const payload: Omit<SessionTicket, 'signature'> = {
      ticketId: 'tkt-1',
      subject: 'ab'.repeat(32),
      nodeId: 'node-1',
      issuedAt: 1000,
      expiresAt: 61_000,
      maxRequests: 1000,
    };
    const signature = id.signTicket(payload);
    const full: SessionTicket = { ...payload, signature };

    expect(id.verifyTicket(full)).toBe(true);
    // The digest is domain-separated (not a raw ticket hash).
    expect(sessionTicketDigest(payload)).toBeInstanceOf(Uint8Array);
    expect(sessionTicketDigest(payload).length).toBe(32);
  });

  it('matches the cross-language digest vector', () => {
    const payload: Omit<SessionTicket, 'signature'> = {
      ticketId: 'tkt-vector',
      subject: 'client-pub',
      nodeId: 'node-test',
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_000_060_000,
      maxRequests: 3,
    };
    expect(bytesToHex(sessionTicketDigest(payload)).toLowerCase()).toBe(
      '641892248458549b8011b08725ccea56c5147ddc05e471fdb80902fbb39a1426',
    );
  });

  it('rejects a ticket signed by a different node identity', () => {
    const signer = NodeIdentity.fromNodeId('node-A');
    const other = NodeIdentity.fromNodeId('node-B');
    const payload: Omit<SessionTicket, 'signature'> = {
      ticketId: 'tkt-1',
      subject: 'ab'.repeat(32),
      nodeId: 'node-A',
      issuedAt: 1000,
      expiresAt: 61_000,
      maxRequests: 1000,
    };
    const signature = signer.signTicket(payload);
    expect(other.verifyTicket({ ...payload, signature })).toBe(false);
  });

  it('rejects a tampered ticket (subject changed after signing)', () => {
    const id = NodeIdentity.fromNodeId('node-1');
    const payload: Omit<SessionTicket, 'signature'> = {
      ticketId: 'tkt-1',
      subject: 'ab'.repeat(32),
      nodeId: 'node-1',
      issuedAt: 1000,
      expiresAt: 61_000,
      maxRequests: 1000,
    };
    const signature = id.signTicket(payload);
    expect(id.verifyTicket({ ...payload, subject: 'cd'.repeat(32), signature })).toBe(false);
  });

  it('consumes one identity use per ticket (monotonic)', () => {
    const id = NodeIdentity.fromNodeId('node-1');
    const t: Omit<SessionTicket, 'signature'> = {
      ticketId: 'tkt-1', subject: 'ab'.repeat(32), nodeId: 'node-1',
      issuedAt: 0, expiresAt: 1, maxRequests: 1,
    };
    expect(id.uses).toBe(0);
    id.signTicket(t);
    id.signTicket({ ...t, ticketId: 'tkt-2' });
    expect(id.uses).toBe(2);
  });
});

// ── Node end-to-end: SESSION_OPEN → ticket → ticket-authenticated request ──

describe('lookup-node session tickets end-to-end', () => {
  function makeNode() {
    return new LookupNode({ provider: makeMockProvider(), nodeId: 'node-e2e' });
  }

  async function openSession(node: LookupNode, client: ReturnType<typeof makeClientIdentity>) {
    const [clientTransport, serverTransport] = createTestPair();
    const buffer = new MessageBuffer(clientTransport);
    node.handleConnection(serverTransport);
    const send = makeRawSender(clientTransport);
    const open = client.signEnvelope(
      { type: 'SESSION_OPEN', version: PROTOCOL_VERSION, id: 'so-1', payload: {} } as LookupMessage,
      Date.now() + 30_000,
    );
    send(open);
    const resp = await buffer.waitFor((m) => m.id === 'so-1', 15_000);
    return { buffer, send, ticket: (resp.payload as unknown as SessionTicket) };
  }

  it('mints a ticket after a valid SESSION_OPEN', async () => {
    const node = makeNode();
    await node.start();
    const client = makeClientIdentity(0x11);
    const { ticket } = await openSession(node, client);
    expect(ticket.ticketId).toMatch(/^tkt-/);
    expect(ticket.subject).toBe(client.pk);
    expect(ticket.nodeId).toBe('node-e2e');
    expect(node.nodeIdentity.verifyTicket(ticket)).toBe(true);
    await node.stop();
  });

  it('authenticates a GET_COINS with a session ticket (no per-message WOTS)', async () => {
    const node = makeNode();
    await node.start();
    const client = makeClientIdentity(0x22);
    const { buffer, send, ticket } = await openSession(node, client);

    send({ type: 'GET_COINS', version: PROTOCOL_VERSION, id: 'gc-1', ticket: { ticketId: ticket.ticketId, seq: 0 }, payload: { address: 'Mx1' } } as LookupMessage);
    const resp = await buffer.waitFor((m) => m.id === 'gc-1', 15_000);
    expect(resp.type).toBe('COINS_RESPONSE');
    await node.stop();
  });

  it('rejects a ticket-only request for an auth-required type (BROADCAST_TXPOW)', async () => {
    const node = makeNode();
    await node.start();
    const client = makeClientIdentity(0x33);
    const { buffer, send, ticket } = await openSession(node, client);

    send({ type: 'BROADCAST_TXPOW', version: PROTOCOL_VERSION, id: 'bt-1', ticket: { ticketId: ticket.ticketId, seq: 0 }, payload: { txpowHex: '0xdead' } } as LookupMessage);
    const resp = await buffer.waitFor((m) => m.id === 'bt-1', 15_000);
    expect(resp.type).toBe('ERROR');
    expect((resp.payload as { code: string }).code).toBe('AUTH_REQUIRED');
    await node.stop();
  });

  it('rejects a replayed ticket seq', async () => {
    const node = makeNode();
    await node.start();
    const client = makeClientIdentity(0x44);
    const { buffer, send, ticket } = await openSession(node, client);

    const ref = { ticketId: ticket.ticketId, seq: 7 };
    send({ type: 'GET_COINS', version: PROTOCOL_VERSION, id: 'a', ticket: ref, payload: { address: 'Mx1' } } as LookupMessage);
    await buffer.waitFor((m) => m.id === 'a', 15_000);
    send({ type: 'GET_COINS', version: PROTOCOL_VERSION, id: 'b', ticket: ref, payload: { address: 'Mx1' } } as LookupMessage);
    const resp = await buffer.waitFor((m) => m.id === 'b', 15_000);
    expect(resp.type).toBe('ERROR');
    expect((resp.payload as { code: string }).code).toBe('AUTH_REPLAY');
    await node.stop();
  });

  it('keeps a minted ticket usable across a node restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookup-node-restart-'));
    const dbPath = path.join(dir, 'node.sqlite');
    const config = { provider: makeMockProvider(), nodeId: 'node-restart', sqlite: { dbPath } };

    const first = new LookupNode(config);
    await first.start();
    const client = makeClientIdentity(0x55);
    const { ticket } = await openSession(first, client);
    await first.stop();

    const second = new LookupNode(config);
    await second.start();
    const [clientTransport, serverTransport] = createTestPair();
    const buffer = new MessageBuffer(clientTransport);
    second.handleConnection(serverTransport);
    const send = makeRawSender(clientTransport);

    const ref = { ticketId: ticket.ticketId, seq: 0 };
    send({ type: 'GET_COINS', version: PROTOCOL_VERSION, id: 'after-restart', ticket: ref, payload: { address: 'Mx1' } } as LookupMessage);
    const resp = await buffer.waitFor((m) => m.id === 'after-restart', 15_000);
    expect(resp.type).toBe('COINS_RESPONSE');

    send({ type: 'GET_COINS', version: PROTOCOL_VERSION, id: 'replay-after-restart', ticket: ref, payload: { address: 'Mx1' } } as LookupMessage);
    const replay = await buffer.waitFor((m) => m.id === 'replay-after-restart', 15_000);
    expect(replay.type).toBe('ERROR');
    expect((replay.payload as { code: string }).code).toBe('AUTH_REPLAY');

    await second.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
