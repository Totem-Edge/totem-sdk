/**
 * Deterministic ticket-store property test.
 *
 * Exercises random issue/consume sequences across SQLite reopen. The expected
 * result is checked against a small model: exhausted precedes replay, and the
 * last accepted seq/request count must survive a reopen.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SessionTicketStore, type SessionTicketPersistence } from '../ticket-store';
import { SqliteStore } from '../storage';
import type { SessionTicket } from '@totemsdk/lookup-protocol';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function persistence(db: SqliteStore): SessionTicketPersistence {
  return {
    get: (key) => db.kvGet(key),
    set: (key, value) => db.kvSet(key, value),
    remove: (key) => db.kvRemove(key),
    keys: (prefix) => db.kvKeys(prefix),
  };
}

function ticket(id: string, maxRequests: number): SessionTicket {
  return {
    ticketId: id,
    subject: 'ab'.repeat(32),
    nodeId: 'node-fuzz',
    issuedAt: 0,
    expiresAt: 2_000_000_000_000,
    maxRequests,
    signature: 'sig',
  };
}

describe('session ticket store sequence properties', () => {
  it('matches the seq/budget model across 50 random tickets and reopens', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookup-ticket-fuzz-'));
    const file = path.join(dir, 'state.sqlite');
    const rng = mulberry32(0x71c7e7);
    let db = new SqliteStore(file);
    let store = new SessionTicketStore({
      now: () => 1000,
      nodeId: 'node-fuzz',
      persistence: persistence(db),
    });

    for (let round = 0; round < 50; round += 1) {
      const id = `tkt-${round}`;
      const maxRequests = int(rng, 1, 8);
      store.issue(ticket(id, maxRequests));

      let lastSeq = -1;
      let requests = 0;
      for (let step = 0; step < 20; step += 1) {
        if (step > 0 && step % 5 === 0) {
          db.close();
          db = new SqliteStore(file);
          store = new SessionTicketStore({
            now: () => 1000,
            nodeId: 'node-fuzz',
            persistence: persistence(db),
          });
        }

        const seq = int(rng, 0, 15);
        const verdict = store.consume(id, seq);
        let expected: 'ok' | 'exhausted' | 'replay';
        if (requests >= maxRequests) expected = 'exhausted';
        else if (seq <= lastSeq) expected = 'replay';
        else expected = 'ok';

        if (expected === 'ok') {
          expect(verdict).toMatchObject({ ok: true, subject: 'ab'.repeat(32) });
          lastSeq = seq;
          requests += 1;
        } else {
          expect(verdict).toMatchObject({ ok: false, reason: expected });
        }
      }
    }

    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not resurrect revoked or expired tickets after reopen', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookup-ticket-fuzz-'));
    const file = path.join(dir, 'state.sqlite');
    let now = 1000;
    let db = new SqliteStore(file);
    let store = new SessionTicketStore({
      now: () => now,
      nodeId: 'node-fuzz',
      persistence: persistence(db),
    });

    store.issue(ticket('revoked', 5));
    store.revoke('revoked');
    store.issue({ ...ticket('expired', 5), expiresAt: 1500 });
    now = 2000;
    db.close();

    db = new SqliteStore(file);
    store = new SessionTicketStore({
      now: () => now,
      nodeId: 'node-fuzz',
      persistence: persistence(db),
    });
    expect(store.consume('revoked', 0)).toMatchObject({ ok: false, reason: 'unknown' });
    expect(store.consume('expired', 0)).toMatchObject({ ok: false, reason: 'unknown' });
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
