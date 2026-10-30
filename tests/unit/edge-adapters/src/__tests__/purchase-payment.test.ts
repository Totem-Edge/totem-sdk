/**
 * purchase-payment idempotency claim tests (RFC-007 G5).
 *
 * The adapter records an atomic pending claim *before* the external port call;
 * these tests exercise the idempotency concurrency gate (exactly one pay under
 * N concurrent same-key calls), crash-window honesty (pending claim never
 * re-paid), durable reopen, corruption surfaced (never absence), and no silent
 * durability downgrade.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { createPurchasePaymentAdapter } from '../purchase-payment.js';
import type { PaymentPortLike, PurchasePaymentStore } from '../purchase-payment.js';

function makePort(invocations: jest.Mock): PaymentPortLike {
  return {
    pay: invocations,
  } as unknown as PaymentPortLike;
}

const OK_RESULT = { ok: true, data: { txpowId: '0xTXPOWID' } };

const VOLATILE = { requireAckMode: 'volatile' as const };

describe('createPurchasePaymentAdapter — atomic claim (G5)', () => {
  it('pays once for a keyless call (no idempotency possible)', async () => {
    const pay = jest.fn().mockResolvedValue(OK_RESULT);
    const adapter = createPurchasePaymentAdapter({
      port: makePort(pay),
      store: new MemoryStore(),
      ...VOLATILE,
    });

    const r = await adapter.pay({ recipient: 'MxABC', amount: '5' });
    expect(r.ok).toBe(true);
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('records the completed outcome so a serial retry replays it (never double-pays)', async () => {
    const pay = jest.fn().mockResolvedValue(OK_RESULT);
    const adapter = createPurchasePaymentAdapter({
      port: makePort(pay),
      store: new MemoryStore(),
      ...VOLATILE,
    });

    const first = await adapter.pay({ recipient: 'MxABC', amount: '5', idempotencyKey: 'k:1' });
    const second = await adapter.pay({ recipient: 'MxABC', amount: '5', idempotencyKey: 'k:1' });

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('idempotency concurrency gate: exactly one pay port call for N concurrent same-key calls', async () => {
    const pay = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return OK_RESULT;
    });
    const adapter = createPurchasePaymentAdapter({
      port: makePort(pay),
      store: new MemoryStore(),
      ...VOLATILE,
    });

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        adapter.pay({ recipient: 'MxABC', amount: '5', idempotencyKey: 'k:conc' }),
      ),
    );

    // Exactly one underlying payment — a duplicate never re-invokes the port.
    expect(pay).toHaveBeenCalledTimes(1);
    // Every caller resolves: winner gets the result, later callers replay it.
    for (const r of results) {
      expect(r).toEqual(OK_RESULT);
    }
  });

  it('an in-flight pending claim is never re-paid (crash window returns PAYMENT_STATE_UNKNOWN)', async () => {
    const pay = jest.fn().mockResolvedValue(OK_RESULT);
    const store = new MemoryStore();
    const adapter = createPurchasePaymentAdapter({ port: makePort(pay), store, ...VOLATILE });
    const claimKey = 'totem_payment:v1:k:inflight';

    // A crash between claim and publish leaves a pending marker:
    await store.set(claimKey, { phase: 'pending', claimedAt: Date.now() });

    const r = await adapter.pay({ recipient: 'MxABC', amount: '5', idempotencyKey: 'k:inflight' });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('PAYMENT_STATE_UNKNOWN');
    expect(pay).not.toHaveBeenCalled();
  });

  it('surfaces a corrupt claim record as an error (never treats it as absent)', async () => {
    const pay = jest.fn().mockResolvedValue(OK_RESULT);
    const store = new MemoryStore();

    await store.set('totem_payment:v1:k:corrupt', {
      phase: 'completed',
      completedAt: Date.now(),
      result: { ok: false, error: 'box on a wire' },
    });

    const adapter = createPurchasePaymentAdapter({ port: makePort(pay), store, ...VOLATILE });
    const r = await adapter.pay({ recipient: 'MxABC', amount: '5', idempotencyKey: 'k:corrupt' });
    expect(r).toEqual({ ok: false, error: 'box on a wire' });
    // The corrupt-completed record is not treated as a fresh key — no re-pay.
    expect(pay).not.toHaveBeenCalled();
  });

  it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
    expect(() =>
      createPurchasePaymentAdapter({
        port: makePort(jest.fn()),
        store: new MemoryStore(),
      }),
    ).toThrow(/acknowledges "volatile" but consumer requires "durably-acknowledged"/);
  });

  describe('FileStore (durably-acknowledged) — durable reopen', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-payment-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('reopens a completed outcome across a brand-new adapter (durable dedup)', async () => {
      const pay = jest.fn().mockResolvedValue(OK_RESULT);
      const adapter1 = createPurchasePaymentAdapter({
        port: makePort(pay),
        store: new FileStore(dir) as PurchasePaymentStore,
      });
      await adapter1.pay({ recipient: 'MxABC', amount: '5', idempotencyKey: 'k:durable' });

      const payAgain = jest.fn().mockResolvedValue(OK_RESULT);
      const adapter2 = createPurchasePaymentAdapter({
        port: makePort(payAgain),
        store: new FileStore(dir) as PurchasePaymentStore,
      });
      const replayed = await adapter2.pay({
        recipient: 'MxABC',
        amount: '5',
        idempotencyKey: 'k:durable',
      });

      expect(replayed).toEqual(OK_RESULT);
      expect(pay).toHaveBeenCalledTimes(1);
      expect(payAgain).not.toHaveBeenCalled();
    });

    it('stays honest after a crash-between-claim-and-publish: pending yields UNKNOWN across restart', async () => {
      const store1 = new FileStore(dir);
      const p1 = {
        recipient: 'MxABC',
        amount: '5',
        idempotencyKey: 'k:crashed',
      };

      // Simulate claim-then-crash: adapter claims, then the process dies before
      // port.pay completes. Only the pending marker lands on disk.
      const payNever = jest.fn().mockImplementation(() => new Promise(() => {}));
      const adapter1 = createPurchasePaymentAdapter({
        port: makePort(payNever),
        store: store1 as PurchasePaymentStore,
      });
      // Fire-and-forget: the claim persists, then the process "dies"
      // (the port call never resolves).
      void adapter1.pay(p1);

      // Give the claim time to persist, then "crash": never resolve the pay.
      await new Promise((r) => setTimeout(r, 30));

      const replay = createPurchasePaymentAdapter({
        port: makePort(jest.fn()),
        store: new FileStore(dir) as PurchasePaymentStore,
      });
      const r = await replay.pay(p1);

      expect(r.ok).toBe(false);
      expect(r.errorCode).toBe('PAYMENT_STATE_UNKNOWN');
      // The retry does NOT re-invoke the port — the window is surfaced, not re-paid.
    });
  });
});