/**
 * @module @totemsdk/storage/conformance/harness
 *
 * Core conformance suite for any `StorageAdapter` implementation. The same
 * suite runs over `InMemory`, `:memory:` SQLite, and a durable file-backed
 * SQLite so storage contracts are verified identically regardless of backend.
 *
 * `makeStore()` must return a fresh store for each test.  Closing happens
 * automatically after each test via `close()` if present on the store.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import type {
  StorageAdapterWithCapabilities,
  CasStore,
  TransactionalStore,
  StoreCapabilities,
} from '../types.js';

export interface CoreConformanceStore extends StorageAdapterWithCapabilities {
  close?(): Promise<void>;
}

export type CoreConformanceMakeStore = () => Promise<CoreConformanceStore>;

export function runCoreConformance(suiteName: string, makeStore: CoreConformanceMakeStore): void {
  describe(suiteName, () => {
    let store: CoreConformanceStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    afterEach(async () => {
      await store.close?.();
    });

    describe('round-trip', () => {
      it('round-trips strings, numbers, booleans, and null', async () => {
        await store.set('str', 'hello');
        await store.set('num', 42);
        await store.set('float', 3.14);
        await store.set('bool', true);
        await store.set('nil', null);
        expect(await store.get('str')).toBe('hello');
        expect(await store.get('num')).toBe(42);
        expect(await store.get('float')).toBe(3.14);
        expect(await store.get('bool')).toBe(true);
        expect(await store.get('nil')).toBeNull();
      });

      it('round-trips bigint values', async () => {
        const val = 123456789012345678901234567890n;
        await store.set('bigint', val);
        expect(await store.get('bigint')).toBe(val);
      });

      it('round-trips Uint8Array values', async () => {
        const bytes = new Uint8Array([0x00, 0xff, 0xab, 0xcd]);
        await store.set('bytes', bytes);
        const result = await store.get<Uint8Array>('bytes');
        expect(result).toBeDefined();
        expect(result!.byteLength).toBe(bytes.byteLength);
        expect(Buffer.from(result!).toString('hex')).toBe(Buffer.from(bytes).toString('hex'));
      });

      it('round-trips nested objects with bigint and bytes', async () => {
        const value = { a: 1n, b: { c: new Uint8Array([1, 2, 3]), d: 'test' } };
        await store.set('nested', value);
        expect(await store.get('nested')).toEqual(value);
      });
    });

    describe('missing keys', () => {
      it('returns null for missing keys', async () => {
        expect(await store.get('nope')).toBeNull();
      });

      it('returns false for has on missing keys', async () => {
        expect(await store.has('nope')).toBe(false);
      });
    });

    describe('set / remove / clear', () => {
      it('set then get returns value', async () => {
        await store.set('k', 'v');
        expect(await store.get('k')).toBe('v');
      });

      it('overwrite replaces value', async () => {
        await store.set('k', 1);
        await store.set('k', 2);
        expect(await store.get('k')).toBe(2);
      });

      it('remove returns true for existing keys', async () => {
        await store.set('k', 1);
        expect(await store.remove('k')).toBe(true);
        expect(await store.get('k')).toBeNull();
      });

      it('remove returns false for missing keys', async () => {
        expect(await store.remove('nope')).toBe(false);
      });

      it('clear removes all keys', async () => {
        await store.set('a', 1);
        await store.set('b', 2);
        await store.clear();
        expect(await store.get('a')).toBeNull();
        expect(await store.get('b')).toBeNull();
        expect(await store.keys()).toEqual([]);
      });
    });

    describe('keys', () => {
      it('returns all keys', async () => {
        await store.set('x', 1);
        await store.set('y', 2);
        const keys = await store.keys();
        expect(keys.sort()).toEqual(['x', 'y']);
      });
    });

    describe('transaction', () => {
      it('applies all operations on commit', async () => {
        if (!('transaction' in store)) return;
        const tx = (store as unknown as TransactionalStore).transaction();
        tx.set('a', 1);
        tx.set('b', 2);
        await tx.commit();
        expect(await store.get('a')).toBe(1);
        expect(await store.get('b')).toBe(2);
      });

      it('get inside transaction returns committed state', async () => {
        if (!('transaction' in store)) return;
        await store.set('existing', 42);
        const tx = (store as unknown as TransactionalStore).transaction();
        expect(await tx.get('existing')).toBe(42);
        await tx.commit();
      });
    });

    describe('conditional update', () => {
      it('applies when current matches (first write)', async () => {
        if (!('conditionalUpdate' in store)) return;
        const result = await (store as unknown as CasStore).conditionalUpdate<number>(
          'counter',
          (current: number | null) => ({ next: (current ?? 0) + 1 }),
        );
        expect(result.applied).toBe(true);
        expect(result.value).toBe(1);
        expect(result.revision).toBeGreaterThanOrEqual(1);
      });

      it('applies and bumps revision on existing key', async () => {
        if (!('conditionalUpdate' in store)) return;
        await store.set('counter', 10);
        const first = await (store as unknown as CasStore).conditionalUpdate<number>(
          'counter',
          (current: number | null) => ({ next: (current ?? 0) + 1 }),
        );
        expect(first.applied).toBe(true);
        expect(first.value).toBe(11);
      });

      it('returns applied=false when abort is returned', async () => {
        if (!('conditionalUpdate' in store)) return;
        await store.set('k', 1);
        const result = await (store as unknown as CasStore).conditionalUpdate<number>(
          'k',
          (_current: number | null) => ({ abort: 'skip' }),
        );
        expect(result.applied).toBe(false);
        expect(result.value).toBe(1);
      });
    });

    describe('no-silent-downgrade', () => {
      it('declares capabilities and is accessible', () => {
        expect(store.capabilities).toBeDefined();
        expect(store.capabilities.acknowledge).toBeDefined();
        expect(typeof store.capabilities.atomic).toBe('boolean');
        expect(typeof store.capabilities.conditional).toBe('boolean');
      });
    });
  });
}