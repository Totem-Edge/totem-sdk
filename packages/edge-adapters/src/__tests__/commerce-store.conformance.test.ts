/**
 * commerce-store.conformance.test.ts — Reusable conformance suite for durable
 * CommerceStore backends.
 *
 * The same behavioral tests run against:
 *   - InMemoryCommerceStore (dev/test)
 *   - SQLiteCommerceStore (production reference)
 *
 * A backend is not production-compatible unless it passes this suite.
 *
 * Verified behaviors:
 *   - CAS (compareAndSet) with revision
 *   - transitionAndEnqueue atomicity (CAS + outbox in one transaction)
 *   - replay claim race (exactly one winner)
 *   - replay lease reclaim
 *   - principal tryOpen race (no over-admission)
 *   - principal reconcile (release stale slots)
 *   - terminal durability
 *   - purchase recovery
 *   - outbox persistence
 */

import {
  InMemoryNegotiationStore,
  InMemoryPurchaseStore,
  InMemoryPrincipalNegotiationStore,
  InMemoryReplayLedger,
  InMemoryOutboxStore,
  createNegotiationRecord,
  createPurchaseRecord,
  type NegotiationRecord,
  type NegotiationStore,
  type OutboxMessage,
  type PrincipalNegotiationStore,
  type PurchaseRecord,
  type PurchaseStore,
  type ReplayLedger,
} from '@totemsdk/edge';
import { createSQLiteCommerceStore, type CommerceStore } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// CommerceStore aggregation
// ─────────────────────────────────────────────────────────────────────────────

function makeInMemoryCommerceStore(): CommerceStore {
  const outbox = new InMemoryOutboxStore();
  return {
    negotiations: new InMemoryNegotiationStore(outbox),
    purchases: new InMemoryPurchaseStore(),
    replay: new InMemoryReplayLedger(),
    principals: new InMemoryPrincipalNegotiationStore(),
    outbox,
  };
}

