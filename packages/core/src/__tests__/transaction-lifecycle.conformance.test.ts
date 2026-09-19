/**
 * TransactionLifecycle persistence-conformance (RFC-007 Phase 4).
 *
 * Exercises a full prepare → sign → finalize run with every persistence
 * consumer (LeaseStore / WatermarkStore / TransactionReceiptStore) over the
 * same strict, disk-backed StorageAdapter, then proves the recovery
 * guarantees across simulated restarts:
 * - a lease reserved at prepare survives restart and can be finalized later;
 * - finalize atomically advances the watermark, stores the receipt, and
 *   resolves the lease;
 * - a corrupt watermark record fails the lifecycle closed (never silently
 *   re-exposes reserved index ranges).
 */


import { NoopLogger, NoopMetrics, type HttpClient, type HttpResponse } from '../adapters/index.js';
import { LeaseStore } from '../lease/LeaseStore.js';
import { WatermarkStore, type WotsIndices } from '../lease/WatermarkStore.js';
import { DurableTestStorage, createTempDir } from '../../test/helpers/durable-test-storage.js';
import { TransactionLifecycle } from '../tx/TransactionLifecycle.js';
import { TransactionService } from '../tx/TransactionService.js';
import { TransactionReceiptStore } from '../tx/TransactionReceiptStore.js';

const SEED_32 = new Uint8Array(32).fill(0xab);
const DIGEST_TX = '11'.repeat(32);

class StubHttp implements HttpClient {
  async post<T>(url: string): Promise<HttpResponse<T>> {
    if (url.endsWith('/v1/wots-hardened/prepare')) {
      return this.ok({
        addressIndex: 7,
        l1: 3,
        l2: 5,
        leaseToken: 'lease-token-42',
        digestTx: DIGEST_TX,
        digestL2: null,
        digestL3: null,
        txId: 'tx-42',
        rootPublicKey: '0xroot',
        paramSet: 'v2-spec',
        leaseId: 'lease-42',
        leaseTTL: 60000,
      } as T);
    }
    if (url.endsWith('/v1/wots-hardened/finalize')) {
      return this.ok({ ok: true, leaseId: 'lease-42', txpowid: '0xtxpowid-42' } as T);
    }
    return this.ok(undefined as T);
  }

  async get<T>(): Promise<HttpResponse<T>> {
    return this.ok(undefined as T);
  }

  async put<T>(): Promise<HttpResponse<T>> {
    return this.ok(undefined as T);
  }

  async delete<T>(): Promise<HttpResponse<T>> {
    return this.ok(undefined as T);
  }

  private ok<T>(data: T): HttpResponse<T> {
    return { ok: true, status: 200, statusText: 'OK', headers: {}, data };
  }
}

function makeService(): TransactionService {
  return new TransactionService(
    new StubHttp(),
    { baseUrl: 'https://stub.example', apiKey: 'test' },
    new NoopLogger(),
    new NoopMetrics(),
  );
}

async function makeLifecycle(
  storage: DurableTestStorage,
  opts: { preinitialize?: boolean } = {},
): Promise<TransactionLifecycle> {
  const service = makeService();
  const leaseStore = new LeaseStore(storage, new NoopLogger());
  const watermarkStore = new WatermarkStore(storage, new NoopLogger());
  const receiptStore = new TransactionReceiptStore(storage, new NoopLogger());
  if (opts.preinitialize ?? true) {
    await leaseStore.initialize();
    await watermarkStore.initialize();
    await receiptStore.initialize();
  }
  return new TransactionLifecycle(service, leaseStore, watermarkStore, receiptStore, new NoopLogger(), new NoopMetrics());
}

