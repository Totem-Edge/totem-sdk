/**
 * Tests for the shared relational primitives on `SqliteStore` (RFC-007 §4.2):
 * `transactionalSync` (atomic multi-statement batches) and the generalized
 * `transitionAndEnqueue` (revision-CAS update + outbox enqueue in one commit).
 * Runs against native better-sqlite3; skipped if the binding is unavailable.
 */

import Database from 'better-sqlite3';

import { SqliteStore } from '../adapters/sqlite-store.js';

let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
}

const makeStore = (): SqliteStore => new SqliteStore(':memory:', { createKvTable: false });

const SCHEMA = `
  CREATE TABLE orders (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    revision INTEGER NOT NULL
  );
  CREATE TABLE outbox (
    message_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );
`;

const skip = sqliteAvailable ? describe : describe.skip;

skip('SqliteStore transactionalSync', () => {
  it('commits multiple statements atomically', () => {
    const store = makeStore();
    store.transactionalSync((tx) => {
      tx.exec(SCHEMA);
      tx.run('INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)', 'a', 'NEW');
      tx.run('INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)', 'b', 'NEW');
    });
    const rows = store.transactionalSync((tx) => tx.all<{ order_id: string }>('SELECT order_id FROM orders'));
    expect(rows.map((r) => r.order_id).sort()).toEqual(['a', 'b']);
  });

  it('rolls back the whole batch when the callback throws', () => {
    const store = makeStore();
    store.transactionalSync((tx) => tx.exec(SCHEMA));
    expect(() =>
      store.transactionalSync((tx) => {
        tx.run('INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)', 'kept', 'NEW');
        throw new Error('boom');
      }),
    ).toThrow('boom');
    const rows = store.transactionalSync((tx) => tx.all<{ order_id: string }>('SELECT order_id FROM orders'));
    expect(rows).toEqual([]);
  });

  it('surfaces run/get/all/cas against consumer rows', () => {
    const store = makeStore();
    store.transactionalSync((tx) => {
      tx.exec(SCHEMA);
      tx.cas(`INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)`, 'c', 'NEW');
    });
    store.transactionalSync((tx) => {
      const row = tx.get<{ revision: number }>('SELECT revision FROM orders WHERE order_id = ?', 'c');
      expect(row?.revision).toBe(1);
    });
    expect(() =>
      store.transactionalSync((tx) => tx.cas('UPDATE orders SET status = ? WHERE order_id = ?', 'X', 'missing')),
    ).toThrow(/CAS/);
  });
});

skip('SqliteStore transitionAndEnqueue', () => {
  const commit = (store: SqliteStore): void => {
    store.transactionalSync((tx) => tx.exec(SCHEMA));
  };

  it('commits the CAS update and outbox enqueue together', async () => {
    const store = makeStore();
    commit(store);
    store.transactionalSync((tx) =>
      tx.run('INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)', 'o1', 'PENDING'),
    );

    const applied = await store.transitionAndEnqueue({
      casUpdateSql:
        'UPDATE orders SET status = ?, revision = ? WHERE order_id = ? AND revision = ?',
      casUpdateParams: ['CONFIRMED', 2, 'o1', 1],
      enqueueSql: 'INSERT OR REPLACE INTO outbox (message_id, payload) VALUES (?, ?)',
      enqueueRows: [['m1', '{"kind":"confirmed"}']],
    });
    expect(applied).toBe(true);

    const order = store.transactionalSync((tx) =>
      tx.get<{ status: string; revision: number }>('SELECT status, revision FROM orders WHERE order_id = ?', 'o1'),
    );
    expect(order).toEqual({ status: 'CONFIRMED', revision: 2 });
    const queued = store.transactionalSync((tx) =>
      tx.get<{ payload: string }>('SELECT payload FROM outbox WHERE message_id = ?', 'm1'),
    );
    expect(queued?.payload).toBe('{"kind":"confirmed"}');
  });

  it('returns false and enqueues nothing on a CAS miss (rollback)', async () => {
    const store = makeStore();
    commit(store);
    store.transactionalSync((tx) =>
      tx.run('INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)', 'o1', 'PENDING'),
    );

    const applied = await store.transitionAndEnqueue({
      casUpdateSql:
        'UPDATE orders SET status = ?, revision = ? WHERE order_id = ? AND revision = ?',
      casUpdateParams: ['CONFIRMED', 2, 'o1', 99],
      enqueueSql: 'INSERT OR REPLACE INTO outbox (message_id, payload) VALUES (?, ?)',
      enqueueRows: [['m1', '{"kind":"confirmed"}']],
    });
    expect(applied).toBe(false);

    const order = store.transactionalSync((tx) =>
      tx.get<{ status: string; revision: number }>('SELECT status, revision FROM orders WHERE order_id = ?', 'o1'),
    );
    expect(order).toEqual({ status: 'PENDING', revision: 1 });
    const queued = store.transactionalSync((tx) =>
      tx.all<{ message_id: string }>('SELECT message_id FROM outbox'),
    );
    expect(queued).toEqual([]);
  });

  it('runs with zero outbox rows (CAS-only usage)', async () => {
    const store = makeStore();
    commit(store);
    store.transactionalSync((tx) =>
      tx.run('INSERT INTO orders (order_id, status, revision) VALUES (?, ?, 1)', 'o2', 'PENDING'),
    );
    const applied = await store.transitionAndEnqueue({
      casUpdateSql:
        'UPDATE orders SET status = ?, revision = ? WHERE order_id = ? AND revision = ?',
      casUpdateParams: ['DONE', 2, 'o2', 1],
      enqueueSql: 'INSERT OR REPLACE INTO outbox (message_id, payload) VALUES (?, ?)',
      enqueueRows: [],
    });
    expect(applied).toBe(true);
  });
});