function makeSQLiteCommerceStore(): CommerceStore {
  return createSQLiteCommerceStore({ filename: ':memory:' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeNegotiation(id: string, revision = 1): NegotiationRecord {
  return createNegotiationRecord({
    negotiationId: id,
    principal: 'p1',
    counterparty: 's1',
    manifestId: 'm1',
    expiresAt: Date.now() + 60_000,
  });
}

function makePurchase(id: string, revision = 1): PurchaseRecord {
  return createPurchaseRecord({
    purchaseId: id,
    intent: { id, resource: 'compute', maxSpend: { amount: '10', tokenId: '0x00' } },
  });
}

const PRINCIPAL_LIMITS = {
  maxConcurrentNegotiations: 2,
  cooldownMs: 0,
  maxNegotiationsPerWindow: 10,
  windowMs: 60_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Conformance suite
// ─────────────────────────────────────────────────────────────────────────────

export function runCommerceStoreConformanceSuite(
  name: string,
  makeStore: () => CommerceStore,
): void {
  describe(`CommerceStore conformance — ${name}`, () => {
    // ── CAS ────────────────────────────────────────────────────────────────
    it('compareAndSet succeeds on matching revision, fails on stale', async () => {
      const store = makeStore();
      const n = makeNegotiation('n1');
      await store.negotiations.create(n);

      const next = { ...n, state: 'NEGOTIATING' as const, revision: 2 };
      expect(await store.negotiations.compareAndSet('n1', 1, next)).toBe(true);
      // Stale revision fails.
      expect(await store.negotiations.compareAndSet('n1', 1, next)).toBe(false);
      // Current revision succeeds.
      expect(await store.negotiations.compareAndSet('n1', 2, { ...next, revision: 3 })).toBe(true);
    });

    // ── transitionAndEnqueue atomicity ─────────────────────────────────────
    it('transitionAndEnqueue commits CAS + outbox atomically', async () => {
      const store = makeStore();
      const n = makeNegotiation('n1');
      await store.negotiations.create(n);

      const next = { ...n, state: 'AGREED' as const, revision: 2 };
      const outbox: OutboxMessage[] = [
        { messageId: 'm1', recipient: 's1', payload: '{"ok":true}' },
      ];
      expect(await store.negotiations.transitionAndEnqueue('n1', 1, next, outbox)).toBe(true);

      // Both committed.
      const record = await store.negotiations.get('n1');
      expect(record?.state).toBe('AGREED');
      const undelivered = await store.outbox.listUndelivered();
      expect(undelivered.length).toBe(1);
      expect(undelivered[0].messageId).toBe('m1');
    });

    it('transitionAndEnqueue rolls back outbox on stale CAS', async () => {
      const store = makeStore();
      const n = makeNegotiation('n1');
      await store.negotiations.create(n);

      const next = { ...n, state: 'AGREED' as const, revision: 2 };
      const outbox: OutboxMessage[] = [
        { messageId: 'm1', recipient: 's1', payload: '{"ok":true}' },
      ];
      // Wrong expected revision → CAS fails → outbox must NOT be written.
      expect(await store.negotiations.transitionAndEnqueue('n1', 99, next, outbox)).toBe(false);
      const undelivered = await store.outbox.listUndelivered();
      expect(undelivered.length).toBe(0);
    });

    // ── Replay claim race ───────────────────────────────────────────────────
    it('replay claim: exactly one winner under concurrency', async () => {
      const store = makeStore();
      const [a, b] = await Promise.all([
        store.replay.claim('msg-1', 1000),
        store.replay.claim('msg-1', 1000),
      ]);
      const winners = [a, b].filter((r) => r.claimed).length;
      expect(winners).toBe(1);
    });

    it('replay lease reclaim after expiry', async () => {
      const store = makeStore();
      await store.replay.claim('msg-2', 1000, 100);
      // Lease expired (now > 1000+100).
      const reclaim = await store.replay.claim('msg-2', 2000, 100);
      expect(reclaim.claimed).toBe(true);
      if (reclaim.claimed) expect(reclaim.reclaimed).toBe(true);
    });

    it('replay completed returns prior outcome', async () => {
      const store = makeStore();
      await store.replay.claim('msg-3', 1000);
      await store.replay.complete('msg-3', { ok: true, result: 'agreed' });
      const replay = await store.replay.claim('msg-3', 2000);
      expect(replay.claimed).toBe(false);
      if (!replay.claimed && replay.entry) {
        expect(replay.entry.state).toBe('COMPLETED');
      }
    });

    // ── Principal tryOpen race ─────────────────────────────────────────────
    it('principal tryOpen: no over-admission under concurrency', async () => {
      const store = makeStore();
      const results = await Promise.all([
        store.principals.tryOpen('p', 'n1', 1000, PRINCIPAL_LIMITS),
        store.principals.tryOpen('p', 'n2', 1000, PRINCIPAL_LIMITS),
        store.principals.tryOpen('p', 'n3', 1000, PRINCIPAL_LIMITS),
      ]);
      const allowed = results.filter((r) => r.allowed).length;
      expect(allowed).toBe(2); // maxConcurrentNegotiations = 2
    });

    it('principal reconcile releases stale slots', async () => {
      const store = makeStore();
      await store.principals.tryOpen('p', 'n1', 1000, PRINCIPAL_LIMITS);
      await store.principals.tryOpen('p', 'n2', 1000, PRINCIPAL_LIMITS);
      // Reconcile: only n1 active → n2 released.
      await store.principals.reconcile('p', ['n1']);
      const r = await store.principals.tryOpen('p', 'n3', 1000, PRINCIPAL_LIMITS);
      expect(r.allowed).toBe(true);
    });

    it('principal close releases a specific slot', async () => {
      const store = makeStore();
      await store.principals.tryOpen('p', 'n1', 1000, PRINCIPAL_LIMITS);
      await store.principals.tryOpen('p', 'n2', 1000, PRINCIPAL_LIMITS);
      await store.principals.close('p', 'n1');
      const r = await store.principals.tryOpen('p', 'n3', 1000, PRINCIPAL_LIMITS);
      expect(r.allowed).toBe(true);
    });

    // ── Terminal durability ─────────────────────────────────────────────────
    it('terminal negotiation state persists', async () => {
      const store = makeStore();
      const n = makeNegotiation('n1');
      await store.negotiations.create(n);
      const next = { ...n, state: 'AGREED' as const, revision: 2 };
      await store.negotiations.compareAndSet('n1', 1, next);
      const record = await store.negotiations.get('n1');
      expect(record?.state).toBe('AGREED');
      // listRecoverable excludes terminal.
      const recoverable = await store.negotiations.listRecoverable?.();
      expect(recoverable?.find((r) => r.negotiationId === 'n1')).toBeUndefined();
    });

    // ── Purchase recovery ──────────────────────────────────────────────────
    it('purchase recovery lists in-flight purchases', async () => {
      const store = makeStore();
      const p = makePurchase('p1');
      await store.purchases.create(p);
      const recoverable = await store.purchases.listRecoverable?.();
      expect(recoverable?.find((r) => r.purchaseId === 'p1')).toBeDefined();
    });

    it('purchase CAS with revision', async () => {
      const store = makeStore();
      const p = makePurchase('p1');
      await store.purchases.create(p);
      const next = { ...p, status: 'PAID' as const, revision: 2 };
      expect(await store.purchases.compareAndSet('p1', 1, next)).toBe(true);
      expect(await store.purchases.compareAndSet('p1', 1, next)).toBe(false);
    });

    // ── Outbox persistence ─────────────────────────────────────────────────
    it('outbox markDelivered + recordAttempt', async () => {
      const store = makeStore();
      await store.outbox.enqueue({
        messageId: 'm1',
        recipient: 's1',
        message: { version: 1, negotiationId: 'n1' } as never,
        enqueuedAt: 1000,
        attempts: 0,
      });
      await store.outbox.recordAttempt('m1');
      await store.outbox.markDelivered('m1', 2000);
      const undelivered = await store.outbox.listUndelivered();
      expect(undelivered.length).toBe(0);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Run against both backends
// ─────────────────────────────────────────────────────────────────────────────

runCommerceStoreConformanceSuite('InMemory', makeInMemoryCommerceStore);
runCommerceStoreConformanceSuite('SQLite', makeSQLiteCommerceStore);