/** Fresh consumers over the same on-disk state — simulates a process restart. */
async function restartReaders(dir: string): Promise<{
  watermark: () => Promise<{ next: WotsIndices | null; used: Array<[number, number, number]> }>;
  leaseByToken: (token: string) => Promise<unknown>;
  receipts: () => Promise<unknown[]>;
  leak: (token: string) => Promise<boolean>;
}> {
  const storage = new DurableTestStorage(dir);
  const watermarkStore = new WatermarkStore(storage, new NoopLogger());
  const leaseStore = new LeaseStore(storage, new NoopLogger());
  const receiptStore = new TransactionReceiptStore(storage, new NoopLogger());
  return {
    watermark: async () => {
      const state = await watermarkStore.load();
      if (!state) return { next: null, used: [] };
      return {
        next: { addressIndex: state.next_addressIndex, l1: state.next_l1, l2: state.next_l2 },
        used: state.usedIndices,
      };
    },
    leaseByToken: async (token: string) => {
      await leaseStore.initialize();
      return leaseStore.getByToken(token);
    },
    receipts: async () => {
      await receiptStore.initialize();
      return receiptStore.getAll();
    },
    leak: async (token: string) => {
      await leaseStore.initialize();
      return leaseStore.getByToken(token) !== undefined;
    },
  };
}

describe('TransactionLifecycle — durability conformance', () => {
  let dir: string;
  let storage: DurableTestStorage;

  beforeEach(async () => {
    dir = await createTempDir();
    storage = new DurableTestStorage(dir);
  });

  afterEach(async () => {
    await storage.clear().catch(() => undefined);
  });

  it('completes a full prepare → sign → finalize and survives restart', async () => {
    const first = await makeLifecycle(storage);
    const prepared = await first.prepare({ to: '0xalice', amount: '250', addressIndex: 7 }, '0xroot');

    expect(prepared.leaseId).toBe('lease-42');
    const signed = await first.sign(prepared, SEED_32, {});
    expect(signed.signedHex).toMatch(/^0x[0-9a-f]+$/);

    await first.finalize(prepared.leaseToken, signed.signedHex, prepared.metadata);

    const readers = await restartReaders(dir);
    const watermark = await readers.watermark();
    expect(watermark.next).toEqual({ addressIndex: 7, l1: 3, l2: 6 });
    expect(watermark.used).toContainEqual([7, 3, 5]);
    expect(await readers.leak(prepared.leaseToken)).toBe(false);
    const receipts = await readers.receipts();
    expect(receipts).toHaveLength(1);
  });

  it('keeps a lease reserved across a restart between prepare and finalize', async () => {
    const first = await makeLifecycle(storage);
    const prepared = await first.prepare({ to: '0xbob', amount: '100', addressIndex: 7 }, '0xroot');

    const readers = await restartReaders(dir);
    expect(await readers.leak(prepared.leaseToken)).toBe(true);
    const watermarkBeforeFinalize = await readers.watermark();
    expect(watermarkBeforeFinalize.next).toEqual({ addressIndex: 0, l1: 0, l2: 0 });

    const midLifecycle = await makeLifecycle(new DurableTestStorage(dir));
    const signed = await midLifecycle.sign(prepared, SEED_32, {});
    await midLifecycle.finalize(prepared.leaseToken, signed.signedHex, prepared.metadata);

    const after = await restartReaders(dir);
    const watermarkAfter = await after.watermark();
    expect(watermarkAfter.next).toEqual({ addressIndex: 7, l1: 3, l2: 6 });
    expect(await after.leak(prepared.leaseToken)).toBe(false);
  });

  it('does not re-finalize an already-completed lease after restart', async () => {
    const first = await makeLifecycle(storage);
    const prepared = await first.prepare({ to: '0xcarol', amount: '300', addressIndex: 7 }, '0xroot');
    const signed = await first.sign(prepared, SEED_32, {});
    await first.finalize(prepared.leaseToken, signed.signedHex, prepared.metadata);

    const restarted = await makeLifecycle(new DurableTestStorage(dir));
    await expect(
      restarted.finalize(prepared.leaseToken, signed.signedHex, prepared.metadata),
    ).rejects.toThrow(/Lease not found/);
  });

  it('fails closed when the watermark record is corrupt', async () => {
    const first = await makeLifecycle(storage);
    await first.prepare({ to: '0xmallory', amount: '1', addressIndex: 7 }, '0xroot');

    await storage.corrupt('totem_wots_watermark');

    const restarted = await makeLifecycle(new DurableTestStorage(dir), { preinitialize: false });
    await expect(
      restarted.prepare({ to: '0xmallory', amount: '1', addressIndex: 7 }, '0xroot'),
    ).rejects.toThrow(/corrupt/);

    expect(await storage.has('totem_wots_watermark')).toBe(true);
  });
});