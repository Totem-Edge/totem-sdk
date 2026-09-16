/**
 * @module @totemsdk/storage/conformance/backend-harness
 *
 * Conformance suite for any `ArtifactStoreBackend` implementation. This is what
 * "tested contract" means in RFC-007 §4.3: an external store earns that label
 * only by passing this suite (put/get, status taxonomy, delete/retention where
 * declared). The suite is gated on the backend's declared capabilities so
 * immutable (writable:false) and read-only stores are validated honestly rather
 * than forced into a KV shape.
 */

import { describe, it, expect } from '@jest/globals';

import type {
  ArtifactRef,
  ArtifactStoreBackend,
} from '../artifacts/types.js';

export interface BackendConformanceStore {
  readonly backend: ArtifactStoreBackend;
}

export type BackendConformanceMakeStore = () => Promise<BackendConformanceStore>;

export function runBackendConformance(suiteName: string, makeStore: BackendConformanceMakeStore): void {
  describe(suiteName, () => {
    it('declares a complete capability set', async () => {
      const { backend } = await makeStore();
      expect(typeof backend.capabilities.writable).toBe('boolean');
      expect(typeof backend.capabilities.atomic).toBe('boolean');
      expect(['durably-acknowledged', 'buffered', 'volatile']).toContain(backend.capabilities.acknowledge);
      expect(['fixed', 'managed', 'none']).toContain(backend.capabilities.retention);
      expect(typeof backend.capabilities.offlineReadable).toBe('boolean');
    });

    it('returns not-found for unknown refs', async () => {
      const { backend } = await makeStore();
      const ref: ArtifactRef = {
        namespace: 'test',
        algorithm: 'sha3-256',
        digest: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      };
      const read = await backend.get(ref);
      expect(read.status).toBe('not-found');
    });

    ifWritable('put then get returns the same bytes', async (backend) => {
      const ref: ArtifactRef = {
        namespace: 'test',
        algorithm: 'sha3-256',
        digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0xff]);
      const receipt = await backend.put(ref, bytes);
      expect(receipt.ref.digest).toBe(ref.digest);
      expect(receipt.size).toBe(bytes.byteLength);

      const read = await backend.get(ref);
      expect(read.status).toBe('ok');
      expect(Buffer.from(read.bytes!).toString('hex')).toBe(Buffer.from(bytes).toString('hex'));
    });

    ifWritable('put overwrites same-ref bytes', async (backend) => {
      const ref: ArtifactRef = {
        namespace: 'test',
        algorithm: 'sha3-256',
        digest: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      };
      await backend.put(ref, new Uint8Array([9]));
      await backend.put(ref, new Uint8Array([8, 7]));
      const read = await backend.get(ref);
      expect(read.status).toBe('ok');
      expect(Buffer.from(read.bytes!).toString('hex')).toBe('0807');
    });
  });

  function ifWritable(name: string, fn: (backend: ArtifactStoreBackend) => Promise<void>): void {
    it(name, async () => {
      const { backend } = await makeStore();
      if (!backend.capabilities.writable) {
        return;
      }
      await fn(backend);
    });
  }
}