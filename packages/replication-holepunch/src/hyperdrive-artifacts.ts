/**
 * Hyperdrive-backed `ArtifactStoreBackend` (RFC-057 Phase 2).
 *
 * Paths are derived from the content address and never rewritten:
 *   /<namespace>/<algorithm>/<digest>
 *
 * Every read verifies the SHA3-256 digest before returning bytes; a mismatch is
 * `corrupt`, not `not-found`. `put` is idempotent for the same digest/bytes and
 * refuses to replace existing content.
 */

import { bytesToHex, hexToBytes, sha3_256 } from '@totemsdk/core';
import type {
  ArtifactBackendCapabilities,
  ArtifactRead,
  ArtifactRef,
  ArtifactStoreBackend,
  PutOptions,
  PutReceipt,
} from '@totemsdk/storage/artifacts';

export interface HyperdriveArtifactOptions {
  storagePath: string;
  /** Inject constructors for tests. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hyperdrive?: new (store: unknown) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Corestore?: new (path: string) => any;
}

export function artifactPath(ref: ArtifactRef): string {
  const namespace = ref.namespace;
  if (!namespace || namespace.includes('..') || namespace.startsWith('/')) {
    throw new Error('hyperdrive artifacts: namespace must be a safe relative segment');
  }
  const digest = ref.digest.replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('hyperdrive artifacts: digest must be 32-byte hex');
  return `/${namespace}/${ref.algorithm}/${digest}`;
}

export class HyperdriveArtifactBackend implements ArtifactStoreBackend {
  readonly capabilities: ArtifactBackendCapabilities = {
    writable: true,
    deletable: false,
    acknowledge: 'buffered',
    atomic: false,
    retention: 'fixed',
    offlineReadable: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private readonly drive: any, private readonly store: any) {}

  static async open(options: HyperdriveArtifactOptions): Promise<HyperdriveArtifactBackend> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let HyperdriveCtor: any = options.Hyperdrive;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let CorestoreCtor: any = options.Corestore;
    if (!HyperdriveCtor) {
      HyperdriveCtor = ((await import('hyperdrive' as string)) as { default: new (store: unknown) => unknown }).default;
    }
    if (!CorestoreCtor) {
      CorestoreCtor = ((await import('corestore' as string)) as { default: new (path: string) => unknown }).default;
    }
    const store = new CorestoreCtor(options.storagePath);
    const drive = new HyperdriveCtor(store);
    await drive.ready?.();
    return new HyperdriveArtifactBackend(drive, store);
  }

  async put(ref: ArtifactRef, bytes: Uint8Array, _options?: PutOptions): Promise<PutReceipt> {
    const digest = ref.digest.replace(/^0x/i, '').toLowerCase();
    const actual = bytesToHex(sha3_256(bytes)).toLowerCase();
    if (digest !== actual) {
      throw new Error(`hyperdrive artifacts: bytes do not match ref digest (${actual} != ${digest})`);
    }
    const path = artifactPath(ref);
    const existing: Uint8Array | null = await this.drive.get(path);
    if (existing !== null) {
      if (bytesToHex(sha3_256(existing)).toLowerCase() !== digest) {
        throw new Error('hyperdrive artifacts: existing path is corrupt; refusing to rewrite');
      }
      return { ref, size: bytes.byteLength, acknowledge: this.capabilities.acknowledge };
    }
    await this.drive.put(path, Buffer.from(bytes));
    return { ref, size: bytes.byteLength, acknowledge: this.capabilities.acknowledge };
  }

  async get(ref: ArtifactRef): Promise<ArtifactRead> {
    let bytes: Uint8Array | null;
    try {
      bytes = await this.drive.get(artifactPath(ref));
    } catch (error) {
      return { status: 'unavailable', message: error instanceof Error ? error.message : String(error) };
    }
    if (bytes === null) return { status: 'not-found' };
    const expected = ref.digest.replace(/^0x/i, '').toLowerCase();
    const actual = bytesToHex(sha3_256(bytes)).toLowerCase();
    if (expected !== actual) {
      return { status: 'corrupt', message: `digest mismatch: expected ${expected}, got ${actual}` };
    }
    return { status: 'ok', bytes };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get raw(): any {
    return this.drive;
  }

  async close(): Promise<void> {
    await this.drive.close?.();
    await this.store.close?.();
  }
}

/** Helper for tests/producers: digest a byte payload as an ArtifactRef. */
export function artifactRefFor(namespace: string, bytes: Uint8Array): ArtifactRef {
  return { namespace, algorithm: 'sha3-256', digest: bytesToHex(sha3_256(bytes)) };
}
